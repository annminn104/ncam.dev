// Builds a preset's figures (apps/chess/AGENTS.md, "Figures (GLB presets)"). Blender, headless,
// writes one raw GLB per piece type and LOD (art/blender/export.py). Each is then welded,
// simplified to its triangle budget with the face decals locked, encoded and meshopt-compressed
// into public/presets/<preset>/<type>.glb and <type>-low.glb.
//   pnpm --filter @ncam/chess art:holy-order       (Blender 5.2: $BLENDER, else `blender` on PATH)
//   node scripts/build-figures.mjs holy-order kq   (some piece types only)
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { compactPrimitive, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const local = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
// The simplifier stops at the budget or at this error, as a share of the figure's size, whichever
// it meets first: 1.2e-3 is ~1.6 mm on the king (under a pixel at any camera distance).
const ERROR = { high: 1.2e-3, low: 6e-3 };
// The widest outline a part may have: _LINE ships as width / LINE_MAX in a byte (figure/slots.ts).
const LINE_MAX = 0.008;
// The last index into SLOTS (figure/slots.ts): _SLOT ships as that index in a byte.
const SLOT_MAX = 21;
const RAW_ATTRIBUTES = 'NORMAL,POSITION,_KEEP,_LINE,_SLOT';

const [preset, types = 'kqbrnp'] = process.argv.slice(2);
const budgets = JSON.parse(await readFile(local('art/budgets.json'), 'utf8'));
if (!budgets[preset]) {
  console.error(
    `usage: node scripts/build-figures.mjs <${Object.keys(budgets).join('|')}> [types]`,
  );
  process.exit(2);
}
const { triangles: caps, bytes: setCaps } = budgets[preset];
const rawDir = local(`art/.out/${preset}/`);
const outDir = local(`public/presets/${preset}/`);

const blender = process.env.BLENDER ?? 'blender';
const args = ['--background', '--factory-startup', '--python-exit-code', '1'];
const exported = spawnSync(
  blender,
  [...args, '--python', local('art/blender/export.py'), '--', preset, rawDir, types],
  { stdio: 'inherit' },
);
if (exported.error || exported.status !== 0) {
  const why = exported.error?.message ?? `exit ${exported.status}`;
  console.error(`figures: Blender failed (${why}); BLENDER must name Blender 5.2`);
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const triangles = (prim) => prim.getIndices().getCount() / 3;

async function pack(src, dst, cap, error) {
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const meshes = doc.getRoot().listMeshes();
  const prims = meshes[0]?.listPrimitives() ?? [];
  if (meshes.length !== 1 || prims.length !== 1 || prims[0].getMode() !== 4) {
    throw new Error(`${src}: expected one mesh with one triangle primitive`);
  }
  const [prim] = prims;
  const names = prim.listSemantics().sort().join(',');
  if (names !== RAW_ATTRIBUTES)
    throw new Error(`${src}: attributes ${names}, not ${RAW_ATTRIBUTES}`);
  if (
    prim
      .getAttribute('_SLOT')
      .getArray()
      .some((v) => !Number.isInteger(v) || v < 0 || v > SLOT_MAX)
  ) {
    throw new Error(`${src}: a _SLOT outside 0-${SLOT_MAX}`);
  }
  if (
    prim
      .getAttribute('_LINE')
      .getArray()
      .some((v) => v < 0 || v > LINE_MAX)
  ) {
    throw new Error(`${src}: a _LINE outside 0-${LINE_MAX}`);
  }
  if (
    !prim
      .getAttribute('_KEEP')
      .getArray()
      .some((v) => v > 0.5)
  ) {
    throw new Error(`${src}: no _KEEP vertex (the face parts are the ones export.py's FACE names)`);
  }

  await doc.transform(weld());
  if (triangles(prim) > cap) {
    // The face decals (_KEEP) stay whole; the budget is spent everywhere else.
    const lock = Uint8Array.from(prim.getAttribute('_KEEP').getArray(), (v) => (v > 0.5 ? 1 : 0));
    const [indices] = MeshoptSimplifier.simplifyWithAttributes(
      Uint32Array.from(prim.getIndices().getArray()),
      prim.getAttribute('POSITION').getArray(),
      3,
      new Float32Array(0),
      0,
      [],
      lock,
      cap * 3,
      error,
    );
    prim.getIndices().setArray(indices);
    compactPrimitive(prim);
  }
  if (triangles(prim) > cap) {
    throw new Error(`${src}: ${triangles(prim)} triangles at error ${error}, over its ${cap}`);
  }
  const keep = prim.getAttribute('_KEEP');
  prim.setAttribute('_KEEP', null);
  keep.dispose();

  const slot = prim.getAttribute('_SLOT');
  slot.setArray(Uint8Array.from(slot.getArray(), (v) => Math.round(v))).setNormalized(false);
  const line = prim.getAttribute('_LINE');
  line
    .setArray(Uint8Array.from(line.getArray(), (v) => Math.round((v / LINE_MAX) * 255)))
    .setNormalized(true);
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 8 }),
  );
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(dst, doc);
  const vertices = prim.getAttribute('POSITION').getCount();
  return { triangles: triangles(prim), vertices, bytes: (await stat(dst)).size };
}

await mkdir(outDir, { recursive: true });
for (const type of types) {
  for (const [lod, i] of [
    ['high', 0],
    ['low', 1],
  ]) {
    const file = lod === 'low' ? `${type}-low.glb` : `${type}.glb`;
    const r = await pack(rawDir + file, outDir + file, caps[type][i], ERROR[lod]);
    const kb = (r.bytes / 1000).toFixed(0);
    console.log(
      `figures: ${preset}/${file}  ${r.triangles} triangles, ${r.vertices} vertices, ${kb} KB`,
    );
  }
}
// The whole set within its size budget, files from earlier runs included.
const files = (await readdir(outDir)).filter((f) => f.endsWith('.glb'));
for (const lod of ['high', 'low']) {
  let total = 0;
  for (const f of files.filter((f) => f.endsWith('-low.glb') === (lod === 'low'))) {
    total += (await stat(outDir + f)).size;
  }
  const line = `figures: the ${lod} set is ${(total / 1000).toFixed(0)} KB of ${setCaps[lod] / 1000} KB`;
  if (total > setCaps[lod]) {
    console.error(`${line}: over budget`);
    process.exit(1);
  }
  console.log(line);
}

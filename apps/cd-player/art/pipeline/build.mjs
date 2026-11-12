// Builds public/assets/cd-player.glb (or, given `clear`, cd-player-clear.glb, or, given `deck`,
// cd-player-deck.glb) from the Blender scripts: Blender, in the background, writes
// art/.out/<name>.raw.glb (art/blender/scripts/export.py); gltf-transform then dedups, welds,
// prunes (keeping the empty pivots) and meshopt-compresses it. The Deck's build also writes its
// print layer's atlas layout, src/scene/textures/deck-atlas.json, which this formats with the
// repository's Prettier. Run by hand; the outputs are committed.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const BLENDER = process.env.BLENDER_BIN ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const MODEL = process.argv[2] ?? 'suitcase';
const NAMES = { suitcase: 'cd-player', clear: 'cd-player-clear', deck: 'cd-player-deck' };
if (!Object.hasOwn(NAMES, MODEL)) throw new Error(`build.mjs: unknown model ${MODEL}`);
const NAME = NAMES[MODEL];
const RAW = `${APP}art/.out/${NAME}.raw.glb`;
const OUT = `${APP}public/assets/${NAME}.glb`;

mkdirSync(`${APP}art/.out`, { recursive: true });
mkdirSync(`${APP}public/assets`, { recursive: true });

// --python-exit-code: a Python error in export.py fails the build (Blender exits 0 by default).
const blender = spawnSync(
  BLENDER,
  [
    '--background',
    '--factory-startup',
    '--python-exit-code',
    '1',
    '--python',
    `${APP}art/blender/scripts/export.py`,
    '--',
    '--out',
    RAW,
  ],
  { stdio: 'inherit', env: { ...process.env, CDP_MODEL: MODEL } },
);
if (blender.status !== 0) {
  console.error(`art:build: Blender exited with ${blender.status}`);
  process.exit(1);
}

if (MODEL === 'deck') {
  // Blender writes the layout as plain JSON; the repository's Prettier gives it its committed form.
  const { format, resolveConfig } = await import('prettier');
  const atlas = `${APP}src/scene/textures/deck-atlas.json`;
  const options = (await resolveConfig(atlas)) ?? {};
  writeFileSync(atlas, await format(readFileSync(atlas, 'utf8'), { ...options, filepath: atlas }));
  console.log(`art:build: ${atlas}`);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(RAW);
// Materials are never merged: the five prints start identical, and the page paints each apart.
// keepAttributes: the GLB has no textures, so prune would otherwise drop the UVs the page paints on.
await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  weld(),
  prune({ keepLeaves: true, keepAttributes: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(OUT, doc);
console.log(`art:build: ${OUT} ${(statSync(OUT).size / 1024).toFixed(0)} KB`);

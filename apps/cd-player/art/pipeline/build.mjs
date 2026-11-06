// Builds public/assets/cd-player.glb (or, given `clear`, cd-player-clear.glb) from the Blender
// scripts: Blender, in the background, writes art/.out/<name>.raw.glb (art/blender/scripts/export.py); gltf-transform then dedups, welds,
// prunes (keeping the empty pivots) and meshopt-compresses it. Run by hand; the output is committed.
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const BLENDER = process.env.BLENDER_BIN ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const MODEL = process.argv[2] ?? 'suitcase';
if (!['suitcase', 'clear'].includes(MODEL)) throw new Error(`build.mjs: unknown model ${MODEL}`);
const NAME = MODEL === 'suitcase' ? 'cd-player' : 'cd-player-clear';
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

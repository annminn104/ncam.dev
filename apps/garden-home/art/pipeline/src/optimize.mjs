import { Mode, toktx } from '@gltf-transform/cli';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

export const TIERS = ['high', 'medium'];
export const TEXTURE_MAX = { hero: 2048, prop: 1024 };

/** Max texture edge for a module role and quality tier. */
export function textureSizeFor(role, tier) {
  const max = TEXTURE_MAX[role];
  if (!max) throw new Error(`unknown role: ${role}`);
  return tier === 'high' ? max : max / 2;
}

let ioPromise = null;

/** NodeIO with every extension plus meshopt encoder/decoder registered (shared). */
export function createIO() {
  ioPromise ??= Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]).then(() =>
    new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    }),
  );
  return ioPromise;
}

export async function optimizeModule({ input, output, role, tier }) {
  const io = await createIO();
  const doc = await io.read(input);
  const size = textureSizeFor(role, tier);
  const resize = [size, size]; // fit within, never upscale
  await doc.transform(
    dedup(),
    // keepLeaves: HS_* empties are leaf nodes; keepAttributes: COLOR_0 (wind) is unused by materials.
    prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }),
    resample(),
    toktx({ mode: Mode.UASTC, slots: /^normalTexture$/, resize, encoder: sharp }),
    toktx({ mode: Mode.ETC1S, resize, encoder: sharp }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(output, doc);
}

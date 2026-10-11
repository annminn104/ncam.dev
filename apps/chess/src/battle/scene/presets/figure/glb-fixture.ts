// Test helper, imported by no app code: writes small figure GLBs the way
// scripts/build-figures.mjs does, for the reader's and the loader's tests.
import { Document, Logger, NodeIO, type TypedArray } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { LINE_MAX } from './slots';

/**
 * Two triangles: a flat one with an outline, and one with none whose first two corners sit on
 * the flat one's last two, as Blender exports a sharp crease (same position, different normal).
 */
export const FIXTURE = {
  position: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1],
  normal: [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0.57735, 0.57735, -0.57735, 0.57735, 0.57735, -0.57735, 0.57735,
    0.57735, -0.57735,
  ],
  slot: [3, 3, 3, 5, 5, 5],
  line: [0.0042, 0.0042, 0.0042, 0, 0, 0],
  index: [0, 1, 2, 3, 4, 5],
};

export interface FixtureOptions {
  /** Reordered, quantized and meshopt-compressed, as the shipped files are. */
  packed?: boolean;
  /** Leave this attribute out. */
  without?: string;
  /** _SLOT as floats, as Blender exports it. */
  floatSlots?: boolean;
  /** A second primitive in the mesh. */
  twoPrimitives?: boolean;
  /** The primitive's mode (4: triangles). */
  mode?: number;
}

export async function figureGlb(options: FixtureOptions = {}): Promise<ArrayBuffer> {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.ERROR));
  const buffer = doc.createBuffer();
  const accessor = (type: 'SCALAR' | 'VEC3', array: TypedArray) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const widths = Uint8Array.from(FIXTURE.line, (w) => Math.round((w / LINE_MAX) * 255));
  const slots = options.floatSlots ? new Float32Array(FIXTURE.slot) : new Uint8Array(FIXTURE.slot);
  const prim = doc
    .createPrimitive()
    .setMode((options.mode ?? 4) as 4)
    .setIndices(accessor('SCALAR', new Uint16Array(FIXTURE.index)))
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(FIXTURE.position)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(FIXTURE.normal)))
    .setAttribute('_SLOT', accessor('SCALAR', slots))
    .setAttribute('_LINE', accessor('SCALAR', widths).setNormalized(true));
  if (options.without) prim.setAttribute(options.without, null);
  const mesh = doc.createMesh('fixture').addPrimitive(prim);
  if (options.twoPrimitives) mesh.addPrimitive(prim.clone());
  doc.createScene().addChild(doc.createNode('fixture').setMesh(mesh));
  if (options.packed) {
    await MeshoptEncoder.ready;
    await doc.transform(
      reorder({ encoder: MeshoptEncoder }),
      quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 8 }),
    );
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  }
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  return (await io.writeBinary(doc)).slice().buffer;
}

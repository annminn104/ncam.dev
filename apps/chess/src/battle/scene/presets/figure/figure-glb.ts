import { LINE_MAX } from './slots';

// Reads the figure GLBs scripts/build-figures.mjs writes, and nothing else: one mesh with one
// triangle primitive carrying POSITION, NORMAL, _SLOT (unsigned bytes) and _LINE (normalized
// unsigned bytes, width / LINE_MAX), its buffer views meshopt-compressed (EXT_meshopt_compression)
// or plain, its positions quantized (KHR_mesh_quantization) and dequantized by its node's
// translation and uniform scale. No three: the Node tests read the shipped files with it too.

/** What the reader needs of three's MeshoptDecoder (three/examples/jsm/libs/meshopt_decoder.module.js). */
export interface MeshoptDecoderLike {
  decodeGltfBuffer(
    target: Uint8Array,
    count: number,
    size: number,
    source: Uint8Array,
    mode: string,
    filter?: string,
  ): void;
}

/** A figure ready for a BufferGeometry: one entry per vertex in every array but `index`. */
export interface FigureData {
  position: Float32Array;
  normal: Float32Array;
  /** The palette slot, an index into SLOTS, as a float for the shader. */
  slot: Float32Array;
  /** The outline width in figure units; 0 draws no outline. */
  line: Float32Array;
  /** The normalized sum of the normals of every vertex at this vertex's position. */
  outlineNormal: Float32Array;
  index: Uint16Array | Uint32Array;
}

interface Accessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
}

interface BufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  extensions?: {
    EXT_meshopt_compression?: {
      buffer: number;
      byteOffset?: number;
      byteLength: number;
      byteStride: number;
      count: number;
      mode: string;
      filter?: string;
    };
  };
}

interface Gltf {
  extensionsRequired?: string[];
  buffers?: { uri?: string }[];
  bufferViews?: BufferView[];
  accessors?: Accessor[];
  meshes?: {
    primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[];
  }[];
  nodes?: {
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
}

const MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const ATTRIBUTES = ['NORMAL', 'POSITION', '_LINE', '_SLOT'];
const EXTENSIONS = new Set(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
// Bytes per component, and what a normalized component is divided by.
const COMPONENT: Record<number, { size: number; max: number }> = {
  5120: { size: 1, max: 127 },
  5121: { size: 1, max: 255 },
  5122: { size: 2, max: 32767 },
  5123: { size: 2, max: 65535 },
  5125: { size: 4, max: 4294967295 },
  5126: { size: 4, max: 1 },
};
const UNSIGNED_BYTE = 5121;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;

function fail(why: string): never {
  throw new Error(`figure GLB: ${why}`);
}

/** What a thrown value says, to carry into the message of the error that names it. */
function reason(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function chunks(bytes: ArrayBuffer): { gltf: Gltf; bin: Uint8Array } {
  const view = new DataView(bytes);
  if (view.byteLength < 12 || view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 2) {
    fail('not a GLB 2.0 file');
  }
  let gltf: Gltf | undefined;
  let bin: Uint8Array | undefined;
  for (let at = 12; at + 8 <= view.byteLength;) {
    const length = view.getUint32(at, true);
    const type = view.getUint32(at + 4, true);
    if (at + 8 + length > view.byteLength) {
      const left = view.byteLength - at - 8;
      fail(
        `the file is truncated: the chunk at byte ${at} declares ${length} bytes, ${left} remain`,
      );
    }
    const body = new Uint8Array(bytes, at + 8, length);
    if (type === JSON_CHUNK) {
      try {
        gltf = JSON.parse(new TextDecoder().decode(body)) as Gltf;
      } catch (cause) {
        fail(`the JSON chunk is not valid JSON: ${reason(cause)}`);
      }
    } else if (type === BIN_CHUNK) bin = body;
    at += 8 + length;
  }
  if (!gltf || !bin) fail('no JSON or no BIN chunk');
  return { gltf, bin };
}

function accessor(gltf: Gltf, index: number): Accessor {
  return gltf.accessors?.[index] ?? fail(`no accessor ${index}`);
}

/** A buffer view's bytes, decompressed when meshopt compressed them, and its stride. */
function viewBytes(
  gltf: Gltf,
  bin: Uint8Array,
  index: number,
  decoder: MeshoptDecoderLike,
): { bytes: DataView; stride?: number } {
  const view = gltf.bufferViews?.[index] ?? fail(`no buffer view ${index}`);
  const packed = view.extensions?.EXT_meshopt_compression;
  let bytes: Uint8Array;
  if (packed) {
    if (packed.buffer !== 0 || gltf.buffers?.[0]?.uri !== undefined) {
      fail('meshopt data outside the BIN chunk');
    }
    const from = packed.byteOffset ?? 0;
    try {
      bytes = new Uint8Array(packed.count * packed.byteStride);
      decoder.decodeGltfBuffer(
        bytes,
        packed.count,
        packed.byteStride,
        bin.subarray(from, from + packed.byteLength),
        packed.mode,
        packed.filter,
      );
    } catch (cause) {
      fail(`buffer view ${index} does not decode: ${reason(cause)}`);
    }
  } else {
    if (view.buffer !== 0 || gltf.buffers?.[0]?.uri !== undefined) {
      fail(`buffer view ${index} outside the BIN chunk`);
    }
    const from = view.byteOffset ?? 0;
    bytes = bin.subarray(from, from + view.byteLength);
  }
  return {
    bytes: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    stride: view.byteStride,
  };
}

function component(data: DataView, at: number, type: number): number {
  switch (type) {
    case 5120:
      return data.getInt8(at);
    case 5121:
      return data.getUint8(at);
    case 5122:
      return data.getInt16(at, true);
    case 5123:
      return data.getUint16(at, true);
    case 5125:
      return data.getUint32(at, true);
    default:
      return data.getFloat32(at, true);
  }
}

/** An accessor's values as floats; normalized ones come back in [-1, 1] or [0, 1]. */
function floats(
  gltf: Gltf,
  bin: Uint8Array,
  index: number,
  width: number,
  decoder: MeshoptDecoderLike,
): Float32Array {
  const acc = accessor(gltf, index);
  const comp =
    COMPONENT[acc.componentType] ?? fail(`accessor ${index}: component type ${acc.componentType}`);
  if (WIDTH[acc.type] !== width) fail(`accessor ${index} is ${acc.type}`);
  if (acc.bufferView === undefined) fail(`accessor ${index} has no buffer view`);
  const { bytes, stride = width * comp.size } = viewBytes(gltf, bin, acc.bufferView, decoder);
  const base = acc.byteOffset ?? 0;
  const out = new Float32Array(acc.count * width);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < width; c++) {
      const v = component(bytes, base + i * stride + c * comp.size, acc.componentType);
      out[i * width + c] = acc.normalized ? Math.max(v / comp.max, -1) : v;
    }
  }
  return out;
}

function indices(
  gltf: Gltf,
  bin: Uint8Array,
  index: number,
  vertices: number,
  decoder: MeshoptDecoderLike,
): Uint16Array | Uint32Array {
  const acc = accessor(gltf, index);
  const wide = acc.componentType === UNSIGNED_INT;
  if (acc.type !== 'SCALAR' || (!wide && acc.componentType !== UNSIGNED_SHORT)) {
    fail('indices are not 16 or 32-bit');
  }
  if (acc.bufferView === undefined || acc.count % 3 !== 0) fail('bad index accessor');
  const { bytes } = viewBytes(gltf, bin, acc.bufferView, decoder);
  const base = acc.byteOffset ?? 0;
  const out = wide ? new Uint32Array(acc.count) : new Uint16Array(acc.count);
  for (let i = 0; i < acc.count; i++) {
    out[i] = wide ? bytes.getUint32(base + i * 4, true) : bytes.getUint16(base + i * 2, true);
    if (out[i] >= vertices) fail(`index ${out[i]} past the last vertex`);
  }
  return out;
}

/** The translation and uniform scale that undo the positions' quantization. */
function dequantization(gltf: Gltf): { t: number[]; s: number } {
  const nodes = gltf.nodes ?? [];
  const at = nodes.findIndex((n) => n.mesh === 0);
  if (at < 0 || nodes.filter((n) => n.mesh !== undefined).length !== 1) {
    fail('expected one mesh node');
  }
  if (nodes.some((n) => n.children?.includes(at))) fail('the mesh node has a parent');
  const node = nodes[at];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  if (node.matrix || x !== 0 || y !== 0 || z !== 0 || w !== 1) fail('the mesh node is rotated');
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  if (sx !== sy || sx !== sz) fail('the mesh node scale is not uniform');
  return { t: node.translation ?? [0, 0, 0], s: sx };
}

/** Per vertex, the normalized sum of the normals of every vertex at the same position. */
export function outlineNormals(position: Float32Array, normal: Float32Array): Float32Array {
  const bits = new Uint32Array(position.buffer, position.byteOffset, position.length);
  const sums = new Map<string, [number, number, number]>();
  const keys: string[] = [];
  for (let i = 0; i < position.length; i += 3) {
    const key = `${bits[i]},${bits[i + 1]},${bits[i + 2]}`;
    keys.push(key);
    const sum = sums.get(key) ?? [0, 0, 0];
    sum[0] += normal[i];
    sum[1] += normal[i + 1];
    sum[2] += normal[i + 2];
    sums.set(key, sum);
  }
  const out = new Float32Array(position.length);
  keys.forEach((key, v) => {
    const [x, y, z] = sums.get(key)!;
    const length = Math.hypot(x, y, z);
    const i = v * 3;
    // Normals that cancel out (a sheet folded flat onto itself) keep the vertex's own.
    const k = length > 1e-6 ? 1 / length : 0;
    out[i] = k ? x * k : normal[i];
    out[i + 1] = k ? y * k : normal[i + 1];
    out[i + 2] = k ? z * k : normal[i + 2];
  });
  return out;
}

export function parseFigureGlb(bytes: ArrayBuffer, decoder: MeshoptDecoderLike): FigureData {
  const { gltf, bin } = chunks(bytes);
  for (const name of gltf.extensionsRequired ?? []) {
    if (!EXTENSIONS.has(name)) fail(`requires ${name}`);
  }
  const meshes = gltf.meshes ?? [];
  if (meshes.length !== 1 || meshes[0].primitives.length !== 1) {
    fail('expected one mesh with one primitive');
  }
  const prim = meshes[0].primitives[0];
  if ((prim.mode ?? 4) !== 4) fail('the primitive is not triangles');
  const names = Object.keys(prim.attributes).sort();
  if (names.join() !== ATTRIBUTES.join()) fail(`attributes are ${names.join(', ')}`);
  if (prim.indices === undefined) fail('the primitive has no indices');
  for (const name of ['_SLOT', '_LINE']) {
    const acc = accessor(gltf, prim.attributes[name]);
    if (acc.componentType !== UNSIGNED_BYTE || (acc.normalized ?? false) !== (name === '_LINE')) {
      fail(`${name} is not stored as ${name === '_LINE' ? 'normalized ' : ''}unsigned bytes`);
    }
  }

  const position = floats(gltf, bin, prim.attributes.POSITION, 3, decoder);
  const count = position.length / 3;
  const { t, s } = dequantization(gltf);
  for (let i = 0; i < position.length; i += 3) {
    position[i] = position[i] * s + t[0];
    position[i + 1] = position[i + 1] * s + t[1];
    position[i + 2] = position[i + 2] * s + t[2];
  }
  const normal = floats(gltf, bin, prim.attributes.NORMAL, 3, decoder);
  for (let i = 0; i < normal.length; i += 3) {
    const k = 1 / (Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1);
    normal[i] *= k;
    normal[i + 1] *= k;
    normal[i + 2] *= k;
  }
  const slot = floats(gltf, bin, prim.attributes._SLOT, 1, decoder);
  const line = floats(gltf, bin, prim.attributes._LINE, 1, decoder).map((v) => v * LINE_MAX);
  if (normal.length !== position.length || slot.length !== count || line.length !== count) {
    fail('attribute counts differ');
  }
  return {
    position,
    normal,
    slot,
    line,
    outlineNormal: outlineNormals(position, normal),
    index: indices(gltf, bin, prim.indices, count, decoder),
  };
}

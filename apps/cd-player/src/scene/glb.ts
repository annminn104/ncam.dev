/** Just enough of glTF 2.0 for the model contract test. */
export interface GltfJson {
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices?: number;
      material?: number;
      mode?: number;
    }[];
  }[];
  accessors: { count: number }[];
  materials: { name?: string }[];
  extensionsUsed?: string[];
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/** The JSON chunk of a binary glTF: a 12-byte header, then the first chunk's length, type and data. */
export function readGlbJson(buffer: Uint8Array): GltfJson {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new Error('not a GLB');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK)
    throw new Error('the GLB does not start with its JSON');
  return JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + length))) as GltfJson;
}

/** Triangles drawn: every node with a mesh, every triangle-list primitive. */
export function triangleCount(json: GltfJson): number {
  let total = 0;
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    for (const primitive of json.meshes[node.mesh].primitives) {
      if ((primitive.mode ?? 4) !== 4) continue;
      const accessor = primitive.indices ?? primitive.attributes.POSITION;
      total += json.accessors[accessor].count / 3;
    }
  }
  return total;
}

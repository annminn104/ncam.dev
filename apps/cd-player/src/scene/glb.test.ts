import { describe, expect, it } from 'vitest';
import { readGlbJson, triangleCount, type GltfJson } from './glb';

function glb(json: object): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  padded.set(text);
  const out = new Uint8Array(20 + padded.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(padded, 20);
  return out;
}

describe('glb', () => {
  const json: GltfJson = {
    nodes: [
      { name: 'root', children: [1, 2] },
      { name: 'a', mesh: 0 },
      { name: 'b', mesh: 0 },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ count: 8 }, { count: 36 }],
    materials: [{ name: 'deck' }],
  };

  it('reads the JSON chunk', () => {
    expect(readGlbJson(glb(json)).nodes[1].name).toBe('a');
    expect(() => readGlbJson(new Uint8Array(24))).toThrow(/GLB/);
  });

  it('counts the triangles of every node that draws a mesh', () => {
    expect(triangleCount(json)).toBe(24);
  });
});

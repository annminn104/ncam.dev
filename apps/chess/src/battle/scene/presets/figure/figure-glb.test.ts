import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { outlineNormals, parseFigureGlb, type FigureData } from './figure-glb';
import { FIXTURE, figureGlb, type FixtureOptions } from './glb-fixture';

beforeAll(async () => {
  await MeshoptDecoder.ready;
});

const read = async (options?: FixtureOptions) =>
  parseFigureGlb(await figureGlb(options), MeshoptDecoder);

/**
 * Every triangle corner as text (position to the millimetre, slot, width to 0.1 mm), sorted: the
 * order a packer gave the vertices does not matter.
 */
function corners(f: Pick<FigureData, 'position' | 'slot' | 'line' | 'index'>): string[] {
  const mm = (v: number) => (Math.round(v * 1000) / 1000 + 0).toFixed(3);
  return Array.from(f.index, (v) => {
    const [x, y, z] = [f.position[v * 3], f.position[v * 3 + 1], f.position[v * 3 + 2]];
    return `${mm(x)},${mm(y)},${mm(z)} ${f.slot[v]} ${(f.line[v] * 1e4).toFixed(0)}`;
  }).sort();
}

const EXPECTED = corners({
  position: new Float32Array(FIXTURE.position),
  slot: new Float32Array(FIXTURE.slot),
  line: new Float32Array(FIXTURE.line),
  index: new Uint16Array(FIXTURE.index),
});

describe('parseFigureGlb', () => {
  it('reads a plain figure exactly', async () => {
    const f = await read();
    expect(Array.from(f.position)).toEqual(FIXTURE.position);
    expect(Array.from(f.slot)).toEqual(FIXTURE.slot);
    expect(Array.from(f.index)).toEqual(FIXTURE.index);
    // A width rides in a byte: within 1/255 of LINE_MAX.
    expect(f.line[0]).toBeCloseTo(0.0042, 4);
    expect(f.line[3]).toBe(0);
  });

  it('reads a packed figure: reordered, quantized and meshopt-compressed', async () => {
    const f = await read({ packed: true });
    expect(f.index).toHaveLength(6);
    expect(corners(f)).toEqual(EXPECTED);
  });

  it('gives the vertices on a crease one outline normal, between their faces', async () => {
    const f = await read();
    const at = (v: number) => Array.from(f.outlineNormal.slice(v * 3, v * 3 + 3));
    // Vertices 1 and 3 share a position, as do 2 and 4: the crease between the two triangles.
    expect(at(1)).toEqual(at(3));
    expect(at(2)).toEqual(at(4));
    expect(Math.hypot(...at(1))).toBeCloseTo(1, 6);
    expect(at(1)[2]).toBeGreaterThan(0); // tilted between (0,0,1) and the other face's normal
    expect(at(0)).toEqual([0, 0, 1]); // alone at its position: its own normal
  });

  it('turns away what the pack step never writes', async () => {
    await expect(read({ without: '_LINE' })).rejects.toThrow(
      /attributes are NORMAL, POSITION, _SLOT/,
    );
    await expect(read({ twoPrimitives: true })).rejects.toThrow(/one mesh with one primitive/);
    await expect(read({ mode: 0 })).rejects.toThrow(/not triangles/);
    await expect(read({ floatSlots: true })).rejects.toThrow(
      /_SLOT is not stored as unsigned bytes/,
    );
  });

  it('refuses a file that is not a GLB', () => {
    expect(() => parseFigureGlb(new ArrayBuffer(16), MeshoptDecoder)).toThrow(/not a GLB 2.0 file/);
  });
});

describe('outlineNormals', () => {
  it('keeps a vertex its own normal where the normals at a point cancel out', () => {
    const position = new Float32Array([0, 0, 0, 0, 0, 0]);
    const normal = new Float32Array([0, 0, 1, 0, 0, -1]);
    expect(Array.from(outlineNormals(position, normal))).toEqual([0, 0, 1, 0, 0, -1]);
  });
});

import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { outlineNormals, parseFigureGlb, type FigureData } from './figure-glb';
import { FIXTURE, figureGlb, type FixtureOptions } from './glb-fixture';

beforeAll(async () => {
  await MeshoptDecoder.ready;
});

const read = async (options?: FixtureOptions) =>
  parseFigureGlb(await figureGlb(options), MeshoptDecoder);

/** `bytes` parsed once called, for `expect(...).toThrow`. */
const parsing = (bytes: ArrayBuffer) => () => parseFigureGlb(bytes, MeshoptDecoder);

/** The parts of a GLB's JSON the tests below edit. */
interface Editable {
  accessors: { count: number }[];
  bufferViews: {
    byteLength: number;
    byteStride?: number;
    extensions?: { EXT_meshopt_compression?: { byteLength: number } };
  }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
}

/**
 * `bytes` with its JSON chunk rewritten by `edit`: padded with spaces to a multiple of four, the
 * file's length and the chunk's set to match. The BIN chunk stays as it was.
 */
function withJson(bytes: ArrayBuffer, edit: (gltf: Editable) => void): ArrayBuffer {
  const jsonLength = new DataView(bytes).getUint32(12, true);
  const text = new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength));
  const gltf = JSON.parse(text) as Editable;
  edit(gltf);
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const padded = new Uint8Array(Math.ceil(json.length / 4) * 4).fill(0x20);
  padded.set(json);
  const bin = new Uint8Array(bytes, 20 + jsonLength); // the BIN chunk, its header included
  const out = new Uint8Array(20 + padded.length + bin.length);
  out.set(new Uint8Array(bytes, 0, 20)); // the file header and the JSON chunk's header
  out.set(padded, 20);
  out.set(bin, 20 + padded.length);
  const view = new DataView(out.buffer);
  view.setUint32(8, out.length, true);
  view.setUint32(12, padded.length, true);
  return out.buffer;
}

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

  // Whatever is wrong with a file, the error says `figure GLB: …` and why, not what threw under it.
  it('names a file that is cut short', async () => {
    const bytes = await figureGlb({ packed: true });
    // Inside the JSON chunk, then inside the BIN chunk (its data are the file's last bytes).
    expect(parsing(bytes.slice(0, 60))).toThrow(/^figure GLB: the file is truncated/);
    expect(parsing(bytes.slice(0, bytes.byteLength - 40))).toThrow(
      /^figure GLB: the file is truncated/,
    );
  });

  it('names a JSON chunk that is not JSON', async () => {
    const bytes = await figureGlb({ packed: true });
    new Uint8Array(bytes, 20, 4).fill(0x7b); // '{{{{', where the JSON chunk's body begins
    expect(parsing(bytes)).toThrow(/^figure GLB: the JSON chunk is not valid JSON: /);
  });

  it('names compressed data the decoder refuses', async () => {
    const bytes = await figureGlb({ packed: true });
    // Blank the BIN chunk's body: it follows the file header, the JSON chunk and its own header.
    const jsonLength = new DataView(bytes).getUint32(12, true);
    new Uint8Array(bytes, 12 + 8 + jsonLength + 8).fill(0);
    expect(parsing(bytes)).toThrow(
      /^figure GLB: buffer view \d+ does not decode: Malformed buffer data/,
    );
  });

  it.each([false, true])(
    'names a buffer view that runs past the BIN chunk (packed: %s)',
    async (packed) => {
      const bytes = withJson(await figureGlb({ packed }), (gltf) => {
        for (const view of gltf.bufferViews) {
          (view.extensions?.EXT_meshopt_compression ?? view).byteLength += 1000;
        }
      });
      expect(parsing(bytes)).toThrow(/^figure GLB: buffer view \d+ runs past the BIN chunk/);
    },
  );

  it.each([
    [false, 'a position accessor'],
    [true, 'a position accessor'],
    [false, 'the index accessor'],
    [true, 'the index accessor'],
  ])('names an accessor that runs past its buffer view (packed: %s, %s)', async (packed, which) => {
    const bytes = withJson(await figureGlb({ packed }), (gltf) => {
      const prim = gltf.meshes[0].primitives[0];
      const at = which === 'the index accessor' ? prim.indices : prim.attributes.POSITION;
      gltf.accessors[at].count += 3; // three more than its view holds (a triangle, for indices)
    });
    expect(parsing(bytes)).toThrow(/^figure GLB: accessor \d+ runs past its buffer view/);
  });

  it('takes the stride of a packed view from its extension when the view gives none', async () => {
    const packed = await figureGlb({ packed: true });
    let stripped = 0;
    const strideless = withJson(packed, (gltf) => {
      for (const view of gltf.bufferViews) {
        if (view.byteStride !== undefined) stripped += 1;
        delete view.byteStride;
      }
    });
    expect(stripped).toBeGreaterThan(0); // the fixture does give its attribute views a stride
    expect(parseFigureGlb(strideless, MeshoptDecoder)).toEqual(
      parseFigureGlb(packed, MeshoptDecoder),
    );
  });
});

describe('outlineNormals', () => {
  it('keeps a vertex its own normal where the normals at a point cancel out', () => {
    const position = new Float32Array([0, 0, 0, 0, 0, 0]);
    const normal = new Float32Array([0, 0, 1, 0, 0, -1]);
    expect(Array.from(outlineNormals(position, normal))).toEqual([0, 0, 1, 0, 0, -1]);
  });
});

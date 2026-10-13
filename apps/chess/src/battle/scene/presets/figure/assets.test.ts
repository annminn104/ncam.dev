import { readFileSync, statSync } from 'node:fs';
import type { PieceSymbol } from 'chess.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { PRESETS, presetMeta, type PresetId } from '../../../../presets-meta';
import { BASE_TOP } from '../../pieces/kits';
import { parseFigureGlb, type FigureData } from './figure-glb';
import { LINE_MAX, SLOTS } from './slots';

// The shipped figure files (public/presets/<preset>/), held to art/budgets.json: what
// scripts/build-figures.mjs promised is what the battle gets.

const APP = new URL('../../../../../', import.meta.url);
type Lod = 'high' | 'low';
interface Budget {
  ladder: string;
  triangles: Record<PieceSymbol, [high: number, low: number]>;
  bytes: Record<Lod, number>;
}
const BUDGETS = JSON.parse(readFileSync(new URL('art/budgets.json', APP), 'utf8')) as Record<
  string,
  Budget
>;
const TYPES: PieceSymbol[] = ['k', 'q', 'b', 'r', 'n', 'p'];
const LODS: Lod[] = ['high', 'low'];

/** A shipped file's name under public/presets/. */
const name = (preset: string, type: PieceSymbol, lod: Lod) =>
  `${preset}/${type}${lod === 'low' ? '-low' : ''}.glb`;
const file = (preset: string, type: PieceSymbol, lod: Lod) =>
  new URL(`public/presets/${name(preset, type, lod)}`, APP);
const figures = new Map<string, FigureData>();
const figure = (preset: string, type: PieceSymbol, lod: Lod) =>
  figures.get(`${preset}/${type}/${lod}`)!;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  for (const preset of Object.keys(BUDGETS)) {
    for (const type of TYPES) {
      for (const lod of LODS) {
        const bytes = Uint8Array.from(readFileSync(file(preset, type, lod))).buffer;
        figures.set(`${preset}/${type}/${lod}`, parseFigureGlb(bytes, MeshoptDecoder));
      }
    }
  }
});

it('covers every figure preset the lobby offers', () => {
  for (const p of PRESETS.filter((x) => x.kind === 'figure' && x.ready)) {
    expect(Object.keys(BUDGETS), p.id).toContain(p.id);
  }
});

/** Top, lowest point and widest reach from the square's centre, in board units. */
function measure(position: Float32Array) {
  let top = -Infinity;
  let bottom = Infinity;
  let reach = 0;
  for (let i = 0; i < position.length; i += 3) {
    top = Math.max(top, position[i + 1]);
    bottom = Math.min(bottom, position[i + 1]);
    reach = Math.max(reach, Math.hypot(position[i], position[i + 2]));
  }
  return { top, bottom, reach };
}

/**
 * How many triangles have corners that differ in slot or in outline width. The paint reads the
 * slot interpolated across a triangle, so a mixed one blends two palette entries; the outline
 * sends a vertex with no width outside the clip volume (material.ts), so a triangle mixing it
 * with outlined corners stretches its hull to the clip, a sliver across the screen.
 */
function mixedTriangles({ index, slot, line }: Pick<FigureData, 'index' | 'slot' | 'line'>) {
  let mixed = 0;
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
    if (slot[a] !== slot[b] || slot[a] !== slot[c] || line[a] !== line[b] || line[a] !== line[c]) {
      mixed += 1;
    }
  }
  return mixed;
}

describe.each(Object.keys(BUDGETS))('%s figures', (preset) => {
  const budget = BUDGETS[preset];

  it('belong to a figure preset with a full ladder', () => {
    expect(presetMeta(preset as PresetId).kind).toBe('figure');
    expect([...budget.ladder].sort()).toEqual([...TYPES].sort());
  });

  it.each(LODS)('keep the %s files within their triangle budgets', (lod) => {
    for (const type of TYPES) {
      const cap = budget.triangles[type][lod === 'high' ? 0 : 1];
      expect(figure(preset, type, lod).index.length / 3, type).toBeLessThanOrEqual(cap);
    }
  });

  it.each(LODS)('carry only palette slots and outline widths (%s)', (lod) => {
    for (const type of TYPES) {
      const f = figure(preset, type, lod);
      for (const s of new Set(f.slot)) {
        expect(Number.isInteger(s) && s >= 0 && s < SLOTS.length, `${type} slot ${s}`).toBe(true);
      }
      for (const w of new Set(f.line)) {
        expect(w >= 0 && w <= LINE_MAX, `${type} width ${w}`).toBe(true);
      }
    }
  });

  it.each(LODS)('give every triangle one slot and one outline width (%s)', (lod) => {
    for (const type of TYPES) {
      expect(mixedTriangles(figure(preset, type, lod)), name(preset, type, lod)).toBe(0);
    }
  });

  it.each(LODS)('stand in their ladder, on their base, inside their square (%s)', (lod) => {
    const tops = [...budget.ladder].map((type) => {
      const { top, bottom, reach } = measure(figure(preset, type as PieceSymbol, lod).position);
      expect(bottom, `${type} bottom`).toBeGreaterThanOrEqual(BASE_TOP - 0.01);
      expect(reach, `${type} reach`).toBeLessThanOrEqual(0.45);
      return top;
    });
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1], budget.ladder.slice(i - 1, i + 1)).toBeGreaterThanOrEqual(0.04);
    }
  });

  it.each(LODS)('weigh what the %s set may', (lod) => {
    const bytes = TYPES.reduce((sum, type) => sum + statSync(file(preset, type, lod)).size, 0);
    expect(bytes).toBeLessThanOrEqual(budget.bytes[lod]);
  });
});

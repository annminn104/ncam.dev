import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK_LOOK, deckSwatch, type DeckLook } from '../../deck-looks';
import { PATTERN_STYLES, type PatternStyle } from '../../personal';
import { DECK_ATLAS, pxPerMm, type AtlasRegion, type Ground } from './deck-atlas';
import {
  ATLAS_DARK,
  ATLAS_LIGHT,
  collectionSeed,
  inksFor,
  paintDeckPattern,
  patternKey,
  STENCIL_ZONE,
  STICKER_WORDS,
  type PatternPrint,
} from './deck-pattern';
import { CAP } from './deck-pattern-core';
import { fnv1a } from './xorshift';

const BLACK_ICE: DeckLook = { body: 'black', light: 'ice' };
const WHITE_AMBER: DeckLook = { body: 'white', light: 'amber' };

/** A print of the Deck in `look`, for the name "DJ Lan" and the default collection. */
function printOf(
  over: Partial<PatternPrint> = {},
  look: DeckLook = DEFAULT_DECK_LOOK,
): PatternPrint {
  return {
    style: 'guilloche',
    seed: 1,
    light: deckSwatch(look, 'light'),
    body: deckSwatch(look, 'body'),
    name: 'DJ Lan',
    collection: 'Top 50 - Global',
    ...over,
  };
}

type Call = readonly unknown[];

/**
 * A canvas of the atlas's size whose 2D context draws nothing: it logs every call with its
 * arguments, and every property set as ['=', name, value], in order. It measures a character as
 * 0.6 of the size of the font it has at the time.
 */
function recorder() {
  const log: Call[] = [];
  let size = 10;
  const context = new Proxy(
    {},
    {
      get:
        (_target, key) =>
        (...args: unknown[]) => {
          log.push([String(key), ...args]);
          if (key === 'measureText') return { width: [...String(args[0])].length * size * 0.6 };
          return undefined;
        },
      set: (_target, key, value) => {
        if (key === 'font') size = Number(/([\d.]+)px/.exec(String(value))?.[1] ?? 10);
        log.push(['=', String(key), value]);
        return true;
      },
    },
  );
  const canvas = { width: DECK_ATLAS.width, height: DECK_ATLAS.height, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, log };
}

function paint(print: PatternPrint): Call[] {
  const { canvas, log } = recorder();
  paintDeckPattern(canvas, DECK_ATLAS, print);
  return log;
}

interface Block {
  readonly region: AtlasRegion | undefined;
  readonly calls: readonly Call[];
}

/** The region whose rect the block's path holds when it clips. */
function clippedTo(calls: readonly Call[]): AtlasRegion | undefined {
  const clip = calls.findIndex((call) => call[0] === 'clip');
  const rect = calls
    .slice(0, clip)
    .reverse()
    .find((call) => call[0] === 'rect');
  return DECK_ATLAS.regions.find(
    (r) => rect && r.x === rect[1] && r.y === rect[2] && r.w === rect[3] && r.h === rect[4],
  );
}

/** The log's top-level save … restore blocks, each named by the region it clips to. */
function blocks(log: readonly Call[]): Block[] {
  const found: Block[] = [];
  let depth = 0;
  let calls: Call[] = [];
  for (const call of log) {
    if (call[0] === 'save') {
      if (depth === 0) calls = [];
      depth += 1;
    }
    if (depth > 0) calls.push(call);
    if (call[0] === 'restore') {
      depth -= 1;
      if (depth === 0) found.push({ region: clippedTo(calls), calls });
    }
  }
  return found;
}

/** Every call made outside the top-level blocks. */
function outside(log: readonly Call[]): Call[] {
  let depth = 0;
  return log.filter((call) => {
    if (call[0] === 'save') depth += 1;
    const out = depth === 0;
    if (call[0] === 'restore') depth -= 1;
    return out;
  });
}

const blockOf = (log: readonly Call[], test: (region: AtlasRegion) => boolean) =>
  blocks(log).find((block) => block.region && test(block.region));

/** Each text drawn, with the state it was drawn in. */
function drawnTexts(calls: readonly Call[]) {
  const state: Record<string, unknown> = {};
  const drawn: { text: unknown; x: unknown; y: unknown; fill: unknown; font: string }[] = [];
  for (const call of calls) {
    if (call[0] === '=') state[String(call[1])] = call[2];
    if (call[0] === 'fillText' || call[0] === 'strokeText') {
      drawn.push({
        text: call[1],
        x: call[2],
        y: call[3],
        fill: state.fillStyle,
        font: String(state.font),
      });
    }
  }
  return drawn;
}

/** Each fillRect, with the compositing it was drawn with. */
function rects(calls: readonly Call[]) {
  let composite = 'source-over';
  const found: { args: number[]; composite: string }[] = [];
  for (const call of calls) {
    if (call[0] === '=' && call[1] === 'globalCompositeOperation') composite = String(call[2]);
    if (call[0] === 'fillRect') found.push({ args: call.slice(1) as number[], composite });
  }
  return found;
}

const texts = (calls: readonly Call[]) => drawnTexts(calls).map((drawn) => drawn.text);
/** The texts a region's pattern draws: on the stencil's region, those before its stencil. */
function patternTexts(region: AtlasRegion, calls: readonly Call[]): unknown[] {
  const all = texts(calls);
  return region.stencil ? all.slice(0, all.lastIndexOf('PROPERTY OF')) : all;
}
const sizeOf = (font: string) => Number(/([\d.]+)px/.exec(font)?.[1]);
const DRAWS = /^(fill|stroke)/;
const isWide = (region: AtlasRegion) => region.kind === 'plate' || region.kind === 'panel';
const STYLES: readonly (PatternStyle | null)[] = [...PATTERN_STYLES, null];

describe('paintDeckPattern', () => {
  it('Plain: clears the canvas, then prints the name on the nameplate and the stencil', () => {
    for (const [name, lines] of [
      ['ncam', ['NCAM']],
      ['DJ Lan', ['DJ LAN']],
      ['Anh Minh DJ NCAM', ['ANH MINH', 'DJ NCAM']],
    ] as const) {
      const log = paint(printOf({ style: null, name }));
      expect(log[0]).toEqual(['clearRect', 0, 0, DECK_ATLAS.width, DECK_ATLAS.height]);
      expect(log.filter((call) => call[0] === 'clearRect')).toHaveLength(1);
      for (const { region, calls } of blocks(log)) {
        if (region?.kind === 'nameplate') {
          expect(texts(calls)).toEqual(lines.flatMap((line) => [line, line]));
        } else if (region?.stencil) expect(texts(calls)).toEqual(['PROPERTY OF', ...lines]);
        else
          expect(
            calls.filter((call) => DRAWS.test(String(call[0]))),
            region?.id,
          ).toEqual([]);
      }
    }
  });

  it('engraves the nameplate: a light edge 1 px under the cut first, bold, inside 2 mm', () => {
    for (const name of ['DJ Lan', 'Sixteen letters!']) {
      const print = printOf({ style: null, name });
      const plate = blockOf(paint(print), (region) => region.kind === 'nameplate');
      const region = plate?.region as AtlasRegion;
      const [edge, cut] = drawnTexts(plate?.calls ?? []);
      expect(edge.fill).toBe(ATLAS_LIGHT);
      expect(cut.fill).toBe(inksFor('metal', print).line);
      expect(edge.x).toBe(cut.x);
      expect(Number(edge.y) - Number(cut.y)).toBeCloseTo(1 / pxPerMm(region), 9);
      for (const { text, font } of [edge, cut]) {
        expect(font.startsWith('700 ')).toBe(true);
        expect([...String(text)].length * sizeOf(font) * 0.6).toBeLessThanOrEqual(region.mmW - 4);
      }
    }
  });

  it('stencils the case: its top 40 % cut, PROPERTY OF and the name in light, cut across', () => {
    const stencil = blockOf(paint(printOf({ style: null })), (region) => !!region.stencil);
    const region = stencil?.region as AtlasRegion;
    const calls = stencil?.calls ?? [];
    const [room, ...after] = rects(calls);
    expect(room).toEqual({
      args: [0, 0, region.mmW, 0.4 * region.mmH],
      composite: 'destination-out',
    });
    const [property, name] = drawnTexts(calls);
    expect(property.text).toBe('PROPERTY OF');
    expect(property.font.startsWith('600 ')).toBe(true);
    expect(sizeOf(property.font)).toBeCloseTo(0.06 * region.mmH, 1);
    expect(name.text).toBe('DJ LAN');
    expect(name.font.startsWith('700 ')).toBe(true);
    expect(sizeOf(name.font)).toBeLessThanOrEqual(0.22 * region.mmH);
    expect(6 * sizeOf(name.font) * 0.6).toBeLessThanOrEqual(0.86 * region.mmW);
    expect([property.fill, name.fill]).toEqual([ATLAS_LIGHT, ATLAS_LIGHT]);
    expect(Number(name.y)).toBeGreaterThan(Number(property.y));
    expect(after).toHaveLength(1);
    expect(after[0].composite).toBe('destination-out');
    expect(after[0].args[3]).toBeCloseTo(0.8, 9);
    expect(after[0].args[1]).toBeLessThan(Number(name.y));
  });

  it('engraves a long name in two lines of one size, each edge and cut, inside 2 mm', () => {
    for (const [name, lines, marks] of [
      ['Anh Minh DJ NCAM', ['ANH MINH', 'DJ NCAM'], 0],
      ['Nguyễn Văn Ánh', ['NGUYỄN', 'VĂN ÁNH'], 0.42],
    ] as const) {
      const print = printOf({ style: null, name });
      const plate = blockOf(paint(print), (region) => region.kind === 'nameplate');
      const region = plate?.region as AtlasRegion;
      const drawn = drawnTexts(plate?.calls ?? []);
      expect(drawn.map((line) => line.text)).toEqual(lines.flatMap((line) => [line, line]));
      expect(new Set(drawn.map((line) => line.font)).size).toBe(1);
      const size = sizeOf(drawn[0].font);
      const [edge1, cut1, edge2, cut2] = drawn;
      for (const [edge, cut] of [
        [edge1, cut1],
        [edge2, cut2],
      ]) {
        expect(edge.fill).toBe(ATLAS_LIGHT);
        expect(cut.fill).toBe(inksFor('metal', print).line);
        expect(Number(edge.y) - Number(cut.y)).toBeCloseTo(1 / pxPerMm(region), 9);
        expect([...String(cut.text)].length * size * 0.6).toBeLessThanOrEqual(region.mmW - 4);
      }
      // The first line's marks clear the top margin, the second's its gap, the last line the foot.
      expect(Number(cut1.y) - (CAP + marks) * size, name).toBeGreaterThanOrEqual(2 - 1e-9);
      const gap = Number(cut2.y) - CAP * size - Number(cut1.y);
      expect(gap, name).toBeGreaterThanOrEqual(Math.max(0.18, marks) * size - 1e-9);
      expect(Number(cut2.y), name).toBeLessThanOrEqual(region.mmH - 2 + 1e-9);
    }
  });

  it('stencils each line between the handle’s brackets, above its grip, long names in two', () => {
    const [zx, zy, zw, zh] = STENCIL_ZONE;
    for (const [name, lines, marks] of [
      ['DJ Lan', ['DJ LAN'], 0],
      ['Lan Ánh', ['LAN ÁNH'], 0.42],
      ['Anh Minh DJ NCAM', ['ANH MINH', 'DJ NCAM'], 0],
      ['Nguyễn Văn Ánh', ['NGUYỄN', 'VĂN ÁNH'], 0.42],
    ] as const) {
      const stencil = blockOf(paint(printOf({ style: null, name })), (region) => !!region.stencil);
      const region = stencil?.region as AtlasRegion;
      const calls = stencil?.calls ?? [];
      const [property, ...named] = drawnTexts(calls);
      expect(named.map((line) => line.text)).toEqual(lines);
      expect(new Set(named.map((line) => line.font)).size).toBe(1);
      const size = sizeOf(named[0].font);
      expect(Number(property.y) - CAP * sizeOf(property.font), name).toBeGreaterThanOrEqual(zy);
      for (const line of [property, ...named]) {
        const half = ([...String(line.text)].length * sizeOf(line.font) * 0.6) / 2;
        expect(line.x).toBe(region.mmW / 2);
        expect(region.mmW / 2 - half, `${name}: ${line.text}`).toBeGreaterThanOrEqual(zx);
        expect(region.mmW / 2 + half, `${name}: ${line.text}`).toBeLessThanOrEqual(zx + zw);
      }
      expect(Number(named.at(-1)?.y), name).toBeLessThanOrEqual(zy + zh + 1e-9);
      if (named.length === 2) {
        const gap = Number(named[1].y) - CAP * size - Number(named[0].y);
        expect(gap, name).toBeGreaterThanOrEqual(Math.max(0.18, marks) * size - 1e-9);
      }
      // One bridge across each line, inside its capitals.
      const bridges = rects(calls).slice(1);
      expect(bridges, name).toHaveLength(lines.length);
      bridges.forEach(({ args, composite }, i) => {
        expect(composite).toBe('destination-out');
        expect(args[1]).toBeLessThan(Number(named[i].y));
        expect(args[1]).toBeGreaterThan(Number(named[i].y) - CAP * size);
      });
    }
  });

  it('makes the same calls for the same print, every time', () => {
    for (const style of PATTERN_STYLES) {
      const print = printOf({ style });
      expect(JSON.stringify(paint(print)) === JSON.stringify(paint(print)), style).toBe(true);
    }
  });

  it('makes other calls for another seed', () => {
    for (const style of PATTERN_STYLES) {
      const [one, two] = [1, 2].map((seed) => JSON.stringify(paint(printOf({ style, seed }))));
      expect(one === two, style).toBe(false);
    }
  });

  it('clips each region once, inside its own save and restore, and draws nothing outside', () => {
    for (const style of STYLES) {
      const log = paint(printOf({ style }));
      const found = blocks(log);
      expect(
        found.map((block) => block.region?.id),
        String(style),
      ).toEqual(DECK_ATLAS.regions.map((region) => region.id));
      for (const { calls } of found) {
        expect(calls.filter((call) => call[0] === 'clip')).toHaveLength(1);
        expect(calls[0][0]).toBe('save');
        expect(calls.at(-1)?.[0]).toBe('restore');
      }
      expect(outside(log)).toEqual([['clearRect', 0, 0, DECK_ATLAS.width, DECK_ATLAS.height]]);
    }
  });

  it('flips the rim and the bezel before their mm scale, and no other region', () => {
    for (const style of STYLES) {
      for (const { region, calls } of blocks(paint(printOf({ style })))) {
        if (!region) continue;
        const k = pxPerMm(region);
        const mm = calls.findIndex((call) => call[0] === 'scale' && call[1] === k && call[2] === k);
        const flip = calls.findIndex(
          (call) => call[0] === 'scale' && call[1] === 1 && call[2] === -1,
        );
        expect(calls.findIndex((call) => call[0] === 'translate')).toBeLessThan(mm);
        expect(calls.find((call) => call[0] === 'translate')).toEqual([
          'translate',
          region.x,
          region.y,
        ]);
        if (region.kind === 'ring' || region.kind === 'band') {
          expect(flip, region.id).toBeGreaterThan(-1);
          expect(flip, region.id).toBeLessThan(mm);
          expect(calls[flip - 1]).toEqual(['translate', 0, region.h]);
        } else {
          expect(flip, region.id).toBe(-1);
        }
      }
    }
  });

  it('prints in the five inks alone, at full alpha, with no gradient and no blur', () => {
    for (const look of [BLACK_ICE, WHITE_AMBER]) {
      for (const style of STYLES) {
        const print = printOf({ style }, look);
        const { glow, accent, onAccent } = print.light;
        const inks = [ATLAS_LIGHT, ATLAS_DARK, glow, accent, onAccent];
        for (const call of paint(print)) {
          const [op, name, value] = call;
          expect(String(op), String(style)).not.toMatch(/Gradient|Pattern/);
          if (op !== '=') continue;
          if (name === 'fillStyle' || name === 'strokeStyle') expect(inks).toContain(value);
          if (name === 'globalAlpha') expect(value).toBeGreaterThanOrEqual(1);
          if (name === 'shadowBlur') expect(value).toBe(0);
        }
      }
    }
  });

  it('draws no line thinner than 0.5 mm or 2 px, which the cut at half alpha would lose', () => {
    for (const style of STYLES) {
      for (const { region, calls } of blocks(paint(printOf({ style })))) {
        if (!region) continue;
        const least = Math.max(0.5, 2 / pxPerMm(region));
        for (const call of calls) {
          if (call[0] === '=' && call[1] === 'lineWidth') {
            expect(Number(call[2]), `${style} ${region.id}`).toBeGreaterThanOrEqual(least - 1e-9);
          }
        }
      }
    }
  });

  it('Sticker bomb: the collection and the name on the top and every panel, no words round', () => {
    for (const seed of [1, 2, 3]) {
      for (const { region, calls } of blocks(paint(printOf({ style: 'stickers', seed })))) {
        if (!region || region.kind === 'nameplate') continue;
        const words = patternTexts(region, calls);
        if (!isWide(region)) {
          expect(words, region.id).toEqual([]);
          continue;
        }
        expect(words, region.id).toContain('Top 50 - Global');
        expect(words, region.id).toContain('DJ LAN');
        for (const word of words) {
          expect(['Top 50 - Global', 'DJ LAN', ...STICKER_WORDS], region.id).toContain(word);
        }
      }
    }
  });

  it('Sticker bomb: a long name in two stickers of its own, on the top and every panel', () => {
    for (const seed of [1, 2, 3]) {
      const print = printOf({ style: 'stickers', seed, name: 'Anh Minh DJ NCAM' });
      for (const { region, calls } of blocks(paint(print))) {
        if (!region || !isWide(region)) continue;
        const words = patternTexts(region, calls);
        expect(words, region.id).toContain('ANH MINH');
        expect(words, region.id).toContain('DJ NCAM');
        expect(words, region.id).not.toContain('ANH MINH DJ NCAM');
        expect(words, region.id).toContain('Top 50 - Global');
      }
    }
  });

  it('Sticker bomb before a collection loads: the name, and no empty sticker', () => {
    const drawn = texts(paint(printOf({ style: 'stickers', collection: '' })));
    expect(drawn).toContain('DJ LAN');
    expect(drawn).not.toContain('');
  });

  it('Graffiti: tags the name in caps on the top and every panel, and writes nothing round', () => {
    for (const seed of [1, 2, 3]) {
      for (const { region, calls } of blocks(paint(printOf({ style: 'graffiti', seed })))) {
        if (!region || region.kind === 'nameplate') continue;
        const words = patternTexts(region, calls);
        if (isWide(region)) {
          expect(words, region.id).toContain('DJ LAN');
          for (const word of words) expect(word, region.id).toBe('DJ LAN');
        } else {
          expect(words, region.id).toEqual([]);
        }
      }
    }
  });
});

describe('inksFor', () => {
  const dark = (look: DeckLook) => {
    const print = printOf({}, look);
    return { line: ATLAS_LIGHT, accent: print.light.glow };
  };
  const light = (look: DeckLook) => {
    const print = printOf({}, look);
    return { line: ATLAS_DARK, accent: print.light.onAccent };
  };

  it('prints light on a dark ground: the black body, the case, the acrylic and the glass', () => {
    for (const look of [BLACK_ICE, WHITE_AMBER]) {
      for (const ground of ['case', 'acrylic', 'glass'] as const) {
        expect(inksFor(ground, printOf({}, look)), ground).toMatchObject(dark(look));
      }
    }
    expect(inksFor('body', printOf({}, BLACK_ICE))).toMatchObject(dark(BLACK_ICE));
  });

  it('prints dark on a light one: the white and the silver body, and the metal', () => {
    for (const look of [WHITE_AMBER, { body: 'silver', light: 'ice' }]) {
      expect(inksFor('body', printOf({}, look)), look.body).toMatchObject(light(look));
    }
    expect(inksFor('metal', printOf({}, BLACK_ICE))).toMatchObject(light(BLACK_ICE));
  });

  it("offers the stickers the light's three colours, then the light and the dark neutral", () => {
    const print = printOf({}, WHITE_AMBER);
    const { glow, accent, onAccent } = print.light;
    for (const ground of ['body', 'case', 'acrylic', 'glass', 'metal'] as Ground[]) {
      expect(inksFor(ground, print).fills).toEqual([
        glow,
        accent,
        onAccent,
        ATLAS_LIGHT,
        ATLAS_DARK,
      ]);
    }
  });
});

describe('collectionSeed', () => {
  it("hashes the collection's key: a playlist and an album of one id differ, none is ''", () => {
    expect(collectionSeed('playlist:abc')).not.toBe(collectionSeed('album:abc'));
    expect(collectionSeed('playlist:abc')).toBe(fnv1a('playlist:abc'));
    expect(collectionSeed(null)).toBe(fnv1a(''));
  });
});

describe('patternKey', () => {
  it('changes with each of its six fields', () => {
    const base = printOf();
    const key = patternKey(base);
    for (const change of [
      { style: 'circuit' },
      { style: null },
      { seed: 2 },
      { light: deckSwatch({ body: 'black', light: 'amber' }, 'light') },
      { body: deckSwatch({ body: 'white', light: 'ice' }, 'body') },
      { name: 'ncam' },
      { collection: '' },
    ] as Partial<PatternPrint>[]) {
      expect(patternKey({ ...base, ...change }), JSON.stringify(change)).not.toBe(key);
    }
    expect(patternKey({ ...base })).toBe(key);
  });
});

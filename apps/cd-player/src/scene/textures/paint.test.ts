import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackView } from '../../bridge';
import { clearSwatch, DEFAULT_CLEAR_LOOK } from '../../clear-looks';
import {
  LCD_ON,
  JOG_RING_DIM,
  JOG_RING_SEGMENTS,
  jogRingLit,
  lcdColour,
  loadFaces,
  paintBooklet,
  paintCard,
  paintDeckScreen,
  paintDisc,
  paintJogRing,
  paintLcd,
  paintTag,
} from './paint';

afterEach(() => {
  vi.unstubAllGlobals();
});

const view: TrackView = {
  id: 't',
  title: 'A title that is long enough to be fitted to the ring of the disc',
  artists: 'Some Artist, Another Artist',
  artUrl: null,
  artistUrl: null,
};

/**
 * A canvas whose 2D context draws nothing: it notes every font it is given and every text it is
 * asked to draw (in order), and measures a character as 8 px.
 */
function recorder(width = 1024, height = width) {
  const fonts = new Set<string>();
  const texts: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
        if (key === 'fillText') return (text: string) => texts.push(text);
        if (key.toString().startsWith('create')) return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set: (_target, key, value) => {
        if (key === 'font') fonts.add(String(value));
        return true;
      },
    },
  );
  const canvas = { width, height, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, fonts, texts };
}

const picture = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement;

/** What a face is loaded by: the shorthand without its size, which does not pick a face. */
const faceOf = (font: string) => font.replace(/\d+px/, '16px');

describe('loadFaces', () => {
  function fonts(load: (face: string, text?: string) => Promise<unknown>) {
    const calls: [string, string | undefined][] = [];
    vi.stubGlobal('document', {
      fonts: {
        load: (face: string, text?: string) => {
          calls.push([face, text]);
          return load(face, text);
        },
      },
    });
    return calls;
  }

  it('loads every face the painters draw with', async () => {
    const calls = fonts(async () => []);
    await loadFaces();
    const loaded = calls.map(([face]) => face);
    const drawn = new Set<string>();
    for (const [paint, size] of [
      [(c: HTMLCanvasElement) => paintDisc(c, null, view), 1024],
      [(c: HTMLCanvasElement) => paintDisc(c, picture, null), 1024],
      [(c: HTMLCanvasElement) => paintBooklet(c, null, view), 1024],
      [(c: HTMLCanvasElement) => paintBooklet(c, null, null), 1024],
      [(c: HTMLCanvasElement) => paintCard(c, { name: 'Top 50', subtitle: '50 songs' }), 1024],
      [(c: HTMLCanvasElement) => paintCard(c, null), 1024],
      [(c: HTMLCanvasElement) => paintLcd(c, 3, 84_000, 'playing'), 256],
      [(c: HTMLCanvasElement) => paintLcd(c, 0, 0, 'idle'), 256],
      [(c: HTMLCanvasElement) => paintTag(c, { name: 'Top 50', subtitle: '50 songs' }), 512],
      [(c: HTMLCanvasElement) => paintTag(c, null), 512],
    ] as const) {
      const { canvas, fonts: used } = recorder(size);
      paint(canvas);
      for (const font of used) drawn.add(faceOf(font));
    }
    expect(drawn.size).toBeGreaterThan(1);
    for (const face of drawn) expect(loaded).toContain(face);
  });

  it('asks for the faces the characters it is given need', async () => {
    const calls = fonts(async () => []);
    await loadFaces('Привіт');
    expect(calls.length).toBeGreaterThan(1);
    for (const [, text] of calls) expect(text).toBe('Привіт');
  });

  it('settles when a face fails to load', async () => {
    fonts(async (face) => {
      if (face.startsWith('italic')) throw new Error('offline');
      return [];
    });
    await expect(loadFaces()).resolves.toBeUndefined();
  });

  it('settles with no font loading to ask', async () => {
    await expect(loadFaces()).resolves.toBeUndefined();
    vi.stubGlobal('document', {});
    await expect(loadFaces()).resolves.toBeUndefined();
  });
});

describe('the lines of text', () => {
  it("fits the card's subtitle to the card, as it does the name", () => {
    const { canvas, texts } = recorder(1024, 182);
    paintCard(canvas, {
      name: 'Top 50 - Global',
      subtitle: 'an owner with a long name '.repeat(20),
    });
    const subtitle = texts.at(-1) ?? '';
    expect(subtitle.endsWith('…')).toBe(true);
    expect(subtitle.length * 8).toBeLessThanOrEqual(1024 * 0.92);
  });

  it('leaves a subtitle that fits as it is', () => {
    const { canvas, texts } = recorder(1024, 182);
    paintCard(canvas, { name: 'Top 50 - Global', subtitle: 'Spotify' });
    expect(texts.at(-1)).toBe('Spotify');
  });

  it('fits the artists of an art-less booklet to the cover, as it does the title', () => {
    const { canvas, texts } = recorder();
    paintBooklet(canvas, null, { ...view, artists: 'An Artist, '.repeat(60) });
    const artists = texts.at(-1) ?? '';
    expect(artists.endsWith('…')).toBe(true);
    expect(artists.length * 8).toBeLessThanOrEqual(1024 * 0.84);
  });

  it('leaves the artists of an art-less booklet as they are when they fit', () => {
    const { canvas, texts } = recorder();
    paintBooklet(canvas, null, view);
    expect(texts.at(-1)).toBe(view.artists);
  });

  it('wraps a long collection name over three lines on the tag, the last fitted', () => {
    const { canvas, texts } = recorder(512, 768);
    paintTag(canvas, { name: 'word '.repeat(40).trim(), subtitle: 'Spotify' });
    const lines = texts.filter((text) => text.startsWith('word'));
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
    for (const line of lines) expect(line.length * 8).toBeLessThanOrEqual(512 * 0.84);
  });

  it('engraves the plate: every line is drawn twice, the cut over its light edge', () => {
    const { canvas, texts } = recorder(1024, 182);
    paintCard(canvas, { name: 'Top 50 - Global', subtitle: 'Spotify' });
    expect(texts.filter((text) => text === 'Top 50 - Global')).toHaveLength(2);
    expect(texts.at(-1)).toBe('Spotify');
  });
});

describe('lcdColour', () => {
  it('is the suitcase’s cyan, or the Clear model’s light', () => {
    expect(lcdColour({ model: 'suitcase', skin: 'blush' })).toBe(LCD_ON);
    expect(lcdColour({ model: 'clear', clear: DEFAULT_CLEAR_LOOK })).toBe(
      clearSwatch(DEFAULT_CLEAR_LOOK, 'light').glow,
    );
  });
});

/** A canvas that notes each fillRect with the fill style and alpha it was drawn in. */
function strip(width = 480, height = 8) {
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const rects: { x: number; w: number; style: unknown; alpha: unknown }[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'fillRect'
          ? (x: number, _y: number, w: number) =>
              rects.push({ x, w, style: state.fillStyle, alpha: state.globalAlpha })
          : () => {},
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  );
  const canvas = { width, height, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, rects };
}

describe('jogRingLit', () => {
  it('lights the share of 48 segments the target has reached, rounded', () => {
    expect(JOG_RING_SEGMENTS).toBe(48);
    expect(jogRingLit(0, 30_000)).toBe(0);
    expect(jogRingLit(15_000, 30_000)).toBe(24);
    expect(jogRingLit(30_000, 30_000)).toBe(48);
    expect(jogRingLit(312, 30_000)).toBe(0);
    expect(jogRingLit(313, 30_000)).toBe(1);
  });
  it('stays within the ring, and dark without a duration', () => {
    expect(jogRingLit(40_000, 30_000)).toBe(48);
    expect(jogRingLit(-5, 30_000)).toBe(0);
    expect(jogRingLit(10_000, 0)).toBe(0);
    expect(jogRingLit(10_000, Number.NaN)).toBe(0);
  });
});

describe('paintJogRing', () => {
  it('blacks the strip, then draws 48 segments left to right: lit in the glow, the rest dim', () => {
    const { canvas, rects } = strip(480, 8);
    paintJogRing(canvas, 5, '#7fd8ff');
    expect(rects[0]).toMatchObject({ x: 0, w: 480, style: '#000000', alpha: 1 });
    const segments = rects.slice(1);
    expect(segments).toHaveLength(48);
    segments.forEach((rect, k) => {
      expect(rect.style, String(k)).toBe('#7fd8ff');
      expect(rect.alpha, String(k)).toBe(k < 5 ? 1 : JOG_RING_DIM);
      expect(rect.x, String(k)).toBeCloseTo(k * 10 + 0.9, 9);
      expect(rect.w, String(k)).toBeCloseTo(8.2, 9);
    });
  });
});

describe('paintDeckScreen', () => {
  it('prints the track, the title, the artists, the times and the name', () => {
    const { canvas, texts } = recorder(768, 432);
    paintDeckScreen(
      canvas,
      {
        trackNo: 3,
        title: 'Song',
        artists: 'Band',
        id: 'x',
        targetMs: 42_000,
        durationMs: 180_000,
        status: 'playing',
      },
      LCD_ON,
    );
    for (const text of ['03', 'Song', 'Band', '0:42', '-2:18', 'ncam']) {
      expect(texts).toContain(text);
    }
  });

  it('prints dashes and "No disc" without a track', () => {
    const { canvas, texts } = recorder(768, 432);
    paintDeckScreen(
      canvas,
      { trackNo: 0, title: '', artists: '', id: null, targetMs: 0, durationMs: 0, status: 'idle' },
      LCD_ON,
    );
    for (const text of ['--', 'No disc', '-:--']) expect(texts).toContain(text);
  });
});

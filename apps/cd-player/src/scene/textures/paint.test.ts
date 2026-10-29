import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackView } from '../../bridge';
import { loadFaces, paintBooklet, paintCard, paintDisc, paintLcd, paintPolaroid } from './paint';

afterEach(() => {
  vi.unstubAllGlobals();
});

const view: TrackView = {
  id: 't',
  title: 'A title that is long enough to be fitted to the ring of the disc',
  artists: 'Some Artist, Another Artist',
  artUrl: null,
  artistUrl: null,
  palette: null,
};

/** A canvas whose 2D context draws nothing and notes every font it is given. */
function recorder(size = 1024) {
  const fonts = new Set<string>();
  const context = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
        if (key.toString().startsWith('create')) return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set: (_target, key, value) => {
        if (key === 'font') fonts.add(String(value));
        return true;
      },
    },
  );
  const canvas = { width: size, height: size, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, fonts };
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
      [(c: HTMLCanvasElement) => paintPolaroid(c, null), 512],
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

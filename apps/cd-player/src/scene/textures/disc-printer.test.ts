import type { CanvasTexture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TrackView } from '../../bridge';
import {
  bookletSides,
  makePrinter,
  makeSurfaces,
  nothingPrinted,
  type PrintLoad,
} from './disc-printer';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: `art of ${id}`,
  artistUrl: null,
});

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A canvas holds its size; a texture counts its uploads (`needsUpdate`) and its disposals. */
interface FakeCanvas {
  width: number;
  height: number;
}
interface FakeTexture {
  uploads: number;
  disposed: number;
}

/** A picture, as the page's image cache would hand one out: here, a name. */
const picture = (name: string) => ({ name }) as unknown as HTMLImageElement;
const nameOf = (image: HTMLImageElement | null) =>
  image ? (image as unknown as { name: string }).name : null;

/** The printer on fake canvases and textures; each load waits until the test finishes it. */
function harness({ booklet = true }: { booklet?: boolean } = {}) {
  const textures: FakeTexture[] = [];
  const surfaces = makeSurfaces(
    {
      canvas: (width, height) => ({ width, height }) as FakeCanvas as unknown as HTMLCanvasElement,
      texture: () => {
        const texture = { uploads: 0, disposed: 0 };
        textures.push(texture);
        return {
          set needsUpdate(value: boolean) {
            if (value) texture.uploads++;
          },
          dispose: () => {
            texture.disposed++;
          },
        } as unknown as CanvasTexture;
      },
    },
    { booklet },
  );
  const loads: { id: string; finish(loaded?: Partial<PrintLoad>): void }[] = [];
  /** Every paint: the surface, its size then, the picture (null: the blank) and the track. */
  const painted: [surface: string, size: number, picture: string | null, track: string | null][] =
    [];
  const failed: [string, unknown][] = [];
  const where = (canvas: HTMLCanvasElement) => {
    const disc = surfaces.canvases.disc.indexOf(canvas);
    return disc >= 0 ? `disc ${disc}` : `booklet ${surfaces.canvases.booklet.indexOf(canvas)}`;
  };
  const printed = { current: nothingPrinted() };
  const printer = makePrinter(surfaces, printed, {
    load: (view) =>
      new Promise<PrintLoad>((resolve) => {
        loads.push({
          id: view.id,
          finish: (loaded = {}) => resolve({ art: null, photo: null, late: null, ...loaded }),
        });
      }),
    paintDisc: (canvas, image, view) =>
      painted.push([where(canvas), canvas.width, nameOf(image), view?.id ?? null]),
    paintBooklet: (canvas, image, view) =>
      painted.push([where(canvas), canvas.width, nameOf(image), view?.id ?? null]),
    onFailed: (view, error) => failed.push([view.id, error]),
  });
  return { surfaces, textures, loads, painted, failed, printed, printer };
}

describe('the disc printer', () => {
  it('blanks a copy with its new track’s name at once, then prints the art once it has loaded', async () => {
    const h = harness();
    const done = h.printer.disc(2, track('a'), 512);
    expect(h.painted).toEqual([['disc 2', 512, null, 'a']]);
    expect(h.textures[2].uploads).toBe(1);
    expect(h.printer.printed?.(2)).toEqual({ track: 'a', size: 512, landed: false });
    h.loads[0].finish({ art: picture('art of a'), photo: picture('photo of X') });
    await done;
    // The artist's photo, else the art.
    expect(h.painted.at(-1)).toEqual(['disc 2', 512, 'photo of X', 'a']);
    expect(h.textures[2].uploads).toBe(2);
    expect(h.printer.printed?.(2)).toEqual({ track: 'a', size: 512, landed: true });
    // The same track again (its art arrived after its change began): no blank in between.
    const again = h.printer.disc(2, track('a'), 512);
    expect(h.painted).toHaveLength(2);
    h.loads[1].finish({ art: picture('art of a') });
    await again;
    expect(h.painted.at(-1)).toEqual(['disc 2', 512, 'art of a', 'a']);
  });

  it('gives a copy moving into slot 0 a texture of 1024 px, disposing the one of 512', async () => {
    const h = harness();
    const rack = h.printer.disc(1, track('b'), 512);
    h.loads[0].finish({ art: picture('art of b') });
    await rack;
    expect(h.textures[1].disposed).toBe(0);
    // The same track at its new size: resized as its print lands.
    const moved = h.printer.disc(1, track('b'), 1024);
    expect(h.surfaces.canvases.disc[1]).toMatchObject({ width: 512, height: 512 });
    h.loads[1].finish({ art: picture('art of b') });
    await moved;
    expect(h.surfaces.canvases.disc[1]).toMatchObject({ width: 1024, height: 1024 });
    expect(h.textures[1].disposed).toBe(1);
    expect(h.painted.at(-1)).toEqual(['disc 1', 1024, 'art of b', 'b']);
    expect(h.printer.printed?.(1).size).toBe(1024);
    // Another track at a new size: resized with its blank, at once.
    void h.printer.disc(3, track('c'), 1024);
    expect(h.painted.at(-1)).toEqual(['disc 3', 1024, null, 'c']);
    expect(h.textures[3].disposed).toBe(1);
    expect(h.textures[1].disposed).toBe(1);
  });

  it('ignores a stale print: the last one asked for on a copy or a side wins', async () => {
    const h = harness();
    const older = h.printer.disc(0, track('a'), 1024);
    const newer = h.printer.disc(0, track('b'), 1024);
    h.loads[1].finish({ art: picture('art of b') });
    await newer;
    h.loads[0].finish({ art: picture('art of a') });
    await older;
    expect(h.painted).toEqual([
      ['disc 0', 1024, null, 'a'],
      ['disc 0', 1024, null, 'b'],
      ['disc 0', 1024, 'art of b', 'b'],
    ]);
    expect(h.printer.printed?.(0).track).toBe('b');
    // A booklet side's print that lands after its blank cover was asked for draws nothing.
    const cover = h.printer.booklet(1, track('a'));
    await h.printer.booklet(1, null);
    h.loads[2].finish({ art: picture('art of a') });
    await cover;
    expect(h.painted.slice(3)).toEqual([
      ['booklet 1', 1024, null, 'a'],
      ['booklet 1', 1024, null, null],
    ]);
  });

  it('makes no booklet for a model without a jewel case, and prints none', async () => {
    const h = harness({ booklet: false });
    expect(h.surfaces.canvases.booklet).toEqual([]);
    expect(bookletSides(h.surfaces)).toEqual([]);
    await h.printer.booklet(0, track('a'));
    expect(h.painted).toEqual([]);
    expect(bookletSides(harness().surfaces)).toEqual([0, 1]);
  });

  it('prints again once the page’s fonts are in what went out in the fallback faces', async () => {
    const h = harness();
    let fontsIn = () => {};
    const late = new Promise<void>((resolve) => {
      fontsIn = resolve;
    });
    const disc = h.printer.disc(4, track('d'), 512);
    h.loads[0].finish({ art: picture('art of d'), late });
    await disc;
    const booklet = h.printer.booklet(0, track('d'));
    h.loads[1].finish({ art: picture('art of d'), late });
    await booklet;
    // A newer track has taken copy 5 by the time the fonts are in: it is not printed again.
    const taken = h.printer.disc(5, track('e'), 512);
    h.loads[2].finish({ art: picture('art of e'), late });
    await taken;
    void h.printer.disc(5, track('f'), 512);
    expect(h.loads.map(({ id }) => id)).toEqual(['d', 'd', 'e', 'f']);
    fontsIn();
    await flush();
    expect(h.loads.map(({ id }) => id)).toEqual(['d', 'd', 'e', 'f', 'd', 'd']);
    h.loads[4].finish({ art: picture('art of d') });
    h.loads[5].finish({ art: picture('art of d') });
    await flush();
    expect(h.painted.slice(-2)).toEqual([
      ['disc 4', 512, 'art of d', 'd'],
      ['booklet 0', 1024, 'art of d', 'd'],
    ]);
    expect(h.failed).toEqual([]);
  });
});

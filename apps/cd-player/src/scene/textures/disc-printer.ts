import type { CanvasTexture } from 'three';
import type { TrackView } from '../../bridge';
import { DISC_COPIES, type PrintSize } from '../stage';
import type { DiscPrinter } from '../swap-controller';
import { createPainter } from './painter';

// The printing core of useDiscPrints, with no React: the disc copies' and the booklet's canvases
// and textures, what each was last asked to print, and the printer the swap controller drives.
// What it makes, draws and loads with is injected (paint.ts and images.ts in the page), so node
// tests run it on fake canvases and textures.

/** A copy's canvas until it is first printed for a place: the rack's size. */
export const FIRST_SIZE: PrintSize = 512;
export const BOOKLET_PX = 1024;

/** How the surfaces are made: paint.ts's `newCanvas` and `canvasTexture` in the page. */
export interface SurfaceMakers {
  canvas(width: number, height: number): HTMLCanvasElement;
  texture(canvas: HTMLCanvasElement): CanvasTexture;
}

export function makeSurfaces(make: SurfaceMakers, kind: { booklet?: boolean } = {}) {
  const disc = Array.from({ length: DISC_COPIES }, () => make.canvas(FIRST_SIZE, FIRST_SIZE));
  // A turntable has no jewel case: no booklet to print.
  const booklet: HTMLCanvasElement[] =
    kind.booklet === false
      ? []
      : [make.canvas(BOOKLET_PX, BOOKLET_PX), make.canvas(BOOKLET_PX, BOOKLET_PX)];
  return {
    canvases: { disc, booklet },
    textures: {
      disc: disc.map((canvas) => make.texture(canvas)),
      booklet: booklet.map((canvas) => make.texture(canvas)),
    },
  };
}

export type Surfaces = ReturnType<typeof makeSurfaces>;

/** The booklet's sides the surfaces have: both, or none for a model without a jewel case. */
export function bookletSides(surfaces: Surfaces): readonly (0 | 1)[] {
  return surfaces.canvases.booklet.length ? [0, 1] : [];
}

/** What each surface was last asked to print, so the hook prints it again as its art comes in. */
export interface Printed {
  disc: (TrackView | null)[];
  /** The size each copy was last asked for. */
  size: PrintSize[];
  /** Whether a print has landed on each copy (else it shows the page's blank label). */
  landed: boolean[];
  booklet: [TrackView | null, TrackView | null];
  bookletLanded: [boolean, boolean];
}

export const nothingPrinted = (): Printed => ({
  disc: Array.from({ length: DISC_COPIES }, () => null),
  size: Array.from({ length: DISC_COPIES }, () => FIRST_SIZE),
  landed: Array.from({ length: DISC_COPIES }, () => false),
  booklet: [null, null],
  bookletLanded: [false, false],
});

/** What a print loaded: its pictures, and the faces' load when they came too late for it. */
export interface PrintLoad {
  art: HTMLImageElement | null;
  photo: HTMLImageElement | null;
  /** Settles once the page's faces are in; null when the print had them in time. */
  late: Promise<unknown> | null;
}

/** Paints a print on its canvas: paint.ts's `paintDisc` or `paintBooklet` in the page. */
export type PaintPrint = (
  canvas: HTMLCanvasElement,
  picture: HTMLImageElement | null,
  view: TrackView | null,
) => void;

/** What the printer loads and draws with, and where a print it started itself reports failing. */
export interface PrinterDeps {
  load(view: TrackView): Promise<PrintLoad>;
  paintDisc: PaintPrint;
  paintBooklet: PaintPrint;
  onFailed(view: TrackView, error: unknown): void;
}

/** Makes copy `index` `size` px square: a new size needs a new texture on the GPU. */
function sizeDisc(surfaces: Surfaces, index: number, size: number): void {
  const canvas = surfaces.canvases.disc[index];
  if (canvas.width === size) return;
  canvas.width = size;
  canvas.height = size;
  surfaces.textures.disc[index].dispose();
}

/** A copy without its art yet: the page's own label, with the track's name round it if it has one. */
export function blankDisc(
  surfaces: Surfaces,
  paint: PaintPrint,
  index: number,
  view: TrackView | null,
  size: number,
): void {
  sizeDisc(surfaces, index, size);
  paint(surfaces.canvases.disc[index], null, view);
  surfaces.textures.disc[index].needsUpdate = true;
}

export function blankBooklet(
  surfaces: Surfaces,
  paint: PaintPrint,
  side: 0 | 1,
  view: TrackView | null,
): void {
  paint(surfaces.canvases.booklet[side], null, view);
  surfaces.textures.booklet[side].needsUpdate = true;
}

export function makePrinter(
  surfaces: Surfaces,
  printed: { current: Printed },
  deps: PrinterDeps,
): DiscPrinter {
  const reportFailed = (view: TrackView) => (error: unknown) => deps.onFailed(view, error);
  const discPrint = createPainter(deps.load, (index, { art, photo, late }, view, size) => {
    sizeDisc(surfaces, index, size);
    deps.paintDisc(surfaces.canvases.disc[index], photo ?? art, view);
    surfaces.textures.disc[index].needsUpdate = true;
    printed.current.landed[index] = true;
    // Printed in the fallback faces: print it again once the page's are in, unless a newer
    // print has taken the copy meanwhile.
    void late?.then(() => {
      if (printed.current.disc[index] === view) {
        printer.disc(index, view, printed.current.size[index]).catch(reportFailed(view));
      }
    });
  });
  const bookletPrint = createPainter(deps.load, (index, { art, late }, view) => {
    const side = index === 0 ? 0 : 1;
    // A newer print of this side, or its blank cover, has been asked for since.
    if (printed.current.booklet[side] !== view) return;
    deps.paintBooklet(surfaces.canvases.booklet[side], art, view);
    surfaces.textures.booklet[side].needsUpdate = true;
    printed.current.bookletLanded[side] = true;
    void late?.then(() => {
      if (printed.current.booklet[side] === view) {
        printer.booklet(side, view).catch(reportFailed(view));
      }
    });
  });
  const printer: DiscPrinter = {
    disc: (index, view, size, signal) => {
      // Another track: its name goes on at once, round the blank label, its art once it loads.
      // So no copy ever shows a track it no longer carries.
      if (printed.current.disc[index]?.id !== view.id) {
        blankDisc(surfaces, deps.paintDisc, index, view, size);
        printed.current.landed[index] = false;
      }
      printed.current.disc[index] = view;
      printed.current.size[index] = size;
      return discPrint(index, view, size, signal);
    },
    booklet: (side, view, signal) => {
      if (!surfaces.canvases.booklet[side]) return Promise.resolve();
      if (!view || printed.current.booklet[side]?.id !== view.id) {
        blankBooklet(surfaces, deps.paintBooklet, side, view);
        printed.current.bookletLanded[side] = false;
      }
      printed.current.booklet[side] = view;
      return view ? bookletPrint(side, view, BOOKLET_PX, signal) : Promise.resolve();
    },
    preload: async (view) => {
      await deps.load(view);
    },
    printed: (index) => ({
      track: printed.current.disc[index]?.id ?? null,
      size: surfaces.canvases.disc[index].width,
      landed: printed.current.landed[index],
    }),
  };
  return printer;
}

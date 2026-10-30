import { createLogger } from '@ncam/logger';
import { useEffect, useRef, useState } from 'react';
import type { CanvasTexture, MeshPhysicalMaterial } from 'three';
import type { SceneBridge, TrackView } from '../../bridge';
import type { Rig } from '../rig';
import { DISC_COPIES, type PrintSize } from '../stage';
import type { DiscPrinter } from '../swap-controller';
import { tryImage } from './images';
import { canvasTexture, loadFaces, newCanvas, paintBooklet, paintDisc } from './paint';
import { createPainter, reprintFor, settlesWithin } from './painter';

const log = createLogger({ scope: 'cd-player' });

/** How long a print waits for the page's fonts: past it, it goes out in the fallback faces. */
const FACES_WAIT_MS = 1000;
/** A copy's canvas until it is first printed for a place: the rack's size. */
const FIRST_SIZE: PrintSize = 512;
const BOOKLET_PX = 1024;

function makeSurfaces() {
  const disc = Array.from({ length: DISC_COPIES }, () => newCanvas(FIRST_SIZE, FIRST_SIZE));
  const booklet = [newCanvas(BOOKLET_PX, BOOKLET_PX), newCanvas(BOOKLET_PX, BOOKLET_PX)] as const;
  return {
    canvases: { disc, booklet },
    textures: {
      disc: disc.map((canvas) => canvasTexture(canvas)),
      booklet: [canvasTexture(booklet[0]), canvasTexture(booklet[1])] as const,
    },
  };
}

type Surfaces = ReturnType<typeof makeSurfaces>;

/** What each surface was last asked to print, so the hook prints it again as its art comes in. */
interface Printed {
  disc: (TrackView | null)[];
  /** The size each copy was last asked for. */
  size: PrintSize[];
  /** Whether a print has landed on each copy (else it shows the page's blank label). */
  landed: boolean[];
  booklet: [TrackView | null, TrackView | null];
  bookletLanded: [boolean, boolean];
}

const nothingPrinted = (): Printed => ({
  disc: Array.from({ length: DISC_COPIES }, () => null),
  size: Array.from({ length: DISC_COPIES }, () => FIRST_SIZE),
  landed: Array.from({ length: DISC_COPIES }, () => false),
  booklet: [null, null],
  bookletLanded: [false, false],
});

function setMap(material: MeshPhysicalMaterial, texture: CanvasTexture): void {
  material.map = texture;
  material.needsUpdate = true;
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
function blankDisc(surfaces: Surfaces, index: number, view: TrackView | null, size: number): void {
  sizeDisc(surfaces, index, size);
  paintDisc(surfaces.canvases.disc[index], null, view);
  surfaces.textures.disc[index].needsUpdate = true;
}

function blankBooklet(surfaces: Surfaces, side: 0 | 1, view: TrackView | null): void {
  paintBooklet(surfaces.canvases.booklet[side], null, view);
  surfaces.textures.booklet[side].needsUpdate = true;
}

/** The hook's own prints (a track's art arriving) report a failure as the director's do. */
const reportFailed = (track: TrackView) => (error: unknown) =>
  log.warn('cd-player.print-failed', { track: track.id, error: String(error) });

/** A print's pictures (through the image cache, so its cap holds) and its faces, waited for a while. */
async function loadPrint(view: TrackView) {
  const text = `${view.title} ${view.artists}`;
  // The ring prints upper case; the booklet's own title, as it is.
  const faces = loadFaces(text + text.toUpperCase());
  const [art, photo, inTime] = await Promise.all([
    tryImage(view.artUrl),
    tryImage(view.artistUrl),
    settlesWithin(faces, FACES_WAIT_MS),
  ]);
  return { art, photo, late: inTime ? null : faces };
}

function makePrinter(surfaces: Surfaces, printed: { current: Printed }): DiscPrinter {
  const discPrint = createPainter(loadPrint, (index, { art, photo, late }, view, size) => {
    sizeDisc(surfaces, index, size);
    paintDisc(surfaces.canvases.disc[index], photo ?? art, view);
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
  const bookletPrint = createPainter(loadPrint, (index, { art, late }, view) => {
    const side = index === 0 ? 0 : 1;
    // A newer print of this side, or its blank cover, has been asked for since.
    if (printed.current.booklet[side] !== view) return;
    paintBooklet(surfaces.canvases.booklet[side], art, view);
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
        blankDisc(surfaces, index, view, size);
        printed.current.landed[index] = false;
      }
      printed.current.disc[index] = view;
      printed.current.size[index] = size;
      return discPrint(index, view, size, signal);
    },
    booklet: (side, view, signal) => {
      if (!view || printed.current.booklet[side]?.id !== view.id) {
        blankBooklet(surfaces, side, view);
        printed.current.bookletLanded[side] = false;
      }
      printed.current.booklet[side] = view;
      return view ? bookletPrint(side, view, BOOKLET_PX, signal) : Promise.resolve();
    },
    preload: async (view) => {
      await loadPrint(view);
    },
    printed: (index) => ({
      track: printed.current.disc[index]?.id ?? null,
      size: surfaces.canvases.disc[index].width,
      landed: printed.current.landed[index],
    }),
  };
  return printer;
}

/**
 * Prints the disc copies and the booklet. The returned printer is the swap controller's (it says
 * which copy prints which track, at what size and when); the hook prints a track again once the
 * view knows its art, and the blank labels again once the page's fonts are in.
 */
export function useDiscPrints(rig: Rig, bridge: SceneBridge): DiscPrinter {
  const [surfaces] = useState(makeSurfaces);
  const printed = useRef<Printed>(nothingPrinted());
  // State, not a memo: React may drop a memo, and the painter's order of prints with it.
  const [printer] = useState(() => makePrinter(surfaces, printed));
  /** The rig the copies were made blank for: StrictMode's second run keeps their prints. */
  const blankFor = useRef<Rig | null>(null);

  useEffect(() => {
    const { textures } = surfaces;
    rig.discs.forEach((disc, index) => setMap(disc.label, textures.disc[index]));
    rig.bookletMaps = [textures.booklet[0], textures.booklet[1]];
    setMap(rig.case.booklet, textures.booklet[rig.bookletFront]);
    if (blankFor.current !== rig) {
      blankFor.current = rig;
      printed.current = nothingPrinted();
      for (let index = 0; index < DISC_COPIES; index++) {
        blankDisc(surfaces, index, null, FIRST_SIZE);
      }
      blankBooklet(surfaces, 0, null);
      blankBooklet(surfaces, 1, null);
    }
    const all = [...textures.disc, ...textures.booklet];
    for (const texture of all) texture.needsUpdate = true;
    return () => {
      rig.bookletMaps = [null, null];
      for (const texture of all) texture.dispose();
    };
  }, [rig, surfaces]);

  useEffect(() => {
    let live = true;
    // A change prints a copy with what the view knew when it began: print it again once the view
    // knows more of that track (its art arrives while a track picked from the list turns).
    const update = () => {
      const view = bridge.getView();
      for (let index = 0; index < DISC_COPIES; index++) {
        const again = reprintFor(printed.current.disc[index], view);
        if (again) {
          printer.disc(index, again, printed.current.size[index]).catch(reportFailed(again));
        }
      }
      for (const side of [0, 1] as const) {
        const again = reprintFor(printed.current.booklet[side], view);
        if (again) printer.booklet(side, again).catch(reportFailed(again));
      }
    };
    update();
    const unsubscribe = bridge.subscribe(update);
    // The blank labels used whatever fonts the page had: print them again once the faces are in.
    void loadFaces().then(() => {
      if (!live) return;
      for (let index = 0; index < DISC_COPIES; index++) {
        if (!printed.current.landed[index]) {
          blankDisc(surfaces, index, printed.current.disc[index], printed.current.size[index]);
        }
      }
      for (const side of [0, 1] as const) {
        if (!printed.current.bookletLanded[side]) {
          blankBooklet(surfaces, side, printed.current.booklet[side]);
        }
      }
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [bridge, surfaces, printer]);

  return printer;
}

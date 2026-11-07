import { createLogger } from '@ncam/logger';
import { useEffect, useRef, useState } from 'react';
import type { SceneBridge, TrackView } from '../../bridge';
import type { Rig } from '../rig';
import { DISC_COPIES } from '../stage';
import type { DiscPrinter } from '../swap-controller';
import {
  blankBooklet,
  blankDisc,
  FIRST_SIZE,
  makePrinter,
  makeSurfaces,
  nothingPrinted,
  type Printed,
  type PrinterDeps,
  type PrintLoad,
} from './disc-printer';
import { tryImage } from './images';
import {
  canvasTexture,
  FACES_WAIT_MS,
  loadFaces,
  newCanvas,
  paintBooklet,
  paintDisc,
  setMap,
} from './paint';
import { reprintFor, settlesWithin } from './painter';

const log = createLogger({ scope: 'cd-player' });

/** The hook's own prints (a track's art arriving) report a failure as the director's do. */
const reportFailed = (track: TrackView, error: unknown) =>
  log.warn('cd-player.print-failed', { track: track.id, error: String(error) });

/** A print's pictures (through the image cache, so its cap holds) and its faces, waited for a while. */
async function loadPrint(view: TrackView): Promise<PrintLoad> {
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

/** The page's printing: its canvases, paint.ts's painters, the image cache and the page's faces. */
const PAGE: PrinterDeps = { load: loadPrint, paintDisc, paintBooklet, onFailed: reportFailed };

/**
 * Prints the disc copies and the booklet (the printer itself is textures/disc-printer.ts). The
 * returned printer is the swap controller's (it says which copy prints which track, at what size
 * and when); the hook prints a track again once the view knows its art, and the blank labels again
 * once the page's fonts are in.
 */
export function useDiscPrints(rig: Rig, bridge: SceneBridge): DiscPrinter {
  const [surfaces] = useState(() => makeSurfaces({ canvas: newCanvas, texture: canvasTexture }));
  const printed = useRef<Printed>(nothingPrinted());
  // State, not a memo: React may drop a memo, and the painter's order of prints with it.
  const [printer] = useState(() => makePrinter(surfaces, printed, PAGE));
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
        blankDisc(surfaces, paintDisc, index, null, FIRST_SIZE);
      }
      blankBooklet(surfaces, paintBooklet, 0, null);
      blankBooklet(surfaces, paintBooklet, 1, null);
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
          printer
            .disc(index, again, printed.current.size[index])
            .catch((error: unknown) => reportFailed(again, error));
        }
      }
      for (const side of [0, 1] as const) {
        const again = reprintFor(printed.current.booklet[side], view);
        if (again) {
          printer.booklet(side, again).catch((error: unknown) => reportFailed(again, error));
        }
      }
    };
    update();
    const unsubscribe = bridge.subscribe(update);
    // The blank labels used whatever fonts the page had: print them again once the faces are in.
    void loadFaces().then(() => {
      if (!live) return;
      for (let index = 0; index < DISC_COPIES; index++) {
        if (!printed.current.landed[index]) {
          blankDisc(
            surfaces,
            paintDisc,
            index,
            printed.current.disc[index],
            printed.current.size[index],
          );
        }
      }
      for (const side of [0, 1] as const) {
        if (!printed.current.bookletLanded[side]) {
          blankBooklet(surfaces, paintBooklet, side, printed.current.booklet[side]);
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

import { createLogger } from '@ncam/logger';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { CanvasTexture, MeshBasicMaterial, MeshPhysicalMaterial } from 'three';
import type { SceneBridge, TrackView } from '../../bridge';
import type { Status } from '../../playback/sequencer';
import type { Rig } from '../rig';
import type { Painter } from '../swap-controller';
import { tryImage } from './images';
import {
  canvasTexture,
  loadFaces,
  newCanvas,
  paintBooklet,
  paintCard,
  paintDisc,
  paintLcd,
  paintTag,
} from './paint';
import { createPainter, printKey, reprintFor, settlesWithin } from './painter';

const log = createLogger({ scope: 'cd-player' });

/** How long a print waits for the page's fonts: past it, it goes out in the fallback faces. */
const FACES_WAIT_MS = 1000;

function makeSurfaces() {
  const disc = [newCanvas(1024, 1024), newCanvas(1024, 1024)] as const;
  const booklet = [newCanvas(1024, 1024), newCanvas(1024, 1024)] as const;
  const card = newCanvas(1024, 182);
  const tag = newCanvas(512, 768);
  const lcd = newCanvas(256, 112);
  return {
    canvases: { disc, booklet, card, tag, lcd },
    textures: {
      disc: [canvasTexture(disc[0]), canvasTexture(disc[1])] as const,
      booklet: [canvasTexture(booklet[0]), canvasTexture(booklet[1])] as const,
      card: canvasTexture(card),
      tag: canvasTexture(tag),
      lcd: canvasTexture(lcd),
    },
  };
}

type Surfaces = ReturnType<typeof makeSurfaces>;

/** What the prints show, so that each is made again only when what it shows changes. */
interface Shown {
  /** The collection the plate and the tag were printed for. */
  card: string;
  lid: string;
  /**
   * What the display shows: the three things it changes with, compared every frame (a key string
   * would be an allocation per frame).
   */
  lcd: { track: number; second: number; status: Status | null };
  /** The track each disc and its booklet were last printed for, by whoever asked. */
  printed: [TrackView | null, TrackView | null];
  /** Whether a track's print has landed on each disc and its booklet (else they are blank). */
  landed: [boolean, boolean];
}

const NONE = '\u0000';

const nothingShown = (): Shown => ({
  card: NONE,
  lid: NONE,
  lcd: { track: -1, second: -1, status: null },
  printed: [null, null],
  landed: [false, false],
});

function setMap(material: MeshPhysicalMaterial | MeshBasicMaterial, texture: CanvasTexture): void {
  material.map = texture;
  material.needsUpdate = true;
}

/** The disc and booklet of a case with no track: the page's own print. */
function printBlank({ canvases, textures }: Surfaces, index: 0 | 1): void {
  paintDisc(canvases.disc[index], null, null);
  paintBooklet(canvases.booklet[index], null, null);
  textures.disc[index].needsUpdate = true;
  textures.booklet[index].needsUpdate = true;
}

/** The hook's own prints (the lid, a track's art arriving) report a failure as the director's do. */
const reportFailed = (track: TrackView) => (error: unknown) =>
  log.warn('cd-player.print-failed', { track: track.id, error: String(error) });

/**
 * The painter the director calls, and the hook: a track's art and name printed on a disc and its
 * booklet. It holds the order of the prints in flight, so it lives as long as the hook does.
 */
function makePainter(surfaces: Surfaces, shown: { current: Shown }): Painter {
  const painter: Painter = (index, view, signal) => {
    shown.current.printed[index] = view;
    return print(index, view, signal);
  };
  const print = createPainter(
    async (view) => {
      const text = `${view.title} ${view.artists}`;
      // The ring prints upper case; the booklet's own title, as it is.
      const faces = loadFaces(text + text.toUpperCase());
      const [art, photo, inTime] = await Promise.all([
        tryImage(view.artUrl),
        tryImage(view.artistUrl),
        settlesWithin(faces, FACES_WAIT_MS),
      ]);
      return { art, photo, late: inTime ? null : faces };
    },
    (index, { art, photo, late }, view) => {
      const { canvases, textures } = surfaces;
      paintDisc(canvases.disc[index], photo ?? art, view);
      textures.disc[index].needsUpdate = true;
      paintBooklet(canvases.booklet[index], art, view);
      textures.booklet[index].needsUpdate = true;
      shown.current.landed[index] = true;
      // Printed in the fallback faces: print it again once the page's are in, unless a newer
      // print has taken the disc meanwhile.
      void late?.then(() => {
        if (shown.current.printed[index] === view) painter(index, view).catch(reportFailed(view));
      });
    },
  );
  return painter;
}

/**
 * Prints the bridge's view on the player: each disc and its case's booklet for the track they
 * carry (through the returned painter, which the director calls on a change; the hook prints a
 * track again once its art is known), the plate and the luggage tag with the collection's name,
 * and the display, at most once a second.
 */
export function useSceneTextures(rig: Rig, bridge: SceneBridge): Painter {
  const [surfaces] = useState(makeSurfaces);
  const shown = useRef<Shown>(nothingShown());
  // State, not a memo: React may drop a memo, and the painter's order of prints with it.
  const [paint] = useState(() => makePainter(surfaces, shown));

  useEffect(() => {
    const { canvases, textures } = surfaces;
    rig.discs.forEach((disc, index) => setMap(disc.label, textures.disc[index]));
    rig.cases.forEach((item, index) => setMap(item.booklet, textures.booklet[index]));
    setMap(rig.model.slots.tag_print, textures.tag);
    setMap(rig.model.slots.card_print, textures.card);
    setMap(rig.model.slots.lcd_screen, textures.lcd);
    shown.current = nothingShown();
    for (const index of [0, 1] as const) printBlank(surfaces, index);
    paintCard(canvases.card, null);
    paintTag(canvases.tag, null);
    paintLcd(canvases.lcd, 0, 0, 'idle');
    const all = [...textures.disc, ...textures.booklet, textures.tag, textures.card, textures.lcd];
    for (const texture of all) texture.needsUpdate = true;
    return () => {
      for (const texture of all) texture.dispose();
    };
  }, [rig, surfaces]);

  useEffect(() => {
    const { canvases, textures } = surfaces;
    let live = true;
    const printTrack = (index: 0 | 1, track: TrackView) => {
      paint(index, track).catch(reportFailed(track));
    };
    const update = () => {
      const view = bridge.getView();
      const card = view.collection ? `${view.collection.name}\n${view.collection.subtitle}` : '';
      if (card !== shown.current.card) {
        shown.current.card = card;
        const faces = loadFaces(card);
        const printCard = () => {
          if (shown.current.card !== card) return;
          paintCard(canvases.card, view.collection);
          textures.card.needsUpdate = true;
          paintTag(canvases.tag, view.collection);
          textures.tag.needsUpdate = true;
        };
        // A font that stalls does not hold the card: it goes out in the fallback faces at worst,
        // and again once the page's are in.
        void settlesWithin(faces, FACES_WAIT_MS).then((inTime) => {
          printCard();
          if (!inTime) void faces.then(printCard);
        });
      }
      // Before the first play, the lid's case holds what will play first.
      if (rig.seated === null && !rig.swapping) {
        const next = view.upcoming[0] ?? null;
        const key = next ? printKey(next) : '';
        if (key !== shown.current.lid) {
          shown.current.lid = key;
          if (next) printTrack(rig.lidCase, next);
        }
      }
      // A change prints its disc with what the view knew when it began: print it again once the
      // view knows more of that track (its art arrives while a track picked from the list turns).
      for (const index of [0, 1] as const) {
        const again = reprintFor(shown.current.printed[index], view);
        if (again) printTrack(index, again);
      }
    };
    update();
    const unsubscribe = bridge.subscribe(update);
    // The prints so far used whatever fonts the page had: once the faces are in, print the text
    // again (the display on its next frame, and the discs no track has printed on yet).
    void loadFaces().then(() => {
      if (!live) return;
      shown.current.lcd.track = -1;
      for (const index of [0, 1] as const) {
        if (!shown.current.landed[index]) printBlank(surfaces, index);
      }
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [bridge, rig, surfaces, paint]);

  useFrame(() => {
    const view = bridge.getView();
    const lcd = shown.current.lcd;
    const second = Math.floor(view.positionMs / 1000);
    if (lcd.track === view.trackNo && lcd.second === second && lcd.status === view.status) return;
    lcd.track = view.trackNo;
    lcd.second = second;
    lcd.status = view.status;
    paintLcd(surfaces.canvases.lcd, view.trackNo, view.positionMs, view.status);
    surfaces.textures.lcd.needsUpdate = true;
  });

  return paint;
}

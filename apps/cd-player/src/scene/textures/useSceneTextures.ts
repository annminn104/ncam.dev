import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneBridge } from '../../bridge';
import type { Status } from '../../playback/sequencer';
import { scrubTargetMs } from '../controls';
import type { CdModel } from '../model';
import type { Rig } from '../rig';
import { collectionLabel, printInFaces } from './collection-print';
import {
  canvasTexture,
  jogRingLit,
  loadFaces,
  newCanvas,
  paintCard,
  paintDeckScreen,
  paintJogRing,
  paintLcd,
  paintTag,
  setMap,
} from './paint';
import { SCENE_PROFILES } from '../profiles';
import { DECK_SCREEN, playedBars } from './deck-screen';

function makeSurfaces() {
  const card = newCanvas(1024, 182);
  const tag = newCanvas(512, 768);
  const lcd = newCanvas(256, 112);
  const ring = newCanvas(480, 8);
  return {
    canvases: { card, tag, lcd, ring },
    textures: {
      card: canvasTexture(card),
      tag: canvasTexture(tag),
      lcd: canvasTexture(lcd),
      ring: canvasTexture(ring),
    },
  };
}

/** What the prints show, so that each is made again only when what it shows changes. */
interface Shown {
  /** The collection the plate and the tag were printed for. */
  card: string;
  /**
   * What the display shows: the four things it changes with, compared every frame (a key string
   * would be an allocation per frame), its colour (the Clear model's light) among them.
   */
  lcd: {
    track: number;
    second: number;
    /** The deck's screen: how many waveform bars are played. */
    bar: number;
    /** The deck's screen: the current track's id, title and artists (null/'' before the first). */
    id: string | null;
    title: string;
    artists: string;
    status: Status | null;
    colour: string | null;
  };
  /** The deck's LED ring: how many segments are lit, and in what colour. */
  ring: { lit: number; colour: string | null };
}

const NONE = '\u0000';

const nothingShown = (): Shown => ({
  card: NONE,
  lcd: {
    track: -1,
    second: -1,
    bar: -1,
    id: null,
    title: NONE,
    artists: NONE,
    status: null,
    colour: null,
  },
  ring: { lit: -1, colour: null },
});

/**
 * A CD player's prints beyond the discs and the booklet: the plate with the collection's name,
 * the luggage tag, and the display, at most once a second and whenever its colour changes. While
 * the knob is turning, the display shows the turn's target time. The discs and the booklet are
 * useDiscPrints'.
 */
export function useSceneTextures(rig: Rig<CdModel>, bridge: SceneBridge, lcdColour: string): void {
  const [surfaces] = useState(makeSurfaces);
  const shown = useRef<Shown>(nothingShown());
  // The deck's big screen replaces the LCD: its canvas is made for that model only.
  const deckScreen = SCENE_PROFILES[rig.model.id].screen === 'deck';
  const screen = useMemo(() => {
    if (!deckScreen) return null;
    const canvas = newCanvas(DECK_SCREEN.width, DECK_SCREEN.height);
    return { canvas, texture: canvasTexture(canvas) };
  }, [deckScreen]);

  // Once per rig: the defaults until the view's prints are made. A new display colour is the
  // frame's to print (below), so it never takes the plate and the tag back to their defaults.
  useEffect(() => {
    const { canvases, textures } = surfaces;
    setMap(rig.model.slots.tag_print, textures.tag);
    setMap(rig.model.slots.card_print, textures.card);
    setMap(rig.model.slots.lcd_screen, screen ? screen.texture : textures.lcd);
    const ring = rig.model.optionalSlots.jog_ring;
    if (ring) setMap(ring, textures.ring);
    shown.current = nothingShown();
    paintCard(canvases.card, null);
    paintTag(canvases.tag, null);
    const all = [textures.tag, textures.card, textures.lcd, textures.ring];
    if (screen) all.push(screen.texture);
    for (const texture of all) texture.needsUpdate = true;
    return () => {
      for (const texture of all) texture.dispose();
    };
  }, [rig, surfaces, screen]);

  useEffect(() => {
    const { canvases, textures } = surfaces;
    let live = true;
    const update = () => {
      const view = bridge.getView();
      const card = collectionLabel(view.collection);
      if (card !== shown.current.card) {
        shown.current.card = card;
        printInFaces(
          card,
          () => shown.current.card,
          () => {
            paintCard(canvases.card, view.collection);
            textures.card.needsUpdate = true;
            paintTag(canvases.tag, view.collection);
            textures.tag.needsUpdate = true;
          },
        );
      }
    };
    update();
    const unsubscribe = bridge.subscribe(update);
    // The prints so far used whatever fonts the page had: once the faces are in, print the text
    // again (the display, on its next frame).
    void loadFaces().then(() => {
      if (!live) return;
      shown.current.lcd.track = -1;
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [bridge, surfaces]);

  useFrame(() => {
    const view = bridge.getView();
    const target = scrubTargetMs(view.positionMs, view.durationMs, rig.scrubMs);
    if (rig.model.optionalSlots.jog_ring) {
      const ring = shown.current.ring;
      const lit = jogRingLit(target, view.durationMs);
      if (ring.lit !== lit || ring.colour !== lcdColour) {
        ring.lit = lit;
        ring.colour = lcdColour;
        paintJogRing(surfaces.canvases.ring, lit, lcdColour);
        surfaces.textures.ring.needsUpdate = true;
      }
    }
    const lcd = shown.current.lcd;
    const second = Math.floor(target / 1000);
    const bar = screen ? playedBars(target, view.durationMs) : -1;
    const id = screen ? (view.current?.id ?? null) : null;
    const title = screen ? (view.current?.title ?? '') : NONE;
    const artists = screen ? (view.current?.artists ?? '') : NONE;
    if (
      lcd.track === view.trackNo &&
      lcd.second === second &&
      lcd.bar === bar &&
      lcd.id === id &&
      lcd.title === title &&
      lcd.artists === artists &&
      lcd.status === view.status &&
      lcd.colour === lcdColour
    ) {
      return;
    }
    lcd.track = view.trackNo;
    lcd.second = second;
    lcd.bar = bar;
    lcd.id = id;
    lcd.title = title;
    lcd.artists = artists;
    lcd.status = view.status;
    lcd.colour = lcdColour;
    if (screen) {
      paintDeckScreen(
        screen.canvas,
        {
          trackNo: view.trackNo,
          title,
          artists,
          id,
          targetMs: target,
          durationMs: view.durationMs,
          status: view.status,
        },
        lcdColour,
      );
      screen.texture.needsUpdate = true;
    } else {
      paintLcd(surfaces.canvases.lcd, view.trackNo, target, view.status, lcdColour);
      surfaces.textures.lcd.needsUpdate = true;
    }
  });
}

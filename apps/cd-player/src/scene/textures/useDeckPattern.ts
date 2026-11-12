import { useEffect, useRef } from 'react';
import type { SceneBridge } from '../../bridge';
import type { Look } from '../../looks';
import type { Personal } from '../../personal';
import type { Rig } from '../rig';
import { DECK_ATLAS } from './deck-atlas';
import { paintDeckPattern, patternKey, type PatternPrint } from './deck-pattern';
import { NAME_SETTLE_MS, nameOnly, printFor } from './deck-print';
import { canvasTexture, FACES_WAIT_MS, loadFaces, newCanvas, setMap } from './paint';
import { settlesWithin } from './painter';

/**
 * Prints the visitor's pattern and name on the Deck's print layer (`deck_pattern`, hidden until its
 * first paint): the atlas is painted again only when what it shows changes (`patternKey`), a name
 * typed a moment after its last key, anything else at once. Nothing is made for a model without
 * the layer.
 */
export function useDeckPattern(
  rig: Rig,
  bridge: SceneBridge,
  look: Look,
  personal: Personal,
): void {
  const slot = rig.model.optionalSlots.deck_pattern;
  // What the effect below reads when the bridge or the visitor changes: the latest of each.
  const latest = useRef({ look, personal });
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    latest.current = { look, personal };
    refresh.current();
  }, [look, personal]);

  useEffect(() => {
    if (!slot) return;
    const canvas = newCanvas(DECK_ATLAS.width, DECK_ATLAS.height);
    const texture = canvasTexture(canvas);
    setMap(slot, texture);
    let live = true;
    // The print on the canvas (or on its way to it) and the one still wanted.
    let last: PatternPrint | null = null;
    let wanted: PatternPrint | null = null;
    let painted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const paint = (print: PatternPrint) => {
      const draw = () => {
        // A print that is no longer the latest by the time its faces are in is skipped.
        if (!live || wanted !== print) return;
        paintDeckPattern(canvas, DECK_ATLAS, print);
        texture.needsUpdate = true;
        if (!painted) {
          painted = true;
          slot.visible = true;
        }
      };
      const faces = loadFaces(`${print.name} ${print.collection}`);
      // A font that stalls does not hold the print: it goes out in the fallback faces at worst,
      // and again once the page's are in.
      void settlesWithin(faces, FACES_WAIT_MS).then((inTime) => {
        draw();
        if (!inTime) void faces.then(draw);
      });
    };

    const update = () => {
      const next = printFor(latest.current.look, latest.current.personal, bridge.getView());
      if (next === null) return;
      if (last !== null && patternKey(last) === patternKey(next)) return;
      const typing = nameOnly(last, next);
      last = next;
      wanted = next;
      clearTimer();
      if (typing) {
        timer = setTimeout(() => {
          timer = null;
          paint(next);
        }, NAME_SETTLE_MS);
      } else {
        paint(next);
      }
    };

    refresh.current = update;
    update();
    const unsubscribe = bridge.subscribe(update);
    return () => {
      live = false;
      refresh.current = () => undefined;
      clearTimer();
      unsubscribe();
      texture.dispose();
    };
  }, [slot, bridge]);
}

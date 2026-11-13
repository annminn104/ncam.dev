import { useEffect, useRef, useState } from 'react';
import type { SceneBridge } from '../../bridge';
import type { Rig } from '../rig';
import { collectionLabel, printInFaces } from './collection-print';
import { CARD_CANVAS, canvasTexture, newCanvas, paintCard, setMap } from './paint';

/**
 * A turntable's plate (it has no tag and no display): the collection's name, printed when it
 * changes, in the page's faces. A CD player's plate is useSceneTextures', with its tag.
 */
export function useCardPrint(rig: Rig, bridge: SceneBridge): void {
  const [surface] = useState(() => {
    const canvas = newCanvas(CARD_CANVAS.width, CARD_CANVAS.height);
    return { canvas, texture: canvasTexture(canvas) };
  });
  /** The label printed last; null before the first. */
  const shown = useRef<string | null>(null);

  useEffect(() => {
    setMap(rig.model.slots.card_print, surface.texture);
    shown.current = null;
    paintCard(surface.canvas, null);
    surface.texture.needsUpdate = true;
    return () => surface.texture.dispose();
  }, [rig, surface]);

  useEffect(() => {
    const update = () => {
      const { collection } = bridge.getView();
      const label = collectionLabel(collection);
      if (label === shown.current) return;
      shown.current = label;
      printInFaces(
        label,
        () => shown.current ?? '',
        () => {
          paintCard(surface.canvas, collection);
          surface.texture.needsUpdate = true;
        },
      );
    };
    update();
    return bridge.subscribe(update);
  }, [bridge, surface]);
}

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { SceneBridge } from '../../bridge';
import { ringTargetMs, type Rig } from '../rig';
import { canvasTexture, jogRingLit, newCanvas, paintJogRing, setMap } from './paint';

/**
 * The LED ring (`jog_ring`) where a model has one (the Deck's round its jog, a turntable's round
 * its platter): the first jogRingLit segments of the time it shows (ringTargetMs: a drag's or a
 * knob turn's target, else the position) in `colour`, the rest dim. Painted only when the lit
 * count or the colour changes; nothing at all, not even a canvas, without the ring.
 */
export function useJogRing(rig: Rig, bridge: SceneBridge, colour: string): void {
  const slot = rig.model.optionalSlots.jog_ring;
  const surface = useMemo(() => {
    if (!slot) return null;
    const canvas = newCanvas(480, 8);
    return { canvas, texture: canvasTexture(canvas) };
  }, [slot]);
  const shown = useRef<{ lit: number; colour: string | null }>({ lit: -1, colour: null });

  useEffect(() => {
    if (!slot || !surface) return;
    setMap(slot, surface.texture);
    shown.current = { lit: -1, colour: null };
    surface.texture.needsUpdate = true;
    return () => surface.texture.dispose();
  }, [slot, surface]);

  useFrame(() => {
    if (!surface) return;
    const view = bridge.getView();
    const lit = jogRingLit(ringTargetMs(rig, view, performance.now()), view.durationMs);
    if (shown.current.lit === lit && shown.current.colour === colour) return;
    shown.current = { lit, colour };
    paintJogRing(surface.canvas, lit, colour);
    surface.texture.needsUpdate = true;
  });
}

import { createLogger } from '@ncam/logger';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import { restingPose, swapPose } from './director';
import { applyPose, type Rig } from './rig';
import {
  createSwapController,
  type Painter,
  type SwapClock,
  type SwapController,
} from './swap-controller';

export type { Painter } from './swap-controller';

const log = createLogger({ scope: 'cd-player' });

const clock: SwapClock = {
  now: () => performance.now(),
  after: (ms, done) => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  },
};

/**
 * Takes the bridge's disc changes: prints the arriving disc and case, runs the timeline, resolves
 * when the disc is seated (src/scene/swap-controller.ts keeps every change settling). Between
 * changes it holds the resting pose for the playback status.
 */
export function useDirector(rig: Rig, bridge: SceneBridge, paint: Painter): void {
  const changes = useRef<SwapController | null>(null);

  useEffect(() => {
    const controller = createSwapController({
      rig,
      paint,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      hidden: () => document.hidden,
      clock,
      onPrintFailed: (error, view) =>
        log.warn('cd-player.print-failed', { track: view.id, error: String(error) }),
    });
    // A track can play with no change for its disc (the scene booted mid-playback, or Play
    // reloaded the current track after its player failed): its disc is on the spindle then.
    const follow = () => controller.seat(bridge.getView());
    follow();
    const unsubscribe = bridge.subscribe(follow);
    changes.current = controller;
    bridge.setSwapper(controller.swap);
    return () => {
      unsubscribe();
      bridge.setSwapper(null);
      controller.dispose();
      changes.current = null;
    };
  }, [bridge, rig, paint]);

  useFrame((_, dt) => {
    if (changes.current?.frame((kind, t) => applyPose(rig, swapPose(kind, t), kind, dt))) return;
    const { status } = bridge.getView();
    const loaded = status === 'playing' || status === 'paused';
    applyPose(rig, restingPose(rig.seated !== null, loaded, status === 'playing'), null, dt);
  });
}

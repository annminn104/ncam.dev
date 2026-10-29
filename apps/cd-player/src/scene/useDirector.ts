import { createLogger } from '@ncam/logger';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SceneBridge, TrackView } from '../bridge';
import { restingPose, swapPose } from './director';
import { applyPose, type Rig } from './rig';
import { createSwapController, type SwapClock, type SwapController } from './swap-controller';

const log = createLogger({ scope: 'cd-player' });

/** Prints `view` on disc `index` and its case's booklet. It must settle: a change waits for it. */
export type Painter = (index: 0 | 1, view: TrackView) => Promise<void>;

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
      clock,
      onPrintFailed: (error, view) =>
        log.warn('cd-player.print-failed', { track: view.id, error: String(error) }),
    });
    // Booted mid-playback: the disc of the current track is already on the spindle.
    const view = bridge.getView();
    if (
      rig.seated === null &&
      view.current &&
      (view.status === 'playing' || view.status === 'paused')
    ) {
      rig.seated = rig.lidCase;
      void controller.print(rig.lidCase, view.current);
    }
    changes.current = controller;
    bridge.setSwapper(controller.swap);
    return () => {
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

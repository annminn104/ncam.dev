import { createLogger } from '@ncam/logger';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import { posePlan, restingArm, restingPose, type Timeline } from './director';
import { applyPose, type Rig } from './rig';
import {
  createSwapController,
  type DiscPrinter,
  type SwapClock,
  type SwapController,
} from './swap-controller';

const log = createLogger({ scope: 'cd-player' });

const clock: SwapClock = {
  now: () => performance.now(),
  after: (ms, done) => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  },
};

interface CopyReport {
  copy: number;
  /** The track the shelf says it carries, and the one its print was made for. */
  track: string | null;
  printed: string | null;
  size: number;
  landed: boolean;
  visible: boolean;
}

/** What `window.__cdpStage()` reports on the dev server, for checks in a headless browser. */
interface StageReport {
  change: { timeline: Timeline; t: number } | null;
  current: string | null;
  upcoming: { id: string; title: string }[];
  spindle: CopyReport | null;
  rack: (CopyReport | null)[];
  booklet: string | null;
}

function report(
  rig: Rig,
  bridge: SceneBridge,
  controller: SwapController | null,
  printer: DiscPrinter,
): StageReport {
  const view = bridge.getView();
  const copy = (disc: number | null): CopyReport | null => {
    if (disc === null) return null;
    const printed = printer.printed?.(disc) ?? { track: null, size: 0, landed: false };
    return {
      copy: disc,
      track: rig.shelf.tracks[disc]?.id ?? null,
      printed: printed.track,
      size: printed.size,
      landed: printed.landed,
      visible: rig.discs[disc].object.visible,
    };
  };
  return {
    change: controller?.inspect() ?? null,
    current: view.current?.id ?? null,
    upcoming: view.upcoming.map(({ id, title }) => ({ id, title })),
    spindle: copy(rig.shelf.spindle),
    rack: rig.shelf.rack.map(copy),
    booklet: rig.shelf.booklet?.id ?? null,
  };
}

/**
 * Takes the bridge's disc changes and follows the views that change without one: prints the
 * arriving discs, runs the timelines, resolves a swap when its disc is seated
 * (src/scene/swap-controller.ts keeps every change settling). Between changes it holds the
 * resting pose for the playback status.
 */
export function useDirector(rig: Rig, bridge: SceneBridge, printer: DiscPrinter): void {
  const changes = useRef<SwapController | null>(null);

  useEffect(() => {
    const controller = createSwapController({
      stage: rig,
      printer,
      view: bridge.getView,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      door: rig.door !== null,
      booklet: rig.case !== null,
      hidden: () => document.hidden,
      clock,
      onPrintFailed: (error, view) =>
        log.warn('cd-player.print-failed', { track: view.id, error: String(error) }),
    });
    // The scene may boot mid-playback: the track in the player is on the spindle at once.
    controller.seat(bridge.getView());
    changes.current = controller;
    bridge.setSwapper(controller.swap);
    return () => {
      bridge.setSwapper(null);
      controller.dispose();
      changes.current = null;
    };
  }, [bridge, rig, printer]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const page = window as Window & { __cdpStage?: () => StageReport };
    page.__cdpStage = () => report(rig, bridge, changes.current, printer);
    return () => {
      delete page.__cdpStage;
    };
  }, [bridge, rig, printer]);

  useFrame((_, dt) => {
    const controller = changes.current;
    const view = bridge.getView();
    // After the swap the engine published, so a view a swap leads to is never followed.
    controller?.follow(view);
    const loaded = view.status === 'playing' || view.status === 'paused';
    const playing = view.status === 'playing';
    const rest = restingArm(rig.shelf.spindle !== null, loaded, playing);
    if (controller?.frame((plan, t) => applyPose(rig, posePlan(plan, t, rest), dt))) return;
    applyPose(rig, restingPose(rig.shelf, loaded, playing), dt);
  });
}

import { BOOT_STALL_MS, watchStall, type StallClock } from '../boot';
import { ModelStallError } from '../failure';
import type { HeldModel } from './model-holder';

/**
 * One load of a model, as the scene runs it (src/scene/PlayerScene.tsx): its download, its model
 * handed to the holder, and a change's stall watch. React-free and three-free, generic over what
 * it loads, so node tests drive it with stand-ins.
 */

/** What a load tells the scene. */
export interface ModelLoadEvents<M> {
  /** The download's progress (src/scene/model.ts downloadModel): null, a fraction, 1 at its end. */
  progress(fraction: number | null): void;
  /** The model has come, parsed: the holder takes it as the next, to compile. */
  landed(model: M): void;
  /** The load failed for good: its own error, or a change's stall (`ModelStallError`). */
  failed(error: Error): void;
  /** A stalled change's model, landed and compiling: it goes, never shown (the holder's `failed`). */
  abandon(model: M): void;
}

export interface ModelLoadRun<M> {
  /** `model`'s shaders are compiled and it takes the stage: a change's watch is over. */
  compiled(model: M): void;
  /**
   * The scene lets go of the load: it says nothing more and its download stops (a newer one asks
   * anew), and a model that lands anyway is disposed.
   */
  cancel(): void;
}

/**
 * Starts a load: `load` fetches and parses the model, hearing its download's progress, and stops
 * when `signal` aborts. A change of model (once one is on show) runs a stall watch on `clock`, the
 * boot's rule (`watchStall`): BOOT_STALL_MS without a word from its download, or from the end of
 * its download to the compile's end (`compiled`), fails it as stalled, stops its download and lets
 * its model go if it landed. The boot's load passes `clock` null: App watches the boot, from the
 * scene's code to its model taking the stage.
 */
export function startModelLoad<M extends HeldModel>(
  load: (onProgress: (fraction: number | null) => void, signal: AbortSignal) => Promise<M>,
  events: ModelLoadEvents<M>,
  clock: StallClock | null,
  ms: number = BOOT_STALL_MS,
): ModelLoadRun<M> {
  // Let go of, failed or stalled: the load says nothing more.
  let over = false;
  let landed: M | null = null;
  const download = new AbortController();
  const watch =
    clock &&
    watchStall(
      (part) => {
        over = true;
        download.abort();
        if (landed) events.abandon(landed);
        events.failed(new ModelStallError(part));
      },
      clock,
      ms,
      // The scene's code is here already: a change waits on its download from the first.
      'model',
    );
  load((fraction) => {
    if (over) return;
    watch?.progress(fraction);
    events.progress(fraction);
  }, download.signal).then(
    (model) => {
      // A model nobody waits for any more is never drawn.
      if (over) model.dispose();
      else {
        landed = model;
        events.landed(model);
      }
    },
    (error: unknown) => {
      if (over) return;
      over = true;
      watch?.stop();
      events.failed(error instanceof Error ? error : new Error(String(error)));
    },
  );
  return {
    compiled(model) {
      if (model === landed) watch?.stop();
    },
    cancel() {
      over = true;
      download.abort();
      watch?.stop();
    },
  };
}

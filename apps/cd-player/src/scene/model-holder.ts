import type { ModelId } from '../models';

/**
 * How the scene holds its models while it changes one for another (src/scene/PlayerScene.tsx).
 * React-free and three-free, generic over what it holds, so node tests drive it with stand-ins.
 */

/** What the holder needs of a model: its id, and a way to let it go. */
export interface HeldModel {
  readonly id: ModelId;
  dispose(): void;
}

/**
 * The model on show, and the next one: loaded, its shaders compiling before it takes the stage
 * (PlayerScene's Precompile).
 */
export interface Held<M extends HeldModel> {
  shown: M | null;
  next: M | null;
}

export const NOTHING_HELD: Held<never> = { shown: null, next: null };

export type HeldEvent<M extends HeldModel> =
  /** A load has come. */
  | { type: 'loaded'; model: M }
  /** The look has changed, and may name another model. */
  | { type: 'wanted' }
  /** `model`'s shaders are compiled. */
  | { type: 'compiled'; model: M }
  /** `model`'s change failed as it compiled (it stalled, src/scene/model-load.ts). */
  | { type: 'failed'; model: M };

export interface HeldStep<M extends HeldModel> {
  held: Held<M>;
  /** A model that was never shown, and never will be: disposed at once. */
  drop: M | null;
  /** The model a swap took off show: disposed once the swap is drawn, never before. */
  retire: M | null;
}

/**
 * What the scene holds after `event`, `wanted` being the model the look names now: a model the
 * look no longer names is never shown, and every model let go of is handed back to be disposed.
 */
export function stepHeld<M extends HeldModel>(
  held: Held<M>,
  event: HeldEvent<M>,
  wanted: ModelId,
): HeldStep<M> {
  const { shown, next } = held;
  const keep: HeldStep<M> = { held, drop: null, retire: null };
  switch (event.type) {
    case 'loaded':
      // Loaded for a look the visitor has since changed, or of the model already on show.
      if (event.model.id !== wanted || event.model.id === shown?.id) {
        return { ...keep, drop: event.model };
      }
      // A newer load replaces the one waiting.
      return { held: { shown, next: event.model }, drop: next, retire: null };
    case 'wanted':
      if (!next || next.id === wanted) return keep;
      return { held: { shown, next: null }, drop: next, retire: null };
    case 'compiled':
      // Replaced or dropped while it compiled, and disposed then.
      if (event.model !== next) return keep;
      if (next.id !== wanted) return { held: { shown, next: null }, drop: next, retire: null };
      return { held: { shown: next, next: null }, drop: null, retire: shown };
    case 'failed':
      // Only a next goes: a model already on show stays, and one let go of went then.
      if (event.model !== next) return keep;
      return { held: { shown, next: null }, drop: next, retire: null };
  }
}

/** Holds the scene's models through `stepHeld`, disposing each one it lets go of. */
export interface ModelHolder<M extends HeldModel> {
  loaded(model: M, wanted: ModelId): void;
  want(wanted: ModelId): void;
  compiled(model: M, wanted: ModelId): void;
  /** `model`'s change failed: if it is the next, it goes, never shown. */
  failed(model: M): void;
  /**
   * `model` has drawn its first frames: if it is the one on show, its swap is drawn and the models
   * taken off show go. A replaced model's own late frames let nothing go (the canvas may still be
   * drawing it).
   */
  settle(model: M): void;
  /** The scene goes, and everything held with it. It can hold again from nothing after. */
  release(): void;
}

/** `onChange` hears every change of what is held, which is what the scene renders. */
export function createModelHolder<M extends HeldModel>(
  onChange: (held: Held<M>) => void,
): ModelHolder<M> {
  let held: Held<M> = NOTHING_HELD;
  // Taken off show and drawn until the swap is: the holder cannot know when, the scene does.
  let retired: M[] = [];
  const apply = ({ held: after, drop, retire }: HeldStep<M>) => {
    drop?.dispose();
    if (retire) retired.push(retire);
    if (after === held) return;
    held = after;
    onChange(held);
  };
  return {
    loaded: (model, wanted) => apply(stepHeld(held, { type: 'loaded', model }, wanted)),
    want: (wanted) => apply(stepHeld(held, { type: 'wanted' }, wanted)),
    compiled: (model, wanted) => apply(stepHeld(held, { type: 'compiled', model }, wanted)),
    // The look plays no part: a failed next goes whatever it names.
    failed: (model) => apply(stepHeld(held, { type: 'failed', model }, model.id)),
    settle(model) {
      if (model !== held.shown) return;
      for (const each of retired) each.dispose();
      retired = [];
    },
    release() {
      for (const model of [...retired, held.shown, held.next]) model?.dispose();
      retired = [];
      if (held === NOTHING_HELD) return;
      held = NOTHING_HELD;
      onChange(held);
    },
  };
}

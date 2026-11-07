import type { ModelId } from './models';

/**
 * Which model the page keeps for the next visit, and which one a failed change goes back to, from
 * what the scene says of its stage (PlayerSceneProps.onStage, onModel). The scene loads a model
 * chosen while nothing is on its stage as the boot's, and one chosen once a model is on it as a
 * change, so the keeper follows the stage, not the boot's phase: between the boot's first swap and
 * its first frames the phase still says booting, and a model chosen then is a change. React-free
 * and three-free, so node tests drive it.
 */
export interface ModelKeeper {
  /**
   * The visitor chose `model`: kept at once while nothing is on the stage (the boot then loads it),
   * else once it is drawn (`drawn`), so a change that fails is never kept.
   */
  choose(model: ModelId): void;
  /** The stage holds `model` now; null, the scene has gone (a failure), and holds nothing. */
  stage(model: ModelId | null): void;
  /**
   * `model`'s first frames are drawn (onModel's `ready`): a model that took the stage in place of
   * another is kept now. The boot's own keeps nothing: it was kept as it was chosen, or it is the
   * one kept before.
   */
  drawn(model: ModelId): void;
  /** The model on the stage, which a failed change goes back to; null while it holds none. */
  readonly staged: ModelId | null;
}

/** `keep` saves a model for the next visit (src/persist.ts writeModel). */
export function createModelKeeper(keep: (model: ModelId) => void): ModelKeeper {
  let staged: ModelId | null = null;
  // A model that took the stage in place of another, kept once it is drawn.
  let pending: ModelId | null = null;
  return {
    choose(model) {
      if (staged === null) keep(model);
    },
    stage(model) {
      if (model === staged) return;
      pending = staged !== null && model !== null ? model : null;
      staged = model;
    },
    drawn(model) {
      if (model !== pending) return;
      pending = null;
      keep(model);
    },
    get staged() {
      return staged;
    },
  };
}

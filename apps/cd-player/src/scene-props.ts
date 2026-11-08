import type { SceneBridge } from './bridge';
import type { CameraChannel } from './camera-channel';
import type { Look } from './looks';
import type { ModelId } from './models';

/**
 * A model coming on show (PlayerSceneProps.onModel): its download, then on show or failed. A change
 * given up before it loads (the visitor went back to the model on show) gets no last report, so a
 * `loading` report holds only while its `model` is the one the look wants.
 */
export type ModelLoad =
  | { model: ModelId; status: 'loading'; fraction: number | null }
  | { model: ModelId; status: 'ready' }
  | { model: ModelId; status: 'failed' };

/** What the shell hands the lazily loaded scene. Three-free on purpose (src/ssr-graph.test.ts). */
export interface PlayerSceneProps {
  assetBase: string;
  bridge: SceneBridge;
  /** The shell's zoom and reset commands in, where the zoom is going out (the buttons). */
  camera: CameraChannel;
  /**
   * The visitor's look: the scene recolours the model in place when it changes, and loads the
   * model it names, keeping the one on show drawn until the new one can take its place.
   */
  look: Look;
  /** The first frames of the player are on screen. */
  onReady(): void;
  onFail(error: Error): void;
  /**
   * The GLB's download (src/scene/model.ts downloadModel): null as its request goes out, then for
   * each chunk 0–0.99, or null while its size is unknown (no Content-Length), and 1 at its end.
   * The boot's download only: a later change of model reports through `onModel`.
   */
  onProgress(fraction: number | null): void;
  /**
   * Each model as it comes on show: `ready` once its first frames are drawn, the boot's model
   * included. A change after the boot also reports its download (`loading`, its fraction as
   * `onProgress` would have it) and, when it never comes or goes BOOT_STALL_MS without a word over
   * its download and its compile, `failed`: the model before it stays. A change given up before it
   * loads reports nothing more (see ModelLoad).
   */
  onModel(load: ModelLoad): void;
  /**
   * The model on the scene's stage, as it takes it (compiled, before its first frames): the boot's,
   * then each change's as it swaps in, and null as the scene goes. Once a model is on it, a model
   * chosen is a change (`onModel`), which goes back to this one if it fails.
   */
  onStage(model: ModelId | null): void;
}

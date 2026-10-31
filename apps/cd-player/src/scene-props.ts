import type { SceneBridge } from './bridge';
import type { SkinId } from './skins';

/** What the shell hands the lazily loaded scene. Three-free on purpose (src/ssr-graph.test.ts). */
export interface PlayerSceneProps {
  assetBase: string;
  bridge: SceneBridge;
  /** The visitor's colourway: the scene recolours the model in place when it changes. */
  skin: SkinId;
  /** The first frames of the player are on screen. */
  onReady(): void;
  onFail(error: Error): void;
  /**
   * The GLB's download (src/scene/model.ts downloadModel): null as its request goes out, then for
   * each chunk 0–0.99, or null while its size is unknown (no Content-Length), and 1 at its end.
   */
  onProgress(fraction: number | null): void;
}

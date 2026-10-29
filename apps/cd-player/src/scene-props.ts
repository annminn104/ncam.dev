import type { SceneBridge } from './bridge';

/** What the shell hands the lazily loaded scene. Three-free on purpose (src/ssr-graph.test.ts). */
export interface PlayerSceneProps {
  assetBase: string;
  bridge: SceneBridge;
  /** The first frames of the player are on screen. */
  onReady(): void;
  onFail(error: Error): void;
}

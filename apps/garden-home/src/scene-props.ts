import type { Route } from './runtime';

export interface GardenSceneProps {
  route: Route;
  /** This remote's origin (lib/asset-url remoteBase): scene.json, the modules, the transcoder, ?bg= photos. */
  assetBase: string;
  /** The site route's floor buttons and hover label; capture mode leaves them out. */
  ui: boolean;
  /** The query read for ?t= ?quality= ?fps= ?debug= ?align= ?bg= (the page's, or capture's own). */
  search: string;
  /** Every slot settled and three frames drawn. */
  onReady(): void;
  /** No WebGL2, scene.json would not load, or the context was lost for good. */
  onFail(error: Error): void;
}

import { useEffect, useState, type ComponentType } from 'react';
import { SceneChunkError } from '../failure';
import type { GardenSceneProps } from '../scene-props';

interface Props {
  assetBase: string;
  /** The first frames are on screen: fade the canvas in. */
  live: boolean;
  onReady(): void;
  onFail(error: Error): void;
}

/**
 * The scene chunk, loaded here and nowhere earlier. The server build never names it:
 * import.meta.env.SSR folds to true there, and the import goes with its branch
 * (src/ssr-graph.test.ts).
 */
function loadGardenScene(): Promise<{ GardenScene: ComponentType<GardenSceneProps> }> {
  return import.meta.env.SSR
    ? Promise.reject(new Error('the scene never renders on the server'))
    : import('../scene/GardenScene');
}

export function SceneHost({ assetBase, live, onReady, onFail }: Props) {
  const [Scene, setScene] = useState<ComponentType<GardenSceneProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGardenScene().then(
      (module) => {
        if (!cancelled) setScene(() => module.GardenScene);
      },
      (error: unknown) => {
        if (!cancelled) onFail(new SceneChunkError(String(error)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [onFail]);

  return (
    // Invisible while booting, so deaf too: no drag, wheel or focus reaches the hidden scene or its floor buttons.
    <div className={live ? 'gh-scene is-live' : 'gh-scene'} inert={!live}>
      {Scene && (
        <Scene
          route="site"
          assetBase={assetBase}
          ui
          search={location.search}
          onReady={onReady}
          onFail={onFail}
        />
      )}
    </div>
  );
}

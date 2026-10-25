import { useEffect, useMemo, useState } from 'react';
import { GardenStartError, NO_WEBGL2 } from '../failure';
import { assetUrl } from '../lib/asset-url';
import { parseParams } from '../params';
import { onRelease } from '../release';
import { resolveRuntime } from '../runtime';
import type { GardenSceneProps } from '../scene-props';
import { DebugOverlay } from '../ui/DebugOverlay';
import { FloorSelector } from '../ui/FloorSelector';
import { HoverLabel } from '../ui/HoverLabel';
import { hasWebGL2 } from '../ui/webgl';
import { setTranscoderPath } from './loader';
import { loadScene, SCENE_PATH } from './loadScene';
import { releaseGardenScene, startCleanScene } from './release-scene';
import { SceneRoot } from './SceneRoot';
import type { SceneConfig } from './schema';

// The mount's disposer frees what this chunk keeps at module level (src/release.ts).
onRelease(releaseGardenScene);

/** The 3D scene with its site-route UI: what the shell boots, the wallpaper and capture views run. */
export function GardenScene({ route, assetBase, ui, search, onReady, onFail }: GardenSceneProps) {
  const params = useMemo(() => parseParams(search), [search]);
  const runtime = useMemo(
    () =>
      resolveRuntime(
        route,
        params,
        window.devicePixelRatio,
        window.matchMedia('(pointer: coarse)').matches,
      ),
    [route, params],
  );
  const sceneUrl = assetUrl(SCENE_PATH, assetBase);
  const sceneParams = useMemo(
    () => ({ ...params, bg: params.bg ? assetUrl(params.bg, assetBase) : null }),
    [params, assetBase],
  );
  const [config, setConfig] = useState<SceneConfig | null>(null);

  useEffect(() => {
    // A remount that beat the last scene's release (it waits for R3F's unmount) still starts clean.
    startCleanScene();
    if (!hasWebGL2()) {
      onFail(new GardenStartError(NO_WEBGL2));
      return;
    }
    setTranscoderPath(assetUrl('basis/', assetBase));
    let live = true;
    loadScene(sceneUrl).then(
      (loaded) => live && setConfig(loaded),
      (error: Error) => live && onFail(error),
    );
    return () => {
      live = false;
    };
  }, [sceneUrl, assetBase, onFail]);

  if (!config) return null;
  const site = runtime.route === 'site';
  return (
    <>
      <SceneRoot
        config={config}
        sceneUrl={sceneUrl}
        runtime={runtime}
        params={sceneParams}
        onFatal={onFail}
        onReady={onReady}
      />
      {site && ui && <HoverLabel />}
      {site && ui && <FloorSelector />}
      {params.debug && <DebugOverlay />}
    </>
  );
}

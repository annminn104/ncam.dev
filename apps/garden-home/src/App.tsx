import { useEffect, useMemo, useState } from 'react';
import { parseParams } from './params';
import { resolveRuntime } from './runtime';
import { loadScene, SCENE_URL } from './scene/loadScene';
import { SceneRoot } from './scene/SceneRoot';
import type { SceneConfig } from './scene/schema';
import { DebugOverlay } from './ui/DebugOverlay';
import { ErrorScreen } from './ui/ErrorScreen';
import { FloorSelector } from './ui/FloorSelector';
import { HoverLabel } from './ui/HoverLabel';
import { Poster } from './ui/Poster';
import { hasWebGL2 } from './ui/webgl';

export function App() {
  const params = useMemo(() => parseParams(window.location.search), []);
  const runtime = useMemo(
    () =>
      resolveRuntime(
        window.location.pathname,
        params,
        window.devicePixelRatio,
        window.matchMedia('(pointer: coarse)').matches,
      ),
    [params],
  );
  const webgl2 = useMemo(hasWebGL2, []);
  const [config, setConfig] = useState<SceneConfig | null>(null);
  const [fatal, setFatal] = useState<Error | null>(null);

  useEffect(() => {
    if (webgl2) loadScene(SCENE_URL).then(setConfig, setFatal);
  }, [webgl2]);

  if (!webgl2) return <Poster />;
  if (fatal) return import.meta.env.DEV ? <ErrorScreen error={fatal} /> : <Poster />;
  if (!config) return null;
  return (
    <>
      <SceneRoot config={config} runtime={runtime} params={params} onFatal={setFatal} />
      {runtime.route === 'site' && <HoverLabel />}
      {runtime.route === 'site' && <FloorSelector />}
      {params.debug && <DebugOverlay />}
    </>
  );
}

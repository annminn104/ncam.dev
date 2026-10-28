import { useCallback, useEffect, useReducer, useState } from 'react';
import { createLogger } from '@ncam/logger';
import { readAutoplaySignals, shouldAutoplay, whenSettled } from './autoplay';
import { bootReducer, INITIAL_BOOT } from './boot';
import { describeFailure } from './failure';
import { EnterButton } from './shell/EnterButton';
import { Hud } from './shell/Hud';
import { Poster } from './shell/Poster';
import { SceneHost } from './shell/SceneHost';

const log = createLogger({ scope: 'garden-home' });

/** The canvas's fade-in over the poster: `.gh-scene`'s transition in styles.css. */
const FADE_MS = 600;

export interface AppProps {
  /** This remote's origin (lib/asset-url remoteBase); never read on the server. */
  assetBase?: string;
}

export default function App({ assetBase = '' }: AppProps) {
  const [boot, dispatch] = useReducer(bootReducer, INITIAL_BOOT);
  const [posterGone, setPosterGone] = useState(false);
  const live = boot.phase === 'live';

  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const onReady = useCallback(() => dispatch({ type: 'ready' }), []);
  const onFail = useCallback((error: unknown) => {
    log.error('garden-home.boot-failed', { error: String(error) });
    dispatch({ type: 'fail', failure: describeFailure(error) });
  }, []);

  // On a hardware GPU the garden opens by itself once the page has settled; elsewhere the poster
  // waits for the visitor (src/autoplay.ts). `autostart` only ever leaves the poster.
  useEffect(
    () =>
      whenSettled(() => {
        if (shouldAutoplay(readAutoplaySignals())) dispatch({ type: 'autostart' });
      }),
    [],
  );

  // The poster stays under the canvas until the fade-in is over, and comes back with a failure.
  useEffect(() => {
    if (!live) {
      setPosterGone(false);
      return;
    }
    const id = setTimeout(() => setPosterGone(true), FADE_MS);
    return () => clearTimeout(id);
  }, [live]);

  const onPoster = boot.phase === 'poster' ? start : undefined;
  return (
    <div className="garden-home-root" onPointerDown={onPoster} onWheel={onPoster}>
      {!posterGone && <Poster />}
      {(boot.phase === 'booting' || live) && (
        <SceneHost assetBase={assetBase} live={live} onReady={onReady} onFail={onFail} />
      )}
      <Hud />
      <EnterButton phase={boot.phase} failure={boot.failure} onStart={start} />
    </div>
  );
}

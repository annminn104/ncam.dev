import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NoWebGLError, SceneChunkError } from '../failure';
import type { PlayerSceneProps } from '../scene-props';
import { hasWebGL2 } from '../webgl';

/**
 * The scene chunk, loaded here and nowhere earlier. The server build never names it:
 * import.meta.env.SSR folds to true there and the import goes with its branch (src/ssr-graph.test.ts).
 */
function loadPlayerScene(): Promise<{ PlayerScene: ComponentType<PlayerSceneProps> }> {
  return import.meta.env.SSR
    ? Promise.reject(new Error('the scene never renders on the server'))
    : import('../scene/PlayerScene');
}

/** A render-time throw inside the canvas (a shader, say) becomes a boot failure. */
class SceneBoundary extends Component<
  { onFail(error: Error): void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onFail(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props extends PlayerSceneProps {
  /** The first frames are on screen: fade the canvas in. */
  live: boolean;
}

export function SceneHost({ live, onFail, ...rest }: Props) {
  const [Scene, setScene] = useState<ComponentType<PlayerSceneProps> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPlayerScene().then(
      (module) => {
        if (cancelled) return;
        // Without WebGL 2 there is nothing to draw with and nothing to retry: no canvas is mounted.
        if (!hasWebGL2()) onFail(new NoWebGLError('this browser cannot make a WebGL 2 context'));
        else setScene(() => module.PlayerScene);
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
    // Invisible while booting, so deaf too: no pointer or focus reaches the hidden scene.
    <div className={live ? 'cdp-scene is-live' : 'cdp-scene'} inert={!live}>
      {Scene && (
        <SceneBoundary onFail={onFail}>
          <Scene {...rest} onFail={onFail} />
        </SceneBoundary>
      )}
    </div>
  );
}

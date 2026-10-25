import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createLogger } from '@ncam/logger';
import { bootReducer, failureMessage, INITIAL_BOOT, type EngineKey } from './boot';
import { EnterButton } from './components/EnterButton';
import { HelpBar } from './components/HelpBar';
import { Hud } from './components/Hud';
import { Poster } from './components/Poster';
import { SceneCanvas } from './components/SceneCanvas';
import { SettingsPanel } from './components/SettingsPanel';
import type { Engine } from './engine/engine';
import { DEFAULT_SETTINGS, type Settings } from './engine/settings';
import { takesText } from './keys';

const log = createLogger({ scope: 'mini-store' });

/** The canvas's fade-in over the poster: `.ms-scene`'s transition in styles/globals.css. */
const FADE_MS = 600;

/** Typing in a text field; a slider or checkbox in the settings panel is not. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    takesText(
      target.tagName,
      target instanceof HTMLInputElement ? target.type : null,
      target.isContentEditable,
    )
  );
}

export default function App() {
  const engineRef = useRef<Engine | null>(null);
  const [boot, dispatch] = useReducer(bootReducer, INITIAL_BOOT);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [fps, setFps] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const live = boot.phase === 'live';

  const patch = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);
  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const onReady = useCallback(() => dispatch({ type: 'ready' }), []);
  const onFail = useCallback((error: unknown) => {
    log.error('mini-store.boot-failed', { error: String(error) });
    dispatch({ type: 'fail', message: failureMessage(error) });
  }, []);
  const onCruiseChange = useCallback((on: boolean) => patch({ cruise: on }), [patch]);
  const runKey = useCallback((key: EngineKey) => {
    if (key === 'door') engineRef.current?.openDoor();
    else setSettings((s) => ({ ...s, cruise: !s.cruise }));
  }, []);

  // Shortcuts pressed while the engine booted run once it is live.
  useEffect(() => {
    if (!live || boot.queued.length === 0) return;
    for (const key of boot.queued) runKey(key);
    dispatch({ type: 'drain' });
  }, [live, boot.queued, runKey]);

  // The poster stays under the canvas until the fade-in is over.
  useEffect(() => {
    if (!live) return;
    const id = setTimeout(() => setPosterGone(true), FADE_MS);
    return () => clearTimeout(id);
  }, [live]);

  // C auto-orbit · H hide the overlay · O open the door · Esc stop orbiting.
  // Before the scene is live, O and C boot it and wait in the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.code === 'KeyH') setHidden((h) => !h);
      else if (e.code === 'Escape') patch({ cruise: false });
      else if (e.code === 'KeyO' || e.code === 'KeyC') {
        const key: EngineKey = e.code === 'KeyO' ? 'door' : 'cruise';
        if (live) runKey(key);
        else {
          dispatch({ type: 'start' });
          dispatch({ type: 'queue', key });
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [live, patch, runKey]);

  const onPoster = boot.phase === 'poster' ? start : undefined;
  return (
    <div
      className={hidden ? 'mini-store-root is-hidden' : 'mini-store-root'}
      onPointerDown={onPoster}
      onWheel={onPoster}
    >
      {!posterGone && <Poster />}
      {(boot.phase === 'booting' || live) && (
        <SceneCanvas
          settings={settings}
          engineRef={engineRef}
          live={live}
          onReady={onReady}
          onFail={onFail}
          onFps={setFps}
          onCruiseChange={onCruiseChange}
        />
      )}
      <Hud />
      {live ? (
        <SettingsPanel settings={settings} fps={fps} onChange={patch} />
      ) : (
        <EnterButton phase={boot.phase} error={boot.error} onStart={start} />
      )}
      <HelpBar />
    </div>
  );
}

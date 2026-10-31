import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createLogger } from '@ncam/logger';
import { readAutoplaySignals, shouldAutoplay, whenSettled } from './autoplay';
import { bootReducer, INITIAL_BOOT, watchStall, type StallClock, type StallWatch } from './boot';
import { createBridge } from './bridge';
import { BootStallError, describeFailure } from './failure';
import { remoteBase } from './lib/asset-url';
import { readLast, readSkin, restoreTarget, safeStorage, writeLast, writeSkin } from './persist';
import { createEmbedPlayer, type EmbedCallbacks } from './playback/embed-controller';
import type { EngineDeps, InitialData } from './playback/engine';
import { currentIndex } from './playback/sequencer';
import { usePlayerEngine } from './playback/usePlayerEngine';
import type { RouteController } from './route-controller';
import { collectionPath, parseRoute, routeCollection } from './routes';
import { Backdrop } from './shell/Backdrop';
import { EnterButton } from './shell/EnterButton';
import { Hud } from './shell/Hud';
import { LinkBar } from './shell/LinkBar';
import { Loader } from './shell/Loader';
import { NowPlaying } from './shell/NowPlaying';
import { SceneHost } from './shell/SceneHost';
import { Tracklist } from './shell/Tracklist';
import { DEFAULT_SKIN, skinById, type SkinId } from './skins';
import { canRetry, createSpotifyClient, requestErrorMessage } from './spotify/client';
import { linkErrorMessage, parseSpotifyLink } from './spotify/link';
import { backdropFor, loaderPercent, nowPlayingFor } from './view';

const log = createLogger({ scope: 'cd-player' });

/**
 * The canvas's fade-in, and the loader's fade-out with it: .cdp-scene's and .cdp-loader's
 * transitions in styles/app.css (styles/app-css.test.ts holds the three equal).
 */
const FADE_MS = 600;

/** The boot's stall watch runs on the page's own timers. */
const timeouts: StallClock = {
  after: (ms, done) => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  },
};

export interface AppProps {
  controller: RouteController;
  /** What the server render fetched (src/ssr-state.ts); null on a plain client mount. */
  initial?: InitialData | null;
  /**
   * This remote's origin (lib/asset-url remoteBase). It only names the proxy's base for the
   * requests made once mounted, never anything in the markup, so the server render leaves it out.
   */
  assetBase?: string;
}

export default function App({ controller, initial = null, assetBase = '' }: AppProps) {
  const route = useSyncExternalStore(
    controller.subscribe,
    controller.getRoute,
    controller.getRoute,
  );
  const parsed = parseRoute(route);
  const ref = routeCollection(parsed);
  const embedHost = useRef<HTMLDivElement>(null);
  const [deps] = useState<EngineDeps>(() => ({
    client: createSpotifyClient(remoteBase(assetBase)),
    bridge: createBridge(),
    createPlayer: (uri: string, callbacks: EmbedCallbacks) => {
      const host = embedHost.current;
      if (!host) return Promise.reject(new Error('the now-playing card is not mounted'));
      host.replaceChildren();
      const slot = host.ownerDocument.createElement('div');
      host.appendChild(slot);
      return createEmbedPlayer(slot, uri, callbacks);
    },
  }));
  const { engine, snapshot } = usePlayerEngine(deps, initial, ref);
  // The player's colourway (src/skins.ts). Blush on the server and on the first client render, so
  // the markup matches; the visitor's saved one right after hydration (the accent is Blush from
  // the first paint until then; the scene mounts later and boots in the saved one); saved on each
  // change. A skin is never in the URL.
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);
  useEffect(() => {
    setSkin(readSkin(safeStorage()));
  }, []);
  const changeSkin = useCallback((id: SkinId) => {
    setSkin(id);
    writeSkin(safeStorage(), id);
  }, []);
  const look = skinById(skin);
  const [boot, dispatchBoot] = useReducer(bootReducer, INITIAL_BOOT);
  // The page settled and the scene did not start by itself (a software rasteriser, reduced
  // motion): "Open the player" stands where the loader was until the visitor starts it.
  const [manual, setManual] = useState(false);
  // What the loader's count shows while the scene boots (view.ts loaderPercent): the GLB's
  // download as a whole percent, or null while its size is unknown. It is set only when it
  // changes, so the download's chunks re-render the page (the tracklist among it) once per percent
  // at most.
  const [percent, setPercent] = useState<number | null>(null);
  const shownPercent = useRef<number | null>(null);
  const showPercent = useCallback((next: number | null) => {
    if (next === shownPercent.current) return;
    shownPercent.current = next;
    setPercent(next);
  }, []);
  const [loaderGone, setLoaderGone] = useState(false);
  const live = boot.phase === 'live';
  // "Open the player" and "Try again". A failure that says `reload` (a scene chunk that would not
  // load) cannot be retried in place, so its button, "Reload the page", reloads the page.
  const reload = boot.failure?.reload === true;
  const start = useCallback(() => {
    if (reload) {
      window.location.reload();
      return;
    }
    // "Try again" boots from nothing: its loader never shows the failed boot's count, nor a chunk
    // of its download that came after the failure, before its scene let go of the load.
    showPercent(null);
    dispatchBoot({ type: 'start' });
  }, [reload, showPercent]);
  const onReady = useCallback(() => dispatchBoot({ type: 'ready' }), []);
  const onFail = useCallback((error: unknown) => {
    log.error('cd-player.scene-failed', { error: String(error) });
    dispatchBoot({ type: 'fail', failure: describeFailure(error) });
  }, []);

  // A boot that goes quiet, on the scene's code or on the model's download, fails like any other,
  // so the loader never spins for ever (boot.ts watchStall): the watch runs while the phase is
  // `booting` and hears every progress event the scene reports.
  const stall = useRef<StallWatch | null>(null);
  const booting = boot.phase === 'booting';
  useEffect(() => {
    if (!booting) return;
    const watch = watchStall((part) => onFail(new BootStallError(part)), timeouts);
    stall.current = watch;
    return () => {
      watch.stop();
      if (stall.current === watch) stall.current = null;
    };
  }, [booting, onFail]);
  const onProgress = useCallback(
    (fraction: number | null) => {
      stall.current?.progress(fraction);
      showPercent(loaderPercent(fraction));
    },
    [showPercent],
  );

  // On a hardware GPU the player opens by itself once the page has settled; elsewhere the page
  // waits for the visitor (src/autoplay.ts). `autostart` only ever leaves `waiting`.
  useEffect(
    () =>
      whenSettled(() => {
        if (shouldAutoplay(readAutoplaySignals())) dispatchBoot({ type: 'autostart' });
        else setManual(true);
      }),
    [],
  );

  // The loader fades out with the canvas's fade-in and goes once it is over; the next boot brings
  // it back.
  useEffect(() => {
    if (!live) {
      setLoaderGone(false);
      return;
    }
    const id = setTimeout(() => setLoaderGone(true), FADE_MS);
    return () => clearTimeout(id);
  }, [live]);

  /**
   * A visitor's action: it also starts the scene while it waits (the reducer ignores `autostart`
   * anywhere else, so a failed boot is retried by "Try again" alone, never by another press).
   */
  const act = useCallback(
    (event: Parameters<typeof engine.user>[0]) => {
      dispatchBoot({ type: 'autostart' });
      engine.user(event);
    },
    [engine],
  );

  // The bar's own error, a link that did not parse or load, with the input to load again when
  // trying again may help (Spotify or the proxy did not answer).
  const [linkError, setLinkError] = useState<{ message: string; retry: string | null } | null>(
    null,
  );
  const [linkBusy, setLinkBusy] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  const restored = useRef(false);

  // The first time this App is shown, `/` comes back to the visitor's own collection. Only that first
  // check counts, navigating or not: Back to `/` reaches the same App as a route update, not a
  // remount, and must stay on `/` instead of bouncing forward. A fresh mount (the host opening the
  // project again) looks again.
  useEffect(() => {
    const target = restoreTarget(parsed.view, readLast(safeStorage()), restored.current);
    restored.current = true;
    if (target) controller.navigate(collectionPath(target));
  }, [controller, parsed.view]);

  const loadLink = useCallback(
    async (input: string) => {
      const link = parseSpotifyLink(input);
      if (!link.ok) {
        setLinkError({ message: linkErrorMessage(link.reason), retry: null });
        return;
      }
      setLinkError(null);
      setLinkBusy(true);
      try {
        await deps.client.collection(link.ref);
        writeLast(safeStorage(), link.ref);
        controller.navigate(collectionPath(link.ref));
      } catch (error) {
        setLinkError({
          message: requestErrorMessage(error, link.ref.type),
          retry: canRetry(error) ? input : null,
        });
      } finally {
        setLinkBusy(false);
      }
    },
    [controller, deps.client],
  );

  // Space plays or pauses, N and P change tracks; never while typing, and a held key is one press.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (target?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
      // Space is kept from scrolling the page even while it repeats.
      if (event.code === 'Space') event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space') act({ type: 'TOGGLE' });
      else if (event.key === 'n' || event.key === 'N') act({ type: 'NEXT' });
      else if (event.key === 'p' || event.key === 'P') act({ type: 'PREV' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  const backdrop = backdropFor(snapshot);
  // A first load that failed leaves nothing to show: the tracklist's empty shelf says why, with
  // Retry, and the bar does not say it again. (A failed change of collection keeps the one shown,
  // and its message stays in the bar.)
  const shelfError = !snapshot.collection && !snapshot.loading ? snapshot.error : null;
  // On a phone the sheet opens by itself, once per failure, to show the empty shelf; the Tracks
  // toggle then closes and opens it as usual. Every failure is a new error object, so Retry failing
  // again opens it again. The state is adjusted while rendering: the error is null on the server and
  // on the first client render, so the markup is the same.
  const [shelfSeen, setShelfSeen] = useState<typeof shelfError>(null);
  if (shelfError !== shelfSeen) {
    setShelfSeen(shelfError);
    if (shelfError) setTracksOpen(true);
  }
  const retryInput = linkError?.retry ?? null;
  // The loader holds the scene's place while the page settles, while the scene boots and while the
  // canvas fades in; "Open the player" or the failure takes it otherwise.
  const showLoader =
    (boot.phase === 'waiting' && !manual) || boot.phase === 'booting' || (live && !loaderGone);
  return (
    <div
      className="cdp-root"
      // The skin's accent, read by every accent use in styles/app.css.
      style={{ '--cdp-accent': look.accent, '--cdp-on-accent': look.onAccent } as CSSProperties}
    >
      <Backdrop artUrl={backdrop.artUrl} palette={backdrop.palette} />
      <LinkBar
        collection={snapshot.collection}
        loading={snapshot.loading || linkBusy}
        failed={shelfError !== null}
        error={linkError?.message ?? (shelfError ? null : (snapshot.error?.message ?? null))}
        onRetry={retryInput === null ? undefined : () => void loadLink(retryInput)}
        onSubmit={(input) => void loadLink(input)}
        skin={skin}
        onSkin={changeSkin}
      />
      {/* The player's own place: the canvas fills it, and no panel stands over it. */}
      <div className="cdp-stage">
        {(boot.phase === 'booting' || live) && (
          <SceneHost
            assetBase={remoteBase(assetBase)}
            bridge={deps.bridge}
            skin={skin}
            live={live}
            onReady={onReady}
            onFail={onFail}
            onProgress={onProgress}
          />
        )}
        {/* After the scene layer, so it draws over the invisible canvas and fades out with it. */}
        {showLoader && <Loader percent={percent} />}
        <Hud />
        {!showLoader && <EnterButton phase={boot.phase} failure={boot.failure} onStart={start} />}
      </div>
      {/* What plays over the tracklist: a column beside the stage, the phone's foot. */}
      <div className="cdp-side">
        <NowPlaying
          now={nowPlayingFor(snapshot)}
          status={snapshot.seq.status}
          positionMs={snapshot.seq.positionMs}
          durationMs={snapshot.seq.durationMs}
          repeat={snapshot.seq.repeat}
          shuffle={snapshot.seq.shuffle}
          embed={snapshot.embed}
          hint={snapshot.hint}
          embedRef={embedHost}
          onPrev={() => act({ type: 'PREV' })}
          onToggle={() => act({ type: 'TOGGLE' })}
          onNext={() => act({ type: 'NEXT' })}
          onStop={() => act({ type: 'STOP' })}
          onRepeat={() => act({ type: 'TOGGLE_REPEAT' })}
          // The seed the deck's MODE key sends (PlayerEngine.onAction).
          onShuffle={() => act({ type: 'TOGGLE_SHUFFLE', seed: Date.now() })}
          onSeek={(ms) => act({ type: 'SEEK', ms })}
        />
        <Tracklist
          tracks={snapshot.seq.tracks}
          currentIndex={currentIndex(snapshot.seq)}
          status={snapshot.seq.status}
          // The visitor's to open and close; an empty shelf opens it once per failure (above).
          open={tracksOpen}
          failure={
            shelfError && {
              message: shelfError.message,
              onRetry: shelfError.retry ? () => engine.open(ref) : undefined,
            }
          }
          onToggle={() => setTracksOpen((open) => !open)}
          onSelect={(index) => {
            setTracksOpen(false);
            act({ type: 'SELECT', index });
          }}
        />
      </div>
    </div>
  );
}

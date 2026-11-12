import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createLogger } from '@ncam/logger';
import { readAutoplaySignals, shouldAutoplay, whenSettled } from './autoplay';
import { bootReducer, INITIAL_BOOT, PAGE_TIMERS, watchStall, type StallWatch } from './boot';
import { createBridge } from './bridge';
import { createCameraChannel } from './camera-channel';
import { BootStallError, describeFailure } from './failure';
import { keyCommand } from './keys';
import { remoteBase } from './lib/asset-url';
import { createLinkLoader, IDLE_LINK, type LinkState } from './link-loader';
import { DEFAULT_LOOK_STATE, lookAccent, lookOf, type LookState } from './looks';
import { createModelKeeper } from './model-keeper';
import type { ModelId } from './models';
import {
  LOOK_SCRIPT,
  readLast,
  readLookState,
  restoreTarget,
  safeStorage,
  writeClearLook,
  writeDeckLook,
  writePersonal,
  writeLast,
  writeModel,
  writeSkin,
} from './persist';
import { createEmbedPlayer, type EmbedCallbacks } from './playback/embed-controller';
import type { EngineDeps, InitialData } from './playback/engine';
import { currentIndex } from './playback/sequencer';
import { usePlayerEngine } from './playback/usePlayerEngine';
import type { RouteController } from './route-controller';
import {
  collectionPath,
  parseRoute,
  routeCollection,
  sameCollection,
  type CollectionRef,
} from './routes';
import type { ModelLoad } from './scene-props';
import { Backdrop } from './shell/Backdrop';
import { EnterButton } from './shell/EnterButton';
import { Hud } from './shell/Hud';
import { LinkBar } from './shell/LinkBar';
import { Loader } from './shell/Loader';
import { NowPlaying } from './shell/NowPlaying';
import { SceneHost } from './shell/SceneHost';
import { Tracklist } from './shell/Tracklist';
import { ZoomControls } from './shell/ZoomControls';
import { createSpotifyClient } from './spotify/client';
import { linkErrorMessage, parseSpotifyLink } from './spotify/link';
import {
  accentModelFor,
  backdropFor,
  loaderPercent,
  nowPlayingFor,
  pickerLoad,
  sameLoadPercent,
} from './view';

const log = createLogger({ scope: 'cd-player' });

/**
 * The canvas's fade-in, and the loader's fade-out with it: .cdp-scene's and .cdp-loader's
 * transitions in styles/app.css (styles/app-css.test.ts holds the three equal).
 */
const FADE_MS = 600;

export interface AppProps {
  controller: RouteController;
  /** What the server render fetched (src/ssr-state.ts); null on a plain client mount. */
  initial?: InitialData | null;
  /**
   * This remote's origin (lib/asset-url remoteBase). It only names the proxy's base for the
   * requests made once mounted, never anything in the markup, so the server render leaves it out.
   */
  assetBase?: string;
  /**
   * The look of the first render, where it is known: `mount()` reads the saved one, since a client
   * render has no server markup to match. Without it the first render is the suitcase in Blush, as
   * the server's markup and its hydration must agree, and the root opens with LOOK_SCRIPT, which
   * paints the saved look's accent on that markup as the browser parses it (a copy React renders
   * on the client would never run, and React warns of one).
   */
  initialLook?: LookState;
}

export default function App({ controller, initial = null, assetBase = '', initialLook }: AppProps) {
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
  // The scene camera's line (src/camera-channel.ts): the zoom buttons and keys in, the zoom's ends
  // out. Nothing hears a command while no scene runs.
  const [camera] = useState(createCameraChannel);
  const [boot, dispatchBoot] = useReducer(bootReducer, INITIAL_BOOT);
  // The player's look (src/looks.ts): the model, the suitcase's skin and the Clear model's colours.
  // The suitcase in Blush on the server and on the first render of a hydration, so the markup
  // matches; the visitor's saved one right after it (LOOK_SCRIPT has already painted its accent on
  // the server's markup; the scene mounts later and boots in it); saved on each change, but a model
  // chosen once a model is on the scene's stage only when it comes on show (the keeper, below). The
  // scene gets the chosen look, so the next model swaps in in its own colours; the page wears the
  // colours of the model on show (`accent`, below). A look is never in the URL.
  const [lookState, setLookState] = useState<LookState>(initialLook ?? DEFAULT_LOOK_STATE);
  useEffect(() => {
    setLookState(readLookState(safeStorage()));
  }, []);
  // The model the visitor last chose, which the look goes back from when a change fails: the picker
  // speaks of this one (pickerLoad).
  const [askedModel, setAskedModel] = useState<ModelId>((initialLook ?? DEFAULT_LOOK_STATE).model);
  useEffect(() => {
    setAskedModel(readLookState(safeStorage()).model);
  }, []);
  // Which model is kept for the next visit, and which one a failed change goes back to: the
  // keeper (model-keeper.ts) follows the scene's stage (onStage, below), not the phase, as the
  // scene does when it tells the boot's load from a change's.
  const [keeper] = useState(() => createModelKeeper((model) => writeModel(safeStorage(), model)));
  const changeLook = useCallback(
    (next: LookState) => {
      setLookState(next);
      setAskedModel(next.model);
      const storage = safeStorage();
      writeSkin(storage, next.skin);
      writeClearLook(storage, next.clear);
      writeDeckLook(storage, next.deck);
      writePersonal(storage, next.personal);
      // Kept at once while nothing is on the stage (the boot loads it), else once it is on show.
      keeper.choose(next.model);
    },
    [keeper],
  );
  // Once per change: the scene recolours its model whenever `look` is a new object, and App renders
  // on every playback, progress and boot update.
  const look = useMemo(() => lookOf(lookState), [lookState]);
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
  // The model on show, as the scene reports it (onModel, the boot's model included). What the
  // picker says of a change is set only when it says something new: a download's chunks once per
  // whole percent, as the loader's count is (a size still unknown as it comes). A model on show is
  // noted, and the keeper keeps it when a change brought it (the boot's own keeps nothing: it was
  // kept as it was chosen). The page wears the model on show: a model chosen while the scene is
  // live turns it in the render that its `ready` arrives. A change that fails goes back to the
  // model on the stage, which never turned the page, even when the boot's model is not drawn yet.
  const [modelLoad, setModelLoad] = useState<ModelLoad | null>(null);
  const shownLoad = useRef<ModelLoad | null>(null);
  const [onShow, setOnShow] = useState<ModelId | null>(null);
  // The page's accent: the model on show's colours once the scene is live, else the chosen model's
  // (nothing is on the stage, the boot loads it, and LOOK_SCRIPT has painted the saved one). Colour
  // changes within the model on show turn the page at once.
  const accent = useMemo(
    () =>
      lookAccent(lookOf({ ...lookState, model: accentModelFor(live, onShow, lookState.model) })),
    [lookState, live, onShow],
  );
  const onModel = useCallback(
    (load: ModelLoad) => {
      if (!sameLoadPercent(shownLoad.current, load)) {
        shownLoad.current = load;
        setModelLoad(load);
      }
      if (load.status === 'ready') {
        setOnShow(load.model);
        keeper.drawn(load.model);
      }
      if (load.status === 'failed') {
        const back = keeper.staged;
        if (back) setLookState((state) => ({ ...state, model: back }));
      }
    },
    [keeper],
  );

  // A boot that goes quiet, on the scene's code, on the model's download or on its parse and
  // compile, fails like any other, so the loader never spins for ever (boot.ts watchStall): the
  // watch runs while the phase is `booting`, hears every progress event the scene reports, and
  // ends once the boot's model takes the stage (onStage).
  const stall = useRef<StallWatch | null>(null);
  const booting = boot.phase === 'booting';
  useEffect(() => {
    if (!booting) return;
    const watch = watchStall((part) => onFail(new BootStallError(part)), PAGE_TIMERS);
    stall.current = watch;
    return () => {
      watch.stop();
      if (stall.current === watch) stall.current = null;
    };
  }, [booting, onFail]);
  // The scene's stage, the moment the holder changes it: the keeper follows it, and once the
  // boot's model is on it the boot waits on its first frames alone, which a hidden page never
  // draws, so its stall watch ends.
  const onStage = useCallback(
    (model: ModelId | null) => {
      keeper.stage(model);
      if (model !== null) stall.current?.stop();
    },
    [keeper],
  );
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

  // The collections the visitor chooses, a pasted link or a preset (src/link-loader.ts): the one
  // loading, and the bar's own error with what Retry loads again. A load that lands once this App
  // has gone, or once the page has moved on, is dropped.
  const [link, setLink] = useState<LinkState>(IDLE_LINK);
  const [loader] = useState(() =>
    createLinkLoader(
      {
        client: deps.client,
        controller,
        save: (next) => writeLast(safeStorage(), next),
        open: (next) => engine.open(next),
      },
      setLink,
    ),
  );
  useEffect(() => {
    loader.start();
    return loader.stop;
  }, [loader]);
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
    (input: string) => {
      const pasted = parseSpotifyLink(input);
      if (pasted.ok) void loader.load(pasted.ref, 'link');
      else loader.refuse(linkErrorMessage(pasted.reason));
    },
    [loader],
  );

  // Space plays or pauses, N and P change tracks, + and - zoom and 0 resets the view (src/keys.ts);
  // never with Ctrl, ⌘ or Alt (Ctrl and + is the browser's zoom), never while typing or on a
  // focused control, and a held key is one press. The view's keys, like its buttons, wait for the
  // live scene: the camera listens while the scene still boots unseen, which would come live zoomed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (target?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
      const command = keyCommand(event);
      if (!command) return;
      // Space is kept from scrolling the page even while it repeats.
      if (command === 'toggle') event.preventDefault();
      if (event.repeat) return;
      if (command === 'toggle') act({ type: 'TOGGLE' });
      else if (command === 'next') act({ type: 'NEXT' });
      else if (command === 'prev') act({ type: 'PREV' });
      else if (live) camera.send(command);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, camera, live]);

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
  const linkError = link.error;
  const retry = linkError?.retry ?? null;
  // The collection on show, as the presets mark it: what the page shows, not the route, which may
  // name one that failed or is still loading. The server and the first client render agree on it.
  const shown: CollectionRef | null = snapshot.collection && {
    type: snapshot.collection.type,
    id: snapshot.collection.id,
  };
  // The loader holds the scene's place while the page settles, while the scene boots and while the
  // canvas fades in; "Open the player" or the failure takes it otherwise.
  const showLoader =
    (boot.phase === 'waiting' && !manual) || boot.phase === 'booting' || (live && !loaderGone);
  return (
    <div
      className="cdp-root"
      // The look's accent, read by every accent use in styles/app.css.
      style={{ '--cdp-accent': accent.accent, '--cdp-on-accent': accent.onAccent } as CSSProperties}
    >
      {/* The saved look's accent, painted as the browser parses the server's markup: first, so it
          runs before anything of the root is drawn. */}
      {initialLook === undefined && <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />}
      <Backdrop artUrl={backdrop.artUrl} />
      <LinkBar
        collection={snapshot.collection}
        loading={snapshot.loading || link.pending !== null}
        failed={shelfError !== null}
        error={linkError?.message ?? (shelfError ? null : (snapshot.error?.message ?? null))}
        // Only a pasted link's own failure is the field's; a preset's or the engine's is not.
        invalid={linkError?.from === 'link'}
        onRetry={retry && linkError ? () => void loader.load(retry, linkError.from) : undefined}
        onSubmit={loadLink}
        look={lookState}
        onLook={changeLook}
        modelLoad={pickerLoad(modelLoad, askedModel)}
        current={shown}
        busy={link.pending}
        // The collection on show is already there: pressing its preset does nothing.
        onPick={(next) => {
          if (!sameCollection(next, shown)) void loader.load(next, 'preset');
        }}
      />
      {/* The player's own place: the canvas fills it, and no panel stands over it. */}
      <div className="cdp-stage">
        {(boot.phase === 'booting' || live) && (
          <SceneHost
            assetBase={remoteBase(assetBase)}
            bridge={deps.bridge}
            camera={camera}
            look={look}
            live={live}
            onReady={onReady}
            onFail={onFail}
            onProgress={onProgress}
            onModel={onModel}
            onStage={onStage}
          />
        )}
        {/* After the scene layer, so it draws over the invisible canvas and fades out with it. */}
        {showLoader && <Loader percent={percent} />}
        <Hud camera={camera} />
        {/* Only once the scene is live, so never in the server's markup or the first paint. */}
        {live && <ZoomControls camera={camera} />}
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

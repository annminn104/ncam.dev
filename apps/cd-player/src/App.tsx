import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createBridge } from './bridge';
import { remoteBase } from './lib/asset-url';
import { readLast, restoreTarget, safeStorage, writeLast } from './persist';
import { createEmbedPlayer, type EmbedCallbacks } from './playback/embed-controller';
import type { EngineDeps, InitialData } from './playback/engine';
import { currentIndex } from './playback/sequencer';
import { usePlayerEngine } from './playback/usePlayerEngine';
import type { RouteController } from './route-controller';
import { collectionPath, parseRoute, routeCollection } from './routes';
import { Backdrop } from './shell/Backdrop';
import { Hud } from './shell/Hud';
import { LinkBar } from './shell/LinkBar';
import { NowPlaying } from './shell/NowPlaying';
import { Poster } from './shell/Poster';
import { Tracklist } from './shell/Tracklist';
import { createSpotifyClient, requestErrorMessage } from './spotify/client';
import { linkErrorMessage, parseSpotifyLink } from './spotify/link';
import { backdropFor, nowPlayingFor } from './view';

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
  const [linkError, setLinkError] = useState<string | null>(null);
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
        setLinkError(linkErrorMessage(link.reason));
        return;
      }
      setLinkError(null);
      setLinkBusy(true);
      try {
        await deps.client.collection(link.ref);
        writeLast(safeStorage(), link.ref);
        controller.navigate(collectionPath(link.ref));
      } catch (error) {
        setLinkError(requestErrorMessage(error));
      } finally {
        setLinkBusy(false);
      }
    },
    [controller, deps.client],
  );

  // Space plays or pauses, N and P change tracks; never while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (target?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        engine.user({ type: 'TOGGLE' });
      } else if (event.key === 'n' || event.key === 'N') engine.user({ type: 'NEXT' });
      else if (event.key === 'p' || event.key === 'P') engine.user({ type: 'PREV' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  const backdrop = backdropFor(snapshot);
  return (
    <div className="cdp-root">
      <Backdrop artUrl={backdrop.artUrl} palette={backdrop.palette} />
      <Poster />
      <LinkBar
        collection={snapshot.collection}
        loading={snapshot.loading || linkBusy}
        error={linkError ?? snapshot.error}
        onSubmit={(input) => void loadLink(input)}
      />
      <Tracklist
        tracks={snapshot.seq.tracks}
        currentIndex={currentIndex(snapshot.seq)}
        status={snapshot.seq.status}
        open={tracksOpen}
        onToggle={() => setTracksOpen((open) => !open)}
        onSelect={(index) => {
          setTracksOpen(false);
          engine.user({ type: 'SELECT', index });
        }}
      />
      <NowPlaying
        now={nowPlayingFor(snapshot)}
        status={snapshot.seq.status}
        positionMs={snapshot.seq.positionMs}
        durationMs={snapshot.seq.durationMs}
        embed={snapshot.embed}
        hint={snapshot.hint}
        embedRef={embedHost}
        onPrev={() => engine.user({ type: 'PREV' })}
        onToggle={() => engine.user({ type: 'TOGGLE' })}
        onNext={() => engine.user({ type: 'NEXT' })}
      />
      <Hud />
    </div>
  );
}

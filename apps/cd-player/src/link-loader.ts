import type { RouteController } from './route-controller';
import { collectionPath, type CollectionRef } from './routes';
import { canRetry, requestErrorMessage, type SpotifyClient } from './spotify/client';

/** Where a choice of collection came from: the pasted link's field, or a preset. */
export type LinkSource = 'link' | 'preset';

/** Why the visitor's last choice of collection did not load, said under the link field. */
export interface LinkError {
  message: string;
  /** What Retry loads again, where trying again may help (Spotify or the proxy did not answer). */
  retry: CollectionRef | null;
  /** Whose failure it is: a pasted link's (refused, or its collection would not load) marks the
   *  field invalid; a preset's does not. Retry loads from the same source. */
  from: LinkSource;
}

/** What the link bar shows of the collections the visitor chose: a pasted link or a preset. */
export interface LinkState {
  /** The collection being fetched. */
  pending: CollectionRef | null;
  error: LinkError | null;
}

export const IDLE_LINK: LinkState = { pending: null, error: null };

export interface LinkLoaderDeps {
  client: Pick<SpotifyClient, 'collection'>;
  controller: Pick<RouteController, 'getRoute' | 'navigate'>;
  /** Keeps a collection as the visitor's last (persist.ts writeLast). */
  save(ref: CollectionRef): void;
  /**
   * Opens it on the page (the engine's `open`): navigating alone would not, where the route
   * already named it (a load of it that failed), as the page follows the route's collection.
   */
  open(ref: CollectionRef): void;
}

export interface LinkLoader {
  /**
   * Loads a collection the visitor chose: fetched first, then saved as their last, navigated to
   * and opened, so a failure leaves the page where it was. One load runs at a time, and a choice
   * made meanwhile is dropped. So is a load that lands once the page has moved on (Back, the host
   * leaving the project) or the App has gone, failed or not: saving and navigating then would
   * undo the visitor's own move.
   */
  load(ref: CollectionRef, from: LinkSource): Promise<void>;
  /** A pasted link that is not a playlist or an album: its message, and nothing to retry. */
  refuse(message: string): void;
  /** The App is shown (StrictMode starts it again after stopping it), or gone. */
  start(): void;
  stop(): void;
}

/** The loads behind the link bar, outside React; `onChange` hears each state while started. */
export function createLinkLoader(
  deps: LinkLoaderDeps,
  onChange: (state: LinkState) => void,
): LinkLoader {
  let state = IDLE_LINK;
  let started = true;
  const set = (next: LinkState) => {
    state = next;
    if (started) onChange(next);
  };
  return {
    async load(ref, from) {
      if (state.pending) return;
      const route = deps.controller.getRoute();
      const movedOn = () => !started || deps.controller.getRoute() !== route;
      set({ pending: ref, error: null });
      try {
        await deps.client.collection(ref);
      } catch (error) {
        if (movedOn()) {
          set(IDLE_LINK);
          return;
        }
        set({
          pending: null,
          error: {
            message: requestErrorMessage(error, ref.type),
            retry: canRetry(error) ? ref : null,
            from,
          },
        });
        return;
      }
      set(IDLE_LINK);
      if (movedOn()) return;
      deps.save(ref);
      deps.controller.navigate(collectionPath(ref));
      deps.open(ref);
    },
    refuse(message) {
      set({ pending: null, error: { message, retry: null, from: 'link' } });
    },
    start() {
      started = true;
    },
    stop() {
      started = false;
    },
  };
}

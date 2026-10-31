import type { RouteController } from './route-controller';
import { collectionPath, type CollectionRef } from './routes';
import { canRetry, requestErrorMessage, type SpotifyClient } from './spotify/client';

/** Why the visitor's last choice of collection did not load, said under the link field. */
export interface LinkError {
  message: string;
  /** What Retry loads again, where trying again may help (Spotify or the proxy did not answer). */
  retry: CollectionRef | null;
  /** The pasted link was at fault, or its collection would not load: the field is marked invalid. */
  field: boolean;
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
}

export interface LinkLoader {
  /**
   * Loads a collection the visitor chose: fetched first, then saved as their last and navigated to,
   * so a failure leaves the page where it was. One load runs at a time, and a choice made meanwhile
   * is dropped. So is a load that lands once the page has moved on (Back, the host leaving the
   * project) or the App has gone: saving and navigating then would undo the visitor's own move.
   */
  load(ref: CollectionRef, from: 'link' | 'preset'): Promise<void>;
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
      set({ pending: ref, error: null });
      try {
        await deps.client.collection(ref);
      } catch (error) {
        set({
          pending: null,
          error: {
            message: requestErrorMessage(error, ref.type),
            retry: canRetry(error) ? ref : null,
            field: from === 'link',
          },
        });
        return;
      }
      set(IDLE_LINK);
      if (!started || deps.controller.getRoute() !== route) return;
      deps.save(ref);
      deps.controller.navigate(collectionPath(ref));
    },
    refuse(message) {
      set({ pending: null, error: { message, retry: null, field: true } });
    },
    start() {
      started = true;
    },
    stop() {
      started = false;
    },
  };
}

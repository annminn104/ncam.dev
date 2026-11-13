import type { PlayerAction } from './actions';
import type { Status } from './playback/sequencer';

/**
 * The only line between the app (DOM, playback) and the lazily loaded scene: the app publishes a
 * view, the scene changes discs when asked and reports what was pressed. Three-free, so the shell
 * and the server render can hold one.
 */
export interface TrackView {
  id: string;
  title: string;
  artists: string;
  /** The album art (booklet, backdrop). */
  artUrl: string | null;
  /** The first artist's photo, printed on the disc; the album art when there is none. */
  artistUrl: string | null;
}

export interface SceneView {
  /** `key` is the collection's `type:id`: what the Deck's print is seeded by. */
  collection: { name: string; subtitle: string; key: string } | null;
  /** The track in the player (or arriving), null before the first play. */
  current: TrackView | null;
  /**
   * The next playable tracks in play order, at most five (`UPCOMING` in src/view.ts): rack slot
   * `i` in the lid holds `upcoming[i]`.
   */
  upcoming: TrackView[];
  /** 1-based; 0 before the first play. */
  trackNo: number;
  total: number;
  status: Status;
  /** Stop was pressed and the track waits, paused, at its start (the sequencer's `stopped`). */
  stopped: boolean;
  positionMs: number;
  durationMs: number;
}

export const EMPTY_VIEW: SceneView = {
  collection: null,
  current: null,
  upcoming: [],
  trackNo: 0,
  total: 0,
  status: 'idle',
  stopped: false,
  positionMs: 0,
  durationMs: 0,
};

/**
 * Runs the CD change for `to` and resolves once the disc is seated. It must always settle, by
 * resolving or rejecting, including when the scene is torn down mid-change: the engine waits for
 * it, and a rejection counts as seated (the music starts even if the animation failed), so a
 * promise that never settles leaves the player stuck changing discs.
 */
export type Swapper = (to: TrackView) => Promise<void>;

export interface SceneBridge {
  getView(): SceneView;
  setView(view: SceneView): void;
  subscribe(listener: () => void): () => void;
  setSwapper(swapper: Swapper | null): void;
  /** Without a running scene (before it boots, no WebGL) the change is instant. */
  swap(to: TrackView): Promise<void>;
  emit(action: PlayerAction): void;
  onAction(listener: (action: PlayerAction) => void): () => void;
}

export function createBridge(initial: SceneView = EMPTY_VIEW): SceneBridge {
  let view = initial;
  let swapper: Swapper | null = null;
  const viewListeners = new Set<() => void>();
  const actionListeners = new Set<(action: PlayerAction) => void>();
  return {
    getView: () => view,
    setView: (next) => {
      view = next;
      for (const listener of viewListeners) listener();
    },
    subscribe: (listener) => {
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    },
    setSwapper: (next) => {
      swapper = next;
    },
    swap: (to) => (swapper ? swapper(to) : Promise.resolve()),
    emit: (action) => {
      for (const listener of actionListeners) listener(action);
    },
    onAction: (listener) => {
      actionListeners.add(listener);
      return () => {
        actionListeners.delete(listener);
      };
    },
  };
}

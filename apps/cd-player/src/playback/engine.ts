import type { PlayerAction } from '../actions';
import type { SceneBridge } from '../bridge';
import { sameCollection, type CollectionRef } from '../routes';
import { canRetry, requestErrorMessage, type SpotifyClient } from '../spotify/client';
import type { ArtistDetail, Collection, TrackDetail } from '../spotify/types';
import { sceneView, trackView } from '../view';
import type { EmbedCallbacks, EmbedPlayer, PlaybackUpdate } from './embed-controller';
import {
  currentIndex,
  initialSeq,
  step,
  upcomingIndices,
  type Command,
  type SeqEvent,
  type SeqState,
} from './sequencer';

export type EmbedState = 'off' | 'loading' | 'ready' | 'blocked';

/** What the server render fetched, handed to the client through the page (src/ssr-state.ts). */
export interface InitialData {
  ref: CollectionRef;
  collection: Collection | null;
  firstTrack: TrackDetail | null;
  firstArtist: ArtistDetail | null;
}

export interface EngineSnapshot {
  ref: CollectionRef | null;
  collection: Collection | null;
  loading: boolean;
  /** Why the collection did not load, and whether trying again may help (Retry). */
  error: { message: string; retry: boolean } | null;
  seq: SeqState;
  details: ReadonlyMap<string, TrackDetail>;
  artists: ReadonlyMap<string, ArtistDetail>;
  embed: EmbedState;
  /** The embed was told to play and has not started: ask the visitor to press play inside it. */
  hint: boolean;
}

export interface EngineDeps {
  client: SpotifyClient;
  bridge: SceneBridge;
  /**
   * Builds the Spotify player in the now-playing card, on the visitor's first play action. It may
   * never settle (Spotify's callback can stay silent), so the engine stops waiting after
   * `PLAYER_TIMEOUT_MS` and calls it again on the visitor's next action.
   */
  createPlayer(firstUri: string, callbacks: EmbedCallbacks): Promise<EmbedPlayer>;
  hintMs?: number;
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
  /** The clock (ms) a seek's settling is timed by; `performance.now()` when none is injected. */
  now?(): number;
}

/** How many tracks ahead get their art and artist fetched: the rack in the lid shows five. */
const PREFETCH = 5;
const HINT_MS = 3500;
/** How long building the Spotify player may take before the embed counts as blocked. */
const PLAYER_TIMEOUT_MS = 20_000;
/**
 * How long past a track's expected end the end watchdog waits for the embed to report it: the
 * embed reports an end well within a second, and a longer wait only stretches the silence.
 */
const END_GRACE_MS = 1500;
/**
 * A seek settles once the embed reports a position near its target, or after this long (ms).
 * Until then a report away from the target is the embed's echo of its last one (it posts that
 * once more right after a seek, ~15 ms on, before its report from the target ~0.8 s later), and
 * it is dropped: taken, it would put the slider, the displays and a turntable's arm back for that
 * while. The bound keeps a seek the embed never carries out from freezing the view.
 */
const SEEK_SETTLE_MS = 1500;
/**
 * How near its target a report counts as the seek's (ms): the embed lands a little before it,
 * and holds a seek under a second (Stop's) at its first second.
 */
const SEEK_NEAR_MS = 1000;

/**
 * Playback outside React: the sequencer's state, the commands it emits (disc changes through the
 * bridge, the Spotify embed), the collection and the per-track art. React reads it through
 * `usePlayerEngine`; the constructor has no side effects (StrictMode builds it twice).
 */
export class PlayerEngine {
  private snapshot: EngineSnapshot;
  private readonly listeners = new Set<() => void>();
  private player: Promise<EmbedPlayer> | null = null;
  private hintTimer: unknown = null;
  private awaitingStart = false;
  /**
   * Which disc change may answer with SWAP_DONE: each takes the next number, and the sequencer
   * leaving `swapping` any other way (the player failed, a new collection) bumps it, so a change
   * finishing late is never taken for a newer one.
   */
  private swapToken = 0;
  /**
   * The end watchdog's timer (`watchEnd`), and which arming may fire: each takes the next number,
   * so a timer that goes off after a newer update, a pause, a load or dispose does nothing.
   */
  private endTimer: unknown = null;
  private endWatch = 0;
  /** The last seek sent to the embed and when (`now()`), until a report settles it. */
  private seeking: { ms: number; at: number } | null = null;
  /** Whether the last report taken from the embed was paused; null since the last load. */
  private lastPaused: boolean | null = null;
  /** When Stop was last pressed (`now()`): the embed's playing reports just after it are dropped. */
  private stopAt: number | null = null;
  /**
   * Play was pressed while the collection was still loading, with no tracks to play yet: the
   * scene can be up before them (seen live, the press 15–40 ms early). It plays once they are in;
   * a second press or Stop takes it back, a failed load forgets it.
   */
  private playOnLoad = false;
  private detachBridge: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly deps: EngineDeps,
    initial: InitialData | null = null,
  ) {
    const details = new Map<string, TrackDetail>();
    const artists = new Map<string, ArtistDetail>();
    if (initial?.firstTrack) details.set(initial.firstTrack.id, initial.firstTrack);
    if (initial?.firstArtist) artists.set(initial.firstArtist.id, initial.firstArtist);
    this.snapshot = {
      ref: initial?.ref ?? null,
      collection: initial?.collection ?? null,
      loading: false,
      error: null,
      seq: initialSeq(initial?.collection?.tracks ?? []),
      details,
      artists,
      embed: 'off',
      hint: false,
    };
    if (initial?.collection) deps.client.seed(initial.ref.type, initial.ref.id, initial.collection);
    if (initial?.firstTrack) deps.client.seed('track', initial.firstTrack.id, initial.firstTrack);
    if (initial?.firstArtist)
      deps.client.seed('artist', initial.firstArtist.id, initial.firstArtist);
  }

  getSnapshot = (): EngineSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Listens to the scene's keys and publishes the view; returns `dispose`. */
  attach(): () => void {
    this.disposed = false;
    this.detachBridge = this.deps.bridge.onAction((action) => this.onAction(action));
    this.publish();
    this.prefetch();
    return () => this.dispose();
  }

  dispose(): void {
    this.disposed = true;
    this.detachBridge?.();
    this.detachBridge = null;
    this.clearHint();
    this.clearEndWatch();
    void this.player?.then(
      (player) => player.destroy(),
      () => {},
    );
    this.player = null;
  }

  /**
   * Shows `ref`: the collection already here, or fetched. A load that failed leaves another
   * collection on show, or none, so opening the same `ref` again asks again (the empty shelf's
   * Retry, a preset pressed for it).
   */
  open(ref: CollectionRef): void {
    const { snapshot } = this;
    const here = sameCollection(snapshot.collection, ref) || snapshot.loading;
    if (sameCollection(snapshot.ref, ref) && here) return;
    // A remembered Play belongs to the collection it was pressed for.
    if (!sameCollection(snapshot.ref, ref)) this.playOnLoad = false;
    this.set({ ref, loading: true, error: null });
    this.deps.client.collection(ref).then(
      (collection) => {
        if (this.disposed || !sameCollection(this.snapshot.ref, ref)) return;
        this.set({ collection, loading: false });
        this.send({ type: 'LOAD', tracks: collection.tracks });
        if (this.playOnLoad) {
          this.playOnLoad = false;
          this.user({ type: 'PLAY' });
        }
      },
      (error: unknown) => {
        if (this.disposed || !sameCollection(this.snapshot.ref, ref)) return;
        this.playOnLoad = false;
        this.set({
          loading: false,
          error: { message: requestErrorMessage(error, ref.type), retry: canRetry(error) },
        });
      },
    );
  }

  /**
   * A visitor's own action. Spotify's script loads on the first play action, not on any key, so
   * the player is built only when the reducer would start playback (a disc change or a load).
   */
  user(event: SeqEvent): void {
    const { seq, loading } = this.snapshot;
    if (loading && seq.tracks.length === 0) {
      // Nothing to play yet: Play (or the toggle) waits for the tracks, a toggle again or Stop
      // takes it back (see `playOnLoad`).
      if (event.type === 'PLAY') this.playOnLoad = true;
      else if (event.type === 'TOGGLE') this.playOnLoad = !this.playOnLoad;
      else if (event.type === 'STOP' || event.type === 'PAUSE') this.playOnLoad = false;
    }
    const { commands } = step(seq, event);
    if (commands.some((command) => command.type === 'swap' || command.type === 'load')) {
      this.prepare(event);
    }
    this.send(event);
  }

  send(event: SeqEvent): void {
    // A new collection ends any disc change still turning, and the watch on the track's end.
    if (event.type === 'LOAD') {
      this.swapToken++;
      this.clearEndWatch();
    }
    const { state, commands } = step(this.snapshot.seq, event);
    if (event.type === 'STOP' && state.stopped) this.stopAt = this.now();
    if (state !== this.snapshot.seq) this.set({ seq: state });
    for (const command of commands) this.run(command);
    if (event.type === 'LOAD' || commands.some((command) => command.type === 'swap'))
      this.prefetch();
  }

  private onAction(action: PlayerAction): void {
    switch (action.type) {
      case 'prev':
        return this.user({ type: 'PREV' });
      case 'next':
        return this.user({ type: 'NEXT' });
      case 'toggle':
        return this.user({ type: 'TOGGLE' });
      case 'stop':
        return this.user({ type: 'STOP' });
      case 'repeat':
        return this.user({ type: 'TOGGLE_REPEAT' });
      case 'shuffle':
        return this.user({ type: 'TOGGLE_SHUFFLE', seed: Date.now() });
      case 'seek':
        return this.user({ type: 'SEEK', ms: this.snapshot.seq.positionMs + action.deltaMs });
    }
  }

  private prepare(event: SeqEvent): void {
    if (this.player) return;
    const { seq } = this.snapshot;
    const index =
      event.type === 'SELECT' ? event.index : (currentIndex(seq) ?? upcomingIndices(seq, 1)[0]);
    const track = index === undefined || index === null ? undefined : seq.tracks[index];
    if (!track) return;
    this.set({ embed: 'loading' });
    const pending = this.deps.createPlayer(track.uri, {
      onStarted: () => {
        this.awaitingStart = false;
        this.clearHint();
      },
      onUpdate: (update) => {
        // Right after a load the embed reports itself paused until the audio starts.
        if (this.awaitingStart && update.paused) return;
        if (update.buffering) return;
        if (this.playsThroughStop(update)) return;
        const taken = this.afterSeekEcho(update);
        if (!taken) return;
        this.lastPaused = taken.paused;
        this.send({
          type: 'PROGRESS',
          positionMs: taken.positionMs,
          durationMs: taken.durationMs,
          paused: taken.paused,
        });
        this.watchEnd(taken);
      },
      onEnded: () => this.send({ type: 'ENDED' }),
    });
    this.player = pending;
    // The wait is bounded: Spotify's `createController` can stay silent for good (a half-loaded or
    // blocked script). Past PLAYER_TIMEOUT_MS the embed counts as blocked and `player` is freed, so
    // the visitor's next action tries again; a player that turns up after that is destroyed unused.
    // Whichever of the answer, the failure and the timeout comes first is the only one acted on.
    let settled = false;
    const fail = () => {
      const current = this.player === pending;
      if (current) this.player = null;
      if (this.disposed) return;
      // No player, no music: a sequencer left `playing` would turn the visitor's next press of play
      // into a pause, and one left `swapping` would reach `playing` as the disc seats. Idle keeps
      // the track (and order, repeat, shuffle), so that press loads it into the next player.
      const patch: Partial<EngineSnapshot> = { embed: 'blocked' };
      const { seq } = this.snapshot;
      if (current && seq.status !== 'idle') {
        patch.seq = { ...seq, status: 'idle', stopped: false, positionMs: 0 };
        this.swapToken++;
      }
      this.set(patch);
    };
    const wait = this.startTimer(() => {
      if (settled || this.disposed) return;
      settled = true;
      fail();
    }, PLAYER_TIMEOUT_MS);
    pending.then(
      (player) => {
        if (settled) {
          player.destroy();
          return;
        }
        settled = true;
        this.stopTimer(wait);
        if (!this.disposed) this.set({ embed: 'ready' });
      },
      () => {
        if (settled) return;
        settled = true;
        this.stopTimer(wait);
        fail();
      },
    );
  }

  private run(command: Command): void {
    switch (command.type) {
      case 'swap': {
        const { seq, details, artists } = this.snapshot;
        const view = trackView(seq.tracks[command.to], details, artists);
        // Only the latest disc change may answer (see `swapToken`).
        const token = ++this.swapToken;
        const seated = () => {
          if (!this.disposed && token === this.swapToken) this.send({ type: 'SWAP_DONE' });
        };
        // A disc change that fails still ends the change: the music starts even if the animation
        // did not, rather than the sequencer waiting in `swapping` for good.
        void this.deps.bridge.swap(view).then(seated, seated);
        return;
      }
      case 'load':
        this.clearEndWatch();
        this.seeking = null;
        this.lastPaused = null;
        this.withPlayer((player) => {
          this.awaitingStart = true;
          player.load(command.uri);
          this.armHint();
        });
        return;
      case 'pause':
        this.withPlayer((player) => player.pause());
        return;
      case 'resume':
        this.withPlayer((player) => player.resume());
        return;
      case 'seek':
        this.seeking = { ms: command.ms, at: this.now() };
        this.withPlayer((player) => player.seek(command.ms));
        return;
    }
  }

  /**
   * Whether `update` is the embed's echo of where it was before the last seek: away from the
   * seek's target while the seek has not settled (SEEK_SETTLE_MS), and as paused or playing as
   * the last report taken (every echo seen live repeated it whole). A report near the target, or
   * any report once the time is up, settles it; a pause or a play (the flag changing) is the
   * embed's news, never an echo, and passes, so its watch on the end is cleared as it should be.
   * Returns null for an echo (dropped), else the update to take: a flag change inside the wait
   * keeps the seek's target as its position, since the report's own is from before the seek.
   */
  private afterSeekEcho(update: PlaybackUpdate): PlaybackUpdate | null {
    if (!this.seeking) return update;
    const since = this.now() - this.seeking.at;
    const { ms } = this.seeking;
    const near =
      update.positionMs >= ms - SEEK_NEAR_MS && update.positionMs <= ms + SEEK_NEAR_MS + since;
    if (near || since > SEEK_SETTLE_MS) {
      this.seeking = null;
      return update;
    }
    if (this.lastPaused === null || update.paused === this.lastPaused) return null;
    return { ...update, positionMs: ms };
  }

  /**
   * Whether `update` is a playing report that arrives just after Stop (SEEK_SETTLE_MS): the
   * embed's echo or a report already in flight, which would otherwise end the stop (inside the
   * track's first second it even counts as near Stop's seek to 0). A Play sent from the page ends
   * the stop by itself, and the card's own play is taken once the time is up.
   */
  private playsThroughStop(update: PlaybackUpdate): boolean {
    if (update.paused || !this.snapshot.seq.stopped || this.stopAt === null) return false;
    return this.now() - this.stopAt <= SEEK_SETTLE_MS;
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : performance.now();
  }

  /**
   * Hands the Spotify player to `fn` once it is there (commands wait for one still being built).
   * An attempt given up on or let go of meanwhile (timed out, failed, disposed) is no longer
   * `this.player`, so a player that turns up late, already destroyed, is given nothing.
   */
  private withPlayer(fn: (player: EmbedPlayer) => void): void {
    const pending = this.player;
    void pending?.then(
      (player) => {
        if (this.player === pending) fn(player);
      },
      () => {},
    );
  }

  private prefetch(): void {
    const { seq } = this.snapshot;
    const indices = new Set(
      [currentIndex(seq), ...upcomingIndices(seq, PREFETCH)].filter(
        (index): index is number => index !== null,
      ),
    );
    for (const index of indices) {
      const track = seq.tracks[index];
      if (!track) continue;
      this.deps.client
        .track(track.id)
        .then((detail) => {
          if (this.disposed) return;
          if (!this.snapshot.details.has(detail.id)) {
            this.set({ details: new Map(this.snapshot.details).set(detail.id, detail) });
          }
          const artistId = detail.artists[0]?.id;
          if (!artistId || this.snapshot.artists.has(artistId)) return;
          return this.deps.client.artist(artistId).then((artist) => {
            if (!this.disposed && !this.snapshot.artists.has(artist.id)) {
              this.set({ artists: new Map(this.snapshot.artists).set(artist.id, artist) });
            }
          });
        })
        .catch(() => {
          // A missing picture falls back to the album art, then to the printed default (view.ts).
        });
    }
  }

  /**
   * The end watchdog. Logged out, the embed can let a preview run out without a word (no paused
   * update, no end), which would leave the sequencer `playing` in silence while the embed has
   * dropped its list: any command after that throws inside its iframe. So every update of a track
   * that plays re-arms one timer for the rest of it plus END_GRACE_MS; if that runs out with the
   * track `playing` or `paused`, the track has ended. `paused` counts: a Pause or Stop pressed
   * inside the grace sets it with no help from the embed, and its `pause` throws inside the dead
   * iframe, so no paused update comes back. A live embed answers a pause with one, which clears
   * the watch, so a watch still valid while `paused` means that no answer came. ENDED changes the
   * disc without a `pause`, and the next `load` gives the embed a list again. A paused update (an
   * end the embed reports among them), a load, a new collection and dispose clear it.
   */
  private watchEnd(update: PlaybackUpdate): void {
    this.clearEndWatch();
    if (update.paused || update.durationMs <= 0 || this.snapshot.seq.status !== 'playing') return;
    const watch = this.endWatch;
    this.endTimer = this.startTimer(
      () => {
        if (watch !== this.endWatch || this.disposed) return;
        this.endTimer = null;
        const { status } = this.snapshot.seq;
        if (status === 'playing' || status === 'paused') this.send({ type: 'ENDED' });
      },
      Math.max(0, update.durationMs - update.positionMs) + END_GRACE_MS,
    );
  }

  private clearEndWatch(): void {
    this.endWatch++;
    if (this.endTimer !== null) {
      this.stopTimer(this.endTimer);
      this.endTimer = null;
    }
  }

  private armHint(): void {
    this.clearHint();
    this.hintTimer = this.startTimer(() => {
      if (!this.disposed && this.awaitingStart) this.set({ hint: true });
    }, this.deps.hintMs ?? HINT_MS);
  }

  private clearHint(): void {
    if (this.hintTimer !== null) {
      this.stopTimer(this.hintTimer);
      this.hintTimer = null;
    }
    if (this.snapshot.hint) this.set({ hint: false });
  }

  /** The injected timer, else the real one (the hint, the player's wait and the end watchdog). */
  private startTimer(fn: () => void, ms: number): unknown {
    const setTimer = this.deps.setTimer ?? ((run, delay) => setTimeout(run, delay));
    return setTimer(fn, ms);
  }

  private stopTimer(handle: unknown): void {
    const clearTimer =
      this.deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    clearTimer(handle);
  }

  private set(patch: Partial<EngineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.publish();
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
    this.deps.bridge.setView(sceneView(this.snapshot));
  }
}

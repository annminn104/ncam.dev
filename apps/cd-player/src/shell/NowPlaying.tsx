import type { RefObject } from 'react';
import type { EmbedState } from '../playback/engine';
import type { Status } from '../playback/sequencer';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  StopIcon,
} from './Icons';
import { SeekSlider } from './SeekSlider';

interface Props {
  now: { title: string; artists: string; trackNo: number; total: number } | null;
  status: Status;
  positionMs: number;
  durationMs: number;
  repeat: boolean;
  shuffle: boolean;
  embed: EmbedState;
  hint: boolean;
  /** Where Spotify's widget goes: React renders no children into it. */
  embedRef: RefObject<HTMLDivElement | null>;
  onPrev(): void;
  onToggle(): void;
  onNext(): void;
  onStop(): void;
  onRepeat(): void;
  onShuffle(): void;
  /** Seeks to `ms` into the track. */
  onSeek(ms: number): void;
}

export function NowPlaying({
  now,
  status,
  positionMs,
  durationMs,
  repeat,
  shuffle,
  embed,
  hint,
  embedRef,
  onPrev,
  onToggle,
  onNext,
  onStop,
  onRepeat,
  onShuffle,
  onSeek,
}: Props) {
  const playing = status === 'playing' || status === 'swapping';
  return (
    <section className="cdp-now" aria-label="Now playing">
      <div className="cdp-now__head">
        <div className="cdp-now__meta">
          <p className="cdp-eyebrow">{now ? `Track ${now.trackNo} of ${now.total}` : 'Ready'}</p>
          <p className="cdp-now__title">{now?.title ?? 'Press play'}</p>
          {now && <p className="cdp-now__artists">{now.artists}</p>}
        </div>
        <div className="cdp-now__controls">
          <button type="button" className="cdp-round" onClick={onPrev} aria-label="Previous track">
            <PrevIcon />
          </button>
          <button
            type="button"
            className="cdp-round cdp-round--main"
            onClick={onToggle}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="cdp-round" onClick={onNext} aria-label="Next track">
            <NextIcon />
          </button>
        </div>
      </div>
      {/* The deck's knob and its Stop, Repeat and MODE (Shuffle) keys, which on a phone are a few
          pixels wide in the 3D view. DOM order is visual order, and so the Tab order. */}
      <div className="cdp-now__row">
        <SeekSlider
          positionMs={positionMs}
          durationMs={durationMs}
          disabled={status === 'idle' || durationMs <= 0}
          onSeek={onSeek}
        />
        <button
          type="button"
          className="cdp-round cdp-round--small"
          onClick={onStop}
          aria-label="Stop"
        >
          <StopIcon />
        </button>
        <button
          type="button"
          className="cdp-round cdp-round--small"
          onClick={onRepeat}
          aria-label="Repeat"
          aria-pressed={repeat}
        >
          <RepeatIcon />
        </button>
        <button
          type="button"
          className="cdp-round cdp-round--small"
          onClick={onShuffle}
          aria-label="Shuffle"
          aria-pressed={shuffle}
        >
          <ShuffleIcon />
        </button>
      </div>
      <div className="cdp-now__embed" ref={embedRef} />
      {embed === 'off' && (
        <p className="cdp-now__note cdp-now__note--lead">
          Press play to connect Spotify. Log in to Spotify in this browser to hear full tracks.
        </p>
      )}
      {embed === 'blocked' && (
        <p className="cdp-now__note cdp-now__note--lead" role="alert">
          The Spotify player could not load here. An ad blocker or a privacy setting may be blocking
          it.
        </p>
      )}
      {hint && <p className="cdp-now__note">Press play inside the Spotify card to start.</p>}
    </section>
  );
}

import type { RefObject } from 'react';
import type { EmbedState } from '../playback/engine';
import type { Status } from '../playback/sequencer';
import { formatDuration } from '../view';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './Icons';

interface Props {
  now: { title: string; artists: string; trackNo: number; total: number } | null;
  status: Status;
  positionMs: number;
  durationMs: number;
  embed: EmbedState;
  hint: boolean;
  /** Where Spotify's widget goes: React renders no children into it. */
  embedRef: RefObject<HTMLDivElement | null>;
  onPrev(): void;
  onToggle(): void;
  onNext(): void;
}

export function NowPlaying({
  now,
  status,
  positionMs,
  durationMs,
  embed,
  hint,
  embedRef,
  onPrev,
  onToggle,
  onNext,
}: Props) {
  const playing = status === 'playing' || status === 'swapping';
  const ratio = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
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
      <div
        className="cdp-now__progress"
        role="progressbar"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(positionMs / 1000)}
        aria-valuetext={`${formatDuration(positionMs)} of ${formatDuration(durationMs)}`}
      >
        <span style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <div className="cdp-now__embed" ref={embedRef} />
      {embed === 'off' && (
        <p className="cdp-now__note">
          Press play to connect Spotify. Log in to Spotify in this browser to hear full tracks.
        </p>
      )}
      {embed === 'blocked' && (
        <p className="cdp-now__note" role="alert">
          The Spotify player could not load here. An ad blocker or a privacy setting may be blocking
          it.
        </p>
      )}
      {hint && <p className="cdp-now__note">Press play inside the Spotify card to start.</p>}
    </section>
  );
}

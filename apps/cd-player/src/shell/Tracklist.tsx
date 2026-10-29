import type { Status } from '../playback/sequencer';
import type { Track } from '../spotify/types';
import { formatDuration } from '../view';

interface Props {
  tracks: readonly Track[];
  currentIndex: number | null;
  status: Status;
  /** Phones only: the sheet is open. Wide screens always show the drawer. */
  open: boolean;
  /**
   * A first load that failed: the shelf is empty, so it says why, with Retry when trying again
   * may help (a 502, a stall).
   */
  failure?: { message: string; onRetry?: () => void } | null;
  onToggle(): void;
  onSelect(index: number): void;
}

export function Tracklist({
  tracks,
  currentIndex,
  status,
  open,
  failure = null,
  onToggle,
  onSelect,
}: Props) {
  return (
    <aside className={open ? 'cdp-tracks is-open' : 'cdp-tracks'} aria-label="Tracklist">
      <button
        type="button"
        className="cdp-tracks__toggle"
        aria-expanded={open}
        aria-controls="cdp-tracklist"
        onClick={onToggle}
      >
        <span>Tracks</span>
        <span className="cdp-tracks__count">{tracks.length}</span>
      </button>
      {failure ? (
        <div id="cdp-tracklist" className="cdp-tracks__empty">
          <p role="alert">{failure.message}</p>
          {failure.onRetry && (
            <button type="button" className="cdp-button" onClick={failure.onRetry}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <ol id="cdp-tracklist" className="cdp-tracks__list">
          {tracks.map((track, index) => {
            const current = index === currentIndex;
            return (
              <li key={`${track.uri}-${index}`}>
                <button
                  type="button"
                  className={current ? 'cdp-track is-current' : 'cdp-track'}
                  aria-current={current ? 'true' : undefined}
                  disabled={!track.playable}
                  onClick={() => onSelect(index)}
                >
                  <span className="cdp-track__no">
                    {current && status === 'playing' ? (
                      <span className="cdp-eq" role="img" aria-label="Playing" />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="cdp-track__text">
                    <span className="cdp-track__title">
                      {track.title}
                      {track.explicit && (
                        <abbr className="cdp-track__explicit" title="Explicit">
                          E
                        </abbr>
                      )}
                    </span>
                    <span className="cdp-track__artists">{track.artists}</span>
                  </span>
                  <span className="cdp-track__time">{formatDuration(track.durationMs)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

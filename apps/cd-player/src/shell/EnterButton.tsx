import type { Phase } from '../boot';
import type { Failure } from '../failure';

interface Props {
  phase: Phase;
  failure: Failure | null;
  onStart(): void;
}

/**
 * The way in before the scene runs, "Opening the player…" while it boots, or the failure. A
 * failure that needs a page reload says so on its button: the reload stops the music.
 */
export function EnterButton({ phase, failure, onStart }: Props) {
  if (phase === 'live') return null;
  if (phase === 'error' && failure) {
    return (
      <div className="cdp-gate" role="alert">
        <p>{failure.message}</p>
        {failure.retry && (
          <button type="button" className="cdp-enter" onClick={onStart}>
            {failure.reload ? 'Reload the page' : 'Try again'}
          </button>
        )}
      </div>
    );
  }
  const booting = phase === 'booting';
  return (
    <div className="cdp-gate">
      <button
        type="button"
        className="cdp-enter"
        onClick={onStart}
        disabled={booting}
        aria-busy={booting}
      >
        {booting ? 'Opening the player…' : 'Open the player'}
      </button>
    </div>
  );
}

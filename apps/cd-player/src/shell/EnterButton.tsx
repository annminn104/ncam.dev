import type { Phase } from '../boot';
import type { Failure } from '../failure';

interface Props {
  phase: Phase;
  failure: Failure | null;
  onStart(): void;
}

/**
 * The way in once the page has settled without starting the scene, or the failure. Nothing while
 * the scene boots (the loader shows that) or once it is live. A failure that needs a page reload
 * says so on its button: the reload stops the music.
 */
export function EnterButton({ phase, failure, onStart }: Props) {
  if (phase === 'live' || phase === 'booting') return null;
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
  return (
    <div className="cdp-gate">
      <button type="button" className="cdp-enter" onClick={onStart}>
        Open the player
      </button>
    </div>
  );
}

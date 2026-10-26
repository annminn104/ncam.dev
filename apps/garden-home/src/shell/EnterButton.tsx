import type { Phase } from '../boot';
import type { Failure } from '../failure';

interface Props {
  phase: Phase;
  failure: Failure | null;
  onStart(): void;
}

/** The way in before the scene runs, "Opening the garden…" while it boots, or the failure. */
export function EnterButton({ phase, failure, onStart }: Props) {
  if (phase === 'live') return null;
  if (phase === 'error' && failure) {
    return (
      <div className="gh-gate" role="alert">
        <p>{failure.message}</p>
        {failure.retry && (
          <button type="button" className="gh-enter" onClick={onStart}>
            Try again
          </button>
        )}
      </div>
    );
  }
  const booting = phase === 'booting';
  return (
    <div className="gh-gate">
      <button
        type="button"
        className="gh-enter"
        onClick={onStart}
        disabled={booting}
        aria-busy={booting}
      >
        {booting ? 'Opening the garden…' : 'Enter the garden'}
      </button>
    </div>
  );
}

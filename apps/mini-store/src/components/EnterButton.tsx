import type { Phase } from '../boot';

interface Props {
  phase: Phase;
  error: string | null;
  onStart(): void;
}

/** The way in before the scene runs, "Opening the store…" while it boots, or the failure + retry. */
export function EnterButton({ phase, error, onStart }: Props) {
  if (phase === 'live') return null;
  if (phase === 'error') {
    return (
      <div className="ms-gate" role="alert">
        <p>{error}</p>
        <button type="button" className="ms-enter" onClick={onStart}>
          Try again
        </button>
      </div>
    );
  }
  const booting = phase === 'booting';
  return (
    <div className="ms-gate">
      <button
        type="button"
        className="ms-enter"
        onClick={onStart}
        disabled={booting}
        aria-busy={booting}
      >
        {booting ? 'Opening the store…' : 'Enter the store'}
      </button>
    </div>
  );
}

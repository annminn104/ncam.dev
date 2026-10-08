import { useEffect, useState } from 'react';

/**
 * Stockfish failed. The toast says so and offers to ask again or to play on as hot-seat, which
 * keeps the position. Either answer takes the toast away, and the focus goes back to where it
 * was (a square of the keyboard board) rather than to the page.
 */
export function EngineToast({
  message,
  onRetry,
  onHotseat,
}: {
  message: string;
  onRetry(): void;
  onHotseat(): void;
}) {
  // Read in the first render, like useDialog's opener.
  const [before] = useState(() => document.activeElement);
  useEffect(
    () => () => {
      const active = document.activeElement;
      const lost = active === null || active === document.body;
      if (lost && before instanceof HTMLElement && before !== document.body && before.isConnected) {
        before.focus();
      }
    },
    [before],
  );
  return (
    <div className="chess-toast" role="alert">
      <p>{message}</p>
      <button type="button" className="chess-btn" onClick={onRetry}>
        Retry
      </button>
      <button type="button" className="chess-btn" onClick={onHotseat}>
        Switch to hot-seat
      </button>
    </div>
  );
}

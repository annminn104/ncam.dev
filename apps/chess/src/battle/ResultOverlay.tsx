import { useId, useRef } from 'react';
import { describeStatus, type GameStatus } from '../game/status';
import { useDialog } from './useDialog';

/** The verdict, once the battle is over. Escape, like "View the board", leaves it for the board. */
export function ResultOverlay(props: {
  status: GameStatus;
  onRematch(): void;
  onExit(): void;
  onReview(): void;
}) {
  const { status, onRematch, onExit, onReview } = props;
  const first = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();
  useDialog(first, onReview);
  const decided = status.kind === 'checkmate' || status.kind === 'resigned';
  return (
    <div
      className={`chess-modal chess-result chess-result--${decided ? 'decided' : 'balance'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
    >
      <h2 id={titleId}>{decided ? 'The battle is decided' : 'The battle ends in balance'}</h2>
      <p id={textId}>{describeStatus(status)}</p>
      <div className="chess-modal__actions">
        <button ref={first} type="button" className="chess-start" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="chess-btn" onClick={onReview}>
          View the board
        </button>
        <button type="button" className="chess-btn" onClick={onExit}>
          Back to the lobby
        </button>
      </div>
    </div>
  );
}

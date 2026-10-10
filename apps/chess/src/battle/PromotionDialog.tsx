import { useId, useRef } from 'react';
import type { Side } from '../game/coords';
import type { PromotionPiece } from '../game/game';
import { TREASURES } from '../game/treasures';
import { useDialog } from './useDialog';

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

/** A pawn reached the last rank: pick the treasure it becomes, or cancel (Escape) to take it back. */
export function PromotionDialog({
  side,
  onChoose,
}: {
  side: Side;
  onChoose(p: PromotionPiece | null): void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialog(first, () => onChoose(null));
  return (
    <div className="chess-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>The pearl ascends — choose its new form</h2>
      <div className="chess-modal__choices">
        {CHOICES.map((p, i) => (
          <button
            key={p}
            ref={i === 0 ? first : undefined}
            type="button"
            className={`chess-promo chess-promo--${side}`}
            onClick={() => onChoose(p)}
          >
            <span className="chess-promo__glyph" aria-hidden="true">
              {TREASURES[p].glyph}
            </span>
            <span className="chess-promo__name">{TREASURES[p].name}</span>
            <small className="chess-promo__piece">{TREASURES[p].piece}</small>
          </button>
        ))}
      </div>
      <button type="button" className="chess-link" onClick={() => onChoose(null)}>
        Cancel
      </button>
    </div>
  );
}

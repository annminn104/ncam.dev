import { useId, useRef } from 'react';
import type { Side } from '../game/coords';
import type { PromotionPiece } from '../game/game';
import { pieceLabel, type PresetId } from '../presets-meta';
import { useDialog } from './useDialog';

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

/**
 * A pawn reached the last rank: pick the piece it becomes, or cancel (Escape) to take it back.
 * The choices are named by the promoting side's piece set (`preset`).
 */
export function PromotionDialog({
  side,
  preset,
  onChoose,
}: {
  side: Side;
  preset: PresetId;
  onChoose(p: PromotionPiece | null): void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialog(first, () => onChoose(null));
  return (
    <div className="chess-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>Promotion — choose a piece</h2>
      <div className="chess-modal__choices">
        {CHOICES.map((p, i) => {
          const t = pieceLabel(preset, p);
          return (
            <button
              key={p}
              ref={i === 0 ? first : undefined}
              type="button"
              className={`chess-promo chess-promo--${side}`}
              onClick={() => onChoose(p)}
            >
              <span className="chess-promo__glyph" aria-hidden="true">
                {t.glyph}
              </span>
              <span className="chess-promo__name">{t.name}</span>
              <small className="chess-promo__piece">{t.piece}</small>
            </button>
          );
        })}
      </div>
      <button type="button" className="chess-link" onClick={() => onChoose(null)}>
        Cancel
      </button>
    </div>
  );
}

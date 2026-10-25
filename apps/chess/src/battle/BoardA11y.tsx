import type { Square } from 'chess.js';
import { useId, useRef, useState } from 'react';
import { SQUARES, type Side } from '../game/coords';
import { SECTS } from '../game/treasures';
import type { PresetId } from '../presets-meta';
import { describeSquare, isArrow, stepSquare } from './a11y-nav';
import type { GameApi } from './useGame';

/**
 * The board for keyboards and screen readers: a visually hidden grid of buttons that mirrors the
 * 3D board as seen from `viewSide`'s end. One square at a time is in the Tab order (a roving
 * tabindex); arrows move it and the 3D board shows it as the gold cursor. Enter or Space clicks
 * the square (a button does that natively), Escape puts the selected piece down. `presets` is
 * the piece set each side plays: the squares are named by it.
 */
export function BoardA11y({
  game,
  viewSide,
  presets,
  onCursor,
}: {
  game: GameApi;
  viewSide: Side;
  presets: Record<Side, PresetId>;
  onCursor(sq: Square | null): void;
}) {
  const [cursor, setCursor] = useState<Square>(viewSide === 'w' ? 'e2' : 'e7');
  const refs = useRef(new Map<Square, HTMLButtonElement>());
  const helpId = useId();
  const { snap, selected, targets } = game;
  const order = viewSide === 'w' ? SQUARES : [...SQUARES].reverse();
  const last = snap.sanHistory.at(-1);
  // The side that played the last move is the one not on move now.
  const lastBy = SECTS[snap.turn === 'w' ? 'b' : 'w'];

  const go = (sq: Square) => {
    setCursor(sq);
    onCursor(sq);
    refs.current.get(sq)?.focus();
  };

  return (
    <div className="chess-sr">
      <p id={helpId}>
        Arrow keys move between squares. Enter picks up a piece or moves it there; Escape puts it
        down.
      </p>
      <div role="grid" aria-label="Chess board" aria-describedby={helpId}>
        {Array.from({ length: 8 }, (_, r) => {
          const row = order.slice(r * 8, r * 8 + 8);
          return (
            // Keyed by rank, not by position: when the view turns round, React moves the rows
            // and their buttons rather than rebuilding them, so the focused square keeps focus.
            <div role="row" key={row[0][1]}>
              {row.map((sq) => (
                <button
                  key={sq}
                  type="button"
                  role="gridcell"
                  tabIndex={sq === cursor ? 0 : -1}
                  aria-selected={selected === sq}
                  aria-label={
                    describeSquare(sq, snap.pieces, presets) +
                    (targets.includes(sq) ? ', legal move' : '')
                  }
                  ref={(el) => {
                    if (el) refs.current.set(sq, el);
                    else refs.current.delete(sq);
                  }}
                  onFocus={() => {
                    setCursor(sq);
                    onCursor(sq);
                  }}
                  onBlur={() => onCursor(null)}
                  onKeyDown={(e) => {
                    if (isArrow(e.key)) {
                      e.preventDefault();
                      go(stepSquare(sq, e.key, viewSide));
                    } else if (e.key === 'Escape' && selected) {
                      // Clicking the selected square again is what deselects it.
                      game.clickSquare(selected);
                    }
                  }}
                  onClick={() => game.clickSquare(sq)}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p aria-live="polite">{last ? `${lastBy} played ${last}` : ''}</p>
    </div>
  );
}

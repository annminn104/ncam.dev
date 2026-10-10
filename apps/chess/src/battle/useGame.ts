import { useCallback, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import type { Side } from '../game/coords';
import { createGame, type GameSnapshot, type MoveInput, type PromotionPiece } from '../game/game';
import { isOver } from '../game/status';

export interface GameApi {
  snap: GameSnapshot;
  selected: Square | null;
  targets: Square[];
  pendingPromotion: { from: Square; to: Square } | null;
  clickSquare(sq: Square): void;
  choosePromotion(piece: PromotionPiece | null): void;
  play(input: MoveInput): boolean;
  undo(plies: number): void;
  resign(side: Side): void;
  agreeDraw(): void;
  locked: boolean;
  setLocked(v: boolean): void;
  plyCount: number;
}

/** React state around createGame(). `canMove(turn)` says whether the human may move now. */
export function useGame(canMove: (turn: Side) => boolean): GameApi {
  // A lazy initialiser: a bare createGame() argument would build a throwaway chess.js
  // instance on every render.
  const [game] = useState(() => createGame());
  const [snap, setSnap] = useState(() => game.snapshot());
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPending] = useState<{ from: Square; to: Square } | null>(null);
  const [locked, setLocked] = useState(false);

  // Every new position clears the selection, so the selection is all that targets depend on.
  const refresh = useCallback(() => {
    setSnap(game.snapshot());
    setSelected(null);
    setPending(null);
  }, [game]);

  const play = useCallback(
    (input: MoveInput) => {
      const ok = game.move(input);
      if (ok) refresh();
      return ok;
    },
    [game, refresh],
  );

  const targets = useMemo(() => (selected ? game.legalTargets(selected) : []), [game, selected]);

  const clickSquare = useCallback(
    (sq: Square) => {
      // A finished battle is for looking at: nothing to pick up.
      if (locked || pendingPromotion || isOver(snap.status) || !canMove(snap.turn)) return;
      const own = snap.pieces.find((p) => p.square === sq && p.color === snap.turn);
      if (selected && targets.includes(sq)) {
        if (game.isPromotion(selected, sq)) setPending({ from: selected, to: sq });
        else play({ from: selected, to: sq });
        return;
      }
      setSelected(own && sq !== selected ? sq : null);
    },
    [locked, pendingPromotion, canMove, snap, selected, targets, game, play],
  );

  return {
    snap,
    selected,
    targets,
    pendingPromotion,
    clickSquare,
    choosePromotion(piece) {
      if (!pendingPromotion) return;
      if (piece) play({ ...pendingPromotion, promotion: piece });
      else setPending(null);
    },
    play,
    undo(plies) {
      game.undo(plies);
      refresh();
    },
    resign(side) {
      game.resign(side);
      refresh();
    },
    agreeDraw() {
      game.agreeDraw();
      refresh();
    },
    locked,
    setLocked,
    plyCount: game.plyCount(),
  };
}

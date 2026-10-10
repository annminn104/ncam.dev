import type { Square } from 'chess.js';
import type { ReactNode } from 'react';
import type { BoardPiece } from '../../game/pieces';
import type { GameApi } from '../useGame';
import { Board, DEFAULT_SKIN, type BoardSkin } from './Board';
import { CaptureBurst } from './effects/CaptureBurst';
import { CheckAura } from './effects/CheckAura';
import { PieceView } from './PieceView';

export function Scene(props: {
  game: GameApi;
  skin?: BoardSkin;
  cursor: Square | null;
  renderPiece(piece: BoardPiece): ReactNode;
}) {
  const { game, skin = DEFAULT_SKIN, cursor, renderPiece } = props;
  const { snap } = game;
  return (
    <group>
      <Board
        skin={skin}
        targets={game.targets}
        selected={game.selected}
        lastMove={snap.lastMove}
        cursor={cursor}
        onSquare={game.clickSquare}
      />
      {snap.pieces.map((p) => (
        <PieceView
          key={p.id}
          piece={p}
          selected={p.square === game.selected}
          onClick={() => game.clickSquare(p.square)}
        >
          {renderPiece(p)}
        </PieceView>
      ))}
      <CaptureBurst snap={snap} />
      <CheckAura square={snap.checkSquare} side={snap.turn} />
    </group>
  );
}

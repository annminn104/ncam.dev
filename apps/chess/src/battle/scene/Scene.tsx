import type { Square } from 'chess.js';
import type { ReactNode } from 'react';
import type { BoardPiece } from '../../game/pieces';
import type { GameApi } from '../useGame';
import { Board, DEFAULT_SKIN, type BoardSkin } from './Board';
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
    </group>
  );
}

const HEIGHT = { p: 0.5, n: 0.7, b: 0.8, r: 0.9, q: 1.1, k: 1.25 } as const;

/** Stand-in treasure: a cylinder sized by piece type, until Task 6's treasures replace it. */
export function PlaceholderPiece({ piece }: { piece: BoardPiece }) {
  return (
    <mesh position-y={HEIGHT[piece.type] / 2} castShadow>
      <cylinderGeometry args={[0.28, 0.34, HEIGHT[piece.type], 24]} />
      <meshStandardMaterial color={piece.color === 'w' ? '#f2f5ef' : '#1b1d22'} />
    </mesh>
  );
}

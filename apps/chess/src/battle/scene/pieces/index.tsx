import { Float } from '@react-three/drei';
import type { PieceSymbol } from 'chess.js';
import type { ComponentType } from 'react';
import type { Side } from '../../../game/coords';
import type { BoardPiece } from '../../../game/pieces';
import { TREASURES } from '../../../game/treasures';
import { glyphMaterial } from '../glyph';
import { sectMaterials } from '../materials';
import { Bell } from './Bell';
import { Cauldron } from './Cauldron';
import { BODY_Y, baseKit } from './kits';
import { Mirror } from './Mirror';
import { Pearl } from './Pearl';
import { Seal } from './Seal';
import { Swords } from './Swords';

export { TREASURE_HEIGHT } from './kits';

/** What every treasure body takes. Only the bell uses `jumping`. */
export interface TreasureProps {
  side: Side;
  jumping: boolean;
}

const BODY: Record<PieceSymbol, ComponentType<TreasureProps>> = {
  k: Seal,
  q: Swords,
  r: Cauldron,
  b: Mirror,
  n: Bell,
  p: Pearl,
};

/** The lotus-ringed jade base every treasure floats over, its glyph toward the owner. */
function Base({ side, glyph }: { side: Side; glyph: string }) {
  const k = baseKit();
  const m = sectMaterials(side);
  return (
    <group>
      <mesh geometry={k.jade} material={m.body} receiveShadow />
      <mesh geometry={k.trim} material={m.trim} receiveShadow />
      <mesh geometry={k.glyph} material={glyphMaterial(glyph, side)} />
    </group>
  );
}

/**
 * A piece as its cultivation treasure. The base stays on the board; the body floats over it with
 * drei's Float (which writes its group's pose whole every frame) and runs its own motion.
 */
export function Treasure({ piece, jumping }: { piece: BoardPiece; jumping: boolean }) {
  const Body = BODY[piece.type];
  return (
    // The glyph faces its owner: black's pieces turn to face the other end of the board.
    <group rotation-y={piece.color === 'w' ? 0 : Math.PI}>
      <Base side={piece.color} glyph={TREASURES[piece.type].glyph} />
      <Float speed={4} rotationIntensity={0.2} floatIntensity={1} floatingRange={[-0.025, 0.025]}>
        <group position-y={BODY_Y}>
          <Body side={piece.color} jumping={jumping} />
        </group>
      </Float>
    </group>
  );
}

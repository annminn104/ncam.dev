import type { Square } from 'chess.js';
import { useFrame } from '@react-three/fiber';
import { useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { squareToPosition } from '../../game/coords';
import type { BoardPiece } from '../../game/pieces';

const MOVE_MS = 350;
const ARC_HEIGHT = 0.8;
const LIFT = 0.25;

interface Glide {
  from: [x: number, z: number];
  /** Height at take-off: a selected piece is lifted, and the arc starts from there. */
  fromY: number;
  to: [x: number, z: number];
  t0: number;
}

/**
 * Renders `children` (a treasure) on the piece's square, gliding it along an arc when the
 * square changes. The idle float belongs to the treasure itself.
 */
export function PieceView(props: {
  piece: BoardPiece;
  selected: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  const { piece, selected, onClick, children } = props;
  const group = useRef<Group>(null);
  const shown = useRef<Square>(piece.square);
  const glide = useRef<Glide | null>(null);
  // The piece's pose lives here, not on the group, and useFrame writes it to the group every
  // frame. R3F re-applies a group's props (the `position` below) whenever React re-inserts it
  // into the scene, and a move re-orders the pieces; reading the pose back off the group would
  // find it reset to where the piece started, mid-move. The prop only places the group before
  // the first frame.
  const [start] = useState(() => squareToPosition(piece.square));
  const pose = useRef({ x: start[0], y: 0, z: start[1] });

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const p = pose.current;
    const now = clock.elapsedTime * 1000;
    if (shown.current !== piece.square) {
      glide.current = {
        from: [p.x, p.z],
        fromY: p.y,
        to: squareToPosition(piece.square),
        t0: now,
      };
      shown.current = piece.square;
    }
    const a = glide.current;
    if (a) {
      const t = Math.min(1, (now - a.t0) / MOVE_MS);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      p.x = a.from[0] + (a.to[0] - a.from[0]) * e;
      p.z = a.from[1] + (a.to[1] - a.from[1]) * e;
      p.y = a.fromY * (1 - e) + Math.sin(Math.PI * t) * ARC_HEIGHT;
      if (t === 1) glide.current = null;
    } else {
      // Frame-rate independent ease toward the resting (or selected) height.
      p.y += ((selected ? LIFT : 0) - p.y) * (1 - Math.exp(-12 * delta));
    }
    g.position.set(p.x, p.y, p.z);
  });

  return (
    <group
      ref={group}
      position={[start[0], 0, start[1]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </group>
  );
}

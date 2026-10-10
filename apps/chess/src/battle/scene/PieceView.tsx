import type { Square } from 'chess.js';
import { useFrame } from '@react-three/fiber';
import { useContext, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { squareToPosition } from '../../game/coords';
import type { BoardPiece } from '../../game/pieces';
import { QualityContext } from '../quality';
import { QiTrail, type QiTrailHandle } from './effects/QiTrail';
import { MOVE_MS, glideAt, glideDone, type Glide } from './glide';

const LIFT = 0.25;

/**
 * Renders `children` (a treasure) on the piece's square, gliding it along an arc when the
 * square changes, a qi ribbon trailing it on a strong GPU. The idle float belongs to the treasure
 * itself.
 */
export function PieceView(props: {
  piece: BoardPiece;
  selected: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  const { piece, selected, onClick, children } = props;
  const quality = useContext(QualityContext);
  const group = useRef<Group>(null);
  const trail = useRef<QiTrailHandle>(null);
  const shown = useRef<Square>(piece.square);
  const glide = useRef<Glide | null>(null);
  // The piece's pose lives here, not on the group, and useFrame writes it to the group every
  // frame. R3F re-applies a group's props (the `position` below) whenever React re-inserts it
  // into the scene, and a move re-orders the pieces; reading the pose back off the group would
  // find it reset to where the piece started, mid-move. The prop only places the group before
  // the first frame.
  const [start] = useState(() => squareToPosition(piece.square));
  const pose = useRef({ x: start[0], y: 0, z: start[1] });

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    const p = pose.current;
    if (shown.current !== piece.square) {
      glide.current = {
        from: [p.x, p.z],
        fromY: p.y,
        to: squareToPosition(piece.square),
        elapsed: 0,
      };
      shown.current = piece.square;
    }
    // Timed by the frames' deltas: R3F's clock restarts whenever its frame loop does.
    const a = glide.current;
    if (a && a.elapsed < MOVE_MS) {
      a.elapsed += delta * 1000;
      // The frame that passes MOVE_MS sets the piece down exactly on its square.
      glideAt(a, Math.min(1, a.elapsed / MOVE_MS), p);
    } else {
      if (a) a.elapsed += delta * 1000;
      // Frame-rate independent ease toward the resting (or selected) height.
      p.y += ((selected ? LIFT : 0) - p.y) * (1 - Math.exp(-12 * delta));
    }
    g.position.set(p.x, p.y, p.z);
    trail.current?.update(a, camera.position);
    // Kept after landing until the trail behind the piece has landed too.
    if (a && glideDone(a)) glide.current = null;
  });

  return (
    <>
      <group
        ref={group}
        name={piece.id}
        position={[start[0], 0, start[1]]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {children}
      </group>
      {/* Beside the treasure, never round it: the treasure must not remount. */}
      {quality === 'high' && <QiTrail ref={trail} side={piece.color} />}
    </>
  );
}

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { Mesh, Vector3 } from 'three';
import type { Side } from '../../../game/coords';
import type { Glide } from '../glide';
import { QI_COLOR } from '../materials';
import { ribbonGeometry, ribbonMaterial, writeRibbon } from './qi-trail';

export interface QiTrailHandle {
  /** Lays the ribbon behind `glide` (hidden when there is none, or nothing left), facing `eye`. */
  update(glide: Glide | null, eye: Vector3): void;
}

/**
 * A piece's qi ribbon, in its sect's colour, in world space beside the piece. Its PieceView
 * drives it from its own frame, right after moving the piece, so the ribbon's head is where the
 * piece is in the very frame it is drawn.
 */
export const QiTrail = forwardRef<QiTrailHandle, { side: Side }>(function QiTrail({ side }, ref) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => ribbonGeometry(QI_COLOR[side]), [side]);
  // Its own, freed with it: a drop in quality takes every trail away at once.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useImperativeHandle(
    ref,
    () => ({
      update(glide, eye) {
        const m = mesh.current;
        if (m) m.visible = glide !== null && writeRibbon(geometry, glide, eye);
      },
    }),
    [geometry],
  );
  return (
    <mesh
      ref={mesh}
      name="qi-trail"
      geometry={geometry}
      material={ribbonMaterial()}
      visible={false}
      frustumCulled={false}
    />
  );
});

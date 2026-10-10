import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';

/** Where capture mode's camera stands and what it looks at, in world units. */
export interface CaptureView {
  position: [x: number, y: number, z: number];
  target: [x: number, y: number, z: number];
  /** Vertical field of view in degrees, when the battle's 40 can't take in a high moon. */
  fov?: number;
}

/**
 * Capture mode's camera (scripts/capture-arenas.mjs), in place of the player's rig: fixed, lower
 * than the rig's resting view and aimed above the board, so the arena's sun or moon shares the
 * frame with it. At rest the rig looks down on the board and shows no sky at all.
 */
export function CaptureCamera({ view }: { view: CaptureView }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...view.position);
    if (view.fov) {
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...view.target);
    camera.updateMatrixWorld();
  }, [camera, view]);
  return null;
}

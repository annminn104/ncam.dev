import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import type { ReviewView } from '../../capture';
import { homePosition } from './rig-math';

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

/**
 * The lineup's camera (capture mode's `lineup`): low over white's end, both rows of figures in
 * the 16:10 frame, the back row over the front one.
 */
export const LINEUP_VIEW: CaptureView = { position: [0, 3.8, 10.4], target: [0, -0.3, 0], fov: 29 };

/** The review's fixed cameras (capture mode's `view`, scripts/capture-presets.mjs --review). */
export const REVIEW_CAMERAS: Record<Exclude<ReviewView, 'orbit'>, CaptureView> = {
  // The player's resting view, as white.
  home: { position: homePosition('w'), target: [0, 0, 0], fov: 40 },
  // Low over white's front ranks.
  close: { position: [0.5, 1.95, 6.3], target: [0.5, 0.72, 3.5], fov: 40 },
  // Low over black's front ranks, from black's end.
  far: { position: [0.5, 1.95, -6.3], target: [0.5, 0.72, -3.5], fov: 40 },
};

/** A review camera: a fixed one by name, or `orbit`, once round the board every 20 s. */
export function ReviewCamera({ view }: { view: ReviewView }) {
  return view === 'orbit' ? <OrbitCamera /> : <CaptureCamera view={REVIEW_CAMERAS[view]} />;
}

function OrbitCamera() {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    // A pose from the clock, not a time span: fine when the loop restarts it (AGENTS.md).
    const a = (clock.elapsedTime / 20) * Math.PI * 2;
    camera.position.set(Math.sin(a) * 9, 4.2, Math.cos(a) * 9);
    camera.lookAt(0, 0.6, 0);
  });
  return null;
}

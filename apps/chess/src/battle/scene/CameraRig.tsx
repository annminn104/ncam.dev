import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { Side } from '../../game/coords';
import {
  DISTANCE,
  ORBIT,
  POLAR,
  azimuthOf,
  framingFit,
  homePosition,
  nearestAzimuth,
} from './rig-math';

export interface CameraRigHandle {
  reset(): void;
  faceSide(side: Side): void;
  pushIn(): void;
}

/**
 * Orbit camera: drag to rotate, wheel or pinch to zoom, no pan (truckSpeed 0 zeroes every
 * truck / pedestal path in camera-controls, mouse and touch alike). CameraControls stands in
 * for the spec's OrbitControls: it has the smooth transitions `faceSide` and `pushIn` need.
 */
export const CameraRig = forwardRef<CameraRigHandle, { initialSide: Side }>(function CameraRig(
  { initialSide },
  ref,
) {
  const controls = useRef<CameraControls>(null);
  const placed = useRef<CameraControls | null>(null);
  // Landscape screens get the distances below as written; a narrow one gets them scaled up so
  // the board's width still fits.
  const aspect = useThree((s) => s.size.width / s.size.height);
  const fit = framingFit(aspect);
  const fitted = useRef(fit);

  // Runs with the instance when it mounts, and again whenever this callback changes, so it
  // places each instance only once: later runs would snap the player's view back.
  const attach = useCallback(
    (c: CameraControls | null) => {
      controls.current = c;
      if (!c || placed.current === c) return;
      placed.current = c;
      void c.setLookAt(...homePosition(initialSide, fitted.current), 0, 0, 0, false);
    },
    [initialSide],
  );

  // A phone turned on its side (or a resized window): keep the player's zoom, rescaled to the
  // new shape of the screen.
  useEffect(() => {
    const before = fitted.current;
    fitted.current = fit;
    const c = controls.current;
    if (c && fit !== before) void c.dollyTo((c.distance * fit) / before, false);
  }, [fit]);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const c = controls.current;
        if (!c) return;
        void c.rotateTo(nearestAzimuth(c.azimuthAngle, azimuthOf(initialSide)), POLAR, true);
        void c.dollyTo(DISTANCE * fitted.current, true);
      },
      faceSide(side) {
        const c = controls.current;
        if (!c) return;
        void c.rotateAzimuthTo(nearestAzimuth(c.azimuthAngle, azimuthOf(side)), true);
      },
      pushIn() {
        void controls.current?.dollyTo(DISTANCE * fitted.current * 0.7, true);
      },
    }),
    [initialSide],
  );

  return (
    <CameraControls
      ref={attach}
      makeDefault
      minDistance={ORBIT.minDistance}
      maxDistance={ORBIT.maxDistance * fit}
      minPolarAngle={ORBIT.minPolar}
      maxPolarAngle={ORBIT.maxPolar}
      truckSpeed={0}
      smoothTime={0.35}
    />
  );
});

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import type { CameraPose } from '../scene/schema';

const DRIFT = 0.25; // metres

/** Phase 1 has only the `idle` mode: a slow drift around CAM_idle (spec §9 CameraRig). */
export function CameraRig({ pose }: { pose: CameraPose }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const base = useMemo(() => new Vector3(...pose.position), [pose]);

  useEffect(() => {
    camera.quaternion.set(...pose.rotation);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }, [camera, pose]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    camera.position.set(
      base.x + Math.sin(t * 0.05) * DRIFT,
      base.y + Math.sin(t * 0.07) * DRIFT * 0.3,
      base.z + Math.cos(t * 0.05) * DRIFT,
    );
  });
  return null;
}

/** A look around the player: a drag sets the target, frames ease toward it (src/scene/CameraRig.tsx). */
export interface Orbit {
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
}

export const YAW_LIMIT = (25 * Math.PI) / 180;
export const PITCH_LIMIT = (10 * Math.PI) / 180;
export const INITIAL_ORBIT: Orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/** A drag of the canvas's full width turns half a turn (then the limits apply). */
export function dragOrbit(orbit: Orbit, dx: number, dy: number, width: number): Orbit {
  const k = Math.PI / Math.max(width, 1);
  return {
    ...orbit,
    targetYaw: clamp(orbit.targetYaw - dx * k, YAW_LIMIT),
    targetPitch: clamp(orbit.targetPitch + dy * k, PITCH_LIMIT),
  };
}

export function stepOrbit(orbit: Orbit, dt: number, damping = 6): Orbit {
  const a = 1 - Math.exp(-damping * dt);
  return {
    ...orbit,
    yaw: orbit.yaw + (orbit.targetYaw - orbit.yaw) * a,
    pitch: orbit.pitch + (orbit.targetPitch - orbit.pitch) * a,
  };
}

export function resetOrbit(orbit: Orbit): Orbit {
  return { ...orbit, targetYaw: 0, targetPitch: 0 };
}

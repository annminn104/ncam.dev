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

/** A press that strays further than this (CSS px) from where it went down is a drag, not a tap. */
export const TAP_SLOP_PX = 10;
/** Two taps this close in time (ms) and place (CSS px) are a double tap. */
export const DOUBLE_TAP_MS = 350;
export const DOUBLE_TAP_PX = 30;

/** A touch that ended as a tap: when (ms) and where (CSS px). */
export interface Tap {
  at: number;
  x: number;
  y: number;
}

/**
 * Whether `next` is the second tap of a double tap that `previous` began. Touch has no reliable
 * dblclick (some browsers send none), so the camera counts the taps itself.
 */
export function isDoubleTap(previous: Tap | null, next: Tap): boolean {
  if (!previous) return false;
  const elapsed = next.at - previous.at;
  return (
    elapsed >= 0 &&
    elapsed <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_PX
  );
}

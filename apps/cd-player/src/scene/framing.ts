/**
 * The camera of the approved Cycles still, in three's Y-up metres. Blender's camera sat at
 * (-0.42, -0.80, 0.47) looking at (0.06, -0.01, 0.132); three's axes are (x, z, -y).
 */
export const FOV = 30;
const TARGET: readonly [number, number, number] = [0.06, 0.132, 0.01];
const DIRECTION = (() => {
  const d = [-0.48, 0.338, 0.79];
  const n = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / n, d[1] / n, d[2] / n] as const;
})();
/** The player with its lid open fits in this sphere (metres). */
const RADIUS = 0.23;
/** The tracklist drawer covers the right of a wide screen: aim right so the player sits left. */
const WIDE_SHIFT_X = 0.09;

export interface Frame {
  position: [number, number, number];
  target: [number, number, number];
}

/** How far the camera stands so the player fits both the width and the height. */
export function frameDistance(aspect: number, fovDeg = FOV, radius = RADIUS): number {
  const vertical = (fovDeg * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  return radius / Math.sin(Math.min(vertical, horizontal) / 2);
}

export function frameFor(aspect: number, wide: boolean, yaw = 0, pitch = 0): Frame {
  const distance = frameDistance(aspect) * (wide ? 1 : 1.08);
  const target: [number, number, number] = wide
    ? [TARGET[0] + WIDE_SHIFT_X, TARGET[1] + 0.01, TARGET[2]]
    : [TARGET[0], TARGET[1] - 0.02, TARGET[2]];
  const [dx, dy, dz] = DIRECTION;
  const x = dx * Math.cos(yaw) + dz * Math.sin(yaw);
  const z = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const horizontal = Math.hypot(x, z);
  const elevation = Math.atan2(dy, horizontal) + pitch;
  const nx = (x / horizontal) * Math.cos(elevation);
  const nz = (z / horizontal) * Math.cos(elevation);
  const ny = Math.sin(elevation);
  return {
    position: [target[0] + nx * distance, target[1] + ny * distance, target[2] + nz * distance],
    target,
  };
}

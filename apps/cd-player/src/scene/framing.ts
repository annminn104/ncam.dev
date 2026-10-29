/**
 * The hero camera, in three's Y-up metres, for cd-player.glb: the player alone, lid open, 0.30 m
 * wide, 0.32 high and 0.32 deep, centred at x = 0. Its angle and lens are those of the approved
 * Cycles still (Blender's camera sat at (-0.42, -0.80, 0.47); three's axes are (x, z, -y)); where it
 * looks and how far back it stands are set so that the whole player shows, whatever the screen
 * (src/scene/framing.test.ts projects the model's box through it).
 */
export const FOV = 30;
/** Where the camera looks before a wide or narrow screen shifts it: the player's centre line. */
const TARGET: readonly [number, number, number] = [0, 0.132, 0.01];
const DIRECTION = (() => {
  const d = [-0.48, 0.338, 0.79];
  const n = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / n, d[1] / n, d[2] / n] as const;
})();
/** The player with its lid open fits in a sphere about this big (metres). */
const RADIUS = 0.27;
/** The tracklist drawer covers the right of a wide screen: aim right so the player sits left of it. */
const WIDE_SHIFT_X = 0.11;
/** A wide screen also aims higher, which seats the player below the link bar. */
const WIDE_SHIFT_Y = 0.03;
/** A narrow screen aims lower, which lifts the player clear of the now-playing card. */
const NARROW_SHIFT_Y = -0.02;

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
    ? [TARGET[0] + WIDE_SHIFT_X, TARGET[1] + WIDE_SHIFT_Y, TARGET[2]]
    : [TARGET[0], TARGET[1] + NARROW_SHIFT_Y, TARGET[2]];
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

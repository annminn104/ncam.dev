/**
 * The hero camera, in three's Y-up metres, for cd-player.glb: the player alone, lid open, 0.30 m
 * wide, 0.32 high and 0.35 deep, centred at x = 0. Its angle and lens are those of the approved
 * Cycles still (Blender's camera sat at (-0.42, -0.80, 0.47); three's axes are (x, z, -y)). The
 * canvas is the page's stage alone (`.cdp-stage` in src/styles/app.css), which no panel covers, so
 * the camera aims at the player and stands just far enough back for the whole of it to show in a
 * canvas of any shape, whichever way the orbit turns it (src/scene/framing.test.ts projects the
 * model's box through `frameForViewport` over the shapes and the turns).
 */
export const FOV = 30;
/** Where the camera looks: the player's centre line, which leaves it in the middle of its canvas. */
const TARGET: readonly [number, number, number] = [0, 0.132, 0.01];
const DIRECTION = (() => {
  const d = [-0.48, 0.338, 0.79];
  const n = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / n, d[1] / n, d[2] / n] as const;
})();
/** The player with its lid open fits in a sphere about this big (metres). */
const RADIUS = 0.285;
/**
 * At or below this width (CSS px) the scene draws as on a phone, with a smaller shadow map and pixel
 * ratio (src/scene/PlayerScene.tsx). The layout's own breakpoints are in src/styles/app.css.
 */
const NARROW_MAX = 820;

export interface Frame {
  position: [number, number, number];
  target: [number, number, number];
}

/** How far the camera stands so that a sphere of `radius` round its aim fits the canvas. */
export function frameDistance(aspect: number, fovDeg = FOV, radius = RADIUS): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const vertical = radius / Math.sin(Math.atan(tanV));
  const horizontal = radius / Math.sin(Math.atan(tanV * aspect));
  return Math.max(vertical, horizontal);
}

/** Whether a screen this wide (CSS px) is drawn as a desktop's. */
export function isWide(width: number): boolean {
  return width > NARROW_MAX;
}

/** The hero frame for a canvas of this size (CSS px): what the camera rig holds, every frame. */
export function frameForViewport(width: number, height: number, yaw = 0, pitch = 0): Frame {
  return frameFor(width / Math.max(height, 1), yaw, pitch);
}

export function frameFor(aspect: number, yaw = 0, pitch = 0): Frame {
  const distance = frameDistance(aspect);
  const target: [number, number, number] = [TARGET[0], TARGET[1], TARGET[2]];
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

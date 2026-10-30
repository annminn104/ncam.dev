/**
 * The hero camera, in three's Y-up metres, for cd-player.glb: the player alone, lid open, 0.30 m
 * wide, 0.32 high and 0.35 deep, centred at x = 0. Its angle and lens are those of the approved
 * Cycles still (Blender's camera sat at (-0.42, -0.80, 0.47); three's axes are (x, z, -y)). Where it
 * looks and how far back it stands are set for each screen shape so that the whole player shows
 * (src/scene/framing.test.ts projects the model's box through `frameForViewport` at the shapes the
 * layout has). Where the link bar stacks the player also sits below it; on a single-row screen
 * shorter than about 760 px the bar can still cover the lid's top rim.
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
const RADIUS = 0.285;
/** The tracklist drawer covers the right of a wide screen: aim right so the player sits left of it. */
const WIDE_SHIFT_X = 0.11;
/** A wide screen also aims higher, which seats the player below the link bar. */
const WIDE_SHIFT_Y = 0.03;
/** A narrow screen aims lower, which lifts the player clear of the now-playing card. */
const NARROW_SHIFT_Y = -0.02;

// The widths (CSS px) where the layout changes, in src/styles/app.css.
/** The tracklist is a drawer beside the player above this width, a bottom sheet at or below it. */
const SHEET_MAX = 820;
/** The link bar stacks (its form drops under the title) from the drawer up to this width. */
const STACKED_MAX = 1260;
/** Where the stacked bar ends, px from the top: 160 at 821 wide to 169 at 1260 (its title grows). */
const STACKED_BAR_PX = 170;
/** The most of the height the bar may take from the player, so a very short screen still fits it. */
const MAX_INSET = 0.6;

export interface Frame {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * How far the camera stands so the player fits the screen: in the height the link bar leaves
 * (`topInset`, the bar's share of the height) and, when the aim is `shiftX` to the right of the
 * player, in a width that reaches that much further to its left.
 */
export function frameDistance(
  aspect: number,
  fovDeg = FOV,
  radius = RADIUS,
  shiftX = 0,
  topInset = 0,
): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const vertical = radius / Math.sin(Math.atan(tanV * (1 - topInset)));
  const horizontal = (radius + shiftX) / Math.sin(Math.atan(tanV * aspect));
  return Math.max(vertical, horizontal);
}

/** Whether a screen this wide (CSS px) lays out as a desktop: the one rule the scene shares. */
export function isWide(width: number): boolean {
  return width > SHEET_MAX;
}

/** The hero frame for a canvas of this size (CSS px): what the camera rig holds, every frame. */
export function frameForViewport(width: number, height: number, yaw = 0, pitch = 0): Frame {
  const clamped = Math.max(height, 1);
  const wide = isWide(width);
  const topInset = wide && width <= STACKED_MAX ? Math.min(MAX_INSET, STACKED_BAR_PX / clamped) : 0;
  return frameFor(width / clamped, wide, yaw, pitch, topInset);
}

export function frameFor(aspect: number, wide: boolean, yaw = 0, pitch = 0, topInset = 0): Frame {
  const distance =
    frameDistance(aspect, FOV, RADIUS, wide ? WIDE_SHIFT_X : 0, topInset) * (wide ? 1 : 1.08);
  // Aimed higher by a quarter of the bar's height (half its share of the view's half-height), the
  // player sits in the middle of what the bar leaves: it already sits a little low, and
  // src/scene/framing.test.ts holds the result.
  const lift = (topInset / 2) * distance * Math.tan((FOV * Math.PI) / 360);
  const target: [number, number, number] = wide
    ? [TARGET[0] + WIDE_SHIFT_X, TARGET[1] + WIDE_SHIFT_Y + lift, TARGET[2]]
    : [TARGET[0], TARGET[1] + NARROW_SHIFT_Y + lift, TARGET[2]];
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

import { DEFAULT_MODEL, type ModelId } from '../models';
import { SCENE_PROFILES } from './profiles';

/**
 * The hero camera, in three's Y-up metres. Each model has its own aim, direction and fit in
 * src/scene/profiles.ts. The suitcase (cd-player.glb) is framed as the player alone, lid open,
 * 0.30 m wide, 0.32 high and 0.35 deep, centred at x = 0: its angle and lens are those of the
 * approved Cycles still (Blender's camera sat at (-0.42, -0.80, 0.47); three's axes are (x, z, -y)).
 * The canvas is the page's stage alone (`.cdp-stage` in src/styles/app.css), which no panel covers,
 * so the camera aims at the model and stands just far enough back for a box of the profile's half-width
 * (`across`) and half-height (`up`) round the aim to show in a canvas of any shape, whichever way
 * the orbit turns it (src/scene/framing.test.ts projects each model's box through
 * `frameForViewport` over the shapes and the turns).
 */
export const FOV = 30;
/**
 * The camera's near and far planes (metres). `NEAR` is the suitcase's near plane, and every model
 * without a near of its own in its profile: the suitcase's camera is never nearer than about
 * 1.1 m to the player's middle (0.8 m to its nearest corner), so the plane stands as far out as
 * the frame allows. A model's profile may name its own near plane, as the Clear's does (0.52);
 * `nearFor` reads it. A depth buffer's step grows with the square of the distance over the near
 * plane, and the disc's printed layers are microns apart (src/scene/framing.test.ts). At 0.02 m
 * they fought, and every disc's rim and hub ring came out ragged.
 */
export const NEAR = 0.5;
export const FAR = 10;
/**
 * At or below this width (CSS px) the scene draws as on a phone, with a smaller shadow map and pixel
 * ratio (src/scene/PlayerScene.tsx). The layout's own breakpoints are in src/styles/app.css.
 */
const NARROW_MAX = 820;

export interface Frame {
  position: [number, number, number];
  target: [number, number, number];
}

/** The near plane for this model: its profile's own, or NEAR. */
export function nearFor(model: ModelId): number {
  return SCENE_PROFILES[model].near ?? NEAR;
}

/**
 * How far the camera stands so that what lies within `across` (half its width) and `up` (half its
 * height) of its aim fits the canvas: the sphere of that radius when the two are equal.
 */
export function frameDistance(
  aspect: number,
  fovDeg = FOV,
  across = SCENE_PROFILES[DEFAULT_MODEL].frame.across,
  up = SCENE_PROFILES[DEFAULT_MODEL].frame.up,
): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const vertical = up / Math.sin(Math.atan(tanV));
  const horizontal = across / Math.sin(Math.atan(tanV * aspect));
  return Math.max(vertical, horizontal);
}

/** Whether a screen this wide (CSS px) is drawn as a desktop's. */
export function isWide(width: number): boolean {
  return width > NARROW_MAX;
}

/** The hero frame for a canvas of this size (CSS px): what the camera rig holds, every frame. */
export function frameForViewport(
  width: number,
  height: number,
  yaw = 0,
  pitch = 0,
  model: ModelId = DEFAULT_MODEL,
): Frame {
  return frameFor(width / Math.max(height, 1), yaw, pitch, model);
}

export function frameFor(
  aspect: number,
  yaw = 0,
  pitch = 0,
  model: ModelId = DEFAULT_MODEL,
): Frame {
  const { target: aim, direction, across, up } = SCENE_PROFILES[model].frame;
  const distance = frameDistance(aspect, FOV, across, up);
  const target: [number, number, number] = [aim[0], aim[1], aim[2]];
  const [dx, dy, dz] = direction;
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

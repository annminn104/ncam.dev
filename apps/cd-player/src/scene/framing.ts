import { DEFAULT_MODEL, type ModelId } from '../models';
import { SCENE_PROFILES, type Vec3 } from './profiles';
import { NO_PAN, type Pan } from './zoom';

/**
 * The hero camera, in three's Y-up metres. Each model has its own aim, direction and fit in
 * src/scene/profiles.ts. The suitcase (cd-player.glb) is framed as the player alone, lid open,
 * 0.30 m wide, 0.32 high and 0.35 deep, centred at x = 0: its angle and lens are those of the
 * approved Cycles still (Blender's camera sat at (-0.42, -0.80, 0.47); three's axes are (x, z, -y)).
 * The canvas is the page's stage alone (`.cdp-stage` in src/styles/app.css), which no panel covers,
 * so the camera aims at the model and stands just far enough back for a box of the profile's half-width
 * (`across`) and half-height (`up`) round the aim to show in a canvas of any shape, whichever way
 * the orbit turns it (src/scene/framing.test.ts projects each model's box through
 * `frameForViewport` over the shapes and the turns). The zoom (src/scene/zoom.ts) magnifies that
 * framing with the lens (the camera's `zoom`), never by bringing the camera nearer, and pans it.
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
  pan: Pan = NO_PAN,
): Frame {
  return frameFor(width / Math.max(height, 1), yaw, pitch, model, pan);
}

type V3 = [number, number, number];
const add = (a: Vec3, b: Vec3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * A camera's right and up axes, looking back along `toward` (a unit vector from its aim toward
 * it), as three's lookAt makes them with the world's Y up.
 */
function axesFor(toward: Vec3): { right: V3; up: V3 } {
  const across = Math.hypot(toward[0], toward[2]);
  const right: V3 = [toward[2] / across, 0, -toward[0] / across];
  const up: V3 = [
    toward[1] * right[2] - toward[2] * right[1],
    toward[2] * right[0] - toward[0] * right[2],
    toward[0] * right[1] - toward[1] * right[0],
  ];
  return { right, up };
}

/** The way from the aim to the camera: the profile's direction, turned by the orbit. */
function towardCamera(direction: Vec3, yaw: number, pitch: number): V3 {
  const [dx, dy, dz] = direction;
  const x = dx * Math.cos(yaw) + dz * Math.sin(yaw);
  const z = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const horizontal = Math.hypot(x, z);
  const elevation = Math.atan2(dy, horizontal) + pitch;
  return [
    (x / horizontal) * Math.cos(elevation),
    Math.sin(elevation),
    (z / horizontal) * Math.cos(elevation),
  ];
}

/**
 * The frame: where the camera stands and what it aims at. The aim is the profile's, panned
 * (zoom.ts) in the aim's plane, the plane through the profile's aim square to its direction, along
 * the hero camera's right and up axes; the camera stands the fitted distance from the panned aim,
 * the way the orbit turns it. So the orbit turns about the panned aim, and the pan moves the camera
 * with the aim.
 */
export function frameFor(
  aspect: number,
  yaw = 0,
  pitch = 0,
  model: ModelId = DEFAULT_MODEL,
  pan: Pan = NO_PAN,
): Frame {
  const { target: aim, direction, across, up } = SCENE_PROFILES[model].frame;
  const distance = frameDistance(aspect, FOV, across, up);
  const hero = axesFor(direction);
  const target = add(aim, add(scale(hero.right, pan[0]), scale(hero.up, pan[1])));
  return { position: add(target, scale(towardCamera(direction, yaw, pitch), distance)), target };
}

/** A point on the canvas in normalised device coordinates: −1 to 1, left to right, bottom to top. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * The pan at `nextZoom` that puts the point of the aim's plane under `from` (seen at `zoom` and
 * `pan`) under `to`: the same canvas point for the wheel, the fingers' new midpoint for a pinch.
 * The aim's plane holds every panned aim. With the orbit at its middle the pan moves by the point's
 * share of the view times (1/zoom − 1/nextZoom); turned, a pan also moves the camera along the
 * view, which the solve allows for: the new aim is found on the plane, at the fitted distance down
 * the camera's axis from the point's ray through `to`.
 */
export function panKeeping(
  aspect: number,
  yaw: number,
  pitch: number,
  model: ModelId,
  zoom: number,
  pan: Pan,
  from: CanvasPoint,
  to: CanvasPoint,
  nextZoom: number,
): Pan {
  const { target: aim, direction, across, up } = SCENE_PROFILES[model].frame;
  const distance = frameDistance(aspect, FOV, across, up);
  const eye = frameFor(aspect, yaw, pitch, model, pan).position;
  const toward = towardCamera(direction, yaw, pitch);
  const view = axesFor(toward);
  const tan = Math.tan((FOV * Math.PI) / 360);
  // The way into the scene through a canvas point, the lens magnifying by `lens`.
  const ray = (point: CanvasPoint, lens: number) =>
    add(
      scale(toward, -1),
      add(
        scale(view.right, (point.x * tan * aspect) / lens),
        scale(view.up, (point.y * tan) / lens),
      ),
    );
  const before = ray(from, zoom);
  const point = add(eye, scale(before, dot(sub(aim, eye), direction) / dot(before, direction)));
  // point = aim′ + toward · distance + reach · after, with aim′ on the plane.
  const after = ray(to, nextZoom);
  const reach = (-distance * dot(toward, direction)) / dot(after, direction);
  const offset = sub(sub(sub(point, scale(toward, distance)), scale(after, reach)), aim);
  const hero = axesFor(direction);
  return [dot(offset, hero.right), dot(offset, hero.up)];
}

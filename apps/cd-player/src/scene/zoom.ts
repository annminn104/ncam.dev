import type { ZoomLimits } from '../camera-channel';

/**
 * The zoom (src/scene/CameraRig.tsx): how far the lens magnifies the hero framing, from 1× (today's
 * framing, which never gets smaller) to 3×, and where the view is panned to. An input sets the
 * targets; frames ease toward them, as the orbit's do (orbit.ts).
 */

/**
 * Where the aim is panned to (metres): along the hero camera's right and up axes, in the plane
 * through the profile's aim square to its direction (src/scene/framing.ts).
 */
export type Pan = readonly [number, number];

export interface Zoom {
  zoom: number;
  pan: Pan;
  targetZoom: number;
  targetPan: Pan;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
/** One press of a button or a key, and one notch of a mouse wheel. */
export const ZOOM_STEP = 1.25;

export const NO_PAN: Pan = [0, 0];
export const INITIAL_ZOOM: Zoom = { zoom: 1, pan: NO_PAN, targetZoom: 1, targetPan: NO_PAN };

/** Half the frame round its aim each way (metres): the profile's `across` and `up`. */
export interface PanBounds {
  across: number;
  up: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/**
 * The pan held within (1 − 1/zoom) of the frame's half-size each way: none at 1×, so the model is
 * never lost, and a zoom out slides the frame back.
 */
export function clampPan(pan: Pan, zoom: number, { across, up }: PanBounds): Pan {
  const room = 1 - 1 / zoom;
  if (room <= 0) return NO_PAN;
  return [clamp(pan[0], room * across), clamp(pan[1], room * up)];
}

/**
 * Zooms the target by `factor`, within 1× and 3×. `keep` is the pan at the new zoom that keeps the
 * point under the pointer where it is (framing.ts panKeeping; the buttons and the keys keep the
 * pan, so they zoom toward the view's centre), then held within clampPan, where that point slides.
 */
export function zoomBy(
  state: Zoom,
  factor: number,
  keep: (zoom: number) => Pan,
  bounds: PanBounds,
): Zoom {
  const targetZoom = clampZoom(state.targetZoom * factor);
  return { ...state, targetZoom, targetPan: clampPan(keep(targetZoom), targetZoom, bounds) };
}

/** Back to 1× and no pan, eased. */
export function resetZoom(state: Zoom): Zoom {
  return { ...state, targetZoom: ZOOM_MIN, targetPan: NO_PAN };
}

/** Closer than this to the target, in the lens's reach and in metres, a frame settles on it. */
const SETTLED = 1e-6;

/**
 * Eases toward the target at `damping` per second, as stepOrbit does. The lens's reach (1 / zoom)
 * eases with the pan, by the same share: then a point the zoom keeps under the pointer stays
 * there on the way, not only at the end. Close enough, it settles on the target.
 */
export function stepZoom(state: Zoom, dt: number, damping = 6): Zoom {
  const { zoom, pan, targetZoom, targetPan } = state;
  const a = 1 - Math.exp(-damping * dt);
  const reach = 1 / zoom + (1 / targetZoom - 1 / zoom) * a;
  const next: Pan = [pan[0] + (targetPan[0] - pan[0]) * a, pan[1] + (targetPan[1] - pan[1]) * a];
  const settled =
    Math.abs(reach - 1 / targetZoom) < SETTLED &&
    Math.abs(next[0] - targetPan[0]) < SETTLED &&
    Math.abs(next[1] - targetPan[1]) < SETTLED;
  if (settled) return { ...state, zoom: targetZoom, pan: targetPan };
  return { ...state, zoom: 1 / reach, pan: next };
}

/** Where the zoom is going, for the buttons (src/camera-channel.ts). */
export function zoomLimits(state: Zoom): ZoomLimits {
  return { atMin: state.targetZoom <= ZOOM_MIN, atMax: state.targetZoom >= ZOOM_MAX };
}

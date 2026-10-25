import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { pickable } from '../interact/pick';
import type { CutLevel } from '../scene/cutaway';
import type { CameraPose } from '../scene/schema';
import { useAppStore } from '../state/store';
import { type CursorOrbit, createCursorOrbit, type ScenePick } from './cursorOrbit';
import { type HouseBounds, nearFor, orbitTarget } from './orbit';

/** Name of the group SceneRoot puts every module slot in: what a zoom or a drag picks the point under the cursor from. */
export const MODULES_GROUP = 'site-modules';

interface Props {
  pose: CameraPose;
  /** The house the camera keeps out of and the dollhouse cut measures from (houseBounds), null without one. */
  house: HouseBounds | null;
}

/** A press that turns the camera: the primary button without the keys OrbitControls takes for a pan, or one finger. */
function rotates(event: PointerEvent): boolean {
  if (!event.isPrimary) return false;
  return (
    event.pointerType === 'touch' ||
    (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey)
  );
}

/**
 * Site route: drag to orbit, wheel or pinch to zoom, starting from CAM_idle and turning around the point it looks at on
 * the ground. Zoom and rotation follow the cursor (createCursorOrbit): a zoom goes towards the point under the cursor
 * (the pinch's centre), a drag turns round the point under the press; both move the orbit target, which stays on the
 * island. The polar limit follows the distance and the target (maxPolarFor) so the camera stays out of the island and
 * the house. Each frame also picks the dollhouse cut for the camera by its distance to the house, or the level a floor
 * button holds (cutFor, interaction spec §2): the house and the basement apply it, and while it is on the camera may
 * come lower than the roof line; and whether the camera is near the house (nearFor), which the interior's small things
 * show for, the house whole or cut. A floor button also eases the camera to the house from afar, or up to the floor of the
 * level it picks (createCursorOrbit's choose). The wallpaper keeps the non-interactive CameraRig.
 */
export function OrbitRig({ pose, house }: Props) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const domElement = useThree((state) => state.gl.domElement);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const setCutLevel = useAppStore((s) => s.setCutLevel);
  const setNear = useAppStore((s) => s.setNear);
  const floorPress = useAppStore((s) => s.floorPress);
  const rig = useRef<CursorOrbit | null>(null);
  /** The floor presses the rig has answered: the mount takes the count it finds (its mode is the store's already). */
  const pressed = useRef(useAppStore.getState().floorPress);
  const level = useRef<CutLevel>('none');
  const near = useRef(useAppStore.getState().near);
  const idle = useMemo(() => orbitTarget(pose), [pose]);

  useEffect(() => {
    camera.position.set(...pose.position);
    camera.quaternion.set(...pose.rotation);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    const orbit = new OrbitControls(camera, domElement);
    orbit.target.set(...idle);
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    // The modules' meshes report only what the user can see (filterRaycasts); pickable drops the rest of the scene's.
    const pick: ScenePick = (x, y, origin) => {
      const modules = scene.getObjectByName(MODULES_GROUP);
      if (!modules) return null;
      const rect = domElement.getBoundingClientRect();
      ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      camera.updateMatrixWorld(); // OrbitControls has just moved it; three only brings the matrix up to date when it draws
      raycaster.setFromCamera(ndc, camera);
      if (origin) raycaster.ray.origin.copy(origin);
      const hit = raycaster.intersectObject(modules, true).find(pickable);
      return hit ? hit.point.clone() : null;
    };
    const cursor = createCursorOrbit(orbit, pick, house);
    cursor.mode = useAppStore.getState().cutMode;
    // FrameLimiter keeps invalidating the demand frameloop at ?fps=; this adds a frame for every drag step and damping
    // step, so while the user is moving the camera it draws more often than the limit. That is intended on the website
    // (the limit is for an idle scene, and the wallpaper has no controls); it also covers a limit of a few fps. The rig's
    // own moves (the pivot, the zoom towards the cursor) follow an OrbitControls change, or happen in a frame.
    const onChange = () => invalidate();
    orbit.addEventListener('change', onChange);
    rig.current = cursor;

    // OrbitControls listens on the canvas (press, wheel) and, while a button is down, on the document (moves): the rig's
    // listeners on the canvas and the window come after its own, so they see what it did with the event.
    const touches = new Map<number, [number, number]>();
    let dolly: [number, number] | null = null; // where a middle-button dolly drag began
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch')
        touches.set(event.pointerId, [event.clientX, event.clientY]);
      if (event.button === 1) dolly = [event.clientX, event.clientY];
      cursor.press(event.clientX, event.clientY, rotates(event));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (touches.has(event.pointerId))
        touches.set(event.pointerId, [event.clientX, event.clientY]);
      if (touches.size === 2) {
        const [[ax, ay], [bx, by]] = touches.values();
        cursor.zoomed((ax + bx) / 2, (ay + by) / 2); // a pinch zooms towards the point between the fingers
      } else if (dolly && event.buttons & 4) cursor.zoomed(...dolly);
    };
    const onPointerUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (event.button === 1) dolly = null;
    };
    const onWheel = (event: WheelEvent) => cursor.zoomed(event.clientX, event.clientY);
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // e2e: the live camera, to check it never goes under the grass or into the house, the cut it shows, what it turns
    // round; the point under a client (x, y) and where a world point shows, to zoom and drag on a given spot.
    const state = () => ({
      position: camera.position.toArray(),
      target: orbit.target.toArray(),
      distance: orbit.getDistance(),
      polar: cursor.polar,
      cut: level.current,
      near: near.current,
      mode: cursor.mode,
      easing: cursor.easing,
      house: house?.focus ?? null,
      pivot: cursor.pivot?.toArray() ?? null,
    });
    window.__camera = Object.assign(state, {
      pick: (x: number, y: number) => pick(x, y)?.toArray() ?? null,
      project(point: readonly number[]) {
        camera.updateMatrixWorld();
        const seen = new Vector3(point[0], point[1], point[2]).project(camera);
        if (Math.abs(seen.x) > 1 || Math.abs(seen.y) > 1 || Math.abs(seen.z) > 1) return null;
        const rect = domElement.getBoundingClientRect();
        return {
          x: rect.left + ((seen.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - seen.y) / 2) * rect.height,
        };
      },
    });
    return () => {
      delete window.__camera;
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      orbit.removeEventListener('change', onChange);
      cursor.dispose();
      orbit.dispose();
      rig.current = null;
    };
  }, [camera, domElement, scene, invalidate, pose, idle, house]);

  // a floor button, the one already on too: the cut follows it from the next frame on and the camera eases where it
  // shows it (choose), which needs drawing (the frameloop is on demand); the mount has given the rig the mode it found
  useEffect(() => {
    if (rig.current && floorPress !== pressed.current)
      rig.current.choose(useAppStore.getState().cutMode);
    pressed.current = floorPress;
    invalidate();
  }, [floorPress, invalidate]);

  useFrame((_, delta) => {
    const cursor = rig.current;
    if (!cursor) return;
    cursor.frame(delta); // before the frame is drawn, so no frame shows the camera inside the island or the house
    if (cursor.easing) invalidate(); // the next step of a floor button's ease
    if (cursor.level !== level.current) {
      level.current = cursor.level;
      setCutLevel(cursor.level);
    }
    const close = house !== null && nearFor(camera.position.toArray(), house, near.current);
    if (close !== near.current) {
      near.current = close;
      setNear(close);
    }
  });
  return null;
}

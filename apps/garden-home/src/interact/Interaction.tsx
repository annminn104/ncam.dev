import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Box3, Box3Helper, type Material, type Object3D, Vector3 } from 'three';
import { useAppStore } from '../state/store';
import { groupKind, interactiveNode } from './groups';
import { shown, shownBox } from './pick';
import { createDragWatch, createHoverWatch } from './pointer';
import { globalUniforms } from '../systems/uniforms';
import { isOn, isToggled, playsOnce } from './toggles';

const HOVER_COLOR = '#ffd98a';

/** The node under the pointer, kept beside the store's hover (Object3D is not plain data). */
let hovered: Object3D | null = null;

/** Forgets the hovered node (the mount's release): it belonged to the scene that went. */
export function resetHover(): void {
  hovered = null;
}

/** How far the press before the next click strayed (InteractionLayer feeds it from the canvas). */
const drag = createDragWatch();

/**
 * Pointer handlers for a module's root on the site route (interaction spec §3.2). R3F raycasts the roots that carry
 * them, nearest hit first (the meshes already dropped what the user cannot reach, filterRaycasts); the nearest hit
 * decides: an item with interact extras is hovered (label, pointer cursor, outline) and a click toggles its group,
 * anything else (a wall, the lawn) clears the hover; a click on the koi pond's water feeds the koi instead, and one on
 * the Akita plays its happy clip once (store.play). A press that strayed more than CLICK_SLOP at any time is the
 * orbit's drag and toggles nothing, even when it is released where it began; while a button is down nothing hovers.
 */
export function useInteractionHandlers(enabled: boolean) {
  const setHover = useAppStore((s) => s.setHover);
  const toggle = useAppStore((s) => s.toggle);
  return useMemo(() => {
    if (!enabled) return {};
    return {
      onPointerMove(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        const node = event.buttons ? null : interactiveNode(event.object);
        hovered = node;
        if (!node) return setHover(null);
        const group = node.userData.interact as string;
        const label = typeof node.userData.label === 'string' ? node.userData.label : group;
        const name = typeof node.userData.name === 'string' ? node.userData.name : node.name;
        setHover({
          group,
          label,
          node: name,
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
        });
      },
      onPointerOut() {
        hovered = null;
        setHover(null);
      },
      onClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        if (drag.dragged) return;
        const node = interactiveNode(event.object);
        if (!node) return;
        const group = node.userData.interact as string;
        if (!isToggled(groupKind(group))) {
          const store = useAppStore.getState();
          if (playsOnce(groupKind(group)))
            store.play(group); // the dog: its happy clip, once
          // the pond's water: the koi gather where the click fell, from now on the shared clock
          else
            store.feedKoi(
              event.point.toArray() as [number, number, number],
              globalUniforms.uTime.value,
            );
          return;
        }
        const { toggles, nightFactor } = useAppStore.getState();
        toggle(group, isOn(groupKind(group), toggles[group], nightFactor));
      },
    };
  }, [enabled, setHover, toggle]);
}

/**
 * Inside <Canvas> on the site route: sets the pointer cursor and draws a thin box round what is drawn of the hovered
 * item (shownBox: no higher than the cut lets it show), which follows the item when it moves (a sliding door). Watches
 * the presses on the canvas for drags, and while an item is hovered
 * asks R3F to pick again under the resting pointer whenever the camera, the cut or the item itself moved, so the label
 * and the box never name something that is no longer under it; an item a click hid (the waterfall's sheet) loses its
 * box and label at once, and the pick finds what is behind it. Sets window.__interact for the e2e.
 */
export function InteractionLayer() {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const events = useThree((state) => state.events);
  const item = useAppStore((s) => s.hover?.node ?? null);
  const box = useMemo(() => {
    const helper = new Box3Helper(new Box3(), HOVER_COLOR); // an empty box until something is hovered
    helper.visible = false;
    helper.raycast = () => {}; // never in the way of a pick
    return helper;
  }, []);
  const watch = useMemo(createHoverWatch, []);
  const itemBox = useMemo(() => new Box3(), []);

  useEffect(
    () => () => {
      box.geometry.dispose();
      (box.material as Material).dispose();
    },
    [box],
  );

  useEffect(() => {
    canvas.style.cursor = item ? 'pointer' : '';
    if (item && hovered) shownBox(hovered, box.box);
    box.visible = item !== null && hovered !== null && !box.box.isEmpty();
    invalidate();
  }, [item, box, canvas, invalidate]);

  // OrbitControls captures the pointer on a press, so these see every move of a drag, also outside the canvas.
  useEffect(() => {
    const primary = (act: (event: PointerEvent) => void) => (event: PointerEvent) => {
      if (event.isPrimary) act(event);
    };
    const listeners = {
      pointerdown: primary((event) => drag.press(event.clientX, event.clientY)),
      pointermove: primary((event) => drag.move(event.clientX, event.clientY)),
      pointerup: primary(() => drag.release()),
      pointercancel: primary(() => drag.release()),
    };
    for (const [type, listener] of Object.entries(listeners))
      canvas.addEventListener(type, listener as EventListener);
    return () => {
      for (const [type, listener] of Object.entries(listeners))
        canvas.removeEventListener(type, listener as EventListener);
    };
  }, [canvas]);

  useFrame(() => {
    const node = hovered;
    camera.updateMatrixWorld(); // OrbitRig has just moved it; three only brings the matrix up to date when it draws
    const visible = node !== null && shown(node);
    const bounds = node ? itemBox.setFromObject(node) : null;
    const moved = watch.changed(
      camera.matrixWorld,
      useAppStore.getState().cutLevel,
      bounds,
      visible,
    );
    if (!node) return;
    if (visible) box.visible = !shownBox(node, box.box).isEmpty();
    else {
      // a click hid it: no box or label round what is not there; the pick below finds what is behind it, if anything
      hovered = null;
      box.visible = false;
      useAppStore.getState().setHover(null);
    }
    if (moved) events.update?.(); // the pointer is not moving, so R3F would not look again by itself
  });

  useEffect(() => {
    window.__interact = {
      at(name) {
        let node: Object3D | null = null;
        scene.traverse((object) => {
          if (!node && object.userData.name === name) node = object;
        });
        if (!node) return null;
        const ndc = new Box3().setFromObject(node).getCenter(new Vector3()).project(camera);
        if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) return null;
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + ((ndc.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - ndc.y) / 2) * rect.height,
        };
      },
      state() {
        const { toggles, hover, feed, plays } = useAppStore.getState();
        return {
          toggles,
          hover: hover && { group: hover.group, label: hover.label, node: hover.node },
          feed,
          plays,
        };
      },
      toggle(group) {
        const { toggles, nightFactor, toggle } = useAppStore.getState();
        toggle(group, isOn(groupKind(group), toggles[group], nightFactor)); // what a click on one of its items does
      },
    };
    return () => {
      delete window.__interact;
    };
  }, [scene, camera, canvas]);

  return <primitive object={box} />;
}

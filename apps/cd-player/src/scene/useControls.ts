import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import {
  BUTTON_ACTIONS,
  BUTTON_NODES,
  hitFor,
  PRESS_MS,
  pressDepth,
  pressesOnDown,
  stillTap,
  type ButtonNode,
  type KeyTouch,
} from './controls';
import { interaction } from './interaction';
import type { Rig } from './rig';
import type { Grip } from './useGrip';

/**
 * R3F reports a pointer event once per mesh under the pointer, nearest first: only the nearest
 * counts, for a press as for the cursor, so both agree about what hides a control.
 */
const isNearest = (event: ThreeEvent<PointerEvent>) =>
  event.object === event.intersections[0]?.object;

/**
 * Pointer handlers for the player: press the keys, and hand a press on the knob or the tonearm's
 * head to its grip. A mouse or a pen presses a key as it goes down; a touch as it lifts, if it
 * stayed a tap, so a pinch whose first finger lands on a key presses nothing (controls.ts stillTap).
 */
export function useControls(rig: Rig, bridge: SceneBridge, grip: Grip | null) {
  const gl = useThree((state) => state.gl);
  const presses = useRef(new Map<ButtonNode, number>());
  const keyBase = useMemo(
    () => new Map(BUTTON_NODES.map((name) => [name, rig.model.nodes[name].position.y])),
    [rig],
  );
  // The key sinks and comes back, and its action goes to the app.
  const pressKey = (node: ButtonNode) => {
    presses.current.set(node, performance.now());
    bridge.emit(BUTTON_ACTIONS[node]);
  };
  const pressRef = useRef(pressKey);
  pressRef.current = pressKey;
  // A touch on a key, which presses it as it lifts.
  const touching = useRef<KeyTouch | null>(null);

  useFrame(() => {
    const now = performance.now();
    for (const [name, at] of presses.current) {
      const elapsed = now - at;
      rig.model.nodes[name].position.y = (keyBase.get(name) ?? 0) - pressDepth(elapsed);
      if (elapsed >= PRESS_MS) presses.current.delete(name);
    }
  });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const touch = touching.current;
      // A touch that strays from its key, or sees a pinch begin, is not a tap any more.
      if (touch?.id === event.pointerId) {
        if (!stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
          touching.current = null;
        }
      }
    };
    const up = (event: PointerEvent) => {
      const touch = touching.current;
      if (touch?.id !== event.pointerId) return;
      touching.current = null;
      if (stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
        pressRef.current(touch.node);
      }
    };
    const cancel = (event: PointerEvent) => {
      if (touching.current?.id === event.pointerId) touching.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      // The primary button (or a touch) on the nearest mesh: a press does what the cursor says. A
      // touch that lands while another is down pinches (the camera has said so by now), and
      // presses nothing.
      if (event.button !== 0 || !isNearest(event)) return;
      if (event.pointerType === 'touch' && interaction.pinching) return;
      const hit = hitFor(event.object);
      if (!hit) return;
      interaction.controlActive = true;
      const { clientX, clientY } = event.nativeEvent;
      if (hit.kind === 'button') {
        // A mouse or a pen presses now; a touch waits to lift.
        if (pressesOnDown(event.pointerType)) {
          pressKey(hit.node);
          return;
        }
        const { pointerId: id } = event;
        touching.current = {
          id,
          node: hit.node,
          x: clientX,
          y: clientY,
          pinches: interaction.pinches,
        };
        return;
      }
      // A press the knob takes no turn from (or the arm no drag) still neither orbits nor
      // recentres (controlActive).
      if (grip?.kind === hit.kind)
        grip.down(event.pointerId, clientX, clientY, interaction.pinches);
    },
    // R3F hovers the player as one (its handlers sit on the root) for as long as the first mesh it
    // met stays under the pointer, so over would miss a key met from the deck: the cursor follows
    // every move instead.
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (isNearest(event)) gl.domElement.style.cursor = hitFor(event.object) ? 'pointer' : '';
    },
    onPointerOut: () => {
      gl.domElement.style.cursor = '';
    },
  };
}

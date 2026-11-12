import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
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
import { interaction, releaseLost } from './interaction';
import { knobTurns } from './knob-turn';
import { SCENE_PROFILES } from './profiles';
import type { Rig } from './rig';

/**
 * R3F reports a pointer event once per mesh under the pointer, nearest first: only the nearest
 * counts, for a press as for the cursor, so both agree about what hides a control.
 */
const isNearest = (event: ThreeEvent<PointerEvent>) =>
  event.object === event.intersections[0]?.object;

/**
 * Pointer handlers for the player: press the keys, turn the knob to scrub. A mouse or a pen
 * presses a key as it goes down; a touch as it lifts, if it stayed a tap, so a pinch whose first
 * finger lands on a key presses nothing (controls.ts stillTap).
 */
export function useControls(rig: Rig, bridge: SceneBridge) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const presses = useRef(new Map<ButtonNode, number>());
  const keyBase = useMemo(
    () => new Map(BUTTON_NODES.map((name) => [name, rig.model.nodes[name].position.y])),
    [rig],
  );
  const knob = rig.model.nodes.knob;
  const follows = SCENE_PROFILES[rig.model.id].knobTurnsDisc === true;
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

  // A turn of the knob is followed on the window, so it survives leaving the knob's mesh. It is
  // read around the middle of the knob's top, where the pointer lands (its pivot is at the base).
  const centre = useRef(new Vector3());
  const lift = useMemo(
    () => new Box3().setFromObject(knob).max.y - knob.getWorldPosition(new Vector3()).y,
    [knob],
  );
  const angleAt = (clientX: number, clientY: number) => {
    knob.localToWorld(centre.current.set(0, lift, 0)).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    const cx = rect.left + (centre.current.x * 0.5 + 0.5) * rect.width;
    const cy = rect.top + (-centre.current.y * 0.5 + 0.5) * rect.height;
    return Math.atan2(clientY - cy, clientX - cx);
  };
  const angleRef = useRef(angleAt);
  angleRef.current = angleAt;
  const turns = useMemo(
    () =>
      knobTurns(
        rig,
        knob,
        follows,
        (x, y) => angleRef.current(x, y),
        (deltaMs) => bridge.emit({ type: 'seek', deltaMs }),
      ),
    [rig, knob, follows, bridge],
  );
  // A track that ends while the hand holds the knob still: its turn ends as the change begins.
  useFrame(() => turns.frame());

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const touch = touching.current;
      // A touch that strays from its key, or sees a pinch begin, is not a tap any more.
      if (touch?.id === event.pointerId) {
        if (!stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
          touching.current = null;
        }
      }
      // A mouse that moves with no button down has lost its release (a native menu took it, say).
      const { pointerId, clientX, clientY } = event;
      turns.move(pointerId, clientX, clientY, interaction.pinches, releaseLost(event));
    };
    const up = (event: PointerEvent) => {
      const touch = touching.current;
      if (touch?.id === event.pointerId) {
        touching.current = null;
        if (stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
          pressRef.current(touch.node);
        }
      }
      turns.up(event.pointerId, interaction.pinches);
    };
    const cancel = (event: PointerEvent) => {
      if (touching.current?.id === event.pointerId) touching.current = null;
      turns.cancel(event.pointerId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [turns]);

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
      // A press the knob takes no turn from still neither orbits nor recentres (controlActive).
      turns.down(event.pointerId, clientX, clientY, interaction.pinches);
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

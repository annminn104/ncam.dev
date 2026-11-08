import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import type { SceneBridge } from '../bridge';
import {
  angleDelta,
  BUTTON_ACTIONS,
  BUTTON_NODES,
  hitFor,
  foldTurn,
  knobSeekMs,
  knobTakesTurn,
  pinchedSince,
  PRESS_MS,
  pressDepth,
  pressesOnDown,
  stillTap,
  type ButtonNode,
  type KeyTouch,
} from './controls';
import { interaction, releaseLost } from './interaction';
import { SCENE_PROFILES } from './profiles';
import type { Rig } from './rig';

/** The turn of the knob that one pointer is making. */
interface Turn {
  id: number;
  /** The pointer's last angle around the knob (radians). */
  last: number;
  /** How far it has turned the knob since it went down (radians): the seek, once it lets go. */
  total: number;
  /** The knob's rotation when it went down, to give back if the turn is abandoned. */
  from: number;
  /** interaction.pinches as it went down: a turn that becomes a pinch is abandoned. */
  pinches: number;
}

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
  const turning = useRef<Turn | null>(null);
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

  useEffect(() => {
    // A turn that does not end in a release (cancelled, its release lost, or become a pinch)
    // seeks nothing.
    const abandon = (turn: Turn) => {
      knob.rotation.y = turn.from;
      rig.knobTurn = 0;
      rig.scrubMs = null;
      turning.current = null;
    };
    const move = (event: PointerEvent) => {
      const touch = touching.current;
      // A touch that strays from its key, or sees a pinch begin, is not a tap any more.
      if (touch?.id === event.pointerId) {
        if (!stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
          touching.current = null;
        }
      }
      const turn = turning.current;
      if (!turn || event.pointerId !== turn.id) return;
      // A mouse that moves with no button down has lost its release (a native menu took it, say).
      if (releaseLost(event) || pinchedSince(turn.pinches, interaction.pinches)) {
        abandon(turn);
        return;
      }
      const angle = angleRef.current(event.clientX, event.clientY);
      const delta = angleDelta(turn.last, angle);
      turn.last = angle;
      turn.total += delta;
      knob.rotation.y -= delta;
      rig.scrubMs = knobSeekMs(turn.total);
      if (follows) rig.knobTurn = knob.rotation.y - turn.from;
    };
    const up = (event: PointerEvent) => {
      const touch = touching.current;
      if (touch?.id === event.pointerId) {
        touching.current = null;
        if (stillTap(touch, event.clientX, event.clientY, interaction.pinches)) {
          pressRef.current(touch.node);
        }
      }
      const turn = turning.current;
      if (!turn || event.pointerId !== turn.id) return;
      if (pinchedSince(turn.pinches, interaction.pinches)) {
        abandon(turn);
        return;
      }
      turning.current = null;
      rig.spin = foldTurn(rig.spin, rig.knobTurn);
      rig.knobTurn = 0;
      rig.scrubMs = null;
      const deltaMs = knobSeekMs(turn.total);
      if (deltaMs !== 0) bridge.emit({ type: 'seek', deltaMs });
    };
    const cancel = (event: PointerEvent) => {
      if (touching.current?.id === event.pointerId) touching.current = null;
      const turn = turning.current;
      if (turn && event.pointerId === turn.id) abandon(turn);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [bridge, knob, rig, follows]);

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
      // The deck's jog is its door: lifted for a swap, it turns nothing (and still neither
      // orbits nor recentres, since controlActive is set).
      if (!knobTakesTurn(rig.doorOpen)) return;
      turning.current = {
        id: event.pointerId,
        last: angleAt(clientX, clientY),
        total: 0,
        from: knob.rotation.y,
        pinches: interaction.pinches,
      };
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

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import type { SceneBridge } from '../bridge';
import {
  angleDelta,
  BUTTON_NODES,
  hitFor,
  knobSeekMs,
  PRESS_MS,
  pressDepth,
  type ButtonNode,
} from './controls';
import { interaction, releaseLost } from './interaction';
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
}

/**
 * R3F reports a pointer event once per mesh under the pointer, nearest first: only the nearest
 * counts, for a press as for the cursor, so both agree about what hides a control.
 */
const isNearest = (event: ThreeEvent<PointerEvent>) =>
  event.object === event.intersections[0]?.object;

/** Pointer handlers for the player: press the keys, turn the knob to scrub. */
export function useControls(rig: Rig, bridge: SceneBridge) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const presses = useRef(new Map<ButtonNode, number>());
  const keyBase = useMemo(
    () => new Map(BUTTON_NODES.map((name) => [name, rig.model.nodes[name].position.y])),
    [rig],
  );
  const knob = rig.model.nodes.knob;

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
    // A turn that does not end in a release (cancelled, or its release lost) seeks nothing.
    const abandon = (turn: Turn) => {
      knob.rotation.y = turn.from;
      turning.current = null;
    };
    const move = (event: PointerEvent) => {
      const turn = turning.current;
      if (!turn || event.pointerId !== turn.id) return;
      // A mouse that moves with no button down has lost its release (a native menu took it, say).
      if (releaseLost(event)) {
        abandon(turn);
        return;
      }
      const angle = angleRef.current(event.clientX, event.clientY);
      const delta = angleDelta(turn.last, angle);
      turn.last = angle;
      turn.total += delta;
      knob.rotation.y -= delta;
    };
    const up = (event: PointerEvent) => {
      const turn = turning.current;
      if (!turn || event.pointerId !== turn.id) return;
      turning.current = null;
      const deltaMs = knobSeekMs(turn.total);
      if (deltaMs !== 0) bridge.emit({ type: 'seek', deltaMs });
    };
    const cancel = (event: PointerEvent) => {
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
  }, [bridge, knob]);

  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      // The primary button (or a touch) on the nearest mesh: a press does what the cursor says.
      if (event.button !== 0 || !isNearest(event)) return;
      const hit = hitFor(event.object);
      if (!hit) return;
      interaction.controlActive = true;
      if (hit.kind === 'button') {
        presses.current.set(hit.node, performance.now());
        bridge.emit(hit.action);
        return;
      }
      turning.current = {
        id: event.pointerId,
        last: angleAt(event.nativeEvent.clientX, event.nativeEvent.clientY),
        total: 0,
        from: knob.rotation.y,
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

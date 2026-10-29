import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import type { SceneBridge } from '../bridge';
import type { RequiredNode } from './contract';
import {
  angleDelta,
  BUTTON_ACTIONS,
  hitFor,
  knobSeekMs,
  leaveOnDeck,
  pressDepth,
} from './controls';
import { interaction } from './interaction';
import type { Rig } from './rig';

/** Pointer handlers for the player: press the keys, turn the knob to scrub. */
export function useControls(rig: Rig, bridge: SceneBridge) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const presses = useRef(new Map<string, number>());
  const keyBase = useMemo(
    () =>
      new Map(
        Object.keys(BUTTON_ACTIONS).map((name) => [
          name,
          rig.model.nodes[name as RequiredNode].position.y,
        ]),
      ),
    [rig],
  );
  const knob = rig.model.nodes.knob;

  // Only the keys and the knob move: what is printed around them stays on the deck.
  useEffect(() => {
    for (const name of [...Object.keys(BUTTON_ACTIONS), 'knob']) {
      leaveOnDeck(rig.model.nodes[name as RequiredNode]);
    }
  }, [rig]);

  useFrame(() => {
    const now = performance.now();
    for (const [name, at] of presses.current) {
      rig.model.nodes[name as RequiredNode].position.y =
        (keyBase.get(name) ?? 0) - pressDepth(now - at);
      if (now - at > 200) presses.current.delete(name);
    }
  });

  // A turn of the knob is followed on the window, so it survives leaving the knob's mesh. It is
  // read around the middle of the knob's top, where the pointer lands (its pivot is at the base).
  const turning = useRef<{ last: number; total: number } | null>(null);
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
    const move = (event: PointerEvent) => {
      const turn = turning.current;
      if (!turn) return;
      const angle = angleRef.current(event.clientX, event.clientY);
      const delta = angleDelta(turn.last, angle);
      turn.last = angle;
      turn.total += delta;
      knob.rotation.y -= delta;
    };
    const up = () => {
      interaction.controlActive = false;
      const turn = turning.current;
      turning.current = null;
      if (turn) {
        const deltaMs = knobSeekMs(turn.total);
        if (deltaMs !== 0) bridge.emit({ type: 'seek', deltaMs });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [bridge, knob]);

  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      const hit = hitFor(event.object);
      if (!hit) return;
      event.stopPropagation();
      // R3F answers a stopped event by dropping the player's hover, and out resets the cursor.
      gl.domElement.style.cursor = 'pointer';
      interaction.controlActive = true;
      if (hit.kind === 'button') {
        presses.current.set(hit.node, performance.now());
        bridge.emit(hit.action);
        return;
      }
      turning.current = {
        last: angleAt(event.nativeEvent.clientX, event.nativeEvent.clientY),
        total: 0,
      };
    },
    // R3F hovers the player as one (its handlers sit on the root) for as long as the first mesh it
    // met stays under the pointer, so over would miss a key met from the deck: the cursor follows
    // every move instead.
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      // A move is reported once per mesh under the pointer, nearest first: the nearest decides.
      if (event.object !== event.intersections[0]?.object) return;
      gl.domElement.style.cursor = hitFor(event.object) ? 'pointer' : '';
    },
    onPointerOut: () => {
      gl.domElement.style.cursor = '';
    },
  };
}

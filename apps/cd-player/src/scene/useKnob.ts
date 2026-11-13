import { useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import type { SceneBridge } from '../bridge';
import { knobTurns } from './knob-turn';
import type { CdModel } from './model';
import type { Rig } from './rig';
import { useGripEvents, type Grip } from './useGrip';

/**
 * A CD player's knob, which scrubs the track (knob-turn.ts). A turn is followed on the window, so
 * it survives leaving the knob's mesh, and read around the middle of the knob's top, where the
 * pointer lands (its pivot is at the base). The grip it returns takes useControls' presses on it.
 */
export function useKnob(rig: Rig<CdModel>, bridge: SceneBridge): Grip {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const knob = rig.model.nodes.knob;
  const follows = rig.profile.knobTurnsDisc === true;
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
  useGripEvents(turns);
  return useMemo(
    (): Grip => ({ kind: 'knob', down: (id, x, y, pinches) => turns.down(id, x, y, pinches) }),
    [turns],
  );
}

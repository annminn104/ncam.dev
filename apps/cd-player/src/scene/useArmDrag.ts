import { useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { SceneBridge } from '../bridge';
import { armDrags, armPointerAngle } from './arm-drag';
import type { VinylModel } from './model';
import type { Rig } from './rig';
import { useGripEvents, type Grip } from './useGrip';

const UP = new Vector3(0, 1, 0);

/**
 * A turntable's tonearm drag (arm-drag.ts). The pointer's ray meets the level plane through the
 * pivot (at its resting height), and its angle round the pivot there, in the pivot's parent's
 * frame, is what the arm follows. A drag is followed on the window, as the knob's turn is; the
 * grip it returns takes useControls' presses on the head.
 */
export function useArmDrag(rig: Rig<VinylModel>, bridge: SceneBridge): Grip {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const tools = useMemo(
    () => ({
      raycaster: new Raycaster(),
      plane: new Plane(),
      ndc: new Vector2(),
      pivot: new Vector3(),
      hit: new Vector3(),
    }),
    [],
  );
  const pointerAngle = (clientX: number, clientY: number): number | null => {
    const node = rig.arm.node;
    const parent = node.parent;
    if (!parent) return null;
    const { raycaster, plane, ndc, pivot, hit } = tools;
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    parent.localToWorld(pivot.set(node.position.x, rig.arm.baseY, node.position.z));
    plane.set(UP, -pivot.y);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return armPointerAngle(parent.worldToLocal(hit), node.position);
  };
  const angleRef = useRef(pointerAngle);
  angleRef.current = pointerAngle;
  const drags = useMemo(
    () =>
      armDrags(rig, {
        arm: rig.toneArm,
        angleNow: () => rig.arm.node.rotation.y - rig.arm.baseRotationY,
        pointerAngle: (x, y) => angleRef.current(x, y),
        view: () => bridge.getView(),
        seek: (deltaMs) => bridge.emit({ type: 'seek', deltaMs }),
      }),
    [rig, bridge],
  );
  useGripEvents(drags);
  return useMemo(
    (): Grip => ({ kind: 'arm', down: (id, x, y, pinches) => drags.down(id, x, y, pinches) }),
    [drags],
  );
}

import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import {
  CanvasTexture,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import type { Side } from '../../../game/coords';
import { onDispose, own } from '../dispose';
import { QI_COLOR, sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { MIRROR, mirrorKit } from './kits';
import { randomPhase } from './phase';

let taijiTexture: CanvasTexture | null = null;
const taijiMaterials = new Map<Side, MeshBasicMaterial>();
onDispose(() => {
  taijiTexture = null;
  taijiMaterials.clear();
});

/** How quickly a mirror turns to its viewer (per second, exponential). */
const TURN_RATE = 3;
const viewer = new Vector3();

/** The taiji in white on a transparent canvas: the yang half, its eyes and the outer ring. */
function drawTaiji(): CanvasTexture {
  const size = 256;
  const c = size / 2;
  const r = c - 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  // Yang: the right half, less the lower small disc, plus the upper one.
  ctx.beginPath();
  ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(c, c + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(c, c - r / 2, r / 2, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.fill();
  // Yang's eye in the yin head; yin's eye cut from the yang head.
  ctx.beginPath();
  ctx.arc(c, c + r / 2, r / 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(c, c - r / 2, r / 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(c, c, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  const tex = own(new CanvasTexture(canvas));
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The taiji painted in the sect's qi on the mirror's jade: unlit, over the face it lies on. */
function taijiMaterial(side: Side): MeshBasicMaterial {
  const hit = taijiMaterials.get(side);
  if (hit) return hit;
  taijiTexture ??= drawTaiji();
  const made = own(
    new MeshBasicMaterial({
      map: taijiTexture,
      color: QI_COLOR[side],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    }),
  );
  taijiMaterials.set(side, made);
  return made;
}

/**
 * Bishop, the Taiji Mirror: tilted back on its stand, its taiji slowly turning. The mirror turns
 * on its stand to face whoever looks at it, so it never shows a viewer only its edge.
 */
export function Mirror({ side }: TreasureProps) {
  const k = mirrorKit();
  const m = sectMaterials(side);
  const turn = useRef<Group>(null);
  const taiji = useRef<Mesh>(null);
  const yaw = useRef<number | null>(null);
  const [phase] = useState(randomPhase);
  useFrame(({ camera, clock }, delta) => {
    const g = turn.current;
    if (g?.parent) {
      // The viewer's bearing in the stand's own frame; the face looks down +z. The parents'
      // world matrices are brought up to date first: a piece that has just mounted has none.
      g.parent.updateWorldMatrix(true, false);
      g.parent.worldToLocal(viewer.copy(camera.position));
      const target = Math.atan2(viewer.x, viewer.z);
      if (yaw.current === null) yaw.current = target;
      const d = Math.atan2(Math.sin(target - yaw.current), Math.cos(target - yaw.current));
      yaw.current += d * (1 - Math.exp(-TURN_RATE * delta));
      g.rotation.y = yaw.current;
    }
    if (taiji.current) taiji.current.rotation.z = phase - clock.elapsedTime * 0.5;
  });
  return (
    <group ref={turn}>
      <mesh geometry={k.trim} material={m.trim} castShadow />
      <mesh geometry={k.jade} material={m.body} castShadow />
      <group position={[0, MIRROR.y, MIRROR.z]} rotation-x={MIRROR.tilt}>
        <mesh ref={taiji} geometry={k.taiji} material={taijiMaterial(side)} />
      </group>
    </group>
  );
}

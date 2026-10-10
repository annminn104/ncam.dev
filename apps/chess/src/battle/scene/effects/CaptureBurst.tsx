import { useFrame } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  PointsMaterial,
  type Points,
} from 'three';
import { squareToPosition } from '../../../game/coords';
import type { GameSnapshot } from '../../../game/game';
import { QualityContext } from '../../quality';
import { sparkTexture } from '../arenas/textures';
import { own } from '../dispose';
import { QI_COLOR } from '../materials';
import { capturedPiece } from './captures';

const LIFE = 0.9; // seconds
const GRAVITY = 4;
/** Particles per burst; a weak GPU draws the first 80 of the same pool. */
const COUNT = { high: 200, low: 80 };

/**
 * The qi of a captured treasure bursting out where it stood, in its sect's colour: one pooled
 * cloud of points, re-seeded by each capture. An undo brings a piece back and bursts nothing.
 */
export function CaptureBurst({ snap }: { snap: GameSnapshot }) {
  const quality = useContext(QualityContext);
  const count = COUNT[quality];
  const points = useRef<Points>(null);
  // Sized for the high count once: a drop in quality only draws fewer.
  const burst = useMemo(() => {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array(COUNT.high * 3), 3);
    position.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', position);
    const material = new PointsMaterial({
      size: 0.16,
      map: sparkTexture(),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return {
      geometry: own(geometry),
      material: own(material),
      velocity: new Float32Array(COUNT.high * 3),
      /** Seconds since the last capture; LIFE or more is idle. */
      t: LIFE,
      /** How many particles the current burst uses. */
      n: 0,
    };
  }, []);

  const before = useRef(snap.pieces);
  useEffect(() => {
    const victim = capturedPiece(before.current, snap.pieces);
    before.current = snap.pieces;
    if (!victim) return;
    const [x, z] = squareToPosition(victim.square);
    const position = burst.geometry.getAttribute('position') as BufferAttribute;
    const v = burst.velocity;
    for (let i = 0; i < count; i++) {
      position.setXYZ(i, x, 0.5, z);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2.5 + 0.5;
      const out = Math.random() * 1.8;
      v[i * 3] = Math.cos(a) * out;
      v[i * 3 + 1] = up;
      v[i * 3 + 2] = Math.sin(a) * out;
    }
    position.needsUpdate = true;
    burst.geometry.setDrawRange(0, count);
    burst.material.color.set(QI_COLOR[victim.color]);
    burst.n = count;
    burst.t = 0;
  }, [snap.pieces, burst, count]);

  useFrame((_, dt) => {
    const p = points.current;
    if (!p) return;
    if (burst.t < LIFE) burst.t += dt;
    p.visible = burst.t < LIFE;
    if (!p.visible) return;
    const position = burst.geometry.getAttribute('position') as BufferAttribute;
    const v = burst.velocity;
    for (let i = 0; i < burst.n; i++) {
      v[i * 3 + 1] -= GRAVITY * dt;
      position.setXYZ(
        i,
        position.getX(i) + v[i * 3] * dt,
        position.getY(i) + v[i * 3 + 1] * dt,
        position.getZ(i) + v[i * 3 + 2] * dt,
      );
    }
    position.needsUpdate = true;
    burst.material.opacity = Math.max(0, 1 - burst.t / LIFE);
  });

  return (
    <points
      ref={points}
      name="capture-burst"
      geometry={burst.geometry}
      material={burst.material}
      visible={false}
      frustumCulled={false}
    />
  );
}

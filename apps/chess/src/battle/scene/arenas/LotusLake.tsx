import { MeshReflectorMaterial } from '@react-three/drei';
import { useContext, useMemo } from 'react';
import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QualityContext } from '../../quality';
import { own } from '../dispose';
import {
  ArenaFog,
  KeyLight,
  Motes,
  SkyDome,
  direction,
  type MotesLook,
  type SkyLook,
} from './common';
import { BOARD_UNDERSIDE, LOTUS_LAKE } from './layout';
import { inlayGeometry, lotusGeometry, platformGeometry, ridgeGeometry } from './scenery';
import { lotusTexture } from './textures';

/**
 * The moon's bearing: behind the board and to its right, from the white player's seat, and high
 * enough that its reflection lies in the lake just beyond the board's far edge.
 */
const MOON = direction(-62, 19);
const KEY = direction(-48, 50).map((v) => v * 14) as [number, number, number];

/** Blue dusk: indigo overhead, the last of the sunset low behind the white player. */
export const LOTUS_LAKE_SKY: SkyLook = {
  horizon: '#4b5486',
  zenith: '#0e1530',
  curve: 2.5,
  glow: { dir: MOON, color: '#8fa8ff', power: 6, strength: 0.16 },
  afterglow: { dir: direction(118, -2), color: '#f0a487', power: 3, strength: 0.3 },
  disc: { dir: MOON, color: '#eef3ff', radius: 2.3, halo: 380 },
  stars: 0.7,
};

const FIREFLIES: MotesLook = {
  count: { high: 70, low: 28 },
  seed: 81,
  radius: [6, 17],
  y: [-0.75, 2.6],
  rise: 0,
  sway: 0.4,
  size: 0.1,
  color: '#ffe7a0',
  blink: 1,
};

/** Rolling hills round the far shore, higher on one side of the lake than the other. */
function hills(seed: number, low: number, high: number) {
  return (a: number) =>
    low +
    (high - low) *
      (0.5 + 0.3 * Math.sin(a * 3 + seed) + 0.2 * Math.sin(a * 8 + seed * 2.3)) *
      (0.75 + 0.25 * Math.cos(a - seed));
}

/** Lotus Moon Lake: a pale stone terrace with lotus inlays, in a still lake at dusk. */
export function LotusLake() {
  const quality = useContext(QualityContext);
  const scene = useMemo(() => {
    const { pads, flowers } = lotusGeometry(LOTUS_LAKE.clusters, LOTUS_LAKE.water);
    return {
      // Laid flat by its mesh, not by the geometry: drei's reflector takes the mirror's normal
      // from the mesh's rotation (local +z).
      lake: own(new PlaneGeometry(640, 640)),
      lakePlain: own(
        new MeshStandardMaterial({ color: '#1f2747', roughness: 0.4, metalness: 0.2 }),
      ),
      platform: own(
        platformGeometry(
          BOARD_UNDERSIDE,
          LOTUS_LAKE.terraces.map(([r, h], i) => [r, h, i === 0 ? '#d6d1c6' : '#bfb9ad']),
          64,
        ),
      ),
      stone: own(new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02 })),
      inlays: own(inlayGeometry()),
      // Mother-of-pearl: pale, a little glossy, and faintly lit from within at dusk.
      pearl: own(
        new MeshStandardMaterial({
          color: '#eef2fb',
          map: lotusTexture(),
          transparent: true,
          depthWrite: false,
          roughness: 0.35,
          metalness: 0.15,
          emissive: '#8fa6e6',
          emissiveIntensity: 0.18,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -4,
        }),
      ),
      pads: own(pads),
      padMaterial: own(new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })),
      flowers: own(flowers),
      flowerMaterial: own(
        new MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.5,
          side: DoubleSide,
          emissive: '#f08cb8',
          emissiveIntensity: 0.22,
        }),
      ),
      hills: own(
        mergeGeometries([
          ridgeGeometry({
            radius: LOTUS_LAKE.hills[0],
            base: LOTUS_LAKE.water - 1,
            segments: 128,
            height: hills(0.6, 2, 13),
            low: '#4b5486',
            high: '#2a3360',
          }),
          ridgeGeometry({
            radius: LOTUS_LAKE.hills[1],
            base: LOTUS_LAKE.water - 1,
            segments: 128,
            height: hills(2.1, 5, 22),
            low: '#4b5486',
            high: '#3a4374',
          }),
        ]),
      ),
      // Painted, unlit and unfogged: the far shore already lost in the dusk.
      hillMaterial: own(new MeshBasicMaterial({ vertexColors: true, fog: false })),
    };
  }, []);

  return (
    <>
      <SkyDome look={LOTUS_LAKE_SKY} />
      <ArenaFog color={LOTUS_LAKE_SKY.horizon} near={8} far={64} />
      <hemisphereLight args={['#a2b5ff', '#1f2848', 0.7]} />
      <KeyLight position={KEY} color="#cfdcff" intensity={1.7} />
      <mesh geometry={scene.lake} position-y={LOTUS_LAKE.water} rotation-x={-Math.PI / 2}>
        {quality === 'high' ? (
          // The spec's mirror lake; PerformanceMonitor drops it (and its second render of the
          // scene every frame) for the plain material on a weak GPU.
          // drei multiplies the reflection into the albedo, then lights it: a neutral grey keeps
          // the sky's own colours (a blue one squared the blue).
          <MeshReflectorMaterial
            resolution={512}
            mirror={1}
            mixStrength={3}
            mixBlur={0.8}
            blur={[200, 80]}
            color="#8a909c"
            roughness={0.6}
            metalness={0}
          />
        ) : (
          <primitive object={scene.lakePlain} attach="material" />
        )}
      </mesh>
      <mesh geometry={scene.platform} material={scene.stone} receiveShadow />
      <mesh geometry={scene.inlays} material={scene.pearl} receiveShadow />
      <mesh geometry={scene.pads} material={scene.padMaterial} />
      <mesh geometry={scene.flowers} material={scene.flowerMaterial} />
      <mesh geometry={scene.hills} material={scene.hillMaterial} />
      <Motes look={FIREFLIES} />
    </>
  );
}

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  AdditiveBlending,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
import { BLOOD_MOON } from './layout';
import { columnsGeometry, ridgeGeometry, seamGeometry } from './scenery';
import { crackTexture } from './textures';

/** The moon's bearing: behind the board and to the left, from the white player's seat. */
const MOON_AZIMUTH = -118;
const MOON = direction(MOON_AZIMUTH, 3.6);
const KEY = direction(-140, 46).map((v) => v * 14) as [number, number, number];

/** Night over the abyss: a crimson haze off the lava, black overhead, the blood moon rising. */
export const BLOOD_MOON_SKY: SkyLook = {
  horizon: '#3a0c12',
  zenith: '#06020a',
  curve: 2.5,
  glow: { dir: MOON, color: '#ff2a1a', power: 4, strength: 0.45 },
  disc: { dir: MOON, color: '#ff4632', radius: 3.4, halo: 160 },
  stars: 0.45,
};

const EMBERS: MotesLook = {
  count: { high: 130, low: 50 },
  seed: 71,
  radius: [5, 15],
  y: [-6.5, 11],
  rise: 0.55,
  sway: 0.3,
  size: 0.08,
  color: '#ffab5e',
  blink: 0,
};

/** The lava's breathing, shared by the sea and the seams: 1 ± 12 %. */
const pulse = (t: number) => 0.88 + 0.12 * Math.sin(t * 0.8);

/**
 * The lava sea's emissive: the crack texture sampled twice, at two scales drifting different
 * ways, so its tiling never lines up, and breathing with `pulse`.
 */
const LAVA_GLSL = /* glsl */ `
#ifdef USE_EMISSIVEMAP
  float lavaA = texture2D( emissiveMap, vEmissiveMapUv + vec2( uLavaTime * 0.011, uLavaTime * 0.006 ) ).r;
  float lavaB = texture2D( emissiveMap, vEmissiveMapUv * 0.31 + vec2( -uLavaTime * 0.004, uLavaTime * 0.009 ) ).r;
  totalEmissiveRadiance *= ( lavaA * 0.75 + lavaB * 0.6 + 0.05 ) * ( 0.88 + 0.12 * sin( uLavaTime * 0.8 ) );
#endif`;

/** Canyon walls on the horizon, low where the moon rises so it is never hidden. */
function canyonHeight(seed: number, low: number, high: number) {
  const moon = (MOON_AZIMUTH * Math.PI) / 180;
  return (a: number) => {
    const jag =
      0.5 +
      0.22 * Math.sin(a * 7 + seed) +
      0.16 * Math.sin(a * 17 + seed * 2) +
      0.12 * Math.sin(a * 41 + seed * 3);
    const gap = Math.abs(Math.atan2(Math.sin(a - moon), Math.cos(a - moon)));
    const open = 0.2 + 0.8 * Math.min(1, Math.max(0, (gap - 0.12) / 0.3));
    return low + (high - low) * jag * open;
  };
}

/** Blood Moon Abyss: an obsidian board with molten seams on a basalt pillar over a lava sea. */
export function BloodMoon() {
  const scene = useMemo(() => {
    const b = BLOOD_MOON;
    const lavaTime = { value: 0 };

    const lavaGeometry = new PlaneGeometry(640, 640);
    // Tile the cracks every 22 units: the uvs carry the scale, not the shared texture.
    const uv = lavaGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 29, uv.getY(i) * 29);
    lavaGeometry.rotateX(-Math.PI / 2);
    lavaGeometry.translate(0, b.lava, 0);
    const lava = new MeshStandardMaterial({
      color: '#160604',
      roughness: 0.85,
      emissive: '#ff4d12',
      emissiveIntensity: 1.4,
      emissiveMap: crackTexture(),
    });
    lava.onBeforeCompile = (shader) => {
      shader.uniforms.uLavaTime = lavaTime;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uLavaTime;')
        .replace('#include <emissivemap_fragment>', LAVA_GLSL);
    };
    lava.customProgramCacheKey = () => 'arena-lava';

    // Basalt: the pillar and the spires share one draw. Their veins glow hottest near the lava.
    const basalt = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      emissive: '#ff4a10',
      emissiveIntensity: 1.1,
      emissiveMap: crackTexture(),
    });
    basalt.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float heat;\nvarying float vHeat;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeat = heat;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHeat;')
        .replace(
          '#include <emissivemap_fragment>',
          // Heat runs past 0..1 along the rock (layout.ts): the veins burn where it meets the
          // lava and are cold black stone a few units up.
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= pow( clamp( vHeat, 0.0, 1.0 ), 2.0 );',
        );
    };
    basalt.customProgramCacheKey = () => 'arena-basalt';

    const seams = new MeshBasicMaterial({
      color: '#ff5a1a',
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });

    return {
      lavaTime,
      lavaGeometry: own(lavaGeometry),
      lava: own(lava),
      rock: own(
        mergeGeometries([
          columnsGeometry([b.pillar], b.pillarStyle),
          columnsGeometry(b.spires, b.spireStyle),
        ]),
      ),
      basalt: own(basalt),
      canyon: own(
        mergeGeometries([
          ridgeGeometry({
            radius: b.canyon[0],
            base: b.lava - 1,
            segments: 160,
            height: canyonHeight(1, 4, 24),
            low: '#6a1d12',
            high: '#16080b',
          }),
          ridgeGeometry({
            radius: b.canyon[1],
            base: b.lava - 1,
            segments: 160,
            height: canyonHeight(4, 8, 34),
            low: '#521610',
            high: '#2a0b10',
          }),
        ]),
      ),
      // Painted, unlit and unfogged: lava-lit at the foot, black at the crest.
      canyonMaterial: own(new MeshBasicMaterial({ vertexColors: true, fog: false })),
      seamGeometry: own(seamGeometry(0.035, 0.004, 9)),
      seams: own(seams),
      // Dimmer than the lava: a glow along the cracks, not lines painted over the board.
      seamColor: new Color('#ff4a12').multiplyScalar(0.5),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    scene.lavaTime.value = t;
    // Written whole from the clock each frame: the seams breathe with the lava.
    scene.seams.color.copy(scene.seamColor).multiplyScalar(pulse(t));
  });

  return (
    <>
      <SkyDome look={BLOOD_MOON_SKY} />
      <ArenaFog color={BLOOD_MOON_SKY.horizon} near={7} far={32} />
      {/* Moonlight from above, lava glow from below. */}
      <hemisphereLight args={['#5a2a3a', '#ff5a1f', 0.85]} />
      <KeyLight position={KEY} color="#ff9a80" intensity={2} />
      <mesh geometry={scene.lavaGeometry} material={scene.lava} />
      <mesh geometry={scene.rock} material={scene.basalt} receiveShadow />
      <mesh geometry={scene.canyon} material={scene.canyonMaterial} />
      <mesh geometry={scene.seamGeometry} material={scene.seams} renderOrder={2} />
      <Motes look={EMBERS} />
    </>
  );
}

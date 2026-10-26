import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, type DirectionalLight, Fog, type HemisphereLight, Vector3 } from 'three';
import type { TimeOverride } from '../params';
import { settledCount, useAppStore } from '../state/store';
import { skyUniforms } from './Sky';
import {
  cloneSky,
  computeSky,
  keyLight,
  type KeyLight,
  mixSky,
  MOON_RAMP,
  resolveNow,
  type SkyState,
  type SkyTimes,
} from './timeOfDay';
import { globalUniforms } from './uniforms';

interface Props {
  sky: SkyTimes;
  override: TimeOverride | null;
  shadowMapSize: number;
  shadowAutoUpdate: boolean;
  /** Haze towards the sky colour; off over a ?bg= photo, which it would not match. */
  fog: boolean;
}

const SHADOW_EXTENT = 32; // metres: the island's rim reaches 29.96 m from its centre (zones.ISLAND) and every shadow falls inside it
// The 64 m frustum makes a texel of the 1024 wallpaper map ~6.3 cm (4.7 cm at 24): the old 0.02 normal bias left rings
// on the lawn from the afternoon sun; 0.06 keeps the contact shadows attached and the lawn clean. (36 m, the half-diagonal
// of the 54 x 46 m box, was more than the round rim needs and made shadows 12 % blurrier; checked top-down at 12:00, 16:45
// and 17:30: no shadow cut off anywhere on the island.)
const SHADOW_NORMAL_BIAS = 0.06;
const RETARGET_MS = 60_000;
// The idle camera hangs ~115 m from the island's centre, ~150 m from its far rim, and the orbit reaches 140 m: haze
// starts at the near rim and stays light over the island, so its far side does not wash into the sky.
const FOG_NEAR = 140;
const FOG_FAR = 420;
const EASE_PER_SECOND = 0.5;
/**
 * Night fill: the hemisphere light drifts to a dim blue and never drops below this intensity at full night. It has no
 * shadows, so it reaches the rooms too: keep it low and let the shadowed moon (keyLight) carry the moonlit yard, so the
 * interiors read warm under their own lights.
 */
const MOONLIGHT = new Color('#8fa8f0');
const NIGHT_HEMI_FLOOR = 0.2;
const DAY_GROUND = new Color('#3a2f25');
const MOON_GROUND = new Color('#1a2038');

/** Sun, hemisphere light, sky, fog and night factor from the clock. */
export function TimeOfDay({ sky, override, shadowMapSize, shadowAutoUpdate, fog }: Props) {
  const sun = useRef<DirectionalLight>(null!);
  const hemi = useRef<HemisphereLight>(null!);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const setNightFactor = useAppStore((s) => s.setNightFactor);
  const settled = useAppStore(settledCount);
  const target = useRef<SkyState>(computeSky(resolveNow(override), sky));
  const current = useRef<SkyState>(cloneSky(target.current)); // no fade on first load
  const lastNight = useRef(-1);
  const key = useRef<KeyLight>({ dir: new Vector3(), color: new Color(), intensity: 0 });

  useEffect(() => {
    const id = window.setInterval(() => {
      target.current = computeSky(resolveNow(override), sky);
    }, RETARGET_MS);
    return () => window.clearInterval(id);
  }, [override, sky]);

  useEffect(() => {
    if (!fog) return;
    scene.fog = new Fog(current.current.skyBottom.clone(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  // Newly loaded modules need one shadow pass even when auto-update is off.
  useEffect(() => {
    gl.shadowMap.autoUpdate = shadowAutoUpdate;
    gl.shadowMap.needsUpdate = true;
  }, [gl, shadowAutoUpdate, settled]);

  useFrame((_, delta) => {
    const moving = mixSky(current.current, target.current, 1 - Math.exp(-delta * EASE_PER_SECOND));
    const s = current.current;
    const k = keyLight(s, key.current);
    sun.current.position.copy(k.dir).multiplyScalar(40);
    sun.current.color.copy(k.color);
    sun.current.intensity = k.intensity;
    const moon = Math.min(1, s.nightFactor * MOON_RAMP);
    hemi.current.color.copy(s.skyTop).lerp(MOONLIGHT, moon);
    hemi.current.groundColor.copy(DAY_GROUND).lerp(MOON_GROUND, moon);
    hemi.current.intensity = Math.max(s.hemiIntensity, NIGHT_HEMI_FLOOR * moon);
    skyUniforms.uTop.value.copy(s.skyTop);
    skyUniforms.uBottom.value.copy(s.skyBottom);
    if (scene.fog instanceof Fog) scene.fog.color.copy(s.skyBottom);
    globalUniforms.uNight.value = s.nightFactor;
    const night = Math.round(s.nightFactor * 100) / 100;
    if (night !== lastNight.current) {
      lastNight.current = night;
      setNightFactor(night);
    }
    if (moving && !gl.shadowMap.autoUpdate) gl.shadowMap.needsUpdate = true;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#dff1ff', DAY_GROUND, 0.8]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-SHADOW_EXTENT, SHADOW_EXTENT, SHADOW_EXTENT, -SHADOW_EXTENT, 1, 100]}
        />
      </directionalLight>
    </>
  );
}

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type WebGLRenderTarget,
} from 'three';
import {
  environmentIntensity,
  shouldRefreshEnvironment,
  type SkyColors,
} from './environmentPolicy';
import { SKY_FRAGMENT, SKY_VERTEX, skyUniforms } from './Sky';
import { globalUniforms } from './uniforms';

/**
 * Renders the gradient sky into a PMREM and uses it as scene.environment, so glass and every PBR surface reflect the
 * current time of day (glass villa spec §7). Re-renders only when the sky colours drift past the threshold — about
 * once a minute while the sun moves — and adds no render pass to ordinary frames.
 */
export function SkyEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const pmrem = useMemo(() => new PMREMGenerator(gl), [gl]);
  const skyScene = useMemo(() => {
    const sky = new Scene();
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    });
    sky.add(new Mesh(new SphereGeometry(1, 32, 16), material));
    return sky;
  }, []);
  const target = useRef<WebGLRenderTarget | null>(null);
  const last = useRef<SkyColors | null>(null);

  useEffect(
    () => () => {
      scene.environment = null;
      target.current?.dispose();
      pmrem.dispose();
    },
    [pmrem, scene],
  );

  useFrame(() => {
    scene.environmentIntensity = environmentIntensity(globalUniforms.uNight.value); // a uniform: free every frame
    const now = { top: skyUniforms.uTop.value, bottom: skyUniforms.uBottom.value };
    if (!shouldRefreshEnvironment(last.current, now)) return;
    last.current = { top: now.top.clone(), bottom: now.bottom.clone() };
    const next = pmrem.fromScene(skyScene, 0, 0.1, 10);
    scene.environment = next.texture;
    target.current?.dispose();
    target.current = next;
  });
  return null;
}

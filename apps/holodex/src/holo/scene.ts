import {
  CanvasTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { makeFoilTexture } from './textures';
import { TIER_INTENSITY, type FoilTier } from './tiers';

export interface HoloScene {
  setCard: (url: string) => Promise<void>;
  setTier: (tier: FoilTier) => void;
  /** Pointer in -1..1 card space; also drives the mesh tilt. */
  setPointer: (x: number, y: number) => void;
  resize: (width: number, height: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export function createHoloScene(canvas: HTMLCanvasElement): HoloScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
  camera.position.z = 2;

  const target = { x: 0, y: 0 };
  // Also the uPointer uniform's value object. three compares a vec2 uniform
  // component-wise against its cache, so mutating this in place is picked up
  // exactly like a fresh object would be — without allocating one per frame.
  const current = { x: 0, y: 0 };

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    uniforms: {
      uCard: { value: null },
      uFoil: { value: null },
      uPointer: { value: current },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
  });

  const geometry = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);

  let raf = 0;
  let running = false;
  let disposed = false;
  const start0 = performance.now();

  const frame = () => {
    // Spring toward the pointer so the card leans rather than snapping.
    current.x += (target.x - current.x) * 0.12;
    current.y += (target.y - current.y) * 0.12;
    material.uniforms.uTime.value = (performance.now() - start0) / 1000;
    mesh.rotation.y = current.x * 0.18;
    mesh.rotation.x = -current.y * 0.18;
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  };

  return {
    async setCard(url) {
      const texture = await new TextureLoader().loadAsync(url);
      if (disposed) {
        // The scene was torn down while this load was in flight. Assigning it
        // now would attach a texture to a dead material, and nothing would
        // ever free it.
        texture.dispose();
        return;
      }
      material.uniforms.uCard.value?.dispose?.();
      material.uniforms.uCard.value = texture;
      material.needsUpdate = true;
    },
    setTier(tier) {
      const foil = new CanvasTexture(makeFoilTexture(tier));
      foil.wrapS = RepeatWrapping;
      foil.wrapT = RepeatWrapping;
      (material.uniforms.uFoil.value as CanvasTexture | null)?.dispose?.();
      material.uniforms.uFoil.value = foil;
      material.uniforms.uIntensity.value = TIER_INTENSITY[tier];
    },
    setPointer(x, y) {
      target.x = x;
      target.y = y;
    },
    resize(width, height) {
      // The host element already carries the card's 63/88 aspect ratio, so the
      // 1×1 plane under an ortho -0.5..0.5 camera fills it exactly. Only the
      // drawing buffer needs updating.
      renderer.setSize(width, height, false);
    },
    start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      running = false;
      disposed = true;
      cancelAnimationFrame(raf);
      // Both textures: the foil canvas texture and whatever card art was loaded.
      (material.uniforms.uFoil.value as CanvasTexture | null)?.dispose?.();
      (material.uniforms.uCard.value as CanvasTexture | null)?.dispose?.();
      geometry.dispose();
      material.dispose();
      // dispose() alone leaves the WebGL context alive until the canvas is
      // collected. Every card navigation builds a new canvas and renderer, and
      // Chrome caps live contexts near 16 — past that it kills the oldest and
      // the app's holo.context-lost path fires. Drop this one explicitly.
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}

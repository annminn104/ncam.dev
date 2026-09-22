import {
  CanvasTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Texture,
} from 'three';
import { getMaterial } from './program-cache';
import { regionFor, SHAPE_ID } from './regions';
import type { HoloSelection } from './select';
import { makeTexture, type TextureName } from './textures';

export interface HoloScene {
  setCard: (url: string) => Promise<void>;
  setSelection: (selection: HoloSelection) => void;
  /** Pointer in -1..1 card space; also drives the mesh tilt. */
  setPointer: (x: number, y: number) => void;
  resize: (width: number, height: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

/**
 * The glitter and grain CanvasTextures. Materials are cached per effect
 * (program-cache.ts) and shared across every scene that uses that effect, so
 * the textures they sample have to be shared too — built once per name here,
 * module-level, and never disposed by any one scene's dispose().
 */
const shared = new Map<TextureName, CanvasTexture>();

/**
 * The vertex shader flips vUv to y-down (shader/base.ts), so every texture
 * the generated shaders sample must not flip too, or the two flips cancel
 * out and the art renders upside down. Pulled out so both call sites below
 * (the shared glitter/grain textures and the per-card texture in setCard)
 * share one implementation — and so a bare `new Texture()` can pin it in a
 * test without a live WebGL renderer.
 */
export function orientTexture<T extends Texture>(texture: T): T {
  texture.flipY = false;
  return texture;
}

function sharedTexture(name: TextureName): CanvasTexture {
  const hit = shared.get(name);
  if (hit) return hit;
  const texture = new CanvasTexture(makeTexture(name));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // Tiling noise, so the flip is visually meaningless either way — but every
  // texture in this pipeline agreeing on orientation (see the card texture
  // in setCard below) is one fewer thing for the next person to re-derive.
  orientTexture(texture);
  shared.set(name, texture);
  return texture;
}

/**
 * Maps the -1..1 pointer space that `setPointer` receives — y-up, +1 at the
 * top of the card, per HoloCard's `onPointerMove` negating `clientY` — to
 * the 0..1 y-down space `uPointerUV` is sampled in, matching the vertex
 * shader's flipped `vUv` (shader/base.ts) and `coverage()`'s "uv.y runs down
 * the card". Pulled out as its own pure function because `createHoloScene`
 * needs a live WebGL renderer to run at all, so this mapping is the one
 * piece of the frame loop a unit test can reach without one.
 */
export function pointerToUV(x: number, y: number): [number, number] {
  return [(x + 1) / 2, (1 - y) / 2];
}

export function createHoloScene(canvas: HTMLCanvasElement): HoloScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
  camera.position.z = 2;

  const target = { x: 0, y: 0 };
  // Spring-smoothed toward `target` each frame so the card leans rather than
  // snapping, then written into the *current* material's own uPointer
  // uniforms in frame() below. Never held as a uniform's value object itself
  // — that object belongs to a cached material this scene may not be the
  // only user of.
  const current = { x: 0, y: 0 };

  // Stands in for `mesh.material` until the first successful setSelection().
  // Unlike a material from getMaterial(), this one is never registered with
  // the effect cache, so it is this scene's alone to dispose.
  const placeholder = new ShaderMaterial({
    transparent: true,
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4(0.0);
      }
    `,
    uniforms: {
      uCard: { value: null },
      uPointer: { value: new Vector2(0, 0) },
      uPointerUV: { value: new Vector2(0.5, 0.5) },
      uPointerFromCenter: { value: 0 },
      uTime: { value: 0 },
    },
  });

  const geometry = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geometry, placeholder);
  scene.add(mesh);

  let raf = 0;
  let running = false;
  let disposed = false;
  const start0 = performance.now();
  // Owned here, not read back off a uniform, because the uniform lives on a
  // material this scene may be sharing with another live scene.
  let cardTexture: Texture | null = null;

  const frame = () => {
    current.x += (target.x - current.x) * 0.12;
    current.y += (target.y - current.y) * 0.12;

    const material = mesh.material;
    material.uniforms.uPointer.value.set(current.x, current.y);
    // 0..1 card space, y down the card — matches vUv and coverage(). See
    // pointerToUV above for the derivation and why the y term flips.
    const [pointerU, pointerV] = pointerToUV(current.x, current.y);
    material.uniforms.uPointerUV.value.set(pointerU, pointerV);
    material.uniforms.uPointerFromCenter.value = Math.min(
      1,
      Math.hypot(current.x, current.y) / Math.SQRT2,
    );
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
      // three.js defaults flipY to true, which would undo the vertex
      // shader's own flip (shader/base.ts) and render the card upside down.
      // The generator samples this texture with vUv directly — compile.ts's
      // main() opens with `vec3 art = srcCard(vUv);` — so this has to be off.
      orientTexture(texture);
      cardTexture?.dispose();
      cardTexture = texture;
      // The card can load after the selection is set, or before it, so
      // re-assign onto whichever material is current right now.
      const material = mesh.material;
      material.uniforms.uCard.value = texture;
    },
    setSelection(selection) {
      const material = getMaterial(selection.effect);
      // basic itself failed to compile; leave the current mesh material
      // alone and let the React layer fall back to the plain image.
      if (!material) return;

      material.uniforms.uCard.value = cardTexture;
      material.uniforms.uGlitter.value = sharedTexture('glitter');
      material.uniforms.uGrain.value = sharedTexture('grain');

      // vec4(top, right, bottom, left), matching the order coverage() in
      // shader/base.ts reads uClipRect in.
      const region = regionFor(selection.shape);
      material.uniforms.uClipRect.value.set(region.top, region.right, region.bottom, region.left);
      material.uniforms.uClipShape.value = SHAPE_ID[selection.shape];
      material.uniforms.uInvert.value = selection.invert ? 1 : 0;

      mesh.material = material;
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
      // Only clear the shared material's uCard if it's still pointing at the
      // texture we're about to free — a second live scene may already have
      // pointed the same shared material at a texture of its own.
      if (mesh.material.uniforms.uCard.value === cardTexture) {
        mesh.material.uniforms.uCard.value = null;
      }
      cardTexture?.dispose();
      // The placeholder is this scene's own, never shared — safe to dispose
      // whether or not it's still current. uGlitter/uGrain are module-level
      // shared textures and a getMaterial() material outlives the scene, so
      // neither is touched here; disposeMaterials() is the remote's
      // teardown's job (mount.tsx / hydrate.tsx), not this scene's.
      placeholder.dispose();
      geometry.dispose();
      // dispose() alone leaves the WebGL context alive until the canvas is
      // collected. Every card navigation builds a new canvas and renderer, and
      // Chrome caps live contexts near 16 — past that it kills the oldest and
      // the app's holo.context-lost path fires. Drop this one explicitly.
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}

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
import { EFFECTS } from './effects';
import { createMaterial } from './material';
import { cutsFor, regionFor, type CutBox } from './regions';
import type { HoloSelection } from './select';
import type { Effect } from './shader/types';
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
 * The generated CanvasTextures (textures.ts), built once per name here and
 * shared by every scene: each is a canvas painted once, which every scene's
 * renderer uploads for itself, so no one scene's dispose() frees it.
 */
const shared = new Map<TextureName, CanvasTexture>();

/**
 * The sampler uniform each shared texture is bound to. scene.test.ts holds
 * this against the samplers shader/sources.ts actually declares, because a
 * texture bound to the wrong uniform, or a sampler nothing feeds (which the
 * GPU reads as black), is otherwise invisible until someone looks at a card.
 */
export const SHARED_TEXTURE_UNIFORM: Record<TextureName, string> = {
  glitter: 'uGlitter',
  grain: 'uGrain',
  iri: 'uIri',
  birthday: 'uBirthday',
  pokeball: 'uPokeball',
  'pokeball-inner': 'uPokeballInner',
  masterball: 'uMasterball',
  'masterball-inner': 'uMasterballInner',
  geometric: 'uGeometric',
  trainerbg: 'uTrainerbg',
  illusion: 'uIllusion',
  'illusion-mask': 'uIllusionMask',
  ancient: 'uAncient',
  vmaxbg: 'uVmaxbg',
  'cosmos-bottom': 'uCosmosBottom',
  'cosmos-middle': 'uCosmosMiddle',
  'cosmos-top': 'uCosmosTop',
};

/**
 * The shared textures an effect's layers sample, each once, children's
 * included. setSelection binds only these, so a texture is generated the first
 * time an effect needs it, and a card whose effect uses none of the larger
 * ones never pays to draw them.
 */
export function texturesUsedBy(effect: Effect): TextureName[] {
  const names = new Set<TextureName>();
  const elements = [...(effect.beneath ?? []), ...effect.shine, ...effect.glare];
  for (const element of elements.flatMap((el) => [el, ...(el.children ?? [])])) {
    for (const { source } of element.layers) {
      if (source.kind in SHARED_TEXTURE_UNIFORM) names.add(source.kind as TextureName);
    }
  }
  return [...names];
}

/**
 * The vertex shader flips vUv to y-down (shader/base.ts), so every texture
 * the generated shaders sample must not flip too, or the two flips cancel
 * out and the art renders upside down. Pulled out so both call sites below
 * (the shared generated textures and the per-card texture in setCard)
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
  // Tiling patterns, so for most of them the flip is visually meaningless —
  // but the ball patterns have an up (the cap and the Master Ball's M sit on
  // top), and every texture in this pipeline agreeing on orientation (see the
  // card texture in setCard below) is one fewer thing to re-derive.
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

/**
 * `uPointerFromCenter`, the reference's --pointer-from-center: the pointer's
 * distance from the card's centre over half the card, clamped at 1 (Card.svelte
 * in pokemon-cards-151, and in pokemon-cards-css before it). It reaches 1 at
 * the middle of an edge and holds there out to the corners, and in the -1..1
 * pointer space that distance is simply the pointer's length. An earlier
 * version divided by √2 to reach 1 only at a corner, which ran every effect's
 * `fromCenter` term up to 29% weaker than the reference mid-edge. Pure for the
 * same reason as pointerToUV.
 */
export function pointerFromCenter(x: number, y: number): number {
  return Math.min(1, Math.hypot(x, y));
}

/**
 * A cut box (regions.ts's cutsFor) as the vec4 shader/base.ts's inBox()
 * reads — x0, y0, x1, y1 — or all zeros, which cuts nothing, where the region
 * has no box to cut. Pure for the same reason as pointerToUV.
 */
export function cutUniform(box: CutBox | undefined): [number, number, number, number] {
  return box ? [box.x0, box.y0, box.x1, box.y1] : [0, 0, 0, 0];
}

export function createHoloScene(canvas: HTMLCanvasElement): HoloScene {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
  camera.position.z = 2;

  const target = { x: 0, y: 0 };
  // Spring-smoothed toward `target` each frame so the card leans rather than
  // snapping, then written into the current material's uPointer uniforms in
  // frame() below.
  const current = { x: 0, y: 0 };

  // Stands in for `mesh.material` until the first successful setSelection(),
  // which disposes it.
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
  // The card art, owned here: setSelection binds it onto each material it
  // creates, and dispose() frees it.
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
    material.uniforms.uPointerFromCenter.value = pointerFromCenter(current.x, current.y);
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
      const material = createMaterial(selection.effect);
      // basic itself failed to compile; leave the current mesh material
      // alone and let the React layer fall back to the plain image.
      if (!material) return;

      material.uniforms.uCard.value = cardTexture;
      // If this effect failed to compile, `material` is basic's, which samples
      // none of these; binding them to it anyway is harmless.
      for (const name of texturesUsedBy(EFFECTS[selection.effect])) {
        material.uniforms[SHARED_TEXTURE_UNIFORM[name]].value = sharedTexture(name);
      }

      // vec4(top, right, bottom, left), matching the order coverage() in
      // shader/base.ts reads uClipRect in; each cut vec4(x0, y0, x1, y1), the
      // order its inBox() reads, and all zeros for a box the region lacks.
      const region = regionFor(selection.shape, selection.layout);
      material.uniforms.uClipRect.value.set(region.top, region.right, region.bottom, region.left);
      const [cutA, cutB] = cutsFor(selection.shape, selection.layout);
      material.uniforms.uCutA.value.set(...cutUniform(cutA));
      material.uniforms.uCutB.value.set(...cutUniform(cutB));
      material.uniforms.uInvert.value = selection.invert ? 1 : 0;
      material.uniforms.uCardGlow.value.set(...selection.glow);
      material.uniforms.uFoilBrightness.value = selection.foilBrightness;

      // This scene's own, so the one it replaces (the placeholder, or an
      // earlier selection's) has no other user.
      mesh.material.dispose();
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
      cardTexture?.dispose();
      // The current material, the placeholder or the selection's, is this
      // scene's own. The generated textures are shared by every scene, so
      // none is touched here.
      mesh.material.dispose();
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

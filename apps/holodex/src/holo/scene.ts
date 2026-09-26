import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Texture,
} from 'three';
import { firstLoaded, textureUrls } from '../lib/asset-proxy';
import { EFFECTS } from './effects';
import { findInk, paintInk } from './ink';
import { createMaterial, NO_INK } from './material';
import {
  BORDER_ROUND,
  cutsFor,
  inkReadsFor,
  inkStripFor,
  regionFor,
  type CardLayout,
  type CutBox,
  type InkRead,
} from './regions';
import type { ClipShape, HoloSelection } from './select';
import type { Effect } from './shader/types';
import { makeTexture, type TextureName } from './textures';

export interface HoloScene {
  /** Textures the card from the first of its art files that loads, in order. */
  setCard: (urls: readonly string[]) => Promise<void>;
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

/**
 * uCutOval for a region's cuts, in the order uCutA to uCutD take them: 1
 * where a cut is the ellipse its box holds (CutBox.oval), 0 for a box or a
 * cut the region lacks. Pure for the same reason as pointerToUV.
 */
export function cutOvalUniform(cuts: readonly CutBox[]): [number, number, number, number] {
  const [a, b, c, d] = cuts;
  return [a?.oval ? 1 : 0, b?.oval ? 1 : 0, c?.oval ? 1 : 0, d?.oval ? 1 : 0];
}

/**
 * uCutSlant for a region's cuts, in the same order: how far each cut's right
 * edge leans by its bottom (CutBox.slant), 0 for an upright one or a cut the
 * region lacks. Pure for the same reason as pointerToUV.
 */
export function cutSlantUniform(cuts: readonly CutBox[]): [number, number, number, number] {
  const [a, b, c, d] = cuts;
  return [a?.slant ?? 0, b?.slant ?? 0, c?.slant ?? 0, d?.slant ?? 0];
}

/**
 * uBorder for a selection (HoloSelection.border): the `borders` rect, top,
 * right, bottom, left, whose outside coverage() adds to the region, or all
 * zeros, a rect holding the whole card, which adds nothing. Pure for the same
 * reason as pointerToUV.
 */
export function borderUniform(border: boolean): [number, number, number, number] {
  if (!border) return [0, 0, 0, 0];
  const r = regionFor('borders');
  return [r.top, r.right, r.bottom, r.left];
}

/**
 * uBorderRound for a selection: the radii of the border rect's corners
 * (regions.ts's BORDER_ROUND), x of the card's width and y of its height, as
 * the card face rounds its own, or zeros, which with uBorder's zeros leave the
 * whole-card rect a plain one. Pure for the same reason as pointerToUV.
 */
export function borderRoundUniform(border: boolean): [number, number] {
  return border ? [BORDER_ROUND.x, BORDER_ROUND.y] : [0, 0];
}

/**
 * uInkRect for a selection: the strip whose printed ink coverage() keeps the
 * foil off (regions.ts's inkStripFor), x0, y0, x1, y1, or zeros, a strip
 * holding nothing. Pure for the same reason as pointerToUV.
 */
export function inkRectUniform(
  shape: ClipShape,
  layout: CardLayout,
): [number, number, number, number] {
  const strip = inkStripFor(shape, layout);
  return strip ? [strip.x0, strip.y0, strip.x1, strip.y1] : [0, 0, 0, 0];
}

/**
 * The card's printed ink over the strip its reads span, as the texture
 * coverage() reads it in (the strip's rows from the top, one byte a texel):
 * the frame's painted shapes, and the letters found on the card's own scan
 * (ink.ts), each read with its own darkness. A scan whose pixels cannot be
 * read (a tainted canvas) keeps its letters foiled; null for an image with no
 * size at all.
 */
function inkTexture(card: Texture, strip: CutBox, reads: readonly InkRead[]): DataTexture | null {
  const image = card.image as (CanvasImageSource & { width: number; height: number }) | null;
  if (!image?.width || !image.height) return null;
  // a box in the scan's own pixels
  const pixelsOf = (b: CutBox) => {
    const x0 = Math.round(b.x0 * image.width);
    const y0 = Math.round(b.y0 * image.height);
    return {
      x0,
      y0,
      w: Math.round(b.x1 * image.width) - x0,
      h: Math.round(b.y1 * image.height) - y0,
    };
  };
  const span = pixelsOf(strip);
  const ink = new Uint8Array(span.w * span.h);
  // the frame's own shapes first: they need no pixels read
  for (const read of reads) {
    if (!read.painted) continue;
    const r = pixelsOf(read.box);
    paintInk(ink, span.w, { ...r, x0: r.x0 - span.x0, y0: r.y0 - span.y0 }, read.painted.hole);
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no 2d context');
    for (const read of reads) {
      if (read.painted) continue;
      const r = pixelsOf(read.box);
      canvas.width = r.w;
      canvas.height = r.h;
      context.drawImage(image, r.x0, r.y0, r.w, r.h, 0, 0, r.w, r.h);
      const found = findInk(context.getImageData(0, 0, r.w, r.h), image.width / 600, read);
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          const [sx, sy] = [r.x0 - span.x0 + x, r.y0 - span.y0 + y];
          if (found[y * r.w + x] && sx >= 0 && sy >= 0 && sx < span.w && sy < span.h) {
            ink[sy * span.w + sx] = 255;
          }
        }
      }
    }
  } catch {
    // pixels that cannot be read leave the letters foiled; the painted shapes stand
  }
  const texture = new DataTexture(ink, span.w, span.h, RedFormat);
  // rows of one byte, as wide as the strip happens to be
  texture.unpackAlignment = 1;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
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
  // The current selection, whose ink strip, with the card, says what ink
  // there is to cut; and that ink, found once per card and strip.
  let selection: HoloSelection | null = null;
  let ink: { card: Texture; reads: readonly InkRead[]; texture: DataTexture | null } | null = null;

  // Binds the card's ink over the selection's strip onto a material, finding
  // it first if the card or the strip is new; none, where either is missing.
  const bindInk = (material: ShaderMaterial) => {
    if (!('uInk' in material.uniforms)) return;
    const strip = selection && inkStripFor(selection.shape, selection.layout);
    // the layout's own reads, the same array for as long as the card is
    const reads = selection ? inkReadsFor(selection.shape, selection.layout) : [];
    if (strip && cardTexture && (ink?.card !== cardTexture || ink.reads !== reads)) {
      ink?.texture?.dispose();
      ink = { card: cardTexture, reads, texture: inkTexture(cardTexture, strip, reads) };
    }
    const texture = strip && ink?.card === cardTexture ? ink.texture : null;
    material.uniforms.uInk.value = texture ?? NO_INK;
    material.uniforms.uInkRect.value.set(
      ...(texture && selection ? inkRectUniform(selection.shape, selection.layout) : [0, 0, 0, 0]),
    );
  };

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
    async setCard(urls) {
      // Through Holodex's own asset proxy first (lib/asset-proxy.ts), which
      // lives at the root of Holodex's origin, whatever page it is mounted
      // on: BASE_URL is absolute in a deployed build (HOLODEX_BASE), and `/`
      // in dev, where this module's own URL is on the dev server.
      const origin = new URL(import.meta.env.BASE_URL, import.meta.url);
      const texture = await firstLoaded(textureUrls(urls, origin), (src) =>
        new TextureLoader().loadAsync(src),
      );
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
      bindInk(material);
    },
    setSelection(next) {
      const material = createMaterial(next.effect);
      // basic itself failed to compile; leave the current mesh material
      // alone and let the React layer fall back to the plain image.
      if (!material) return;
      selection = next;

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
      const cuts = cutsFor(selection.shape, selection.layout);
      const [cutA, cutB, cutC, cutD] = cuts;
      material.uniforms.uCutA.value.set(...cutUniform(cutA));
      material.uniforms.uCutB.value.set(...cutUniform(cutB));
      material.uniforms.uCutC.value.set(...cutUniform(cutC));
      material.uniforms.uCutD.value.set(...cutUniform(cutD));
      material.uniforms.uCutOval.value.set(...cutOvalUniform(cuts));
      material.uniforms.uCutSlant.value.set(...cutSlantUniform(cuts));
      material.uniforms.uBorder.value.set(...borderUniform(selection.border));
      material.uniforms.uBorderRound.value.set(...borderRoundUniform(selection.border));
      material.uniforms.uInvert.value = selection.invert ? 1 : 0;
      material.uniforms.uCardGlow.value.set(...selection.glow);
      material.uniforms.uFoilBrightness.value = selection.foilBrightness;
      bindInk(material);

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
      ink?.texture?.dispose();
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

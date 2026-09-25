import type { ClipShape } from '../select';
import type { BlendMode } from './blend';

/**
 * A number that may follow the pointer. The reference writes these as CSS
 * calc() over --pointer-from-center and friends; here they are a base plus
 * coefficients the shader evaluates per fragment.
 */
export interface PointerDriven {
  base: number;
  /**
   * multiplied by distance from card centre: 0 at centre, 1 from the middle of
   * an edge outward, as the reference's --pointer-from-center (scene.ts's
   * pointerFromCenter)
   */
  fromCenter?: number;
  /** multiplied by pointer position across the card, 0..1 */
  fromLeft?: number;
  fromTop?: number;
  /**
   * multiplied by the card's --foil-brightness (the shader's uFoilBrightness,
   * select.ts#foilBrightnessOf): reverse-holo's shine brightness
   */
  fromFoilBrightness?: number;
}

/**
 * A stop where CSS puts it, for the exact gradients (the css-* sources): its
 * place along the gradient, its straight colour, and its alpha.
 */
export interface GradientStop {
  /**
   * along the gradient: gradient lengths for css-linear (one period, 0..1, for
   * a repeating one), radii for css-radial, turns for css-conic
   */
  at: number;
  color: [number, number, number];
  /** 0..1; left out, 1 */
  alpha?: number;
  /** how much of the colour is the card's glow instead (uCardGlow), 0..1; left out, 0 */
  glow?: number;
}

/** One entry in a layer stack — the GLSL equivalent of one background-image. */
export type Source =
  | { kind: 'solid'; color: [number, number, number] }
  | {
      /** repeating-linear-gradient(angle, stops...) — the foil's rainbow bands */
      kind: 'repeating-linear';
      angleDeg: number;
      /** fraction of the gradient each stop occupies; the reference's --space */
      space: number;
      stops: Array<[number, number, number]>;
    }
  | { kind: 'linear'; angleDeg: number; stops: Array<[number, number, number]> }
  | {
      /** radial-gradient(circle at pointer, stops...) — the glare */
      kind: 'radial-pointer';
      stops: Array<{ at: number; color: [number, number, number] }>;
      /**
       * CSS's own `farthest-corner` geometry, for a radial converted from the
       * reference's CSS (effects/css.ts#radial): the circle's centre on the
       * card, following the pointer, and the size of the image it is drawn in,
       * both as fractions of the card. Its radius then reaches the corner of
       * that image farthest from the centre, in true lengths on the 63:88 card,
       * and grows as the pointer leaves the middle, as the reference's does.
       * Give such a layer no size or offset: it is drawn in the card's own uv.
       *
       * Left out, the radial keeps the DSL's own fixed radius, centred on the
       * pointer in the layer's uv — what the effects drawn by hand, rather than
       * converted, were tuned against.
       */
      cssBox?: { centre: [PointerDriven, PointerDriven]; size: [number, number] };
    }
  | { kind: 'conic'; stops: Array<[number, number, number]> }
  /** tiled value-noise sparkle, generated once into a texture */
  | { kind: 'glitter'; scale: number }
  /** tiled film grain, generated once into a texture */
  | { kind: 'grain'; scale: number }
  /**
   * tiled fine speckle, violet, blue and white dots on near-black: the
   * reference's --iri1..9, and the stand-in for its per-card --foil
   */
  | { kind: 'iri'; scale: number }
  /**
   * rainbow four-pointed star sparkles on black, drawn in the card's own 63:88
   * so they stay square on it: the reference's --birthday-dank / --birthday
   */
  | { kind: 'birthday'; scale: number }
  /**
   * The 151 set's Poké Ball and Master Ball patterns (the reference's
   * --pokeball, --pokeball-inner, --masterball, --masterball-inner): a square
   * tile of ball glyphs, white where the reference's mask lets foil through
   * and black where it does not. The reference applies them as alpha masks,
   * which this DSL has no notion of. Put one last in a stack with `multiply`
   * instead, and the layers beneath it show only through the glyphs; under a
   * `color-dodge`, `plus-lighter` or `lighten` mixBlend the black leaves the
   * card as it was.
   *
   * `-inner` is each ball's upper cap, on the same lattice as its outline, so
   * the two line up at the same scale and offset. The reference's caps are
   * about 53% opaque; these are full strength, so put that 0.53 in the
   * element's opacity. Baking it into the texture would not survive the
   * element filter, which here runs after the layer stack where CSS filters
   * before masking. The tile is square: to keep the balls round on the 63:88
   * card, give the layer `size: [1, 88 / 63]`.
   */
  | { kind: 'pokeball'; scale: number }
  | { kind: 'pokeball-inner'; scale: number }
  | { kind: 'masterball'; scale: number }
  | { kind: 'masterball-inner'; scale: number }
  /**
   * a diagonal line maze, white on black, standing in for pokemon-cards-css's
   * geometric.png (textures.ts); 300 px square
   */
  | { kind: 'geometric'; scale: number }
  /** blue wavy lines on white, standing in for its trainerbg.png; 208 px square */
  | { kind: 'trainerbg'; scale: number }
  /** warped black and white bands, standing in for its illusion.png; 600 px square */
  | { kind: 'illusion'; scale: number }
  /**
   * the same bands with alpha, black opaque and white all but clear, for its
   * illusion-mask.png; sampled with its alpha (compile.ts's ALPHA_TEXTURES)
   */
  | { kind: 'illusion-mask'; scale: number }
  /** stepped zig-zag stripes, white on black, standing in for its ancient.png; 300 px square */
  | { kind: 'ancient'; scale: number }
  /** overlapping ringed discs in embossed blue, standing in for its vmaxbg.jpg; 600 × 400 px */
  | { kind: 'vmaxbg'; scale: number }
  /** a seeded starfield, opaque, standing in for its cosmos-bottom.png; 734 × 1024 px */
  | { kind: 'cosmos-bottom'; scale: number }
  /**
   * the same starfield's middle and top layers, clear but for some of its
   * objects, for its cosmos-middle-trans.png and cosmos-top-trans.png; sampled
   * with their alpha (compile.ts's ALPHA_TEXTURES)
   */
  | { kind: 'cosmos-middle'; scale: number }
  | { kind: 'cosmos-top'; scale: number }
  /**
   * linear-gradient or repeating-linear-gradient drawn as CSS draws it, on
   * the RGBA path: t = a·u + b·v + c along its gradient line, 0 at the line's
   * start and 1 at its end (css.ts works the line out), its stops where CSS
   * puts them. A repeating one's stops are one period, normalised to 0..1,
   * and t wraps into it. Give the layer no size or offset.
   */
  | {
      kind: 'css-linear';
      repeating: boolean;
      line: { a: number; b: number; c: PointerDriven };
      stops: GradientStop[];
    }
  /**
   * radial-gradient drawn as CSS draws it, on the RGBA path: CSS's
   * farthest-corner geometry (sources.ts#radialReach), from a centre on the
   * card that sits at `at` of an image of `size`, circle or ellipse, its
   * stops in radii and carried past the ending shape. Give the layer no size
   * or offset.
   */
  | {
      kind: 'css-radial';
      centre: [PointerDriven, PointerDriven];
      size: [number, number];
      at: [PointerDriven, PointerDriven];
      ellipse: boolean;
      stops: GradientStop[];
    }
  /**
   * conic-gradient drawn as CSS draws it, on the RGBA path: about `centre`,
   * clockwise from `from` turns off the top, in the card's true proportions,
   * its stops in turns. Give the layer no size or offset.
   */
  | { kind: 'css-conic'; centre: [number, number]; from: number; stops: GradientStop[] }
  /** the card art itself */
  | { kind: 'card' }
  /** horizontal scanlines, as in regular-holo */
  | { kind: 'scanlines'; spacing: number; light: number; dark: number };

export interface Layer {
  source: Source;
  /** how this layer combines with the ones beneath it inside the same element */
  blend: BlendMode;
  /** background-size: 1 means cover; 4 means the source repeats 4x */
  size?: [number, number];
  /** background-position, as a fraction; may follow the pointer */
  offset?: { x: PointerDriven; y: PointerDriven };
  /**
   * The layer's own opacity, as its pseudo-element's `opacity`: how much of the
   * blend onto the layers beneath it shows, clamped to 0..1. Left out, 1. The
   * first layer has nothing beneath it, so its opacity is the element's.
   */
  opacity?: PointerDriven;
}

/** CSS filter: brightness()/contrast()/saturate(), each pointer-driven. */
export interface Filter {
  brightness?: PointerDriven;
  contrast?: PointerDriven;
  saturate?: PointerDriven;
}

/** One of the reference's .card__shine / .card__glare elements. */
export interface Element {
  layers: Layer[];
  filter?: Filter;
  /** how the finished element composites onto everything below it */
  mixBlend: BlendMode;
  opacity?: PointerDriven;
  /**
   * Confines this one element to a region of its own, inside whatever the
   * effect's clip (select.ts#clipShape) allows every shine element — for a
   * reference whose pseudo-elements carry a clip-path of their own, as
   * poke-ball-holo's :before and :after clip to the card inside its border
   * while their shine clips to the card less its art window. The region's
   * rect only, never inverted; `stage`'s step-cut is not applied, so it is not
   * offered.
   */
  clip?: Exclude<ClipShape, 'stage'>;
  /**
   * The pseudo-elements that paint inside this element's isolated group, in
   * paint order: resolve the reference's z-index into this order (its
   * pseudo-elements are grid items, so a positive z-index paints after
   * `auto`, which paints in DOM order). Each is drawn whole — its layers, its
   * filter, then its opacity and clip on its alpha — and composited onto the
   * group with its mixBlend; the element's filter then applies to the whole
   * group, and its mixBlend composites the group onto the card, as CSS draws
   * `.card__shine`. A child has no children of its own. An element with
   * children compiles to the RGBA path (compile.ts#needsRGBA).
   */
  children?: Element[];
}

export interface Effect {
  id: string;
  /** 1–3 elements, matching .card__shine and its :before / :after */
  shine: Element[];
  /** 0–2 elements, matching .card__glare and its :after, painted above the shine */
  glare: Element[];
  /**
   * Glare elements painted onto the card beneath the shine instead, counted in
   * glare's budget of two. The reference stacks its card's layers by z-index:
   * .card__glitter is 2 and .card__shine 3 (base.css), so a .card__glare or
   * .card__glare2 its rarity's CSS gives no z-index paints below both, and the
   * shine then dodges the card the glare has already lit or darkened — a
   * different picture from the same glare laid over the shine. The effect's
   * clip region applies to the shine alone, over whatever lies beneath it.
   */
  beneath?: Element[];
}

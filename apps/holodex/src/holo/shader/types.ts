import type { BlendMode } from './blend';

/**
 * A number that may follow the pointer. The reference writes these as CSS
 * calc() over --pointer-from-center and friends; here they are a base plus
 * coefficients the shader evaluates per fragment.
 */
export interface PointerDriven {
  base: number;
  /** multiplied by distance from card centre, 0 at centre, 1 at a corner */
  fromCenter?: number;
  /** multiplied by pointer position across the card, 0..1 */
  fromLeft?: number;
  fromTop?: number;
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
    }
  | { kind: 'conic'; stops: Array<[number, number, number]> }
  /** tiled value-noise sparkle, generated once into a texture */
  | { kind: 'glitter'; scale: number }
  /** tiled film grain, generated once into a texture */
  | { kind: 'grain'; scale: number }
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
}

export interface Effect {
  id: string;
  /** 1–3 elements, matching .card__shine and its :before / :after */
  shine: Element[];
  /** 0–2 elements, matching .card__glare and its :after */
  glare: Element[];
}

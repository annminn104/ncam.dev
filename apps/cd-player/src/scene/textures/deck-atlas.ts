import data from './deck-atlas.json';

/**
 * The Deck's print layer: one 2048 × 1024 canvas mapped onto every print zone of its GLB through
 * one material, `deck_pattern`. art/blender/scripts/deck_print.py writes the layout,
 * deck-atlas.json, as it builds the GLB (never edit it by hand: rebuild); the painter
 * (deck-pattern.ts) reads it, and the GLB's contract test holds each print mesh's UVs inside its
 * region. Three-free and pure.
 *
 * A planar region's x runs across its face left to right, seen from outside, and its y down it
 * (the top plate's from its back edge). A `'ring'` region's x runs clockwise from twelve, seen from
 * above (the LED ring's way), and its y from the inner edge (row 0) out; a `'band'` region (the
 * screen's bezel) runs clockwise round the frame from its top-left corner, its y from the glass's
 * edge out. Those two mirror what is painted on them, seen from where they are seen, so the
 * painter flips them.
 */
export type RegionKind = 'plate' | 'ring' | 'panel' | 'band' | 'nameplate';

/**
 * What a region is printed on: its ink takes the tone that reads there (deck-pattern.ts inksFor).
 */
export type Ground = 'body' | 'case' | 'acrylic' | 'glass' | 'metal';

export interface AtlasRegion {
  readonly id: string;
  readonly kind: RegionKind;
  readonly ground: Ground;
  /** The region's rect in the atlas, in pixels, y down: the canvas's rows, glTF's v. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The zone's size on the model, in mm. */
  readonly mmW: number;
  readonly mmH: number;
  /** The top plate's only: the jog's centre, in pixels from the region's corner. */
  readonly centre?: readonly [number, number];
  /** The case front's only: "PROPERTY OF" and the name, stencilled. */
  readonly stencil?: boolean;
}

export interface DeckAtlas {
  readonly width: number;
  readonly height: number;
  readonly regions: readonly AtlasRegion[];
}

/** deck-atlas.json, typed (deck-atlas.test.ts checks the layout itself). */
export const DECK_ATLAS: DeckAtlas = data as DeckAtlas;

/** A region's pixels per mm (the same across and down). */
export function pxPerMm(region: AtlasRegion): number {
  return region.w / region.mmW;
}

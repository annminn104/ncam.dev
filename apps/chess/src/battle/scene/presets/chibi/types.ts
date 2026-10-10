import type { PieceSymbol } from 'chess.js';
import type { BufferGeometry } from 'three';
import type { Side } from '../../../../game/coords';

// The chibi piece sets' data model. Piece space throughout: origin at the base's centre on the
// board, +y up, the figure facing +z (its owner; black's pieces are turned round by the caller).

export type ChibiPresetId = 'holy-order' | 'dark-court' | 'gentlemen' | 'bunny-mages';

/**
 * A palette's colour slots. `skin` is bone on a skull; `ink` draws the outline (and dark boots);
 * `glow` is for unlit accents (halos, candle flames, glowing eyes).
 */
export type PaletteSlot =
  'skin' | 'hair' | 'eyes' | 'main' | 'second' | 'trim' | 'accent' | 'ink' | 'glow';
export type Palette = Record<PaletteSlot, string>;

/** `none` is for skulls and helms: no hair is built. */
export type HairStyle = 'spiky' | 'ponytail' | 'bob' | 'none';
/** `visor`: the head itself is a helmet (painted `second`), the slit drawn on its front. */
export type FaceStyle = 'anime' | 'skull' | 'visor';
export type BodyStyle = 'coat' | 'robe' | 'gown' | 'armor' | 'dress' | 'tailcoat';

/** Rig measurements in piece space, from rig.ts's `frameFor`. */
export interface Frame {
  /** The base's top, where the boots (or a gown's hem) stand. */
  standY: number;
  /** The head's centre and radius (the head is a little squashed: rig.ts's HEAD_SQUASH). */
  headY: number;
  headR: number;
  shoulderY: number;
  hipY: number;
  /** The widest a skirt or robe may flare. */
  bodyR: number;
  /** Top of the head, hair included: headwear sits on it (accessories add on top). */
  top: number;
}

export interface PartCtx {
  type: PieceSymbol;
  side: Side;
  palette: Palette;
  frame: Frame;
  quality: 'high' | 'low';
}

/**
 * What a part adds, painted (vertex colours) and placed in piece space. `body` merges into the
 * toon-shaded, ink-outlined figure; `accents` into its one unlit, glowing mesh.
 */
export interface PartOut {
  body?: BufferGeometry[];
  accents?: BufferGeometry[];
}

export type PartBuilder = (ctx: PartCtx) => PartOut;

/** One piece type's figure: the rig's styles, then the parts built on it (hats, props, mounts). */
export interface ChibiRecipe {
  hair: HairStyle;
  face: FaceStyle;
  body: BodyStyle;
  parts: readonly PartBuilder[];
  /** A rider: no legs, hips raised for the mount (a part) that fills the figure's lower 45 %. */
  mounted?: boolean;
}

export interface Outfit {
  id: ChibiPresetId;
  palette: Record<Side, Palette>;
  pieces: Record<PieceSymbol, ChibiRecipe>;
}

import type { PatternStyle } from '../../personal';
import type { DeckAtlas } from './deck-atlas';
import { context } from './paint';
import { type PatternPrint, type Area, areaOf, engrave, stencil } from './deck-pattern-core';
import { guilloche } from './deck-pattern-guilloche';
import { circuit } from './deck-pattern-circuit';
import { waves } from './deck-pattern-waves';
import { stickers } from './deck-pattern-stickers';
import { graffiti } from './deck-pattern-graffiti';

/**
 * The Deck's print layer (the spec's "Personal patterns"): one of five patterns over every zone of
 * the atlas (deck-atlas.ts), in the light's three colours and two neutrals, its variant seeded by
 * the collection, and the visitor's name engraved on the nameplate and stencilled on the flight
 * case. Every region is painted in mm, from a stream of its own, so a print repaints the same.
 *
 * The material cuts at alphaTest 0.5, so the painter draws opaque or not at all: no alpha but 1,
 * no gradient, no blur, and no line under 2 px, which the cut would lose.
 */

export {
  ATLAS_DARK,
  ATLAS_LIGHT,
  collectionSeed,
  inksFor,
  JOG_OPENING,
  OPEN,
  patternKey,
  STICKER_WORDS,
  type Inks,
  type PatternPrint,
} from './deck-pattern-core';

const PAINTERS: Readonly<
  Record<PatternStyle, (ctx: CanvasRenderingContext2D, area: Area) => void>
> = { guilloche, circuit, waves, stickers, graffiti };

/**
 * Paints the atlas for a print: the canvas cleared (transparent is no print), then each region in
 * its clip and its mm, the rim and the bezel flipped so what runs along them reads the right way
 * round: the pattern (none for Plain), the stencil on the case's front, the name on the nameplate.
 */
export function paintDeckPattern(
  canvas: HTMLCanvasElement,
  atlas: DeckAtlas,
  print: PatternPrint,
): void {
  const ctx = context(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const region of atlas.regions) {
    const area = areaOf(region, print);
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    ctx.translate(region.x, region.y);
    if (region.kind === 'ring' || region.kind === 'band') {
      ctx.translate(0, region.h);
      ctx.scale(1, -1);
    }
    ctx.scale(area.k, area.k);
    if (region.kind === 'nameplate') engrave(ctx, area);
    else {
      if (print.style) PAINTERS[print.style](ctx, area);
      if (region.stencil) stencil(ctx, area);
    }
    ctx.restore();
  }
}

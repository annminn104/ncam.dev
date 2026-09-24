import type { Effect, Filter, Layer } from '../shader/types';
import {
  BLACK,
  COVER,
  POINTER_X,
  POINTER_Y,
  SUNPILLAR,
  WHITE,
  composeFilters,
  filtered,
  fixed,
  grey,
  hsl,
  linear,
  pxTall,
  pxWide,
  radial,
  radialMask,
  repeatingLinear,
  stop,
  texture,
  type CssBox,
} from './css';

/**
 * The 151 set's Poke Ball reverse holo, ported from pokemon-cards-151's
 * poke-ball-holo.css (css.ts has the conversions and the approximations every
 * port shares). The reference gives the Poke Ball and the Master Ball one set
 * of rules and swaps only the patterns (`--mask`), so ballHolo builds either,
 * and masterball-holo.ts is its Master Ball.
 *
 * The foil shows on the balls. The reference masks a sunpillar gradient with
 * each pattern, an alpha mask whose glyphs are opaque; ours are white glyphs
 * on black (textures.ts), laid over the gradient with multiply (see the
 * :before and :after below).
 *
 * The glow is a dodge. The reference lightens its :before and plus-lighters its
 * :after onto the shine's grey inside the shine's isolated group, then
 * color-dodges the whole group onto the card through the shine's filter. The
 * DSL has no groups, so each glyph element color-dodges onto the card on its
 * own, through its own filter and then the shine's (GROUP_FILTER): the balls
 * brighten the card beneath them as the reference's do, rather than adding a
 * dim tint over it.
 *
 * Approximations:
 * - Where the glyphs cross the shine's grey, the reference dodges once by
 *   their lighten or plus-lighter; here the grey and the glyphs dodge in turn.
 *   Two dodges compound, so a cap runs a little stronger than the reference's
 *   over the grey and an outline a little weaker.
 * - The caps' opacity: the reference clamps `calc(var(--card-opacity) +
 *   var(--pointer-from-center) - 0.75)` at 1 before the caps' 53% applies;
 *   here the 53% scales it first, so past --pointer-from-center 0.75 the caps
 *   run up to a quarter stronger.
 * - The per-type overrides of --inner-brightness, --outer-brightness, --shine,
 *   --glare and --glare-contrast (darkness, fire, psychic, …) are not ported:
 *   an effect knows nothing of the card's type, so the defaults are used.
 * - --noise is `grain`, --iri1 is `iri`.
 * - The glare's clip-path, --viewport-edge-clip (the card less its art
 *   window), is not applied: the DSL's glare is unclipped by design
 *   (compile.ts).
 * - The reference clips its layers apart, both regions from cards.css: the
 *   shine to --clip-invert (the card less its art window, border and all),
 *   the :before and :after also to --clip-borders-invert (the card inside its
 *   silver border). Here the shine takes select.ts's region, and the glyph
 *   elements also carry an element clip of `borders` (shader/types.ts), which
 *   is that polygon less the small notch it cuts at the top-left corner.
 */

// the reference's defaults for every ball holo
const SHINE = 0.8; // --shine
const GLARE = 0.8; // --glare
const GLARE_CONTRAST = 1; // --glare-contrast
const OUTER_BRIGHTNESS = 0.55; // --outer-brightness

/**
 * .card__shine's `filter: brightness(.75) contrast(1) saturate(1)`, which the
 * reference applies to its whole group — its own grey and both glyph layers —
 * before color-dodging it onto the card. The glyph elements compose it after
 * their own filters.
 */
const GROUP_FILTER: Filter = {
  brightness: { base: 0.75 },
  contrast: { base: 1 },
  saturate: { base: 1 },
};

/**
 * The reference's inner caps are drawn about 53% opaque. Ours are drawn at
 * full strength, because the element filter here runs after the layer stack
 * and would crush a half-strength texture (shader/types.ts), so the 53% goes
 * into the caps' element opacity instead.
 */
export const INNER_CAP_ALPHA = 0.53;

/**
 * --sunpillar-4, 5, 6, 1, 2, 3 and back to 4, twice over, as thirteen stops
 * spread evenly over the gradient. Inside its image, which always covers the
 * card here, that is one repeating period over the first half.
 */
const BALL_SUNPILLAR = [3, 4, 5, 0, 1, 2, 3].map((i, k) => stop(SUNPILLAR[i], (50 * k) / 6));

/** --noise and --iri1: 300px by 300px, at `calc(var(--seedx) * 500px)`, which is 0 here */
const SPECKLE: CssBox = { size: [pxWide(300), pxTall(300)], position: [fixed(0), fixed(0)] };

export interface BallPatterns {
  /** the outline, --pokeball or --masterball, masking the :after */
  outer: 'pokeball' | 'masterball';
  /** the cap, --pokeball-inner or --masterball-inner, masking the :before */
  inner: 'pokeball-inner' | 'masterball-inner';
}

/**
 * A multiply stand-in for the reference's alpha mask. It replaces the rules'
 * `--mask: var(--pokeball)` / `--mask: var(--pokeball-inner)` (and the
 * masterball-holo overrides of both), with `mask-image: var(--mask)`,
 * `mask-size: 40% auto`, `mask-mode: alpha`: white keeps the gradient beneath
 * it, black turns it to black, which color-dodges the card to itself. The
 * tile is square and 40% of the card wide, 2.5 across; its
 * `mask-position` is --seedx / --seedy, 0 here.
 */
const pattern = (kind: BallPatterns['outer'] | BallPatterns['inner']): Layer => ({
  source: { kind, scale: 2.5 },
  blend: 'multiply',
  size: [1, 88 / 63],
});

export function ballHolo(id: string, patterns: BallPatterns): Effect {
  return {
    id,
    shine: [
      // .card__shine
      {
        layers: [
          {
            // hsla(0, 0%, calc(var(--shine) * 50%)) 15%, … 25% 45%, … 25% 55%, … 50% 85%;
            // background-size: 200%, its height auto: 100% for a gradient
            ...linear(
              45,
              [
                stop(grey(SHINE * 0.5), 15),
                stop(grey(SHINE * 0.25), 45),
                stop(grey(SHINE * 0.25), 55),
                stop(grey(SHINE * 0.5), 85),
              ],
              { size: [2, 1], position: [POINTER_X, POINTER_Y] },
            ),
            blend: 'normal',
          },
        ],
        filter: GROUP_FILTER,
        mixBlend: 'color-dodge',
      },
      // :before, the caps
      {
        // background-image bottom first. background-blend-mode `darken,
        // color-burn` lists the gradient and the noise top first.
        layers: [
          { ...texture('iri', SPECKLE), blend: 'normal' },
          { ...texture('grain', SPECKLE), blend: 'color-burn' },
          {
            // at `var(--pointer-y) var(--pointer-x)`, the axes crossed as the reference writes them
            ...repeatingLinear(225, BALL_SUNPILLAR, {
              size: [1.7, 1.7],
              position: [POINTER_Y, POINTER_X],
            }),
            blend: 'darken',
          },
          // The pattern is all of the :before's mask: its own rule replaces the
          // radial the :after's mask also has.
          pattern(patterns.inner),
        ],
        // Its own filter, then the group's. A binary mask survives both after
        // it: black stays black through a contrast of 2 and any saturate.
        filter: composeFilters(
          {
            brightness: { base: 0.75 },
            contrast: { base: 2 },
            saturate: { base: 0, fromCenter: 1 },
          },
          GROUP_FILTER,
        ),
        // the group's dodge, standing in for its lighten into the group (see above)
        mixBlend: 'color-dodge',
        // calc(var(--card-opacity) + (var(--pointer-from-center)) - 0.75), at the caps' 53%
        opacity: { base: 0.25 * INNER_CAP_ALPHA, fromCenter: INNER_CAP_ALPHA },
        // clip-path: var(--clip-borders-invert)
        clip: 'borders',
      },
      // :after, the outlines
      {
        layers: [
          // The :after's brightness and contrast are baked into the gradient so
          // that the soft fade below applies after them, as the reference masks
          // after it filters; only the pointer-driven saturate is left to run
          // last, and it passes a greyscale mask through untouched.
          {
            ...filtered(
              repeatingLinear(45, BALL_SUNPILLAR, {
                size: [2, 2],
                position: [POINTER_X, POINTER_Y],
              }),
              { brightness: OUTER_BRIGHTNESS, contrast: 1.8 },
            ),
            blend: 'normal',
          },
          pattern(patterns.outer),
          // The mask's second layer, radial-gradient(farthest-corner at
          // var(--pointer-x) var(--pointer-y), hsla(0, 0%, 100%, 1) 20%,
          // transparent 80%), which mask-composite: subtract takes out of the
          // pattern: the pattern is kept where that radial is transparent, so
          // this layer's alpha is the radial's turned over, 0 at 20% and 1 at 80%.
          ...radialMask([stop(WHITE, 20, 0), stop(WHITE, 80, 1)], 0),
        ],
        // its own saturate, then the group's filter
        filter: composeFilters({ saturate: { base: 0, fromCenter: 1.1 } }, GROUP_FILTER),
        // the group's dodge, standing in for its plus-lighter into the group (see above)
        mixBlend: 'color-dodge',
        // clip-path: var(--clip-borders-invert)
        clip: 'borders',
      },
    ],
    // The reference stacks by z-index: .card__glare2 has none, so it paints
    // beneath the shine (3); poke-ball-holo.css gives .card__glare z-index: 5,
    // above it. The shine dodges a card glare2 has already darkened, and the
    // glare's overlay then works on the result.
    beneath: [
      {
        // .card__glare2 keeps base.css's radial and multiplies it; its alpha
        // folds toward white, which multiply leaves unchanged.
        layers: [
          {
            ...radial(
              [stop(WHITE, 10, 0.8), stop(WHITE, 20, 0.65), stop(BLACK, 90, 0.5)],
              COVER,
              WHITE,
            ),
            blend: 'normal',
          },
        ],
        mixBlend: 'multiply',
      },
    ],
    glare: [
      {
        layers: [
          { ...radial([stop(hsl(346, 25, 80), 10), stop(hsl(207, 30, 40), 90)]), blend: 'normal' },
        ],
        filter: { brightness: { base: 0.75 * SHINE }, contrast: { base: GLARE_CONTRAST } },
        mixBlend: 'overlay',
        opacity: { base: GLARE },
      },
    ],
  };
}

export const pokeBallHolo = ballHolo('poke-ball-holo', {
  outer: 'pokeball',
  inner: 'pokeball-inner',
});

import {
  BLACK,
  WHITE,
  grey,
  neutralBefore,
  stop,
  type CssStop,
  type FixedFilter,
  type RGB,
} from './css';

/*
 * What the ports of the 22 effects derived from pokemon-cards-css share, for
 * their glares: base.css's own radial, the colour a transparent glare folds
 * toward, and CSS's source-over of one gradient onto another. The glares
 * themselves are ported rule by rule in each effect's file, through css.ts,
 * and paint beneath the shine (`Effect.beneath`): pokemon-cards-css gives
 * `.card__shine` `z-index: 3` and `.card__glare` none, as poke-151 does,
 * which poke-holo.simey.me was checked to paint that way (2026-09-25).
 */

/**
 * base.css's glare, which every card of pokemon-cards-css draws unless its
 * rarity paints another: `radial-gradient(farthest-corner circle at the
 * pointer, hsla(0, 0%, 100%, .8) 10%, hsla(0, 0%, 100%, .65) 20%,
 * hsla(0, 0%, 0%, .5) 90%)`, overlaid.
 */
export const BASE_GLARE: CssStop[] = [
  stop(WHITE, 10, 0.8),
  stop(WHITE, 20, 0.65),
  stop(BLACK, 90, 0.5),
];

/** The blends the 22 glares use onto the card. */
export type GlareBlend = 'overlay' | 'soft-light' | 'hard-light' | 'multiply' | 'darken';

/**
 * The colour a glare's transparency folds toward: the one its blend leaves the
 * card as it is (0.5 grey for the overlay family, white for multiply and
 * darken), taken back through the glare's own filter, which the shader runs
 * after the glare's layers.
 */
export function glareNeutral(blend: GlareBlend, filter?: FixedFilter): RGB {
  const target = blend === 'multiply' || blend === 'darken' ? 1 : 0.5;
  return grey(filter ? neutralBefore(filter, target) : target);
}

/** A gradient's colour and alpha at a fraction along it, interpolated premultiplied, as CSS's are. */
function rgbaAt(stops: CssStop[], at: number): { color: RGB; alpha: number } {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (at <= first.at) return { color: first.color, alpha: first.alpha };
  if (at >= last.at) return { color: last.color, alpha: last.alpha };
  const i = stops.findIndex((s) => s.at >= at);
  const [a, b] = [stops[i - 1], stops[i]];
  const f = (at - a.at) / (b.at - a.at);
  const alpha = a.alpha + (b.alpha - a.alpha) * f;
  const color = a.color.map((c, k) => {
    const premultiplied = c * a.alpha + (b.color[k] * b.alpha - c * a.alpha) * f;
    return alpha > 0 ? premultiplied / alpha : 0;
  }) as RGB;
  return { color, alpha };
}

/**
 * `top` painted over `bottom` with no blend, CSS's source-over, as one
 * gradient sampled at `atPercents`: exact for two radials about one centre in
 * one box, which is what a glare and its `:after` are.
 */
export function overStops(top: CssStop[], bottom: CssStop[], atPercents: number[]): CssStop[] {
  return atPercents.map((percent) => {
    const t = rgbaAt(top, percent / 100);
    const b = rgbaAt(bottom, percent / 100);
    const alpha = t.alpha + b.alpha * (1 - t.alpha);
    const color = t.color.map((c, k) =>
      alpha > 0 ? (c * t.alpha + b.color[k] * b.alpha * (1 - t.alpha)) / alpha : 0,
    ) as RGB;
    return stop(color, percent, alpha);
  });
}

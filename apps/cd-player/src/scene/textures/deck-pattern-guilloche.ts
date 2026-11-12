// Guilloché, the Deck print's first style: engine-turned lines (see deck-pattern.ts).
import {
  TAU,
  JOG_OPENING,
  type Area,
  between,
  pick,
  lineOf,
  periodOf,
  centreOf,
  farthest,
} from './deck-pattern-core';

/**
 * Guilloché, engine-turned lines as on a watch dial, in the line ink: on the top, wavy rings round
 * the jog every 2.2–3.4 mm, r(θ) = r₀ + a·sin(kθ + iφ); elsewhere wavy lines across every 2.5–4 mm,
 * y = y₀ + a·sin(2πx/λ + iφ), whose waves join at the rim's and the bezel's seams.
 */
export function guilloche(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h } = area;
  ctx.strokeStyle = area.inks.line;
  ctx.lineWidth = lineOf(area, 0.5);
  ctx.lineJoin = 'round';
  if (area.region.kind === 'plate') {
    const step = between(random, 2.2, 3.4);
    const k = pick(random, [12, 16, 18, 24]);
    const a = between(random, 0.6, 1.2);
    const phi = between(random, 0.15, 0.5);
    const [cx, cy] = centreOf(area);
    // Nothing inside the jog's opening shows: the rings start at its edge.
    for (let i = 0, r0 = JOG_OPENING - step; r0 < farthest(area, cx, cy) + a; i++, r0 += step) {
      const n = Math.ceil(TAU * r0);
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const t = (j / n) * TAU;
        const r = r0 + a * Math.sin(k * t + i * phi);
        ctx.lineTo(cx + r * Math.sin(t), cy - r * Math.cos(t));
      }
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }
  const step = between(random, 2.5, 4);
  const lambda = periodOf(area, between(random, 14, 30));
  const a = between(random, 0.6, 1.2);
  const phi = between(random, 0.15, 0.5);
  for (let i = 0, y0 = between(random, 0, step); y0 < h + a; i++, y0 += step) {
    ctx.beginPath();
    for (let x = 0; x <= w + 1; x += 1) {
      ctx.lineTo(x, y0 + a * Math.sin((TAU * x) / lambda + i * phi));
    }
    ctx.stroke();
  }
}

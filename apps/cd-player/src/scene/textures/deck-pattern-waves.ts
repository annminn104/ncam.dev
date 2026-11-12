// Waves, the Deck print's spectrum bars (see deck-pattern.ts).
import {
  TAU,
  JOG_OPENING,
  type Area,
  between,
  whole,
  lineOf,
  centreOf,
  farthest,
} from './deck-pattern-core';

/** `count` heights in [0, 1]: slow swells and some grain, as a spectrum looks, joining round. */
function swells(random: () => number, count: number): number[] {
  const parts = [
    [whole(random, 1, 3), 0.5],
    [whole(random, 4, 9), 0.3],
    [whole(random, 10, 24), 0.2],
  ].map(([cycles, a]) => [cycles, a, between(random, 0, TAU)]);
  const raw = Array.from(
    { length: count },
    (_, i) =>
      parts.reduce(
        (sum, [cycles, a, phi]) => sum + a * Math.sin((TAU * cycles * i) / count + phi),
        0,
      ) +
      0.45 * random(),
  );
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo || 1));
}

/** The height over which the tallest `share` of `heights` stand. */
const tallest = (heights: readonly number[], share: number) =>
  [...heights].sort((a, b) => b - a)[Math.floor(heights.length * share)] ?? 1;

/**
 * Sound waves: on the top, 6–12 closed waveforms round the jog, r(θ) = r₀ + Σ₃ aⱼ·sin(kⱼθ + φⱼ);
 * on panels and the bezel, 3–5 oscilloscope traces of summed sines across, over a row of spectrum
 * bars 1.2 mm wide on panels; on the rim, bars rising from its inner edge. One trace and the
 * tallest bars are in the accent, the rest in the line ink.
 */
export function waves(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, inks } = area;
  ctx.lineWidth = lineOf(area, 0.6);
  ctx.lineJoin = 'round';
  const bar = Math.max(1.2, area.hair);
  if (area.region.kind === 'plate') {
    const [cx, cy] = centreOf(area);
    const count = whole(random, 6, 12);
    const lit = whole(random, 0, count - 1);
    const span = farthest(area, cx, cy) - JOG_OPENING - 8;
    for (let i = 0; i < count; i++) {
      const r0 = JOG_OPENING + 4 + (span * (i + between(random, 0.3, 0.7))) / count;
      const parts = [
        [between(random, 1, 2.5), whole(random, 3, 8)],
        [between(random, 0.6, 1.6), whole(random, 18, 40)],
        [between(random, 0.3, 0.9), whole(random, 70, 140)],
      ].map(([a, k]) => [a, k, between(random, 0, TAU)]);
      const n = Math.ceil(2 * TAU * r0);
      ctx.strokeStyle = i === lit ? inks.accent : inks.line;
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const t = (j / n) * TAU;
        const r = r0 + parts.reduce((sum, [a, k, phi]) => sum + a * Math.sin(k * t + phi), 0);
        ctx.lineTo(cx + r * Math.sin(t), cy - r * Math.cos(t));
      }
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }
  if (area.region.kind === 'ring') {
    const count = Math.round(w / between(random, 2.2, 3));
    const pitch = w / count;
    const heights = swells(random, count);
    const top = tallest(heights, 0.12);
    heights.forEach((height, i) => {
      const rise = (0.15 + 0.8 * height) * h;
      ctx.fillStyle = height >= top ? inks.accent : inks.line;
      ctx.fillRect(i * pitch + (pitch - bar) / 2, h - rise, bar, rise);
    });
    return;
  }
  const panel = area.region.kind === 'panel';
  const traces = whole(random, 3, 5);
  const lit = whole(random, 0, traces - 1);
  const row = (panel ? 0.6 * h : h) / traces;
  for (let t = 0; t < traces; t++) {
    const mid = panel ? row * (t + 0.5) : h / 2;
    const amp = panel ? 0.42 * row : 0.3 * h;
    // Whole cycles across, so that the bezel's traces join; periods near 60–200, 15–40, 4–9 mm.
    const parts = [
      [1, Math.max(1, Math.round(w / between(random, 60, 200)))],
      [0.45, Math.max(1, Math.round(w / between(random, 15, 40)))],
      [0.2, Math.max(1, Math.round(w / between(random, 4, 9)))],
    ].map(([a, cycles]) => [a, cycles, between(random, 0, TAU)]);
    ctx.strokeStyle = t === lit ? inks.accent : inks.line;
    ctx.beginPath();
    for (let x = 0; x <= w + 0.5; x += 0.5) {
      const y = parts.reduce((sum, [a, c, phi]) => sum + a * Math.sin((TAU * c * x) / w + phi), 0);
      ctx.lineTo(x, mid + (amp * y) / 1.65);
    }
    ctx.stroke();
  }
  if (!panel) return;
  const pitch = between(random, 2, 2.6);
  const heights = swells(random, Math.floor((w - 2) / pitch));
  const top = tallest(heights, 0.12);
  heights.forEach((height, i) => {
    const rise = 0.3 * h * (0.12 + 0.88 * height);
    ctx.fillStyle = height >= top ? inks.accent : inks.line;
    ctx.fillRect(1 + i * pitch + (pitch - bar) / 2, h - 1.5 - rise, bar, rise);
  });
}

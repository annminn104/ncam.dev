import type { FoilTier } from './tiers';

const cache = new Map<FoilTier, HTMLCanvasElement>();

function canvasOf(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the foil texture');
  return { canvas, ctx };
}

function sparkle(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(512, 512);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i += 1) {
    const value = Math.random();
    ctx.fillStyle = `rgba(255,255,255,${(value * value).toFixed(3)})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4);
  }
  return canvas;
}

function rainbow(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(512, 64);
  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  const stops = ['#ff2d55', '#ff9500', '#ffe83d', '#3ddc84', '#32ade6', '#7c5cff', '#ff2d55'];
  stops.forEach((color, index) => gradient.addColorStop(index / (stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 64);
  // Banding, so the sheen reads as foil rather than as a smooth gradient.
  ctx.globalCompositeOperation = 'multiply';
  for (let x = 0; x < 512; x += 6) {
    ctx.fillStyle = `rgba(0,0,0,${x % 12 === 0 ? 0.18 : 0})`;
    ctx.fillRect(x, 0, 3, 64);
  }
  return canvas;
}

function cosmos(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(1024, 1024);
  const base = ctx.createLinearGradient(0, 0, 1024, 1024);
  base.addColorStop(0, '#120a2e');
  base.addColorStop(0.5, '#3b1a6b');
  base.addColorStop(1, '#0a1e4a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 90 + 30;
    const nebula = ctx.createRadialGradient(x, y, 0, x, y, r);
    nebula.addColorStop(0, `rgba(160,120,255,${(Math.random() * 0.14).toFixed(3)})`);
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2400; i += 1) {
    const alpha = Math.random() ** 2;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.6, 1.6);
  }
  return canvas;
}

/** Cached per tier for the page's lifetime — every card shares one texture. */
export function makeFoilTexture(tier: FoilTier): HTMLCanvasElement {
  const hit = cache.get(tier);
  if (hit) return hit;
  const made = tier === 'cosmos' ? cosmos() : tier === 'rainbow' ? rainbow() : sparkle();
  cache.set(tier, made);
  return made;
}

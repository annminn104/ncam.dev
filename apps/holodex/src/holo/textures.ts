export type TextureName = 'glitter' | 'grain';

const cache = new Map<TextureName, HTMLCanvasElement>();

function canvasOf(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the holo texture');
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

function grain(): HTMLCanvasElement {
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

/** Generated once at runtime, shared by every effect that names them. */
export function makeTexture(name: TextureName): HTMLCanvasElement {
  const hit = cache.get(name);
  if (hit) return hit;
  const made = name === 'grain' ? grain() : sparkle();
  cache.set(name, made);
  return made;
}

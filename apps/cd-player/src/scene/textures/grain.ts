import { xorshift } from './xorshift';

/**
 * Tileable normal maps made at runtime instead of baked, so the art pipeline stays a single GLB:
 * a pebble grain for the leather, diamond quilting for the lid's lining, a plain weave for the
 * speaker cloth and the strap. Each is a height field, then normals by central differences that
 * wrap at the edges. RGBA bytes, `size`² pixels.
 */

/** Normals (RGBA bytes) of a `size`² height field that tiles, `strength` scaling its slopes. */
export function normalsFrom(height: Float32Array, size: number, strength: number): Uint8Array {
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * The leather's pebble grain: one random point per cell of a `cells`² grid, a dome around each
 * (Worley F1).
 */
export function leatherNormal(size = 256, cells = 22, seed = 7, strength = 2.5): Uint8Array {
  const random = xorshift(seed);
  const points = new Float32Array(cells * cells * 2);
  for (let i = 0; i < points.length; i++) points[i] = random();
  const height = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = ((px + 0.5) / size) * cells;
      const v = ((py + 0.5) / size) * cells;
      const cx = Math.floor(u);
      const cy = Math.floor(v);
      let best = 9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox;
          const gy = cy + oy;
          const k =
            ((((gy % cells) + cells) % cells) * cells + (((gx % cells) + cells) % cells)) * 2;
          const dx = gx + points[k] - u;
          const dy = gy + points[k + 1] - v;
          best = Math.min(best, dx * dx + dy * dy);
        }
      }
      height[py * size + px] = 1 - Math.min(1, Math.sqrt(best) / 0.75);
    }
  }
  return normalsFrom(height, size, strength);
}

/**
 * The lining's diamond quilting: pillows between seams at ±45°, `cells` diamonds across the tile
 * along each axis (two per tile, over the 5 cm box UVs, is a 25 mm diamond, as the Cycles render's
 * `add_quilt`). Rounded pillows, narrow valleys.
 */
export function quiltNormal(size = 256, cells = 2, strength = 3): Uint8Array {
  const height = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      const v = (py + 0.5) / size;
      const a = Math.sin(Math.PI * cells * (u + v));
      const b = Math.sin(Math.PI * cells * (u - v));
      height[py * size + px] = Math.pow(Math.abs(a * b), 0.7);
    }
  }
  return normalsFrom(height, size, strength);
}

/**
 * A plain weave: `threads` warp threads (along v) and weft threads (along u) across the tile,
 * each a rounded ridge, the warp over the weft in one cell and under it in the next.
 */
export function weaveNormal(size = 128, threads = 16, strength = 1.6): Uint8Array {
  const height = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = ((px + 0.5) / size) * threads;
      const v = ((py + 0.5) / size) * threads;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fu = u - i - 0.5;
      const fv = v - j - 0.5;
      const warp = Math.max(0, 1 - (2 * fu) ** 2);
      const weft = Math.max(0, 1 - (2 * fv) ** 2);
      const warpOnTop = (i + j) % 2 === 0;
      height[py * size + px] = warpOnTop ? Math.max(warp, weft * 0.8) : Math.max(weft, warp * 0.8);
    }
  }
  return normalsFrom(height, size, strength);
}

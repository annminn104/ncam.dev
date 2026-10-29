/**
 * A tileable pebble-grain normal map for the leather (and, scaled up, the speaker cloth): one
 * random point per cell of a `cells`² grid, a dome around each (Worley F1), then normals by central
 * differences, wrapping at the edges so it tiles. RGBA bytes, `size`² pixels. Made at runtime
 * instead of baked, so the art pipeline stays a single GLB.
 */
export function leatherNormal(size = 256, cells = 22, seed = 7, strength = 2.5): Uint8Array {
  let s = seed >>> 0 || 1;
  const random = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
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

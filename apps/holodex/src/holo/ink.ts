/** RGBA pixels, row by row from the top, as a canvas's getImageData() hands them. */
export interface Pixels {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/**
 * How findInk tells a card's printed ink, its title's black letters in their
 * white outline, from its art: luminances (0 to 255) and sizes in pixels of
 * a 600 px wide scan, TCGdex's high-res one, which findInk scales to the scan
 * it is handed. Tuned on the title strips of 151's 34 illustration rare,
 * Ultra Rare, special illustration rare and Hyper rare Pokémon (2026-09-26),
 * against the masks the reference draws them with, which leave the title's
 * letters out: the strips agree with those masks on 83.4% of their pixels
 * with the ink cut, 64.3% without, every card by 13 points or more. A plain
 * luminance cut takes a dark background along with the letters printed on
 * it, and on Charmander's and Psyduck's did worse than no cut at all.
 */
export const INK = {
  /** A pixel darker than this is ink's, or a dark background's. */
  dark: 80,
  /** One lighter than this is an outline's. */
  bright: 170,
  /** How far out from a blob's edge its outline may start, px. */
  reach: 3,
  /** The share of a blob's edge that must meet an outline for it to be a letter's. */
  outlined: 0.6,
  /** A letter's height, px, an i's dot's (5) up: a speck is smaller, a background bigger. */
  minHeight: 4,
  maxHeight: 45,
  /** The widest a run of letters that touch gets, px. */
  maxWidth: 150,
  /** How far the ink grows, px, to take its outline with it, as the masks do. */
  grow: 2,
} as const;

/**
 * Where a card's title strip carries printed ink: a mask the size of
 * `pixels`, 255 where inked. Each blob of dark pixels is a letter's if it is
 * a letter's size, stays off the strip's edges (a background runs off them),
 * and meets a white outline along most of its edge, which is what sets a
 * Pokémon's title apart from the dark art it is printed over; a trainer's
 * name, printed on a light panel, meets the panel instead. Kept blobs grow
 * by their outline. `scale` is the scan's width over 600.
 */
export function findInk(pixels: Pixels, scale = 1): Uint8Array {
  const { data, width: w, height: h } = pixels;
  const reach = Math.max(1, Math.round(INK.reach * scale));
  const grow = Math.max(1, Math.round(INK.grow * scale));
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    luma[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  }
  const dark = (i: number) => luma[i] < INK.dark;

  const label = new Int32Array(w * h).fill(-1);
  const kept = new Uint8Array(w * h);
  const stack: number[] = [];
  let blobs = 0;
  for (let start = 0; start < w * h; start++) {
    if (!dark(start) || label[start] >= 0) continue;
    const id = blobs++;
    const members: number[] = [];
    let [minX, maxX, minY, maxY] = [w, -1, h, -1];
    let edge = 0;
    let outlined = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % w;
      const y = (i - x) / w;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (dark(n)) {
            if (label[n] < 0) {
              label[n] = id;
              stack.push(n);
            }
          } else if (dx === 0 || dy === 0) {
            // an edge of the blob: is there an outline within reach, outward?
            edge++;
            for (let r = 1; r <= reach; r++) {
              const qx = x + dx * r;
              const qy = y + dy * r;
              if (qx < 0 || qy < 0 || qx >= w || qy >= h) break;
              const q = qy * w + qx;
              if (dark(q)) break;
              if (luma[q] > INK.bright) {
                outlined++;
                break;
              }
            }
          }
        }
      }
    }
    const offEdges = minX > 0 && minY > 0 && maxX < w - 1 && maxY < h - 1;
    const tall = maxY - minY + 1;
    const letter =
      offEdges &&
      tall >= INK.minHeight * scale &&
      tall <= INK.maxHeight * scale &&
      maxX - minX + 1 <= INK.maxWidth * scale &&
      edge > 0 &&
      outlined / edge >= INK.outlined;
    if (letter) for (const i of members) kept[i] = 1;
  }

  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!kept[y * w + x]) continue;
      for (let gy = Math.max(0, y - grow); gy <= Math.min(h - 1, y + grow); gy++) {
        for (let gx = Math.max(0, x - grow); gx <= Math.min(w - 1, x + grow); gx++) {
          ink[gy * w + gx] = 255;
        }
      }
    }
  }
  return ink;
}

// Tube houses above the shop + the neighbouring "Tạp hóa Ông Minh" grocery.
import { MT } from '../materials';
import { M4, pick, rnd } from '../math';
import { decalX, decalZ, Mat, tex, type Mesh } from '../mesh';
import type { Ctx } from './types';

function railing(M: Mesh, x0: number, x1: number, z: number, y0: number, y1: number, step = 0.14) {
  M.box(x0, y1 - 0.05, z - 0.03, x1, y1, z + 0.03, MT.iron);
  M.box(x0, y0 + 0.08, z - 0.02, x1, y0 + 0.12, z + 0.02, MT.iron);
  for (let x = x0 + 0.04; x < x1; x += step)
    M.box(x - 0.012, y0, z - 0.012, x + 0.012, y1, z + 0.012, MT.iron);
}
function railingZ(M: Mesh, z0: number, z1: number, x: number, y0: number, y1: number, step = 0.14) {
  M.box(x - 0.03, y1 - 0.05, z0, x + 0.03, y1, z1, MT.iron);
  for (let z = z0 + 0.04; z < z1; z += step)
    M.box(x - 0.012, y0, z - 0.012, x + 0.012, y1, z + 0.012, MT.iron);
}
function grille(M: Mesh, x0: number, x1: number, y0: number, y1: number, z: number, d = 0.3) {
  M.box(x0, y0, z, x1, y0 + 0.04, z + d, MT.iron);
  M.box(x0, y1 - 0.04, z, x1, y1, z + d, MT.iron);
  for (let x = x0; x <= x1 + 0.001; x += (x1 - x0) / 8)
    M.box(x - 0.012, y0, z + d - 0.025, x + 0.012, y1, z + d, MT.iron);
  M.box(x0, (y0 + y1) / 2 - 0.015, z + d - 0.03, x1, (y0 + y1) / 2 + 0.015, z + d, MT.iron);
}
function plant(M: Mesh, x: number, y: number, z: number, s = 1) {
  M.at(x, y, z, 0, () => {
    M.cyl(0.14 * s, 0.26 * s, 10, Mat('#8a4b2a', { r: 0.7, w: 1 }), { r2: 0.18 * s });
    for (let k = 0; k < 4; k++)
      M.sphere(
        (rnd() - 0.5) * 0.2 * s,
        0.38 * s + rnd() * 0.25 * s,
        (rnd() - 0.5) * 0.2 * s,
        0.16 * s,
        0.2 * s,
        0.16 * s,
        8,
        MT.leaf,
        0.3,
      );
  });
}
function acUnit(M: Mesh, x0: number, y0: number, z0: number, face: 'z' | 'x' = 'z') {
  if (face === 'z') {
    M.box(x0, y0, z0, x0 + 0.75, y0 + 0.55, z0 + 0.3, MT.white, { pz: 'ac' });
    M.box(x0 + 0.05, y0 - 0.06, z0 - 0.02, x0 + 0.08, y0, z0 + 0.3, MT.iron);
    M.box(x0 + 0.67, y0 - 0.06, z0 - 0.02, x0 + 0.7, y0, z0 + 0.3, MT.iron);
  } else M.box(x0, y0, z0 - 0.75, x0 + 0.3, y0 + 0.55, z0, MT.white, { px: 'ac' });
}
function laundry(M: Mesh, x0: number, x1: number, y: number, z: number) {
  M.rod([x0, y, z], [x1, y, z], 0.008, MT.alu);
  const cols = ['#e94f37', '#ffffff', '#2a7de1', '#f2b705', '#1fa35a', '#d93a8c'];
  for (let x = x0 + 0.1; x < x1 - 0.2; x += 0.28 + rnd() * 0.12) {
    const w = 0.2 + rnd() * 0.14,
      h = 0.35 + rnd() * 0.3;
    M.box(x, y - h, z - 0.01, x + w, y, z + 0.01, Mat(pick(cols), { r: 0.8, w: 1 }));
  }
}

export function buildHouses({ O, G, L }: Ctx): void {
  const windowZ = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z: number,
    t: string,
    e: number,
  ) => {
    decalZ(O, x0, x1, y0, y1, z + 0.005, tex(t, e, { r: 0.5 }));
    decalZ(G, x0, x1, y0, y1, z + 0.03, MT.glass);
    O.box(x0 - 0.06, y0 - 0.08, z, x1 + 0.06, y0, z + 0.12, MT.slab);
    O.box(x0 - 0.06, y1, z, x1 + 0.06, y1 + 0.06, z + 0.06, MT.wallA2);
  };
  const windowX = (
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    x: number,
    t: string,
    e: number,
  ) => {
    decalX(O, z0, z1, y0, y1, x + 0.005, tex(t, e, { r: 0.5 }));
    decalX(G, z0, z1, y0, y1, x + 0.03, MT.glass);
    O.box(x, y0 - 0.08, z1 - 0.06, x + 0.12, y0, z0 + 0.06, MT.slab);
  };

  // ---- House A (above Circle K) ----
  O.box(-5, 3.7, -7.5, 2.0, 10, 0.8, MT.wallA, { ny: false });
  O.box(-5.02, 6.72, -7.5, 2.08, 6.88, 0.9, MT.wallA2);
  O.box(-4.6, 3.7, 0.8, 1.4, 3.86, 1.95, MT.slab);
  railing(O, -4.6, 1.4, 1.92, 3.86, 4.8);
  railingZ(O, 0.8, 1.92, -4.6, 3.86, 4.8);
  railingZ(O, 0.8, 1.92, 1.4, 3.86, 4.8);
  decalZ(O, -3.6, -0.4, 3.9, 6.2, 0.805, tex('winA', 1.5, { r: 0.5 }));
  decalZ(G, -3.6, -0.4, 3.9, 6.2, 0.84, MT.glass);
  for (const x of [-3.6, -2, -0.4]) O.box(x - 0.04, 3.86, 0.8, x + 0.04, 6.24, 0.9, MT.alu);
  O.box(-3.64, 6.2, 0.8, -0.36, 6.26, 0.9, MT.alu);
  acUnit(O, 0.35, 3.86, 1.0);
  plant(O, -4.2, 3.86, 1.5);
  plant(O, -0.05, 3.86, 1.55, 0.8);
  plant(O, -1.3, 3.86, 1.6, 0.7);
  O.box(-4.6, 6.88, 0.8, 1.4, 7.0, 1.5, MT.slab);
  windowZ(-4.2, -2.6, 7.4, 9.1, 0.8, 'winC', 1.3);
  grille(O, -4.25, -2.55, 7.32, 9.16, 0.8);
  windowZ(-1.4, 0.2, 7.4, 9.1, 0.8, 'winA', 1.1);
  grille(O, -1.45, 0.25, 7.32, 9.16, 0.8);
  acUnit(O, 0.8, 7.25, 0.8);
  laundry(O, -4.3, -2.5, 7.2, 1.12);
  windowX(-0.8, -2.2, 4.4, 5.9, 2.0, 'winB', 0.9);
  for (let z = -0.85; z > -2.2; z -= 0.17)
    O.box(2.1, 4.36, z - 0.012, 2.13, 5.94, z + 0.012, MT.iron);
  windowX(-4.1, -5.5, 4.4, 5.9, 2.0, 'winA', 0.25);
  windowX(-2.2, -3.5, 7.4, 9.0, 2.0, 'winA', 1.0);
  windowX(-5.1, -6.4, 7.4, 9.0, 2.0, 'winB', 0.12);
  decalX(O, -5.6, -6.9, 7.55, 8.0, 2.006, tex('phong', 0, { r: 0.6, w: 1 }));
  acUnit(O, 2.0, 6.95, -3.7, 'x');
  // roof: parapet, stair hut, horizontal stainless water tank, antenna
  O.box(-5, 10, -7.5, 2.0, 10.15, 0.8, MT.slab);
  O.box(-5, 10.15, 0.68, 2.0, 10.75, 0.8, MT.wallA2);
  O.box(1.88, 10.15, -7.5, 2.0, 10.75, 0.8, MT.wallA2);
  O.box(-5, 10.15, -7.5, 2.0, 10.75, -7.38, MT.wallA2);
  O.box(-4.7, 10.15, -7.3, -3.0, 12.3, -5.4, MT.wallA);
  O.box(-4.8, 12.3, -7.4, -2.9, 12.4, -5.3, MT.slab);
  O.push(M4.mul(M4.trans(-1.2, 11.0, -3.6), M4.rotZ(Math.PI / 2))).push(M4.trans(0, -0.85, 0));
  O.cyl(0.55, 1.7, 28, MT.steel);
  O.pop().pop();
  for (const x of [-1.9, -0.5]) {
    O.box(x - 0.05, 10.15, -4.1, x + 0.05, 10.5, -3.1, MT.iron);
    O.box(x - 0.06, 10.45, -4.15, x + 0.06, 10.55, -3.05, MT.iron);
  }
  O.at(1.1, 10.15, -5.8, 0, () => O.cyl(0.025, 2.6, 6, MT.alu));
  for (let k = 0; k < 4; k++)
    O.rod(
      [1.1, 12.2 + k * 0.12, -6.3 + k * 0.05],
      [1.1, 12.2 + k * 0.12, -5.3 - k * 0.05],
      0.012,
      MT.alu,
    );

  // ---- House B: neighbour grocery ----
  O.box(-8, 0.14, -7.5, -5, 0.16, 1.0, MT.concrete, { ny: false });
  O.box(-8, 0.16, -7.5, -7.85, 3.2, 0.6, MT.wallB);
  O.box(-5.12, 0.16, -7.5, -5.0, 3.2, 0.6, MT.wallB);
  O.box(-8, 3.0, -7.5, -5, 3.2, 0.6, MT.ceil);
  O.box(-7.85, 0.16, -3.6, -5.12, 3.0, -3.4, MT.wood, { pz: false });
  decalZ(O, -7.85, -5.12, 0.16, 2.9, -3.399, tex('neighGoods', 0.45));
  decalX(O, -0.2, -3.3, 0.5, 2.4, -7.849, tex('neighGoods', 0.4));
  decalX(O, -3.3, -0.2, 0.5, 2.4, -5.121, tex('neighGoods', 0.4));
  O.box(-7.6, 0.16, -1.2, -6.5, 0.95, -0.5, MT.white);
  O.box(-7.62, 0.95, -1.22, -6.48, 1.0, -0.48, Mat('#bfe6ff', { r: 0.05, e: 0.6 }));
  for (let k = 0; k < 6; k++)
    O.box(
      -5.95 + (k % 2) * 0.42,
      0.16 + Math.floor(k / 2) * 0.3,
      0.05,
      -5.57 + (k % 2) * 0.42,
      0.44 + Math.floor(k / 2) * 0.3,
      0.45,
      Mat(k % 3 ? '#c8102e' : '#1f6fd1', { r: 0.5 }),
    );
  O.box(-7.85, 2.6, -3.4, -5.12, 2.65, 0.6, Mat('#ffd9a0', { e: 5 }));
  O.push(M4.mul(M4.trans(-6.45, 3.02, 0.48), M4.rotZ(Math.PI / 2))).push(M4.trans(0, -1.45, 0));
  O.cyl(0.16, 2.9, 14, MT.alu);
  O.pop().pop(); // rolled-up shutter
  O.box(-8, 3.2, 0.4, -5, 4.25, 0.62, MT.wallB2);
  O.box(-7.95, 3.25, 0.62, -5.05, 4.15, 0.8, Mat('#0b4ea2', { r: 0.4, w: 1 }), { pz: false });
  decalZ(O, -7.95, -5.05, 3.25, 4.15, 0.802, tex('taphoa', 1.9, { r: 0.3, w: 1 }));
  O.box(-8, 3.2, -7.5, -5, 13.2, 0.4, MT.wallB, { ny: false });
  for (const y of [6.5, 9.8]) O.box(-8.02, y - 0.08, -7.5, -4.98, y + 0.08, 0.5, MT.wallB2);
  for (const [y, t, e] of [
    [4.25, 'winC', 1.2],
    [6.58, 'winB', 0.7],
    [9.88, 'winA', 0.3],
  ] as const) {
    O.box(-7.9, y, 0.4, -5.1, y + 0.14, 1.3, MT.slab);
    railing(O, -7.9, -5.1, 1.27, y + 0.14, y + 1.1);
    decalZ(O, -7.4, -5.6, y + 0.3, y + 2.4, 0.405, tex(t, e, { r: 0.5 }));
    decalZ(G, -7.4, -5.6, y + 0.3, y + 2.4, 0.43, MT.glass);
  }
  O.box(-7.4, 4.62, 1.3, -5.6, 5.3, 1.42, Mat('#160a1c', { r: 0.4, w: 1 }), { pz: false });
  decalZ(O, -7.4, -5.6, 4.62, 5.3, 1.422, tex('karaoke', 3.2, { k: 7, w: 1 }));
  plant(O, -7.6, 6.72, 0.9);
  plant(O, -5.5, 6.72, 0.95, 0.8);
  laundry(O, -7.7, -5.6, 11.6, 0.8);
  plant(O, -6.0, 10.02, 0.9);
  O.box(-8, 13.2, -7.5, -5, 13.35, 0.4, MT.slab);
  O.box(-8, 13.35, 0.3, -5, 13.9, 0.4, MT.wallB2);
  O.at(-6.3, 13.35, -3, 0, () => O.cyl(0.5, 1.25, 24, MT.steel));
  O.push(M4.mul(M4.trans(-7.3, 13.6, -5.6), M4.rotX(-0.6)));
  O.box(-0.6, 0, -0.5, 0.6, 0.05, 0.5, Mat('#1a2a4a', { r: 0.15, m: 0.3, w: 1 }));
  O.pop(); // solar heater
  L(-6.5, 2.4, -1.0, 7, [1, 0.72, 0.42], 7);
  L(-6.5, 1.6, 1.6, 5, [1, 0.75, 0.5], 2.2);
  L(-6.5, 3.7, 1.4, 3.5, [0.3, 0.55, 1], 1.6);
  L(-6.5, 5.0, 1.9, 5, [1, 0.25, 0.7], 3.2, 1);
  L(-2.0, 5.0, 1.7, 4.5, [1, 0.8, 0.55], 1.5);
  L(-3.4, 8.2, 1.4, 4, [1, 0.62, 0.4], 1.1);
  L(-6.5, 5.4, 0.9, 3.5, [1, 0.6, 0.4], 1.0);
}

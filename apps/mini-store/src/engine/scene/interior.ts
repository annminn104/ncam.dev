// Interior: glass-door coolers, gondolas with 3D stock, black POS counter, orange menu wall, Froster, ice-cream chest.
import { PACK } from '../constants';
import { MT } from '../materials';
import { hex, M4, pick, rnd, seed, type Vec3 } from '../math';
import { decalX, decalZ, decalZn, labelUV, Mat, tex, type BoxFaces, type Mesh } from '../mesh';
import { human } from '../people';
import { SY, type Ctx } from './types';

/** one row of packaged goods on a shelf. axis 'x': row along x facing dir·z; axis 'z': row along z facing dir·x */
function stock(
  M: Mesh,
  a0: number,
  a1: number,
  y: number,
  front: number,
  dir: number,
  depth: number,
  hMax: number,
  axis: 'x' | 'z' = 'x',
  small = false,
): void {
  let a = a0 + 0.015;
  while (a < a1 - 0.04) {
    const w = (small ? 0.035 : 0.05) + rnd() * (small ? 0.04 : 0.08),
      h = hMax * (0.45 + rnd() * 0.5),
      d = depth * (0.55 + rnd() * 0.4),
      n = 1 + Math.floor(rnd() * 3);
    const c: Vec3 = hex(pick(PACK)).map((v) => v * 0.45 + 0.4),
      mt = Mat(c, { r: 0.35 }),
      lab = labelUV(Math.floor(rnd() * 8), Math.floor(rnd() * 8));
    for (let k = 0; k < n && a + w < a1; k++) {
      const f1 = front - dir * d,
        lo = Math.min(front, f1),
        hi = Math.max(front, f1);
      if (axis === 'x') {
        const f: BoxFaces = {
          ny: false,
          [dir > 0 ? 'nz' : 'pz']: false,
          [dir > 0 ? 'pz' : 'nz']: lab,
        };
        M.box(a, y, lo, a + w - 0.006, y + h, hi, mt, f);
      } else {
        const f: BoxFaces = {
          ny: false,
          [dir > 0 ? 'nx' : 'px']: false,
          [dir > 0 ? 'px' : 'nx']: lab,
        };
        M.box(lo, y, a, hi, y + h, a + w - 0.006, mt, f);
      }
      a += w;
    }
    a += 0.004 + rnd() * 0.012;
  }
}
function shelfEdge(
  M: Mesh,
  a0: number,
  a1: number,
  y: number,
  front: number,
  dir: number,
  axis: 'x' | 'z',
): void {
  const m = Mat('#f4f4f0', { r: 0.4 }),
    b0 = front - (dir > 0 ? 0.01 : -0.01) - 0.005,
    b1 = front + (dir > 0 ? 0.012 : -0.012);
  if (axis === 'x') M.box(a0, y - 0.035, b0, a1, y + 0.01, b1, m);
  else M.box(b0, y - 0.035, a0, b1, y + 0.01, a1, m);
}

export function buildInterior({ O, G, L }: Ctx): void {
  seed(41);
  // ---- ceiling: linear LED, AC cassette, room lights ----
  for (const x of [-4.0, -2.8, -1.6, -0.4, 0.8])
    O.box(x - 0.035, 2.915, -6.8, x + 0.035, 2.95, 0.55, MT.panel);
  O.box(-1.4, 2.9, -3.6, -0.6, 2.95, -2.8, MT.whiteIn);
  for (let k = 0; k < 4; k++)
    O.box(-1.32 + k * 0.2, 2.895, -3.5, -1.22 + k * 0.2, 2.9, -2.9, Mat('#9aa0a6', { r: 0.5 }));
  L(-3.4, 2.55, -1.2, 8, [1, 0.97, 0.94], 8);
  L(-1.2, 2.55, -1.2, 8, [1, 0.97, 0.94], 8);
  L(1.0, 2.55, -1.6, 8, [1, 0.97, 0.94], 8);
  L(-3.4, 2.55, -4.4, 8, [1, 0.97, 0.94], 7.5);
  L(-1.2, 2.55, -4.4, 8, [1, 0.97, 0.94], 7.5);
  L(1.0, 2.55, -5.6, 7, [1, 0.95, 0.9], 7);

  // ---- back-wall glass-door coolers ----
  const CX0 = -4.85,
    CX1 = -0.6,
    CZ = -6.72;
  O.box(CX0, SY, -7.4, CX1, 2.28, CZ, Mat('#2b2d31', { r: 0.4, m: 0.5 }), { pz: false });
  O.box(CX0, SY, -7.36, CX1, 2.24, -7.34, Mat('#ffffff', { e: 1.6 }));
  for (const y of [0.45, 0.8, 1.15, 1.5, 1.85]) {
    O.box(CX0, y - 0.015, -7.33, CX1, y, CZ - 0.04, Mat('#d8dde2', { r: 0.3, m: 0.6 }));
    for (let x = CX0 + 0.05; x < CX1 - 0.06; x += 0.075 + rnd() * 0.02) {
      const c = pick([
          '#e8402f',
          '#2a7de1',
          '#1fa35a',
          '#f2b705',
          '#ffffff',
          '#13a3b5',
          '#d93a8c',
          '#f07c1b',
        ]),
        hh = 0.2 + rnd() * 0.12;
      O.at(x, y, -6.95, 0, () => {
        O.cyl(0.032, hh, 8, Mat(c, { r: 0.15 }));
        O.push(M4.trans(0, hh, 0));
        O.cyl(0.014, 0.035, 6, Mat('#ddd', { r: 0.3 }), { r2: 0.012 });
        O.pop();
      });
      O.box(
        x - 0.03,
        y + hh * 0.35,
        -6.918,
        x + 0.03,
        y + hh * 0.6,
        -6.916,
        Mat('#ffffff', { r: 0.4 }),
      );
    }
  }
  const NDOOR = 6,
    DW = (CX1 - CX0) / NDOOR;
  for (let k = 0; k <= NDOOR; k++) {
    const x = CX0 + k * DW;
    O.box(x - 0.03, SY, CZ - 0.02, x + 0.03, 2.28, CZ + 0.03, Mat('#18191b', { r: 0.35, m: 0.6 }));
    if (k < NDOOR)
      O.box(x + 0.05, SY + 0.1, CZ - 0.06, x + 0.06, 2.18, CZ - 0.05, Mat('#ffffff', { e: 5 }));
  }
  for (let k = 0; k < NDOOR; k++) {
    const x = CX0 + k * DW;
    decalZ(G, x + 0.03, x + DW - 0.03, SY + 0.06, 2.22, CZ + 0.02, MT.glassIn);
    O.box(x + DW - 0.1, 0.9, CZ + 0.03, x + DW - 0.08, 1.6, CZ + 0.07, MT.alu);
  }
  O.box(CX0, SY, CZ - 0.02, CX1, SY + 0.06, CZ + 0.04, Mat('#18191b', { r: 0.4 }));
  O.box(CX0, 2.28, -7.0, CX1, 2.78, CZ + 0.02, MT.redIn, { pz: false });
  decalZ(O, CX0, CX1, 2.3, 2.76, CZ + 0.021, tex('beverage', 1.8));
  L(-2.7, 1.3, -6.3, 4.5, [0.85, 0.93, 1], 2.6);

  // ---- left wall shelving + TV ----
  O.box(-4.9, SY, -6.6, -4.86, 2.1, -0.45, MT.whiteIn);
  for (const y of [0.2, 0.6, 1.0, 1.4, 1.78]) {
    O.box(-4.86, y - 0.02, -6.6, -4.46, y, -0.45, MT.whiteIn);
    stock(O, -6.55, -0.5, y, -4.47, 1, 0.36, 0.32, 'z');
    shelfEdge(O, -6.6, -0.45, y, -4.46, 1, 'z');
  }
  O.box(-4.86, 2.1, -6.6, -4.5, 2.16, -0.45, MT.redIn);
  O.box(-4.86, 2.24, -3.05, -4.82, 2.78, -1.95, MT.blackGloss);
  decalX(O, -1.98, -3.02, 2.26, 2.76, -4.818, tex('tv', 2));

  // ---- gondolas with real stock ----
  for (const z of [-1.75, -3.15, -4.55]) {
    const x0 = -4.1,
      x1 = -1.3;
    O.box(x0, SY, z - 0.31, x1, SY + 0.1, z + 0.31, Mat('#6b6f74', { r: 0.5, m: 0.4 }));
    O.box(x0, SY, z - 0.02, x1, 1.52, z + 0.02, MT.whiteIn);
    for (const y of [0.27, 0.62, 0.97, 1.32])
      for (const s of [-1, 1]) {
        O.box(
          x0,
          y - 0.02,
          s > 0 ? z + 0.02 : z - 0.3,
          x1,
          y,
          s > 0 ? z + 0.3 : z - 0.02,
          MT.whiteIn,
        );
        stock(O, x0, x1, y, z + s * 0.29, s, 0.26, 0.3, 'x', y > 1.2);
        shelfEdge(O, x0, x1, y, z + s * 0.3, s, 'x');
      }
    stock(O, z - 0.28, z + 0.28, SY + 0.1, x1 + 0.26, 1, 0.24, 0.34, 'z');
    O.box(x1 - 0.02, 1.52, z - 0.31, x1 + 0.04, 1.84, z + 0.31, MT.redIn, { px: false });
    decalX(O, z + 0.31, z - 0.31, 1.54, 1.82, x1 + 0.041, tex('ckPanel', 1.4));
  }

  // ---- black POS counter + candy rack ----
  const blk = Mat('#121214', { r: 0.25 }),
    gran = Mat('#08080a', { r: 0.1 });
  O.box(-0.45, SY, -5.4, 1.85, 1.0, -4.85, blk);
  O.box(-0.5, 1.0, -5.45, 1.9, 1.05, -4.8, gran);
  decalZ(O, 0.95, 1.45, 0.3, 1.0, -4.848, tex('thanhtoan', 0.5, { r: 0.4 }));
  O.box(-0.42, SY, -4.85, 0.36, 1.08, -4.82, blk);
  for (let k = 0; k < 4; k++) {
    const y = 0.3 + k * 0.2;
    O.box(-0.42, y, -4.82, 0.36, y + 0.015, -4.56, Mat('#2a2b2e', { r: 0.4, m: 0.5 }));
    stock(O, -0.4, 0.34, y + 0.015, -4.57, 1, 0.22, 0.13, 'x', true);
  }
  O.box(-0.42, 1.05, -4.78, 0.0, 1.4, -4.7, Mat('#1e3a8a', { r: 0.3 }));
  stock(O, -0.4, -0.02, 1.05, -4.7, 1, 0.06, 0.3, 'x', true);
  O.rod([0.42, 1.05, -5.22], [0.42, 1.18, -5.22], 0.025, MT.alu, 6);
  O.box(0.22, 1.15, -5.27, 0.62, 1.42, -5.22, MT.blackGloss, { nz: false });
  decalZn(O, 0.22, 0.62, 1.15, 1.42, -5.271, tex('pos', 1.8));
  O.box(0.26, 1.08, -5.12, 0.56, 1.26, -5.1, MT.blackGloss, { pz: false });
  decalZ(O, 0.26, 0.56, 1.08, 1.26, -5.098, tex('pos', 1.4));
  O.box(0.8, 1.05, -5.15, 0.92, 1.1, -5.0, Mat('#202226', { r: 0.3 }));
  // hot-dog roller + warmer case
  O.box(1.1, 1.05, -5.36, 1.82, 1.1, -4.9, MT.alu);
  O.box(1.1, 1.48, -5.36, 1.82, 1.52, -4.9, MT.alu);
  for (const x of [1.12, 1.8]) O.box(x - 0.02, 1.1, -5.36, x + 0.02, 1.48, -5.32, MT.alu);
  decalZ(G, 1.12, 1.8, 1.1, 1.48, -4.9, MT.glassIn);
  decalX(G, -4.9, -5.36, 1.1, 1.48, 1.82, MT.glassIn);
  O.box(1.12, 1.1, -5.35, 1.8, 1.48, -5.33, tex('hotfood', 2.2, { r: 0.1 }));
  for (let k = 0; k < 7; k++) {
    O.push(M4.mul(M4.trans(1.18 + k * 0.09, 1.16, -5.3), M4.rotX(Math.PI / 2)));
    O.cyl(0.017, 0.34, 8, Mat('#c2541f', { r: 0.25, e: 0.4 }));
    O.pop();
  }
  O.box(1.18, 1.3, -5.3, 1.75, 1.31, -4.96, Mat('#cfd3d8', { r: 0.2, m: 1 }));
  for (let k = 0; k < 5; k++)
    O.sphere(
      1.25 + k * 0.11,
      1.36,
      -5.12,
      0.045,
      0.04,
      0.045,
      8,
      Mat('#f3d9a8', { r: 0.5, e: 0.3 }),
    );

  // ---- back counter, orange menu wall, coffee machine, bánh bao steamer ----
  decalZ(O, -0.5, 1.9, 0.95, 2.95, -7.39, Mat('#f2661c', { r: 0.35, e: 0.12 }));
  O.box(-0.45, SY, -7.4, 1.9, 0.95, -6.85, MT.whiteIn);
  O.box(-0.47, 0.95, -7.4, 1.92, 0.99, -6.83, Mat('#d9d9d6', { r: 0.3 }));
  O.box(-0.35, 0.99, -7.35, 0.12, 1.6, -6.95, Mat('#151517', { r: 0.25, m: 0.4 }));
  O.box(-0.3, 1.2, -6.951, 0.07, 1.45, -6.949, Mat('#cfd3d8', { r: 0.2, m: 1 }));
  O.box(-0.2, 1.04, -7.0, -0.08, 1.1, -6.9, MT.alu);
  for (let k = 0; k < 4; k++)
    O.at(0.25 + k * 0.09, 0.99, -7.2, 0, () =>
      O.cyl(0.04, 0.3 + rnd() * 0.12, 10, MT.whiteIn, { r2: 0.045 }),
    );
  O.box(0.7, 0.99, -7.35, 1.2, 1.3, -6.95, Mat('#e6e6e6', { r: 0.3, m: 0.3 }));
  O.box(0.73, 1.03, -6.951, 1.05, 1.26, -6.949, MT.blackGloss);
  O.box(1.35, 0.99, -7.3, 1.85, 1.42, -6.95, MT.alu);
  decalZ(G, 1.37, 1.83, 1.01, 1.4, -6.94, MT.glassIn);
  for (let k = 0; k < 6; k++)
    O.sphere(
      1.45 + (k % 3) * 0.15,
      1.08 + Math.floor(k / 3) * 0.15,
      -7.12,
      0.06,
      0.05,
      0.06,
      10,
      Mat('#faf6ee', { r: 0.6, e: 0.4 }),
    );
  O.box(-0.45, 1.62, -7.4, 1.9, 1.65, -7.15, MT.whiteIn);
  for (let k = 0; k < 10; k++)
    O.at(-0.35 + k * 0.22, 1.65, -7.28, 0, () =>
      O.cyl(0.04, 0.22, 8, Mat(k % 3 ? '#ffffff' : '#e4211b', { r: 0.4 })),
    );
  for (const [t, x] of [
    ['menuScr1', -0.42],
    ['menuScr2', 0.38],
    ['menuScr3', 1.18],
  ] as const) {
    O.box(x - 0.02, 2.06, -7.39, x + 0.72, 2.5, -7.34, MT.blackGloss);
    decalZ(O, x, x + 0.7, 2.08, 2.48, -7.338, tex(t, 2.3));
  }
  L(0.7, 2.1, -6.6, 4, [1, 0.6, 0.35], 1.6);

  // ---- Froster corner, ice-cream chest, baskets, wet-floor sign ----
  O.box(1.35, SY, -3.95, 1.88, 0.95, -2.65, MT.whiteIn);
  O.box(1.4, 0.95, -3.9, 1.86, 1.62, -3.25, Mat('#18181b', { r: 0.3, m: 0.3 }));
  decalX(O, -3.9, -3.25, 0.97, 1.6, 1.398, tex('froster', 1.8));
  for (const [z, c] of [
    [-3.75, '#e8346c'],
    [-3.42, '#2a7de1'],
  ] as const)
    O.at(1.63, 1.0, z, 0, () => O.cyl(0.12, 0.42, 14, Mat(c, { r: 0.08, e: 0.9 })));
  for (let k = 0; k < 3; k++)
    O.at(1.6, 0.95, -3.05 + k * 0.12, 0, () => O.cyl(0.04, 0.25, 10, MT.whiteIn, { r2: 0.045 }));
  O.box(0.35, SY, -1.25, 1.5, 0.8, -0.7, MT.whiteIn);
  O.box(0.33, 0.8, -1.27, 1.52, 0.84, -0.68, MT.alu);
  decalZ(G, 0.37, 1.48, 0.6, 0.84, -0.69, MT.glassIn);
  for (let k = 0; k < 18; k++)
    O.cbox(
      0.42 + (k % 6) * 0.18,
      0.72,
      -1.15 + Math.floor(k / 6) * 0.17,
      0.15,
      0.07,
      0.14,
      Mat(pick(PACK), { r: 0.4 }),
    );
  decalZ(O, 0.6, 1.25, 0.25, 0.75, -0.698, tex('pKem', 0.4));
  for (let k = 0; k < 5; k++)
    O.box(
      1.0 + k * 0.008,
      SY + k * 0.11,
      0.35,
      1.42 + k * 0.008,
      SY + k * 0.11 + 0.18,
      0.7,
      Mat('#d7261e', { r: 0.4 }),
    );
  O.quad(
    [0.5, SY, 0.25],
    [0.9, SY, 0.25],
    [0.9, 0.85, 0.12],
    [0.5, 0.85, 0.12],
    tex('wetfloor', 0.2),
  );
  O.quad(
    [0.9, SY, -0.02],
    [0.5, SY, -0.02],
    [0.5, 0.85, 0.12],
    [0.9, 0.85, 0.12],
    tex('wetfloor', 0.2),
  );

  // ---- window bar + stools ----
  O.box(-4.7, 1.0, 0.42, -1.75, 1.05, 0.9, MT.wood);
  O.box(-4.7, 0.15, 0.85, -1.75, 1.0, 0.9, MT.whiteIn);
  for (const x of [-4.2, -3.4, -2.6])
    O.at(x, SY, 0.15, 0, () => {
      O.cyl(0.03, 0.62, 8, MT.alu, { caps: false });
      O.push(M4.trans(0, 0.62, 0));
      O.cyl(0.17, 0.06, 16, MT.redIn);
      O.pop();
    });

  // ---- people inside ----
  human(O, 0.7, SY, -5.95, 0, { shirt: '#e4211b', pants: '#1c1c20', cap: 'ck', arms: 'counter' });
  human(O, 0.78, SY, -4.4, Math.PI, { shirt: '#3b6fb6', pants: '#222831', bag: '#2a2a2a' });
  human(O, -2.6, SY, -2.45, Math.PI, {
    shirt: '#e4211b',
    pants: '#1c1c20',
    cap: 'ck',
    arms: 'counter',
    female: true,
    hairStyle: 'bun',
  });
  human(O, -2.0, SY, -6.25, Math.PI, {
    shirt: '#f2c5d0',
    pants: '#e8e2d6',
    female: true,
    hairStyle: 'long',
  });
  human(O, -3.4, SY, 0.15, 0, { pose: 'sit', seat: 0.68, shirt: '#f4f1ea', pants: '#2a3550' });
  human(O, -2.6, SY, 0.15, 0, {
    pose: 'drink',
    seat: 0.68,
    shirt: '#ffd166',
    pants: '#3a3a40',
    female: true,
    hairStyle: 'long',
    cup: '#e8346c',
  });
  O.box(-3.62, 1.05, 0.5, -3.2, 1.07, 0.78, Mat('#1a1a1c', { r: 0.2 }));
  O.box(-3.62, 1.07, 0.76, -3.2, 1.33, 0.78, Mat('#9fd0ff', { e: 2.2 }));
  O.at(-2.85, 1.05, 0.6, 0, () => O.cyl(0.045, 0.16, 10, Mat('#c47a2c', { r: 0.2 })));
}

// Vehicles: Honda Air Blade-style scooter, VinFast e-scooter, Honda Wave underbone, VinFast VF e34 / VF5 taxis.
// All models use local +x = forward, ground at y = 0.
import { M4, type Vec3 } from './math';
import {
  carRing,
  decalX,
  decalZ,
  decalZn,
  Mat,
  ringX,
  tex,
  type Material,
  type Mesh,
} from './mesh';
import { human, type HumanOpts } from './people';

const V_DK = Mat('#1d1e20', { r: 0.45, w: 1 }),
  V_CHROME = Mat('#d6dade', { r: 0.08, m: 1, w: 1 }),
  V_TIRE = Mat('#0f0f10', { r: 0.82, w: 1 });
const V_SILVER = Mat('#b4b8bd', { r: 0.28, m: 0.65, w: 1 }),
  V_BLK = Mat('#101112', { r: 0.3, w: 1 });

interface WheelOpts {
  rim?: Material;
  face?: Material;
  spokes?: number;
  split?: boolean;
  disc?: boolean;
  caliper?: string;
}
/** wheel centred at (x, y, z), axle along z: rounded tyre shoulders, split-spoke alloy, optional disc + caliper */
export function wheel(
  M: Mesh,
  x: number,
  y: number,
  z: number,
  r: number,
  w: number,
  o: WheelOpts = {},
): void {
  const rim = o.rim || V_SILVER,
    face = o.face || V_DK,
    ns = o.spokes || 5;
  M.push(M4.mul(M4.trans(x, y, z - w / 2), M4.rotX(Math.PI / 2)));
  M.push(M4.trans(0, w * 0.12, 0));
  M.cyl(r, w * 0.76, 28, V_TIRE, { caps: false });
  M.pop();
  M.cyl(r * 0.95, w, 28, V_TIRE);
  for (const side of [w + 0.002, -0.002]) {
    M.push(M4.trans(0, side - 0.001, 0));
    M.cyl(r * 0.9, 0.002, 28, Mat('#1b1b1c', { r: 0.7 }), { caps: false });
    M.pop();
  }
  M.push(M4.trans(0, -0.003, 0));
  M.cyl(r * 0.66, w + 0.006, 24, face);
  M.pop();
  const rr = r * 0.64;
  for (const side of [w + 0.004, -0.004])
    for (let k = 0; k < ns; k++)
      for (const sp of o.split ? [-0.09, 0.09] : [0]) {
        M.push(M4.rotY((k / ns) * Math.PI * 2 + sp));
        M.box(r * 0.15, side - 0.005, -0.013, rr, side + 0.005, 0.013, rim);
        M.pop();
      }
  for (const side of [w + 0.006, -0.006]) {
    M.push(M4.trans(0, side - 0.003, 0));
    M.cyl(r * 0.645, 0.006, 28, rim, { caps: false });
    M.cyl(r * 0.17, 0.008, 12, rim);
    M.pop();
  }
  if (o.disc) {
    M.push(M4.trans(0, w + 0.014, 0));
    M.cyl(r * 0.48, 0.005, 24, Mat('#b9bec4', { r: 0.3, m: 1 }));
    M.pop();
    M.push(M4.rotY(-0.6));
    M.box(
      r * 0.32,
      w + 0.012,
      -0.035,
      r * 0.52,
      w + 0.042,
      0.035,
      Mat(o.caliper || '#c0201a', { r: 0.3 }),
    );
    M.pop();
  }
  M.pop();
}
export const carWheel = (M: Mesh, x: number, y: number, z: number) =>
  wheel(M, x, y, z, 0.345, 0.225, {
    spokes: 5,
    split: true,
    rim: Mat('#d4d7db', { r: 0.28, m: 0.65 }),
    face: Mat('#17181a', { r: 0.35, m: 0.5 }),
    disc: true,
    caliper: '#2a2c30',
  });
export const bikeWheelF = (M: Mesh, x: number, y: number, z: number, o: { rim?: Material } = {}) =>
  wheel(M, x, y, z, 0.26, 0.09, { disc: true, split: true, rim: o.rim || V_SILVER });
export const bikeWheelR = (
  M: Mesh,
  x: number,
  y: number,
  z: number,
  o: { rim?: Material; ev?: boolean } = {},
) => wheel(M, x, y, z, 0.26, 0.11, { split: !o.ev, spokes: o.ev ? 6 : 5, rim: o.rim || V_SILVER });
export const waveWheelF = (M: Mesh, x: number, y: number, z: number) =>
  wheel(M, x, y, z, 0.27, 0.08, { spokes: 6, disc: true });
export const waveWheelR = (M: Mesh, x: number, y: number, z: number) =>
  wheel(M, x, y, z, 0.27, 0.09, { spokes: 6 });

function sideDecal(
  M: Mesh,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  t: string,
  e = 0.05,
) {
  decalZ(M, x0, x1, y0, y1, z, tex(t, e, { r: 0.3, w: 1 }));
  decalZn(M, x0, x1, y0, y1, -z, tex(t, e, { r: 0.3, w: 1 }));
}
/** plate facing -x (rear) / +x (front) */
const plateQuad = (M: Mesh, x: number, y: number, t = 'plate', w = 0.12, h = 0.11) =>
  M.quad([x, y, -w], [x, y, w], [x, y + h, w], [x, y + h, -w], tex(t, 0.04, { r: 0.3, w: 1 }));
const plateQuadF = (M: Mesh, x: number, y: number, t: string, w: number, h: number) =>
  M.quad([x, y, w], [x, y, -w], [x, y + h, -w], [x, y + h, w], tex(t, 0.04, { r: 0.3, w: 1 }));
function mirrors(M: Mesh, x: number, y: number, w: number) {
  for (const s of [-1, 1]) {
    M.rod([x, y, w * s], [x - 0.04, y + 0.24, (w + 0.04) * s], 0.008, V_CHROME, 4);
    M.sphere(x - 0.05, y + 0.28, (w + 0.05) * s, 0.025, 0.045, 0.065, 10, V_BLK);
  }
}
function spring(M: Mesh, a: Vec3, b: Vec3, r: number, turns: number, mt: Material) {
  const N = turns * 8;
  let prev: Vec3 | null = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N,
      an = t * turns * Math.PI * 2,
      c = [
        a[0] + (b[0] - a[0]) * t + Math.cos(an) * r,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t + Math.sin(an) * r,
      ];
    if (prev) M.rod(prev, c, 0.007, mt, 4);
    prev = c;
  }
}

export interface ScooterOpts {
  col?: string;
  seat?: string;
  accent?: string;
  rimCol?: string;
  spring?: string;
  /** body-coloured "AIR BLADE 150" decal atlas name */
  ab?: string;
  decal?: string;
  plate?: string;
  ev?: boolean;
  lit?: boolean;
  noWheels?: boolean;
  kick?: boolean;
  helmet?: 1 | -1;
  hcol?: string;
}
/** Honda Air Blade 150-style sport scooter (ev → VinFast e-scooter: hub motor, no exhaust) */
export function scooter(M: Mesh, o: ScooterOpts = {}): void {
  const body = Mat(o.col || '#c8102e', { k: 12, r: 0.3, m: 0.25, w: 1 }),
    seat = Mat(o.seat || '#18181a', { r: 0.45, w: 1 });
  const acc = o.accent ? Mat(o.accent, { r: 0.2, m: 0.6, w: 1 }) : V_SILVER,
    lit = o.lit;
  if (!o.noWheels) {
    bikeWheelF(M, 0.62, 0.26, 0, { rim: o.rimCol ? Mat(o.rimCol, { r: 0.3, m: 0.6 }) : V_SILVER });
    bikeWheelR(M, -0.6, 0.26, 0, { ev: o.ev });
  }
  for (const s of [-1, 1]) {
    M.rod([0.555, 0.96, s * 0.065], [0.585, 0.6, s * 0.065], 0.03, V_BLK, 8);
    M.rod([0.585, 0.62, s * 0.065], [0.62, 0.26, s * 0.065], 0.021, V_CHROME, 8);
  }
  // front fender + shield (apron) with V-shaped LED headlamp and side indicators
  M.bprism(
    [
      [0.42, 0.53],
      [0.86, 0.5],
      [0.92, 0.57],
      [0.48, 0.645],
    ],
    0.15,
    0.03,
    body,
  );
  M.loft(
    [
      [0.25, 0.2, 0.34, 0.6],
      [0.34, 0.21, 0.34, 0.86],
      [0.46, 0.205, 0.36, 1.0],
      [0.56, 0.18, 0.5, 1.08],
      [0.64, 0.13, 0.72, 1.06],
      [0.68, 0.08, 0.86, 0.99],
    ].map((s) => ringX(s[0], s[1], s[2], s[3], { et: 4, eb: 5, wt: 0.8 }, 22)),
    body,
    { caps: true },
  );
  M.prism(
    [
      [0.3, 0.33],
      [0.47, 0.33],
      [0.53, 0.56],
      [0.34, 0.55],
    ],
    -0.214,
    0.214,
    V_BLK,
  );
  M.prism(
    [
      [0.5, 0.6],
      [0.58, 0.6],
      [0.655, 0.9],
      [0.6, 0.9],
    ],
    -0.2,
    0.2,
    acc,
  );
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? 0.02 : -0.13,
      z1 = s > 0 ? 0.13 : -0.02;
    M.prism(
      [
        [0.62, 0.88],
        [0.675, 0.91],
        [0.69, 0.985],
        [0.64, 0.965],
      ],
      z0,
      z1,
      Mat('#fffaf0', { e: lit ? 42 : 0.5, r: 0.05 }),
    );
    M.rod(
      [0.66, 0.875, s * 0.02],
      [0.63, 0.84, s * 0.16],
      0.008,
      Mat('#ffffff', { e: lit ? 14 : 0.4 }),
      4,
    );
    M.box(
      0.6,
      0.8,
      s * 0.165 - 0.03,
      0.645,
      0.835,
      s * 0.165 + 0.03,
      Mat('#ffae00', { e: 0.35, r: 0.2 }),
    );
  }
  M.prism(
    [
      [0.2, 0.4],
      [0.3, 0.42],
      [0.36, 0.96],
      [0.25, 0.92],
    ],
    -0.18,
    0.18,
    V_BLK,
  );
  M.box(-0.16, 0.3, -0.17, 0.3, 0.4, 0.17, V_BLK);
  for (let k = 0; k < 5; k++)
    M.box(-0.1 + k * 0.07, 0.4, -0.16, -0.07 + k * 0.07, 0.408, 0.16, V_SILVER);
  // rear body + seats as rounded lofts
  M.loft(
    [
      [-1.0, 0.07, 0.72, 0.8],
      [-0.96, 0.12, 0.63, 0.86],
      [-0.82, 0.175, 0.55, 0.9],
      [-0.5, 0.2, 0.47, 0.905],
      [-0.25, 0.192, 0.4, 0.885],
      [-0.1, 0.165, 0.38, 0.83],
      [0.04, 0.12, 0.42, 0.7],
    ].map((s) => ringX(s[0], s[1], s[2], s[3], { et: 3, eb: 3, wt: 0.82 }, 22)),
    body,
    { caps: true },
  );
  M.prism(
    [
      [-0.74, 0.42],
      [-0.12, 0.34],
      [-0.02, 0.42],
      [-0.66, 0.54],
    ],
    -0.196,
    0.196,
    V_BLK,
  );
  M.prism(
    [
      [-0.82, 0.64],
      [-0.22, 0.52],
      [-0.16, 0.58],
      [-0.78, 0.72],
    ],
    -0.204,
    0.204,
    acc,
  );
  if (o.ab) sideDecal(M, -0.74, -0.36, 0.73, 0.8, 0.198, o.ab, 0.08);
  M.box(-0.62, 0.18, 0.02, -0.1, 0.42, 0.17, Mat('#3a3d42', { r: 0.35, m: 0.6 }));
  M.box(-0.58, 0.22, 0.17, -0.2, 0.38, 0.176, V_SILVER);
  M.loft(
    [
      [-0.99, 0.09, 0.9, 0.97],
      [-0.92, 0.13, 0.89, 1.035],
      [-0.62, 0.15, 0.885, 1.03],
      [-0.52, 0.155, 0.88, 0.995],
      [-0.25, 0.16, 0.86, 0.99],
      [0.0, 0.15, 0.85, 0.95],
      [0.06, 0.11, 0.86, 0.92],
    ].map((s) => ringX(s[0], s[1], s[2], s[3], { et: 3, eb: 6, wt: 0.85 }, 20)),
    seat,
    { caps: true },
  );
  M.rod([-0.52, 1.0, -0.14], [-0.52, 1.0, 0.14], 0.004, Mat('#5a4a3a', { r: 0.6 }), 3);
  for (const s of [-1, 1])
    M.rod([-0.98, 0.99, s * 0.165], [-0.56, 0.96, s * 0.18], 0.014, V_SILVER, 6);
  M.rod([-0.98, 0.99, -0.165], [-0.98, 0.99, 0.165], 0.014, V_SILVER, 6);
  for (const s of [-1, 1])
    M.sphere(
      -0.985,
      0.765,
      s * 0.055,
      0.03,
      0.035,
      0.06,
      10,
      Mat('#ff1a0a', { e: lit ? 12 : 0.18, r: 0.1 }),
    );
  M.box(-1.0, 0.7, -0.11, -0.97, 0.72, 0.11, Mat('#ff1a0a', { e: lit ? 8 : 0.12 }));
  M.prism(
    [
      [-1.03, 0.45],
      [-0.93, 0.43],
      [-0.93, 0.66],
      [-1.06, 0.62],
    ],
    -0.09,
    0.09,
    V_BLK,
  );
  plateQuad(M, -1.062, 0.49, o.plate || 'plate', 0.11, 0.1);
  spring(
    M,
    [-0.62, 0.36, 0.135],
    [-0.86, 0.78, 0.135],
    0.028,
    7,
    Mat(o.ev ? '#c9cdd2' : o.spring || '#d01c1c', { r: 0.3, m: 0.5 }),
  );
  M.rod([-0.62, 0.36, 0.135], [-0.86, 0.78, 0.135], 0.012, V_CHROME, 5);
  if (o.ev) {
    M.push(M4.mul(M4.trans(-0.6, 0.26, 0.075), M4.rotX(Math.PI / 2)));
    M.cyl(0.14, 0.05, 18, Mat('#2f3236', { r: 0.3, m: 0.8 }));
    M.pop();
    M.box(-0.12, 0.3, -0.16, 0.28, 0.33, 0.16, Mat('#2f3236', { r: 0.4, m: 0.5 }));
  } else {
    M.rod([-0.05, 0.28, 0.15], [-0.48, 0.33, 0.2], 0.026, V_DK, 6);
    M.push(M4.mul(M4.trans(-0.42, 0.37, 0.21), M4.rotZ(Math.PI / 2)));
    M.cyl(0.068, 0.44, 16, V_CHROME);
    M.push(M4.trans(0, 0.44, 0));
    M.cyl(0.048, 0.03, 12, V_BLK);
    M.pop();
    M.pop();
    M.push(M4.mul(M4.trans(-0.5, 0.37, 0.215), M4.rotZ(Math.PI / 2)));
    M.cyl(0.074, 0.26, 16, Mat('#c3c7cc', { r: 0.18, m: 1 }), { caps: false });
    M.pop();
  }
  M.bprism(
    [
      [0.36, 1.05],
      [0.6, 1.0],
      [0.67, 1.12],
      [0.44, 1.21],
    ],
    0.38,
    0.04,
    V_BLK,
  );
  M.box(0.43, 1.175, -0.07, 0.5, 1.2, 0.07, Mat('#62c8ff', { e: lit ? 2 : 0.3 }));
  M.prism(
    [
      [0.5, 1.16],
      [0.62, 1.12],
      [0.6, 1.24],
      [0.52, 1.24],
    ],
    -0.12,
    0.12,
    Mat('#15171a', { r: 0.08, m: 0.2, w: 1 }),
  );
  M.rod([0.45, 1.16, -0.38], [0.45, 1.16, 0.38], 0.016, V_CHROME, 6);
  for (const s of [-1, 1]) {
    M.rod([0.45, 1.16, s * 0.3], [0.45, 1.16, s * 0.41], 0.023, V_DK, 8);
    M.rod([0.47, 1.17, s * 0.25], [0.56, 1.15, s * 0.38], 0.007, V_SILVER, 4);
  }
  mirrors(M, 0.43, 1.18, 0.3);
  if (o.decal) sideDecal(M, -0.78, -0.32, 0.6, 0.76, 0.206, o.decal);
  if (o.kick) M.rod([-0.15, 0.3, -0.12], [-0.28, 0.01, -0.3], 0.014, V_CHROME, 4);
  if (o.helmet)
    M.sphere(
      0.43,
      1.43,
      0.34 * o.helmet,
      0.13,
      0.12,
      0.14,
      14,
      Mat(o.hcol || '#f2c12e', { r: 0.2, w: 1 }),
    );
}

/** Honda Wave-style underbone */
export function wave(
  M: Mesh,
  o: { col?: string; plate?: string; lit?: boolean; noWheels?: boolean; decal?: string } = {},
): void {
  const body = Mat(o.col || '#1b1b1d', { k: 12, r: 0.3, m: 0.25, w: 1 }),
    seat = Mat('#141414', { r: 0.5, w: 1 }),
    eng = Mat('#5d6166', { r: 0.35, m: 0.7, w: 1 });
  if (!o.noWheels) {
    waveWheelF(M, 0.64, 0.27, 0);
    waveWheelR(M, -0.6, 0.27, 0);
  }
  M.bprism(
    [
      [0.28, 0.42],
      [0.42, 0.42],
      [0.52, 0.98],
      [0.42, 1.02],
      [0.3, 0.9],
    ],
    0.36,
    0.045,
    body,
  );
  M.rod([0.44, 0.95, 0], [0.06, 0.45, 0], 0.04, body, 8);
  M.rod([0.06, 0.45, 0], [-0.32, 0.66, 0], 0.04, body, 8);
  M.box(-0.18, 0.2, -0.13, 0.2, 0.47, 0.12, eng);
  for (let k = 0; k < 4; k++) M.box(0.18, 0.28 + k * 0.045, -0.1, 0.26, 0.3 + k * 0.045, 0.1, eng);
  M.box(-0.62, 0.24, -0.15, -0.1, 0.3, -0.12, V_BLK);
  M.bprism(
    [
      [-0.84, 0.62],
      [-0.22, 0.56],
      [-0.12, 0.68],
      [-0.18, 0.84],
      [-0.82, 0.88],
      [-0.92, 0.76],
    ],
    0.3,
    0.04,
    body,
  );
  M.prism(
    [
      [-0.7, 0.62],
      [-0.25, 0.58],
      [-0.2, 0.62],
      [-0.66, 0.67],
    ],
    -0.152,
    0.152,
    V_SILVER,
  );
  M.bprism(
    [
      [-0.9, 0.86],
      [-0.08, 0.83],
      [0.0, 0.91],
      [-0.3, 0.98],
      [-0.84, 0.97],
    ],
    0.3,
    0.04,
    seat,
  );
  M.box(-1.02, 0.88, -0.13, -0.72, 0.9, 0.13, V_CHROME);
  for (const s of [-1, 1]) {
    spring(M, [-0.62, 0.3, s * 0.13], [-0.86, 0.84, s * 0.13], 0.026, 7, V_CHROME);
    M.rod([-0.62, 0.3, s * 0.13], [-0.86, 0.84, s * 0.13], 0.012, V_CHROME, 5);
  }
  M.bprism(
    [
      [0.4, 0.52],
      [0.9, 0.5],
      [0.92, 0.56],
      [0.48, 0.62],
    ],
    0.14,
    0.03,
    V_CHROME,
  );
  M.bprism(
    [
      [0.38, 1.0],
      [0.62, 1.0],
      [0.66, 1.1],
      [0.42, 1.17],
    ],
    0.36,
    0.04,
    body,
  );
  M.box(0.62, 1.02, -0.1, 0.68, 1.1, 0.1, Mat('#fff7e8', { e: o.lit ? 42 : 0.5, r: 0.08 }));
  M.rod([0.46, 1.14, -0.37], [0.46, 1.14, 0.37], 0.016, V_CHROME, 6);
  for (const s of [-1, 1]) M.rod([0.46, 1.14, s * 0.3], [0.46, 1.14, s * 0.4], 0.022, V_DK, 8);
  mirrors(M, 0.44, 1.16, 0.3);
  for (const s of [-1, 1])
    M.rod([0.56, 0.98, s * 0.065], [0.64, 0.27, s * 0.065], 0.022, V_CHROME, 8);
  M.rod([-0.15, 0.27, 0.14], [-0.6, 0.34, 0.17], 0.026, V_DK, 6);
  M.push(M4.mul(M4.trans(-0.55, 0.35, 0.18), M4.rotZ(Math.PI / 2)));
  M.cyl(0.05, 0.4, 12, V_CHROME);
  M.pop();
  M.box(-0.95, 0.74, -0.11, -0.9, 0.82, 0.11, Mat('#ff1a0a', { e: o.lit ? 12 : 0.15, r: 0.1 }));
  plateQuad(M, -0.955, 0.5, o.plate || 'plate2');
  if (o.decal) sideDecal(M, -0.74, -0.3, 0.64, 0.8, 0.154, o.decal);
}

/** rider in bike-local space (faces +x) */
export function rider(M: Mesh, o: HumanOpts & { wave?: boolean }): void {
  M.at(-0.32, 0, 0, Math.PI / 2, () =>
    human(M, 0, 0, 0, 0, {
      pose: 'ride',
      seat: 0.9,
      foot: o.wave ? 0.3 : 0.41,
      gripY: 1.16,
      gripZ: 0.77,
      long: true,
      mask: '#3a4a5a',
      sneaker: true,
      ...o,
    }),
  );
}
export function pillion(M: Mesh, o: HumanOpts): void {
  M.at(-0.74, 0, 0, Math.PI / 2, () =>
    human(M, 0, 0, 0, 0, { pose: 'pillion', seat: 0.95, foot: 0.36, sneaker: true, ...o }),
  );
}

export const CAR_WHEELS: Vec3[] = [
  [1.31, 0.345, 0.775],
  [1.31, 0.345, -0.775],
  [-1.3, 0.345, 0.775],
  [-1.3, 0.345, -0.775],
];
export interface CarOpts {
  model?: 'e34' | 'vf5';
  col?: string;
  decal?: string;
  lit?: boolean;
  driver?: boolean;
  noWheels?: boolean;
}
/** VinFast VF e34 (model 'vf5' → shorter VF5 with a roof TAXI box) in Xanh SM livery. G receives the tinted cabin glass. */
export function vfCar(M: Mesh, G: Mesh, o: CarOpts = {}): void {
  const vf5 = o.model === 'vf5',
    SC = vf5 ? M4.scale(0.925, 0.98, 0.96) : M4.ident();
  M.push(SC);
  G.push(SC);
  const body = Mat(o.col || '#20c6d6', { k: 12, r: 0.3, m: 0.12, w: 1 }),
    clad = Mat('#121314', { r: 0.62, w: 1 }),
    trim = Mat('#0b0c0d', { r: 0.22, w: 1 }),
    lit = o.lit;
  // body: automotive sections along x, lower edge follows the wheel arches; black cladding is a slightly wider band underneath
  const SEC = [
    [-2.16, 0.8, 0.38, 1.0, 0.62],
    [-2.13, 0.86, 0.3, 1.06, 0.72],
    [-1.98, 0.89, 0.27, 1.08, 0.78],
    [-1.76, 0.9, 0.6, 1.09, 0.79],
    [-1.62, 0.9, 0.71, 1.09, 0.79],
    [-1.3, 0.9, 0.765, 1.085, 0.79],
    [-0.98, 0.9, 0.71, 1.08, 0.79],
    [-0.86, 0.9, 0.27, 1.075, 0.79],
    [-0.3, 0.9, 0.24, 1.06, 0.79],
    [0.4, 0.9, 0.24, 1.04, 0.79],
    [0.86, 0.9, 0.27, 1.02, 0.79],
    [0.9, 0.9, 0.71, 1.0, 0.79],
    [1.31, 0.895, 0.765, 0.96, 0.77],
    [1.62, 0.89, 0.71, 0.9, 0.74],
    [1.74, 0.885, 0.32, 0.88, 0.72],
    [1.98, 0.86, 0.3, 0.85, 0.66],
    [2.1, 0.8, 0.34, 0.8, 0.56],
    [2.16, 0.7, 0.42, 0.72, 0.4],
  ];
  const th = (s: number[]) => (s[2] > 0.5 ? 0.085 : 0.24);
  M.loft(
    SEC.map((s) => carRing(s[0], s[1], s[2] + th(s) - 0.03, s[3], s[4], 0.035, 0.45)),
    body,
    { caps: true },
  );
  M.loft(
    SEC.map((s) => ringX(s[0], s[1] + 0.013, s[2], s[2] + th(s), { et: 8, eb: 8, wt: 1 }, 24)),
    clad,
    { caps: true },
  );
  if (!o.noWheels) for (const w of CAR_WHEELS) carWheel(M, w[0], w[1], w[2]);
  for (const x of [1.31, -1.3]) M.box(x - 0.4, 0.32, -0.62, x + 0.4, 0.8, 0.62, clad);
  // greenhouse (tinted glass) with tumblehome, roof skin on top
  G.loft(
    [
      [-2.07, 0.7, 1.07, 1.34, 0.52],
      [-1.93, 0.74, 1.085, 1.48, 0.6],
      [-1.65, 0.77, 1.09, 1.53, 0.63],
      [-0.7, 0.785, 1.075, 1.56, 0.645],
      [0, 0.79, 1.05, 1.55, 0.64],
      [0.55, 0.79, 1.02, 1.28, 0.66],
      [0.98, 0.79, 1.0, 1.03, 0.75],
    ].map((s) => carRing(s[0], s[1], s[2], s[3], s[4], 0.04, 0.3)),
    Mat([0.3, 0.34, 0.36], { k: 1, r: 0.04, w: 1 }),
    { caps: true },
  );
  M.loft(
    [
      [-1.9, 0.6, 1.455, 1.5, 0.55],
      [-1.62, 0.635, 1.5, 1.548, 0.58],
      [-0.7, 0.65, 1.53, 1.578, 0.6],
      [-0.05, 0.645, 1.52, 1.568, 0.59],
      [0.1, 0.6, 1.49, 1.53, 0.55],
    ].map((s) => carRing(s[0], s[1], s[2], s[3], s[4], 0.045, 0.4)),
    body,
    { caps: true },
  );
  for (const s of [-1, 1]) {
    M.rod([0.99, 1.0, s * 0.79], [0.08, 1.53, s * 0.645], 0.036, trim, 6);
    M.rod([-0.34, 1.075, s * 0.786], [-0.34, 1.54, s * 0.648], 0.05, trim, 6);
    M.quad(
      [-1.93, 1.085, s * 0.748],
      [-1.64, 1.09, s * 0.776],
      [-1.6, 1.535, s * 0.636],
      [-1.9, 1.48, s * 0.603],
      body,
    );
    M.rod([-2.07, 1.07, s * 0.7], [-1.92, 1.48, s * 0.6], 0.035, body, 6);
    M.rod([0.98, 1.005, s * 0.795], [-1.95, 1.085, s * 0.748], 0.012, trim, 4);
    M.rod([0.08, 1.535, s * 0.646], [-1.62, 1.54, s * 0.636], 0.014, trim, 4);
    M.rod([-1.55, 1.62, s * 0.5], [-0.1, 1.61, s * 0.5], 0.02, V_BLK, 6);
    for (const x of [-1.5, -0.15]) M.rod([x, 1.565, s * 0.5], [x, 1.62, s * 0.5], 0.016, V_BLK, 4);
    M.rod([-0.86, 0.49, s * 0.915], [0.86, 0.49, s * 0.915], 0.008, V_CHROME, 4);
    for (const [x, y0, y1] of [
      [0.9, 0.5, 1.0],
      [-0.34, 0.48, 1.05],
      [-1.32, 0.5, 1.08],
    ])
      M.rod([x, y0, s * 0.903], [x, y1, s * 0.9], 0.004, trim, 3);
    for (const x of [0.32, -0.86])
      M.box(x - 0.09, 0.88, s * 0.898 - 0.012, x + 0.05, 0.905, s * 0.898 + 0.012, body);
    M.rod([0.86, 1.05, s * 0.82], [0.8, 1.08, s * 0.95], 0.022, trim, 5);
    M.sphere(0.78, 1.1, s * 0.99, 0.085, 0.06, 0.07, 14, trim);
    M.box(0.8, 1.075, s * 0.955, 0.86, 1.09, s * 1.035, Mat('#ffae00', { e: lit ? 3 : 0.35 }));
    // front: chrome V wing running from the badge out over the lamps, slim projector headlamps
    M.rod([2.155, 0.755, 0], [2.09, 0.79, s * 0.42], 0.013, V_CHROME, 6);
    M.rod([2.09, 0.79, s * 0.42], [1.98, 0.825, s * 0.78], 0.013, V_CHROME, 6);
    M.rod([1.98, 0.825, s * 0.78], [1.76, 0.875, s * 0.865], 0.011, V_CHROME, 6);
    M.rod(
      [2.15, 0.74, 0],
      [2.085, 0.775, s * 0.42],
      0.007,
      Mat('#ffffff', { e: lit ? 20 : 0.4 }),
      4,
    );
    M.rod(
      [2.085, 0.775, s * 0.42],
      [1.97, 0.81, s * 0.77],
      0.007,
      Mat('#ffffff', { e: lit ? 20 : 0.4 }),
      4,
    );
    M.sphere(
      2.035,
      0.69,
      s * 0.62,
      0.04,
      0.032,
      0.15,
      14,
      Mat('#fffaf0', { e: lit ? 30 : 0.6, r: 0.05 }),
    );
    M.sphere(2.0, 0.69, s * 0.62, 0.06, 0.05, 0.17, 14, trim);
    M.sphere(2.045, 0.69, s * 0.5, 0.022, 0.022, 0.022, 8, V_CHROME);
    M.sphere(2.08, 0.44, s * 0.68, 0.03, 0.04, 0.07, 10, trim);
    M.box(
      -2.135,
      0.92,
      s * 0.62 - 0.18,
      -2.09,
      0.99,
      s * 0.62 + 0.18,
      Mat('#ff1a0a', { e: lit ? 9 : 1.1, r: 0.1 }),
    );
    M.box(-2.14, 0.62, s * 0.76 - 0.05, -2.12, 0.66, s * 0.76 + 0.05, Mat('#a8160e', { e: 0.3 }));
  }
  M.rod(
    [-2.13, 0.955, -0.44],
    [-2.13, 0.955, 0.44],
    0.008,
    Mat('#ff1a0a', { e: lit ? 6 : 0.8 }),
    4,
  );
  M.rod([-2.0, 1.12, 0], [-1.95, 1.25, 0], 0.006, V_BLK, 3);
  decalX(M, 0.09, -0.09, 0.68, 0.8, 2.172, tex('vfBadge', 0.2, { r: 0.15, m: 0.9 }));
  decalX(M, -0.08, 0.08, 1.02, 1.12, -2.142, tex('vfBadge', 0.15, { r: 0.15, m: 0.9 }));
  M.box(2.08, 0.34, -0.58, 2.17, 0.6, 0.58, Mat('#0b0b0c', { r: 0.4 }));
  for (let j = 0; j < 3; j++)
    for (let k = 0; k < 10; k++)
      M.box(
        2.171,
        0.37 + j * 0.075,
        -0.53 + k * 0.107 + (j % 2) * 0.05,
        2.176,
        0.42 + j * 0.075,
        -0.49 + k * 0.107 + (j % 2) * 0.05,
        V_DK,
      );
  M.rod([2.16, 0.335, -0.6], [2.16, 0.335, 0.6], 0.011, V_CHROME, 4);
  plateQuadF(M, 2.182, 0.45, 'plateTaxi', 0.2, 0.11);
  plateQuad(M, -2.165, 0.58, 'plateTaxi', 0.2, 0.11);
  if (o.decal) {
    sideDecal(M, 0.06, 0.86, 0.55, 0.83, 0.906, o.decal, 0.06);
    sideDecal(M, -1.2, -0.62, 0.82, 0.92, 0.904, 'xsmHot', 0.06);
  }
  if (vf5) {
    M.box(-0.52, 1.62, -0.24, -0.08, 1.8, 0.24, Mat('#f2f4d0', { r: 0.3 }), {
      px: false,
      nx: false,
    });
    decalX(M, 0.24, -0.24, 1.63, 1.79, -0.079, tex('taxiSign', lit ? 2.4 : 1.6));
    decalX(M, -0.24, 0.24, 1.63, 1.79, -0.521, tex('taxiSign', lit ? 2.4 : 1.6));
  }
  // interior: seats, dashboard, steering wheel, driver
  const seatM = Mat('#2a2b2e', { r: 0.6 });
  for (const s of [-1, 1]) {
    M.box(-0.32, 0.55, s * 0.38 - 0.22, 0.18, 0.76, s * 0.38 + 0.22, seatM);
    M.box(-0.4, 0.76, s * 0.38 - 0.22, -0.28, 1.32, s * 0.38 + 0.22, seatM);
  }
  M.box(-1.45, 0.55, -0.62, -0.85, 0.76, 0.62, seatM);
  M.box(-1.55, 0.76, -0.62, -1.43, 1.28, 0.62, seatM);
  M.box(0.62, 0.86, -0.74, 0.98, 1.0, 0.74, Mat('#1b1c1f', { r: 0.5 }));
  M.box(0.55, 0.99, -0.15, 0.62, 1.13, 0.15, Mat('#9fe6ff', { e: 2.2 }));
  M.push(M4.mul(M4.trans(0.4, 1.04, -0.38), M4.rotZ(1.15)));
  M.cyl(0.17, 0.03, 18, V_DK, { caps: false });
  M.cyl(0.05, 0.035, 10, V_DK);
  M.pop();
  if (o.driver)
    M.at(-0.15, 0, -0.38, Math.PI / 2, () =>
      human(M, 0, 0, 0, 0, {
        pose: 'sit',
        seat: 0.6,
        shirt: '#14b8c8',
        long: true,
        arms: 'counter',
        skin: '#c68e65',
        collar: '#0e8a96',
      }),
    );
  M.pop();
  G.pop();
}

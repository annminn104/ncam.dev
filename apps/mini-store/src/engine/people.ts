// People: lofted torso, tapered capsule limbs, face details, hair / caps / helmets, several poses.
import { MT } from './materials';
import { M4, pick, type Vec3 } from './math';
import { Mat, ringY, tex, type Mesh } from './mesh';

const SKINS = ['#d9a47e', '#c68e65', '#b97f58', '#e3b48f'];

export type Pose = 'stand' | 'walk' | 'phone' | 'sit' | 'drink' | 'ride' | 'pillion';
export interface HumanOpts {
  pose?: Pose;
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  shoes?: string;
  female?: boolean;
  h?: number;
  long?: boolean;
  shorts?: boolean;
  sneaker?: boolean;
  collar?: string | false;
  stripe?: string;
  back?: string;
  bag?: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'pony';
  cap?: 'ck' | string;
  helmet?: string;
  visor?: string;
  mask?: string;
  /** seat height for sit / drink / ride poses */
  seat?: number;
  foot?: number;
  gripY?: number;
  gripZ?: number;
  stride?: number;
  arms?: 'counter';
  phone?: boolean;
  cup?: string;
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Build a person in M at (x, y, z) turned by ry. Local frame faces +z, feet at y = 0. */
export function human(
  M: Mesh,
  x: number,
  y: number,
  z: number,
  ry: number,
  o: HumanOpts = {},
): void {
  M.at(x, y, z, ry, () => {
    const sc = o.h || (o.female ? 0.95 : 1);
    M.push(M4.scale(sc, sc, sc));
    const sh = Mat(o.shirt || '#e8e8e8', { r: 0.78 }),
      pa = Mat(o.pants || '#2a2e36', { r: 0.82 }),
      sk = Mat(o.skin || pick(SKINS), { r: 0.5 });
    const hr = Mat(o.hair || '#15100c', { r: 0.42 }),
      so = Mat(o.shoes || '#1a1a1a', { r: 0.55 });
    const pose = o.pose || 'stand',
      fem = !!o.female,
      seated = pose === 'sit' || pose === 'drink',
      onBike = pose === 'ride' || pose === 'pillion';
    const ln = pose === 'ride' ? 0.08 : pose === 'pillion' ? 0.03 : 0;
    const hy = seated ? (o.seat || 0.45) + 0.1 : onBike ? (o.seat || 0.86) + 0.08 : 0.9;

    // legs
    for (const s of [-1, 1]) {
      const hip: Vec3 = [s * 0.09, hy, 0];
      let knee: Vec3, ank: Vec3;
      if (seated) {
        knee = [s * 0.11, hy - 0.01, 0.42];
        ank = [s * 0.11, 0.09, 0.46];
      } else if (pose === 'ride') {
        knee = [s * 0.17, hy + 0.03, 0.36];
        ank = [s * 0.16, (o.foot ?? 0.4) + 0.06, 0.32];
      } else if (pose === 'pillion') {
        knee = [s * 0.18, hy + 0.02, 0.3];
        ank = [s * 0.2, (o.foot ?? 0.36) + 0.05, 0.16];
      } else if (pose === 'walk') {
        const st = o.stride ?? 0.22;
        knee = [s * 0.1, 0.49, s * st * 0.55];
        ank = [s * 0.1, 0.09 + (s > 0 ? 0.04 : 0), s * st];
      } else {
        knee = [s * 0.1, 0.49, 0.02];
        ank = [s * 0.1, 0.09, 0];
      }
      M.capsule(hip, knee, fem ? 0.08 : 0.085, pa, 10, 0.062);
      M.capsule(knee, ank, 0.06, o.shorts ? sk : pa, 10, 0.04);
      M.sphere(ank[0], ank[1] - 0.04, ank[2] + 0.045, 0.048, 0.038, 0.115, 12, so);
      if (o.sneaker)
        M.box(
          ank[0] - 0.05,
          ank[1] - 0.08,
          ank[2] - 0.07,
          ank[0] + 0.05,
          ank[1] - 0.06,
          ank[2] + 0.16,
          Mat('#f2f2f0', { r: 0.6 }),
        );
    }

    // torso: pants loft + shirt loft through elliptical sections [height, rx, rz]
    const SEC = fem
      ? [
          [0, 0.172, 0.115],
          [0.07, 0.178, 0.12],
          [0.17, 0.135, 0.095],
          [0.27, 0.15, 0.11],
          [0.35, 0.165, 0.128],
          [0.43, 0.172, 0.105],
          [0.48, 0.148, 0.085],
          [0.52, 0.085, 0.065],
          [0.545, 0.05, 0.048],
        ]
      : [
          [0, 0.165, 0.112],
          [0.07, 0.172, 0.118],
          [0.16, 0.15, 0.102],
          [0.26, 0.16, 0.11],
          [0.36, 0.18, 0.12],
          [0.44, 0.192, 0.112],
          [0.49, 0.165, 0.09],
          [0.53, 0.09, 0.07],
          [0.555, 0.055, 0.05],
        ];
    const zAt = (h: number) => (ln * h) / 0.55;
    const ring = (sec: number[], k = 1) =>
      ringY(
        0,
        hy + sec[0],
        zAt(sec[0]) + (sec[0] > 0.25 && sec[0] < 0.45 ? 0.008 : 0),
        sec[1] * k,
        sec[2] * k,
        18,
      );
    M.loft([ring(SEC[0]), ring(SEC[1]), ring(SEC[2])], pa, { caps: true });
    M.loft(
      SEC.slice(2).map((s, i) => ring(s, i === 0 ? 1.04 : 1)),
      sh,
      { caps: true },
    );
    const nz = zAt(0.55);
    if (o.collar !== false)
      M.loft(
        [
          ringY(0, hy + 0.52, nz, 0.082, 0.07, 16),
          ringY(0, hy + 0.575, nz + 0.004, 0.068, 0.06, 16),
        ],
        Mat(o.collar || o.shirt || '#e8e8e8', { r: 0.75 }),
      );
    M.capsule([0, hy + 0.53, nz], [0, hy + 0.64, nz + 0.01], 0.046, sk, 10, 0.042);

    // head + face
    const HY = hy + 0.745,
      hz = ln * 1.2 + 0.012;
    M.sphere(0, HY, hz, 0.087, 0.108, 0.098, 16, sk);
    M.sphere(0, HY - 0.045, hz + 0.018, 0.072, 0.062, 0.078, 14, sk);
    M.sphere(0, HY - 0.012, hz + 0.094, 0.012, 0.022, 0.018, 8, sk);
    for (const s of [-1, 1]) {
      M.sphere(s * 0.086, HY - 0.005, hz - 0.008, 0.012, 0.026, 0.02, 8, sk);
      M.sphere(
        s * 0.03,
        HY + 0.008,
        hz + 0.083,
        0.011,
        0.009,
        0.006,
        8,
        Mat('#120c08', { r: 0.15 }),
      );
      M.box(s * 0.03 - 0.016, HY + 0.026, hz + 0.08, s * 0.03 + 0.016, HY + 0.032, hz + 0.09, hr);
    }
    M.box(
      -0.016,
      HY - 0.058,
      hz + 0.078,
      0.016,
      HY - 0.053,
      hz + 0.088,
      Mat('#8a3f35', { r: 0.5 }),
    );
    if (o.mask) M.sphere(0, HY - 0.043, hz + 0.05, 0.074, 0.05, 0.06, 12, Mat(o.mask, { r: 0.8 }));
    if (o.helmet) {
      const hm = Mat(o.helmet, { r: 0.16, w: 1 });
      M.sphere(0, HY + 0.03, hz - 0.005, 0.128, 0.124, 0.142, 18, hm);
      M.sphere(
        0,
        HY + 0.062,
        hz - 0.004,
        0.13,
        0.012,
        0.144,
        18,
        Mat(o.stripe || '#ffffff', { r: 0.3, w: 1 }),
      );
      M.sphere(
        0,
        HY + 0.06,
        hz + 0.11,
        0.108,
        0.016,
        0.078,
        14,
        Mat(o.visor || o.helmet, { r: 0.25, w: 1 }),
      );
      for (const s of [-1, 1])
        M.rod(
          [s * 0.09, HY - 0.02, hz + 0.02],
          [s * 0.04, HY - 0.1, hz + 0.04],
          0.006,
          MT.blackGloss,
          4,
        );
    } else {
      M.sphere(0, HY + 0.028, hz - 0.012, 0.092, 0.085, 0.103, 14, hr);
      M.sphere(0, HY + 0.066, hz + 0.05, 0.078, 0.028, 0.05, 12, hr);
      if (o.hairStyle === 'long') {
        M.sphere(0, HY - 0.07, hz - 0.055, 0.098, 0.15, 0.06, 12, hr);
        for (const s of [-1, 1]) M.sphere(s * 0.075, HY - 0.04, hz, 0.028, 0.1, 0.05, 8, hr);
      }
      if (o.hairStyle === 'bun') M.sphere(0, HY + 0.07, hz - 0.09, 0.045, 0.045, 0.045, 10, hr);
      if (o.hairStyle === 'pony')
        M.capsule([0, HY + 0.03, hz - 0.1], [0, HY - 0.12, hz - 0.14], 0.035, hr, 8, 0.02);
      if (o.cap) {
        const cr = Mat(o.cap === 'ck' ? '#f4f4f4' : o.cap, { r: 0.65 }),
          cb = Mat('#e4211b', { r: 0.55 });
        M.sphere(0, HY + 0.05, hz - 0.008, 0.098, 0.066, 0.106, 14, cr);
        M.sphere(0, HY + 0.056, hz + 0.042, 0.085, 0.054, 0.068, 12, cb);
        M.sphere(0, HY + 0.03, hz + 0.11, 0.086, 0.012, 0.076, 12, cb);
      }
    }

    // arms
    for (const s of [-1, 1]) {
      const S: Vec3 = [s * (fem ? 0.165 : 0.185), hy + 0.465, zAt(0.46)];
      let E: Vec3, W: Vec3;
      if (onBike && o.phone && s > 0) {
        E = [0.22, hy + 0.2, 0.16];
        W = [0.07, hy + 0.33, 0.3];
      } else if (pose === 'ride') {
        E = [s * 0.25, hy + 0.3, 0.36];
        W = [s * 0.3, o.gripY || 1.1, o.gripZ || 0.78];
      } else if (pose === 'pillion') {
        E = [s * 0.23, hy + 0.2, 0.12];
        W = [s * 0.17, hy + 0.08, 0.32];
      } else if (pose === 'sit') {
        E = [s * 0.23, hy + 0.2, 0.12];
        W = [s * 0.15, hy + 0.3, 0.34];
      } else if (pose === 'drink' && s < 0) {
        E = [-0.22, hy + 0.25, 0.16];
        W = [-0.08, hy + 0.58, 0.15];
      } else if (pose === 'drink') {
        E = [0.23, hy + 0.2, 0.12];
        W = [0.15, hy + 0.3, 0.34];
      } else if (pose === 'phone' && s > 0) {
        E = [0.2, hy + 0.22, 0.12];
        W = [0.08, hy + 0.37, 0.24];
      } else if (pose === 'walk') {
        const sw = -s * (o.stride ?? 0.22) * 0.8;
        E = [s * 0.23, hy + 0.21, sw * 0.5];
        W = [s * 0.25, hy - 0.02, sw];
      } else if (o.arms === 'counter') {
        E = [s * 0.24, hy + 0.2, 0.1];
        W = [s * 0.18, hy + 0.12, 0.33];
      } else {
        E = [s * 0.235, hy + 0.2, 0.02];
        W = [s * 0.25, hy - 0.03, 0.06];
      }
      if (o.long) M.capsule(S, E, 0.05, sh, 10, 0.043);
      else {
        const mid = lerp3(S, E, 0.45);
        M.capsule(S, mid, 0.056, sh, 10, 0.052);
        M.capsule(mid, E, 0.042, sk, 10, 0.039);
      }
      M.capsule(E, W, 0.04, o.long ? sh : sk, 10, 0.032);
      const d = [W[0] - E[0], W[1] - E[1], W[2] - E[2]],
        dl = Math.hypot(d[0], d[1], d[2]) || 1;
      M.capsule(
        W,
        [W[0] + (d[0] / dl) * 0.065, W[1] + (d[1] / dl) * 0.065, W[2] + (d[2] / dl) * 0.065],
        0.03,
        sk,
        8,
        0.025,
      );
      if (o.stripe && o.long) {
        const off = [s * 0.046, 0.012],
          st = Mat(o.stripe, { r: 0.5 });
        M.rod(
          [S[0] + off[0], S[1] + off[1], S[2]],
          [E[0] + off[0] * 0.9, E[1] + off[1], E[2]],
          0.008,
          st,
          4,
        );
        M.rod(
          [E[0] + off[0] * 0.85, E[1] + off[1], E[2]],
          [W[0] + off[0] * 0.75, W[1] + off[1], W[2]],
          0.007,
          st,
          4,
        );
      }
      if ((pose === 'phone' || o.phone) && s > 0)
        M.box(
          W[0] - 0.035,
          W[1] + 0.02,
          W[2] - 0.01,
          W[0] + 0.035,
          W[1] + 0.15,
          W[2] + 0.005,
          Mat('#12161c', { r: 0.12 }),
        );
      if (pose === 'drink' && s < 0)
        M.at(W[0], W[1] - 0.05, W[2] + 0.03, 0, () =>
          M.cyl(0.035, 0.13, 10, Mat(o.cup || '#c47a2c', { r: 0.2 })),
        );
    }
    if (o.back) {
      const bz = zAt(0.33) - 0.125;
      M.quad(
        [0.1, hy + 0.23, bz],
        [-0.1, hy + 0.23, bz],
        [-0.1, hy + 0.42, bz],
        [0.1, hy + 0.42, bz],
        tex(o.back, 0.05, { r: 0.6 }),
      );
    }
    if (o.bag) {
      const bm = Mat(o.bag, { r: 0.6, w: 1 }),
        bz = zAt(0.3) - 0.19;
      M.sphere(0, hy + 0.3, bz, 0.15, 0.2, 0.075, 14, bm);
      for (const s of [-1, 1])
        M.rod(
          [s * 0.1, hy + 0.48, zAt(0.47) - 0.06],
          [s * 0.11, hy + 0.16, zAt(0.2) - 0.11],
          0.012,
          bm,
          4,
        );
    }
    M.pop();
  });
}

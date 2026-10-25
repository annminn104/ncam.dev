// Street: concrete poles, the famous tangled wires, lamps, traffic light, tree, parked rides, Grab / Xanh SM drivers.
import { GRAB, XSM } from '../constants';
import { MT } from '../materials';
import { M4, rnd, seed, type Mat4, type Vec3 } from '../math';
import { decalX, decalZ, Mat, Mesh, tex } from '../mesh';
import { human, type HumanOpts } from '../people';
import {
  bikeWheelF,
  bikeWheelR,
  carWheel,
  pillion,
  rider,
  scooter,
  vfCar,
  wave,
  waveWheelF,
  waveWheelR,
} from '../vehicles';
import type { Ctx } from './types';

const GRAB_RIDER: HumanOpts = {
  shirt: GRAB,
  long: true,
  stripe: '#ffffff',
  helmet: GRAB,
  visor: '#f4f4f2',
  back: 'grabBack',
  pants: '#1e2026',
  mask: '#1a1a1c',
  collar: '#0b8a3c',
};

export function buildStreet({ S, O, G, L, SPOT }: Ctx): void {
  const both = (m: Mat4, fn: () => void) => {
    O.push(m);
    G.push(m);
    fn();
    O.pop();
    G.pop();
  };

  // ---- poles, street lamps, traffic light, street signs ----
  const pole = (x: number, z: number, h: number) =>
    O.at(x, 0.14, z, 0, () => O.cyl(0.17, h, 8, MT.concrete, { r2: 0.1 }));
  pole(4.3, 3.3, 9.4);
  pole(-7.6, 3.3, 9.0);
  pole(4.3, -6.5, 9.2);
  O.box(4.22, 8.55, 2.3, 4.38, 8.65, 4.3, MT.iron);
  O.box(3.3, 8.1, 3.22, 5.3, 8.2, 3.38, MT.iron);
  O.box(-7.68, 8.25, 2.4, -7.52, 8.35, 4.2, MT.iron);
  O.box(4.22, 8.4, -7.4, 4.38, 8.5, -5.6, MT.iron);
  for (const z of [2.5, 3.0, 3.6, 4.1]) O.at(4.3, 8.65, z, 0, () => O.cyl(0.04, 0.12, 6, MT.white));
  O.at(4.62, 6.0, 3.3, 0, () => O.cyl(0.28, 0.9, 14, Mat('#6f7a70', { r: 0.5, m: 0.5, w: 1 })));
  O.box(4.38, 6.3, 3.25, 4.5, 6.4, 3.35, MT.iron); // transformer
  for (let k = 0; k < 3; k++) {
    // cable coils
    let prev: Vec3 | null = null;
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 7) {
      const p = [
        4.3 + 0.08 * k + Math.cos(a) * (0.3 + k * 0.04),
        5.0 + Math.sin(a) * (0.3 + k * 0.04) - k * 0.1,
        3.5 + 0.04 * k + Math.sin(a * 2) * 0.03,
      ];
      if (prev) O.rod(prev, p, 0.014, MT.rubber, 3);
      prev = p;
    }
  }
  const lamp = (px: number, pz: number, hx: number, hz: number, y: number, col: string) => {
    O.rod([px, y - 0.3, pz], [(px + hx) / 2, y + 0.15, (pz + hz) / 2], 0.045, MT.alu, 6);
    O.rod([(px + hx) / 2, y + 0.15, (pz + hz) / 2], [hx, y, hz], 0.045, MT.alu, 6);
    O.cbox(hx, y - 0.04, hz, 0.55, 0.12, 0.28, MT.dark);
    O.box(hx - 0.24, y - 0.115, hz - 0.11, hx + 0.24, y - 0.1, hz + 0.11, Mat(col, { e: 42 }));
  };
  lamp(4.3, 3.3, 5.4, 4.4, 7.7, '#ffb25e');
  lamp(-7.6, 3.3, -7.6, 4.75, 7.5, '#ffb25e');
  lamp(4.3, -6.5, 5.5, -6.5, 7.6, '#dfe9ff');
  SPOT([5.4, 7.48, 4.4], [-0.12, -1, -0.1], 45, 80, 16, [1, 0.56, 0.22], 30);
  SPOT([-7.6, 7.28, 4.75], [0.12, -1, -0.12], 45, 80, 15, [1, 0.56, 0.22], 27);
  SPOT([5.5, 7.38, -6.5], [-0.12, -1, 0.05], 45, 80, 14, [0.8, 0.88, 1], 22);
  L(4.6, 7.2, 3.4, 11, [1, 0.6, 0.3], 6);
  L(-6.8, 7.0, 3.8, 11, [1, 0.6, 0.3], 5.5);
  L(4.7, 7.1, -5.8, 10, [0.8, 0.88, 1], 4.5);
  O.box(4.3, 3.62, 3.25, 4.85, 3.7, 3.35, MT.iron);
  O.cbox(4.95, 3.35, 3.3, 0.3, 0.95, 0.3, Mat('#1a1a1a', { r: 0.4, w: 1 }));
  O.sphere(5.1, 3.68, 3.3, 0.03, 0.1, 0.1, 10, Mat('#ff2a10', { e: 30 }));
  O.sphere(5.1, 3.38, 3.3, 0.03, 0.1, 0.1, 10, Mat('#ffae00', { e: 0.3 }));
  O.sphere(5.1, 3.08, 3.3, 0.03, 0.1, 0.1, 10, Mat('#20ff70', { e: 0.3 }));
  for (const y of [3.68, 3.38, 3.08]) O.box(5.1, y + 0.1, 3.18, 5.2, y + 0.12, 3.42, MT.iron);
  L(5.4, 3.6, 3.3, 4.5, [1, 0.1, 0.04], 2.2);
  O.box(3.8, 2.55, 3.47, 4.8, 2.82, 3.49, MT.alu);
  decalZ(O, 3.8, 4.8, 2.55, 2.82, 3.495, tex('sign1', 0.08, { r: 0.3, w: 1 }));
  O.box(4.47, 2.88, 2.8, 4.49, 3.15, 3.8, MT.alu);
  decalX(O, 3.8, 2.8, 2.88, 3.15, 4.495, tex('sign2', 0.08, { r: 0.3, w: 1 }));

  // ---- wires: the Saigon spaghetti ----
  const WIRE = Mat('#0b0b0c', { r: 0.4, w: 1 });
  seed(23);
  const bundle = (a: Vec3, b: Vec3, n: number, sag: number, spread = 0.3) => {
    for (let k = 0; k < n; k++) {
      const j = () => (rnd() - 0.5) * spread;
      O.cable(
        [a[0] + j(), a[1] + j(), a[2] + j()],
        [b[0] + j(), b[1] + j(), b[2] + j()],
        sag * (0.75 + rnd() * 0.6),
        0.011 + rnd() * 0.008,
        WIRE,
      );
    }
  };
  bundle([4.3, 8.5, 3.3], [-7.6, 8.3, 3.3], 8, 0.8, 0.5);
  bundle([4.3, 8.3, 3.3], [4.3, 8.4, -6.5], 6, 0.7, 0.4);
  bundle([4.3, 8.3, -6.5], [4.3, 8.0, -8.4], 5, 0.2, 0.4);
  bundle([-7.6, 8.2, 3.3], [-8.4, 8.0, 3.0], 6, 0.1, 0.5);
  bundle([4.3, 8.4, 3.3], [8.4, 8.1, 3.5], 5, 0.5, 0.4);
  bundle([4.3, 8.4, 3.3], [4.5, 8.2, 8.4], 4, 0.6, 0.4);
  bundle([4.3, 7.9, 3.3], [2.05, 6.1, 0.5], 3, 0.35, 0.15);
  bundle([4.3, 7.7, -6.5], [2.05, 5.6, -6.2], 2, 0.3, 0.1);
  bundle([-7.6, 7.8, 3.3], [-6.0, 6.2, 1.3], 2, 0.3, 0.1);
  for (let k = 0; k < 4; k++) {
    const a = [4.3 + (rnd() - 0.5) * 0.2, 6.8 - k * 0.3, 3.3 + (rnd() - 0.5) * 0.2];
    O.cable(
      a,
      [a[0] + (rnd() - 0.5) * 0.6, a[1] - 0.4 - rnd() * 0.8, a[2] + 0.3],
      0.15,
      0.01,
      WIRE,
      6,
    );
  }

  // ---- tree ----
  O.box(-7.75, 0.14, 2.65, -6.95, 0.22, 3.45, MT.curb);
  O.at(-7.35, 0.14, 3.05, 0, () => O.cyl(0.13, 3.7, 10, MT.trunk, { r2: 0.08 }));
  O.rod([-7.35, 2.8, 3.05], [-6.8, 3.6, 2.7], 0.05, MT.trunk, 5);
  O.rod([-7.35, 3.1, 3.05], [-7.8, 3.9, 3.4], 0.05, MT.trunk, 5);
  seed(5);
  for (const [x, y, z, r] of [
    [-7.3, 4.3, 3.0, 1.15],
    [-6.7, 4.0, 2.6, 0.85],
    [-7.7, 4.7, 3.4, 0.9],
    [-7.0, 5.1, 3.2, 0.85],
    [-6.6, 4.7, 3.4, 0.75],
    [-7.6, 4.0, 2.5, 0.75],
  ])
    O.sphere(x, y, z, r, r * 0.8, r, 16, MT.leaf, 0.25);

  // ---- parked scooters in front of the glass (door kept clear) ----
  seed(31);
  O.at(-3.05, 0.14, 2.55, Math.PI / 2 + 0.1, () =>
    scooter(O, { col: '#c8102e', kick: true, accent: '#b9bdc2', ab: 'abRed' }),
  );
  O.at(-2.3, 0.14, 2.6, Math.PI / 2 - 0.08, () => wave(O, { col: '#1f4fb8' }));
  O.at(0.9, 0.14, 2.5, Math.PI / 2, () =>
    scooter(O, { col: '#f2f2f2', helmet: 1, hcol: '#e94f37', plate: 'plate2', ab: 'abWhite' }),
  );
  O.at(1.65, 0.14, 2.55, Math.PI / 2 + 0.12, () =>
    scooter(O, { col: '#1b1b1d', seat: '#5a3a22', ab: 'abBlack' }),
  );
  O.at(3.35, 0.14, -3.3, Math.PI - 0.08, () => scooter(O, { col: '#2a5bd7' }));
  O.at(3.4, 0.14, -4.15, Math.PI + 0.1, () => wave(O, { col: '#9aa0a6', plate: 'plate' }));
  // Grab driver waiting at the side-street curb, checking the app
  O.at(4.05, 0.14, -1.7, Math.PI / 2, () => {
    scooter(O, {
      col: '#3a3d42',
      accent: '#b8874a',
      rimCol: '#2a2c30',
      ab: 'abGray',
      seat: '#4a3020',
      spring: '#2a2c30',
    });
    rider(O, { ...GRAB_RIDER, phone: true });
  });
  // parked Xanh SM VinFast VF5 on the side street, driver inside
  both(M4.mul(M4.trans(5.65, 0, -4.1), M4.rotY(Math.PI / 2)), () =>
    vfCar(O, G, { model: 'vf5', decal: 'xsmDoor', driver: true }),
  );

  // ---- red umbrella + red shell chairs outside the window ----
  const RED = Mat('#d7261e', { r: 0.3, w: 1 });
  O.at(-4.15, 0.14, 2.15, 0, () => {
    O.cyl(0.25, 0.06, 16, MT.dark);
    O.cyl(0.025, 2.35, 8, MT.alu);
    O.push(M4.trans(0, 2.0, 0));
    O.cyl(1.25, 0.45, 16, RED, { r2: 0.04, caps: false });
    O.pop();
    O.push(M4.trans(0, 1.985, 0));
    O.cyl(1.26, 0.04, 16, Mat('#ffffff', { r: 0.4, w: 1 }), { caps: false });
    O.pop();
    O.push(M4.trans(0, 0.72, 0));
    O.cyl(0.38, 0.035, 20, MT.wood);
    O.pop();
  });
  const shellChair = (x: number, z: number, ry: number) =>
    O.at(x, 0.14, z, ry, () => {
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        O.rod([a * 0.2, 0, b * 0.2], [a * 0.17, 0.44, b * 0.17], 0.012, MT.alu, 4);
      O.prism(
        [
          [-0.22, 0.44],
          [0.22, 0.44],
          [0.24, 0.5],
          [-0.24, 0.5],
        ],
        -0.22,
        0.22,
        RED,
      );
      O.push(M4.mul(M4.trans(0, 0.48, -0.2), M4.rotX(-0.18)));
      O.bprism(
        [
          [-0.2, 0],
          [0.2, 0],
          [0.24, 0.42],
          [-0.24, 0.42],
        ],
        0.05,
        0.012,
        RED,
      );
      O.pop();
    });
  shellChair(-4.6, 2.0, Math.PI / 2);
  shellChair(-3.7, 2.35, -Math.PI / 2);
  human(O, -3.7, 0.14, 2.35, -Math.PI / 2, {
    pose: 'drink',
    seat: 0.48,
    shirt: '#2f6f4f',
    pants: '#2b2b30',
    cup: '#14a35a',
  });
  O.at(-4.05, 0.86, 2.05, 0, () => O.cyl(0.04, 0.14, 10, Mat('#e8346c', { r: 0.2 })));

  // ---- grocery stools, bánh mì cart, standee, bin ----
  const stool = (x: number, z: number, c: string) => {
    const m = Mat(c, { r: 0.35, w: 1 });
    O.box(x - 0.16, 0.52, z - 0.16, x + 0.16, 0.56, z + 0.16, m);
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      O.rod([x + a * 0.15, 0.14, z + b * 0.15], [x + a * 0.12, 0.53, z + b * 0.12], 0.02, m, 4);
  };
  O.box(-6.32, 0.62, 1.6, -5.72, 0.66, 2.2, Mat('#1f5fbf', { r: 0.35, w: 1 }));
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    O.rod(
      [-6.02 + a * 0.27, 0.14, 1.9 + b * 0.27],
      [-6.02 + a * 0.25, 0.63, 1.9 + b * 0.25],
      0.022,
      Mat('#1f5fbf', { r: 0.35 }),
      4,
    );
  stool(-6.55, 1.9, '#d7261e');
  stool(-5.45, 1.9, '#1f5fbf');
  stool(-6.0, 2.45, '#d7261e');
  O.box(-6.15, 0.66, 1.75, -6.07, 0.82, 1.83, Mat('#c47a2c', { r: 0.1, e: 0.2 }));
  O.box(-5.95, 0.66, 1.95, -5.87, 0.8, 2.03, Mat('#8ed0ff', { r: 0.05 }));
  human(O, -5.45, 0.14, 1.9, -Math.PI / 2, {
    pose: 'sit',
    seat: 0.42,
    shirt: '#4a6b3a',
    pants: '#2b2b30',
  });
  O.box(3.1, 0.5, -6.9, 3.9, 1.2, -5.7, Mat('#e9eef2', { r: 0.3, w: 1 }), { px: false });
  decalX(O, -5.7, -6.9, 0.6, 1.15, 3.901, tex('cafe', 0.8, { r: 0.3, w: 1 }));
  O.box(3.15, 1.2, -6.85, 3.85, 1.72, -5.75, MT.alu, { px: false });
  decalX(O, -5.75, -6.85, 1.22, 1.7, 3.851, tex('hotfood', 1.8, { r: 0.08, w: 1 }));
  for (const z of [-6.8, -5.8]) {
    O.push(M4.mul(M4.trans(3.5, 0.36, z), M4.rotX(Math.PI / 2)));
    O.cyl(0.22, 0.06, 14, MT.rubber);
    O.pop();
  }
  O.at(3.05, 0.14, -6.3, 0, () => {
    O.cyl(0.025, 2.55, 6, MT.alu);
    O.push(M4.trans(0, 2.25, 0));
    O.cyl(1.25, 0.5, 16, Mat('#1f5fbf', { r: 0.3, w: 1 }), { r2: 0.05, caps: false });
    O.pop();
  });
  human(O, 2.75, 0.14, -6.3, Math.PI / 2, {
    shirt: '#7a4a8a',
    pants: '#2a2a2e',
    female: true,
    arms: 'counter',
  });
  O.at(2.75, 1.64, -6.3, 0, () =>
    O.cyl(0.25, 0.17, 18, Mat('#d8c48a', { r: 0.7, w: 1 }), { r2: 0.012, caps: 'top' }),
  ); // nón lá
  L(3.55, 1.9, -6.3, 4, [1, 0.7, 0.4], 2.6);
  O.quad(
    [-2.15, 0.14, 1.45],
    [-1.65, 0.14, 1.45],
    [-1.65, 1.0, 1.28],
    [-2.15, 1.0, 1.28],
    tex('standee', 0.35, { w: 1 }),
  );
  O.quad([-1.65, 0.14, 1.1], [-2.15, 0.14, 1.1], [-2.15, 1.0, 1.28], [-1.65, 1.0, 1.28], MT.white);
  O.at(2.75, 0.14, 1.5, 0, () => O.cyl(0.22, 0.75, 14, Mat('#1e7a3a', { r: 0.4, w: 1 })));
  // customer arriving under a black umbrella
  human(O, -0.65, 0.14, 1.75, Math.PI, {
    pose: 'walk',
    stride: 0.18,
    shirt: '#ffffff',
    pants: '#1e2a3a',
    female: true,
    hairStyle: 'long',
  });
  O.rod([-0.48, 1.0, 1.8], [-0.55, 1.9, 1.75], 0.012, MT.alu, 4);
  O.at(-0.55, 1.75, 1.75, 0, () =>
    O.cyl(0.62, 0.28, 14, Mat('#141416', { r: 0.25, w: 1 }), { r2: 0.03, caps: false }),
  );

  // ---- dynamic meshes: moving rides (wheels separate so they can roll) ----
  let M = new Mesh();
  scooter(M, {
    col: '#3a3d42',
    accent: '#b8874a',
    rimCol: '#2a2c30',
    ab: 'abGray',
    seat: '#4a3020',
    spring: '#2a2c30',
    lit: true,
    noWheels: true,
    plate: 'plate2',
  });
  rider(M, GRAB_RIDER);
  pillion(M, {
    shirt: '#f4f4f0',
    pants: '#3b5a8a',
    helmet: GRAB,
    visor: '#f4f4f2',
    bag: '#151517',
    collar: '#e0e0dc',
    sneaker: true,
  });
  S.dyn.grabAB = M;
  M = new Mesh();
  scooter(M, {
    col: XSM,
    ev: true,
    lit: true,
    decal: 'xsmBack',
    seat: '#222428',
    plate: 'plate2',
    accent: '#e9f6f8',
    noWheels: true,
  });
  rider(M, {
    shirt: '#14b8c8',
    long: true,
    stripe: '#e9fbff',
    helmet: XSM,
    visor: '#ffffff',
    back: 'xsmBack',
    pants: '#1e2a36',
    collar: '#0e8a96',
  });
  S.dyn.xsmBike = M;
  M = new Mesh();
  scooter(M, { col: '#c8141b', lit: true, plate: 'plate', ab: 'abRed', noWheels: true });
  rider(M, GRAB_RIDER);
  pillion(M, {
    shirt: '#3b5a8a',
    long: true,
    pants: '#ecebe6',
    helmet: GRAB,
    visor: '#f4f4f2',
    bag: '#1a1a1c',
    female: true,
    collar: '#2f4a75',
  });
  S.dyn.grabScooter = M;
  M = new Mesh();
  const MG = new Mesh();
  vfCar(M, MG, { decal: 'xsmDoor', lit: true, driver: true, noWheels: true });
  S.dyn.car = M;
  S.dyn.carG = MG;
  const wheels: [string, (M: Mesh, x: number, y: number, z: number) => void][] = [
    ['wCar', carWheel],
    ['wBikeF', bikeWheelF],
    ['wBikeR', bikeWheelR],
    ['wWaveF', waveWheelF],
    ['wWaveR', waveWheelR],
  ];
  for (const [k, f] of wheels) {
    M = new Mesh();
    f(M, 0, 0, 0);
    S.dyn[k] = M;
  }
}

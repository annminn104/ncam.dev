// Ground, road markings and the Circle K storefront (3-panel fascia, glass, posters, sliding door).
import { MT } from '../materials';
import { decalX, decalZ, Mat, Mesh, tex } from '../mesh';
import { seed } from '../math';
import { SY, type Ctx } from './types';

export function buildStorefront({ S, O, G, L, SPOT }: Ctx): void {
  seed(7);
  // ---- diorama plinth + ground ----
  O.box(-8.06, -0.95, -8.06, 8.06, -0.1, 8.06, MT.plinth);
  decalZ(O, -2.2, 2.2, -0.78, -0.26, 8.065, Mat('#ffffff', { t: 'plaque', r: 0.25, m: 1 }));
  O.box(-8, -0.12, 3.75, 8, 0, 8, MT.asphalt, { ny: false });
  O.box(4.75, -0.12, -8, 8, 0, 3.75, MT.asphalt, { ny: false });
  O.box(-8, -0.1, 1, 4.6, 0.14, 3.6, MT.tile, { ny: false });
  O.box(2, -0.1, -8, 4.6, 0.14, 1, MT.tile, { ny: false });
  O.box(-8, -0.1, 3.6, 4.75, 0.16, 3.75, MT.curb, { ny: false });
  O.box(4.6, -0.1, -8, 4.75, 0.16, 3.6, MT.curb, { ny: false });
  for (let i = 0; i < 6; i++) {
    const m = i % 2 ? MT.paintY : Mat('#151515', { r: 0.45, k: 6, w: 1 });
    O.box(4.75 - 0.5 * (i + 1), 0.16, 3.6, 4.75 - 0.5 * i, 0.165, 3.75, m);
    O.box(4.6, 0.16, 3.6 - 0.5 * (i + 1), 4.75, 0.165, 3.6 - 0.5 * i, m);
  }
  for (let x = -8; x < 3.6; x += 2.4)
    O.box(x, 0, 5.82, Math.min(x + 1.3, 3.6), 0.006, 5.94, MT.paint);
  for (let z = -8; z < 2.6; z += 2.4)
    O.box(6.34, 0, z, 6.46, 0.006, Math.min(z + 1.3, 2.6), MT.paint);
  for (let i = 0; i < 5; i++) O.box(0.7 + i * 0.75, 0, 3.95, 1.15 + i * 0.75, 0.006, 7.8, MT.paint); // zebra
  O.box(4.95, 0, 3.95, 5.1, 0.006, 5.75, MT.paint);
  O.box(4.95, 0, -1, 7.95, 0.006, -0.85, MT.paint);
  O.box(4.9, 0, 3.85, 7.95, 0.004, 4.0, MT.paintY);
  for (const x of [-3.2, 1.9]) O.box(x, 0, 3.78, x + 0.7, 0.008, 4.05, MT.iron); // gutter grates
  O.at(-1.4, 0, 6.9, 0, () => O.cyl(0.36, 0.01, 20, Mat('#2a2826', { r: 0.4, m: 0.8, w: 1 })));

  // ---- store shell ----
  O.box(-5, -0.1, -7.5, 2, SY, 1, MT.floorIn, { ny: false });
  O.box(-5, 2.95, -7.5, 2, 3.05, 1, MT.ceil);
  O.box(-5, SY, -7.5, -4.9, 2.95, 1, MT.wallW);
  O.box(-5, SY, -7.5, 2, 2.95, -7.4, MT.wallW);
  O.box(1.9, SY, -7.5, 2.02, 2.72, -4.1, MT.wallW);
  O.box(-5, SY, 0.9, -4.75, 2.72, 1.02, MT.wallW);
  O.box(1.7, SY, 0.65, 2.06, 2.72, 1.06, MT.white);
  O.box(1.68, SY, 0.63, 2.08, 0.42, 1.08, MT.dark);
  for (const [a, b] of [
    [-4.75, -1.55],
    [0.25, 1.7],
  ])
    O.box(a, SY, 0.94, b, 0.42, 1.0, MT.dark);
  O.box(1.94, SY, -4.1, 2.0, 0.42, 0.65, MT.dark);
  O.box(-4.75, 2.66, 0.92, 1.7, 2.72, 1.02, MT.frame);
  O.box(1.92, 2.66, -4.1, 2.02, 2.72, 0.65, MT.frame);
  for (const x of [-4.75, -3.15, -1.55, 0.25, 1.7])
    O.box(x - 0.035, SY, 0.93, x + 0.035, 2.7, 1.03, MT.frame);
  for (const z of [0.65, -0.9, -2.5, -4.1])
    O.box(1.93, SY, z - 0.035, 2.03, 2.7, z + 0.035, MT.frame);
  O.box(-1.55, 2.33, 0.93, 0.25, 2.4, 1.03, MT.frame);
  O.box(-1.58, SY, 1.02, 0.28, SY + 0.03, 1.1, MT.alu);
  O.box(-0.82, 2.4, 1.03, -0.48, 2.5, 1.1, MT.blackGloss);
  O.box(-0.67, 2.43, 1.1, -0.63, 2.47, 1.104, Mat('#40ff80', { e: 6 })); // door sensor
  const pane = (x0: number, x1: number, y0: number, y1: number, z: number) =>
    decalZ(G, x0, x1, y0, y1, z, MT.glass);
  const paneX = (z0: number, z1: number, y0: number, y1: number, x: number) =>
    decalX(G, z0, z1, y0, y1, x, MT.glass);
  pane(-4.72, -3.18, 0.42, 2.66, 1);
  pane(-3.12, -1.58, 0.42, 2.66, 1);
  pane(0.28, 1.67, 0.42, 2.66, 1);
  pane(-1.52, 0.22, 2.4, 2.66, 1);
  paneX(0.62, -0.87, 0.42, 2.66, 2);
  paneX(-0.93, -2.47, 0.42, 2.66, 2);
  paneX(-2.53, -4.07, 0.42, 2.66, 2);
  // red "CIRCLE K 24hrs" band, welcome banner, posters (inside the glass)
  for (const [a, b] of [
    [-4.72, -3.18],
    [-3.12, -1.58],
    [0.28, 1.67],
  ])
    decalZ(O, a, b, 0.86, 1.0, 0.975, tex('glassBand', 1.3));
  for (const [a, b] of [
    [0.62, -0.87],
    [-0.93, -2.47],
    [-2.53, -4.07],
  ])
    decalX(O, a, b, 0.86, 1.0, 1.975, tex('glassBand', 1.3));
  decalZ(O, -1.5, 0.2, 2.06, 2.31, 0.975, tex('welcome', 1.6));
  const P = (n: string, x: number, y: number, w = 0.56) =>
    decalZ(O, x, x + w, y, y + w * 1.4, 0.97, tex(n, 1.25));
  const PX = (n: string, z: number, y: number, w = 0.56) =>
    decalX(O, z, z - w, y, y + w * 1.4, 1.97, tex(n, 1.25));
  P('pLau', -4.6, 1.08);
  P('pKM', -3.0, 1.08, 0.5);
  P('pFrost', 0.38, 1.08, 0.62);
  P('pMiTron', 1.05, 1.08, 0.56);
  P('p247', -2.2, 1.12, 0.48);
  PX('pCafeVN', 0.45, 1.08);
  PX('pKem', -1.1, 1.08);
  PX('pCom', -2.7, 1.08);
  PX('pWifi', -3.55, 1.5, 0.36);

  // ---- 3-panel fascia like the real stores ----
  O.box(-5, 2.72, 1.0, 2.22, 3.7, 1.2, MT.white);
  O.box(2.0, 2.72, -7.5, 2.22, 3.7, 1.2, MT.white);
  O.box(-5.02, 3.7, 0.9, 2.3, 3.78, 1.3, MT.white);
  O.box(1.9, 3.7, -7.5, 2.3, 3.78, 1.3, MT.white);
  const panelZ = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    d: number,
    t: string,
    e: number,
  ) => {
    O.box(x0, y0, 1.2, x1, y1, 1.2 + d, MT.red, { pz: false });
    decalZ(O, x0, x1, y0, y1, 1.202 + d, tex(t, e, { r: 0.3, w: 1 }));
  };
  const panelX = (
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    d: number,
    t: string,
    e: number,
  ) => {
    O.box(2.2, y0, z1, 2.2 + d, y1, z0, MT.red, { px: false });
    decalX(O, z0, z1, y0, y1, 2.202 + d, tex(t, e, { r: 0.3, w: 1 }));
  };
  panelZ(-4.95, -2.55, 2.8, 3.62, 0.05, 'ckPanel', 1.25);
  panelZ(-2.45, 0.45, 2.76, 3.66, 0.1, 'ckCenter', 1.4);
  panelZ(0.55, 2.17, 2.8, 3.62, 0.05, 'ckPanel', 1.25);
  panelX(1.15, -1.8, 2.8, 3.62, 0.05, 'ckPanel', 1.25);
  panelX(-1.9, -5.0, 2.76, 3.66, 0.1, 'ckCenter', 1.4);
  panelX(-5.1, -7.45, 2.8, 3.62, 0.05, 'ckPanel', 1.25);
  O.box(-5, 2.7, 1.06, 2.22, 2.72, 1.16, Mat('#fff6e8', { e: 8 }));
  O.box(2.06, 2.7, -7.5, 2.16, 2.72, 1.16, Mat('#fff6e8', { e: 8 }));
  // vertical lightbox sign at the left end
  O.box(-4.79, 3.78, 1.02, -4.65, 5.02, 1.72, MT.white, { px: false, nx: false });
  decalX(O, 1.72, 1.02, 3.78, 5.02, -4.648, tex('ckVert', 1.8, { r: 0.3, w: 1 }));
  decalX(O, 1.02, 1.72, 3.78, 5.02, -4.792, tex('ckVert', 1.8, { r: 0.3, w: 1 }));
  O.box(-4.74, 3.7, 0.8, -4.7, 3.78, 1.4, MT.iron);
  O.box(-1.5, 0.14, 1.12, 0.2, 0.152, 1.7, Mat('#a8150f', { r: 0.95 })); // door mat

  // ---- sliding door leaves (animated): frame → dynamic opaque, glass → dynamic glass ----
  const F = new Mesh(),
    GG = new Mesh(),
    w = 0.43,
    y0 = SY + 0.01,
    y1 = 2.32;
  F.box(-w, y0, -0.02, w, y0 + 0.07, 0.02, MT.alu);
  F.box(-w, y1 - 0.05, -0.02, w, y1, 0.02, MT.alu);
  F.box(-w, y0, -0.02, -w + 0.05, y1, 0.02, MT.alu);
  F.box(w - 0.05, y0, -0.02, w, y1, 0.02, MT.alu);
  F.box(-w + 0.07, 1.0, 0.02, -w + 0.09, 1.5, 0.05, MT.alu);
  decalZ(F, -w + 0.15, w - 0.15, 1.25, 1.33, 0.021, tex('glassBand', 1.0));
  decalZ(GG, -w + 0.05, w - 0.05, y0 + 0.07, y1 - 0.05, 0, MT.glass);
  S.dyn.doorF = F;
  S.dyn.doorG = GG;
  S.door = {
    z: 1.065,
    left: -1.1,
    right: -0.21,
    travel: 0.86,
    box: [-1.6, SY, 0.9, 0.3, 2.45, 1.2],
  };

  // side wall lightbox + meter box
  O.box(1.9, 0.85, -5.95, 2.06, 2.65, -4.45, MT.frame, { px: false });
  decalX(O, -4.5, -5.9, 0.9, 2.6, 2.065, tex('pCombo', 1.6, { r: 0.2, w: 1 }));
  O.box(2.02, 1.0, -7.2, 2.12, 1.6, -6.7, Mat('#8a8f94', { r: 0.4, m: 0.6, w: 1 }));
  // light: shop-window spill (shadowed spot), red fascia glow
  SPOT([-1.25, 2.55, -0.45], [0, -0.55, 1], 28, 66, 10, [1, 0.95, 0.88], 19);
  L(2.7, 1.9, -1.6, 5.5, [1, 0.95, 0.9], 2.2);
  L(-3.6, 1.2, 1.5, 3, [1, 0.95, 0.9], 0.8);
  L(-3.2, 3.2, 1.9, 5, [1, 0.14, 0.07], 2.6);
  L(0.6, 3.2, 1.9, 5, [1, 0.14, 0.07], 2.6);
  L(2.9, 3.2, -3.2, 5, [1, 0.14, 0.07], 2.6);
  L(-4.2, 4.4, 1.4, 4, [1, 0.35, 0.3], 1.4);
}

// Moving rides: Xanh SM VF e34 taxi, Grab Air Blade with passenger, Xanh SM e-scooter, Grab scooter on the side street.
import { M4, type Mat4, type Vec3 } from './math';

/** wheel placement: [x, y (= radius), z, dynamic mesh name] */
export type WheelDef = [number, number, number, string];
export interface Ride {
  m: string;
  g?: string; // body mesh, optional glass mesh
  ax: 'x' | 'z';
  lane: number;
  dir: 1 | -1;
  spd: number;
  off: number;
  len: number;
  hk: number;
  hy: number;
  cone: number; // headlight intensity, height, beam half-angle (deg)
  wheels: WheelDef[];
}

const W_CAR: WheelDef[] = [
  [1.31, 0.345, 0.775, 'wCar'],
  [1.31, 0.345, -0.775, 'wCar'],
  [-1.3, 0.345, 0.775, 'wCar'],
  [-1.3, 0.345, -0.775, 'wCar'],
];
const W_BIKE: WheelDef[] = [
  [0.62, 0.26, 0, 'wBikeF'],
  [-0.6, 0.26, 0, 'wBikeR'],
];

export const RIDES: Ride[] = [
  {
    m: 'car',
    g: 'carG',
    ax: 'x',
    lane: 6.9,
    dir: 1,
    spd: 5.2,
    off: 4,
    len: 4.3,
    hk: 26,
    hy: 0.7,
    cone: 30,
    wheels: W_CAR,
  },
  {
    m: 'grabAB',
    ax: 'x',
    lane: 4.62,
    dir: -1,
    spd: 4.4,
    off: 0,
    len: 1.9,
    hk: 14,
    hy: 0.95,
    cone: 24,
    wheels: W_BIKE,
  },
  {
    m: 'xsmBike',
    ax: 'x',
    lane: 5.25,
    dir: -1,
    spd: 3.7,
    off: 13,
    len: 1.9,
    hk: 14,
    hy: 0.95,
    cone: 24,
    wheels: W_BIKE,
  },
  {
    m: 'grabScooter',
    ax: 'z',
    lane: 7.1,
    dir: -1,
    spd: 4.0,
    off: 7,
    len: 1.9,
    hk: 14,
    hy: 0.95,
    cone: 24,
    wheels: W_BIKE,
  },
];

/** position along the loop (wraps every 24 m) */
export const ridePos = (r: Ride, t: number): number => {
  const s = (t * r.spd + r.off) % 24;
  return r.dir > 0 ? -12 + s : 12 - s;
};
export function rideMatrix(r: Ride, p: number, bob = 0): Mat4 {
  return r.ax === 'x'
    ? M4.mul(M4.trans(p, bob, r.lane), M4.rotY(r.dir < 0 ? Math.PI : 0))
    : M4.mul(M4.trans(r.lane, bob, p), M4.rotY(r.dir < 0 ? Math.PI / 2 : -Math.PI / 2));
}
/** world point a metres ahead of the ride centre (negative = behind) */
export const rideAhead = (r: Ride, p: number, a: number): Vec3 =>
  r.ax === 'x' ? [p + r.dir * a, 0, r.lane] : [r.lane, 0, p + r.dir * a];

import type { PieceSymbol } from 'chess.js';
import {
  type BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  OctahedronGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { BASE_TOP, TREASURE_HEIGHT } from '../../pieces/kits';
import { paint } from './paint';
import type { BodyStyle, ChibiRecipe, Frame, HairStyle, Palette, PartCtx, PartOut } from './types';

// The chibi body every figure is dressed on, free of React and the DOM so Node tests can measure
// it. Piece space: standing on the base's top, facing +z (its owner). Every measure is in head
// radii (`u`), so the six piece types are one body at six sizes; only the skirts' flare is held to
// `bodyR`. A part is painted (vertex colours) and placed where it belongs, ready to merge.

export const CHIBI_HAT_ROOM: Record<PieceSymbol, number> = {
  p: 0.07,
  n: 0.1,
  b: 0.16,
  r: 0.12,
  q: 0.14,
  k: 0.2,
};

// Figure height (feet to crown of the head) = target − BASE_TOP − hat room; head ≈ 0.4 of it.
export function frameFor(type: PieceSymbol, mounted: boolean): Frame {
  const standY = BASE_TOP;
  const top = TREASURE_HEIGHT[type] - CHIBI_HAT_ROOM[type];
  const figure = top - standY;
  const headR = figure * 0.2;
  const headY = top - headR;
  // A rider sits higher: the mount fills the lower 45 % of the figure.
  const hipY = mounted ? standY + figure * 0.45 : standY + figure * 0.3;
  const shoulderY = headY - headR * 1.05;
  const bodyR = Math.min(0.2, figure * 0.24);
  return { standY, headY, headR, shoulderY, hipY, bodyR, top };
}

/** The head's squash: a touch flatter than round, and shallower front to back. Hair and face follow it. */
export const HEAD_SQUASH = [1, 0.94, 0.98] as const;

/** The hair's shell, this much rounder than the head: its crown is the frame's `top`. */
const HAIR_LIFT = 1.06;

/**
 * The face decal's cap (face.ts paints its canvas for it): the front of the head, `x` degrees of
 * azimuth by `y` of elevation, centred on the front of the head's equator, just outside the skin:
 * far enough out that a phone's camera (pulled ~3× further back) keeps it in front of the head.
 */
export const FACE_SPAN = { x: 110, y: 80, lift: 1.012 } as const;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

type Quality = PartCtx['quality'];
type Vec = readonly [x: number, y: number, z: number];

/** Segment counts: 'low' is the weak GPU's figure (≤ 1 100 triangles against 1 800). */
interface Detail {
  head: readonly [width: number, height: number];
  cap: readonly [width: number, height: number];
  /** A lock's sides, and its rows per head radius of length (a long lock bends more). */
  lock: readonly [radial: number, rowsPerRadius: number];
  spike: readonly [radial: number, rowsPerRadius: number];
  tail: readonly [segments: number, radial: number];
  lathe: number;
  ring: readonly [radial: number, tubular: number];
  limb: readonly [cap: number, radial: number];
  hand: readonly [width: number, height: number];
  shoe: readonly [cap: number, radial: number];
  dome: readonly [width: number, height: number];
  cuff: number;
}

const DETAIL: Record<Quality, Detail> = {
  high: {
    head: [20, 14],
    cap: [20, 5],
    lock: [4, 4],
    spike: [4, 3.5],
    tail: [8, 6],
    lathe: 14,
    ring: [3, 12],
    limb: [2, 6],
    hand: [6, 5],
    shoe: [2, 6],
    dome: [6, 3],
    cuff: 8,
  },
  low: {
    head: [14, 10],
    cap: [14, 4],
    lock: [4, 2.5],
    spike: [3, 1.5],
    tail: [6, 5],
    lathe: 10,
    ring: [3, 10],
    limb: [1, 5],
    hand: [5, 4],
    shoe: [1, 6],
    dome: [6, 2],
    cuff: 6,
  },
};

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A lathe from [radius, height] pairs; profiles run up the outside, so normals face out. */
function lathe(
  profile: readonly (readonly [r: number, y: number])[],
  segments: number,
  phiStart = 0,
  phiLength = TAU,
): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
    phiStart,
    phiLength,
  );
}

/** A ring lying in the board's plane at height `y`. */
function ring(radius: number, tube: number, y: number, [radial, tubular]: Detail['ring']) {
  const g = new TorusGeometry(radius, tube, radial, tubular);
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

const UP = new Vector3(0, 1, 0);

/** Turns a shape built along +y to run along `dir`, then moves it to `at`. */
function aim<T extends BufferGeometry>(g: T, dir: Vector3, at: Vector3): T {
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  g.translate(at.x, at.y, at.z);
  return g;
}

/** Squashes a shape built round the origin like the head, and lifts it to the head's centre. */
function onHeadCentre<T extends BufferGeometry>(g: T, f: Frame): T {
  g.scale(...HEAD_SQUASH);
  g.translate(0, f.headY, 0);
  return g;
}

/**
 * Lays a shape onto the head. It is built in a frame tangent to the head at (`az`, `el`): x along
 * the azimuth (east: +x seen from the front), y up over the head, z out of it. Each vertex goes to
 * the point that far round the head and that far out of a sphere `radius` round its centre (then
 * squashed like the head), and its normal turns with the frame, so a lock of hair hugs the skull.
 */
function onHead<T extends BufferGeometry>(
  g: T,
  f: Frame,
  az0: number,
  el0: number,
  radius: number,
): T {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const el = el0 + pos.getY(i) / radius;
    const az = az0 + pos.getX(i) / (radius * Math.max(0.3, Math.cos(el)));
    const r = radius + pos.getZ(i);
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    const ce = Math.cos(el);
    const se = Math.sin(el);
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    pos.setXYZ(i, r * sa * ce, r * se, r * ca * ce);
    // east (ca, 0, −sa), north (−sa·se, ce, −ca·se), out (sa·ce, se, ca·ce)
    nor.setXYZ(
      i,
      nx * ca - ny * sa * se + nz * sa * ce,
      ny * ce + nz * se,
      -nx * sa - ny * ca * se + nz * ca * ce,
    );
  }
  return onHeadCentre(g, f);
}

// ── Head and face ───────────────────────────────────────────────────────────────────────────

/**
 * The head. Under hair its crown is left open: every hairline runs below 50° of elevation, so
 * the shell always covers the rows above it (a quarter of the head's triangles, for the hair).
 */
function head(f: Frame, d: Detail, haired: boolean): BufferGeometry {
  const [w, h] = d.head;
  const skip = haired ? Math.floor(h / 4) : 0;
  const row = Math.PI / h;
  return onHeadCentre(
    new SphereGeometry(f.headR, w, h - skip, 0, TAU, skip * row, Math.PI - skip * row),
    f,
  );
}

/**
 * The cap face.ts maps its canvas on: three's sphere segment, its u running with the azimuth from
 * the owner's left (−x) to right (+x) and its v up, so the canvas reads upright and unmirrored.
 */
export function faceCap(f: Frame): BufferGeometry {
  const w = FACE_SPAN.x * DEG;
  const h = FACE_SPAN.y * DEG;
  // three's φ runs from −x (φ = 0) through +z (φ = π/2), its θ down from the crown.
  const g = new SphereGeometry(
    f.headR * FACE_SPAN.lift,
    24,
    16,
    Math.PI / 2 - w / 2,
    w,
    Math.PI / 2 - h / 2,
    h,
  );
  return onHeadCentre(g, f);
}

// ── Hair ────────────────────────────────────────────────────────────────────────────────────

/** A hairline: its elevation (degrees) at the front, over the ears and at the nape. */
interface Hairline {
  front: number;
  side: number;
  back: number;
  /** How far (degrees) every other column of the shell drops round the back: a jagged nape. */
  teeth?: number;
}

function hairlineAt(line: Hairline, az: number): number {
  const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az)));
  return (
    (line.front +
      (line.side - line.front) * smoothstep(0.5, 1.45, a) +
      (line.back - line.side) * smoothstep(1.65, 2.95, a)) *
    DEG
  );
}

/**
 * The hair's shell: the head's sphere, a little rounder, from the crown down to a hairline that
 * runs level across the forehead, drops over the ears and lower still at the nape.
 */
function hairShell(f: Frame, [w, h]: Detail['cap'], line: Hairline): BufferGeometry {
  const g = new SphereGeometry(1, w, h, 0, TAU, 0, Math.PI / 2);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const r = f.headR * HAIR_LIFT;
  for (let i = 0; i < pos.count; i++) {
    // Rows run evenly from the crown (u's offset at the pole changes nothing there) to the line.
    const az = uv.getX(i) * TAU - Math.PI / 2;
    // Teeth on alternate columns, so their tips are sharp at any column count.
    const tooth = Math.round(uv.getX(i) * w) % 2;
    const back = smoothstep(1.3, 1.9, Math.abs(Math.atan2(Math.sin(az), Math.cos(az))));
    const edge = hairlineAt(line, az) - (line.teeth ?? 0) * DEG * tooth * back;
    const polar = (1 - uv.getY(i)) * (Math.PI / 2 - edge);
    const x = Math.sin(az) * Math.sin(polar);
    const y = Math.cos(polar);
    const z = Math.cos(az) * Math.sin(polar);
    nor.setXYZ(i, x, y, z);
    pos.setXYZ(i, x * r, y * r, z * r);
  }
  return onHeadCentre(g, f);
}

/** A lock of hair: its root (degrees round and up the head), its size, and how it bends. All × headR. */
interface Lock {
  az: number;
  el: number;
  len: number;
  width: number;
  /** Sideways at the tip (+: toward the lock's east, the owner's right at the front of the head). */
  curl?: number;
  /** Out from the head at the tip. */
  flare?: number;
}

/** How thick a lock is for its width: flat, a ridge down its middle catching the light. */
const LOCK_FLAT = 0.3;

/** A tapering lock (a flattened cone), root up, tip down, laid on the head `lift` radii out. */
function lock(f: Frame, [radial, rows]: Detail['lock'], s: Lock, lift: number): BufferGeometry {
  const u = f.headR;
  const len = s.len * u;
  const g = new ConeGeometry((s.width * u) / 2, len, radial, Math.max(1, Math.round(s.len * rows)));
  g.rotateX(Math.PI);
  g.translate(0, -len / 2, 0);
  g.scale(1, 1, LOCK_FLAT);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, -pos.getY(i) / len)) ** 2;
    pos.setX(i, pos.getX(i) + (s.curl ?? 0) * u * t);
    pos.setZ(i, pos.getZ(i) + (s.flare ?? 0) * u * t);
  }
  return onHead(g, f, s.az * DEG, s.el * DEG, lift * u);
}

/** Bangs and side locks root on the skin under the shell; spikes root inside it and flare out. */
const BANG_LIFT = 1.0;
const SPIKE_LIFT = 0.98;
/**
 * A bang's root lies on the skin, under the shell (a root standing proud of it would poke its
 * edge through), and its tip lifts this far off the skin, clear in front of the face decal.
 */
const BANG_TIP = 0.05;

interface HairDesign {
  line: Hairline;
  /** Bangs and side locks, framing the face. */
  locks: readonly Lock[];
  /** Locks rooted in the shell that flare out of it: the style's silhouette. */
  spikes: readonly Lock[];
  /** Broad clumps lying on the shell from the crown down: texture on top, under any hat. */
  crown?: readonly Lock[];
}

const mirrored = (l: Lock): Lock[] => [l, { ...l, az: -l.az, curl: -(l.curl ?? 0) }];

const HAIR: Record<Exclude<HairStyle, 'none'>, HairDesign> = {
  // Short and spiky: a fringe of pointed bangs, a long lock before each ear, a shaggy back.
  spiky: {
    line: { front: 24, side: -14, back: -46, teeth: 16 },
    locks: [
      { az: -40, el: 30, len: 0.42, width: 0.36, curl: -0.1, flare: 0.04 },
      { az: -20, el: 33, len: 0.52, width: 0.38, curl: -0.05, flare: 0.03 },
      { az: 0, el: 34, len: 0.47, width: 0.36, curl: 0.03, flare: 0.03 },
      { az: 20, el: 33, len: 0.53, width: 0.38, curl: 0.07, flare: 0.03 },
      { az: 40, el: 30, len: 0.42, width: 0.36, curl: 0.1, flare: 0.04 },
      ...mirrored({ az: 64, el: 16, len: 0.86, width: 0.3, curl: -0.12, flare: 0.06 }),
    ],
    spikes: [
      ...mirrored({ az: 84, el: 22, len: 0.62, width: 0.5, flare: 0.42 }),
      ...mirrored({ az: 122, el: 28, len: 0.68, width: 0.55, flare: 0.46 }),
      ...mirrored({ az: 160, el: 22, len: 0.66, width: 0.52, flare: 0.42 }),
      ...mirrored({ az: 150, el: 54, len: 0.6, width: 0.5, flare: 0.4 }),
    ],
    crown: [
      { az: 10, el: 62, len: 0.62, width: 0.62, curl: 0.12, flare: 0.1 },
      ...mirrored({ az: 72, el: 60, len: 0.66, width: 0.6, curl: 0.1, flare: 0.14 }),
      ...mirrored({ az: 128, el: 62, len: 0.66, width: 0.6, curl: 0.08, flare: 0.16 }),
    ],
  },
  // A ponytail: bangs swept to one side, side locks, the tail tied high at the back.
  ponytail: {
    line: { front: 26, side: -8, back: -32 },
    locks: [
      { az: -36, el: 31, len: 0.44, width: 0.38, curl: 0.14, flare: 0.03 },
      { az: -18, el: 33, len: 0.5, width: 0.38, curl: 0.12, flare: 0.03 },
      { az: 0, el: 34, len: 0.48, width: 0.38, curl: 0.1, flare: 0.03 },
      { az: 18, el: 33, len: 0.44, width: 0.36, curl: 0.08, flare: 0.03 },
      { az: 36, el: 31, len: 0.36, width: 0.34, curl: 0.06, flare: 0.03 },
      ...mirrored({ az: 62, el: 14, len: 0.72, width: 0.28, curl: -0.1, flare: 0.05 }),
    ],
    spikes: [],
  },
  // A bob: a straight fringe, the hair falling to the chin round the sides and back.
  bob: {
    line: { front: 26, side: -36, back: -44 },
    locks: [-45, -30, -15, 0, 15, 30, 45].map((az) => ({
      az,
      el: 30,
      len: Math.abs(az) > 35 ? 0.34 : 0.38,
      width: 0.3,
      flare: 0.02,
    })),
    spikes: [],
  },
};

/** A tube along `curve` whose radius follows `radius(t)`, t 0..1 from the curve's start to its end. */
function taperedTube(
  curve: CatmullRomCurve3,
  segments: number,
  radial: number,
  radius: (t: number) => number,
): TubeGeometry {
  const g = new TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.getAttribute('position');
  const centre = new Vector3();
  const v = new Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, centre);
    const r = radius(i / segments);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

/** The ponytail and its tie: rooted inside the head, out of the crown's back and down to the shoulders. */
function ponytail(f: Frame, d: Detail, p: Palette): BufferGeometry[] {
  const u = f.headR;
  const at = (x: number, y: number, z: number) => new Vector3(x * u, f.headY + y * u, z * u);
  // Out of the back of the crown, over in an arc and down to the shoulder blades; the king's
  // stays inside its square (1.6 head radii back at most, against 1.7).
  const curve = new CatmullRomCurve3([
    at(0, 0.5, -0.7),
    at(0, 0.56, -1.08),
    at(0, 0.2, -1.3),
    at(0, -0.4, -1.3),
    at(0, -1.0, -1.16),
    at(0, -1.45, -0.98),
  ]);
  const radius = (t: number) =>
    u * (0.25 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.4))) * (1 - 0.82 * t * t);
  const [segments, radial] = d.tail;
  const tail = taperedTube(curve, segments, radial, radius);
  const T = 0.16;
  const tie = new TorusGeometry(radius(T), 0.07 * u, d.ring[0], Math.max(8, d.ring[1] - 4));
  tie.applyQuaternion(
    new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), curve.getTangentAt(T)),
  );
  const knot = curve.getPointAt(T);
  tie.translate(knot.x, knot.y, knot.z);
  return [paint(tail, p.hair), paint(tie, p.accent)];
}

/** The bob's fall: a skirt of hair round the sides and back, open over the face, to the chin. */
function bobFall(f: Frame, d: Detail): BufferGeometry {
  const u = f.headR;
  const open = 46 * DEG;
  const g = lathe(
    [
      [1.0 * u, -0.98 * u],
      [1.1 * u, -0.86 * u],
      [1.13 * u, -0.6 * u],
      [1.1 * u, -0.25 * u],
      [1.04 * u, 0.1 * u],
    ],
    Math.round((d.lathe * (TAU - 2 * open)) / TAU),
    open,
    TAU - 2 * open,
  );
  g.scale(1, 1, HEAD_SQUASH[2]);
  g.translate(0, f.headY, 0);
  return g;
}

function hair(f: Frame, d: Detail, style: HairStyle, p: Palette): BufferGeometry[] {
  if (style === 'none') return [];
  const design = HAIR[style];
  const parts = [
    hairShell(f, d.cap, design.line),
    ...design.locks.map((l) =>
      lock(f, d.lock, { ...l, flare: (l.flare ?? 0) + BANG_TIP }, BANG_LIFT),
    ),
    ...design.spikes.map((l) => lock(f, d.spike, l, SPIKE_LIFT)),
    // Four-sided at any quality: a three-sided clump shows its flat face as a triangle.
    ...(design.crown ?? []).map((l) => lock(f, d.lock, l, HAIR_LIFT)),
  ].map((g) => paint(g, p.hair));
  if (style === 'ponytail') parts.push(...ponytail(f, d, p));
  if (style === 'bob') parts.push(paint(bobFall(f, d), p.hair));
  return parts;
}

// ── Torso ───────────────────────────────────────────────────────────────────────────────────

type Profile = (readonly [r: number, y: number])[];

interface Torso {
  parts: BufferGeometry[];
  /** Wide bell sleeves at the wrists (robes, gowns). */
  cuffs: boolean;
}

/** Up from the waist over the chest to the neck, its top buried in the head. Radii × headR. */
function upper(f: Frame, waist: number, chest: number, shoulder: number): Profile {
  const u = f.headR;
  const span = f.shoulderY - f.hipY;
  return [
    [waist * u, f.hipY + span * 0.4],
    [chest * u, f.shoulderY - span * 0.24],
    [shoulder * u, f.shoulderY - 0.05 * u],
    [0.4 * u, f.shoulderY + 0.07 * u],
    [0.27 * u, f.headY - 0.84 * u],
  ];
}

const waistOf = (f: Frame) => f.hipY + (f.shoulderY - f.hipY) * 0.4;
const chestOf = (f: Frame) => f.shoulderY - (f.shoulderY - f.hipY) * 0.24;

/** A coat's stand-up collar and its double row of buttons. */
function coatTrim(f: Frame, d: Detail, p: Palette): BufferGeometry[] {
  const u = f.headR;
  const buttons = [
    [waistOf(f), 0.5],
    [chestOf(f), 0.57],
  ].flatMap(([y, r]) =>
    [-1, 1].map((s) => {
      const b = new OctahedronGeometry(0.055 * u);
      const x = s * 0.15 * u;
      b.translate(x, y, Math.sqrt((r * u) ** 2 - x * x) + 0.012 * u);
      return paint(b, p.trim);
    }),
  );
  return [paint(ring(0.34 * u, 0.08 * u, f.shoulderY + 0.05 * u, d.ring), p.trim), ...buttons];
}

/** A tailcoat's two tails, hanging from the back of the waist to the knees. */
function tails(f: Frame, mounted: boolean, p: Palette): BufferGeometry[] {
  const u = f.headR;
  const top = waistOf(f);
  const len = mounted ? 0.5 * u : top - (f.standY + 0.55 * u);
  return [-1, 1].map((s) => {
    const shape = new Shape();
    shape.moveTo(-0.15 * u, 0);
    shape.lineTo(0.15 * u, 0);
    shape.lineTo(0.1 * u, -len);
    shape.lineTo(0, -len + 0.14 * u);
    shape.lineTo(-0.1 * u, -len);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: 0.05 * u, bevelEnabled: false });
    g.translate(0, 0, -0.025 * u);
    g.rotateZ(s * 0.1);
    g.rotateX(mounted ? 0.7 : 0.16);
    g.translate(s * 0.12 * u, top, -0.5 * u);
    return paint(g, p.main);
  });
}

/** Round, plated shoulders: a dome a little past half a sphere, tipped out over each arm. */
function pauldrons(f: Frame, d: Detail, p: Palette): BufferGeometry[] {
  const u = f.headR;
  return [-1, 1].map((s) => {
    const g = new SphereGeometry(0.3 * u, d.dome[0], d.dome[1], 0, TAU, 0, Math.PI * 0.6);
    g.rotateZ(-s * 0.55);
    g.translate(s * 0.56 * u, f.shoulderY - 0.02 * u, 0);
    return paint(g, p.second);
  });
}

function torso(f: Frame, d: Detail, style: BodyStyle, mounted: boolean, p: Palette): Torso {
  const u = f.headR;
  const n = d.lathe;
  switch (style) {
    case 'coat':
    case 'tailcoat': {
      // A coat to mid-thigh, flaring a little; a tailcoat cut at the hips in front.
      const long = style === 'coat';
      const hem = f.hipY - (mounted ? 0.14 : long ? 0.46 : 0.14) * u;
      const coat = lathe(
        [
          [0, hem],
          [0.66 * u, hem],
          [0.63 * u, hem + 0.1 * u],
          [0.55 * u, f.hipY],
          ...upper(f, 0.5, 0.57, 0.52),
        ],
        n,
      );
      return {
        parts: [paint(coat, p.main), ...coatTrim(f, d, p), ...(long ? [] : tails(f, mounted, p))],
        cuffs: false,
      };
    }
    case 'robe': {
      // Flaring to the ankles (the shoes' toes peek out); draped over the saddle on a mount.
      const hemR = mounted ? 0.74 * u : Math.min(0.95 * u, f.bodyR);
      const hem = mounted ? f.hipY - 0.2 * u : f.standY + 0.2 * u;
      const flare = hem + (f.hipY - hem) * 0.42;
      const robe = lathe(
        [
          [0, hem],
          [hemR, hem],
          [hemR * 0.97, hem + 0.1 * u],
          [hemR * 0.78, flare],
          [0.6 * u, f.hipY + 0.04 * u],
          ...upper(f, 0.52, 0.57, 0.52),
        ],
        n,
      );
      return {
        parts: [
          paint(robe, p.main),
          paint(ring(0.34 * u, 0.08 * u, f.shoulderY + 0.05 * u, d.ring), p.trim),
          paint(ring(0.53 * u, 0.045 * u, waistOf(f), d.ring), p.trim),
        ],
        cuffs: true,
      };
    }
    case 'gown': {
      // A bell to the floor, a gold band round its hem.
      const hemR = mounted ? 0.78 * u : Math.min(1.12 * u, f.bodyR);
      const hem = mounted ? f.hipY - 0.2 * u : f.standY + 0.004;
      const mid = mounted ? hem + 0.12 * u : (f.standY + f.hipY) / 2;
      const gown = lathe(
        [
          [0, hem],
          [hemR, hem],
          [hemR * 0.99, hem + 0.08 * u],
          [hemR * 0.84, mid],
          [0.6 * u, f.hipY],
          ...upper(f, 0.44, 0.54, 0.5),
        ],
        n,
      );
      return {
        parts: [
          paint(gown, p.main),
          paint(ring(hemR * 0.985, 0.07 * u, hem + 0.07 * u, d.ring), p.trim),
        ],
        cuffs: true,
      };
    }
    case 'dress': {
      // A short bell skirt over the thighs, a fitted bodice, an apron down the front.
      const hemR = mounted ? 0.8 * u : Math.min(1.0 * u, f.bodyR);
      const hem = f.hipY - (mounted ? 0.16 : 0.62) * u;
      const waist = waistOf(f);
      const skirt = lathe(
        [
          [0, hem],
          [hemR, hem],
          [hemR * 0.97, hem + 0.1 * u],
          [0.62 * u, f.hipY + 0.04 * u],
          [0.47 * u, waist],
          [0, waist],
        ],
        n,
      );
      const bodice = lathe(
        [
          [0, waist - 0.04 * u],
          [0.48 * u, waist - 0.04 * u],
          ...upper(f, 0.48, 0.55, 0.5).slice(1),
        ],
        n,
      );
      const off = 0.025 * u;
      const apron = lathe(
        [
          [hemR * 0.96 + off, hem + 0.14 * u],
          [0.62 * u + off, f.hipY + 0.04 * u],
          [0.47 * u + off, waist],
        ],
        Math.max(3, Math.round(n / 4)),
        -0.7,
        1.4,
      );
      return {
        parts: [paint(skirt, p.main), paint(bodice, p.main), paint(apron, p.second)],
        cuffs: false,
      };
    }
    case 'armor': {
      // A rounded breastplate, a flared skirt of plates under a belt, domed pauldrons. The
      // breastplate's foot stands in the skirt, whose top the belt covers: both left open.
      const cuirass = lathe(
        [
          [0.57 * u, f.hipY - 0.03 * u],
          [0.61 * u, f.hipY + 0.1 * u],
          ...upper(f, 0.56, 0.65, 0.58),
        ],
        n,
      );
      cuirass.scale(1, 1, 0.88);
      const low = f.hipY - (mounted ? 0.2 : 0.44) * u;
      const fauld = lathe(
        [
          [0, low],
          [0.76 * u, low],
          [0.73 * u, low + 0.1 * u],
          [0.6 * u, f.hipY + 0.05 * u],
        ],
        n,
      );
      fauld.scale(1, 1, 0.92);
      const belt = ring(0.62 * u, 0.06 * u, f.hipY + 0.06 * u, d.ring);
      belt.scale(1, 1, 0.9);
      return {
        parts: [
          paint(cuirass, p.main),
          paint(fauld, p.second),
          paint(belt, p.trim),
          ...pauldrons(f, d, p),
        ],
        cuffs: false,
      };
    }
  }
}

// ── Arms, hands, legs ───────────────────────────────────────────────────────────────────────

/** The arms, × headR: shoulder joints, arm length to the wrist, hand size and where its centre is. */
const ARM = { joint: 0.46, drop: 0.1, radius: 0.16, length: 0.66, hand: 0.19, reach: 0.76 };
/** Hanging 20° out from the body; a rider's reach forward, to the reins. */
const SPLAY = 20 * DEG;
const forward = (mounted: boolean) => (mounted ? 0.8 : 0.12);

function shoulderJoint(f: Frame, s: -1 | 1): Vector3 {
  return new Vector3(s * ARM.joint * f.headR, f.shoulderY - ARM.drop * f.headR, 0);
}

function armDir(s: -1 | 1, mounted: boolean): Vector3 {
  const fwd = forward(mounted);
  return new Vector3(
    s * Math.sin(SPLAY),
    -Math.cos(SPLAY) * Math.cos(fwd),
    Math.cos(SPLAY) * Math.sin(fwd),
  );
}

/**
 * Where each hand's centre is, for parts that hold something (a staff, a lance, a candle). The
 * figure's own right hand is on −x: it faces +z, its owner.
 */
export function hands(f: Frame, mounted = false): Record<'left' | 'right', Vec> {
  const at = (s: -1 | 1): Vec => {
    const p = shoulderJoint(f, s).addScaledVector(armDir(s, mounted), ARM.reach * f.headR);
    return [p.x, p.y, p.z];
  };
  return { right: at(-1), left: at(1) };
}

function arms(f: Frame, d: Detail, mounted: boolean, cuffs: boolean, sleeve: string, hand: string) {
  const u = f.headR;
  return ([-1, 1] as const).flatMap((s) => {
    const joint = shoulderJoint(f, s);
    const dir = armDir(s, mounted);
    const arm = new CapsuleGeometry(ARM.radius * u, ARM.length * u, d.limb[0], d.limb[1]);
    aim(arm, dir, joint.clone().addScaledVector(dir, (ARM.length * u) / 2));
    const palm = new SphereGeometry(ARM.hand * u, d.hand[0], d.hand[1]);
    const c = joint.clone().addScaledVector(dir, ARM.reach * u);
    palm.translate(c.x, c.y, c.z);
    const parts: BufferGeometry[] = [paint(arm, sleeve), paint(palm, hand)];
    if (cuffs) {
      // Narrow at its top (+y), wide at its foot: turned to point up the arm, it opens at the wrist.
      const cuff = new CylinderGeometry(0.17 * u, 0.27 * u, 0.26 * u, d.cuff, 1, true);
      aim(cuff, dir.clone().negate(), joint.clone().addScaledVector(dir, 0.54 * u));
      parts.push(paint(cuff, sleeve));
    }
    return parts;
  });
}

/** Round chibi shoes, toes forward, soles on the base; `toe` moves them forward (out from a robe). */
function shoes(f: Frame, d: Detail, color: string, toe = 0.08): BufferGeometry[] {
  const u = f.headR;
  return [-1, 1].map((s) => {
    const g = new CapsuleGeometry(0.2 * u, 0.26 * u, d.shoe[0], d.shoe[1]);
    g.rotateX(Math.PI / 2);
    g.scale(1.05, 0.8, 1);
    g.translate(s * 0.28 * u, f.standY + 0.16 * u, toe * u);
    return paint(g, color);
  });
}

function legs(f: Frame, d: Detail, style: BodyStyle, p: Palette): BufferGeometry[] {
  const u = f.headR;
  if (style === 'gown') return [];
  if (style === 'robe') return shoes(f, d, p.ink, Math.min(0.95 * u, f.bodyR) / u - 0.25);
  const top = f.hipY - 0.05 * u;
  const foot = f.standY + 0.3 * u;
  const legsOut = [-1, 1].map((s) => {
    // One cap segment: the knees' ends are hidden in the hem and the shoes.
    const g = new CapsuleGeometry(0.17 * u, top - foot, 1, d.limb[1]);
    g.translate(s * 0.27 * u, (top + foot) / 2, 0);
    return paint(g, p.second);
  });
  return [...legsOut, ...shoes(f, d, style === 'armor' ? p.second : p.ink)];
}

/**
 * The bare figure: head, hair, torso by its style, arms and (on foot) legs and shoes, all painted,
 * in piece space. A visor's head is its helmet, painted `second`; armour has gauntlets to match.
 */
export function rigBody(ctx: PartCtx, recipe: ChibiRecipe): PartOut {
  const { frame: f, palette: p } = ctx;
  const d = DETAIL[ctx.quality];
  const mounted = recipe.mounted ?? false;
  const armour = recipe.body === 'armor';
  const t = torso(f, d, recipe.body, mounted, p);
  return {
    body: [
      paint(head(f, d, recipe.hair !== 'none'), recipe.face === 'visor' ? p.second : p.skin),
      ...hair(f, d, recipe.hair, p),
      ...t.parts,
      ...arms(f, d, mounted, t.cuffs, armour ? p.second : p.main, armour ? p.second : p.skin),
      ...(mounted ? [] : legs(f, d, recipe.body, p)),
    ],
  };
}

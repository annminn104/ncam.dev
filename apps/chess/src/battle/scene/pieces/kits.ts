import type { PieceSymbol } from 'chess.js';
import {
  type BufferGeometry,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { onDispose, own } from '../dispose';

// The treasures' geometry, free of React so Node tests can measure it. Every static part is
// baked into place and merged by material, so a treasure is a handful of draw calls, and only
// the parts that move have a transform of their own. Piece space: origin at the base's centre
// on the board, +y up, +z toward the piece's owner (black's treasures are turned round).

/** Top of each treasure at rest, base included: pearl < bell < mirror < cauldron < swords < seal. */
export const TREASURE_HEIGHT: Record<PieceSymbol, number> = {
  p: 0.55,
  n: 0.75,
  b: 0.9,
  r: 1.0,
  q: 1.2,
  k: 1.4,
};

/** Every treasure fits inside this radius of its square's centre. */
export const TREASURE_RADIUS = 0.38;

/** The base's top. */
export const BASE_TOP = 0.08;
/** Where a treasure's body starts: it floats 0.12 clear of its base. Body parts are in body space. */
export const BODY_Y = 0.2;
/**
 * The glyph medallion: on the base's near half, toward the owner, where the body floating above
 * the base's centre cannot hide it from the owner's camera.
 */
export const GLYPH = { radius: 0.11, z: 0.19 } as const;

/** The mirror's face: its centre (body space) and its tilt back, to face the owner's camera. */
export const MIRROR = { y: 0.487, z: -0.07, tilt: -0.3 } as const;
/** The elixir pill's rest height, rising out of the cauldron's mouth below its ears (body space). */
export const CAULDRON_PILL_Y = 0.72;
/** The bell swings from its loop (body space). */
export const BELL_PIVOT_Y = 0.55;
/** The seal's flaming pearl: the pearl's centre (and the halo's plane) and the flame's foot. */
export const SEAL = { pearl: 0.86, flame: 0.9 } as const;

const TAU = Math.PI * 2;

type Kit = Record<string, BufferGeometry>;

/**
 * A treasure's geometry, built on first use (during a render inside the battle's Canvas), shared
 * by every piece of its type and freed with the battle.
 */
function kit<K extends Kit>(build: () => K): () => K {
  let made: K | null = null;
  onDispose(() => {
    made = null;
  });
  return () => {
    if (!made) {
      const parts = build();
      for (const g of Object.values(parts)) own(g);
      made = parts;
    }
    return made;
  };
}

/** A lathe from [radius, height] pairs. Profiles run so their normals face out (see three's LatheGeometry). */
function lathe(
  profile: readonly (readonly [r: number, y: number])[],
  segments = 32,
): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
}

/** One geometry from many: one draw call. The parts are spent. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const ready = parts.map((g) => {
    // ExtrudeGeometry comes unindexed; mergeGeometries wants all parts alike.
    const indexed = g.index ? g : mergeVertices(g);
    for (const name of Object.keys(indexed.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') indexed.deleteAttribute(name);
    }
    return indexed;
  });
  const merged = mergeGeometries(ready);
  if (!merged) throw new Error('treasure parts do not merge');
  return merged;
}

function at<T extends BufferGeometry>(g: T, x: number, y: number, z: number): T {
  g.translate(x, y, z);
  return g;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A flat ring lying in the board's plane. */
function flatRing(radius: number, tube: number, y: number, radial = 6, tubular = 48) {
  const g = new TorusGeometry(radius, tube, radial, tubular);
  g.rotateX(Math.PI / 2);
  return at(g, 0, y, 0);
}

function sphere(radius: number, y: number, width = 24, height = 16) {
  return at(new SphereGeometry(radius, width, height), 0, y, 0);
}

/** A lotus petal in the XY plane: its foot at the origin, its tip up +y, its face toward +z. */
function petal(length: number, width: number, thickness: number): BufferGeometry {
  const w = width / 2;
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 1.25, length * 0.18, w * 1.05, length * 0.72, 0, length);
  s.bezierCurveTo(-w * 1.05, length * 0.72, -w * 1.25, length * 0.18, 0, 0);
  const bevel = thickness * 0.35;
  const depth = thickness - 2 * bevel;
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: Math.min(width, length) * 0.04,
    bevelSegments: 1,
    curveSegments: 5,
  });
  return at(g, 0, 0, -depth / 2);
}

/** `count` petals round the y axis, feet `radius` out at height `y`, leaning out by `lean`. */
function petalRing(
  count: number,
  o: { length: number; width: number; thickness: number; radius: number; y: number; lean: number },
  phase = 0,
): BufferGeometry[] {
  return Array.from({ length: count }, (_, i) => {
    const g = petal(o.length, o.width, o.thickness);
    g.rotateX(o.lean);
    g.translate(0, o.y, o.radius);
    g.rotateY(phase + (i / count) * TAU);
    return g;
  });
}

/**
 * A tube along `curve` whose radius follows `radius(u)`, u running 0..1 from the curve's start
 * to its end. Built at radius 1, then each ring of vertices is scaled about its centre.
 */
function taperedTube(
  curve: CatmullRomCurve3,
  segments: number,
  radial: number,
  radius: (u: number) => number,
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

/** The base every treasure floats over: a jade drum ringed with lotus petals, and the glyph. */
export const baseKit = kit(() => {
  const ring = new TorusGeometry(GLYPH.radius + 0.012, 0.0055, 4, 40);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, BASE_TOP + 0.002, GLYPH.z);
  const glyph = new CircleGeometry(GLYPH.radius, 40);
  // Face up, the texture's top away from the owner, so the owner reads it upright.
  glyph.rotateX(-Math.PI / 2);
  glyph.translate(0, BASE_TOP + 0.001, GLYPH.z);
  return {
    jade: lathe(
      [
        [0, 0],
        [0.326, 0],
        [0.332, 0.008],
        [0.33, 0.05],
        [0.326, 0.066],
        [0.316, 0.076],
        [0.3, BASE_TOP],
        [0, BASE_TOP],
      ],
      40,
    ),
    trim: merge([
      // A gold rim round the top, and lotus petals standing round the drum below it: upright,
      // so their faces mirror the studio's horizon rather than its floor.
      flatRing(0.318, 0.008, 0.073, 5, 56),
      // Their outline's bevel reaches 0.003 below their feet.
      ...petalRing(14, {
        length: 0.072,
        width: 0.092,
        thickness: 0.01,
        radius: 0.336,
        y: 0.004,
        lean: 0,
      }),
      ring,
    ]),
    glyph,
  };
});

/** Pawn: a spirit pearl held in a gold or bronze lotus, a thread of qi circling it. */
export const pearlKit = kit(() => {
  const qi = new TorusGeometry(0.175, 0.0045, 4, 56);
  qi.rotateX(Math.PI / 2 + 0.5);
  qi.rotateZ(0.25);
  qi.translate(0, 0.22, 0);
  return {
    jade: sphere(0.13, 0.22, 28, 18),
    trim: merge([
      ...petalRing(8, {
        length: 0.13,
        width: 0.095,
        thickness: 0.012,
        radius: 0.03,
        y: 0,
        lean: 0.95,
      }),
      ...petalRing(
        8,
        { length: 0.1, width: 0.075, thickness: 0.01, radius: 0.02, y: 0.012, lean: 0.55 },
        TAU / 16,
      ),
    ]),
    qi,
  };
});

/** Knight: a spirit bell, banded and crowned in metal, a qi clapper glowing in its mouth. */
export const bellKit = kit(() => {
  // One closed profile: down the inside from the crown, round the lip, up the outside.
  const jade = lathe(
    [
      [0, 0.33],
      [0.075, 0.322],
      [0.125, 0.292],
      [0.15, 0.23],
      [0.165, 0.15],
      [0.185, 0.07],
      [0.205, 0.018],
      [0.214, 0],
      [0.238, 0.004],
      [0.244, 0.016],
      [0.232, 0.042],
      [0.212, 0.1],
      [0.194, 0.18],
      [0.181, 0.26],
      [0.168, 0.32],
      [0.146, 0.36],
      [0.108, 0.385],
      [0.058, 0.396],
      [0, 0.4],
    ],
    40,
  );
  const crown = lathe(
    [
      [0, 0.392],
      [0.07, 0.39],
      [0.074, 0.405],
      [0.055, 0.42],
      [0.03, 0.428],
      [0, 0.43],
    ],
    24,
  );
  // Hung face-on to the owner; its top is the bell's top.
  const loop = at(new TorusGeometry(0.05, 0.015, 6, 24), 0, BELL_PIVOT_Y - 0.065, 0);
  return {
    jade,
    trim: merge([flatRing(0.237, 0.011, 0.014), flatRing(0.184, 0.007, 0.24, 5), crown, loop]),
    glow: sphere(0.045, 0.018, 16, 12),
  };
});

/** The mirror's face frame: centre, then its tilt back (an Object3D's T·R). */
function mirrorFace(): Matrix4 {
  return new Matrix4().makeRotationX(MIRROR.tilt).setPosition(0, MIRROR.y, MIRROR.z);
}

/** Bishop: a taiji mirror in an octagonal bagua frame, tilted back on a slender stand. */
export const mirrorKit = kit(() => {
  const face = mirrorFace();
  const disc = new CylinderGeometry(0.2, 0.2, 0.03, 48);
  disc.rotateX(Math.PI / 2);
  disc.applyMatrix4(face);
  // Eight tubular segments make the frame an octagon; turned so a flat side is on top.
  const frame = new TorusGeometry(0.215, 0.026, 6, 8);
  frame.rotateZ(Math.PI / 8);
  frame.applyMatrix4(face);
  // A bronze mirror's back, what the other side sees: a shallow dome (a cap of a 0.4 sphere,
  // its rim on the disc's back face at z -0.015) and a knob.
  const capAngle = Math.asin(0.19 / 0.4);
  const dome = new SphereGeometry(0.4, 40, 4, 0, TAU, 0, capAngle);
  dome.rotateX(-Math.PI / 2);
  dome.translate(0, 0, 0.4 * Math.cos(capAngle) - 0.015);
  dome.applyMatrix4(face);
  const knob = at(new SphereGeometry(0.034, 16, 10), 0, 0, -0.068);
  knob.applyMatrix4(face);
  const stand = lathe(
    [
      [0, 0],
      [0.1, 0],
      [0.106, 0.012],
      [0.094, 0.026],
      [0.05, 0.042],
      [0.032, 0.07],
      [0.026, 0.15],
      [0.03, 0.232],
      [0.046, 0.264],
      [0.05, 0.277],
      [0, 0.282],
    ],
    24,
  );
  // The taiji turns in the face's own plane: built at the face frame's origin, just proud of
  // the jade (the disc's front is at z 0.015), and placed by the component with mirrorFace().
  const taiji = at(new CircleGeometry(0.168, 48), 0, 0, 0.0165);
  return { jade: disc, trim: merge([frame, dome, knob, stand]), taiji };
});

/** The ding's bowl is drawn 0.43 tall from 0.155; it stands on its legs 0.05 higher, 10% taller. */
const dingY = (y: number) => 0.205 + (y - 0.155) * 1.1;

/**
 * One of the ding's ears: an arch standing on the lip, its feet buried in it, its top the
 * cauldron's top (body space 0.8). Built in the plane x = 0, spanning z.
 */
function dingEar(): TubeGeometry {
  const arch = new CatmullRomCurve3(
    [
      [-0.06, 0],
      [-0.063, 0.055],
      [-0.052, 0.098],
      [-0.028, 0.114],
      [0, 0.118],
      [0.028, 0.114],
      [0.052, 0.098],
      [0.063, 0.055],
      [0.06, 0],
    ].map(([z, y]) => new Vector3(0, y, z)),
  );
  return at(new TubeGeometry(arch, 24, 0.016, 6), 0, 0.8 - 0.118 - 0.016, 0);
}

/** Rook: a three-legged ding cauldron, its qi pool glowing, an elixir pill rising out of it. */
export const cauldronKit = kit(() => {
  // Out along the underside, up the outside, round the lip, down the inside to the pool's floor.
  const jade = lathe(
    (
      [
        [0, 0.155],
        [0.12, 0.16],
        [0.21, 0.185],
        [0.272, 0.23],
        [0.305, 0.29],
        [0.315, 0.35],
        [0.305, 0.415],
        [0.28, 0.47],
        [0.268, 0.51],
        [0.278, 0.545],
        [0.298, 0.565],
        [0.3, 0.58],
        [0.284, 0.586],
        [0.264, 0.578],
        [0.254, 0.545],
        [0.248, 0.5],
        [0.24, 0.485],
        [0, 0.485],
      ] as const
    ).map(([r, y]) => [r, dingY(y)] as const),
    40,
  );
  const legs = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((a) =>
    at(
      lathe(
        [
          [0, 0],
          [0.032, 0],
          [0.04, 0.014],
          [0.032, 0.036],
          [0.025, 0.1],
          [0.027, 0.16],
          [0.04, 0.205],
          [0.046, 0.23],
          [0.03, 0.25],
          [0, 0.255],
        ],
        12,
      ),
      Math.cos(a) * 0.17,
      0,
      Math.sin(a) * 0.17,
    ),
  );
  // The two ears stand on the lip, left and right, each across the rim.
  const ears = [-1, 1].map((s) => at(dingEar(), s * 0.282, 0, 0));
  const pool = new CircleGeometry(0.248, 40);
  pool.rotateX(-Math.PI / 2);
  pool.translate(0, dingY(0.485) + 0.005, 0);
  return {
    jade,
    trim: merge([
      ...legs,
      ...ears,
      flatRing(0.315, 0.011, dingY(0.35)),
      flatRing(0.274, 0.008, dingY(0.49), 5),
      flatRing(0.29, 0.011, dingY(0.58)),
    ]),
    pool,
    // Placed and bobbed by the component at CAULDRON_PILL_Y, in the ding's mouth.
    pill: new SphereGeometry(0.045, 20, 14),
  };
});

const SWORD_COUNT = 8;
/** The swords' guards: how far out from the axis, and how high (body space). */
const SWORD_RING = 0.11;
const SWORD_FOOT = 0.5;
/** How far each sword leans out from upright, so the ring opens like a crown. */
const SWORD_SPLAY = 0.45;

/** Each sword's place on the ring: lean out, lift to the ring, turn to face out. */
function onSwordRing(g: BufferGeometry, i: number): BufferGeometry {
  g.rotateX(SWORD_SPLAY);
  g.translate(0, SWORD_FOOT, SWORD_RING);
  g.rotateY((i / SWORD_COUNT) * TAU);
  return g;
}

/** Queen: a crown of flying swords circling a jade orb, held up on a gold or bronze stem. */
export const swordsKit = kit(() => {
  const blade = new Shape();
  blade.moveTo(-0.027, 0);
  blade.lineTo(0.027, 0);
  blade.lineTo(0.027, 0.33);
  blade.lineTo(0, 0.4);
  blade.lineTo(-0.027, 0.33);
  blade.closePath();
  const blades = Array.from({ length: SWORD_COUNT }, (_, i) => {
    const g = new ExtrudeGeometry(blade, {
      depth: 0.006,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    return onSwordRing(at(g, 0, 0, -0.003), i);
  });
  // Guard, grip and pommel, and a fuller inlaid down the blade, through both its faces.
  const hilts = Array.from({ length: SWORD_COUNT }, (_, i) =>
    onSwordRing(
      merge([
        at(new BoxGeometry(0.09, 0.016, 0.03), 0, -0.008, 0),
        at(new CylinderGeometry(0.01, 0.011, 0.07, 8), 0, -0.05, 0),
        at(new SphereGeometry(0.015, 10, 8), 0, -0.09, 0),
        at(new BoxGeometry(0.008, 0.27, 0.018), 0, 0.165, 0),
      ]),
      i,
    ),
  );
  const stem = lathe(
    [
      [0, 0],
      [0.1, 0],
      [0.106, 0.012],
      [0.088, 0.028],
      [0.052, 0.05],
      [0.038, 0.1],
      [0.03, 0.3],
      [0.046, 0.33],
      [0.032, 0.36],
      [0.03, 0.5],
      [0.05, 0.56],
      [0.076, 0.6],
      [0.082, 0.62],
      [0, 0.626],
    ],
    24,
  );
  const finial = lathe(
    [
      [0, 0.79],
      [0.03, 0.8],
      [0.022, 0.83],
      [0.011, 0.895],
      [0.022, 0.925],
      [0.011, 0.96],
      [0, 1.0],
    ],
    16,
  );
  return {
    jade: sphere(0.095, 0.71, 28, 18),
    trim: merge([stem, finial]),
    blades: merge(blades),
    hilts: merge(hilts),
    glow: flatRing(SWORD_RING, 0.006, SWORD_FOOT),
  };
});

/**
 * The dragon knob's spine: a coil that winds up and in from its tail on the seal's top, then
 * lifts its head toward the pearl, ending face-on to the owner.
 */
function dragonSpine(): CatmullRomCurve3 {
  const TURNS = 2.1;
  const END = Math.PI / 2; // the coil's last point, toward the owner (+z)
  const points: Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const a = END - TURNS * TAU * (1 - t);
    const r = 0.15 - 0.085 * t;
    points.push(new Vector3(Math.cos(a) * r, 0.44 + 0.2 * t, Math.sin(a) * r));
  }
  points.push(new Vector3(0, 0.7, 0.05), new Vector3(0, 0.755, 0.03));
  return new CatmullRomCurve3(points);
}

/** A gold or bronze frame inlaid round each of the seal block's four sides. */
function sealPanels(): BufferGeometry[] {
  const W = 0.15; // half the frame's width
  const Y0 = 0.07;
  const Y1 = 0.34;
  const T = 0.009; // the inlay's line width
  const FACE = 0.2 + 0.002; // just proud of the block's face
  const lines = [
    [0, Y1, 2 * W + T, T],
    [0, Y0, 2 * W + T, T],
    [-W, (Y0 + Y1) / 2, T, Y1 - Y0],
    [W, (Y0 + Y1) / 2, T, Y1 - Y0],
  ] as const;
  return [0, 1, 2, 3].flatMap((side) =>
    lines.map(([x, y, w, h]) => {
      const g = at(new BoxGeometry(w, h, 0.006), x, y, FACE);
      g.rotateY((side * Math.PI) / 2);
      return g;
    }),
  );
}

/** King: the imperial jade seal, a coiled gold or bronze dragon on it chasing a flaming pearl. */
export const sealKit = kit(() => {
  const spine = dragonSpine();
  // Thin at the tail, full through the coils, a little slimmer at the neck; the head caps it.
  const body = taperedTube(spine, 120, 10, (u) => {
    const tail = smoothstep(0, 0.22, u);
    return 0.007 + 0.024 * tail - 0.005 * smoothstep(0.75, 1, u);
  });
  const head = spine.getPointAt(1);
  return {
    jade: at(new RoundedBoxGeometry(0.4, 0.36, 0.4, 3, 0.035), 0, 0.205, 0),
    trim: merge([
      at(new RoundedBoxGeometry(0.42, 0.025, 0.42, 2, 0.01), 0, 0.0125, 0),
      at(new RoundedBoxGeometry(0.43, 0.03, 0.43, 2, 0.012), 0, 0.4, 0),
      ...sealPanels(),
      body,
      at(new SphereGeometry(0.032, 14, 10), head.x, head.y, head.z),
    ]),
    pearl: sphere(0.06, SEAL.pearl, 24, 16),
    // Flame and halo are placed by the component at SEAL.flame / SEAL.pearl.
    flame: lathe(
      [
        [0, 0],
        [0.04, 0.03],
        [0.05, 0.085],
        [0.042, 0.15],
        [0.024, 0.22],
        [0, 0.3],
      ],
      24,
    ),
    halo: flatRing(0.15, 0.006, 0),
  };
});

export interface RestPart {
  geometry: BufferGeometry;
  /** Where the part sits at rest, in piece space. */
  matrix: Matrix4;
}

const inBody = (dy = 0) => new Matrix4().makeTranslation(0, BODY_Y + dy, 0);

/**
 * A treasure's parts as the components place them, still: the idle float, spins and sways
 * stopped. What the extents test measures; keep it in step with the components.
 */
export function restPose(type: PieceSymbol): RestPart[] {
  const base = baseKit();
  const parts: RestPart[] = [base.jade, base.trim, base.glyph].map((geometry) => ({
    geometry,
    matrix: new Matrix4(),
  }));
  const add = (geometry: BufferGeometry, matrix = inBody()) => parts.push({ geometry, matrix });
  switch (type) {
    case 'p': {
      const k = pearlKit();
      [k.jade, k.trim, k.qi].forEach((g) => add(g));
      break;
    }
    case 'n': {
      const k = bellKit();
      [k.jade, k.trim, k.glow].forEach((g) => add(g));
      break;
    }
    case 'b': {
      const k = mirrorKit();
      [k.jade, k.trim].forEach((g) => add(g));
      add(k.taiji, inBody().multiply(mirrorFace()));
      break;
    }
    case 'r': {
      const k = cauldronKit();
      [k.jade, k.trim, k.pool].forEach((g) => add(g));
      add(k.pill, inBody(CAULDRON_PILL_Y));
      break;
    }
    case 'q': {
      const k = swordsKit();
      [k.jade, k.trim, k.blades, k.hilts, k.glow].forEach((g) => add(g));
      break;
    }
    case 'k': {
      const k = sealKit();
      [k.jade, k.trim, k.pearl].forEach((g) => add(g));
      add(k.flame, inBody(SEAL.flame));
      add(k.halo, inBody(SEAL.pearl));
      break;
    }
  }
  return parts;
}

// Procedural mesh builder. Vertex layout: pos3 nrm3 uv2 col3 mat4(rough, metal, emis, kind + 16·wet) = 15 floats.
// kinds: 0 std · 1 glass · 2 asphalt · 3 sidewalk tile · 4 indoor tile · 5 painted wall · 6 road paint · 7 neon flicker
//        8 foliage · 9 concrete · 11 brushed metal · 12 clear-coat paint
import { R, type UV } from './atlas';
import { hex, M4, rnd, type Mat4, type Vec3 } from './math';

export const VS = 15;

export interface Material {
  c: Vec3;
  r: number;
  m: number;
  e: number;
  k: number;
  w: number;
  t: string;
}
export interface MatOpts {
  r?: number;
  m?: number;
  e?: number;
  k?: number;
  w?: number;
  t?: string;
  c?: string;
}
export function Mat(col: string | Vec3, o: MatOpts = {}): Material {
  return {
    c: typeof col === 'string' ? hex(col) : col,
    r: o.r ?? 0.6,
    m: o.m ?? 0,
    e: o.e ?? 0,
    k: o.k ?? 0,
    w: o.w ?? 0,
    t: o.t || 'white',
  };
}
/** textured material (atlas entry), optionally emissive */
export const tex = (t: string, e = 0, o: MatOpts = {}): Material =>
  Mat(o.c || '#ffffff', { t, e, r: o.r ?? 0.4, m: o.m ?? 0, k: o.k ?? 0, w: o.w ?? 0 });

type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
/** per-face override: atlas name, explicit UV rect, or false to skip the face */
export type BoxFaces = Partial<Record<Face, string | UV | false>>;
export interface CylOpts {
  r2?: number;
  caps?: boolean | 'top';
  capTex?: string;
}
export interface PackedMesh {
  v: Float32Array;
  i: Uint32Array;
}
type P2 = number[];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export class Mesh {
  v: number[] = [];
  i: number[] = [];
  private st: Mat4[] = [M4.ident()];

  get M(): Mat4 {
    return this.st[this.st.length - 1];
  }
  push(m: Mat4): this {
    this.st.push(M4.mul(this.M, m));
    return this;
  }
  pop(): this {
    this.st.pop();
    return this;
  }
  /** run fn with a translate (+ optional Y rotation) applied */
  at(x: number, y: number, z: number, ry: number, fn: () => void): void {
    this.push(ry ? M4.mul(M4.trans(x, y, z), M4.rotY(ry)) : M4.trans(x, y, z));
    fn();
    this.pop();
  }
  vert(p: Vec3, n: Vec3, u: number, v: number, mt: Material): number {
    const P = M4.xf(this.M, p),
      N = M4.xn(this.M, n);
    this.v.push(
      P[0],
      P[1],
      P[2],
      N[0],
      N[1],
      N[2],
      u,
      v,
      mt.c[0],
      mt.c[1],
      mt.c[2],
      mt.r,
      mt.m,
      mt.e,
      mt.k + (mt.w ? 16 : 0),
    );
    return this.v.length / VS - 1;
  }
  /** a, b, c, d counter-clockwise seen from the front; a = bottom-left */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, mt: Material, uvr?: UV | null): void {
    const e1 = sub(b, a),
      e2 = sub(d, a);
    let n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / l);
    const r = uvr || R[mt.t] || R.white;
    const i0 = this.vert(a, n, r[0], r[3], mt);
    this.vert(b, n, r[2], r[3], mt);
    this.vert(c, n, r[2], r[1], mt);
    this.vert(d, n, r[0], r[1], mt);
    this.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    mt: Material,
    f: BoxFaces = {},
  ): void {
    const q = (k: Face, a: Vec3, b: Vec3, c: Vec3, d: Vec3) => {
      const o = f[k];
      if (o === false) return;
      this.quad(a, b, c, d, mt, Array.isArray(o) ? o : o ? R[o] : null);
    };
    q('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    q('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    q('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    q('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    q('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    q('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  }
  cbox(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mt: Material,
    f?: BoxFaces,
  ): void {
    this.box(cx - w / 2, cy - h / 2, cz - d / 2, cx + w / 2, cy + h / 2, cz + d / 2, mt, f);
  }
  /** cylinder / cone along +y from the local origin; capTex maps a disc onto the caps */
  cyl(r: number, h: number, seg: number, mt: Material, o: CylOpts = {}): void {
    const r2 = o.r2 ?? r,
      W = R.white,
      i0 = this.v.length / VS,
      sl = Math.atan2(r - r2, h);
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2,
        c = Math.cos(a),
        sn = Math.sin(a),
        n = [c * Math.cos(sl), Math.sin(sl), sn * Math.cos(sl)];
      this.vert([c * r, 0, sn * r], n, W[0], W[1], mt);
      this.vert([c * r2, h, sn * r2], n, W[0], W[1], mt);
    }
    for (let s = 0; s < seg; s++) {
      const a = i0 + s * 2;
      this.i.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (o.caps === false) return;
    for (const top of [0, 1]) {
      if (o.caps === 'top' && !top) continue;
      const y = top ? h : 0,
        rr = top ? r2 : r,
        n = [0, top ? 1 : -1, 0],
        t = R[o.capTex || mt.t] || W;
      const cu = (t[0] + t[2]) / 2,
        cv = (t[1] + t[3]) / 2,
        hu = (t[2] - t[0]) / 2,
        hv = (t[3] - t[1]) / 2,
        c0 = this.vert([0, y, 0], n, cu, cv, mt);
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        this.vert(
          [Math.cos(a) * rr, y, Math.sin(a) * rr],
          n,
          cu + Math.cos(a) * hu * (top ? 1 : -1),
          cv - Math.sin(a) * hv,
          mt,
        );
      }
      for (let s = 0; s < seg; s++) {
        if (top) this.i.push(c0, c0 + 2 + s, c0 + 1 + s);
        else this.i.push(c0, c0 + 1 + s, c0 + 2 + s);
      }
    }
  }
  sphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    seg: number,
    mt: Material,
    jit = 0,
  ): void {
    const i0 = this.v.length / VS,
      W = R.white,
      rows = Math.max(3, seg >> 1);
    for (let y = 0; y <= rows; y++) {
      const th = (y / rows) * Math.PI;
      for (let x = 0; x <= seg; x++) {
        const ph = (x / seg) * Math.PI * 2,
          nx = Math.sin(th) * Math.cos(ph),
          ny = Math.cos(th),
          nz = Math.sin(th) * Math.sin(ph);
        const j = jit ? 1 + (rnd() - 0.5) * jit : 1,
          n = [nx / rx, ny / ry, nz / rz],
          l = Math.hypot(n[0], n[1], n[2]);
        this.vert(
          [cx + nx * rx * j, cy + ny * ry * j, cz + nz * rz * j],
          [n[0] / l, n[1] / l, n[2] / l],
          W[0],
          W[1],
          mt,
        );
      }
    }
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < seg; x++) {
        const a = i0 + y * (seg + 1) + x,
          b = a + seg + 1;
        this.i.push(a, a + 1, b + 1, a, b + 1, b);
      }
  }
  /** (tapered) rod between two points — cables, rails, limbs */
  rod(p: Vec3, q: Vec3, r: number, mt: Material, sides = 4, r2 = r): void {
    const d = sub(q, p),
      L = Math.hypot(d[0], d[1], d[2]);
    if (L < 1e-5) return;
    const f = d.map((x) => x / L);
    let u = Math.abs(f[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
    let s = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    const l = Math.hypot(s[0], s[1], s[2]);
    s = s.map((x) => x / l);
    u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const i0 = this.v.length / VS,
      W = R.white;
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2,
        c = Math.cos(a),
        sn = Math.sin(a),
        n = [s[0] * c + u[0] * sn, s[1] * c + u[1] * sn, s[2] * c + u[2] * sn];
      this.vert([p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r], n, W[0], W[1], mt);
      this.vert([q[0] + n[0] * r2, q[1] + n[1] * r2, q[2] + n[2] * r2], n, W[0], W[1], mt);
    }
    for (let k = 0; k < sides; k++) {
      const a = i0 + k * 2;
      this.i.push(a, a + 2, a + 3, a, a + 3, a + 1);
    }
  }
  /** tapered limb with rounded ends */
  capsule(p: Vec3, q: Vec3, r: number, mt: Material, sides = 10, r2 = r): void {
    this.rod(p, q, r, mt, sides, r2);
    this.sphere(p[0], p[1], p[2], r, r, r, sides, mt);
    this.sphere(q[0], q[1], q[2], r2, r2, r2, sides, mt);
  }
  /** smooth skin through closed rings of equal length; normals from neighbours, flipped outward from each ring centre */
  loft(rings: Vec3[][], mt: Material, o: { caps?: boolean } = {}): void {
    const nr = rings.length,
      np = rings[0].length,
      i0 = this.v.length / VS,
      W = R.white;
    const cen = rings.map((r) =>
      r.reduce((s, p) => [s[0] + p[0] / np, s[1] + p[1] / np, s[2] + p[2] / np], [0, 0, 0]),
    );
    for (let a = 0; a < nr; a++)
      for (let b = 0; b <= np; b++) {
        const B = b % np,
          p = rings[a][B],
          t1 = sub(rings[Math.min(a + 1, nr - 1)][B], rings[Math.max(a - 1, 0)][B]),
          t2 = sub(rings[a][(B + 1) % np], rings[a][(B - 1 + np) % np]);
        let n = [
          t1[1] * t2[2] - t1[2] * t2[1],
          t1[2] * t2[0] - t1[0] * t2[2],
          t1[0] * t2[1] - t1[1] * t2[0],
        ];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        n = n.map((x) => x / l);
        const out = sub(p, cen[a]);
        if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x);
        this.vert(p, n, W[0], W[1], mt);
      }
    for (let a = 0; a < nr - 1; a++)
      for (let b = 0; b < np; b++) {
        const k = i0 + a * (np + 1) + b,
          k2 = k + np + 1;
        this.i.push(k, k + 1, k2 + 1, k, k2 + 1, k2);
      }
    if (!o.caps) return;
    for (const a of [0, nr - 1]) {
      const c = cen[a],
        nx = sub(cen[a === 0 ? 0 : nr - 1], cen[a === 0 ? 1 : nr - 2]),
        l = Math.hypot(nx[0], nx[1], nx[2]) || 1,
        n = nx.map((x) => x / l),
        c0 = this.vert(c, n, W[0], W[1], mt);
      for (let b = 0; b <= np; b++) this.vert(rings[a][b % np], n, W[0], W[1], mt);
      for (let b = 0; b < np; b++) this.i.push(c0, c0 + 1 + b, c0 + 2 + b);
    }
  }
  /** hanging cable with a parabolic sag */
  cable(p: Vec3, q: Vec3, sag: number, r: number, mt: Material, segs = 14): void {
    let prev = p;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs,
        c = [
          p[0] + (q[0] - p[0]) * t,
          p[1] + (q[1] - p[1]) * t - sag * 4 * t * (1 - t),
          p[2] + (q[2] - p[2]) * t,
        ];
      this.rod(prev, c, r, mt, 3);
      prev = c;
    }
  }
  /** convex side profile [[x,y],...] (CCW seen from +z) extruded between z0..z1 */
  prism(pts: P2[], z0: number, z1: number, mt: Material, capMt?: Material): void {
    const n = pts.length,
      W = R.white;
    for (const [z, s] of [
      [z1, 1],
      [z0, -1],
    ]) {
      const nn = [0, 0, s],
        c = capMt || mt,
        i0 = this.v.length / VS;
      for (const p of pts) this.vert([p[0], p[1], z], nn, W[0], W[1], c);
      for (let k = 1; k < n - 1; k++) {
        if (s > 0) this.i.push(i0, i0 + k, i0 + k + 1);
        else this.i.push(i0, i0 + k + 1, i0 + k);
      }
    }
    for (let k = 0; k < n; k++) {
      const a = pts[k],
        b = pts[(k + 1) % n];
      this.quad([a[0], a[1], z1], [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], mt);
    }
  }
  /** rounded-ish extrusion: full profile in the middle + shrunk profile on the outer edges */
  bprism(pts: P2[], w: number, b: number, mt: Material, cx = 0): void {
    const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
    const sh = pts.map((p) => [
      c[0] + (p[0] - c[0]) * (1 - b * 1.6),
      c[1] + (p[1] - c[1]) * (1 - b * 2.2),
    ]);
    this.prism(pts, cx - w / 2 + b, cx + w / 2 - b, mt);
    this.prism(sh, cx - w / 2, cx + w / 2, mt);
  }
  pack(): PackedMesh {
    return { v: new Float32Array(this.v), i: new Uint32Array(this.i) };
  }
}

// ---- decals (flat textured quads) ----
export const decalZ = (
  M: Mesh,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  mt: Material,
) => M.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], mt);
export const decalZn = (
  M: Mesh,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  mt: Material,
) => M.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], mt);
/** +x facing when z0 > z1 */
export const decalX = (
  M: Mesh,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  x: number,
  mt: Material,
) => M.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], mt);
/** -x facing when z0 < z1 */
export const decalXn = decalX;

// ---- ring generators for lofts ----
/** horizontal ellipse ring (torso sections) */
export function ringY(cx: number, y: number, cz: number, rx: number, rz: number, n = 20): Vec3[] {
  const r: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    r.push([cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]);
  }
  return r;
}
/** section at x: superellipse in the z-y plane, rounder on top, tumblehome via wt */
export function ringX(
  x: number,
  w: number,
  y0: number,
  y1: number,
  o: { et?: number; eb?: number; wt?: number } = {},
  n = 28,
): Vec3[] {
  const et = o.et ?? 3,
    eb = o.eb ?? 7,
    wt = o.wt ?? 0.92,
    h = (y1 - y0) / 2,
    yc = (y0 + y1) / 2,
    r: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a),
      e = s > 0 ? et : eb,
      ww = w * (s > 0 ? 1 - (1 - wt) * s : 1);
    r.push([
      x,
      yc + h * Math.sign(s) * Math.abs(s) ** (2 / e),
      ww * Math.sign(c) * Math.abs(c) ** (2 / e),
    ]);
  }
  return r;
}
function crSpline(P: P2[], steps: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(i - 1, 0)],
      p1 = P[i],
      p2 = P[i + 1],
      p3 = P[Math.min(i + 2, P.length - 1)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps,
        t2 = t * t,
        t3 = t2 * t;
      out.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * p1[k] +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
              (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
        ),
      );
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
/** automotive cross-section at x: flat-ish bottom, bulging side, rounded shoulder, tumblehome to deck width wt, crowned top */
export function carRing(
  x: number,
  w: number,
  y0: number,
  y1: number,
  wt: number,
  crown = 0.03,
  bulge = 0.5,
): Vec3[] {
  const h = y1 - y0,
    P = [
      [0, y0],
      [w * 0.9, y0],
      [w, y0 + Math.min(0.08, h * 0.2)],
      [w, y0 + h * bulge],
      [w * 0.985, y1 - h * 0.22],
      [wt + (w - wt) * 0.35, y1 - h * 0.05],
      [wt, y1],
      [wt * 0.5, y1 + crown * 0.8],
      [0, y1 + crown],
    ];
  const half = crSpline(P, 3),
    ring: Vec3[] = half.map((p) => [x, p[1], p[0]]);
  for (let i = half.length - 2; i > 0; i--) ring.push([x, half[i][1], -half[i][0]]);
  return ring;
}
/** UV rect of one cell of the 8×8 product-label grid */
export function labelUV(i: number, j: number): UV {
  const r = R.labels,
    du = (r[2] - r[0]) / 8,
    dv = (r[3] - r[1]) / 8;
  return [
    r[0] + i * du + du * 0.04,
    r[1] + j * dv + dv * 0.04,
    r[0] + (i + 1) * du - du * 0.04,
    r[1] + (j + 1) * dv - dv * 0.04,
  ];
}

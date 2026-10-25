// Column-major 4x4 matrices, tiny vector helpers and a seeded RNG for the procedural content.
export type Mat4 = Float32Array;
/** [x, y, z] — kept as a plain array so literals stay terse */
export type Vec3 = number[];

export const M4 = {
  ident(): Mat4 {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  mul(a: Mat4, b: Mat4): Mat4 {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  },
  persp(fy: number, asp: number, n: number, f: number): Mat4 {
    const t = 1 / Math.tan(fy / 2),
      nf = 1 / (n - f),
      m = new Float32Array(16);
    m[0] = t / asp;
    m[5] = t;
    m[10] = (f + n) * nf;
    m[11] = -1;
    m[14] = 2 * f * n * nf;
    return m;
  },
  lookAt(e: Vec3, c: Vec3, u: Vec3): Mat4 {
    let zx = e[0] - c[0],
      zy = e[1] - c[1],
      zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz);
    zx /= l;
    zy /= l;
    zz /= l;
    let xx = u[1] * zz - u[2] * zy,
      xy = u[2] * zx - u[0] * zz,
      xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz);
    xx /= l;
    xy /= l;
    xz /= l;
    const yx = zy * xz - zz * xy,
      yy = zz * xx - zx * xz,
      yz = zx * xy - zy * xx;
    return new Float32Array([
      xx,
      yx,
      zx,
      0,
      xy,
      yy,
      zy,
      0,
      xz,
      yz,
      zz,
      0,
      -(xx * e[0] + xy * e[1] + xz * e[2]),
      -(yx * e[0] + yy * e[1] + yz * e[2]),
      -(zx * e[0] + zy * e[1] + zz * e[2]),
      1,
    ]);
  },
  inv(a: Mat4): Mat4 {
    const o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4],
      b01 = a[0] * a[6] - a[2] * a[4],
      b02 = a[0] * a[7] - a[3] * a[4],
      b03 = a[1] * a[6] - a[2] * a[5],
      b04 = a[1] * a[7] - a[3] * a[5],
      b05 = a[2] * a[7] - a[3] * a[6],
      b06 = a[8] * a[13] - a[9] * a[12],
      b07 = a[8] * a[14] - a[10] * a[12],
      b08 = a[8] * a[15] - a[11] * a[12],
      b09 = a[9] * a[14] - a[10] * a[13],
      b10 = a[9] * a[15] - a[11] * a[13],
      b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!d) return M4.ident();
    d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d;
    o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d;
    o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d;
    o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d;
    o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d;
    o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d;
    o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d;
    o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d;
    o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
  trans(x: number, y: number, z: number): Mat4 {
    const m = M4.ident();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  },
  rotY(a: number): Mat4 {
    const m = M4.ident(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[0] = c;
    m[2] = -s;
    m[8] = s;
    m[10] = c;
    return m;
  },
  rotX(a: number): Mat4 {
    const m = M4.ident(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[5] = c;
    m[6] = s;
    m[9] = -s;
    m[10] = c;
    return m;
  },
  rotZ(a: number): Mat4 {
    const m = M4.ident(),
      c = Math.cos(a),
      s = Math.sin(a);
    m[0] = c;
    m[1] = s;
    m[4] = -s;
    m[5] = c;
    return m;
  },
  scale(x: number, y: number, z: number): Mat4 {
    const m = M4.ident();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
  },
  /** mirror about the plane y = h */
  mirrorY(h: number): Mat4 {
    const m = M4.ident();
    m[5] = -1;
    m[13] = 2 * h;
    return m;
  },
  xf(m: Mat4, p: Vec3): Vec3 {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  },
  xn(m: Mat4, n: Vec3): Vec3 {
    const x = m[0] * n[0] + m[4] * n[1] + m[8] * n[2],
      y = m[1] * n[0] + m[5] * n[1] + m[9] * n[2],
      z = m[2] * n[0] + m[6] * n[1] + m[10] * n[2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  },
};

// ---- seeded RNG (Park–Miller); scene parts reseed so layout stays deterministic ----
let rs = 11;
export const seed = (n: number): void => {
  rs = n;
};
export function rnd(): number {
  rs = (rs * 16807) % 2147483647;
  return (rs - 1) / 2147483646;
}
export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(rnd() * a.length)];
}
/** '#rrggbb' → linear RGB (gamma 2.2), optionally scaled */
export function hex(h: string, k = 1): Vec3 {
  const n = parseInt(h.slice(1), 16);
  return [
    ((n >> 16) / 255) ** 2.2 * k,
    (((n >> 8) & 255) / 255) ** 2.2 * k,
    ((n & 255) / 255) ** 2.2 * k,
  ];
}
export const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

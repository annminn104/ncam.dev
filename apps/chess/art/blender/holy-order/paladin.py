# Paladin on a small barded horse (Knight). exec kit.py, patriarch.py, warden.py, then this; call build_n().
# The rider is built at the king's scale, shrunk onto the saddle; the horse is built in place.
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'N_'
COLL = 'Paladin'
POSE = {'head_roll': 4.0, 'head_pitch': -4.0, 'cape_flare': 0.0}
SCALE = 0.88
RIDER_S = 0.62
RIDER_T = Vector((0.0, 0.03, 0.27))
CAP_SLOT = ['second'] * 5 + ['trim', 'second', 'trim', 'trim', 'trim'] + ['second'] * 5 + ['second']
ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.17, -0.075, 0.835)), 'L': ((0.12, 0.0, 0.675), (0.07, -0.17, 0.575))}
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'Helm', 'HelmBand', 'HelmGems', 'Plume', 'HelmWings', 'LinesHair',
                 'LinesHelm']
GRIP = Vector((-0.182, -0.083, 0.875))


def rider_to_horse(p):
    piv = Vector((0, 0, 0.08))
    return piv + (Vector(p) - piv) * RIDER_S + RIDER_T


# ------------------------------------------------------------------ rider (king scale)
def build_rider():
    build_mantle()
    build_pauldrons()
    bm = new_bm()
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        lathe(bm, [(r, z * L) for r, z in ARM_PROF], 28, lambda i, j: ARM_SLOT[j], xform=M)
    out(PFX + 'Arms', bm, MID, sharp=40)
    # gauntlets: right fist round the sword's grip, left fist on the reins
    bm = new_bm()
    S = Vector((GRIP.x, GRIP.y, 0.0))
    ellipsoid(bm, GRIP + Vector((0.016, 0.004, -0.004)), (0.022, 0.026, 0.031), 'second', segs=16, rings=10)
    for k in range(4):
        z = GRIP.z + 0.018 - 0.0125 * k
        rf = 0.0085 + 0.0075
        pts = [S + Vector((rf * math.cos(math.radians(a)), rf * math.sin(math.radians(a)), z)) for a in (-15, -60, -105, -150, -200)]
        tube(bm, pts, 0.0075, 'second', n=10, k=8)
        ellipsoid(bm, pts[-1], (0.007,) * 3, 'second', segs=8, rings=6)
    LF = Vector((0.062, -0.188, 0.565))
    ellipsoid(bm, LF, (0.025, 0.027, 0.028), 'second', segs=14, rings=10)
    for k in range(4):
        ellipsoid(bm, LF + Vector((-0.014 + 0.009 * k, -0.022, -0.006)), (0.0065, 0.008, 0.009), 'second', segs=8, rings=6)
    out(PFX + 'Gauntlets', bm, SMALL, sharp=55)
    # the holy sword, raised
    bm = new_bm()
    M = Matrix.Translation((GRIP.x, GRIP.y, 0))
    lathe(bm, [(0.0, 0.83), (0.0085, 0.83), (0.0085, 0.925), (0.0, 0.925)], 12, 'leather', xform=M)
    out(PFX + 'SwordGrip', bm, SMALL, sharp=50)
    bm = new_bm()
    ellipsoid(bm, (GRIP.x, GRIP.y, 0.822), (0.014, 0.014, 0.014), 'trim', segs=12, rings=8)
    G = Matrix.Translation((GRIP.x, GRIP.y, 0.935))
    slab(bm, [(-0.085, 0.0), (-0.06, -0.014), (0.0, -0.01), (0.06, -0.014), (0.085, 0.0), (0.06, 0.014), (0.0, 0.02),
              (-0.06, 0.014)], G, 0.016, bevel=0.003, seg=2)
    for sgn in (-1, 1):
        slab(bm, leaf(0.065, 0.015, -sgn * 0.3, n=8), G @ Matrix.Translation((sgn * 0.068, 0, 0.004)) @
             Matrix.Rotation(sgn * math.radians(55), 4, 'Y'), 0.006, bevel=0.0012, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'SwordGuard', bm, MID, sharp=30)
    bm = new_bm()
    blade = [(-0.027, 0.0), (0.027, 0.0), (0.025, 0.43), (0.0, 0.52), (-0.025, 0.43)]
    slab(bm, blade, Matrix.Translation((GRIP.x, GRIP.y, 0.945)), 0.008, bevel=0.0028, seg=2)
    set_slot(bm, bm.faces, 'second')
    out(PFX + 'Blade', bm, MID, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation((GRIP.x, GRIP.y - 0.009, 0.937)), 0.012, 0.015, 0.015, 0.008)
    out(PFX + 'SwordGem', bm, SMALL, smooth=False)
    bm = new_bm()
    for side in (-1, 1):
        flat_line(bm, Matrix.Translation((GRIP.x, GRIP.y, 0.945)), [(0.0, 0.03), (0.0, 0.24), (0.0, 0.42)], side, 0.004,
                  'glow', half=0.004, n=20, lift=0.0004)
    out(PFX + 'BladeGlow', bm, 0, sharp=80, recalc=False)
    # tabard skirt over the saddle, a short cape
    bm = new_bm()
    lathe(bm, [(0.17, 0.6), (0.185, 0.56), (0.205, 0.48), (0.215, 0.43), (0.21, 0.42), (0.196, 0.42), (0.19, 0.48),
               (0.172, 0.56), (0.158, 0.6)], 56,
          lambda i, j: 'trim' if j in (3, 4) else ('accent' if j == 2 else 'main'), sy=SY, wrap=True,
          rmod=lambda r, z, a, j: r + (0.008 * math.cos(8 * a) if z < 0.5 else 0.0))
    out(PFX + 'Tabard', bm, MID, sharp=45)
    rb = bvh_of(O(PFX + 'Tabard'))
    bm = new_bm()
    decal_poly(bm, rb, [(x, 0.5 + z) for x, z in cross_poly(0.008, 0.04, 0.05, 0.034, flare=0.014, fl=0.012)], FR, 0.004,
               'coat', center=(0, 0.5), rings=3)
    out(PFX + 'TabardCross', bm, 0, sharp=80, recalc=False)

    def cape_n(i, j, nu=30, nv=14):
        th = math.radians(-2 + 184 * i / nu)
        v = j / nv
        z = 0.665 - (0.665 - 0.36) * v
        r = 0.168 + 0.1 * v ** 0.85 + 0.012 * v ** 1.3 * math.cos(6 * (th - math.pi / 2))
        return Vector((r * math.cos(th), r * math.sin(th) * 0.95 + 0.16 * v * v, z + 0.04 * v * v))
    bm = new_bm()
    sheet(bm, cape_n, 30, 14, 0.01, lambda i, j: 'trim' if j >= 13 or i <= 1 or i >= 28 else 'coat', 'accent', 'trim',
          outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Cape', bm, BIG, sharp=60)
    build_head()
    build_helm()
    build_brows_r()


def build_rider_lines():
    K = 1.5
    bm = new_bm()
    for s, k, A, C0, R, alpha in pauldron_frames():
        al = math.radians(alpha)
        Rm = axis_to(A).to_3x3()
        U, V = Rm @ Vector((1, 0, 0)), Rm @ Vector((0, 1, 0))
        pts = []
        for q in range(73):
            ph = 2 * math.pi * q / 72
            d = A * math.cos(0.6 * al) + (U * math.cos(ph) + V * math.sin(ph)) * math.sin(0.6 * al)
            pts.append((C0 + d * R, d))
        strip(bm, [p for p, _ in pts], [d for _, d in pts], [0.0019 * K] * 73, 'lgold', 0.0012)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()

    def strand_lines(pts, width, thick, center, n, prof, offs):
        F = strand_frames(pts, center, n)
        for so in offs:
            P, N = [], []
            for i in range(1, n - 1):
                c, t, sd, nr = F[i]
                f = prof(i / n)
                P.append(c + nr * (thick * f * math.sqrt(max(0.0, 1 - so * so))) + sd * (width * f * so))
                N.append(nr)
            strip(bm, P, N, widths(len(P), 0.0013, 'both'), 'lhair', 0.0011)
    for phi, tip, w in BANGS:
        strand_lines(bang_pts(phi, tip + 6), w, 0.009, HC, 12, bang_prof, (0.0,))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for el in (40, 60):
        P = [helm_pt(-150 + 300 * q / 120, el, 0.0072) for q in range(121)]
        strip(bm, P, [(p - HC).normalized() for p in P], [0.0013 * K] * 121, 'lgold', 0.0004)
    out(PFX + 'LinesHelm', bm, 0, sharp=80, recalc=False)


def move_rider(names):
    for n in names:
        ob = O(n)
        me = ob.data
        for v in me.vertices:
            v.co = rider_to_horse(v.co)
        me.update()
        md = ob.modifiers.get('Outline')
        if md is not None:
            md.thickness *= 0.72


# ------------------------------------------------------------------ horse (in place)
BODY_C = Vector((0.0, 0.05, 0.4))


def bard_P(i, j, NU=26, NV=26):
    u, v = i / NU, j / NV
    y = -0.2 + 0.5 * u
    hem = 0.2 + 0.024 * max(0.0, math.sin(9 * math.pi * u)) ** 0.7 + 0.03 * (2 * u - 1) ** 4
    zc, rx, rz = 0.4, 0.168, 0.152
    if v < 0.3:
        t = v / 0.3
        x, z = -(rx + 0.022 * (1 - t) ** 1.5), hem + (zc - hem) * t
    elif v > 0.7:
        t = (1 - v) / 0.3
        x, z = rx + 0.022 * (1 - t) ** 1.5, hem + (zc - hem) * t
    else:
        a = math.pi * (v - 0.3) / 0.4
        x, z = -rx * math.cos(a), zc + rz * math.sin(a)
    return Vector((x, y, z))


def build_horse():
    bm = new_bm()
    ellipsoid(bm, BODY_C, (0.14, 0.24, 0.13), 'main', segs=32, rings=20)
    tube(bm, [Vector((0, -0.13, 0.44)), Vector((0, -0.2, 0.53)), Vector((0, -0.25, 0.61))], 0.07, 'main', n=10, k=16,
         radius=lambda t: 0.078 - 0.022 * t)
    R = Euler((math.radians(-28), 0, 0)).to_matrix()
    ellipsoid(bm, (0, -0.3, 0.665), (0.064, 0.115, 0.072), 'main', segs=24, rings=16, rot=R)
    for sx in (-1, 1):
        lathe(bm, [(0.0, 0.0), (0.016, 0.0), (0.012, 0.03), (0.0, 0.052)], 10, 'main',
              xform=Matrix.Translation((sx * 0.034, -0.262, 0.728)) @ Matrix.Rotation(sx * math.radians(-18), 4, 'Y'))
    out(PFX + 'Horse', bm, BIG, sharp=70)
    bm = new_bm()
    ellipsoid(bm, (0, -0.392, 0.618), (0.056, 0.062, 0.052), 'second', segs=20, rings=12)
    for sx in (-1, 1):
        ellipsoid(bm, (sx * 0.022, -0.448, 0.624), (0.009, 0.006, 0.006), 'ink', segs=8, rings=6)
    out(PFX + 'Muzzle', bm, MID, sharp=60)
    # legs with gold hooves
    bm, bh = new_bm(), new_bm()
    for x, y in ((-0.068, -0.12), (0.068, -0.12), (-0.068, 0.2), (0.068, 0.2)):
        M = Matrix.Translation((x, y, 0.0))
        lathe(bm, [(0.0, 0.105), (0.03, 0.105), (0.027, 0.14), (0.031, 0.2), (0.036, 0.26), (0.045, 0.32), (0.0, 0.33)], 16,
              'main', xform=M)
        lathe(bh, [(0.0, 0.08), (0.036, 0.08), (0.036, 0.095), (0.031, 0.108), (0.0, 0.11)], 16, 'trim', xform=M)
        lathe(bh, [(0.032, 0.108), (0.04, 0.115), (0.038, 0.126), (0.03, 0.13)], 16, 'white', xform=M, wrap=True,
              rmod=lambda r, z, a, j: r + (0.004 * max(0.0, math.cos(8 * a)) if j in (1, 2) else 0.0))
    out(PFX + 'Legs', bm, MID, sharp=60)
    out(PFX + 'Hooves', bh, SMALL, sharp=50)
    # mane, forelock, tail
    bm = new_bm()
    neck = [Vector((0, -0.26, 0.69)), Vector((0, -0.22, 0.64)), Vector((0, -0.18, 0.57)), Vector((0, -0.14, 0.52))]
    for k, root in enumerate(neck):
        for sx in (-1, 1):
            pts = [root + Vector((0, 0, 0.02)), root + Vector((sx * 0.03, 0.02, 0.01)), root + Vector((sx * 0.06, 0.04, -0.04))]
            strand(bm, pts, 0.022, 0.009, 'hair', lambda c: Vector((0, c.y, c.z - 0.2)), n=8, k=8)
    for sx in (-0.012, 0.012):
        strand(bm, [Vector((sx, -0.27, 0.735)), Vector((sx * 2, -0.33, 0.735)), Vector((sx * 3, -0.37, 0.7))], 0.02, 0.008,
               'hair', lambda c: Vector((0, -0.3, 0.6)), n=8, k=8)
    for k in range(5):
        dx = (k - 2) * 0.016
        strand(bm, [Vector((dx * 0.5, 0.27, 0.47)), Vector((dx, 0.33, 0.44)), Vector((dx * 1.4, 0.37, 0.33)),
                    Vector((dx * 1.6, 0.36, 0.2 + 0.02 * abs(k - 2)))], 0.024, 0.01, 'hair',
               lambda c: Vector((0, 0.2, c.z)), n=12, k=8)
    out(PFX + 'Mane', bm, MID, sharp=60)
    # barding: navy blanket with gold edges and dagged hem, a cross on each flank
    bm = new_bm()
    NU, NV = 26, 26
    sheet(bm, bard_P, NU, NV, 0.008,
          lambda i, j: 'trim' if j <= 1 or j >= NV - 2 or i <= 0 or i >= NU - 1 else ('accent' if j in (2, NV - 3) else 'coat'),
          'accent', 'trim', outward=lambda p: Vector((p.x, 0, p.z - 0.4)))
    out(PFX + 'Barding', bm, BIG, sharp=55)
    bb = bvh_of(O(PFX + 'Barding'))
    bm = new_bm()
    for s in (-1, 1):
        frame = (Vector((0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), Vector((-s, 0, 0)))
        decal_poly(bm, bb, [(0.05 + x, 0.32 + z) for x, z in cross_poly(0.01, 0.05, 0.065, 0.045, flare=0.018, fl=0.016)],
                   frame, 0.003, 'trim', center=(0.05, 0.32), rings=4)
        decal_poly(bm, bb, ellipse(0.05, 0.32, 0.009, 0.009, 12), frame, 0.0045, 'gem', rings=1)
    out(PFX + 'BardCross', bm, 0, sharp=80, recalc=False)
    # saddle, peytral, chamfron, bridle and reins
    bm = new_bm()
    ellipsoid(bm, (0, 0.03, 0.555), (0.1, 0.13, 0.03), 'leather', segs=24, rings=12)
    out(PFX + 'Saddle', bm, MID, sharp=55)
    bm, bg = new_bm(), new_bm()
    ellipsoid(bm, (0, -0.075, 0.585), (0.04, 0.02, 0.03), 'trim', segs=14, rings=8)
    ellipsoid(bm, (0, 0.15, 0.585), (0.07, 0.022, 0.035), 'trim', segs=16, rings=8)
    hb = bvh_of(O(PFX + 'Horse'))
    pey = []
    for k in range(17):
        a = math.radians(-70 + 140 * k / 16)
        o = BODY_C + Vector((0.4 * math.sin(a), -0.4 * math.cos(a) * 0.9, 0.035))
        loc, nrm, _, _ = hb.ray_cast(o, (BODY_C + Vector((0, 0, 0.035)) - o).normalized())
        if loc is not None:
            pey.append(loc + nrm * 0.006)
    tube(bm, pey, 0.0085, 'trim', n=40, k=8)
    medal = pey[len(pey) // 2] + Vector((0, -0.006, -0.012))
    lathe(bm, [(0.0, 0.0), (0.024, 0.0), (0.027, 0.004), (0.024, 0.008), (0.0, 0.0085)], 20, 'trim',
          xform=Matrix.Translation(medal) @ axis_to((0, -1, 0)))
    gem_cut(bg, Matrix.Translation(medal + Vector((0, -0.01, 0))), 0.013, 0.016, 0.016, 0.009)
    Rh = Euler((math.radians(-28), 0, 0)).to_matrix()
    HC2 = Vector((0, -0.3, 0.665))
    def cham_P(i, j):
        p = HC2 + Rh @ Vector((-0.042 + 0.084 * j / 4, -0.1 + 0.15 * i / 8, 0.085))
        loc, n, _, _ = hb.find_nearest(p)
        return loc + n * 0.006
    sb = new_bm()
    sheet(sb, cham_P, 8, 4, 0.005, lambda i, j: 'trim' if i in (0, 8) or j in (0, 4) else 'second', 'second', 'trim',
          outward=lambda p: p - HC2)
    out(PFX + 'Chamfron', sb, MID, sharp=40)
    top = HC2 + Rh @ Vector((0, 0.01, 0.085))
    gem_cut(bg, Matrix.Translation(HC2 + Rh @ Vector((0, -0.05, 0.088))) @ Rh.to_4x4() @ Matrix.Rotation(math.radians(-90), 4, 'X'),
            0.012, 0.015, 0.015, 0.008)
    for k in range(7):
        a = -0.6 + 1.2 * k / 6
        p = top + Vector((0.0, 0.01 * k, 0.0))
        strand(bm, [p, p + Vector((0.006 * a, 0.02, 0.05)), p + Vector((0.012 * a, 0.06, 0.07))], 0.01, 0.005, 'accent',
               lambda c: c + Vector((0.2, 0, 0)), n=6, k=6)
    ring = [(0.058 + 0.004 * math.cos(2 * math.pi * q / 6), 0.004 * math.sin(2 * math.pi * q / 6)) for q in range(6)]
    lathe(bm, ring, 24, 'trim', xform=Matrix.Translation((0, -0.39, 0.62)) @ Matrix.Rotation(math.radians(64), 4, 'X'),
          wrap=True)
    LF = rider_to_horse(Vector((0.062, -0.188, 0.565)))
    for sx in (-1, 1):
        bit = Vector((sx * 0.052, -0.41, 0.6))
        tube(bm, [bit, (bit + LF) / 2 + Vector((sx * 0.01, 0, -0.04)), LF + Vector((sx * 0.006, 0, 0))], 0.0042, 'trim',
             n=16, k=6)
    out(PFX + 'Tack', bm, SMALL, sharp=45)
    out(PFX + 'TackGems', bg, SMALL, smooth=False)
    # the horse's eyes: big and dark, two highlights
    hb = bvh_of(O(PFX + 'Horse'))
    bm = new_bm()
    for s in (-1, 1):
        D = Vector((-s * 0.9, 0.42, -0.05)).normalized()
        Vv = Vector((0, 0, 1))
        U = D.cross(Vv).normalized() * -s
        frame = (Vector((0, -0.3, 0.68)), U, Vv, D)
        decal_poly(bm, hb, ellipse(0, 0.0, 0.017, 0.02, 20), frame, 0.0015, 'ink', rings=2)
        decal_poly(bm, hb, ellipse(-0.005, 0.007, 0.0058, 0.0062, 12), frame, 0.0026, 'white', rings=1)
        decal_poly(bm, hb, ellipse(0.005, -0.008, 0.003, 0.003, 10), frame, 0.0026, 'white', rings=1)
        decal_band(bm, hb, [(-0.02, 0.012), (0.0, 0.024), (0.02, 0.016), (0.03, 0.022)], [0.0012, 0.003, 0.0025, 0.0008],
                   frame, 0.0028, 'ink', n=12)
    out(PFX + 'HorseEyes', bm, 0, sharp=80, recalc=False)
    # the rider's legs astride, armoured, in gold stirrups
    bm, bs = new_bm(), new_bm()
    for s in (-1, 1):
        hip, knee, ank = Vector((s * 0.06, 0.03, 0.585)), Vector((s * 0.188, -0.04, 0.5)), Vector((s * 0.198, -0.02, 0.345))
        tube(bm, [hip, knee], 0.032, 'second', n=6, k=14, radius=lambda t: 0.034 - 0.006 * t)
        tube(bm, [knee, ank], 0.026, 'second', n=6, k=14, radius=lambda t: 0.028 - 0.002 * t)
        ellipsoid(bs, knee + Vector((0, -0.012, 0.004)), (0.026, 0.024, 0.024), 'trim', segs=14, rings=10)
        ellipsoid(bm, ank + Vector((0, -0.022, -0.012)), (0.026, 0.044, 0.024), 'second', segs=14, rings=10)
        ring = [(0.03 + 0.003 * math.cos(2 * math.pi * q / 6), 0.003 * math.sin(2 * math.pi * q / 6)) for q in range(6)]
        lathe(bs, ring, 20, 'trim', xform=Matrix.Translation(ank + Vector((0, -0.016, -0.034))), wrap=True)
        tube(bs, [ank + Vector((0, -0.016, -0.034)), Vector((s * 0.172, 0.0, 0.5))], 0.003, 'leather', n=4, k=5)
    out(PFX + 'RiderLegs', bm, MID, sharp=50)
    out(PFX + 'RiderLegGold', bs, SMALL, sharp=50)


def build_horse_lines():
    bm = new_bm()
    bb = bvh_of(O(PFX + 'Barding'))
    for s in (-1, 1):
        for u in (0.12, 0.3, 0.7, 0.88):
            ctrl = [bard_P(u * 26, j) + Vector((s * 0.05, 0, 0)) for j in ((5, 9, 13) if s < 0 else (21, 17, 13))]
            ctrl = [bb.find_nearest(Vector((s * 0.3, c.y, c.z)))[0] for c in ctrl]
            line3d(bm, bb, ctrl, 0.0022, 'lcoat', n=16)
    hb = bvh_of(O(PFX + 'Mane'))
    out(PFX + 'LinesHorse', bm, 0, sharp=80, recalc=False)


def build_n():
    build_base()
    before = {o.name for o in coll().objects}
    build_rider()
    build_rider_lines()
    pose_head()
    rider = [o.name for o in coll().objects if o.name not in before and o.type == 'MESH']
    move_rider(rider)
    build_horse()
    build_horse_lines()
    scale_figure(SCALE)

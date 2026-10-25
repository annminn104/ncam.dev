# Templar Warden (Rook). exec kit.py, patriarch.py, then this file into one dict; call build_r().
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'R_'
COLL = 'Warden'
POSE = {'head_roll': -3.0, 'head_pitch': -2.0, 'cape_flare': 0.6}
SCALE = 0.8
RHM = 0.25
CAP_SLOT = ['second'] * 5 + ['trim', 'second', 'trim', 'trim', 'trim'] + ['second'] * 5 + ['second']
ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.236, -0.052, 0.548)), 'L': ((0.12, 0.0, 0.675), (0.165, -0.118, 0.52))}
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'Helm', 'HelmBand', 'HelmGems', 'Plume', 'HelmWings', 'LinesHair',
                 'LinesHelm']
SH_C = Vector((0.205, -0.19, 0.47))
SH_N = Vector((0.5, -1.0, 0.0)).normalized()
SH_R = Vector((-SH_N.y, SH_N.x, 0.0)).normalized()     # across the shield, toward +x
UP = Vector((0, 0, 1))
RWARD = (0.19, 0.13, 0.82)                             # shield half width, bottom z, top z


def reslot_ob(name, src, dst):
    me = O(name).data
    a = me.attributes['_SLOT']
    vals = [0.0] * len(me.vertices)
    a.data.foreach_get('value', vals)
    si, di = float(SLOTS.index(src)), float(SLOTS.index(dst))
    a.data.foreach_set('value', [di if abs(v - si) < 0.1 else v for v in vals])
    me.update()


def build_body_r():
    build_robe()
    reslot_ob(PFX + 'Alb', 'white', 'second')
    reslot_ob(PFX + 'Sash', 'accent', 'leather')
    reslot_ob(PFX + 'Shoes', 'accent', 'second')
    rb = bvh_of(O(PFX + 'Robe'))
    # templar cross pattee on the tabard, gold-edged
    def pattee(cx, cz, k, hw0=0.016, hw1=0.05, up=0.11, dn=0.16, side=0.11):
        pts = []
        for ang, L in ((0, side), (90, up), (180, side), (270, dn)):
            a = math.radians(ang)
            d = (math.cos(a), math.sin(a))
            n = (-d[1], d[0])
            pts += [(cx + (d[0] * hw0 - n[0] * hw0) * k, cz + (d[1] * hw0 - n[1] * hw0) * k),
                    (cx + (d[0] * L - n[0] * hw1) * k, cz + (d[1] * L - n[1] * hw1) * k),
                    (cx + (d[0] * L + n[0] * hw1) * k, cz + (d[1] * L + n[1] * hw1) * k)]
        return pts
    bm = new_bm()
    decal_poly(bm, rb, pattee(0, 0.3, 1.0), FR, 0.0028, 'trim', center=(0, 0.3), rings=4)
    out(PFX + 'TabardGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    decal_poly(bm, rb, pattee(0, 0.3, 0.84), FR, 0.0042, 'coat', center=(0, 0.3), rings=4)
    decal_poly(bm, rb, ellipse(0, 0.3, 0.012, 0.012, 16), FR, 0.0055, 'gem', rings=1)
    out(PFX + 'TabardCross', bm, 0, sharp=80, recalc=False)
    # belt buckle and tassets
    BKL = Vector((0.0, -0.9 * 0.177 - 0.006, 0.455))
    bm = new_bm()
    slab(bm, [(-0.03, -0.021), (0.03, -0.021), (0.036, 0.0), (0.03, 0.021), (-0.03, 0.021), (-0.036, 0.0)],
         Matrix.Translation(BKL), 0.009, bevel=0.0022, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'Buckle', bm, SMALL, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(BKL + Vector((0, -0.006, 0))) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), 0.014, 0.02,
            0.02, 0.01)
    out(PFX + 'BuckleGem', bm, SMALL, smooth=False)
    NU, NV = 10, 8
    bm, bg = new_bm(), new_bm()
    for s in (-1, 1):
        for az, half, z0, zb in ((40, 16, 0.448, 0.3), (68, 15, 0.44, 0.31)):
            def P(i, j, az=az, half=half, z0=z0, zb=zb, s=s):
                u = -1 + 2 * i / NU
                v = j / NV
                th = math.radians(-90 + s * (az + half * u))
                z = z0 + (zb + 0.024 * u * u - z0) * v
                hit = ray_in(rb, th, z)
                return hit + Vector((hit.x, hit.y, 0)).normalized() * (0.007 + 0.026 * v ** 1.5)
            sheet(bm, P, NU, NV, 0.006, lambda i, j: 'accent' if j == NV - 2 else 'trim', 'second', 'trim',
                  outward=lambda p: Vector((p.x, p.y, 0)))
            top = P(NU // 2, 1)
            n = Vector((top.x, top.y, 0)).normalized()
            gem_cut(bg, Matrix.Translation(top + n * 0.007) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'),
                    0.011, 0.014, 0.016, 0.008)
    out(PFX + 'Tassets', bm, MID, sharp=40)
    out(PFX + 'TassetGems', bg, SMALL, smooth=False)


ARM_PROF = [(0.0, -0.05), (0.048, -0.05), (0.05, 0.1), (0.046, 0.35), (0.053, 0.42), (0.053, 0.56), (0.044, 0.62),
            (0.042, 0.84), (0.05, 0.92), (0.052, 1.0), (0.0, 1.0)]
ARM_SLOT = ['second', 'second', 'second', 'trim', 'trim', 'second', 'second', 'trim', 'trim', 'second']


def build_arms_r():
    bm = new_bm()
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        lathe(bm, [(r, z * L) for r, z in ARM_PROF], 28, lambda i, j: ARM_SLOT[j], xform=M)
    out(PFX + 'Arms', bm, MID, sharp=40)
    bm = new_bm()
    S = Vector((SX, SYY, 0.0))
    ellipsoid(bm, (-0.236, -0.056, 0.531), (0.022, 0.026, 0.031), 'second', segs=16, rings=10)
    for k in range(4):
        z = 0.55 - 0.0125 * k
        rf = 0.0105 + 0.0075
        pts = [S + Vector((rf * math.cos(math.radians(a)), rf * math.sin(math.radians(a)), z)) for a in (-15, -60, -105, -150, -200)]
        tube(bm, pts, 0.0075, 'second', n=10, k=8)
        ellipsoid(bm, pts[-1], (0.007,) * 3, 'second', segs=8, rings=6)
    tube(bm, [Vector((-0.229, -0.074, 0.536)), Vector((-0.238, -0.084, 0.548)), Vector((-0.25, -0.086, 0.556))], 0.008,
         'second', n=8, k=8)
    ellipsoid(bm, (0.17, -0.13, 0.512), (0.024, 0.024, 0.028), 'second', segs=14, rings=10)
    out(PFX + 'Gauntlets', bm, SMALL, sharp=55)


def build_cape_r():
    def cape_r(i, j, nu=36, nv=16):
        th = math.radians(-6 + 192 * i / nu)
        v = j / nv
        z = 0.665 - (0.665 - 0.26) * v
        r = 0.168 + 0.13 * v ** 0.85 + 0.014 * v ** 1.3 * math.cos(6 * (th - math.pi / 2))
        return Vector((r * math.cos(th) + 0.012 * v * v, r * math.sin(th) * 0.95 + 0.03 * v * v, z + 0.01 * v * v))
    bm = new_bm()
    sheet(bm, cape_r, 36, 16, 0.01, lambda i, j: 'trim' if j >= 15 or i <= 1 or i >= 34 else ('accent' if j == 14 else 'coat'),
          'accent', 'trim', outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Cape', bm, BIG, sharp=60)
    cb = bvh_of(O(PFX + 'Cape'))
    bm = new_bm()
    decal_poly(bm, cb, [(x, 0.45 + z) for x, z in cross_poly(0.012, 0.075, 0.1, 0.06, flare=0.022, fl=0.022)], BACK, 0.0035,
               'trim', center=(0, 0.45), rings=4)
    decal_poly(bm, cb, ellipse(0, 0.45, 0.011, 0.011, 14), BACK, 0.005, 'gem', rings=1)
    out(PFX + 'CapeCross', bm, 0, sharp=80, recalc=False)
    # neck guard
    bm = new_bm()
    lathe(bm, [(0.06, 0.73), (0.088, 0.735), (0.1, 0.752), (0.094, 0.79), (0.07, 0.8), (0.055, 0.78)], 48, 'second', sy=SY,
          wrap=True)
    lathe(bm, [(0.1, 0.748), (0.106, 0.752), (0.104, 0.762), (0.098, 0.762)], 48, 'trim', sy=SY, wrap=True)
    out(PFX + 'NeckGuard', bm, MID, sharp=45)


def shield_pt(u, v, lift=0.0):
    w, zb, zt = RWARD
    ztop = zt + 0.035 * (1 - u * u)
    z = zb + (ztop - zb) * v
    corner = 0.0
    if v < 0.08:
        corner = 0.04 * (1 - v / 0.08) * max(0.0, abs(u) - 0.6) / 0.4
    x = u * (w - corner * 0.8)
    bulge = 0.032 * (1 - u * u)
    return SH_C + SH_R * x + UP * (z - SH_C.z) + SH_N * (bulge + lift)


def build_shield():
    NU, NV = 20, 24

    def outer(i, j):
        if i <= 1 or i >= NU - 1 or j <= 1 or j >= NV - 1:
            return 'trim'
        if i == 2 or i == NU - 2 or j == 2 or j == NV - 2:
            return 'accent'
        return 'main'
    bm = new_bm()
    sheet(bm, lambda i, j: shield_pt(-1 + 2 * i / NU, j / NV), NU, NV, 0.012, outer, 'second', 'trim',
          outward=lambda p: SH_N)
    out(PFX + 'Shield', bm, BIG, sharp=40)
    sb = bvh_of(O(PFX + 'Shield'))
    frame = (SH_C, SH_R, UP, -SH_N)
    bm = new_bm()

    def pattee(k, hw0=0.022, hw1=0.07, up=0.25, dn=0.27, side=0.17):
        pts = []
        for ang, L in ((0, side), (90, up), (180, side), (270, dn)):
            a = math.radians(ang)
            d = (math.cos(a), math.sin(a))
            n = (-d[1], d[0])
            pts += [((d[0] * hw0 - n[0] * hw0) * k, (d[1] * hw0 - n[1] * hw0) * k),
                    ((d[0] * L - n[0] * hw1) * k, (d[1] * L - n[1] * hw1) * k),
                    ((d[0] * L + n[0] * hw1) * k, (d[1] * L + n[1] * hw1) * k)]
        return pts
    decal_poly(bm, sb, pattee(1.0), frame, 0.0032, 'trim', center=(0, 0), rings=5)
    out(PFX + 'ShieldGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    decal_poly(bm, sb, pattee(0.86), frame, 0.0048, 'coat', center=(0, 0), rings=5)
    out(PFX + 'ShieldCross', bm, 0, sharp=80, recalc=False)
    bm, bg = new_bm(), new_bm()
    boss = shield_pt(0.0, (SH_C.z - RWARD[1]) / (RWARD[2] - RWARD[1]), 0.0)
    ellipsoid(bm, boss + SH_N * 0.006, (0.034, 0.034, 0.034), 'trim', segs=20, rings=12,
              rot=SH_N.to_track_quat('Z', 'Y').to_matrix())
    for k in range(26):
        t = k / 26
        if t < 0.25:
            u, v = -0.86 + 1.72 * t / 0.25, 0.94
        elif t < 0.5:
            u, v = 0.86, 0.94 - 0.88 * (t - 0.25) / 0.25
        elif t < 0.75:
            u, v = 0.86 - 1.72 * (t - 0.5) / 0.25, 0.06
        else:
            u, v = -0.86, 0.06 + 0.88 * (t - 0.75) / 0.25
        ellipsoid(bm, shield_pt(u, v, 0.004), (0.0052,) * 3, 'trim', segs=8, rings=6)
    out(PFX + 'ShieldBoss', bm, MID, sharp=45)
    gem_cut(bg, Matrix.Translation(boss + SH_N * 0.04) @ SH_N.to_track_quat('-Y', 'Z').to_matrix().to_4x4(), 0.016, 0.02,
            0.02, 0.011)
    out(PFX + 'ShieldGem', bg, SMALL, smooth=False)


def build_halberd():
    M = Matrix.Translation((SX, SYY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0105, 0.082), (0.0105, 1.26), (0.0, 1.26)], 16, 'coat', xform=M)
    for z0, h, r in ((0.082, 0.03, 0.016), (0.47, 0.014, 0.0155), (0.585, 0.014, 0.0155), (1.1, 0.03, 0.019),
                     (1.215, 0.045, 0.017)):
        lathe(bm, [(0.0, z0), (r * 0.9, z0), (r, z0 + h * 0.3), (r, z0 + h * 0.7), (r * 0.9, z0 + h), (0.0, z0 + h)],
              16, 'trim', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    bm = new_bm()
    tip = Matrix.Translation((SX, SYY, 1.255))
    slab(bm, leaf(0.13, 0.03, 0.0, n=10), tip, 0.008, bevel=0.002, seg=2)
    blade = [(0.0, 1.13), (-0.03, 1.122), (-0.072, 1.128), (-0.104, 1.152), (-0.118, 1.19), (-0.106, 1.228),
             (-0.074, 1.252), (-0.03, 1.258), (0.0, 1.25), (-0.022, 1.235), (-0.05, 1.226), (-0.07, 1.19),
             (-0.05, 1.154), (-0.022, 1.145)]
    slab(bm, [(SX + x - SX, z - 1.0) for x, z in blade], Matrix.Translation((SX - 0.008, SYY, 1.0)), 0.007, bevel=0.0018, seg=2)
    slab(bm, [(0.0, 1.17), (0.06, 1.185), (0.0, 1.2)], Matrix.Translation((SX + 0.008, SYY, 0.0)), 0.007, bevel=0.0012, seg=1)
    set_slot(bm, bm.faces, 'second')
    out(PFX + 'HalberdHead', bm, MID, sharp=30)
    K = Vector((SX, SYY, 1.098))
    bm = new_bm()
    rib = lambda t: 1.0 - t ** 5
    front = lambda c: c + Vector((0, 0.5, 0))
    strand(bm, [K + Vector((0.012, -0.006, 0)), K + Vector((0.026, -0.016, -0.05)), K + Vector((0.036, -0.01, -0.11)),
                K + Vector((0.042, 0.0, -0.155))], 0.016, 0.0035, 'accent', front, n=14, k=8, prof=rib)
    out(PFX + 'Ribbon', bm, MID, sharp=60)


def helm_edge(phi):
    a = abs(phi)
    if a < 44:
        return 30.0
    if a < 54:
        u = (a - 44) / 10
        return 30 - 72 * (u * u * (3 - 2 * u))
    return -42 - 10 * min(1.0, (a - 54) / 90)


def helm_pt(phi, el, dr=0.0):
    if el >= 6:
        return surf(phi, el, 0.006 + dr, RHM)
    top = surf(phi, 6, 0.006 + dr, RHM)
    o = Vector((top.x, top.y, 0)).normalized()
    z = HC.z + RHM * 0.95 * math.sin(math.radians(el))
    kb = min(1.0, max(0.0, (abs(phi) - 100) / 50))
    p = Vector((top.x, top.y, z)) + o * (0.008 * (6 - el) / 50)
    if kb > 0:
        p = p.lerp(Vector((o.x * (0.2 + dr), o.y * (0.2 + dr), z)), kb * min(1.0, (6 - el) / 56) * 0.7)
    return p


def build_helm():
    bm = new_bm()
    for phi, tip, w in BANGS:
        strand(bm, bang_pts(phi, tip + 6), w, 0.009, 'hair', HC, n=12, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    cols, rows = 96, 12
    bm = new_bm()
    grid = []
    for i in range(cols):
        phi = -180 + 360 * i / cols
        e = helm_edge(phi)
        grid.append([bm.verts.new(helm_pt(phi, 88 + (e - 88) * j / rows)) for j in range(rows + 1)])
    for i in range(cols):
        i2 = (i + 1) % cols
        for j in range(rows):
            face(bm, [grid[i][j], grid[i][j + 1], grid[i2][j + 1], grid[i2][j]], 'second')
    crown = bm.verts.new(helm_pt(0, 90))
    for i in range(cols):
        face(bm, [grid[(i + 1) % cols][0], crown, grid[i][0]], 'second')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
    lay = bm.faces.layers.int['slot']
    for f in bm.faces:
        c = f.calc_center_median()
        d = f.normal.dot((c - HC).normalized())
        f[lay] = SLOTS.index('trim' if abs(d) < 0.5 else ('second' if d > 0 else 'coat'))
    out(PFX + 'Helm', bm, BIG, sharp=55)
    # gold brow band with gems, a gold comb over the crown
    bm = new_bm()
    sheet(bm, lambda i, j: helm_pt(-60 + 120 * i / 40, 30.0 + 7.0 * j / 2, 0.026 - 0.01 * j), 40, 2, 0.005, 'trim', 'trim',
          'trim', outward=lambda p: p - HC)
    ridge = []
    for k in range(29):
        el = 34 + 112 * k / 28
        ridge.append(helm_pt(0, el, 0.006) if el <= 90 else helm_pt(180, 180 - el, 0.006))
    tube(bm, ridge, 0.0085, 'trim', n=60, k=8)
    out(PFX + 'HelmBand', bm, SMALL, sharp=40)
    bm = new_bm()
    for ph, size in ((0, 0.015), (-30, 0.008), (30, 0.008)):
        c = helm_pt(ph, 34.0, 0.014)
        n = (c - HC).normalized()
        gem_cut(bm, Matrix.Translation(c) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'), size, size * 1.25,
                size * 1.25, size * 0.6)
    out(PFX + 'HelmGems', bm, SMALL, smooth=False)
    # crest plume from brow to nape, and gold wings on the sides
    bm = new_bm()
    for k in range(22):
        el = 52 + 7 * k
        phi = 0 if el <= 90 else 180
        el2 = el if el <= 90 else 180 - el
        root = helm_pt(phi, el2, -0.002)
        o = (root - HC).normalized()
        back = Vector((0, 1, 0))
        h = 0.075 + 0.035 * math.sin(math.pi * k / 21)
        for side, slot, wk in ((0.0, 'accent', 1.0), (0.012, 'white', 0.55)):
            pts = [root, root + o * h * 0.6 + back * 0.012, root + o * h + back * 0.055,
                   root + o * (h * 0.78) + back * 0.11 - UP * 0.025]
            pts = [p + Vector((side, 0, 0)) * (q / 3) for q, p in enumerate(pts)]
            strand(bm, pts, 0.026 * wk, 0.011 * wk, slot, lambda c: c + Vector((0.3, 0, 0)), n=10, k=8)
    out(PFX + 'Plume', bm, MID, sharp=60)
    bm = new_bm()
    for s in (-1, 1):
        c = helm_pt(s * 96, 18, 0.004)
        for k, (ang, L, W) in enumerate(((18, 0.12, 0.026), (40, 0.145, 0.028), (62, 0.13, 0.025), (84, 0.1, 0.022))):
            Mw = Matrix.Translation(c) @ Matrix.Rotation(math.radians(s * 90), 4, 'Z') @ \
                Matrix.Rotation(s * math.radians(ang), 4, 'Y') @ Matrix.Translation((0, 0.0025 * k, 0))
            slab(bm, leaf(L, W, -0.2, n=10), Mw, 0.0062, bevel=0.0015, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'HelmWings', bm, MID, sharp=30)


def build_brows_r():
    bvh = bvh_of(O(PFX + 'Head'), O(PFX + 'Bangs'))
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, bvh, [(s * 0.048, EZ + 0.058), (s * 0.084, EZ + 0.07), (s * 0.122, EZ + 0.081)],
                   [0.0026, 0.0042, 0.0016], FR, 0.0035, 'lhair', n=18)
    out(PFX + 'Brows', bm, 0, sharp=80, recalc=False)


def build_lines_r():
    K = 1.5
    bm = new_bm()
    for s, k, A, C0, R, alpha in pauldron_frames():
        al = math.radians(alpha)
        Rm = axis_to(A).to_3x3()
        U, V = Rm @ Vector((1, 0, 0)), Rm @ Vector((0, 1, 0))
        for frac in ((0.6,) if k else (0.6, 0.3)):
            pts = []
            for q in range(73):
                ph = 2 * math.pi * q / 72
                d = A * math.cos(frac * al) + (U * math.cos(ph) + V * math.sin(ph)) * math.sin(frac * al)
                pts.append((C0 + d * R, d))
            strip(bm, [p for p, _ in pts], [d for _, d in pts], [0.0019 * K] * 73, 'lgold', 0.0012)
    sb = bvh_of(O(PFX + 'Shield'))
    for inset in (0.82,):
        path = [shield_pt(-inset, 0.9), shield_pt(0, 0.92), shield_pt(inset, 0.9), shield_pt(inset, 0.5),
                shield_pt(inset, 0.1), shield_pt(0, 0.1), shield_pt(-inset, 0.1), shield_pt(-inset, 0.5)]
        C = catmull_closed(path, 120)
        strip(bm, C, [SH_N] * len(C), [0.0014 * K] * len(C), 'lgold', 0.0015)
    rb = bvh_of(O(PFX + 'Robe'))
    pts = []
    for q in range(241):
        a = 2 * math.pi * q / 240
        p = ray_in(rb, a, 0.147 + 0.011 * math.sin(26 * a))
        if p is not None:
            pts.append(p)
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lmain', n=30)
    cb = bvh_of(O(PFX + 'Cape'))
    for th in (20, 70, 110, 160):
        a = math.radians(th)
        ctrl = [cb.find_nearest(Vector((0.4 * math.cos(a), 0.4 * math.sin(a), z)))[0] for z in (0.6, 0.48, 0.36, 0.28)]
        line3d(bm, cb, ctrl, 0.0022, 'lcoat', n=24)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)
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
    for idx, (phi, tip, w) in enumerate(BANGS):
        strand_lines(bang_pts(phi, tip + 6), w, 0.009, HC, 12, bang_prof, (0.0,))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    hb = bvh_of(O(PFX + 'Helm'))
    for el in (40, 60):
        P = [helm_pt(-150 + 300 * q / 120, el, 0.0072) for q in range(121)]
        strip(bm, P, [(p - HC).normalized() for p in P], [0.0013 * K] * 121, 'lgold', 0.0004)
    for ph in (-120, -70, 70, 120):
        line3d(bm, hb, [helm_pt(ph, el, 0.006) for el in (70, 40, 10, -20)], 0.0016, 'lmain', n=20)
    out(PFX + 'LinesHelm', bm, 0, sharp=80, recalc=False)


def build_r():
    build_base()
    build_body_r()
    build_mantle()
    build_arms_r()
    build_pauldrons()
    build_cape_r()
    build_shield()
    build_halberd()
    build_head()
    build_helm()
    build_brows_r()
    build_lines_r()
    pose_head()
    scale_figure(SCALE)

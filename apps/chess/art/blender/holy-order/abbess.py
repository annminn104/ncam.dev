# Saint Abbess (Queen). exec kit.py, patriarch.py, then this file into one dict; call build_q().
# Built at the king's scale (same head, same body), then scaled down by SCALE about the base's top.
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'Q_'
COLL = 'Abbess'
POSE = {'head_roll': -6.0, 'head_pitch': 4.0, 'cape_flare': 0.0}
SCALE = 0.92
RV = 0.262

ROBE = [(0.0, 0.122), (0.3, 0.122), (0.307, 0.134), (0.303, 0.152), (0.295, 0.172), (0.282, 0.19), (0.246, 0.26),
        (0.208, 0.35), (0.168, 0.44), (0.155, 0.50), (0.158, 0.58), (0.156, 0.645), (0.143, 0.69), (0.11, 0.722),
        (0.07, 0.742), (0.0, 0.748)]


def robe_r(r, z, a, j):
    if z < 0.44:
        r += 0.016 * (0.44 - z) / 0.34 * math.cos(10 * a + 0.3)
    return r


ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.074, -0.158, 0.586)), 'L': ((0.12, 0.0, 0.675), (0.074, -0.158, 0.586))}
SLEEVE = [(0.0, -0.05), (0.044, -0.05), (0.047, 0.25), (0.052, 0.55), (0.056, 0.70), (0.058, 0.735), (0.061, 0.85),
          (0.064, 1.0), (0.06, 1.03), (0.051, 1.02), (0.044, 0.85), (0.0, 0.85)]
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'HairCap', 'Bangs', 'HairLocks', 'Veil', 'VeilDrape', 'Diadem',
                 'DiademGems', 'Halo', 'HaloGlow', 'HaloRays', 'LinesHair', 'LinesHead']


def gown_bvh():
    return bvh_of(O(PFX + 'Robe'))


def front_hit(bvh, x, z, off):
    return on_surf(bvh, x, z, off)


# ------------------------------------------------------------------ body extras
def build_ruff_hands():
    bm = new_bm()
    ruff = [(0.05, 0.735), (0.075, 0.75), (0.1, 0.758), (0.098, 0.765), (0.072, 0.757), (0.048, 0.745)]
    lathe(bm, ruff, 64, 'white', sy=SY, wrap=True,
          rmod=lambda r, z, a, j: r + (0.007 * (0.5 + 0.5 * math.cos(16 * a)) if j in (2, 3) else 0.0))
    out(PFX + 'Ruff', bm, SMALL, sharp=50)
    bm = new_bm()
    for s in (-1, 1):
        R = Euler((math.radians(-16), math.radians(s * 10), 0)).to_matrix()
        c = Vector((s * 0.0148, -0.2, 0.62))
        tube(bm, [Vector((s * 0.07, -0.162, 0.588)), Vector((s * 0.046, -0.182, 0.596)), c + Vector((s * 0.005, 0.008, -0.024))],
             0.017, 'glove', n=8, k=10)
        ellipsoid(bm, c, (0.0142, 0.028, 0.041), 'glove', segs=16, rings=12, rot=R)
        ellipsoid(bm, c + R @ Vector((s * 0.008, -0.016, -0.02)), (0.0102, 0.011, 0.017), 'glove', segs=10, rings=8, rot=R)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)


def build_front_q():
    gb = gown_bvh()
    # navy apron panel with gold borders and a star
    zs = [0.188, 0.25, 0.32, 0.39, 0.428]
    hw = lambda z: 0.055 + 0.058 * ((0.43 - z) / 0.242) ** 0.9
    poly = [(-hw(zs[0]), zs[0]), (hw(zs[0]), zs[0])] + [(hw(z), z) for z in zs[1:]] + [(-hw(z), z) for z in reversed(zs[1:])]
    bm = new_bm()
    decal_poly(bm, gb, poly, FR, 0.0022, 'coat', center=(0, 0.31), rings=4)
    out(PFX + 'Apron', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for e in (-1, 1):
        decal_band(bm, gb, [(e * (hw(z) - 0.004), z) for z in (0.426, 0.36, 0.29, 0.22, 0.192)], [0.0042] * 5, FR, 0.0034,
                   'trim', n=40)
    decal_band(bm, gb, [(x, 0.195) for x in (-hw(0.195) + 0.004, -0.04, 0.0, 0.04, hw(0.195) - 0.004)], [0.0042] * 5, FR,
               0.0034, 'trim', n=40)
    star = []
    for k in range(16):
        a = math.pi / 2 + 2 * math.pi * k / 16
        r = 0.05 if k % 2 == 0 else 0.019
        if k % 4 == 2:
            r = 0.034
        star.append((r * math.cos(a), 0.305 + r * math.sin(a)))
    decal_poly(bm, gb, star, FR, 0.0036, 'trim', center=(0, 0.305), rings=3)
    for cz in (0.395, 0.222):
        decal_poly(bm, gb, [(0, cz - 0.016), (0.011, cz), (0, cz + 0.016), (-0.011, cz)], FR, 0.0036, 'trim',
                   center=(0, cz), rings=2)
    out(PFX + 'ApronGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    decal_poly(bm, gb, ellipse(0, 0.305, 0.0115, 0.0115, 16), FR, 0.0048, 'gem', rings=1)
    for k in range(15):
        a = math.radians(-90 + (k - 7) * 13)
        p = ray_in(gb, a, 0.147)
        if p is not None:
            ellipsoid(bm, p + Vector((p.x, p.y, 0)).normalized() * 0.003, (0.0052,) * 3, 'gem', segs=10, rings=6)
    out(PFX + 'ApronGems', bm, 0, sharp=80, recalc=False)
    # gold breastplate: a shield following the chest, a big gem
    NU, NV = 12, 10

    def plate(i, j):
        u, v = i / NU, j / NV
        z = 0.728 - (0.728 - 0.636) * v
        w = 0.062 * (1 - v ** 2.4) ** 0.8
        x = (2 * u - 1) * w
        top_dip = 0.012 * (1 - abs(2 * u - 1)) if j == 0 else 0.0
        p, n = front_hit(gb, x, z - top_dip, 0.004)
        return p
    bm = new_bm()
    sheet(bm, plate, NU, NV, 0.005, lambda i, j: 'accent' if j in (1,) or i in (1, NU - 2) else 'trim', 'trim', 'trim',
          outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Breastplate', bm, MID, sharp=40)
    GP, gn = front_hit(gb, 0.0, 0.69, 0.012)
    bm = new_bm()
    lathe(bm, [(0.0, 0.0), (0.023, 0.0), (0.026, 0.004), (0.022, 0.008), (0.0, 0.0085)], 24, 'trim',
          xform=Matrix.Translation(GP - gn * 0.004) @ axis_to(gn))
    out(PFX + 'PlateBezel', bm, SMALL, sharp=40)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(GP + gn * 0.002), 0.018, 0.022, 0.026, 0.012)
    for x, z in ((-0.036, 0.716), (0.036, 0.716)):
        p, n = front_hit(gb, x, z, 0.008)
        gem_cut(bm, Matrix.Translation(p), 0.007, 0.009, 0.009, 0.005)
    out(PFX + 'PlateGems', bm, SMALL, smooth=False)
    # single gold lames on the shoulders
    bm, bg, bi = new_bm(), new_bm(), new_bm()
    for s in (-1, 1):
        A = Vector((s * math.sin(math.radians(44)), 0.0, math.cos(math.radians(44))))
        loc, _, _, _ = gb.ray_cast(Vector((s * 0.5, 0.0, 0.81)), Vector((-s * 0.5, 0, -0.12)).normalized())
        R, alpha = 0.1, 42
        al = math.radians(alpha)
        C0 = loc + A * (0.009 + R * (1 - math.cos(al))) - A * R
        M = Matrix.Translation(C0) @ axis_to(A)
        lathe(bm, dome(R, alpha), 36, 'trim', xform=M, wrap=True,
              rmod=lambda r, z, a, j: r + (0.006 * max(0.0, math.cos(9 * a)) if j in (7, 8, 9) else 0.0))
        a2, a3 = math.radians(alpha * 0.72), math.radians(alpha * 0.86)
        ring = [((R + 0.0012) * math.sin(a2), (R + 0.0012) * math.cos(a2)), ((R + 0.0012) * math.sin(a3), (R + 0.0012) * math.cos(a3)),
                ((R - 0.002) * math.sin(a3), (R - 0.002) * math.cos(a3)), ((R - 0.002) * math.sin(a2), (R - 0.002) * math.cos(a2))]
        lathe(bi, ring, 36, 'accent', xform=M, wrap=True)
        gem_cut(bg, Matrix.Translation(C0 + A * (R + 0.003)) @ axis_to(-A) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.016,
                0.021, 0.021, 0.011)
    out(PFX + 'ShoulderPlates', bm, MID, sharp=35)
    out(PFX + 'ShoulderInlay', bi, SMALL, sharp=35)
    out(PFX + 'ShoulderGems', bg, SMALL, smooth=False)
    # rosary from the joined hands
    H = Vector((0.0, -0.207, 0.584))
    loop = [H + Vector((-0.012, 0, 0))]
    for z, dx in ((0.55, -0.026), (0.51, -0.022), (0.478, 0.0), (0.51, 0.022), (0.55, 0.026)):
        p = front_hit(gb, dx, z, 0.014)[0]
        loop.append(Vector((p.x, min(p.y, H.y + 0.03), z)))
    loop.append(H + Vector((0.012, 0, 0)))
    bm = new_bm()
    for k, p in enumerate(resample(loop, 0.0125)):
        big = k % 6 == 3
        ellipsoid(bm, p, (0.0066,) * 3 if big else (0.005,) * 3, 'gem' if big else 'white', segs=10, rings=6)
    bot = loop[3]
    out(PFX + 'RosaryBeads', bm, SMALL, sharp=60)
    bm = new_bm()
    slab(bm, cross_poly(0.0045, 0.014, 0.024, 0.0135, flare=0.0068, fl=0.005),
         Matrix.Translation(bot + Vector((0.0, -0.004, -0.03))), 0.0045, bevel=0.0011, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'RosaryCross', bm, SMALL, sharp=35)


def ray_prism(bm, M, t, r0, r1, w, th, slot):
    """A flat diamond ray in the local xy plane of M (a halo's plane), pointing out at angle t."""
    d = Vector((math.cos(t), math.sin(t), 0))
    n = Vector((-math.sin(t), math.cos(t), 0))
    pts = [d * r0 - n * w, d * ((r0 + r1) / 2) - n * (w * 0.2), d * r1, d * ((r0 + r1) / 2) + n * (w * 0.2), d * r0 + n * w]
    fr = [bm.verts.new(M @ (p + Vector((0, 0, -th)))) for p in pts]
    bk = [bm.verts.new(M @ (p + Vector((0, 0, th)))) for p in pts]
    face(bm, fr, slot)
    face(bm, bk[::-1], slot)
    for q in range(len(pts)):
        face(bm, [fr[q], fr[(q + 1) % len(pts)], bk[(q + 1) % len(pts)], bk[q]], slot)


WING_TOP = [(0.0, 0.0), (0.03, 0.05), (0.09, 0.11), (0.16, 0.15), (0.22, 0.165)]
WING_TIPS = [(0.238, 0.125), (0.222, 0.075), (0.192, 0.028), (0.152, -0.012), (0.106, -0.042), (0.062, -0.058),
             (0.022, -0.05)]


def wing_outline(s, notch):
    pts = [(s * x, z) for x, z in WING_TOP]
    tips = [(0.22, 0.165)] + WING_TIPS
    cx, cz = 0.1, 0.06
    for (x0, z0), (x1, z1) in zip(tips, tips[1:]):
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
        dx, dz = cx - mx, cz - mz
        ln = math.hypot(dx, dz)
        pts.append((s * (mx + dx / ln * notch), mz + dz / ln * notch))
        pts.append((s * x1, z1))
    pts.append((s * 0.0, -0.02))
    if s < 0:
        pts.reverse()
    return pts


def wing_frame(s):
    root = Vector((s * 0.06, 0.222, 0.68))
    return Matrix.Translation(root) @ Matrix.Rotation(-s * math.radians(30), 4, 'Z') @ Matrix.Rotation(math.radians(-14), 4, 'X') \
        @ Matrix.Diagonal((1.15, 1.0, 1.15, 1.0))


def build_halo_wings():
    C = Vector((0.0, 0.272, 1.115))
    M = Matrix.Translation(C) @ Matrix.Rotation(math.radians(-10), 4, 'X') @ Matrix.Rotation(math.radians(90), 4, 'X')
    bm = new_bm()
    lathe(bm, [(0.235 + 0.0085 * math.cos(2 * math.pi * q / 10), 0.0085 * math.sin(2 * math.pi * q / 10)) for q in range(10)],
          96, 'trim', xform=M, wrap=True)
    out(PFX + 'Halo', bm, MID, sharp=40)
    bm = new_bm()
    lathe(bm, [(0.212 + 0.0042 * math.cos(2 * math.pi * q / 8), 0.0042 * math.sin(2 * math.pi * q / 8)) for q in range(8)],
          96, 'glow', xform=M, wrap=True)
    out(PFX + 'HaloGlow', bm, 0, sharp=60)
    bm = new_bm()
    for k in range(24):
        t = 2 * math.pi * k / 24 + math.pi / 24
        ray_prism(bm, M, t, 0.246, 0.282 if k % 2 == 0 else 0.266, 0.0085 if k % 2 == 0 else 0.007, 0.0028, 'trim')
    out(PFX + 'HaloRays', bm, SMALL, smooth=False)
    # small angel wings from the shoulder blades: three scalloped feather layers and a gold arm
    bm, bt = new_bm(), new_bm()
    for s in (-1, 1):
        for k, (sc, dy, notch) in enumerate(((1.0, 0.0, 0.016), (0.74, -0.007, 0.013), (0.46, -0.014, 0.009))):
            Mw = wing_frame(s) @ Matrix.Translation((0, dy, 0.012 * k)) @ Matrix.Diagonal((sc, 1, sc, 1))
            slab(bm, wing_outline(s, notch), Mw, 0.008, bevel=0.0016, seg=1)
        tube(bt, [wing_frame(s) @ Vector((s * x, -0.018, z)) for x, z in WING_TOP], 0.0058, 'trim', n=20, k=8)
    set_slot(bm, bm.faces, 'main')
    out(PFX + 'Wings', bm, MID, sharp=30)
    out(PFX + 'WingBone', bt, MID, sharp=30)


# ------------------------------------------------------------------ head
QEX, QEZ, QIW, QIH = 0.09, 0.946, 0.036, 0.047


def build_head_q():
    bm = new_bm()
    ret = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR)
    for v in ret['verts']:
        v.co = deform(v.co + HC)
    set_slot(bm, bm.faces, 'skin')
    head = out(PFX + 'Head', bm, BIG, sharp=80)
    bvh = bvh_of(head)
    bm = new_bm()
    for s in (-1, 1):
        ex = s * QEX
        decal_poly(bm, bvh, ellipse(ex, QEZ, QIW, QIH, 32), FR, 0.0015, 'eyes', rings=3)
        decal_poly(bm, bvh, ellipse(ex + s * 0.002, QEZ - 0.016, 0.027, 0.021, 24), FR, 0.002, 'iris2', rings=2)
        decal_poly(bm, bvh, ellipse(ex, QEZ + 0.004, 0.0145, 0.021, 24), FR, 0.0027, 'ink', rings=2)
        decal_poly(bm, bvh, ellipse(ex - 0.012, QEZ + 0.017, 0.0105, 0.0115, 20), FR, 0.0037, 'white', rings=2)
        decal_poly(bm, bvh, ellipse(ex + 0.012, QEZ - 0.018, 0.005, 0.005, 14), FR, 0.0037, 'white', rings=1)
        decal_poly(bm, bvh, ellipse(ex + 0.002, QEZ - 0.004, 0.003, 0.003, 10), FR, 0.0037, 'white', rings=1)
        lash = [(-1.02, 0.36), (-0.55, 0.85), (0.15, 1.02), (0.8, 0.92), (1.12, 0.6), (1.42, 0.76)]
        decal_band(bm, bvh, [(ex + s * QIW * u, QEZ + QIH * w) for u, w in lash],
                   [0.0017, 0.0052, 0.007, 0.0074, 0.0064, 0.0014], FR, 0.0047, 'ink', n=30)
        low = [(0.0, -1.0), (0.5, -0.95), (0.9, -0.7), (1.1, -0.45)]
        decal_band(bm, bvh, [(ex + s * QIW * u, QEZ + QIH * w) for u, w in low], [0.0007, 0.0017, 0.0015, 0.0006], FR,
                   0.003, 'ink', n=14)
        decal_poly(bm, bvh, ellipse(s * 0.126, 0.892, 0.021, 0.0095, 18), FR, 0.0012, 'blush', rings=2)
        for (u0, w0), (u1, w1), hw in (((1.2, 0.7), (1.62, 1.0), 0.0042), ((0.95, 0.9), (1.3, 1.26), 0.0038),
                                       ((0.62, 0.98), (0.86, 1.36), 0.0032)):
            b0 = (ex + s * QIW * u0, QEZ + QIH * w0)
            tip = (ex + s * QIW * u1, QEZ + QIH * w1)
            dx, dz = tip[0] - b0[0], tip[1] - b0[1]
            ln = math.hypot(dx, dz)
            px, pz = -dz / ln * hw, dx / ln * hw
            decal_poly(bm, bvh, [(b0[0] + px, b0[1] + pz), tip, (b0[0] - px, b0[1] - pz)], FR, 0.0049, 'ink', rings=1)
        crease = [(-0.5, 1.22), (0.1, 1.34), (0.75, 1.25), (1.1, 1.02)]
        decal_band(bm, bvh, [(ex + s * QIW * u, QEZ + QIH * w) for u, w in crease], [0.0006, 0.0012, 0.0011, 0.0005], FR,
                   0.0016, 'lskin', n=16)
    decal_band(bm, bvh, [(-0.011, 0.866), (-0.0035, 0.8625), (0.0045, 0.8625), (0.0115, 0.866)],
               [0.0007, 0.0017, 0.0017, 0.0007], FR, 0.0015, 'ink', n=12)
    decal_band(bm, bvh, [(-0.006, 0.858), (0.0, 0.856), (0.006, 0.858)], [0.0006, 0.0016, 0.0006], FR, 0.0013, 'blush',
               n=8)
    decal_band(bm, bvh, [(0.0032, 0.899), (0.0005, 0.891), (-0.0018, 0.888)], [0.0005, 0.0012, 0.0006], FR, 0.0016,
               'lskin', n=8)
    out(PFX + 'Face', bm, 0, sharp=80, recalc=False)


QBANGS = [(-50, 2, 0.036), (-37, 9, 0.038), (-23, 10, 0.04), (-9, 3, 0.034), (9, 3, 0.034), (23, 10, 0.04), (37, 9, 0.038),
          (50, 2, 0.036)]


def qbang_pts(phi, tip):
    sw = 6 if phi > 0 else -6
    return [surf(phi, 29, 0.004, RH), surf(phi + sw * 0.3, 17, 0.007, RH), surf(phi + sw * 0.7, (17 + tip) / 2, 0.011, RH),
            surf(phi * 1.02 + sw, tip, 0.018, RH)]


def qlock_pts(s):
    return [surf(s * 56, 22, 0.006, RH), surf(s * 64, -8, 0.018, RH), surf(s * 63, -32, 0.03, RH),
            Vector((s * 0.172, -0.1, 0.78)), Vector((s * 0.186, -0.128, 0.67)), Vector((s * 0.172, -0.15, 0.57)),
            Vector((s * 0.185, -0.15, 0.49))]


def veil_edge(phi):
    a = abs(phi)
    if a < 46:
        return 34.0
    if a < 82:
        u = (a - 46) / 36
        return 34 - 78 * (u * u * (3 - 2 * u))
    return -44 - 10 * min(1.0, (a - 82) / 60)


def veil_pt(phi, el, dr=0.0):
    e = veil_edge(phi)
    t = max(0.0, (88 - el) / (88 - e))
    flare = 0.006 + 0.014 * t * t + dr
    if el >= 8:
        return surf(phi, el, flare, RV)
    top = surf(phi, 8, flare, RV)
    o = Vector((top.x, top.y, 0)).normalized()
    z = HC.z + RV * 0.95 * math.sin(math.radians(el))
    p = Vector((top.x, top.y, z)) + o * (0.03 * (8 - el) / 52)
    kb = smooth01((abs(phi) - 95) / 45)
    if kb > 0:
        q = Vector((o.x * (0.2 + dr), o.y * (0.2 + dr), z))
        p = p.lerp(q, kb * smooth01((8 - el) / 62) * 0.8)
    return p


def smooth01(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def build_hair_veil():
    # the hair under the veil: cap for volume at the face opening, bangs, long front locks
    cols, rows, top = 96, 9, 40.0
    bm = new_bm()
    grid = []
    for i in range(cols):
        phi = -180 + 360 * i / cols
        h = hem(phi) if abs(phi) < 46 else max(hem(phi), veil_edge(phi) + 4)
        grid.append([bm.verts.new(surf(phi, top + (h - top) * j / rows, 0.004 + 0.012 * (j / rows) ** 2.2, RH))
                     for j in range(rows + 1)])
    for i in range(cols):
        i2 = (i + 1) % cols
        for j in range(rows):
            face(bm, [grid[i][j], grid[i][j + 1], grid[i2][j + 1], grid[i2][j]], 'hair')
    crown = bm.verts.new(HC + Vector((0, 0, 0.19)))
    for i in range(cols):
        face(bm, [grid[(i + 1) % cols][0], crown, grid[i][0]], 'hair')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
    set_slot(bm, bm.faces, 'hair')
    out(PFX + 'HairCap', bm, MID, sharp=70)
    bm = new_bm()
    for phi, tip, w in QBANGS:
        strand(bm, qbang_pts(phi, tip), w, 0.009, 'hair', HC, n=12, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        strand(bm, qlock_pts(s), 0.05, 0.014, 'hair', body_center, n=24, k=10, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)
    # veil: a shell over head and hair, open over the face, gold-edged, lined in blue
    cols, rows = 96, 12
    bm = new_bm()
    grid = []
    for i in range(cols):
        phi = -180 + 360 * i / cols
        e = veil_edge(phi)
        grid.append([bm.verts.new(veil_pt(phi, 88 + (e - 88) * j / rows)) for j in range(rows + 1)])
    for i in range(cols):
        i2 = (i + 1) % cols
        for j in range(rows):
            face(bm, [grid[i][j], grid[i][j + 1], grid[i2][j + 1], grid[i2][j]], 'main')
    crown = bm.verts.new(veil_pt(0, 90))
    for i in range(cols):
        face(bm, [grid[(i + 1) % cols][0], crown, grid[i][0]], 'main')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.008)
    lay = bm.faces.layers.int['slot']
    for f in bm.faces:
        c = f.calc_center_median()
        d = f.normal.dot((c - HC).normalized())
        front = abs(math.degrees(math.atan2(c.x, -c.y))) < 100
        f[lay] = SLOTS.index(('trim' if front else 'main') if abs(d) < 0.5 else ('main' if d > 0 else 'accent'))
    out(PFX + 'Veil', bm, BIG, sharp=60)
    # the veil's fall down the back, gold-hemmed
    rb = gown_bvh()

    def back_y(x, z):
        loc, _, _, _ = rb.ray_cast(Vector((x, 1.0, z)), Vector((0, -1, 0)))
        return loc.y if loc is not None else 0.15
    NU, NV = 30, 14
    colsV = []
    for i in range(NU + 1):
        u = -1 + 2 * i / NU
        phi = 180 + 72 * u
        el0 = veil_edge(phi)
        zh = 0.4 + 0.04 * u * u
        ctrl = [veil_pt(phi, -12, 0.007), veil_pt(phi, el0 + 2, 0.009)]
        for z in (0.74, 0.62, 0.5):
            x = 0.175 * u * (1 + 0.22 * (0.86 - z) / 0.4)
            fold = 0.009 * math.cos(u * math.pi * 3.5) * (0.86 - z) / 0.4
            ctrl.append(Vector((x, back_y(x, z) + 0.03 + 0.012 * (0.86 - z) + fold, z)))
        x = 0.175 * u * (1 + 0.22 * (0.86 - zh) / 0.4)
        ctrl.append(Vector((x, back_y(x, zh) + 0.04 + 0.009 * math.cos(u * math.pi * 3.5), zh)))
        colsV.append(catmull(ctrl, NV))
    bm = new_bm()
    sheet(bm, lambda i, j: colsV[i][j], NU, NV, 0.008,
          lambda i, j: 'trim' if j >= NV - 2 or i in (0, NU - 1) else ('accent' if j == NV - 3 else 'main'), 'accent', 'trim',
          outward=lambda p: Vector((p.x, p.y, 0)) if p.z < 0.86 else (p - HC))
    out(PFX + 'VeilDrape', bm, BIG, sharp=60)
    # a gold cross on the fall, below the wings
    db = bvh_of(O(PFX + 'VeilDrape'))
    bm = new_bm()
    decal_poly(bm, db, [(x, 0.575 + z) for x, z in cross_poly(0.009, 0.05, 0.065, 0.04, flare=0.016, fl=0.016)], BACK, 0.003,
               'trim', center=(0, 0.575), rings=4)
    decal_poly(bm, db, ellipse(0, 0.575, 0.008, 0.008, 14), BACK, 0.0045, 'gem', rings=1)
    out(PFX + 'DrapeCross', bm, 0, sharp=80, recalc=False)
    # diadem along the veil's edge, a gem at its centre and a drop on the brow
    bm = new_bm()
    sheet(bm, lambda i, j: veil_pt(-50 + 100 * i / 40, 30.5 + 4.0 * j / 2, 0.006), 40, 2, 0.004, 'trim', 'trim', 'trim',
          outward=lambda p: p - HC)
    out(PFX + 'Diadem', bm, SMALL, sharp=40)
    bm = new_bm()
    c = veil_pt(0, 32.5, 0.012)
    n = (c - HC).normalized()
    gem_cut(bm, Matrix.Translation(c) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.014, 0.018, 0.022, 0.009)
    for ph in (-26, 26):
        c2 = veil_pt(ph, 32.5, 0.01)
        n2 = (c2 - HC).normalized()
        gem_cut(bm, Matrix.Translation(c2) @ axis_to(-n2) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.008, 0.01, 0.01, 0.005)
    d = surf(0, 24, 0.016, RH)
    gem_cut(bm, Matrix.Translation(d) @ axis_to(-(d - HC).normalized()) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.007,
            0.008, 0.014, 0.005)
    out(PFX + 'DiademGems', bm, SMALL, smooth=False)


def build_brows_q():
    bvh = bvh_of(O(PFX + 'Head'), O(PFX + 'Bangs'))
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, bvh, [(s * 0.052, QEZ + 0.07), (s * 0.088, QEZ + 0.083), (s * 0.126, QEZ + 0.074)],
                   [0.0018, 0.0036, 0.0012], FR, 0.0035, 'lhair', n=18)
    out(PFX + 'Brows', bm, 0, sharp=80, recalc=False)


# ------------------------------------------------------------------ lines
def build_lines_q():
    K = 1.5
    gb = gown_bvh()
    bm = new_bm()
    # breastplate: border inset + a vine either side of the gem
    NU, NV = 12, 10

    def plate_pt(u, v):
        z = 0.728 - (0.728 - 0.636) * v
        w = 0.062 * (1 - v ** 2.4) ** 0.8
        return Vector(((2 * u - 1) * w, 0, z))
    path = [plate_pt(0.14, 0.12), plate_pt(0.5, 0.1), plate_pt(0.86, 0.12), plate_pt(0.88, 0.45), plate_pt(0.7, 0.78),
            plate_pt(0.5, 0.9), plate_pt(0.3, 0.78), plate_pt(0.12, 0.45)]
    P = []
    for c in catmull_closed(path, 90):
        p, n = front_hit(gb, c.x, c.z, 0.0048)
        P.append((p, n))
    strip(bm, [p for p, _ in P], [n for _, n in P], [0.0012 * K] * len(P), 'lgold', 0.0004)
    for s in (-1, 1):
        ctrl = [Vector((s * 0.02, 0, 0.672)), Vector((s * 0.034, 0, 0.664)), Vector((s * 0.028, 0, 0.654)),
                Vector((s * 0.018, 0, 0.66))]
        P = [front_hit(gb, c.x, c.z, 0.0048) for c in catmull(ctrl, 16)]
        strip(bm, [p for p, _ in P], [n for _, n in P], widths(len(P), 0.0011 * K, 'both'), 'lgold', 0.0004)
    # shoulder lames: engraved ring
    for s in (-1, 1):
        A = Vector((s * math.sin(math.radians(44)), 0.0, math.cos(math.radians(44))))
        loc, _, _, _ = gb.ray_cast(Vector((s * 0.5, 0.0, 0.81)), Vector((-s * 0.5, 0, -0.12)).normalized())
        R, alpha = 0.1, 42
        al = math.radians(alpha)
        C0 = loc + A * (0.009 + R * (1 - math.cos(al))) - A * R
        Rm = axis_to(A).to_3x3()
        U, V = Rm @ Vector((1, 0, 0)), Rm @ Vector((0, 1, 0))
        for frac in (0.6, 0.32):
            pts = []
            for q in range(73):
                ph = 2 * math.pi * q / 72
                d = A * math.cos(frac * al) + (U * math.cos(ph) + V * math.sin(ph)) * math.sin(frac * al)
                pts.append((C0 + d * R, d))
            strip(bm, [p for p, _ in pts], [d for _, d in pts], [0.0019 * K] * 73, 'lgold', 0.0012)
    # gown hem band wave
    pts = []
    for q in range(241):
        a = 2 * math.pi * q / 240
        p = ray_in(gb, a, 0.147 + 0.011 * math.sin(26 * a))
        if p is not None:
            pts.append(p)
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    # cuffs
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        P = []
        for q in range(97):
            a = 2 * math.pi * q / 96
            w = max(0.0, math.cos(a) * d.x + math.sin(a) * d.y) ** 1.2
            zn = (0.925 + 0.018 * math.sin(9 * a)) * L + 0.055 * 0.7 * w
            P.append(M @ Vector((0.075 * math.cos(a), 0.075 * math.sin(a), zn)))
        hits = [sleeveb.find_nearest(p) for p in P]
        strip(bm, [h[0] for h in hits], [h[1] for h in hits], [0.0011 * K] * len(hits), 'lgold', 0.0012)
    # finger separations on the joined hands
    handb = bvh_of(O(PFX + 'Gloves'))
    for s in (-1, 1):
        for dz in (0.008, 0.0, -0.008):
            ctrl = [Vector((s * 0.004, -0.214, 0.63 + dz)), Vector((s * 0.013, -0.216, 0.628 + dz)),
                    Vector((s * 0.021, -0.21, 0.625 + dz))]
            line3d(bm, handb, ctrl, 0.0008, 'lskin', n=8)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)

    # cloth folds: gown, sleeves, drape; wing feather ribs
    bm = new_bm()
    for k in range(10):
        a0 = (math.pi - 0.3 + 2 * math.pi * k) / 10
        if abs(math.degrees(a0) % 360 - 270) < 30:
            continue
        ctrl = [ray_in(gb, a0 + 0.03 * (0.42 - z) / 0.24, z) for z in (0.42, 0.33, 0.25, 0.185)]
        if None not in ctrl:
            line3d(bm, gb, ctrl, 0.0024, 'lmain', n=30)
    SLR = [(0.25, 0.048), (0.55, 0.055), (0.70, 0.06), (0.85, 0.066)]

    def sl_r(zn):
        for (z0, r0), (z1, r1) in zip(SLR, SLR[1:]):
            if zn <= z1:
                return r0 + (r1 - r0) * (zn - z0) / (z1 - z0)
        return SLR[-1][1]
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        for a in (0.4, 1.9, 3.3, 4.6):
            line3d(bm, sleeveb, [M @ Vector((sl_r(zn) * math.cos(a + 0.15 * zn), sl_r(zn) * math.sin(a + 0.15 * zn), zn * L))
                                 for zn in (0.32, 0.5, 0.66, 0.8)], 0.0016, 'lmain', n=18)
    drb = bvh_of(O(PFX + 'VeilDrape'))
    for u in (-0.62, -0.25, 0.12, 0.48, 0.8):
        x = 0.175 * u
        ctrl = [Vector((x * 1.02, 0.4, z)) for z in (0.78, 0.68, 0.58, 0.5)]
        ctrl = [drb.find_nearest(Vector((c.x * (1 + 0.22 * (0.86 - c.z) / 0.4), 0.4, c.z)))[0] for c in ctrl]
        line3d(bm, drb, ctrl, 0.002, 'lmain', n=24)
    vb = bvh_of(O(PFX + 'Veil'))
    for ph in (-150, -120, -96, 96, 120, 150, 180):
        ctrl = [veil_pt(ph, el, 0.003) for el in (60, 30, 0, -30)]
        if veil_edge(ph) < -20:
            line3d(bm, vb, ctrl, 0.0017, 'lmain', n=24)
    for s in (-1, 1):
        for k, (sc, dy) in enumerate(((1.0, 0.0), (0.74, -0.007))):
            Mw = wing_frame(s) @ Matrix.Translation((0, dy, 0.012 * k)) @ Matrix.Diagonal((sc, 1, sc, 1))
            for (x1, z1) in WING_TIPS[:-1]:
                for side in (-1, 1):
                    flat_line(bm, Mw, [(s * x1 * 0.35, 0.06 + (z1 - 0.06) * 0.35), (s * x1 * 0.9, z1 * 0.9 + 0.006)], side,
                              0.0011, 'lmain', half=0.004, n=8)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)

    # hair strands + diadem engraving (posed with the head)
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
    for idx, (phi, tip, w) in enumerate(QBANGS):
        strand_lines(qbang_pts(phi, tip), w, 0.009, HC, 12, bang_prof, (0.0, 0.5 if idx % 2 == 0 else -0.5))
    for s in (-1, 1):
        strand_lines(qlock_pts(s), 0.05, 0.014, body_center, 24, bang_prof, (0.0, 0.5, -0.5))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    P = [veil_pt(-48 + 96 * q / 60, 32.5, 0.0115) for q in range(61)]
    strip(bm, P, [(p - HC).normalized() for p in P], [0.0009] * 61, 'lgold', 0.0003)
    out(PFX + 'LinesHead', bm, 0, sharp=80, recalc=False)


def build_q():
    build_base()
    build_robe()
    build_sleeves()
    build_ruff_hands()
    build_front_q()
    build_head_q()
    build_hair_veil()
    build_brows_q()
    build_halo_wings()
    build_lines_q()
    pose_head()
    scale_figure(SCALE)

# Bishop. exec kit.py, patriarch.py, then this file into one dict; call build_b().
# Built at the king's scale, scaled down by SCALE about the base's top.
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'B_'
COLL = 'Bishop'
POSE = {'head_roll': 4.0, 'head_pitch': 2.0, 'cape_flare': 0.0}
SCALE = 0.86
ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.236, -0.052, 0.548)), 'L': ((0.12, 0.0, 0.675), (0.19, -0.085, 0.565))}
CAP_SLOT = ['main'] * 5 + ['accent', 'main', 'trim', 'trim', 'trim'] + ['second'] * 5 + ['main']
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'HairCap', 'Bangs', 'HairLocks', 'HairTufts', 'LinesHair', 'Mitre', 'MitreGold',
                 'MitreCross', 'MitreJewels', 'MitrePearls', 'Lappets', 'LappetFringe', 'LinesMitre']
CROOK_C = Vector((SX + 0.062, SYY, 1.245))
CENSER = Vector((0.222, -0.118, 0.33))
LH = Vector((0.205, -0.098, 0.552))


def build_cassock():
    bm = new_bm()
    lathe(bm, ROBE, 72, lambda i, j: 'trim' if 1 <= j <= 3 else ('accent' if j == 4 else 'coat'), rmod=robe_r, sy=SY)
    out(PFX + 'Robe', bm, BIG, sharp=50)
    alb = [(0.0, 0.08), (0.262, 0.08), (0.274, 0.086), (0.274, 0.103), (0.268, 0.126), (0.245, 0.2), (0.0, 0.2)]
    bm = new_bm()
    lathe(bm, alb, 104, lambda i, j: 'second' if j == 0 else 'white', sy=SY,
          rmod=lambda r, z, a, j: r + (0.011 * (0.5 + 0.5 * math.cos(26 * a)) if j in (1, 2) else
                                       (0.004 * (0.5 + 0.5 * math.cos(26 * a)) if j == 3 else 0.0)))
    out(PFX + 'Alb', bm, MID, sharp=50)
    bm = new_bm()
    lathe(bm, [(0.168, 0.432), (0.176, 0.438), (0.177, 0.47), (0.170, 0.478), (0.160, 0.478), (0.160, 0.432)],
          72, 'accent', sy=SY, wrap=True)
    # sash ends hanging at the left hip, gold-fringed
    tail = lambda t: 1.0 - 0.25 * t
    for dx, zend, w in ((0.0, 0.25, 0.026), (0.03, 0.29, 0.022)):
        root = Vector((0.118 + dx, -0.122, 0.45))
        pts = [root, root + Vector((0.012, -0.022, -0.06)), root + Vector((0.018, -0.03, -0.12)),
               Vector((0.15 + dx, -0.2 + 0.02 * dx / 0.03, zend))]
        strand(bm, pts, w, 0.005, 'accent', lambda c: Vector((0, 0, c.z)), n=12, k=8, prof=tail)
    out(PFX + 'Sash', bm, MID, sharp=50)
    bm = new_bm()
    for sx in (-1, 1):
        ellipsoid(bm, (sx * 0.07, -0.25, 0.094), (0.034, 0.048, 0.022), 'coat', segs=16, rings=10)
        ellipsoid(bm, (sx * 0.07, -0.282, 0.093), (0.024, 0.02, 0.017), 'trim', segs=14, rings=8)
    out(PFX + 'Shoes', bm, SMALL, sharp=60)
    bm = new_bm()
    lathe(bm, [(0.0, 0.70), (0.046, 0.70), (0.044, 0.80), (0.0, 0.80)], 24, 'skin')
    out(PFX + 'Neck', bm, MID, sharp=60)
    # double-breasted: two columns of gold buttons, a gold edge down the front
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()
    for z in (0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.545):
        for s in (-1, 1):
            x = s * (0.034 + 0.06 * max(0.0, 0.42 - z))
            p, n = on_surf(rb, x, z, 0.004)
            ellipsoid(bm, p, (0.0075, 0.005, 0.0075), 'trim', segs=12, rings=8, rot=axis_to(n).to_3x3())
    out(PFX + 'Buttons', bm, SMALL, sharp=50)
    bm = new_bm()
    decal_band(bm, rb, [(0.012, 0.56), (0.014, 0.42), (0.018, 0.3), (0.024, 0.19)], [0.0035] * 4, FR, 0.003, 'trim', n=30)
    decal_band(bm, rb, [(-0.004, 0.56), (-0.004, 0.42), (-0.004, 0.3), (-0.004, 0.19)], [0.0012] * 4, FR, 0.003, 'lcoat',
               n=30)
    decal_poly(bm, rb, [(x, 0.31 + z) for x, z in cross_poly(0.012, 0.075, 0.095, 0.058, flare=0.02, fl=0.02)], BACK, 0.003,
               'trim', center=(0, 0.31), rings=4)
    decal_poly(bm, rb, ellipse(0, 0.31, 0.011, 0.011, 14), BACK, 0.0045, 'gem', rings=1)
    out(PFX + 'Placket', bm, 0, sharp=80, recalc=False)


def build_hands_b():
    bm = new_bm()
    S = Vector((SX, SYY, 0.0))
    ellipsoid(bm, (-0.236, -0.056, 0.531), (0.021, 0.025, 0.03), 'glove', segs=16, rings=10)
    for k in range(4):
        z = 0.55 - 0.0125 * k
        rf = 0.0105 + 0.0072
        pts = [S + Vector((rf * math.cos(math.radians(a)), rf * math.sin(math.radians(a)), z - 0.0018 * (a + 15) / -185))
               for a in (-15, -60, -105, -150, -200)]
        tube(bm, pts, 0.0072 - 0.0004 * k, 'glove', n=10, k=8)
        ellipsoid(bm, pts[-1], (0.0068,) * 3, 'glove', segs=8, rings=6)
    thumb = [Vector((-0.229, -0.074, 0.536)), Vector((-0.238, -0.084, 0.548)), Vector((-0.25, -0.086, 0.556))]
    tube(bm, thumb, 0.0078, 'glove', n=8, k=8)
    ellipsoid(bm, thumb[-1], (0.0075,) * 3, 'glove', segs=8, rings=6)
    # left fist holding the censer's chain
    ellipsoid(bm, LH, (0.024, 0.024, 0.027), 'glove', segs=16, rings=10)
    for k in range(4):
        c = LH + Vector((-0.012 + 0.008 * k, -0.02, -0.006 + 0.002 * k))
        ellipsoid(bm, c, (0.0062, 0.0075, 0.0085), 'glove', segs=8, rings=6)
    ellipsoid(bm, LH + Vector((-0.016, -0.014, 0.012)), (0.008, 0.009, 0.011), 'glove', segs=8, rings=6)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)


def build_capelet_b():
    build_mantle()
    capb = bvh_of(O(PFX + 'Capelet'))
    # pectoral cross on a bead chain round the neck
    bm = new_bm()
    chain = []
    for k in range(15):
        t = k / 14
        x = -0.085 + 0.17 * t
        z = 0.7 - 0.08 * math.sin(math.pi * t)
        chain.append(on_surf(capb, x, z, 0.0055)[0])
    for p in resample(chain, 0.0105):
        ellipsoid(bm, p, (0.0043,) * 3, 'trim', segs=8, rings=6)
    out(PFX + 'Chain', bm, SMALL, sharp=45)
    low, ln = on_surf(capb, 0.0, 0.615, 0.0)
    CC = Vector((0.0, low.y - 0.011, 0.58))
    bm = new_bm()
    slab(bm, cross_poly(0.0085, 0.034, 0.052, 0.032, flare=0.0135, fl=0.012), Matrix.Translation(CC), 0.0075, bevel=0.0018,
         seg=2)
    set_slot(bm, bm.faces, 'trim')
    ellipsoid(bm, CC + Vector((0, -0.0045, 0)), (0.009, 0.004, 0.009), 'gem', segs=12, rings=8)
    out(PFX + 'Pectoral', bm, SMALL, sharp=35)


def mitre_profile():
    prof = [(0.0, 0.035), (0.222, 0.035), (0.229, 0.062), (0.222, 0.11), (0.201, 0.15), (0.166, 0.19), (0.121, 0.228),
            (0.073, 0.262), (0.031, 0.288), (0.0, 0.300)]
    return [(r, ZB + 0.035 + (h - 0.035) * 0.95) for r, h in prof]


def build_mitre():
    bm = new_bm()
    lathe(bm, [(0.212, ZB), (0.226, ZB), (0.231, ZB + 0.021), (0.226, ZB + 0.042), (0.212, ZB + 0.042)], 64, 'trim',
          wrap=True)
    prof = mitre_profile()
    _, body = lathe(bm, prof, 64, lambda i, j: 'trim' if (i in (63, 0, 31, 32) and j >= 1) else 'main')
    for v in {v for f in body for v in f.verts}:
        h = v.co.z - (ZB + 0.05)
        if h > 0:
            v.co.y *= 1 - 0.42 * min(1.0, h / 0.23)
    bmesh.ops.transform(bm, matrix=TILT, verts=bm.verts[:])
    out(PFX + 'Mitre', bm, BIG, sharp=40)
    mb = bvh_of(O(PFX + 'Mitre'))
    bm = new_bm()
    for frame in (FR, BACK):
        decal_band(bm, mb, [(0, 1.112), (0, 1.17), (0, 1.24), (0, 1.3)], [0.016, 0.015, 0.013, 0.009], frame, 0.0028,
                   'trim', n=30)
    out(PFX + 'MitreGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for frame in (FR, BACK):
        decal_poly(bm, mb, [(x, 1.215 + z) for x, z in cross_poly(0.008, 0.042, 0.05, 0.038, flare=0.015, fl=0.012)],
                   frame, 0.0045, 'accent', center=(0, 1.215), rings=3)
    out(PFX + 'MitreCross', bm, 0, sharp=80, recalc=False)
    bm, bp = new_bm(), new_bm()
    for deg, kind in ((-90, 'gem'), (-125, 'white'), (-55, 'white'), (-155, 'gem'), (-25, 'gem'), (90, 'gem'),
                      (125, 'white'), (55, 'white')):
        a = math.radians(deg)
        p = TILT @ Vector((0.2335 * math.cos(a), 0.2335 * math.sin(a), ZB + 0.021))
        rot = TILT.to_3x3() @ Matrix.Rotation(a - math.pi / 2, 3, 'Z')
        if kind == 'white':
            ellipsoid(bp, p, (0.0062,) * 3, 'white', segs=12, rings=8, rot=rot)
        else:
            gem_cut(bm, Matrix.Translation(p) @ rot.to_4x4() @ Matrix.Rotation(math.pi, 4, 'Z'), 0.0095, 0.012, 0.012,
                    0.006)
    loc, nrm, _, _ = mb.ray_cast(Vector((0, -1, 1.215)), Vector((0, 1, 0)))
    gem_cut(bm, Matrix.Translation(loc + nrm * 0.008), 0.009, 0.011, 0.011, 0.006)
    out(PFX + 'MitreJewels', bm, SMALL, smooth=False)
    out(PFX + 'MitrePearls', bp, SMALL, sharp=60)
    lap = lambda t: 1.0 - 0.15 * t
    bm, bf = new_bm(), new_bm()
    for s in (-1, 1):
        pts = [surf(180 + s * 16, 30, 0.012, RH), surf(180 + s * 17, 8, 0.03, RH), surf(180 + s * 18, -16, 0.04, RH),
               surf(180 + s * 19, -34, 0.05, RH)]
        strand(bm, pts, 0.02, 0.004, 'trim', HC, n=14, k=8, prof=lap)
        C = catmull(pts, 14)
        end, t = C[-1], (C[-1] - C[-2]).normalized()
        o = (end - HC).normalized()
        side = t.cross(o).normalized()
        ellipsoid(bf, C[-3] + o * 0.006, (0.0068,) * 3, 'gem', segs=10, rings=6)
        for q in range(5):
            root = end + side * (0.0145 * (q - 2) / 2) - t * 0.002
            strand(bf, [root, root + t * 0.012 + o * 0.002, root + t * 0.024 + o * 0.004], 0.0028, 0.0024, 'trim', HC,
                   n=4, k=6)
    out(PFX + 'Lappets', bm, MID, sharp=60)
    out(PFX + 'LappetFringe', bf, SMALL, sharp=60)


def build_hair_b():
    cols, rows, top = 96, 9, 40.0
    bm = new_bm()
    grid = []
    for i in range(cols):
        phi = -180 + 360 * i / cols
        h = hem(phi)
        grid.append([bm.verts.new(surf(phi, top + (h - top) * j / rows, 0.004 + 0.016 * (j / rows) ** 2.2, RH))
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
    out(PFX + 'HairCap', bm, BIG, sharp=70)
    bm = new_bm()
    for phi, tip, w in BANGS:
        strand(bm, bang_pts(phi, tip), w, 0.009, 'hair', HC, n=12, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        for phi0, w, el1 in ((60, 0.038, -54), (72, 0.036, -46)):
            strand(bm, [surf(s * phi0, 22, 0.006, RH), surf(s * (phi0 + 6), -8, 0.016, RH),
                        surf(s * (phi0 + 2), -34, 0.026, RH), surf(s * (phi0 - 6), el1, 0.03, RH)],
                   w, 0.011, 'hair', HC, n=14, k=10, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        for t in TUFTS[:4]:
            strand(bm, tuft_pts(s, t), t[5], 0.012, 'hair', HC, n=10, k=8)
        for phi in (150, 170):
            strand(bm, [surf(s * phi, -12, -0.004, RH), surf(s * phi, -34, 0.02, RH), surf(s * (phi - 4), -52, 0.05, RH)],
                   0.03, 0.012, 'hair', HC, n=10, k=8)
    out(PFX + 'HairTufts', bm, MID, sharp=70)


def crook_path():
    base = Vector((SX, SYY, 1.1))
    pts = [base, base + Vector((0.0, 0.0, 0.06)), base + Vector((0.004, 0.0, 0.11))]
    c = CROOK_C
    for k in range(16):
        t = k / 15
        r = 0.062 * (1 - 0.6 * t)
        a = math.radians(180 - 330 * t)
        pts.append(c + Vector((r * math.cos(a), 0.0, r * math.sin(a))))
    return pts


def build_crozier():
    M = Matrix.Translation((SX, SYY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0105, 0.082), (0.0105, 1.11), (0.0, 1.11)], 16, 'coat', xform=M)
    for z0, h, r in ((0.082, 0.03, 0.016), (0.47, 0.014, 0.0155), (0.585, 0.014, 0.0155), (1.06, 0.05, 0.02)):
        lathe(bm, [(0.0, z0), (r * 0.9, z0), (r, z0 + h * 0.3), (r, z0 + h * 0.7), (r * 0.9, z0 + h), (0.0, z0 + h)],
              16, 'trim', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    bm = new_bm()
    pts = crook_path()
    tube(bm, pts, 0.011, 'trim', n=60, k=10, radius=lambda t: 0.0155 * (1 - 0.45 * t))
    # crockets: small gold leaves along the curl's back
    C = catmull(pts, 60)
    for k in range(5, 44, 6):
        c = C[k]
        t = (C[k + 1] - C[k - 1]).normalized()
        o = (c - CROOK_C)
        o.y = 0
        o.normalize()
        M2 = Matrix.Translation(c + o * 0.011) @ Matrix.Rotation(math.atan2(o.x, o.z), 4, 'Y')
        slab(bm, leaf(0.04, 0.012, 0.25, n=6), M2, 0.005, bevel=0.0009, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'Crook', bm, MID, sharp=35)
    bm = new_bm()
    end = pts[-1]
    gem_cut(bm, Matrix.Translation(CROOK_C + Vector((0.006, -0.007, -0.004))), 0.017, 0.021, 0.021, 0.011)
    out(PFX + 'CrookGem', bm, SMALL, smooth=False)
    # ribbon (vexillum) tied under the crook
    K = Vector((SX, SYY, 1.07))
    bm = new_bm()
    rib = lambda t: 1.0 - t ** 5
    front = lambda c: c + Vector((0, 0.5, 0))
    strand(bm, [K + Vector((0.012, -0.006, 0)), K + Vector((0.03, -0.016, -0.05)), K + Vector((0.042, -0.01, -0.11)),
                K + Vector((0.05, 0.0, -0.16))], 0.017, 0.0035, 'accent', front, n=14, k=8, prof=rib)
    strand(bm, [K + Vector((-0.012, -0.004, 0)), K + Vector((-0.028, -0.006, -0.045)), K + Vector((-0.036, 0.004, -0.1))],
           0.016, 0.0035, 'accent', front, n=12, k=8, prof=rib)
    out(PFX + 'Ribbon', bm, MID, sharp=60)


def build_censer():
    bm = new_bm()
    top = LH + Vector((0.004, -0.008, -0.02))
    lid = CENSER + Vector((0, 0, 0.065))
    for p in resample([top, (top + lid) / 2 + Vector((0.004, -0.004, 0)), lid], 0.009):
        ellipsoid(bm, p, (0.0034,) * 3, 'trim', segs=8, rings=6)
    out(PFX + 'CenserChain', bm, SMALL, sharp=45)
    M = Matrix.Translation(CENSER)
    bm = new_bm()
    prof = [(r * 1.3, z * 1.3) for r, z in ((0.0, -0.05), (0.012, -0.05), (0.016, -0.04), (0.028, -0.026), (0.034, -0.008),
            (0.034, 0.004), (0.03, 0.012), (0.026, 0.016), (0.03, 0.022), (0.026, 0.034), (0.016, 0.044), (0.008, 0.05),
            (0.0, 0.054))]
    lathe(bm, prof, 24, lambda i, j: 'glow' if j == 6 and i % 3 != 0 else 'trim', xform=M)
    ellipsoid(bm, CENSER + Vector((0, 0, 0.075)), (0.009,) * 3, 'trim', segs=10, rings=8)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.4
        p = CENSER + Vector((0.039 * math.cos(a), 0.039 * math.sin(a), 0.016))
        tube(bm, [p, lid + (p - lid) * 0.2], 0.0016, 'trim', n=4, k=5)
    out(PFX + 'Censer', bm, SMALL, sharp=40)
    bm = new_bm()
    for k, (dx, dz, r) in enumerate(((0.012, 0.075, 0.006), (-0.01, 0.1, 0.005), (0.016, 0.125, 0.004))):
        crystal(bm, CENSER + Vector((dx, -0.004, dz)), r, r * 1.6, r * 1.6, n=4, slot='glow', twist=0.5 * k)
    out(PFX + 'CenserSparks', bm, 0, smooth=False)


def build_lines_b():
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()
    pts = []
    for q in range(241):
        a = 2 * math.pi * q / 240
        p = ray_in(rb, a, 0.147 + 0.011 * math.sin(26 * a))
        if p is not None:
            pts.append(p)
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        P = []
        for q in range(97):
            a = 2 * math.pi * q / 96
            w = max(0.0, math.cos(a) * d.x + math.sin(a) * d.y) ** 1.2
            zn = (0.925 + 0.018 * math.sin(9 * a)) * L + 0.055 * 0.7 * w
            P.append(M @ Vector((0.09 * math.cos(a), 0.09 * math.sin(a), zn)))
        hits = [sleeveb.find_nearest(p) for p in P]
        strip(bm, [h[0] for h in hits], [h[1] for h in hits], [0.0011 * K] * len(hits), 'lgold', 0.0012)
    cb = bvh_of(O(PFX + 'Censer'))
    for z in (-0.026, 0.026):
        P = [CENSER + Vector((0.0345 * math.cos(2 * math.pi * q / 48) * (1 - abs(z) * 6), 0.0345 * math.sin(2 * math.pi * q / 48) * (1 - abs(z) * 6), z)) for q in range(49)]
        hits = [cb.find_nearest(p) for p in P]
        strip(bm, [h[0] for h in hits], [h[1] for h in hits], [0.0009] * 49, 'lgold', 0.0006)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    # cassock folds (the coat's own darker line), capelet troughs, sleeves
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lcoat', n=30)
    capb = bvh_of(O(PFX + 'Capelet'))
    for k in range(12):
        a = math.radians(15 + 30 * k)
        ctrl = [capb.find_nearest(Vector((0.3 * math.cos(a), 0.27 * math.sin(a), z)))[0] for z in (0.572, 0.59, 0.612)]
        line3d(bm, capb, ctrl, 0.0017, 'lmain', n=10, taper='start')
    SLR = [(0.25, 0.05), (0.55, 0.062), (0.70, 0.071), (0.85, 0.078)]

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
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)
    # hair + mitre (posed with the head)
    bm = new_bm()
    capH = bvh_of(O(PFX + 'HairCap'))
    for m in range(-6, 6):
        pt = 30 * m + 8
        if abs(pt) < 52 or abs(pt) > 179:
            continue
        for dd in (-7, 7):
            line3d(bm, capH, [cap_pt(pt + dd, 30), cap_pt(pt + dd * 0.75, 12), cap_pt(pt + dd * 0.4, (12 + hem(pt)) / 2),
                              cap_pt(pt + dd * 0.25, hem(pt + dd * 0.25) + 3)], 0.0017, 'lhair', n=22)

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
        strand_lines(bang_pts(phi, tip), w, 0.009, HC, 12, bang_prof, (0.0, 0.5 if idx % 2 == 0 else -0.5))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for z, r in ((ZB + 0.007, 0.2279), (ZB + 0.035, 0.2278)):
        P = [TILT @ Vector((r * math.cos(2 * math.pi * q / 120), r * math.sin(2 * math.pi * q / 120), z)) for q in range(121)]
        N = [TILT.to_3x3() @ Vector((math.cos(2 * math.pi * q / 120), math.sin(2 * math.pi * q / 120), 0)) for q in range(121)]
        strip(bm, P, N, [0.0014 * K] * 121, 'lgold', 0.0012)
    mb = bvh_of(O(PFX + 'Mitre'))
    for frame in (FR, BACK):
        for e in (-1, 1):
            decal_band(bm, mb, [(e * 0.011, 1.115), (e * 0.0105, 1.2), (e * 0.008, 1.29)], [0.0009 * K] * 3, frame, 0.0042,
                       'lgold', n=30)
    out(PFX + 'LinesMitre', bm, 0, sharp=80, recalc=False)


def build_b():
    build_base()
    build_cassock()
    build_sleeves()
    build_hands_b()
    build_capelet_b()
    build_crozier()
    build_censer()
    build_head()
    build_hair_b()
    build_brows()
    build_mitre()
    build_lines_b()
    pose_head()
    scale_figure(SCALE)

# Holy Order Patriarch (King). exec() kit.py into the same namespace first, then this, then build_all().
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'P_'
COLL = 'Patriarch'
POSE = {'head_roll': 5.0, 'head_pitch': 3.0, 'cape_flare': 1.0}
HC = Vector((0.0, 0.0, 0.976))
HR = 0.224
RH = 0.238
SY = 0.9
ZB = 1.07
TILT = Matrix.Translation((0, 0, ZB)) @ Matrix.Rotation(math.radians(-6), 4, 'X') @ Matrix.Translation((0, 0, -ZB))
SX, SYY = -0.252, -0.062          # staff axis
BIG, MID, SMALL = 0.006, 0.0042, 0.0026


def O(n):
    return bpy.data.objects[n]


def bare(ob):
    for md in list(ob.modifiers):
        ob.modifiers.remove(md)
    return ob


def out(name, bm, width=MID, smooth=True, sharp=40.0, recalc=True):
    ob = finalize(name, bm, smooth=smooth, sharp=sharp, recalc=recalc)
    dress(ob, width or 0.001, line_on=bool(width))
    return ob


def deform(p, R=HR):
    """Sphere point -> chibi head: squashed, flat face, round cranium, tapered jaw, small pointed chin."""
    q = p - HC
    q.z *= 0.95
    if q.z < 0:
        t = min(1.0, -q.z / (0.95 * R))
        k = 1 - 0.26 * t * t
        q.x *= k
        q.y *= k
        if q.y < 0:
            q.z -= 0.022 * t * t * min(1.0, -q.y / R) * (R / HR)
    q.y *= 0.93 if q.y < 0 else 1.03
    return HC + q


def dirv(phi, el):
    p, e = math.radians(phi), math.radians(el)
    return Vector((math.sin(p) * math.cos(e), -math.cos(p) * math.cos(e), math.sin(e)))


def surf(phi, el, dr=0.0, R=HR):
    s = deform(HC + dirv(phi, el) * R, R)
    return s + (s - HC).normalized() * dr


def body_center(c):
    return HC if c.z > 0.86 else Vector((0.0, 0.0, c.z))


def ray_in(bvh, th, z, sy=1.0):
    o = Vector((0.7 * math.cos(th), 0.7 * sy * math.sin(th), z))
    loc, nrm, _, _ = bvh.ray_cast(o, Vector((-math.cos(th), -sy * math.sin(th), 0)).normalized())
    return loc


def on_surf(bvh, x, z, off, front=True):
    loc, nrm, _, _ = bvh.ray_cast(Vector((x, -1.0 if front else 1.0, z)), Vector((0, 1 if front else -1, 0)))
    return loc + nrm * off, nrm


def clear_figure():
    for ob in list(coll().objects):
        drop(ob.name)


# ================================================================== body
ROBE = [(0.0, 0.122), (0.286, 0.122), (0.293, 0.134), (0.289, 0.152), (0.281, 0.172), (0.268, 0.19), (0.236, 0.26),
        (0.203, 0.35), (0.170, 0.44), (0.160, 0.50), (0.163, 0.58), (0.160, 0.645), (0.146, 0.69), (0.112, 0.722),
        (0.07, 0.742), (0.0, 0.748)]


def robe_r(r, z, a, j):
    if z < 0.42:
        r += 0.013 * (0.42 - z) / 0.34 * math.cos(8 * a + 0.4)
    return r


def stole_x(z):
    return 0.056 + 0.034 * ((0.715 - z) / 0.565) ** 1.3


def stole_w(z):
    return 0.014 + 0.005 * (0.715 - z) / 0.555


def build_base():
    bm = new_bm()
    lathe(bm, [(0, 0), (0.326, 0), (0.332, 0.008), (0.33, 0.05), (0.326, 0.066), (0.316, 0.076), (0.3, 0.08),
               (0, 0.08)], 56, 'second')
    lathe(bm, [(0.310, 0.073), (0.318, 0.066), (0.326, 0.073), (0.318, 0.080), (0.310, 0.073)], 56, 'trim')
    out('X_' + PFX + 'Base', bm, 0.004, sharp=30)


def build_robe():
    bm = new_bm()
    lathe(bm, ROBE, 72, lambda i, j: 'trim' if 1 <= j <= 3 else ('accent' if j == 4 else 'main'), rmod=robe_r, sy=SY)
    out(PFX + 'Robe', bm, BIG, sharp=50)
    alb = [(0.0, 0.08), (0.262, 0.08), (0.274, 0.086), (0.274, 0.103), (0.268, 0.126), (0.245, 0.2), (0.0, 0.2)]

    def alb_r(r, z, a, j):
        if j in (1, 2):
            return r + 0.011 * (0.5 + 0.5 * math.cos(26 * a))
        if j == 3:
            return r + 0.004 * (0.5 + 0.5 * math.cos(26 * a))
        return r
    bm = new_bm()
    lathe(bm, alb, 104, lambda i, j: 'second' if j == 0 else 'white', rmod=alb_r, sy=SY)
    out(PFX + 'Alb', bm, MID, sharp=50)
    bm = new_bm()
    lathe(bm, [(0.168, 0.432), (0.176, 0.438), (0.177, 0.47), (0.170, 0.478), (0.160, 0.478), (0.160, 0.432)],
          72, 'accent', sy=SY, wrap=True)
    out(PFX + 'Sash', bm, MID, sharp=50)
    bm = new_bm()
    for sx in (-1, 1):
        ellipsoid(bm, (sx * 0.07, -0.25, 0.094), (0.034, 0.048, 0.022), 'accent', segs=16, rings=10)
        ellipsoid(bm, (sx * 0.07, -0.282, 0.093), (0.024, 0.02, 0.017), 'trim', segs=14, rings=8)
    out(PFX + 'Shoes', bm, SMALL, sharp=60)
    bm = new_bm()
    lathe(bm, [(0.0, 0.70), (0.046, 0.70), (0.044, 0.80), (0.0, 0.80)], 24, 'skin')
    out(PFX + 'Neck', bm, MID, sharp=60)


ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.236, -0.052, 0.548)), 'L': ((0.12, 0.0, 0.675), (0.158, -0.105, 0.53))}
SLEEVE = [(0.0, -0.05), (0.044, -0.05), (0.05, 0.25), (0.062, 0.55), (0.071, 0.70), (0.0735, 0.735), (0.078, 0.85),
          (0.086, 1.0), (0.08, 1.03), (0.068, 1.02), (0.058, 0.85), (0.0, 0.85)]
SLEEVE_SLOT = ['main', 'main', 'main', 'main', 'trim', 'main', 'trim', 'trim', 'trim', 'second', 'second']
DROOP = {4: 0.15, 5: 0.22, 6: 0.4, 7: 1.0, 8: 1.0, 9: 1.0, 10: 0.4}


def arm_frame(sh, wr):
    M, L = align_z(sh, wr)
    d = M.inverted().to_3x3() @ Vector((0, 0, -1))
    d.z = 0
    d.normalize()
    return M, L, d


def build_sleeves():
    bm, bl = new_bm(), new_bm()
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)

        def zmod(r, z, a, j, d=d):
            w = max(0.0, math.cos(a) * d.x + math.sin(a) * d.y) ** 1.2
            return z + 0.055 * DROOP.get(j, 0.0) * w
        lathe(bm, [(r, z * L) for r, z in SLEEVE], 32, lambda i, j: SLEEVE_SLOT[j], xform=M, zmod=zmod)
        frill = [(0.03, 0.86), (0.037, 0.95), (0.052, 1.06), (0.05, 1.066), (0.035, 0.955), (0.028, 0.866)]

        def fr_r(r, z, a, j):
            return r + (0.006 * (0.5 + 0.5 * math.cos(14 * a)) if j in (2, 3) else 0.0)

        def fr_z(r, z, a, j, d=d):
            w = max(0.0, math.cos(a) * d.x + math.sin(a) * d.y) ** 1.2
            return z + (0.03 * w if j in (2, 3) else 0.0)
        lathe(bl, [(r, z * L) for r, z in frill], 28, 'white', xform=M, rmod=fr_r, zmod=fr_z, wrap=True)
    out(PFX + 'Sleeves', bm, BIG, sharp=50)
    out(PFX + 'Frills', bl, SMALL, sharp=50)


BOOK_R = Euler((math.radians(4), math.radians(-14), math.radians(14))).to_matrix()
BOOK_C = Vector((0.098, -0.178, 0.505))


def book_at(v):
    return BOOK_C + BOOK_R @ Vector(v)


def build_gloves_book():
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
    ellipsoid(bm, book_at((0.047, 0.006, -0.004)), (0.019, 0.02, 0.026), 'glove', segs=16, rings=10, rot=BOOK_R)
    for zz in (0.022, 0.007, -0.008, -0.022):
        pts = [book_at((0.046, -0.012, zz)), book_at((0.036, -0.0215, zz)), book_at((0.022, -0.0225, zz * 0.95)),
               book_at((0.012, -0.021, zz * 0.9))]
        tube(bm, pts, 0.0058, 'glove', n=8, k=8)
        ellipsoid(bm, pts[-1], (0.0055,) * 3, 'glove', segs=8, rings=6)
    thumb = [book_at((0.044, 0.016, 0.012)), book_at((0.03, 0.022, 0.018)), book_at((0.018, 0.021, 0.02))]
    tube(bm, thumb, 0.006, 'glove', n=6, k=8)
    ellipsoid(bm, thumb[-1], (0.0058,) * 3, 'glove', segs=8, rings=6)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)
    # the patriarch's ring on the index finger
    rp = S + Vector((0.0, -0.0177, 0.55 - 0.0018 * 75 / 185))
    bm = new_bm()
    ring = [(0.0083 + 0.0022 * math.cos(2 * math.pi * q / 8), 0.0022 * math.sin(2 * math.pi * q / 8)) for q in range(8)]
    lathe(bm, ring, 16, 'trim', xform=Matrix.Translation(rp) @ axis_to((1, 0, 0)), wrap=True)
    out(PFX + 'Ring', bm, SMALL, sharp=45)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(rp + Vector((0, -0.0096, 0.0))), 0.0045, 0.005, 0.005, 0.003)
    out(PFX + 'RingGem', bm, SMALL, smooth=False)
    # the book: gilded page block, blue cover, gold cross and corners
    bm = new_bm()
    box(bm, book_at((0.003, 0, 0)), (0.064, 0.022, 0.088), 'trim', rot=BOOK_R)
    for yy in (-0.0135, 0.0135):
        box(bm, book_at((0, yy, 0)), (0.073, 0.005, 0.097), 'accent', rot=BOOK_R)
    box(bm, book_at((-0.0345, 0, 0)), (0.006, 0.032, 0.097), 'accent', rot=BOOK_R)
    box(bm, book_at((0.002, -0.0165, 0.006)), (0.008, 0.0025, 0.054), 'trim', rot=BOOK_R)
    box(bm, book_at((0.002, -0.0165, 0.017)), (0.034, 0.0025, 0.008), 'trim', rot=BOOK_R)
    for cx, cz in ((0.031, 0.043), (0.031, -0.043)):
        box(bm, book_at((cx, -0.0145, cz)), (0.012, 0.006, 0.012), 'trim', rot=BOOK_R)
    out(PFX + 'Book', bm, MID, smooth=False)


CAP = [(0.052, 0.760), (0.078, 0.750), (0.118, 0.727), (0.152, 0.697), (0.174, 0.657), (0.183, 0.625), (0.185, 0.615),
       (0.188, 0.6), (0.192, 0.584), (0.195, 0.566), (0.183, 0.560), (0.172, 0.600), (0.157, 0.655), (0.133, 0.698),
       (0.095, 0.730), (0.050, 0.748)]
CAP_SLOT = ['coat'] * 5 + ['accent', 'coat', 'trim', 'trim', 'trim'] + ['second'] * 5 + ['coat']


def build_mantle():
    bm = new_bm()
    lathe(bm, CAP, 72, lambda i, j: CAP_SLOT[j], sy=SY, wrap=True,
          rmod=lambda r, z, a, j: r + (0.006 * math.cos(12 * a) if j in (8, 9, 10) else 0.0))
    out(PFX + 'Capelet', bm, BIG, sharp=50)
    bm = new_bm()
    for k in range(12):
        a = math.radians(30 * k)
        if abs(math.degrees(a) - 270) < 1:
            continue
        ellipsoid(bm, (0.2045 * math.cos(a), SY * 0.2045 * math.sin(a), 0.5735), (0.0062,) * 3, 'gem', segs=10, rings=6)
    out(PFX + 'CapeletGems', bm, SMALL, sharp=60)


def cape_P(i, j, nu=40, nv=22):
    th = math.radians(-8 + 196 * i / nu)
    v = j / nv
    z = 0.665 - (0.665 - 0.088) * v
    side = 0.5 + 0.5 * math.cos(th)
    fl = POSE['cape_flare']
    r = 0.168 + 0.17 * v ** 0.85 + (0.016 + 0.008 * side * fl) * v ** 1.3 * math.cos(7 * (th - math.pi / 2))
    x = r * math.cos(th) + 0.02 * fl * v * v * side
    y = r * math.sin(th) * 0.95 + 0.03 * v * v + 0.03 * fl * v * v * (0.6 + 0.4 * math.sin(th))
    return Vector((x, y, z + 0.018 * fl * v * v * side))


def collar_P(i, j, nu=32, nv=6):
    th = math.radians(-22 + 224 * i / nu)
    v = j / nv
    ztop = 0.795 + 0.06 * (math.sin(th) + 0.4) / 1.4
    z = 0.703 + (ztop - 0.703) * v
    r = 0.12 + 0.062 * v * v
    return Vector((r * math.cos(th), r * math.sin(th) * 0.95, z))


def build_cape():
    def cape_out(i, j):
        if j >= 21 or i <= 1 or i >= 38:
            return 'trim'
        return 'accent' if j == 20 else 'coat'
    bm = new_bm()
    sheet(bm, cape_P, 40, 22, 0.01, cape_out, 'accent', 'trim', outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Cape', bm, BIG, sharp=60)
    bm = new_bm()
    sheet(bm, collar_P, 32, 6, 0.008, lambda i, j: 'trim' if j >= 5 else 'coat', 'accent', 'trim',
          outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Collar', bm, BIG, sharp=60)
    cb = bvh_of(O(PFX + 'Cape'))
    bm = new_bm()
    decal_band(bm, cb, [(0, 0.5), (0, 0.4), (0, 0.3), (0, 0.2), (0, 0.112)], [0.021, 0.022, 0.023, 0.024, 0.025], BACK,
               0.002, 'trim', n=30)
    out(PFX + 'CapeOrphrey', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    decal_poly(bm, cb, ellipse(0, 0.30, 0.104, 0.104, 40), BACK, 0.0026, 'main', rings=3)
    for z in (0.445, 0.165):
        decal_poly(bm, cb, [(x, z + zz) for x, zz in cross_poly(0.0052, 0.024, 0.03, 0.017, flare=0.0085, fl=0.007)],
                   BACK, 0.0034, 'accent', center=(0, z), rings=2)
    out(PFX + 'CapeMedallion', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    EZ = 0.30
    decal_poly(bm, cb, [(x, EZ + z) for x, z in cross_poly(0.013, 0.1, 0.12, 0.08, flare=0.022, fl=0.025)], BACK, 0.004,
               'trim', center=(0, EZ), rings=6)
    ring = [(0.066 * math.cos(2 * math.pi * k / 32), EZ + 0.066 * math.sin(2 * math.pi * k / 32)) for k in range(33)]
    decal_band(bm, cb, ring, [0.006] * 33, BACK, 0.003, 'trim', n=96)
    decal_band(bm, cb, [(0.098 * math.cos(2 * math.pi * k / 32), EZ + 0.098 * math.sin(2 * math.pi * k / 32))
                        for k in range(33)], [0.0028] * 33, BACK, 0.003, 'accent', n=96)
    out(PFX + 'CapeEmblem', bm, 0, sharp=80, recalc=False)


def build_fur():
    fur = [(0.104 + 0.03 * math.cos(2 * math.pi * q / 12), 0.752 + 0.026 * math.sin(2 * math.pi * q / 12))
           for q in range(12)]

    def fur_r(r, z, a, j):
        outer = math.cos(2 * math.pi * j / 12)
        tuft = max(0.0, math.sin(15 * a + 1.3 * j)) ** 2
        return r + 0.009 * tuft * max(0.0, outer + 0.3)
    bm = new_bm()
    lathe(bm, fur, 90, 'fur', rmod=fur_r, sy=SY, wrap=True)
    out(PFX + 'Fur', bm, MID, sharp=70)
    bm = new_bm()
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        rr, zz = (0.136, 0.757) if k % 2 == 0 else (0.13, 0.738)
        p = Vector((rr * math.cos(a), SY * rr * math.sin(a), zz))
        o = Vector((math.cos(a), SY * math.sin(a), 0.4)).normalized()
        ellipsoid(bm, p + o * 0.005, (0.0036, 0.0024, 0.0082), 'ink', segs=10, rings=6,
                  rot=Matrix.Rotation(a - math.pi / 2, 3, 'Z'))
    out(PFX + 'FurSpots', bm, SMALL, sharp=70)


PAULDRON_LAMES = ((0.69, 0.115, 44, 38, 0.0), (0.655, 0.1, 42, 56, 0.026), (0.62, 0.088, 40, 72, 0.048))


def pauldron_frames():
    capb = bvh_of(O(PFX + 'Capelet'))
    frames = []
    for s in (-1, 1):
        for k, (z0, R, alpha, tilt, push) in enumerate(PAULDRON_LAMES):
            A = Vector((s * math.sin(math.radians(tilt)), 0.0, math.cos(math.radians(tilt))))
            loc, _, _, _ = capb.ray_cast(Vector((s * 0.5, 0.0, z0 + 0.12)), Vector((-s * 0.5, 0, -0.12)).normalized())
            P0 = loc + Vector((s * push, 0, 0))
            al = math.radians(alpha)
            C0 = P0 + A * (0.009 + R * (1 - math.cos(al))) - A * R
            frames.append((s, k, A, C0, R, alpha))
    return frames


def dome(R, alpha, t=0.0065, n=7):
    a = math.radians(alpha)
    o = [(R * math.sin(a * k / n), R * math.cos(a * k / n)) for k in range(n + 1)]
    lip = [((R + 0.003) * math.sin(a) + 0.003, R * math.cos(a) - 0.0045)]
    inner = [((R - t) * math.sin(a * k / n), (R - t) * math.cos(a * k / n)) for k in range(n, -1, -1)]
    return o + lip + inner


def build_pauldrons():
    bm, bg, bi = new_bm(), new_bm(), new_bm()
    for s, k, A, C0, R, alpha in pauldron_frames():
        M = Matrix.Translation(C0) @ axis_to(A)
        lathe(bm, dome(R, alpha), 36, 'trim', xform=M, wrap=True,
              rmod=lambda r, z, a, j: r + (0.007 * max(0.0, math.cos(7 * a)) if j in (7, 8, 9) else 0.0))
        a2, a3 = math.radians(alpha * 0.72), math.radians(alpha * 0.86)
        ring = [((R + 0.0012) * math.sin(a2), (R + 0.0012) * math.cos(a2)), ((R + 0.0012) * math.sin(a3), (R + 0.0012) * math.cos(a3)),
                ((R - 0.002) * math.sin(a3), (R - 0.002) * math.cos(a3)), ((R - 0.002) * math.sin(a2), (R - 0.002) * math.cos(a2))]
        lathe(bi, ring, 36, 'accent', xform=M, wrap=True)
        if k == 0:
            apex = C0 + A * (R + 0.003)
            gem_cut(bg, Matrix.Translation(apex) @ axis_to(-A) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.019, 0.025,
                    0.025, 0.013)
    out(PFX + 'Pauldrons', bm, MID, sharp=35)
    out(PFX + 'PauldronInlay', bi, SMALL, sharp=35)
    out(PFX + 'PauldronGems', bg, SMALL, smooth=False)


def gor_pt(capb, th, v, off):
    dip = 0.05 * math.exp(-((math.degrees(th) + 90) / 24) ** 2)
    z = 0.738 - (0.738 - (0.702 - dip)) * v
    o = Vector((0.4 * math.cos(th), SY * 0.4 * math.sin(th), z))
    loc, nrm, _, _ = capb.ray_cast(o, Vector((-math.cos(th), -math.sin(th), 0)).normalized())
    return loc + nrm * off, nrm


def build_gorget():
    capb = bvh_of(O(PFX + 'Capelet'))
    bm = new_bm()
    sheet(bm, lambda i, j: gor_pt(capb, math.radians(-160 + 140 * i / 36), j / 4, 0.005)[0], 36, 4, 0.006, 'trim', 'trim',
          'trim', outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Gorget', bm, MID, sharp=40)
    GP = gor_pt(capb, math.radians(-90), 1.0, 0.005)[0] + Vector((0, -0.006, 0.01))
    bm = new_bm()
    slab(bm, [(0.0, 0.03), (0.026, 0.004), (0.022, -0.022), (0.0, -0.046), (-0.022, -0.022), (-0.026, 0.004)],
         Matrix.Translation(GP), 0.011, bevel=0.0022, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'GorgetBezel', bm, SMALL, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(GP + Vector((0, -0.006, -0.004))), 0.019, 0.026, 0.034, 0.013)
    out(PFX + 'GorgetGem', bm, SMALL, smooth=False)
    low, _ = on_surf(capb, 0.0, 0.622, 0.0)
    CC = Vector((0.0, low.y - 0.013, 0.583))
    bm = new_bm()
    slab(bm, cross_poly(0.0078, 0.032, 0.05, 0.03, flare=0.0125, fl=0.011), Matrix.Translation(CC), 0.0075, bevel=0.0018,
         seg=2)
    set_slot(bm, bm.faces, 'trim')
    lathe(bm, [(0.0055 + 0.0022 * math.cos(2 * math.pi * q / 8), 0.0022 * math.sin(2 * math.pi * q / 8)) for q in range(8)],
          16, 'trim', xform=Matrix.Translation(CC + Vector((0, 0, 0.039))) @ Matrix.Rotation(math.radians(90), 4, 'Y'),
          wrap=True)
    ellipsoid(bm, CC + Vector((0, -0.0045, 0)), (0.0085, 0.004, 0.0085), 'glow', segs=12, rings=8)
    for dx, dz in ((0.024, 0), (-0.024, 0), (0, 0.026), (0, -0.043)):
        ellipsoid(bm, CC + Vector((dx, -0.0042, dz)), (0.0042, 0.0025, 0.0042), 'gem', segs=10, rings=6)
    out(PFX + 'Pectoral', bm, SMALL, sharp=35)


def build_stole_panel():
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()
    for s in (-1, 1):
        zs = (0.715, 0.6, 0.45, 0.3, 0.19)
        decal_band(bm, rb, [(s * stole_x(z), z) for z in zs], [stole_w(z) for z in zs], FR, 0.0035, 'trim', n=40)
    out(PFX + 'Stole', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for s in (-1, 1):
        for z in (0.222, 0.3, 0.52):
            x = s * stole_x(z)
            decal_poly(bm, rb, [(x + px, z + pz) for px, pz in cross_poly(0.0042, 0.022, 0.028, 0.0155, flare=0.0068,
                                                                            fl=0.0065)], FR, 0.0062, 'accent',
                       center=(x, z), rings=2)
    out(PFX + 'StoleCross', bm, 0, sharp=80, recalc=False)

    def x_in(z):
        return stole_x(z) - stole_w(z) - 0.003
    zs = [0.196, 0.25, 0.33, 0.424]
    panel = [(-x_in(zs[0]), zs[0]), (x_in(zs[0]), zs[0])] + [(x_in(z), z) for z in zs[1:]] + \
            [(-x_in(z), z) for z in reversed(zs[1:])]
    bm = new_bm()
    decal_poly(bm, rb, panel, FR, 0.002, 'second', center=(0, 0.31), rings=4)
    out(PFX + 'Panel', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for cz in (0.232, 0.306, 0.38):
        decal_poly(bm, rb, [(0, cz - 0.029), (0.02, cz), (0, cz + 0.029), (-0.02, cz)], FR, 0.0034, 'trim', center=(0, cz),
                   rings=3)
    out(PFX + 'PanelGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for cz in (0.232, 0.306, 0.38):
        decal_poly(bm, rb, [(0, cz - 0.02), (0.0138, cz), (0, cz + 0.02), (-0.0138, cz)], FR, 0.0042, 'second',
                   center=(0, cz), rings=2)
    for cz in (0.269, 0.343):
        decal_poly(bm, rb, ellipse(0, cz, 0.0045, 0.0045, 12), FR, 0.0042, 'trim', rings=1)
    out(PFX + 'PanelInset', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for cz in (0.232, 0.306, 0.38):
        decal_poly(bm, rb, ellipse(0, cz, 0.0066, 0.0066, 14), FR, 0.0052, 'gem', rings=1)
    for k in range(15):
        a = math.radians(-90 + (k - 7) * 13)
        p = ray_in(rb, a, 0.147)
        if p is not None:
            n = Vector((p.x, p.y, 0)).normalized()
            ellipsoid(bm, p + n * 0.003, (0.0052, 0.0052, 0.0052), 'gem', segs=10, rings=6)
    out(PFX + 'PanelGems', bm, 0, sharp=80, recalc=False)


OS_NU, OS_NV = 18, 14


def overskirt_P(rb, s):
    def P(i, j):
        u = i / OS_NU
        v = j / OS_NV
        az = 27 + 75 * u
        th = math.radians(-90 + s * az)
        zh = 0.152 - 0.024 * u + 0.012 * math.sin(math.pi * u)
        z = 0.445 + (zh - 0.445) * v
        hit = ray_in(rb, th, z)
        n = Vector((hit.x, hit.y, 0)).normalized()
        return hit + n * (0.006 + 0.02 * v ** 1.3)
    return P


def build_overskirt():
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()

    def outer(i, j):
        if j >= OS_NV - 2 or i <= 1:
            return 'trim'
        if j == OS_NV - 3 or i == 2:
            return 'accent'
        return 'coat'
    for s in (-1, 1):
        sheet(bm, overskirt_P(rb, s), OS_NU, OS_NV, 0.006, outer, 'accent', 'trim',
              outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'OverSkirt', bm, MID, sharp=45)


def skirt_bvh():
    return bvh_of(O(PFX + 'Robe'), O(PFX + 'OverSkirt'))


def build_waist():
    sk = skirt_bvh()
    # tassets over the navy panels
    NU, NV = 10, 8
    bm, bg = new_bm(), new_bm()
    for s in (-1, 1):
        for az, half, z0, zb in ((54, 15, 0.448, 0.292), (76, 14, 0.44, 0.305)):
            def P(i, j, az=az, half=half, z0=z0, zb=zb):
                u = -1 + 2 * i / NU
                v = j / NV
                th = math.radians(-90 + s * (az + half * u))
                z = z0 + (zb + 0.024 * u * u - z0) * v
                hit = ray_in(sk, th, z)
                n = Vector((hit.x, hit.y, 0)).normalized()
                return hit + n * (0.007 + 0.026 * v ** 1.5)
            sheet(bm, P, NU, NV, 0.006, lambda i, j: 'accent' if j == NV - 2 else 'trim', 'second', 'trim',
                  outward=lambda p: Vector((p.x, p.y, 0)))
            top = P(NU // 2, 1)
            n = Vector((top.x, top.y, 0)).normalized()
            gem_cut(bg, Matrix.Translation(top + n * 0.007) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'),
                    0.011, 0.014, 0.016, 0.008)
    out(PFX + 'Tassets', bm, MID, sharp=40)
    out(PFX + 'TassetGems', bg, SMALL, smooth=False)
    # buckle
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
    # cincture cord, knot, tasselled ends
    bm = new_bm()
    ring = [(0.182 + 0.0045 * math.cos(2 * math.pi * q / 8), 0.456 + 0.0045 * math.sin(2 * math.pi * q / 8))
            for q in range(8)]
    lathe(bm, ring, 80, 'trim', sy=SY, wrap=True)
    kx = -0.112
    ky = -0.9 * math.sqrt(0.182 ** 2 - kx ** 2)
    K = Vector((kx, ky - 0.004, 0.456))
    ellipsoid(bm, K, (0.013, 0.01, 0.012), 'trim', segs=12, rings=8)
    for dx, zend in ((-0.004, 0.318), (0.014, 0.338)):
        pts = [K + Vector((dx * 0.3, -0.004, -0.008))]
        for z in (0.41, 0.37, zend):
            pts.append(on_surf(sk, kx + dx * (0.456 - z) / 0.14, z, 0.008)[0])
        tube(bm, pts, 0.0036, 'trim', n=16, k=6)
        tassel(bm, pts[-1] + Vector((0, 0, -0.004)), 'trim', length=0.048, r=0.011)
    out(PFX + 'Cincture', bm, SMALL, sharp=45)
    # rosary from the book hand
    H = Vector((0.152, -0.176, 0.478))
    loop = [H + Vector((-0.012, 0, 0))]
    for z, dx in ((0.44, -0.016), (0.40, -0.012), (0.372, 0.0)):
        p = on_surf(sk, H.x + dx, z, 0.012)[0]
        loop.append(Vector((p.x, min(p.y, H.y + 0.012), z)))
    for z, dx in ((0.40, 0.012), (0.44, 0.016)):
        p = on_surf(sk, H.x + dx, z, 0.012)[0]
        loop.append(Vector((p.x, min(p.y, H.y + 0.012), z)))
    loop.append(H + Vector((0.012, 0, 0)))
    bm = new_bm()
    for k, p in enumerate(resample(loop, 0.0125)):
        big = k % 6 == 3
        ellipsoid(bm, p, (0.0068,) * 3 if big else (0.0052,) * 3, 'gem' if big else 'white', segs=10, rings=6)
    bot = loop[3]
    for p in (bot + Vector((0, -0.002, -0.014)), bot + Vector((0.001, -0.003, -0.027))):
        ellipsoid(bm, p, (0.0055,) * 3, 'white', segs=10, rings=6)
    out(PFX + 'RosaryBeads', bm, SMALL, sharp=60)
    bm = new_bm()
    slab(bm, cross_poly(0.0045, 0.014, 0.024, 0.0135, flare=0.0068, fl=0.005),
         Matrix.Translation(bot + Vector((0.001, -0.004, -0.052))), 0.0045, bevel=0.0011, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'RosaryCross', bm, SMALL, sharp=35)


def build_staff():
    M = Matrix.Translation((SX, SYY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0105, 0.082), (0.0105, 1.215), (0.0, 1.215)], 16, 'coat', xform=M)
    for z0, h, r in ((0.082, 0.03, 0.016), (0.47, 0.014, 0.0155), (0.585, 0.014, 0.0155), (1.19, 0.04, 0.018)):
        lathe(bm, [(0.0, z0), (r * 0.9, z0), (r, z0 + h * 0.3), (r, z0 + h * 0.7), (r * 0.9, z0 + h), (0.0, z0 + h)],
              16, 'trim', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    CC = Vector((SX, SYY, 1.27))
    bm = new_bm()
    ring = [(0.05 + 0.006 * math.cos(2 * math.pi * q / 10), 0.0045 * math.sin(2 * math.pi * q / 10)) for q in range(10)]
    lathe(bm, ring, 56, 'trim', xform=Matrix.Translation(CC) @ Matrix.Rotation(math.radians(90), 4, 'X'), wrap=True)
    lathe(bm, [(0.0, 1.19), (0.016, 1.19), (0.021, 1.205), (0.014, 1.222), (0.0, 1.224)], 16, 'trim', xform=M)
    for s in (-1, 1):
        for k, (ang, L, W) in enumerate(((-6, 0.085, 0.019), (22, 0.108, 0.021), (50, 0.094, 0.018))):
            a = math.radians(ang)
            Mw = Matrix.Translation(CC + Vector((s * 0.05, 0.0, -0.004))) @ Matrix.Rotation(s * (math.pi / 2 - a), 4, 'Y')
            slab(bm, leaf(L, W, -0.2, n=10), Mw @ Matrix.Translation((0, 0.0025 * k, 0)), 0.0065, bevel=0.0015, seg=1)
    slab(bm, cross_poly(0.0065, 0.04, 0.012, 0.022, flare=0.011, fl=0.009), Matrix.Translation(CC + Vector((0, 0, 0.074))),
         0.008, bevel=0.0017, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'StaffHead', bm, MID, sharp=30)
    bm = new_bm()
    crystal(bm, CC + Vector((0, 0, -0.004)), 0.024, 0.05, 0.04, n=6, twist=0.3)
    for k, (dx, dz, r) in enumerate(((-0.075, 0.03, 0.007), (0.072, 0.045, 0.0085), (0.06, -0.05, 0.006),
                                      (-0.066, -0.038, 0.0055))):
        crystal(bm, CC + Vector((dx, -0.01, dz)), r, r * 1.6, r * 1.6, n=4, slot='glow', twist=0.4 * k)
    out(PFX + 'StaffCrystal', bm, SMALL, smooth=False)
    K = Vector((SX, SYY, 1.188))
    bm = new_bm()
    ellipsoid(bm, K, (0.021, 0.019, 0.014), 'accent', segs=14, rings=8)
    rib = lambda t: 1.0 - t ** 5
    front = lambda c: c + Vector((0, 0.5, 0))
    strand(bm, [K + Vector((-0.012, -0.006, 0)), K + Vector((-0.034, -0.016, -0.05)), K + Vector((-0.048, -0.01, -0.11)),
                K + Vector((-0.055, 0.0, -0.165))], 0.016, 0.0035, 'accent', front, n=14, k=8, prof=rib)
    strand(bm, [K + Vector((0.012, -0.004, 0)), K + Vector((0.03, -0.006, -0.045)), K + Vector((0.04, 0.004, -0.1)),
                K + Vector((0.04, 0.016, -0.14))], 0.016, 0.0035, 'accent', front, n=12, k=8, prof=rib)
    out(PFX + 'Ribbon', bm, MID, sharp=60)


# ================================================================== head, face, hair
EX, EZ, IW, IH = 0.088, 0.944, 0.0335, 0.042


def build_head():
    bm = new_bm()
    ret = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR)
    for v in ret['verts']:
        v.co = deform(v.co + HC)
    set_slot(bm, bm.faces, 'skin')
    head = out(PFX + 'Head', bm, BIG, sharp=80)
    bvh = bvh_of(head)
    bm = new_bm()
    for s in (-1, 1):
        ex = s * EX
        decal_poly(bm, bvh, ellipse(ex, EZ, IW, IH, 32), FR, 0.0015, 'eyes', rings=3)
        decal_poly(bm, bvh, ellipse(ex + s * 0.002, EZ - 0.014, 0.025, 0.02, 24), FR, 0.002, 'iris2', rings=2)
        decal_poly(bm, bvh, ellipse(ex, EZ + 0.005, 0.0145, 0.02, 24), FR, 0.0027, 'ink', rings=2)
        decal_poly(bm, bvh, ellipse(ex - 0.0115, EZ + 0.016, 0.0095, 0.0105, 20), FR, 0.0037, 'white', rings=2)
        decal_poly(bm, bvh, ellipse(ex + 0.0115, EZ - 0.017, 0.0046, 0.0046, 14), FR, 0.0037, 'white', rings=1)
        lash = [(-1.0, 0.42), (-0.5, 0.86), (0.2, 1.0), (0.8, 0.9), (1.12, 0.62), (1.46, 0.84)]
        decal_band(bm, bvh, [(ex + s * IW * u, EZ + IH * w) for u, w in lash],
                   [0.0018, 0.0056, 0.0076, 0.0078, 0.0066, 0.0014], FR, 0.0047, 'ink', n=30)
        low = [(0.22, -1.0), (0.64, -0.92), (0.98, -0.62)]
        decal_band(bm, bvh, [(ex + s * IW * u, EZ + IH * w) for u, w in low], [0.0009, 0.0021, 0.0009], FR, 0.003, 'ink',
                   n=10)
        decal_poly(bm, bvh, ellipse(s * 0.123, 0.894, 0.019, 0.0085, 18), FR, 0.0012, 'blush', rings=2)
        for (u0, w0), (u1, w1), hw in (((1.18, 0.74), (1.6, 1.08), 0.0042), ((0.88, 0.93), (1.18, 1.32), 0.0036)):
            b0 = (ex + s * IW * u0, EZ + IH * w0)
            tip = (ex + s * IW * u1, EZ + IH * w1)
            dx, dz = tip[0] - b0[0], tip[1] - b0[1]
            ln = math.hypot(dx, dz)
            px, pz = -dz / ln * hw, dx / ln * hw
            decal_poly(bm, bvh, [(b0[0] + px, b0[1] + pz), tip, (b0[0] - px, b0[1] - pz)], FR, 0.0049, 'ink', rings=1)
        crease = [(-0.55, 1.24), (0.1, 1.36), (0.75, 1.27), (1.12, 1.04)]
        decal_band(bm, bvh, [(ex + s * IW * u, EZ + IH * w) for u, w in crease], [0.0006, 0.0013, 0.0012, 0.0005], FR,
                   0.0016, 'lskin', n=16)
    # smaller, slightly lifted mouth for the narrower chin; a nose tick
    decal_band(bm, bvh, [(-0.014, 0.866), (-0.0045, 0.8615), (0.0065, 0.8625), (0.0155, 0.8705)],
               [0.0008, 0.002, 0.002, 0.0009], FR, 0.0015, 'ink', n=12)
    decal_band(bm, bvh, [(0.0035, 0.9), (0.0005, 0.891), (-0.002, 0.888)], [0.0006, 0.0013, 0.0007], FR, 0.0016,
               'lskin', n=8)
    out(PFX + 'Face', bm, 0, sharp=80, recalc=False)


def hem(phi):
    a = abs(phi)
    if a < 50:
        base = 24.0
    elif a < 100:
        u = (a - 50) / 50
        base = 24 - 60 * (u * u * (3 - 2 * u))
    else:
        u = min(1.0, (a - 100) / 50)
        base = -36 - 16 * (u * u * (3 - 2 * u))
    tooth = abs(((phi + 7) / 15.0) % 2 - 1)
    return base - (10 if a > 45 else 3) * (1 - tooth) ** 1.6


def cap_pt(phi, el):
    h = hem(phi)
    t = (40 - el) / (40 - h)
    return surf(phi, el, 0.004 + 0.016 * max(0.0, t) ** 2.2, RH)


BANGS = [(-56, 4, 0.034), (-42, 7, 0.036), (-28, -1, 0.038), (-14, 4, 0.038), (0, -9, 0.04), (14, 2, 0.038),
         (28, 6, 0.038), (42, 0, 0.036), (56, 5, 0.034)]
BANG_LAYER = [(-35, 12, 0.032), (-7, 9, 0.034), (21, 12, 0.032), (49, 14, 0.03)]
TUFTS = [(90, 16, 104, -2, 0.065, 0.034), (106, 20, 122, 4, 0.075, 0.036), (122, 14, 140, -8, 0.07, 0.034),
         (138, 10, 156, -16, 0.06, 0.03), (160, 8, 172, -22, 0.05, 0.03), (78, 28, 90, 36, 0.05, 0.028)]


def bang_pts(phi, tip):
    sw = -5
    return [surf(phi, 27, 0.004, RH), surf(phi + sw * 0.3, 15, 0.007, RH), surf(phi + sw * 0.7, (15 + tip) / 2, 0.011, RH),
            surf(phi * 0.92 + sw, tip, 0.018, RH)]


def layer_pts(phi, tip):
    sw = -5
    return [surf(phi, 29, 0.012, RH), surf(phi + sw * 0.3, 20, 0.018, RH), surf(phi * 0.95 + sw, tip, 0.026, RH)]


def front_lock_pts(s):
    return [surf(s * 60, 22, 0.006, RH), surf(s * 66, -8, 0.016, RH), surf(s * 64, -32, 0.028, RH),
            Vector((s * 0.178, -0.094, 0.78)), Vector((s * 0.168, -0.128, 0.68)), Vector((s * 0.152, -0.155, 0.6))]


def back_lock_pts(s):
    return [surf(s * 74, 16, 0.006, RH), surf(s * 82, -12, 0.016, RH), surf(s * 80, -36, 0.026, RH),
            Vector((s * 0.212, -0.04, 0.775))]


def tuft_pts(s, t):
    phi, el, tphi, tel, dr, w = t
    return [surf(s * phi, el, -0.004, RH), surf(s * (phi + tphi) / 2, (el + tel) / 2, dr * 0.45, RH),
            surf(s * tphi, tel, dr, RH)]


TH, GAP = 0.012, 0.014


def make_back_y():
    backs = [bvh_of(O(n)) for n in (PFX + 'Collar', PFX + 'Capelet', PFX + 'Cape')]

    def back_y(x, z):
        best = None
        for b in backs:
            loc, _, _, _ = b.ray_cast(Vector((x, 1.0, z)), Vector((0, -1, 0)))
            if loc is not None and (best is None or loc.y > best):
                best = loc.y
        return best if best is not None else 0.2
    return back_y


def curtain_pt(back_y, u, z, extra=0.0):
    x = 0.125 * u * (1 + 0.25 * (0.86 - z) / 0.4)
    return Vector((x, back_y(x, z) + TH + GAP + extra, z))


def curtain_tooth(u):
    return abs(((u * 3.5 + 0.25) % 1.0) * 2 - 1)


def build_hair():
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
    for phi, tip, w in BANG_LAYER:
        strand(bm, layer_pts(phi, tip), w, 0.01, 'hair', HC, n=10, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        strand(bm, front_lock_pts(s), 0.046, 0.014, 'hair', body_center, n=20, k=10, prof=bang_prof)
        strand(bm, back_lock_pts(s), 0.034, 0.012, 'hair', body_center, n=14, k=10, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        for t in TUFTS:
            strand(bm, tuft_pts(s, t), t[5], 0.012, 'hair', HC, n=10, k=8)
    out(PFX + 'HairTufts', bm, MID, sharp=70)
    # cuffs binding the long front locks
    bm = new_bm()
    for s in (-1, 1):
        F = strand_frames(front_lock_pts(s), body_center, 20)
        i = 9
        c, t, sd, nr = F[i]
        f = bang_prof(i / 20)
        M = Matrix.Identity(4)
        M.col[0] = (*(sd * (0.046 * f + 0.003)), 0)
        M.col[1] = (*(nr * (0.014 * f + 0.003)), 0)
        M.col[2] = (*t, 0)
        M.col[3] = (*c, 1)
        lathe(bm, [(1.0, -0.0075), (1.22, -0.0045), (1.22, 0.0045), (1.0, 0.0075)], 20, 'trim', xform=M, wrap=True)
    out(PFX + 'HairCuffs', bm, SMALL, sharp=45)
    # the long back fall lying on collar, mantle and cape
    back_y = make_back_y()
    NU, NV = 42, 16
    colsC = []
    for i in range(NU + 1):
        u = -1 + 2 * i / NU
        phi = 180 + 44 * u
        zh = 0.47 + 0.06 * abs(u) ** 1.4 + 0.07 * curtain_tooth(u)
        ctrl = [surf(phi, 6, -0.003, RH), surf(phi, -28, 0.02, RH)]
        ctrl += [curtain_pt(back_y, u, z) for z in (0.76, 0.64, 0.55)] + [curtain_pt(back_y, u, zh, 0.002)]
        colsC.append(catmull(ctrl, NV))
    bm = new_bm()
    sheet(bm, lambda i, j: colsC[i][j], NU, NV, TH, 'hair', 'hair', 'hair',
          outward=lambda p: Vector((p.x, p.y, 0)) if p.z < 0.86 else (p - HC))
    out(PFX + 'HairBack', bm, BIG, sharp=60)
    bm = new_bm()
    for u, zt in ((-0.62, 0.6), (-0.2, 0.52), (0.22, 0.56), (0.64, 0.62)):
        phi = 180 + 44 * u
        pts = [surf(phi, 2, 0.004, RH), surf(phi, -28, 0.034, RH)] + \
              [curtain_pt(back_y, u, z, TH + 0.008) for z in (0.76, 0.66)] + [curtain_pt(back_y, u * 1.05, zt, TH + 0.01)]
        strand(bm, pts, 0.034, 0.011, 'hair', body_center, n=16, k=10)
    out(PFX + 'HairBackClumps', bm, MID, sharp=70)
    z = 0.735
    y = back_y(0.0, z) + 0.012 + 0.014 + 0.012
    bm = new_bm()
    lathe(bm, [(0.0, 0.0), (0.03, 0.0), (0.034, 0.005), (0.03, 0.011), (0.0, 0.0115)], 24, 'trim',
          xform=Matrix.Translation((0, y - 0.004, z)) @ axis_to((0, 1, 0)) @ Matrix.Diagonal((1.0, 0.55, 1.0, 1.0)))
    ellipsoid(bm, (0, y + 0.0085, z), (0.0095, 0.006, 0.0075), 'gem', segs=12, rings=8)
    for dx in (-0.021, 0.021):
        ellipsoid(bm, (dx, y + 0.006, z), (0.004, 0.004, 0.004), 'white', segs=8, rings=6)
    out(PFX + 'HairClasp', bm, SMALL, sharp=45)


def build_brows():
    bvh = bvh_of(O(PFX + 'Head'), O(PFX + 'Bangs'))
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, bvh, [(s * 0.05, EZ + 0.064), (s * 0.084, EZ + 0.078), (s * 0.122, EZ + 0.072)],
                   [0.0022, 0.0044, 0.0016], FR, 0.0035, 'lhair', n=18)
    out(PFX + 'Brows', bm, 0, sharp=80, recalc=False)


# ================================================================== tiara
TIERS = {
    1: [(0.212, ZB), (0.226, ZB), (0.231, ZB + 0.021), (0.226, ZB + 0.042), (0.212, ZB + 0.042)],
    2: [(0.2095, 1.203), (0.2245, 1.203), (0.226, 1.218), (0.2155, 1.234), (0.1995, 1.234)],
    3: [(0.165, 1.276), (0.1795, 1.276), (0.18, 1.289), (0.166, 1.302), (0.141, 1.302)],
}
DOME = [(0.0, ZB + 0.035), (0.222, ZB + 0.035), (0.227, 1.14), (0.223, 1.18), (0.211, 1.215), (0.193, 1.25),
        (0.169, 1.28), (0.137, 1.306), (0.099, 1.326), (0.057, 1.34), (0.018, 1.347), (0.0, 1.348)]


def emblem_frame():
    tb = bvh_of(O(PFX + 'Tiara'))
    loc, en, _, _ = tb.ray_cast(Vector((0, -1, 1.152)), Vector((0, 1, 0)))
    return Matrix.Translation(loc + en * 0.010) @ Matrix.Rotation(-0.45 * math.atan2(en.z, -en.y), 4, 'X')


EMBLEM_FEATHERS = ((8, 0.095, 0.021), (32, 0.118, 0.023), (58, 0.104, 0.02))


def feather_frame(FM, s, k, ang):
    a = math.radians(ang)
    return FM @ Matrix.Translation((s * 0.03, 0.003 + 0.0025 * k, -0.006 + 0.007 * k)) @ \
        Matrix.Rotation(s * (math.pi / 2 - a), 4, 'Y')


def build_tiara():
    bm = new_bm()
    lathe(bm, DOME, 64, 'main')
    bmesh.ops.transform(bm, matrix=TILT, verts=bm.verts[:])
    out(PFX + 'Tiara', bm, BIG, sharp=40)
    bm = new_bm()
    for prof in TIERS.values():
        lathe(bm, prof, 64, 'trim', wrap=True)
    bmesh.ops.transform(bm, matrix=TILT, verts=bm.verts[:])
    out(PFX + 'TiaraTiers', bm, MID, sharp=40)
    # fleur-de-lis points standing on each tier
    bm = new_bm()
    for (r, z), count, L, W, skip in (((0.226, ZB + 0.042), 12, 0.062, 0.018, 26), ((0.2155, 1.234), 10, 0.052, 0.016, 30),
                                      ((0.166, 1.302), 8, 0.044, 0.013, 0)):
        for q in range(count):
            a = 2 * math.pi * (q + (0.5 if count == 10 else 0.0)) / count
            if skip and abs(((math.degrees(a) + 90 + 180) % 360) - 180) < skip:
                continue
            M = TILT @ Matrix.Translation((r * math.cos(a), r * math.sin(a), z - 0.006)) @ \
                Matrix.Rotation(a - math.pi / 2, 4, 'Z') @ Matrix.Rotation(-0.17, 4, 'X')
            slab(bm, leaf(L, W, 0.0, n=8), M, 0.006, bevel=0.0013, seg=1)
            for sg in (-1, 1):
                Ms = M @ Matrix.Translation((sg * W * 0.45, 0, 0.002)) @ Matrix.Rotation(sg * math.radians(40), 4, 'Y')
                slab(bm, leaf(L * 0.62, W * 0.78, -sg * 0.3, n=6), Ms, 0.0055, bevel=0.0, seg=1)
            slab(bm, [(-W * 1.15, -0.003), (W * 1.15, -0.003), (W * 1.15, 0.005), (-W * 1.15, 0.005)],
                 M @ Matrix.Translation((0, 0, L * 0.18)), 0.0065, bevel=0.0009, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'TiaraPoints', bm, MID, sharp=30)
    # orb and cross on top
    bm = new_bm()
    ellipsoid(bm, TILT @ Vector((0, 0, 1.364)), (0.02, 0.02, 0.02), 'trim', segs=16, rings=10)
    slab(bm, cross_poly(0.0055, 0.016, 0.012, 0.013, flare=0.0085, fl=0.0055), TILT @ Matrix.Translation((0, 0, 1.384)),
         0.0065, bevel=0.0013, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'TiaraTop', bm, MID, sharp=35)
    # jewels: gems faceted, pearls round
    bg, bp = new_bm(), new_bm()
    def jewel(deg, r, z, kind):
        a = math.radians(deg)
        p = TILT @ Vector((r * math.cos(a), r * math.sin(a), z))
        rot = TILT.to_3x3() @ Matrix.Rotation(a - math.pi / 2, 3, 'Z')
        if kind == 'white':
            ellipsoid(bp, p, (0.0062,) * 3, 'white', segs=12, rings=8, rot=rot)
        else:
            gem_cut(bg, Matrix.Translation(p) @ rot.to_4x4() @ Matrix.Rotation(math.pi, 4, 'Z'), 0.0085, 0.011, 0.011,
                    0.006)
    for deg, kind in ((-120, 'gem'), (-60, 'gem'), (-148, 'white'), (-32, 'white'), (-176, 'gem'), (-4, 'gem'),
                      (90, 'gem'), (30, 'white'), (150, 'white'), (60, 'gem'), (120, 'gem')):
        jewel(deg, 0.2335, ZB + 0.021, kind)
    for k in range(10):
        deg = -90 + 36 * k + 18
        if abs(((deg + 90 + 180) % 360) - 180) < 30:
            continue
        jewel(deg, 0.2285, 1.2185, 'gem' if k % 2 else 'white')
    for k in range(6):
        jewel(-90 + 60 * k, 0.1825, 1.289, 'gem')
    out(PFX + 'TiaraJewels', bg, SMALL, smooth=False)
    out(PFX + 'TiaraPearls', bp, SMALL, sharp=60)
    # winged emblem with the big gem on the front
    FM = emblem_frame()
    bm = new_bm()
    slab(bm, [(0.0, 0.054), (0.035, 0.012), (0.031, -0.024), (0.0, -0.066), (-0.031, -0.024), (-0.035, 0.012)], FM,
         0.012, bevel=0.0025, seg=2)
    for s in (-1, 1):
        for k, (ang, L, W) in enumerate(EMBLEM_FEATHERS):
            slab(bm, leaf(L, W, -0.18, n=10), feather_frame(FM, s, k, ang), 0.0062, bevel=0.0015, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'TiaraEmblem', bm, MID, sharp=30)
    bm = new_bm()
    gem_cut(bm, FM @ Matrix.Translation((0, -0.004, -0.004)), 0.025, 0.04, 0.05, 0.017)
    out(PFX + 'TiaraGem', bm, SMALL, smooth=False)
    # lappets down the back with fringe and gems
    lap = lambda t: 1.0 - 0.15 * t
    bm, bf = new_bm(), new_bm()
    for s in (-1, 1):
        pts = [surf(180 + s * 14, 30, 0.012, RH), surf(180 + s * 15, 8, 0.03, RH), surf(180 + s * 16, -16, 0.04, RH),
               surf(180 + s * 17, -36, 0.05, RH)]
        strand(bm, pts, 0.019, 0.004, 'trim', HC, n=14, k=8, prof=lap)
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


# ================================================================== drawn lines
def build_lines():
    K = 1.5
    capb = bvh_of(O(PFX + 'Capelet'))
    # ---- body gold engravings
    bm = new_bm()
    for s, k, A, C0, R, alpha in pauldron_frames():
        al = math.radians(alpha)
        Rm = axis_to(A).to_3x3()
        U, V = Rm @ Vector((1, 0, 0)), Rm @ Vector((0, 1, 0))

        def on_dome(th, ph):
            d = A * math.cos(th) + (U * math.cos(ph) + V * math.sin(ph)) * math.sin(th)
            return C0 + d * R, d
        for frac in ((0.6,) if k else (0.6, 0.3)):
            pts = [on_dome(frac * al, 2 * math.pi * q / 72) for q in range(73)]
            strip(bm, [p for p, _ in pts], [d for _, d in pts], [0.0019 * K] * 73, 'lgold', 0.0012)
        if k == 0:
            pts = [on_dome(al * (0.45 + 0.08 * math.sin(6 * 2 * math.pi * q / 144)), 2 * math.pi * q / 144)
                   for q in range(145)]
            strip(bm, [p for p, _ in pts], [d for _, d in pts], [0.0015 * K] * 145, 'lgold', 0.0012)
    BKL = Vector((0.0, -0.9 * 0.177 - 0.006, 0.455))
    outl = [(-0.03, -0.021), (0.03, -0.021), (0.036, 0.0), (0.03, 0.021), (-0.03, 0.021), (-0.036, 0.0)]
    flat_line(bm, Matrix.Translation(BKL), [(x * 0.8, z * 0.72) for x, z in outl], -1, 0.0012 * K, 'lgold', closed=True,
              half=0.0045, n=60)
    for v in (0.22, 0.8):
        pts = [gor_pt(capb, math.radians(-156 + 132 * q / 60), v, 0.005) for q in range(61)]
        strip(bm, [p for p, _ in pts], [n for _, n in pts], widths(61, 0.0015 * K, 'both'), 'lgold', 0.0012)
    pts = [gor_pt(capb, math.radians(-150 + 120 * q / 120), 0.5 + 0.12 * math.sin(6 * 2 * math.pi * q / 120), 0.005)
           for q in range(121)]
    strip(bm, [p for p, _ in pts], [n for _, n in pts], widths(121, 0.0012 * K, 'both'), 'lgold', 0.0012)
    for q in range(6):
        p, n = gor_pt(capb, math.radians(-150 + 120 * (q + 0.25) / 6), 0.62, 0.0062)
        ellipsoid(bm, p, (0.0028,) * 3, 'lgold', segs=8, rings=6)
    sk = skirt_bvh()
    for s in (-1, 1):
        for az, half, z0, zb in ((54, 15, 0.448, 0.292), (76, 14, 0.44, 0.305)):
            def TP(u, v):
                th = math.radians(-90 + s * (az + half * u))
                z = z0 + (zb + 0.024 * u * u - z0) * v
                hit = ray_in(sk, th, z)
                return hit + Vector((hit.x, hit.y, 0)).normalized() * (0.007 + 0.026 * v ** 1.5)
            path = [(u, 0.14) for u in (-0.74, -0.37, 0.0, 0.37, 0.74)] + [(0.74, v) for v in (0.35, 0.55)] + \
                   [(u, 0.7) for u in (0.74, 0.37, 0.0, -0.37, -0.74)] + [(-0.74, v) for v in (0.55, 0.35)]
            C = catmull_closed([TP(u, v) for u, v in path], 80)
            strip(bm, C, [Vector((c.x, c.y, 0)).normalized() for c in C], [0.0013 * K] * len(C), 'lgold', 0.0012)
            sc = [TP(-0.45 + 0.9 * q / 30, 0.42 + 0.12 * math.sin(3 * 2 * math.pi * q / 30)) for q in range(31)]
            strip(bm, sc, [Vector((c.x, c.y, 0)).normalized() for c in sc], widths(31, 0.0011 * K, 'both'), 'lgold', 0.0012)
    rb = bvh_of(O(PFX + 'Robe'))
    pts = []
    for q in range(241):
        a = 2 * math.pi * q / 240
        p = ray_in(rb, a, 0.147 + 0.011 * math.sin(26 * a))
        if p is not None:
            pts.append(p)
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    zs = [0.69, 0.6, 0.5, 0.4, 0.3, 0.2, 0.192]
    for s in (-1, 1):
        for e in (-1, 1):
            decal_band(bm, rb, [(s * (stole_x(z) + e * (stole_w(z) - 0.0036)), z) for z in zs], [0.0008 * K] * len(zs),
                       FR, 0.0049, 'lgold', n=60)
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
    osb = bvh_of(O(PFX + 'OverSkirt'))
    for s in (-1, 1):
        Pf = overskirt_P(rb, s)
        border = [Pf(2.4, j) for j in (0.5, 4, 8, 11.6)] + [Pf(i, 11.6) for i in (6, 11, 16, 18)]
        line3d(bm, osb, border, 0.0011 * K, 'lgold', n=60, taper='none')
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)

    # ---- tiara engravings (posed with the head)
    bm = new_bm()
    for z, r in ((ZB + 0.007, 0.2279), (ZB + 0.035, 0.2278), (1.207, 0.2252), (1.229, 0.2191), (1.279, 0.1799),
                 (1.297, 0.1717)):
        P = [TILT @ Vector((r * math.cos(2 * math.pi * q / 120), r * math.sin(2 * math.pi * q / 120), z)) for q in range(121)]
        N = [TILT.to_3x3() @ Vector((math.cos(2 * math.pi * q / 120), math.sin(2 * math.pi * q / 120), 0)) for q in range(121)]
        strip(bm, P, N, [0.0014 * K] * 121, 'lgold', 0.0012)
    FM = emblem_frame()

    def feather_lines(Mf, L, W, curve, sides):
        def c(u):
            return (curve * u * u * L, u * L)

        def edge(u, sgn):
            cx, cz = c(u)
            tx, tz = 2 * curve * u * L, L
            tl = math.hypot(tx, tz)
            nx, nz = tz / tl, -tx / tl
            w = W * (math.sin(math.pi * min(1.0, u * 1.25 + 0.08)) ** 0.6) * (1 - u) ** 0.45
            return (cx + sgn * nx * w * 0.72, cz + sgn * nz * w * 0.72)
        for side in sides:
            flat_line(bm, Mf, [c(u) for u in (0.06, 0.3, 0.55, 0.8, 0.9)], side, 0.0011 * K, 'lgold', half=0.0031, n=24)
            for q, ub in enumerate((0.26, 0.42, 0.58, 0.72)):
                flat_line(bm, Mf, [c(ub), edge(ub + 0.1, 1 if q % 2 == 0 else -1)], side, 0.0009 * K, 'lgold',
                          half=0.0031, n=6)
    for s in (-1, 1):
        for k, (ang, L, W) in enumerate(EMBLEM_FEATHERS):
            feather_lines(feather_frame(FM, s, k, ang), L, W, -0.18, (-1,))
    out(PFX + 'LinesTiara', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    CC = Vector((SX, SYY, 1.27))
    for s in (-1, 1):
        for k, (ang, L, W) in enumerate(((-6, 0.085, 0.019), (22, 0.108, 0.021), (50, 0.094, 0.018))):
            a = math.radians(ang)
            Mf = Matrix.Translation(CC + Vector((s * 0.05, 0.0, -0.004))) @ Matrix.Rotation(s * (math.pi / 2 - a), 4, 'Y') \
                @ Matrix.Translation((0, 0.0025 * k, 0))
            feather_lines(Mf, L, W, -0.2, (-1, 1))
    xn = (BOOK_R @ Vector((1, 0, 0))).normalized()
    for yy in (-0.0065, -0.002, 0.0025, 0.007):
        P = [BOOK_C + BOOK_R @ Vector((0.0352, yy, zz)) for zz in (-0.04, -0.02, 0.0, 0.02, 0.04)]
        strip(bm, P, [xn] * 5, [0.0005] * 5, 'lgold', 0.0004)
    out(PFX + 'LinesStaffBook', bm, 0, sharp=80, recalc=False)

    # ---- cloth folds
    bm = new_bm()
    capeb = bvh_of(O(PFX + 'Cape'))
    for th in (12.9, 64.3, 115.7, 167.1):
        i = (th + 8) / 196 * 40
        line3d(bm, capeb, [cape_P(i + 0.25 * (q - 2), 22 * v) for q, v in enumerate((0.28, 0.45, 0.62, 0.78, 0.93))],
               0.0026, 'lcoat', n=30)
        line3d(bm, capeb, [cape_P(i + 1.6, 22 * v) for v in (0.5, 0.66, 0.82)], 0.0018, 'lcoat', n=16)
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
                                 for zn in (0.32, 0.5, 0.66, 0.8)], 0.0017, 'lmain', n=18)
    for k in range(12):
        a = math.radians(15 + 30 * k)
        ctrl = [capb.find_nearest(Vector((0.3 * math.cos(a), 0.27 * math.sin(a), z)))[0] for z in (0.572, 0.59, 0.612)]
        line3d(bm, capb, ctrl, 0.0017, 'lcoat', n=10, taper='start')
    for s in (-1, 1):
        Pf = overskirt_P(rb, s)
        for ui in (6, 10, 14):
            line3d(bm, osb, [Pf(ui + 0.3 * q, j) for q, j in enumerate((2, 5, 8, 10.5))], 0.0022, 'lcoat', n=24)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)

    # ---- fur strokes
    bm = new_bm()
    furb = bvh_of(O(PFX + 'Fur'))
    for k in range(34):
        a = 2 * math.pi * k / 34
        ctrl = []
        for q, qa in enumerate((58, 38, 16)):
            rr = 0.104 + 0.03 * math.cos(math.radians(qa)) + 0.008
            aa = a + 0.035 * q * q
            ctrl.append(Vector((rr * math.cos(aa), SY * rr * math.sin(aa), 0.752 + 0.03 * math.sin(math.radians(qa)))))
        line3d(bm, furb, ctrl, 0.0009, 'lmain', n=8)
    out(PFX + 'LinesFur', bm, 0, sharp=80, recalc=False)

    # ---- hair strands
    bm = new_bm()
    capH = bvh_of(O(PFX + 'HairCap'))
    for m in range(-6, 6):
        pt = 30 * m + 8
        if abs(pt) < 52 or abs(pt) > 179:
            continue
        for dd in (-7, 7):
            line3d(bm, capH, [cap_pt(pt + dd, 30), cap_pt(pt + dd * 0.75, 12), cap_pt(pt + dd * 0.4, (12 + hem(pt)) / 2),
                              cap_pt(pt + dd * 0.25, hem(pt + dd * 0.25) + 3)], 0.0017, 'lhair', n=22)
        pv = 30 * m - 7
        if 52 < abs(pv) < 179:
            line3d(bm, capH, [cap_pt(pv, 32), cap_pt(pv, 10), cap_pt(pv, hem(pv) + 6)], 0.0014, 'lhair', n=16)

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
    for phi, tip, w in BANG_LAYER:
        strand_lines(layer_pts(phi, tip), w, 0.01, HC, 10, bang_prof, (0.0,))
    for s in (-1, 1):
        strand_lines(front_lock_pts(s), 0.046, 0.014, body_center, 20, bang_prof, (0.0, 0.5, -0.5))
        strand_lines(back_lock_pts(s), 0.034, 0.012, body_center, 14, bang_prof, (0.0,))
        for t in TUFTS:
            strand_lines(tuft_pts(s, t), t[5], 0.012, HC, 10, hair_prof, (0.0,))
    back_y = make_back_y()
    curtB = bvh_of(O(PFX + 'HairBack'))
    for k in range(-4, 4):
        for u, tipline in (((k + 0.25) / 3.5, True), ((k - 0.25) / 3.5 + 0.05, False)):
            if abs(u) > 0.95:
                continue
            phi = 180 + 44 * u
            zh = 0.47 + 0.06 * abs(u) ** 1.4 + 0.07 * curtain_tooth(u)
            line3d(bm, curtB, [surf(phi, -10, 0.026, RH), curtain_pt(back_y, u, 0.76, 0.004), curtain_pt(back_y, u, 0.64, 0.004),
                               curtain_pt(back_y, u, zh + (0.006 if tipline else 0.05), 0.004)], 0.0016, 'lhair', n=24)
    for u, zt in ((-0.62, 0.6), (-0.2, 0.52), (0.22, 0.56), (0.64, 0.62)):
        phi = 180 + 44 * u
        pts = [surf(phi, 2, 0.004, RH), surf(phi, -28, 0.034, RH)] + \
              [curtain_pt(back_y, u, z, TH + 0.008) for z in (0.76, 0.66)] + [curtain_pt(back_y, u * 1.05, zt, TH + 0.01)]
        strand_lines(pts, 0.034, 0.011, body_center, 16, hair_prof, (0.0,))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)

    # ---- gold scrolls on the navy: mantle front, cape back, over-skirt
    def scroll(cx, cz, s, size, turns=1.35, n=16):
        pts = []
        for k in range(n + 1):
            t = k / n
            r = size * (1 - 0.82 * t)
            th = math.radians(100) - turns * 2 * math.pi * t
            pts.append((cx + s * r * math.cos(th), cz + r * math.sin(th)))
        return pts
    bm = new_bm()
    for s in (-1, 1):
        p = [(s * 0.035, 0.598), (s * 0.07, 0.61), (s * 0.105, 0.628)] + scroll(s * 0.118, 0.612, s, 0.022)[1:]
        decal_band(bm, capb, p, [0.0015] + [0.0032] * 2 + [0.0032 * (1 - 0.7 * k / 16) for k in range(17)], FR, 0.0022,
                   'trim', n=60)
        p2 = [(s * 0.06, 0.6), (s * 0.075, 0.588)] + scroll(s * 0.088, 0.592, -s, 0.011, turns=1.1, n=10)[1:]
        decal_band(bm, capb, p2, [0.0012, 0.0024] + [0.0024 * (1 - 0.7 * k / 10) for k in range(11)], FR, 0.0022, 'trim',
                   n=36)
    cb = bvh_of(O(PFX + 'Cape'))
    for s in (-1, 1):
        p = [(s * 0.115, 0.13), (s * 0.13, 0.2), (s * 0.128, 0.29), (s * 0.14, 0.36)] + \
            scroll(s * 0.16, 0.39, s, 0.032, turns=1.3, n=18)[1:]
        decal_band(bm, cb, p, [0.0018, 0.004, 0.0045, 0.0045] + [0.0045 * (1 - 0.7 * k / 18) for k in range(19)], BACK,
                   0.0028, 'trim', n=80)
        for y0, y1, yc, sz in ((0.26, 0.24, 0.25, 0.018), (0.18, 0.165, 0.172, 0.016)):
            p = [(s * 0.128, y0), (s * 0.155, y1)] + scroll(s * 0.172, yc, s if y0 < 0.2 else -s, sz, turns=1.2, n=12)[1:]
            decal_band(bm, cb, p, [0.0018, 0.0035] + [0.0035 * (1 - 0.7 * k / 12) for k in range(13)], BACK, 0.0028,
                       'trim', n=40)
    for s in (-1, 1):
        Pf = overskirt_P(rb, s)
        ctrl = [Pf(4.5, 3.0), Pf(6.5, 4.6), Pf(9.0, 5.6)]
        cx, cz = 10.6, 6.6
        for k in range(1, 13):
            t = k / 12
            r = 2.2 * (1 - 0.8 * t)
            th = math.radians(200) - 1.3 * 2 * math.pi * t
            ctrl.append(Pf(cx + r * math.cos(th), cz + r * 0.9 * math.sin(th)))
        line3d(bm, osb, ctrl, 0.0032, 'trim', n=80, lift=0.0016)
        line3d(bm, osb, [Pf(8.0, 7.5), Pf(9.6, 9.0), Pf(12.0, 9.6), Pf(13.5, 8.6), Pf(13.0, 7.6)], 0.0024, 'trim', n=40,
               lift=0.0016)
    out(PFX + 'GoldScrolls', bm, 0, sharp=80, recalc=False)


# ================================================================== pose
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'HairCap', 'Bangs', 'HairLocks', 'HairTufts', 'HairCuffs', 'HairBack',
                 'HairBackClumps', 'HairClasp', 'LinesHair', 'Tiara', 'TiaraTiers', 'TiaraPoints', 'TiaraTop',
                 'TiaraJewels', 'TiaraPearls', 'TiaraEmblem', 'TiaraGem', 'Lappets', 'LappetFringe', 'LinesTiara']


def pose_head():
    roll, pitch = math.radians(POSE['head_roll']), math.radians(POSE['head_pitch'])
    piv = Vector((0, 0, 0.8))
    R = Matrix.Translation(piv) @ Matrix.Rotation(pitch, 4, 'X') @ Matrix.Rotation(roll, 4, 'Y') @ Matrix.Translation(-piv)

    def w(z):
        t = min(1.0, max(0.0, (z - 0.74) / 0.1))
        return t * t * (3 - 2 * t)
    for name in [PFX + x for x in HEAD_SUFFIXES]:
        ob = bpy.data.objects.get(name)
        if ob is None:
            continue
        me = ob.data
        for v in me.vertices:
            k = w(v.co.z)
            if k > 0:
                v.co = v.co.lerp(R @ v.co, k)
        me.update()


STAGES = ['base', 'robe', 'sleeves', 'gloves', 'mantle', 'cape', 'fur', 'pauldrons', 'gorget', 'stole', 'overskirt',
          'waist', 'staff', 'head', 'hair', 'brows', 'tiara', 'lines', 'pose']


def build(stages=None):
    fns = {'base': build_base, 'robe': build_robe, 'sleeves': build_sleeves, 'gloves': build_gloves_book,
           'mantle': build_mantle, 'cape': build_cape, 'fur': build_fur, 'pauldrons': build_pauldrons,
           'gorget': build_gorget, 'stole': build_stole_panel, 'overskirt': build_overskirt, 'waist': build_waist,
           'staff': build_staff, 'head': build_head, 'hair': build_hair, 'brows': build_brows, 'tiara': build_tiara,
           'lines': build_lines, 'pose': pose_head}
    for s in (stages or STAGES):
        fns[s]()


def scale_figure(s, foot=0.08):
    """Uniform scale of the whole figure about the base's top: one body at the piece's size."""
    piv = Vector((0, 0, foot))
    for ob in coll().objects:
        if ob.type != 'MESH' or ob.name.startswith('X_'):
            continue
        me = ob.data
        for v in me.vertices:
            v.co = piv + (v.co - piv) * s
        me.update()
        md = ob.modifiers.get('Outline')
        if md is not None:
            md.thickness *= max(0.7, s)

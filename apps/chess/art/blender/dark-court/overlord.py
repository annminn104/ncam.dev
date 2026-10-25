# Undead Overlord (King). exec kit.py, holy-order/patriarch.py, court.py, then this file into one dict; call
# build_k().
import math

from mathutils import Matrix, Vector

PFX = 'OV_'
COLL = 'Overlord'
POSE = {'head_roll': 4.0, 'head_pitch': 3.0, 'cape_flare': 1.0}
# the Patriarch's bell of a robe, a little fuller at the hem
ROBE = [(0.0, 0.122), (0.292, 0.122), (0.299, 0.134), (0.295, 0.152), (0.287, 0.172), (0.273, 0.19), (0.24, 0.26),
        (0.205, 0.35), (0.171, 0.44), (0.160, 0.50), (0.164, 0.58), (0.161, 0.645), (0.147, 0.69), (0.112, 0.722),
        (0.07, 0.742), (0.0, 0.748)]
# the right hand holds the staff where the Patriarch's does; the left rests on the belt
ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.236, -0.052, 0.548)), 'L': ((0.12, 0.0, 0.675), (0.168, -0.098, 0.51))}
# bell sleeves, a plum (crimson) band between the silver (gold) cuffs
SLEEVE = [(0.0, -0.05), (0.044, -0.05), (0.05, 0.25), (0.06, 0.55), (0.069, 0.70), (0.072, 0.735), (0.077, 0.85),
          (0.085, 1.0), (0.08, 1.03), (0.068, 1.02), (0.058, 0.85), (0.0, 0.85)]
SLEEVE_SLOT = ['main', 'main', 'main', 'main', 'trim', 'accent', 'trim', 'trim', 'trim', 'second', 'second']
DROOP = {4: 0.15, 5: 0.22, 6: 0.4, 7: 1.0, 8: 1.0, 9: 1.0, 10: 0.4}
OS_NU, OS_NV = 24, 14
HEAD_SUFFIXES = ['Head', 'Jaw', 'Face', 'LinesSkull', 'Crown', 'CrownSpikes', 'CrownGems', 'LinesCrown']
CROWN_TILT = Matrix.Translation((0, 0, ZB)) @ Matrix.Rotation(math.radians(-8), 4, 'X') @ \
    Matrix.Translation((0, 0, -ZB))
CROWN_Z = ZB + 0.012
# (azimuth from the front, length, half width) of the crown's seven blades
CROWN_SPIKES = [(0, 0.29, 0.031)] + [(s * a, L, W) for a, L, W in ((51.4, 0.215, 0.027), (102.9, 0.175, 0.024),
                                                                  (154.3, 0.15, 0.022)) for s in (-1, 1)]
COL_NU, COL_NV, COL_TIP = 26, 14, 11
ORB = Vector((SX, SYY, 1.29))
ORB_R = 0.041
BKL = Vector((0.0, -0.9 * 0.177 - 0.006, 0.455))    # the belt buckle's centre (the Patriarch's): buckle, engraving


# ================================================================== robe layers (the Patriarch's builders)
def overskirt_P(rb, s):
    """The over-skirt's panels: the Patriarch's, wrapped further round to the back and cut into points
    at the hem."""
    def P(i, j):
        u = i / OS_NU
        v = j / OS_NV
        az = 24 + 112 * u
        th = math.radians(-90 + s * az)
        tw = abs(((u * 3.0) % 2) - 1)
        zh = 0.163 + 0.04 * (1 - tw) - 0.02 * u
        z = 0.445 + (zh - 0.445) * v
        hit = ray_in(rb, th, z)
        n = Vector((hit.x, hit.y, 0)).normalized()
        return hit + n * (0.006 + 0.02 * v ** 1.3)
    return P


def cape_P(i, j, nu=40, nv=22):
    """The cape: the Patriarch's, a little fuller, its hem cut into five points."""
    th = math.radians(-8 + 196 * i / nu)
    v = j / nv
    c = (196 * i / nu - 98) / 19.6
    tw = abs((c % 2) - 1)            # 1 at a point, 0 between two
    zb = 0.098 + 0.048 * (1 - tw)
    z = 0.665 - (0.665 - zb) * v
    side = 0.5 + 0.5 * math.cos(th)
    fl = POSE['cape_flare']
    r = 0.168 + 0.18 * v ** 0.85 + (0.016 + 0.008 * side * fl) * v ** 1.3 * math.cos(7 * (th - math.pi / 2))
    x = r * math.cos(th) + 0.02 * fl * v * v * side
    y = r * math.sin(th) * 0.95 + 0.03 * v * v + 0.03 * fl * v * v * (0.6 + 0.4 * math.sin(th))
    return Vector((x, y, z + 0.018 * fl * v * v * side))


def collar_P(i, j, nu=32, nv=6):
    """The Patriarch's standing collar made the Overlord's high neckband: all round the neck under the
    jaw, open a little at the throat."""
    th = math.radians(-82 + 344 * i / nu)
    v = j / nv
    z = 0.712 + (0.772 - 0.712) * v
    r = 0.064 + 0.01 * v
    return Vector((r * math.cos(th), r * math.sin(th) * 0.95, z))


def build_robe_k():
    build_robe()
    reslot(PFX + 'Alb', 'white', 'accent')
    build_overskirt()
    rb = bvh_of(O(PFX + 'Robe'))
    # the front panel between the over-skirts: plum (crimson), edged in metal, three stars and gems
    zs = (0.425, 0.195)

    def hw(z):
        return 0.042 + 0.03 * (zs[0] - z) / (zs[0] - zs[1])
    panel = [(-hw(zs[1]), zs[1]), (hw(zs[1]), zs[1]), (hw(zs[0]), zs[0]), (-hw(zs[0]), zs[0])]
    chest = [(-0.04, 0.484), (0.04, 0.484), (0.033, 0.566), (-0.033, 0.566)]   # the same panel above the belt
    bm = new_bm()
    decal_poly(bm, rb, edge_pts(panel, 0.006), FR, 0.002, 'accent', center=(0, 0.31), rings=4)
    decal_poly(bm, rb, edge_pts(chest, 0.006), FR, 0.002, 'accent', center=(0, 0.525), rings=3)
    out(PFX + 'Panel', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, rb, [(s * (hw(z) - 0.004), z) for z in (0.425, 0.36, 0.28, 0.2)], [0.0036] * 4, FR, 0.0032,
                   'trim', n=36)
        decal_band(bm, rb, [(s * 0.0365, 0.484), (s * 0.033, 0.53), (s * 0.0295, 0.566)], [0.0036] * 3, FR, 0.0032,
                   'trim', n=16)
    decal_band(bm, rb, [(-hw(0.199) + 0.002, 0.199), (0, 0.199), (hw(0.199) - 0.002, 0.199)], [0.0036] * 3, FR, 0.0032,
               'trim', n=30)
    decal_poly(bm, rb, star_poly(0, 0.524, 0.015, 0.021), FR, 0.0032, 'trim', center=(0, 0.524), rings=2)
    for cz, w in ((0.378, 0.02), (0.305, 0.024), (0.235, 0.028)):
        decal_poly(bm, rb, star_poly(0, cz, w, w * 1.45), FR, 0.0032, 'trim', center=(0, cz), rings=2)
    for cz in (0.342, 0.27):
        decal_poly(bm, rb, ellipse(0, cz, 0.0045, 0.0045, 12), FR, 0.0032, 'trim', rings=1)
    out(PFX + 'PanelGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for cz, r in ((0.524, 0.0045), (0.378, 0.0055), (0.305, 0.0065), (0.235, 0.0075)):
        decal_poly(bm, rb, ellipse(0, cz, r, r, 14), FR, 0.0045, 'gem', rings=1)
    out(PFX + 'PanelGems', bm, 0, sharp=80, recalc=False)
    # the belt's buckle
    bm = new_bm()
    slab(bm, [(-0.026, -0.024), (0.026, -0.024), (0.036, 0.0), (0.026, 0.024), (-0.026, 0.024), (-0.036, 0.0)],
         Matrix.Translation(BKL), 0.009, bevel=0.0022, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'Buckle', bm, SMALL, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(BKL + Vector((0, -0.006, 0))), 0.012, 0.017, 0.017, 0.009)
    out(PFX + 'BuckleGem', bm, SMALL, smooth=False)


def build_sleeves_k():
    build_sleeves()
    reslot(PFX + 'Frills', 'white', 'accent')


SIGIL_Z = 0.31


def build_cape_k():
    build_cape()
    # the Patriarch's cross and orphrey off the back; the Court's seal instead: a crown of blades in a ring
    for n in ('CapeOrphrey', 'CapeMedallion', 'CapeEmblem'):
        drop(PFX + n)
    cb = bvh_of(O(PFX + 'Cape'))
    EZ = SIGIL_Z
    bm = new_bm()
    decal_poly(bm, cb, ellipse(0, EZ, 0.1, 0.1, 48), BACK, 0.0024, 'accent', rings=3)
    decal_band(bm, cb, [(0.093 * math.cos(2 * math.pi * k / 32), EZ + 0.093 * math.sin(2 * math.pi * k / 32))
                        for k in range(33)], [0.0042] * 33, BACK, 0.0034, 'trim', n=96)
    decal_band(bm, cb, [(0.081 * math.cos(2 * math.pi * k / 32), EZ + 0.081 * math.sin(2 * math.pi * k / 32))
                        for k in range(33)], [0.0022] * 33, BACK, 0.0034, 'main', n=96)
    decal_poly(bm, cb, edge_pts([(-0.046, EZ - 0.04), (0.046, EZ - 0.04), (0.046, EZ - 0.018), (-0.046, EZ - 0.018)],
                                0.006), BACK, 0.0036, 'trim', center=(0, EZ - 0.029), rings=2)
    for x, tip, w in ((0, 0.052, 0.011), (0.024, 0.03, 0.0095), (-0.024, 0.03, 0.0095), (0.043, 0.012, 0.008),
                      (-0.043, 0.012, 0.008)):
        decal_poly(bm, cb, edge_pts([(x - w, EZ - 0.02), (x + w, EZ - 0.02), (x, EZ + tip)], 0.006), BACK, 0.0038, 'trim',
                   center=(x, EZ - 0.006 + tip * 0.2), rings=2)
    out(PFX + 'CapeSigil', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for x, r in ((0, 0.0075), (0.027, 0.005), (-0.027, 0.005)):
        decal_poly(bm, cb, ellipse(x, EZ - 0.029, r, r * 0.9, 14), BACK, 0.0052, 'gem', rings=1)
    out(PFX + 'CapeSigilGems', bm, 0, sharp=80, recalc=False)


# ================================================================== hands
def build_hands_k():
    bm = new_bm()
    S = Vector((SX, SYY, 0.0))
    # right: four finger bones round the staff, the thumb over them, the palm's bones to the wrist
    carp = Vector((-0.222, -0.047, 0.548))
    for k in range(4):
        z = 0.554 - 0.0124 * k
        rf = 0.0105 + 0.0052
        pts = [S + Vector((rf * math.cos(math.radians(a)), rf * math.sin(math.radians(a)), z - 0.0016 * (a + 12) / -170))
               for a in (-12, -70, -124, -176)]
        finger(bm, pts, 0.0046 - 0.0003 * k)
        bone(bm, carp + Vector((0.0, 0.002 * k, -0.006 * k)), pts[0], 0.0034)
    for p in (carp, carp + Vector((0.004, 0.006, -0.012)), carp + Vector((-0.002, -0.004, -0.02))):
        ellipsoid(bm, p, (0.0058,) * 3, 'skin', segs=8, rings=6)
    thumb = [carp + Vector((-0.004, -0.012, 0.0)), Vector((-0.236, -0.074, 0.551)), Vector((-0.246, -0.082, 0.557)),
             Vector((-0.257, -0.083, 0.561))]
    finger(bm, thumb, 0.0049)
    # left: resting on the belt, the finger bones laid down over it along the robe, the thumb along its top
    sh, wr = (Vector(p) for p in ARMS['L'])
    W = sh + (wr - sh) * 1.05
    body = bvh_of(O(PFX + 'Robe'), O(PFX + 'Sash'), O(PFX + 'OverSkirt'))

    def lay(x, z, off):
        return on_surf(body, x, z, off)[0]
    for p in (W, W + Vector((-0.008, -0.006, -0.006)), W + Vector((-0.004, -0.008, 0.004))):
        ellipsoid(bm, p, (0.0058,) * 3, 'skin', segs=8, rings=6)
    dn = Vector((-0.6, -0.8))                       # down and in, across the belly, in the front view
    ac = Vector((0.8, -0.6))                        # across the hand, toward the little finger
    kc = Vector((W.x, W.z)) + dn * 0.034
    for k, (off, fan, L) in enumerate(((-0.0124, -0.12, 0.95), (-0.0042, -0.04, 1.05), (0.0042, 0.04, 1.0),
                                       (0.0124, 0.12, 0.84))):
        d2 = (dn + ac * fan).normalized()
        q = kc + ac * off
        r = 0.0051 - 0.0003 * k
        pts = [lay(q.x, q.y, r + 0.003)]
        for seg in (0.019, 0.015, 0.011):
            q = q + d2 * seg * L
            pts.append(lay(q.x, q.y, r + 0.0015))
        bone(bm, W + Vector((-0.004, -0.004, -0.002)) + (pts[0] - W) * 0.15, pts[0], 0.0036)
        finger(bm, pts, r)
    q = Vector((W.x, W.z)) + dn * 0.012 - ac * 0.012
    pts = [W + Vector((-0.006, -0.008, 0.002))]
    for seg in (0.016, 0.013, 0.011):
        q = q + Vector((-0.97, 0.24)) * seg
        pts.append(lay(q.x, q.y, 0.0068))
    finger(bm, pts, 0.0055)
    out(PFX + 'Hands', bm, SMALL, sharp=60)


# ================================================================== mantle, chest and the high collar
def build_chest():
    capb = bvh_of(O(PFX + 'Capelet'))
    loc, _ = on_surf(capb, 0.0, 0.648, 0.0)
    CC = Vector((0.0, loc.y - 0.011, 0.648))
    star = []
    for q in range(12):
        a = math.radians(90 + 30 * q)
        r = (0.05 if q == 0 else 0.062 if q == 6 else 0.041 if q % 3 == 0 else 0.022) if q % 2 == 0 else 0.017
        star.append((r * math.cos(a), r * math.sin(a) * (1.0 if q != 0 else 0.92)))
    bm = new_bm()
    slab(bm, star, Matrix.Translation(CC), 0.009, bevel=0.002, seg=2)
    set_slot(bm, bm.faces, 'trim')
    lathe(bm, [(0.025 + 0.0032 * math.cos(2 * math.pi * q / 8), 0.0032 * math.sin(2 * math.pi * q / 8)) for q in range(8)],
          32, 'trim', xform=Matrix.Translation(CC + Vector((0, -0.006, 0))) @ axis_to((0, -1, 0)), wrap=True)
    out(PFX + 'Brooch', bm, SMALL, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(CC + Vector((0, -0.007, -0.002))), 0.019, 0.026, 0.03, 0.013)
    for x, z in ((0.0, 0.034), (0.033, -0.004), (-0.033, -0.004)):
        gem_cut(bm, Matrix.Translation(CC + Vector((x, -0.006, z))), 0.0055, 0.007, 0.007, 0.004)
    out(PFX + 'BroochGems', bm, SMALL, smooth=False)
    # chains from the brooch to a clasp on each shoulder
    bm, bc, bg = new_bm(), new_bm(), new_bm()
    for s in (-1, 1):
        ctrl = []
        for k in range(7):
            t = k / 6
            x = s * (0.028 + 0.112 * t)
            z = 0.662 - 0.03 * math.sin(math.pi * t) + 0.022 * t
            ctrl.append(on_surf(capb, x, z, 0.006)[0])
        for p in resample(ctrl, 0.0108):
            ellipsoid(bm, p, (0.0044,) * 3, 'trim', segs=8, rings=6)
        p, n = on_surf(capb, s * 0.146, 0.688, 0.0)
        M = Matrix.Translation(p + n * 0.005) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X')
        rose = [((0.019 if q % 2 == 0 else 0.0105) * math.cos(math.pi * q / 6 + 0.26),
                 (0.019 if q % 2 == 0 else 0.0105) * math.sin(math.pi * q / 6 + 0.26)) for q in range(12)]
        slab(bc, rose, M, 0.007, bevel=0.0016, seg=2)
        gem_cut(bg, M @ Matrix.Translation((0, -0.0045, 0)), 0.0075, 0.009, 0.009, 0.005)
    set_slot(bc, bc.faces, 'trim')
    out(PFX + 'Chains', bm, SMALL, sharp=45)
    out(PFX + 'Clasps', bc, SMALL, sharp=30)
    out(PFX + 'ClaspGems', bg, SMALL, smooth=False)


def high_collar_P(s):
    """One of the high collar's two flared panels (s = +1 on the left, +x), rising behind the skull from
    a notch at the back: grid (i, j) runs from the notch to the panel's front end and up to the rim."""
    def P(i, j):
        u = i / COL_NU
        v = 1 - (1 - j / COL_NV) ** 1.3
        th = math.pi / 2 - s * math.radians(5 + 107 * u)
        up = COL_TIP / COL_NU
        if u <= up:
            zt = 1.0 + 0.19 * (u / up) ** 1.8
        else:
            zt = 1.19 - 0.305 * ((u - up) / (1 - up)) ** 0.8
        rt = spline1([0.29, 0.33, 0.35, 0.32, 0.27], u)
        z = 0.716 + (zt - 0.716) * v
        r = 0.126 + (rt - 0.126) * (1 - (1 - v) ** 1.7) + 0.018 * max(0.0, (v - 0.8) / 0.2) ** 2
        return Vector((r * math.cos(th), r * math.sin(th), z))
    return P


def collar_at(s, u, v, face=1, lift=0.0):
    """A point on a collar panel at (u, v) in grid units, on its outer (face = 1) or inner (-1) side,
    lift off it, and that side's normal."""
    P = high_collar_P(s)
    a = P(min(u + 0.5, COL_NU), v) - P(max(u - 0.5, 0), v)
    b = P(u, min(v + 0.5, COL_NV)) - P(u, max(v - 0.5, 0))
    p = P(u, v)
    n = a.cross(b).normalized()
    if n.dot(Vector((p.x, p.y, 0))) < 0:
        n = -n
    return (p + n * lift if face > 0 else p - n * (0.007 + lift)), n * face


def build_high_collar():
    bm, bp = new_bm(), new_bm()
    for s in (-1, 1):
        P = high_collar_P(s)
        sheet(bm, P, COL_NU, COL_NV, 0.007,
              lambda i, j: 'trim' if j >= COL_NV - 1 or i >= COL_NU - 1 or i == 0 else 'coat',
              lambda i, j: 'trim' if j >= COL_NV - 1 or i >= COL_NU - 1 else 'accent', 'trim',
              outward=lambda p: Vector((p.x, p.y, 0)))
        rim = [P(i, COL_NV) for i in range(COL_NU + 1)] + [P(COL_NU, j) for j in range(COL_NV - 1, 0, -1)]
        tube(bp, rim, 0.0042, 'trim', n=80, k=8)
    out(PFX + 'HighCollar', bm, BIG, sharp=60)
    out(PFX + 'HighCollarPiping', bp, MID, sharp=60)
    # gems on the inside, under each point
    bg = new_bm()
    for s in (-1, 1):
        for u, v, r in ((COL_TIP, COL_NV - 3.6, 0.0085), (COL_TIP - 4.5, COL_NV - 3.4, 0.006),
                        (COL_TIP + 4.5, COL_NV - 3.8, 0.006)):
            p, n = collar_at(s, u, v, -1, 0.0)
            gem_cut(bg, Matrix.Translation(p + n * 0.003) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'), r,
                    r * 1.25, r * 1.4, r * 0.65)
    out(PFX + 'HighCollarGems', bg, SMALL, smooth=False)


# ================================================================== skull and crown
def build_skull():
    bm = new_bm()
    skull_mesh(bm)
    head = out(PFX + 'Head', bm, BIG, sharp=80)
    bm = new_bm()
    skull_jaw(bm)
    jaw = out(PFX + 'Jaw', bm, MID, sharp=50)
    bm = new_bm()
    skull_face(bm, bvh_of(head, jaw))
    out(PFX + 'Face', bm, 0, sharp=80, recalc=False)


def crown_frames():
    """For each azimuth (degrees from the front) of the band: where it meets the skull, the band's
    outward normal and up there (it lies snug along the skull's slope), and the crown's own outward
    and up directions in its tilted frame, which the blades stand on."""
    hb = bvh_of(O(PFX + 'Head'))
    Mr = CROWN_TILT.to_3x3()
    up = (Mr @ Vector((0, 0, 1))).normalized()

    def at(deg):
        a = math.radians(deg - 90)
        d = Mr @ Vector((math.cos(a), math.sin(a), 0))
        loc, nrm, _, _ = hb.ray_cast(CROWN_TILT @ Vector((0.6 * math.cos(a), 0.6 * math.sin(a), CROWN_Z)), -d)
        n = (d * 0.25 + nrm * 0.75).normalized()
        u = (up - n * up.dot(n)).normalized()
        return loc, n, u, d, up
    return at


BAND = [(-0.005, -0.019), (0.012, -0.024), (0.0175, -0.017), (0.0185, 0.0), (0.0175, 0.017), (0.012, 0.024),
        (-0.002, 0.022)]


def build_crown():
    at = crown_frames()
    segs = 72
    bm = new_bm()
    rings = []
    for i in range(segs):
        loc, n, u, _, _ = at(360 * i / segs)
        rings.append([bm.verts.new(loc + n * (0.0015 + dr) + u * dz) for dr, dz in BAND])
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(len(BAND)):
            j2 = (j + 1) % len(BAND)
            face(bm, [A[j], B[j], B[j2], A[j2]], 'trim')
    out(PFX + 'Crown', bm, MID, sharp=40)
    bm, bg = new_bm(), new_bm()
    for deg, L, W in CROWN_SPIKES:
        loc, n, u, d, up = at(deg)
        t = u.cross(n).normalized()
        lean = up * math.cos(math.radians(9)) + d * math.sin(math.radians(9))
        lean = (lean - t * lean.dot(t)).normalized()
        M = basis(loc + n * 0.009 + u * 0.01, t, lean.cross(t), lean)
        spike(bm, M, L, W, 0.0075, curve=0.05, waist=0.18)
        for sg in (-1, 1):
            Ms = M @ Matrix.Translation((sg * W * 0.75, 0.0, 0.006)) @ Matrix.Rotation(sg * math.radians(38), 4, 'Y')
            spike(bm, Ms, L * 0.3, W * 0.42, 0.0055, n=6, curve=0.1)
        gm = basis(loc + n * 0.0205, t, -n, u)
        big = deg == 0
        gem_cut(bg, gm, 0.013 if big else 0.0095, 0.016 if big else 0.012, 0.016 if big else 0.012, 0.007 if big else 0.005)
    out(PFX + 'CrownSpikes', bm, MID, sharp=30)
    out(PFX + 'CrownGems', bg, SMALL, smooth=False)


# ================================================================== staff
def build_staff_k():
    M = Matrix.Translation((SX, SYY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0105, 0.082), (0.0105, 1.2), (0.0, 1.2)], 16, 'leather', xform=M)
    for z0, h, r in ((0.082, 0.032, 0.0158), (0.468, 0.014, 0.0152), (0.586, 0.014, 0.0152), (0.86, 0.012, 0.014),
                     (1.125, 0.024, 0.0158)):
        lathe(bm, [(0.0, z0), (r * 0.9, z0), (r, z0 + h * 0.3), (r, z0 + h * 0.7), (r * 0.9, z0 + h), (0.0, z0 + h)],
              16, 'trim', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    bm = new_bm()
    lathe(bm, [(0.0, 1.165), (0.012, 1.165), (0.019, 1.178), (0.0205, 1.192), (0.015, 1.204), (0.011, 1.211),
               (0.016, 1.222), (0.025, 1.234), (0.023, 1.241), (0.0, 1.241)], 20, 'trim', xform=M)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        dv = Vector((math.cos(a), math.sin(a), 0))

        def at(r, z, dv=dv):
            return Vector((SX, SYY, z)) + dv * r
        talon(bm, [at(0.019, 1.234), at(0.04, 1.25), at(0.055, 1.283), at(0.05, 1.32), at(0.032, 1.343),
                   at(0.013, 1.352)], 0.0085)
    out(PFX + 'StaffHead', bm, MID, sharp=35)
    bm = new_bm()
    ellipsoid(bm, ORB, (ORB_R,) * 3, 'glow', segs=24, rings=16)
    out(PFX + 'Orb', bm, SMALL, sharp=80)
    bm = new_bm()
    for k, (dx, dy, dz, r) in enumerate(((-0.074, -0.01, 0.03, 0.0075), (0.068, -0.012, 0.05, 0.0085),
                                         (0.06, 0.0, -0.045, 0.006))):
        crystal(bm, ORB + Vector((dx, dy, dz)), r, r * 1.7, r * 1.7, n=4, slot='glow', twist=0.4 * k)
    out(PFX + 'OrbShards', bm, 0, smooth=False)


# ================================================================== drawn lines
def build_lines_k():
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    capb = bvh_of(O(PFX + 'Capelet'))
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    osb = bvh_of(O(PFX + 'OverSkirt'))
    colb = bvh_of(O(PFX + 'HighCollar'))
    # ---- engravings on the metal
    bm = new_bm()
    pts = [p for p in (ray_in(rb, 2 * math.pi * q / 240, 0.147 + 0.011 * math.sin(26 * 2 * math.pi * q / 240))
                       for q in range(241)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    pts = [p for p in (ray_in(capb, 2 * math.pi * q / 200, 0.586 + 0.004 * math.sin(14 * 2 * math.pi * q / 200), SY)
                       for q in range(201)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0011 * K] * len(pts), 'lgold', 0.0012)
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
    for s in (-1, 1):
        Pf = overskirt_P(rb, s)
        border = [Pf(2.4, j) for j in (0.5, 4, 8, 11.4)] + [Pf(i, 11.4) for i in range(4, OS_NU + 1)]
        line3d(bm, osb, border, 0.0011 * K, 'lgold', n=120, taper='none')
    outl = [(-0.026, -0.024), (0.026, -0.024), (0.036, 0.0), (0.026, 0.024), (-0.026, 0.024), (-0.036, 0.0)]
    flat_line(bm, Matrix.Translation(BKL), [(x * 0.72, z * 0.72) for x, z in outl], -1, 0.0012 * K, 'lgold', closed=True,
              half=0.0045, n=60)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)

    # ---- the crown's filigree: a line along each edge of the band and a wave between (posed with the head)
    bm = new_bm()
    at = crown_frames()

    def band_line(dz_of, n):
        P, N = [], []
        for q in range(n + 1):
            loc, nr, u, _, _ = at(360 * q / n)
            dz = dz_of(q / n)
            P.append(loc + nr * (0.0015 + 0.0185 - 0.001 * min(1.0, abs(dz) / 0.017)) + u * dz)
            N.append(nr)
        return P, N
    for dz in (-0.0155, 0.0155):
        P, N = band_line(lambda t, dz=dz: dz, 144)
        strip(bm, P, N, [0.0012 * K] * len(P), 'lgold', 0.0012)
    P, N = band_line(lambda t: 0.0075 * math.sin(2 * math.pi * 21 * t), 288)
    strip(bm, P, N, [0.001 * K] * len(P), 'lgold', 0.0012)
    out(PFX + 'LinesCrown', bm, 0, sharp=80, recalc=False)

    # ---- an old crack in the skull, above the crown (posed with the head)
    bm = new_bm()
    hb = bvh_of(O(PFX + 'Head'))
    for path, w in (([(40, 47), (46, 54), (43, 61), (49, 67), (46, 73)], 0.0019), ([(43, 61), (36, 65), (33, 70)], 0.0013)):
        line3d(bm, hb, [skull_pt(phi, el, 0.002) for phi, el in path], w, 'lskin', n=30, taper='end')
    out(PFX + 'LinesSkull', bm, 0, sharp=80, recalc=False)

    # ---- cloth folds and the collar's stays
    bm = new_bm()
    capeb = bvh_of(O(PFX + 'Cape'))
    for th in (12.9, 64.3, 115.7, 167.1):
        i = (th + 8) / 196 * 40
        line3d(bm, capeb, [cape_P(i + 0.25 * (q - 2), 22 * v) for q, v in enumerate((0.28, 0.45, 0.62, 0.78, 0.9))],
               0.0026, 'lcoat', n=30)
        line3d(bm, capeb, [cape_P(i + 1.6, 22 * v) for v in (0.5, 0.66, 0.82)], 0.0018, 'lcoat', n=16)
    SLR = [(0.25, 0.05), (0.55, 0.06), (0.70, 0.069), (0.85, 0.077)]

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
        if abs(math.degrees(a) - 270) < 40:
            continue
        ctrl = [capb.find_nearest(Vector((0.3 * math.cos(a), 0.27 * math.sin(a), z)))[0] for z in (0.606, 0.63, 0.662)]
        line3d(bm, capb, ctrl, 0.0017, 'lcoat', n=10, taper='end')
    for s in (-1, 1):
        Pf = overskirt_P(rb, s)
        for ui in (5, 10, 15, 20):
            line3d(bm, osb, [Pf(ui + 0.3 * q, j) for q, j in enumerate((2, 5, 8, 10.5))], 0.0022, 'lcoat', n=24)
        for side in (1, -1):
            for u in range(3, COL_NU - 2, 3):
                line3d(bm, colb, [collar_at(s, u, v, side, 0.003)[0] for v in (1.2, 5.0, 8.5, COL_NV - 3.6)], 0.0017,
                       'lcoat', n=20, taper='start')
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)

    # ---- metal scrolls on the cape's back, the over-skirt and the inside of the collar
    bm = new_bm()
    EZ = SIGIL_Z
    for s in (-1, 1):
        p = [(s * 0.035, 0.2), (s * 0.075, 0.21), (s * 0.11, 0.25), (s * 0.122, 0.31)] + \
            scroll_pts(s * 0.15, 0.335, s, 0.034, turns=1.25, n=18)[1:]
        decal_band(bm, capeb, p, [0.0018, 0.0036, 0.0042, 0.0042] + [0.0042 * (1 - 0.7 * k / 18) for k in range(19)],
                   BACK, 0.0028, 'trim', n=80)
        p = [(s * 0.11, 0.25), (s * 0.15, 0.235)] + scroll_pts(s * 0.17, 0.25, -s, 0.017, turns=1.15, n=12)[1:]
        decal_band(bm, capeb, p, [0.0018, 0.0032] + [0.0032 * (1 - 0.7 * k / 12) for k in range(13)], BACK, 0.0028,
                   'trim', n=40)
        p = [(s * 0.03, EZ + 0.105), (s * 0.07, EZ + 0.11), (s * 0.1, EZ + 0.135)] + \
            scroll_pts(s * 0.118, EZ + 0.15, s, 0.02, turns=1.2, n=12)[1:]
        decal_band(bm, capeb, p, [0.0016, 0.003, 0.0034] + [0.0034 * (1 - 0.7 * k / 12) for k in range(13)], BACK,
                   0.0028, 'trim', n=50)
        Pf = overskirt_P(rb, s)
        ctrl = [Pf(5.0, 2.5), Pf(7.5, 4.4), Pf(10.0, 5.4)]
        for k in range(1, 13):
            t = k / 12
            r = 2.4 * (1 - 0.8 * t)
            th = math.radians(200) - 1.3 * 2 * math.pi * t
            ctrl.append(Pf(12.0 + r * math.cos(th), 6.4 + r * 0.9 * math.sin(th)))
        line3d(bm, osb, ctrl, 0.0032, 'trim', n=80, lift=0.0016)
        line3d(bm, osb, [Pf(9.0, 7.6), Pf(11.0, 9.0), Pf(14.0, 9.6), Pf(16.0, 8.6), Pf(15.4, 7.6)], 0.0024, 'trim', n=40,
               lift=0.0016)
        for side in (1, -1):      # a metal border inside the collar's rim, both sides
            path = [collar_at(s, u, COL_NV - 2.2, side, 0.004)[0] for u in range(1, COL_NU - 1, 2)]
            path += [collar_at(s, COL_NU - 2.0, v, side, 0.004)[0] for v in (COL_NV - 3.5, COL_NV - 7, 3, 0.6)]
            line3d(bm, colb, path, 0.0026, 'trim', n=90, lift=0.0016, taper='none')
        stem = [(COL_TIP + 7.0, 1.5), (COL_TIP + 5.0, 3.8), (COL_TIP + 2.4, 6.4)]
        curl = scroll_pts(COL_TIP - 0.4, 7.0, -1, 2.4, turns=1.2, n=14, start=180.0)
        line3d(bm, colb, [collar_at(s, u, v, -1, 0.003)[0] for u, v in stem + curl], 0.003, 'trim', n=80, lift=0.0016)
        twig = [(COL_TIP + 4.2, 4.4), (COL_TIP + 6.6, 5.8)] + scroll_pts(COL_TIP + 7.6, 7.2, -1, 1.2, turns=1.1, n=10,
                                                                        start=-90.0)
        line3d(bm, colb, [collar_at(s, u, v, -1, 0.003)[0] for u, v in twig], 0.0024, 'trim', n=50, lift=0.0016)
    out(PFX + 'GoldScrolls', bm, 0, sharp=80, recalc=False)


def build_k():
    build_base()
    build_robe_k()
    build_mantle()
    build_chest()
    build_sleeves_k()
    build_hands_k()
    build_high_collar()
    build_cape_k()
    build_skull()
    build_crown()
    build_staff_k()
    build_lines_k()
    pose_head()

# Battle Maid (Pawn). exec kit.py, holy-order/patriarch.py, holy-order/abbess.py, holy-order/acolyte.py, court.py,
# then this file into one dict; call build_p(). Built at the king's scale on the Acolyte's body and face (her ROBE,
# robe_r and SLEEVE carry over), then scaled down by SCALE about the base's top.
import math

import bmesh
from mathutils import Matrix, Vector

PFX = 'BM_'
COLL = 'BattleMaid'
POSE = {'head_roll': 5.0, 'head_pitch': 5.0, 'cape_flare': 0.0}
SCALE = 0.7
# the broom-glaive's axis: upright beside her right foot, clear of the skirt's hem; its shaft's radius; how high the
# right hand grips it (its top finger)
BX, BY = -0.34, -0.065
SHAFT_R = 0.0095
GRIP_Z = 0.58
# the right hand grips the shaft out at her side, the cuff clear of it; the left arm hangs, its hand on her hip
ARMS = {'R': ((-0.12, 0.0, 0.675), (BX + 0.05, BY + 0.01, GRIP_Z - 0.008)),
        'L': ((0.12, 0.0, 0.675), (0.16, -0.088, 0.53))}
# long plain sleeves with second cuffs, closer at the wrist than the Patriarch's bells: their cuffs hang half as low
SLEEVE_SLOT = ['main'] * 6 + ['second'] * 5
DROOP = {4: 0.08, 5: 0.11, 6: 0.2, 7: 0.5, 8: 0.5, 9: 0.5, 10: 0.2}
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'HairCap', 'HairCrown', 'Bangs', 'HairLocks', 'HairBun', 'Headband',
                 'HeadFrill', 'HeadBow', 'HairClip', 'LinesHair']
FANG_Z = 0.861                                       # the Acolyte's open smile: its top edge at x = 0.006 either side
# the high collar round the neck (r, z), white outside
HIGH_COLLAR = [(0.05, 0.7), (0.06, 0.706), (0.064, 0.73), (0.068, 0.752), (0.072, 0.764), (0.07, 0.771), (0.063, 0.764),
               (0.056, 0.74), (0.052, 0.708)]
# the apron's skirt: its top (under the waistband) and hem heights, its half width (degrees round the dress) at the
# top and at the hem, how far it stands off the dress (top, hem) and its thickness; the frill round its sides and
# hem: its width, the gathers' count along it and their depth, how far its points stand out (a share of its width)
APRON = {'top': 0.462, 'hem': 0.232, 'half': (40.0, 58.0), 'off': (0.0075, 0.013), 'thick': 0.004}
APRON_FRILL = {'width': 0.024, 'waves': 26, 'amp': 0.005, 'point': 0.35}
# the bib: its bottom (under the waistband) and top, its half width at the bottom and top; the straps over the
# shoulders, down the back to the waistband: (degrees round the body from her left side, height) for the left one
BIB = {'bottom': 0.46, 'top': 0.612, 'half': (0.046, 0.054)}
APRON_STRAP = [(-73.0, 0.6), (-52.0, 0.664), (-26.0, 0.713), (0.0, 0.735), (26.0, 0.713), (52.0, 0.664),
               (70.0, 0.6), (75.0, 0.53), (77.0, 0.462)]
APRON_STRAP_HALF = 0.011
# the apron's bow at the back of the waistband: its knot, each loop's length and the ribbon's width at the folds
APRON_BOW = {'knot': Vector((0.0, 0.182, 0.456)), 'len': 0.075, 'width': 0.04}
# the hair's bun, low at the back of the head: azimuth and elevation (degrees); a coil of hair wound `turns` times,
# from radius r0 round its axis in to r1, rising from out0 off the hair to out1, the coil `thick` (radius) at its
# start; the locks gathered up into it from behind the ears and the nape: (azimuth, elevation) along each on her left
# side, and its width
BUN = {'phi': 180.0, 'el': 0.0, 'turns': 2.0, 'r0': 0.056, 'r1': 0.01, 'out0': 0.014, 'out1': 0.066, 'thick': 0.024}
BUN_LOCKS = ((((163, -42), (168, -26), (172, -12)), 0.03), (((118, -24), (140, -14), (160, -6)), 0.028))
# broad locks lying over the crown behind the headband, combed from the parting down the sides and back toward the
# bun: (azimuth, elevation) along each on her left side, and its width; all of them this thick (half, at the root) and
# in this many rings; their outlines' half width (painted, in LinesHair)
CROWN_LOCKS = ((((6, 84), (48, 70), (88, 50), (116, 30)), 0.046), (((10, 88), (128, 70), (154, 48), (166, 26)), 0.042))
CROWN_LOCK_THICK, CROWN_LOCK_RINGS, CROWN_LOCK_LINE = 0.008, 10, 0.0026
# the headband: the elevation (degrees) where it crosses the middle in front, its half width (as a share of the
# radius); the frill standing on it: from where to where along the band (-1 her right ear, 1 her left), its height,
# pleats, their depth, how far its points stand out; the bow on the band past the frill's end: where along the band,
# each loop's length and the ribbon's width
HEADBAND = {'el': 48.0, 'half': 0.06}
HEAD_FRILL = {'from': -0.88, 'to': 0.4, 'height': 0.034, 'pleats': 12, 'amp': 0.009, 'point': 0.35}
HEAD_BOW = {'at': 0.6, 'len': 0.05, 'width': 0.028}
# the bat hairclip at her right, between the fringe's roots and the headband: azimuth and elevation (degrees), and
# how much it shrinks the bat built at its own size (court.bat_wing's claw is a fixed size, so the whole bat shrinks
# with it)
CLIP = {'phi': -26.0, 'el': 33.0, 'shrink': 0.22}
# the broom-glaive's head: the straw's neck (bound in cord) and cut top, its half width and half thickness at the neck
# and at the top; the blade's outline (x across, its edge out away from the head toward -x; z up from the collar)
BROOM = {'neck': 0.9, 'top': 1.12, 'half': ((0.022, 0.02), (0.072, 0.0105))}
GLAIVE_BLADE = [(0.009, 0.0), (0.011, 0.05), (0.012, 0.09), (0.009, 0.118), (0.004, 0.136), (-0.006, 0.124),
                (-0.019, 0.1), (-0.028, 0.068), (-0.03, 0.04), (-0.025, 0.018), (-0.016, 0.004), (-0.012, 0.0)]


# ================================================================== helpers
def dress_r(z):
    """The dress's radius at height z, read off ROBE between its points (before robe_r's folds)."""
    for (r0, z0), (r1, z1) in zip(ROBE[1:], ROBE[2:]):
        if z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return ROBE[-1][0]


def skirt_r(z):
    """The dress's radius at height z swelled by the depth of robe_r's folds there: what lies on the skirt clears it."""
    return dress_r(z) + 0.013 * max(0.0, 0.42 - z) / 0.34


def skirt_pt(a, z, off):
    """A point off the dress at lathe angle a (radians; -pi/2 is the front) and height z: off out along the dress's
    normal from skirt_r's surface, so nothing laid on it dips into a fold."""
    r = skirt_r(z)
    n = Vector((SY * math.cos(a), math.sin(a), 0.0)).normalized()
    return Vector((r * math.cos(a), SY * r * math.sin(a), z)) + n * off


def zigzag(x):
    """A triangle wave: 0 at whole x, 1 halfway between."""
    return 1 - abs((x % 1.0) * 2 - 1)


def ruffle(bm, base, out_dir, nrm, width, thick, waves, amp, point, slot, outward, rows=3, root=0.25):
    """A gathered frill into bm in slot, along the edge base (points, evenly spaced, root first): at each point it
    reaches width (a number, or one per point) along out_dir (unit vectors, one per point) from root x width behind
    the edge (tucked under what it trims) to its outer edge, which is cut into `waves` points standing out a further
    point x width. It gathers in `waves` waves out along nrm (unit vectors, one per point: off the face the frill
    lies on), amp deep at the outer edge and flat at the root, never dipping behind the edge's own surface. thick:
    the cloth's thickness; outward(p): a direction off its front face at p, for sheet; rows: its rows from the root to
    the edge."""
    n = len(base) - 1
    ws = width if isinstance(width, (list, tuple)) else [width] * len(base)

    def P(i, j):
        """The frill's point i along it and j out from its root."""
        x = waves * i / n
        w = -root + (1 + root) * j / rows
        if j == rows:
            w += point * (1 - zigzag(x))
        gather = amp * (0.5 + 0.5 * math.cos(2 * math.pi * x)) * max(0.0, w) ** 1.5
        return base[i] + out_dir[i] * (ws[i] * w) + nrm[i] * gather
    sheet(bm, P, n, rows, thick, slot, slot, slot, outward=outward)


def ribbon_bow(bm, K, X, Y, L, W, slot, tails=(), tail_w=0.012, tail_c=None, rise=0.25, thick=0.0025, n=12, k=6):
    """A ribbon bow tied at K, into bm in slot: two loops out along X and -X, each L long, a ribbon W wide at its fold
    folded back on itself, its two layers standing apart toward Y (the side the bow faces), its fold rising rise x L
    along the ribbon's width (X x Y); a knot over their roots; and the tails, ribbons along the point lists in tails
    (root first), tail_w wide, lying flat on what tail_c (a point, or a function of one, as strand's center) is
    inside, each cut to a point. X and Y at right angles; thick: the ribbon's thickness; n, k: each ribbon's rings
    along it and points round it."""
    X, Y = Vector(X).normalized(), Vector(Y).normalized()
    Z = X.cross(Y).normalized()
    d = 0.26 * L
    loop = [(0.08, 0.0, 0.0), (0.42, d, 0.12), (0.82, 0.8 * d, 0.62), (1.0, 0.0, 1.0), (0.82, -0.8 * d, 0.62),
            (0.42, -d, 0.12), (0.08, 0.0, 0.0)]
    for s in (-1, 1):
        pts = [K + X * (s * x * L) + Y * y + Z * (z * rise * L) for x, y, z in loop]
        mid = K + X * (s * 0.6 * L) + Z * (0.5 * rise * L)
        strand(bm, pts, W / 2, thick / 2, slot, mid, n=n, k=k,
               prof=lambda t: 0.45 + 0.55 * math.sin(math.pi * t) ** 0.7)
    ellipsoid(bm, K + Y * 0.002, (0.16 * L, 0.3 * d + thick, 0.4 * W), slot, segs=10, rings=6,
              rot=Matrix((X, Y, Z)).transposed())
    for pts in tails:
        strand(bm, pts, tail_w / 2, thick / 2, slot, tail_c, n=n, k=k,
               prof=lambda t: (0.85 + 0.3 * t) * min(1.0, (1 - t) / 0.22) ** 0.8)


# ================================================================== the dress
def build_dress_bm():
    """The Acolyte's robe as a long maid's dress (the Patriarch's build_robe on her ROBE): main, its hem band metal;
    the petticoat's lace peeping under the hem in accent, as the Court has its lace; the sash white: the apron's
    waistband, whose strings tie in the bow at the back."""
    build_robe()
    reslot(PFX + 'Alb', 'white', 'accent')
    reslot(PFX + 'Sash', 'accent', 'white')


def build_sleeves_bm():
    """The Patriarch's sleeves on the maid's arms (ARMS, SLEEVE_SLOT): long and plain, second cuffs; their lace frills
    in accent."""
    build_sleeves()
    reslot(PFX + 'Frills', 'white', 'accent')


def build_collar_bm():
    """A high white collar standing round the neck, lined in second."""
    bm = new_bm()
    lathe(bm, HIGH_COLLAR, 32, lambda i, j: 'white' if j < 6 else 'second', sy=SY, wrap=True)
    out(PFX + 'HighCollar', bm, MID, sharp=50)


# ================================================================== the apron
def apron_off(v):
    """How far the apron's skirt stands off the dress at v down it (0 at its top, 1 at its hem)."""
    return APRON['off'][0] + (APRON['off'][1] - APRON['off'][0]) * v


def apron_half(v):
    """The apron's skirt's half width (degrees round the dress) at v down it."""
    return APRON['half'][0] + (APRON['half'][1] - APRON['half'][0]) * v


def apron_z(v):
    """The height of the apron's skirt at v down it."""
    return APRON['top'] + (APRON['hem'] - APRON['top']) * v


def apron_edge():
    """The apron skirt's sides and hem as one path, from under the waistband on her right, down, across the hem and
    up her left side: evenly spaced (arc length round the dress, height) points with the frill's way out at each
    (a unit vector in those terms), the corners rounded. The frill's columns: four to a gather."""
    def X(v, u):
        """Arc length round the dress from the front at v down the apron and u across it (-1 to 1)."""
        return math.radians(apron_half(v) * u) * (skirt_r(apron_z(v)) + apron_off(v))
    pts = [(X(v, -1), apron_z(v)) for v in (0.1 + 0.9 * q / 12 for q in range(13))]
    pts += [(X(1.0, u), apron_z(1.0)) for u in (-1 + 2 * q / 16 for q in range(1, 16))]
    pts += [(X(v, 1), apron_z(v)) for v in (1.0 - 0.9 * q / 12 for q in range(13))]
    C = [Vector((x, z, 0.0)) for x, z in pts]
    # round the two corners: a curve through the points round each
    for c in (12, 12 + 16):
        a, b = C[c - 2], C[c + 2]
        C[c - 1], C[c], C[c + 1] = a.lerp(C[c], 0.75), (a + b) * 0.15 + C[c] * 0.7, b.lerp(C[c], 0.75)
    n = APRON_FRILL['waves'] * 4
    R = resample(C, sum((q - p).length for p, q in zip(C, C[1:])) / n, n=600)[:n + 1]
    while len(R) < n + 1:
        R.append(C[-1])
    out_dirs = []
    for i in range(n + 1):
        t = R[min(i + 1, n)] - R[max(i - 1, 0)]
        t.normalize()
        out_dirs.append(Vector((t.y, -t.x, 0.0)))
    return R, out_dirs


def build_apron_bm():
    """The white apron over the dress: a skirt from under the waistband to below the knees, frilled along its sides
    and hem, the frill cut into points along its edge; a bib on the chest with a frill along its top; straps over
    the shoulders and down the back to the waistband; and a bow at the back where its strings tie."""
    rb = bvh_of(O(PFX + 'Robe'))
    NU, NV = 20, 8

    def P(i, j):
        """The apron's skirt at column i across and row j down."""
        u, v = -1 + 2 * i / NU, j / NV
        a = math.radians(-90 + apron_half(v) * u)
        gather = 0.0025 * math.cos(math.pi * 7 * u) * (1 - v) ** 2 * (1 - u ** 4)   # flat at the frilled sides
        return skirt_pt(a, apron_z(v), apron_off(v) + gather)
    bm = new_bm()
    sheet(bm, P, NU, NV, APRON['thick'], 'white', 'white', 'white', outward=lambda p: Vector((p.x, p.y, 0)))
    # the bib: on the chest, its foot under the waistband
    NB, MB = 10, 6

    def B(i, j):
        """The bib at column i across and row j up."""
        u, v = -1 + 2 * i / NB, j / MB
        half = BIB['half'][0] + (BIB['half'][1] - BIB['half'][0]) * v
        return on_surf(rb, u * half, BIB['bottom'] + (BIB['top'] - BIB['bottom']) * v, 0.005)[0]
    sheet(bm, B, NB, MB, 0.0035, 'white', 'white', 'white', outward=lambda p: Vector((p.x, p.y, 0)))
    # the straps, laid on the dress over the shoulders (from the bib's top corners) and down the back
    for s in (-1, 1):
        ctrl = []
        for a, z in APRON_STRAP:
            th = math.radians(a if s > 0 else 180 - a)
            hit = rb.ray_cast(Vector((0.5 * math.cos(th), 0.5 * SY * math.sin(th), z)),
                              Vector((-math.cos(th), -SY * math.sin(th), 0.0)).normalized())[0]
            ctrl.append(hit)
        C = catmull(ctrl, 24)
        rows = []
        for q, c in enumerate(C):
            loc, nrm, _, _ = rb.find_nearest(c)
            t = (C[min(q + 1, 24)] - C[max(q - 1, 0)]).normalized()
            rows.append((loc + nrm * 0.0075, t.cross(nrm).normalized()))
        sheet(bm, lambda i, j: rows[i][0] + rows[i][1] * (APRON_STRAP_HALF * (j - 1)), 24, 2, 0.003, 'white', 'white',
              'white', outward=lambda p: Vector((p.x, p.y, 0)) if p.z < 0.69 else Vector((p.x, p.y, 0.5)))
    out(PFX + 'Apron', bm, MID, sharp=50)
    # the frills: round the skirt's sides and hem, and along the bib's top
    R, outs = apron_edge()
    base, out_dir, nrm, widths_ = [], [], [], []
    n = len(R) - 1
    for i, (p, o) in enumerate(zip(R, outs)):
        z = p.y
        v = min(1.0, max(0.0, (z - APRON['top']) / (APRON['hem'] - APRON['top'])))
        rr = skirt_r(z) + apron_off(v)
        off = max(0.0035, apron_off(v) - APRON['thick'] - 0.0025)    # under the apron's edge
        a = -math.pi / 2 + p.x / rr
        b = skirt_pt(a, z, off)
        a2 = -math.pi / 2 + (p.x + o.x * 0.01) / rr
        b2 = skirt_pt(a2, z + o.y * 0.01, off)
        base.append(b)
        out_dir.append((b2 - b).normalized())
        nrm.append(Vector((math.cos(a), math.sin(a), 0.0)))
        ends = min(1.0, i / (0.06 * n), (n - i) / (0.06 * n))
        widths_.append(APRON_FRILL['width'] * (0.15 + 0.85 * ends * ends * (3 - 2 * ends)))
    bf = new_bm()
    ruffle(bf, base, out_dir, nrm, widths_, 0.002, APRON_FRILL['waves'], APRON_FRILL['amp'], APRON_FRILL['point'],
           'white', outward=lambda p: Vector((p.x, p.y, 0)), rows=2)
    m = 32
    base, out_dir, nrm = [], [], []
    for q in range(m + 1):
        x = BIB['half'][1] * (2 * q / m - 1) * 1.04
        p, nr = on_surf(rb, x, BIB['top'] - 0.006, 0.0105)
        base.append(p)
        out_dir.append(Vector((0.0, -0.35, 1.0)).normalized())
        nrm.append(nr)
    ruffle(bf, base, out_dir, nrm, 0.017, 0.002, 8, 0.0025, 0.3, 'white',
           outward=lambda p: Vector((p.x, p.y, 0)), rows=2, root=0.15)
    out(PFX + 'ApronFrill', bf, SMALL, sharp=50)
    # the bow at the back, its strings hanging over the skirt in two pointed tails
    K = APRON_BOW['knot']
    tails = []
    for s in (-1, 1):
        tails.append([skirt_pt(math.pi / 2 - s * math.radians(dx), z, 0.007) for dx, z in
                      ((2.0, 0.448), (5.5, 0.41), (9.5, 0.37), (13.5, 0.33))])
    bw = new_bm()
    ribbon_bow(bw, K, Vector((1, 0, 0)), Vector((0, 1, 0)), APRON_BOW['len'], APRON_BOW['width'], 'white', tails=tails,
               tail_w=0.024, tail_c=lambda c: Vector((0.0, 0.0, c.z)), thick=0.003)
    out(PFX + 'ApronBow', bw, SMALL, sharp=60)


# ================================================================== hands
def build_hands_bm():
    """Gloved mittens, as the Acolyte's: the right a fist round the broom-glaive's shaft, its thumb over the front; the
    left, out of its cuff, resting on her hip, its thumb toward the front."""
    bm = new_bm()
    sh, wr = (Vector(p) for p in ARMS['R'])
    G = Vector((BX + 0.003, BY - 0.002, GRIP_Z - 0.017))
    tube(bm, [wr - (wr - sh).normalized() * 0.02, G + Vector((0.012, 0.002, 0.004))], 0.0125, 'glove', n=3, k=10)
    ellipsoid(bm, G, (0.022, 0.021, 0.025), 'glove', segs=14, rings=10)
    ellipsoid(bm, G + Vector((0.011, -0.016, 0.012)), (0.0105, 0.0085, 0.009), 'glove', segs=10, rings=6,
              rot=Matrix.Rotation(math.radians(-30), 3, 'Y'))
    sh, wr = (Vector(p) for p in ARMS['L'])
    A = (wr - sh).normalized()
    body = bvh_of(O(PFX + 'Robe'), O(PFX + 'Sash'), O(PFX + 'Apron'))
    loc, nrm, _, _ = body.find_nearest(wr + A * 0.032)
    H = loc + nrm * 0.017
    F = (A - nrm * (A.dot(nrm) - 0.15)).normalized()   # the fingers: on along the arm, tipped a little off the skirt
    N = (nrm - F * nrm.dot(F)).normalized()            # the back of the hand
    T = N.cross(F)                                     # toward her back: the thumb lies the other way
    R = Matrix((F, T, N)).transposed()
    tube(bm, [wr - A * 0.02, H - F * 0.012], 0.0125, 'glove', n=3, k=10)
    ellipsoid(bm, H, (0.025, 0.019, 0.0115), 'glove', segs=14, rings=10, rot=R)
    ellipsoid(bm, H - T * 0.016 - F * 0.006 + N * 0.004, (0.012, 0.0075, 0.0075), 'glove', segs=10, rings=6, rot=R)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)


# ================================================================== the broom-glaive
def straw_pt(t, th, grow=0.0, grooves=True):
    """A point on the straw's surface at t up it (0 at its neck, 1 at its cut top) and th round it (radians; 0 toward
    her left, the flat faces front and back): a rounded oblong that flares fast out of the neck and then widens
    slowly to the top, grooved along its length when grooves; grow pushes the point out (a cord bound round it)."""
    (w0, h0), (w1, h1) = BROOM['half']
    w = w0 + (w1 - w0) * (1 - (1 - t) ** 2.2) + grow
    h = h0 + (h1 - h0) * t + grow
    c, s = math.cos(th), math.sin(th)
    k = 1.0 + (0.06 * math.cos(36 * th) * min(1.0, max(0.0, 4 * (t - 0.14))) if grooves else 0.0)   # above the cord
    z = BROOM['neck'] + (BROOM['top'] - BROOM['neck']) * t
    return Vector((BX + k * w * math.copysign(abs(c) ** 0.7, c), BY + k * h * math.copysign(abs(s) ** 0.7, s), z))


def build_broom_bm():
    """The broom-glaive in the right hand: a leather shaft with a metal butt; a broom's head of straw, a flat fan
    flaring up from a cord binding at its neck, its cut top ragged with the straws' ends; out of the middle of the
    top, through a metal collar, the blade it hid: a second glaive's blade, its edge out away from her."""
    M = Matrix.Translation((BX, BY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (SHAFT_R, 0.082), (SHAFT_R, BROOM['neck'] + 0.03), (0.0, BROOM['neck'] + 0.03)], 16,
          'leather', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0118, 0.082), (0.0128, 0.09), (0.0128, 0.104), (0.0112, 0.11), (0.0, 0.11)], 16, 'trim',
          xform=M)
    out(PFX + 'ShaftButt', bm, SMALL, sharp=45)
    # the straw: rings of points round it from the neck to the cut top, closed at both ends, the top's edge ragged
    NT, NA = 10, 40
    bm = new_bm()
    rings = []
    for q in range(NT + 1):
        t = q / NT
        ring = []
        for e in range(NA):
            p = straw_pt(t, 2 * math.pi * e / NA)
            if q == NT:
                p.z += 0.007 * zigzag(e / 2 + 0.5) - 0.012 * ((p.x - BX) / BROOM['half'][1][0]) ** 2
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for q in range(NT):
        for e in range(NA):
            face(bm, [rings[q][e], rings[q][(e + 1) % NA], rings[q + 1][(e + 1) % NA], rings[q + 1][e]], 'lhair')
    face(bm, rings[0][::-1], 'lhair')
    top = bm.verts.new(Vector((BX, BY, BROOM['top'] + 0.002)))
    for e in range(NA):
        face(bm, [rings[NT][e], rings[NT][(e + 1) % NA], top], 'lhair')
    out(PFX + 'Straw', bm, MID, sharp=60)
    # the cord bound three times round the straw's neck
    NC, NR = 24, 9
    bm = new_bm()
    ring = []
    for q in range(NR + 1):
        t = 0.14 * q / NR
        ridge = 0.0014 + 0.002 * abs(math.sin(math.pi * 3 * q / NR))
        ring.append([bm.verts.new(straw_pt(t, 2 * math.pi * e / NC, ridge, grooves=False)) for e in range(NC)])
    for q in range(NR):
        for e in range(NC):
            face(bm, [ring[q][e], ring[q][(e + 1) % NC], ring[q + 1][(e + 1) % NC], ring[q + 1][e]], 'leather')
    face(bm, ring[0][::-1], 'leather')
    face(bm, ring[-1][:], 'leather')
    out(PFX + 'Cords', bm, SMALL, sharp=60)
    # the metal collar where the blade leaves the straw, and the blade
    z0 = BROOM['top'] - 0.006
    bm = new_bm()
    lathe(bm, [(0.0, z0), (0.017, z0), (0.021, z0 + 0.005), (0.0235, z0 + 0.01), (0.021, z0 + 0.015),
               (0.016, z0 + 0.022), (0.0, z0 + 0.022)], 20, 'trim', sy=0.6, xform=M)
    out(PFX + 'BladeCollar', bm, SMALL, sharp=45)
    bm = new_bm()
    slab(bm, GLAIVE_BLADE, Matrix.Translation((BX, BY, z0 + 0.014)), 0.006, bevel=0.0018, seg=1)
    set_slot(bm, bm.faces, 'second')
    out(PFX + 'Blade', bm, MID, sharp=30)


# ================================================================== face and hair
def build_face_bm():
    """The Acolyte's chibi face (build_face_p) made undead: glowing irises, and two small fangs in her open smile
    (court.fangs), joined into the Face part so the pack's lock keeps them."""
    build_face_p()
    bm = new_bm()
    fangs(bm, bvh_of(O(PFX + 'Head')), FANG_Z)
    out(PFX + 'Fangs', bm, 0, sharp=80, recalc=False)
    join_into(PFX + 'Face', PFX + 'Fangs')
    undead_face(O(PFX + 'Face'))


def cap_off(phi, el):
    """How far build_hair_bm's cap stands off RH at (phi, el), as the Patriarch's cap does: thicker toward its hem."""
    return 0.004 + 0.016 * max(0.0, (88 - el) / (88 - hem(phi))) ** 2.2


def crown_lock_pts(s, path):
    """A crown lock's control points, 4 mm over the cap: path, CROWN_LOCKS's (azimuth, elevation) pairs on her left,
    on the side s (1 her left, -1 her right)."""
    return [surf(s * phi, el, cap_off(s * phi, el) + 0.004, RH) for phi, el in path]


def bun_pt(t, lift=0.0):
    """A point on the bun's coil at t along it (0 where it starts, outermost and lowest; 1 at its middle, highest),
    lift out from its axis (the coil's centre line at lift 0)."""
    base = surf(BUN['phi'], BUN['el'], 0.0, RH)
    A = (base - HC).normalized()
    U = A.cross(Vector((0.0, 0.0, 1.0))).normalized()
    V = A.cross(U)
    a = 2 * math.pi * BUN['turns'] * t
    r = BUN['r0'] + (BUN['r1'] - BUN['r0']) * t + lift
    return base + A * (BUN['out0'] + (BUN['out1'] - BUN['out0']) * t ** 0.8) + (U * math.cos(a) + V * math.sin(a)) * r


def build_hair_bm():
    """Her hair, put up for work: the Patriarch's cap closed over the crown with broad locks lying over it from a
    parting (CROWN_LOCKS; outlined by painted lines, not a hull), his fringe (BANGS), the two locks past the cheeks
    that the Acolyte wears, and at the back of the head a bun, a coil of hair wound in on itself, with locks gathered
    up into it from behind the ears and the nape."""
    cols, rows, top = 56, 9, 88.0
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
    crown = bm.verts.new(surf(0, 90, 0.004, RH))
    for i in range(cols):
        face(bm, [grid[(i + 1) % cols][0], crown, grid[i][0]], 'hair')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
    set_slot(bm, bm.faces, 'hair')
    out(PFX + 'HairCap', bm, BIG, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        for path, w in CROWN_LOCKS:
            strand(bm, crown_lock_pts(s, path), w, CROWN_LOCK_THICK, 'hair', HC, n=CROWN_LOCK_RINGS, k=6,
                   prof=bang_prof)
    # No hull: at the low LOD's error ceiling the pack folds these thin plates inside out, and a hull would draw every
    # back face the folds bare in ink, blotches all over the crown. Their outlines are painted instead (LinesHair),
    # and the low LOD drops them with the rest of the linework.
    out(PFX + 'HairCrown', bm, 0, sharp=70)
    bm = new_bm()
    for phi, tip, w in BANGS:
        strand(bm, bang_pts(phi, tip), w, 0.009, 'hair', HC, n=12, k=8, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        strand(bm, [surf(s * 58, 24, 0.006, RH), surf(s * 64, -6, 0.016, RH), surf(s * 61, -30, 0.026, RH),
                    surf(s * 54, -46, 0.03, RH)], 0.036, 0.011, 'hair', HC, n=14, k=8, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)
    bm = new_bm()
    tube(bm, [bun_pt(q / 32) for q in range(33)], BUN['thick'], 'hair', n=44, k=8,
         radius=lambda t: BUN['thick'] * (1 - 0.45 * t))
    for s in (-1, 1):
        for path, w in BUN_LOCKS:
            strand(bm, [surf(s * phi, el, cap_off(s * phi, el) + 0.004 + 0.003 * k, RH) for k, (phi, el) in
                        enumerate(path)], w, 0.008, 'hair', HC, n=10, k=6)
    out(PFX + 'HairBun', bm, MID, sharp=60)


# ================================================================== the headband and the hairclip
def band_dir(u, w):
    """The headband's direction from the head's centre at u along it (-1 at her right ear, 0 over the middle in
    front, 1 at her left ear) and w across it (-1 its back edge, 1 its front edge)."""
    T = dirv(0.0, HEADBAND['el'])
    X = Vector((1.0, 0.0, 0.0))
    N = X.cross(T).normalized()                        # forward and down: toward its front edge
    d = X * math.sin(math.pi / 2 * u) + T * math.cos(math.pi / 2 * u)
    return (d.normalized() + N * (w * HEADBAND['half'])).normalized()


def on_hair(hb, d, off):
    """Where the direction d from the head's centre meets the hair (hb: its bvh), lifted off along the hair's normal
    there, and that normal."""
    loc, nrm, _, _ = hb.ray_cast(HC + d * 0.6, -d)
    return loc + nrm * off, nrm


def build_headband_bm():
    """The maid's headband over the hair from ear to ear behind the fringe: a white band, a white frill standing on
    it, pleated, its edge cut into points; and a coat bow on it over her left temple, its tails cut to points."""
    hb = bvh_of(O(PFX + 'HairCap'), O(PFX + 'Bangs'), O(PFX + 'HairLocks'))
    NBND = 48

    def U(i):
        """The band's u at column i."""
        return 0.96 * (-1.0 + 2.0 * i / NBND)

    def taper(u):
        """How wide the band is at u: narrowing into the hair at the ears."""
        return 1 - 0.55 * abs(u) ** 4
    bm = new_bm()
    sheet(bm, lambda i, j: on_hair(hb, band_dir(U(i), (j - 1) * taper(U(i))), 0.0055)[0], NBND, 2, 0.003, 'white',
          'white', 'white', outward=lambda p: p - HC)
    out(PFX + 'Headband', bm, SMALL, sharp=40)
    n = HEAD_FRILL['pleats'] * 4
    base, out_dir, nrm, ws = [], [], [], []
    T = dirv(0.0, HEADBAND['el'])
    N = Vector((1.0, 0.0, 0.0)).cross(T).normalized()
    u0, u1 = HEAD_FRILL['from'], HEAD_FRILL['to']
    for q in range(n + 1):
        u = u0 + (u1 - u0) * q / n
        p, nr = on_hair(hb, band_dir(u, 0.1 * taper(u)), 0.0065)
        base.append(p)
        out_dir.append((nr - N * 0.1).normalized())  # standing up, leaning back a little
        nrm.append(N)
        ends = min(1.0, (u - u0) / 0.1, (u1 - u) / 0.1)
        ws.append(HEAD_FRILL['height'] * (1 - 0.45 * u * u) * (0.25 + 0.75 * ends * ends * (3 - 2 * ends)))
    bm = new_bm()
    ruffle(bm, base, out_dir, nrm, ws, 0.0022, HEAD_FRILL['pleats'], HEAD_FRILL['amp'], HEAD_FRILL['point'], 'white',
           outward=lambda p: N, rows=2, root=0.15)
    out(PFX + 'HeadFrill', bm, SMALL, sharp=50)
    # the bow, lying on the hair and turned a little to the front, its loops either side of the knot along the head,
    # its tails hanging down the hair and back past the ear
    u = HEAD_BOW['at']
    dk = band_dir(u, 0.0)
    K, nr = on_hair(hb, dk, 0.26 * HEAD_BOW['len'] + 0.01)
    Y = (nr + Vector((0.0, -0.15, 0.0))).normalized()
    X = Vector((0.0, 0.0, 1.0)).cross(Y).normalized()  # across the bow's face, level
    hh = bvh_of(O(PFX + 'HairCap'), O(PFX + 'Bangs'), O(PFX + 'HairLocks'), O(PFX + 'Head'))
    tails = [[on_hair(hh, (dk + Vector((0.0, back * f, -0.45 * f))).normalized(), 0.01)[0]
              for f in (0.0, 0.33, 0.66, 1.0)] for back in (0.2, 0.4)]
    bm = new_bm()
    ribbon_bow(bm, K, X, Y, HEAD_BOW['len'], HEAD_BOW['width'], 'coat', tails=tails, tail_w=0.011, tail_c=HC,
               thick=0.0025, n=10, k=6)
    out(PFX + 'HeadBow', bm, SMALL, sharp=60)


def build_clip_bm():
    """A tiny bat hairclip on the hair at her right, above the fringe: two court.bat_wing wings and a small body with
    pointed ears, all metal, built at a bat's own size and shrunk onto the hair as one, so that the wings' claws shrink
    with them."""
    hb = bvh_of(O(PFX + 'Bangs'), O(PFX + 'HairCap'))
    bm = new_bm()
    for s in (-1, 1):
        M = basis(Vector((s * 0.012, 0.0, 0.0)), Vector((s, 0.0, 0.0)), Vector((0.0, 1.0, 0.0)),
                  Vector((0.0, 0.0, 1.0)))
        bat_wing(bm, bm, M, 0.15, 0.11, thick=0.012, r=0.008, scallop=0.3, cup=0.008, nu=3, nv=2, wrist=(0.35, 1.0),
                 tips=((1.0, 0.45), (0.8, -0.15), (0.5, -0.45)), body=(0.1, -0.35), slot='trim', rib='trim')
    ellipsoid(bm, Vector((0.0, 0.0, 0.0)), (0.022, 0.014, 0.03), 'trim', segs=10, rings=6)
    for s in (-1, 1):
        c, sn = math.cos(math.radians(20)), math.sin(math.radians(20))
        spike(bm, basis(Vector((s * 0.01, 0.0, 0.022)), Vector((c, 0.0, -s * sn)), Vector((0, 1, 0)),
                        Vector((s * sn, 0.0, c))), 0.022, 0.008, 0.006, n=4)
    loc, nrm = on_hair(hb, dirv(CLIP['phi'], CLIP['el']), 0.006)
    Z = (Vector((0.0, 0.0, 1.0)) - nrm * nrm.z).normalized()
    Y = -nrm
    X = Y.cross(Z).normalized()
    R = Matrix((X, Y, Z)).transposed().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(loc) @ R @ Matrix.Scale(CLIP['shrink'], 4), verts=bm.verts[:])
    out(PFX + 'HairClip', bm, SMALL, sharp=50)


# ================================================================== drawn lines
def build_lines_bm():
    """The painted linework: the dress's hem band engraved; folds on the dress (round the back and sides), the
    sleeves and the apron's gathers at the waist; the fringe's strands, a parting and strands combed from it over the
    cap toward the bun, strands along the bun's coil, the crown locks' outlines; straws up the broom's two faces and a
    stitch across them."""
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()
    pts = [p for p in (ray_in(rb, 2 * math.pi * q / 240, 0.147 + 0.011 * math.sin(26 * 2 * math.pi * q / 240))
                       for q in range(241)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        if abs(math.degrees(a0) % 360 - 270) < 70:       # under the apron
            continue
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lmain', n=30)
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    SLR = [(0.25, 0.048), (0.55, 0.055), (0.70, 0.06), (0.85, 0.066)]

    def sl_r(zn):
        """The sleeve's radius at zn of the arm's length (SLEEVE, roughly)."""
        for (z0, r0), (z1, r1) in zip(SLR, SLR[1:]):
            if zn <= z1:
                return r0 + (r1 - r0) * (zn - z0) / (z1 - z0)
        return SLR[-1][1]
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        for a in (0.4, 1.9, 3.3, 4.6):
            line3d(bm, sleeveb, [M @ Vector((sl_r(zn) * math.cos(a + 0.15 * zn), sl_r(zn) * math.sin(a + 0.15 * zn),
                                             zn * L)) for zn in (0.32, 0.5, 0.66, 0.8)], 0.0016, 'lmain', n=18)
    ab = bvh_of(O(PFX + 'Apron'))
    for u in (-0.71, -0.43, -0.14, 0.14, 0.43, 0.71):
        ctrl = [skirt_pt(math.radians(-90 + apron_half(v) * u), apron_z(v), apron_off(v) + 0.01)
                for v in (0.03, 0.2, 0.36)]
        line3d(bm, ab, ctrl, 0.0016, 'lmain', n=12, taper='end')
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for phi, tip, w in BANGS:
        F = strand_frames(bang_pts(phi, tip), HC, 12)
        P, N = [], []
        for i in range(1, 11):
            c, t, sd, nr = F[i]
            P.append(c + nr * 0.009 * bang_prof(i / 12))
            N.append(nr)
        strip(bm, P, N, widths(len(P), 0.0013, 'both'), 'lhair', 0.0011)
    capH = bvh_of(O(PFX + 'HairCap'))
    # a parting down the middle of the crown, the hair combed from it down the sides and back into the bun, and up
    # into it from the nape
    line3d(bm, capH, [surf(0, el, 0.03, RH) for el in (54, 70, 87)], 0.0013, 'lhair', n=16)
    for s in (-1, 1):
        for path in (((3, 84), (58, 64), (108, 36), (148, 14)), ((3, 72), (52, 50), (98, 22), (140, 6)),
                     ((3, 60), (42, 50), (90, 36), (132, 16)), ((4, 89), (140, 68), (166, 42), (172, 25)),
                     ((96, -18), (124, -10), (150, -3)), ((164, -44), (170, -30), (173, -20))):
            line3d(bm, capH, [surf(s * phi, el, 0.03, RH) for phi, el in path], 0.0016, 'lhair', n=22)
    bun = bvh_of(O(PFX + 'HairBun'))
    base = surf(BUN['phi'], BUN['el'], 0.0, RH)
    A = (base - HC).normalized()
    for ang in (65.0, 115.0):                         # strands along the bun's coil, on its outer face
        ctrl = []
        for q in range(13):
            t = 0.04 + 0.86 * q / 12
            c = bun_pt(t)
            radial = c - base - A * (c - base).dot(A)
            radial.normalize()
            a = math.radians(ang)
            ctrl.append(c + (radial * math.cos(a) + A * math.sin(a)) * BUN['thick'] * (1 - 0.45 * t) * 1.1)
        line3d(bm, bun, ctrl, 0.0015, 'lhair', n=48)
    # the crown locks' outlines, in ink as a hull draws them (build_hair_bm says why they have none): down each lock's
    # two edges to its tip, on its top surface at 0.8 of its half width as strand() lays it, cast from outside onto
    # what shows there, the lock or the cap where the lock dips under it
    hb = bvh_of(O(PFX + 'HairCrown'), O(PFX + 'HairCap'))
    for s in (-1, 1):
        for path, w in CROWN_LOCKS:
            F = strand_frames(crown_lock_pts(s, path), HC, CROWN_LOCK_RINGS)
            for so in (-0.8, 0.8):
                edge = [c + nr * (CROWN_LOCK_THICK * bang_prof(i / CROWN_LOCK_RINGS) * math.sqrt(1 - so * so)) +
                        sd * (w * bang_prof(i / CROWN_LOCK_RINGS) * so) for i, (c, t, sd, nr) in enumerate(F)]
                hits = [on_hair(hb, (p - HC).normalized(), 0.0) for p in catmull(edge, 16)]
                strip(bm, [p for p, _ in hits], [n for _, n in hits], widths(len(hits), CROWN_LOCK_LINE, 'end'), 'ink',
                      0.0012)
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    # straws drawn up the broom's two flat faces, and a stitch across them
    sb = bvh_of(O(PFX + 'Straw'))
    bm = new_bm()
    for side in (-1, 1):
        for x in (-0.8, -0.5, -0.2, 0.15, 0.45, 0.75):
            ctrl = [straw_pt(t, math.atan2(side * 0.9, x * 1.3), 0.004, grooves=False) for t in (0.22, 0.5, 0.75, 0.95)]
            line3d(bm, sb, ctrl, 0.0011, 'lgold', n=14)
        line3d(bm, sb, [straw_pt(0.55, math.atan2(side, x), 0.004, grooves=False) for x in (-1.6, -0.6, 0.6, 1.6)],
               0.0014, 'leather', n=18, taper='none')
    out(PFX + 'LinesBroom', bm, 0, sharp=80, recalc=False)


def build_p():
    """The Battle Maid: the Acolyte's body in a long maid's dress and frilled apron, her hair up under a frilled
    headband with a bat clip, a broom-glaive in her right hand; posed and scaled as the Acolyte."""
    build_base()
    build_dress_bm()
    build_sleeves_bm()
    build_collar_bm()
    build_apron_bm()
    build_hands_bm()
    build_broom_bm()
    build_face_bm()
    build_hair_bm()
    build_brows_p()
    build_headband_bm()
    build_clip_bm()
    build_lines_bm()
    pose_head()
    scale_figure(SCALE)

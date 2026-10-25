# Fallen Queen (Queen). exec kit.py, holy-order/patriarch.py, holy-order/abbess.py, court.py, then this file into
# one dict; call build_q(). Built at the king's scale on the Abbess's body and face (her ROBE, robe_r, ARMS and
# SLEEVE carry over), then scaled down by SCALE about the base's top.
import math

import bmesh
from mathutils import Matrix, Vector

PFX = 'FQ_'
COLL = 'FallenQueen'
# the head rolls -5 degrees, the Abbess's -6: the top (1.285) is the left horn's curl, so it moves with the roll
POSE = {'head_roll': -5.0, 'head_pitch': 4.0, 'cape_flare': 0.0}
SCALE = 0.92
# sleeves with a plum (crimson) band between the silver (gold) cuffs, as the Overlord's
SLEEVE_SLOT = ['main', 'main', 'main', 'main', 'trim', 'accent', 'trim', 'trim', 'trim', 'second', 'second']
# the Patriarch's long hair (build_hair) with the Abbess's parted fringe and long front locks, no side tufts
BANGS = QBANGS
BANG_LAYER = []
TUFTS = []
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'HairCap', 'Bangs', 'HairLocks', 'HairCuffs', 'HairBack', 'HairBackClumps',
                 'HairClasp', 'LinesHair', 'Horns', 'Tiara', 'TiaraSpikes', 'TiaraGems', 'LinesHead']
# the skirt's tiers: (top, hem, flare past the gown at the hem, points round it, their depth, their offset in points)
FQ_TIERS = [(0.452, 0.318, 0.045, 16, 0.014, 0.0), (0.372, 0.222, 0.045, 16, 0.016, 0.5)]
FANG_Z = 0.8634                                      # the Abbess's smile line at x = 0.006 either side (build_head_q)
HORN = {'phi': 58.0, 'el': 40.0, 'turn': 52.0}
PUFF_R, PUFF_ALPHA = 0.082, 54
# the upper tier's metal stars: on the gown's fold crests (robe_r), between its fold lines
TIER_STARS = [(-0.3 + 2 * math.pi * k) / 10 for k in range(10)]
TIER_STAR_Z = 0.398
ROSE = Vector((0.0, -0.214, 0.692))
ROSE_AXIS = Vector((0.0, -0.45, 1.0)).normalized()


def bang_pts(phi, tip):
    """build_hair's fringe strands: the Abbess's, swept out from a parting."""
    return qbang_pts(phi, tip)


def front_lock_pts(s):
    """build_hair's long front locks: the Abbess's, down to the waist."""
    return qlock_pts(s)


def make_back_y():
    """Where the hair's back fall lies: on the gown's back (bodice, sash and shoulders) instead of the
    Patriarch's collar, mantle and cape, and above the shoulder blades no closer than a line from
    there to the back of the head, so it falls straight from the head instead of tucking in at the
    nape (the Patriarch's standing collar held his out)."""
    backs = [bvh_of(O(PFX + n)) for n in ('Robe', 'Sash', 'HighCollar', 'Puffs')]

    def back_y(x, z):
        best = 0.15 + 0.32 * (z - 0.6) if z > 0.6 else None
        for b in backs:
            loc, _, _, _ = b.ray_cast(Vector((x, 1.0, z)), Vector((0, -1, 0)))
            if loc is not None and (best is None or loc.y > best):
                best = loc.y
        return best if best is not None else 0.2
    return back_y


def curtain_pt(back_y, u, z, extra=0.0):
    """The Patriarch's back fall, gathered narrower under the clasp so the wings stand clear beside it."""
    x = 0.09 * u * (1 + 0.2 * (0.86 - z) / 0.4)
    return Vector((x, back_y(x, z) + TH + GAP + extra, z))


def robe_at(z):
    """The gown's radius at height z, read off ROBE between its points (before robe_r's folds)."""
    for (r0, z0), (r1, z1) in zip(ROBE[1:], ROBE[2:]):
        if z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return ROBE[-1][0]


# ================================================================== gown
def build_robe_fq():
    """The Patriarch's gown on the Abbess's ROBE, its lace in accent as the Court has it, and a stomacher."""
    build_robe()
    reslot(PFX + 'Alb', 'white', 'accent')
    # a stomacher pointing down to the sash, under the hands: accent, edged in metal, a gem at its point
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()
    decal_poly(bm, rb, edge_pts([(-0.034, 0.566), (0.0, 0.486), (0.034, 0.566)], 0.005), FR, 0.002, 'accent',
               center=(0, 0.54), rings=3)
    out(PFX + 'Panel', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, rb, [(s * 0.031, 0.562), (s * 0.016, 0.528), (s * 0.003, 0.495)], [0.0028] * 3, FR, 0.0028,
                   'trim', n=16)
    decal_poly(bm, rb, star_poly(0, 0.538, 0.009, 0.013), FR, 0.0032, 'trim', center=(0, 0.538), rings=2)
    out(PFX + 'PanelGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    decal_poly(bm, rb, ellipse(0, 0.503, 0.0055, 0.0062, 14), FR, 0.0042, 'gem', rings=1)
    out(PFX + 'PanelGems', bm, 0, sharp=80, recalc=False)


def build_tiers():
    """The skirt's tiers over the gown, each hanging from under the one above, flaring a little and cut
    into points at the hem; they ripple with the gown's own folds."""
    bm = new_bm()
    rows = (0.0, 0.2, 0.4, 0.6, 0.72, 0.9, 1.0)     # down the outer face: coat, an accent band, a thin metal edge
    for z0, z1, flare, points, depth, phase in FQ_TIERS:
        No, Ni, th = len(rows), 4, 0.006

        def gap(z):
            return 0.003 + (flare - 0.003) * ((z0 - z) / (z0 - z1)) ** 1.4
        outer = [(robe_at(z) + gap(z) + th, z) for z in (z0 + (z1 - z0) * f for f in rows)]
        inner = [(robe_at(z) + gap(z), z) for z in (z1 + (z0 - z1) * q / (Ni - 1) for q in range(Ni))]
        prof = outer + inner

        def shift(a, j):
            k = 1.0 if No - 3 <= j <= No else (0.4 if j == No + 1 else 0.0)
            tw = 1 - abs(((a * points / (2 * math.pi) + phase) % 1.0) * 2 - 1)
            return depth * tw * k

        def slot(i, j):
            if j < No - 3:
                return 'coat'
            if j == No - 3:
                return 'accent'
            if j < No:
                return 'trim'
            return 'accent'
        lathe(bm, prof, 80, slot, sy=SY, wrap=True,
              rmod=lambda r, z, a, j: robe_r(r, z, a, j) + 0.7 * shift(a, j),
              zmod=lambda r, z, a, j: z - shift(a, j))
    out(PFX + 'Tiers', bm, MID, sharp=50)
    # four-pointed metal stars round the upper tier, a gem in each (the Overlord's tabard stars)
    tb = bvh_of(O(PFX + 'Tiers'))
    bm, bg = new_bm(), new_bm()
    for a0 in TIER_STARS:
        frame = (Vector((0, 0, 0)), Vector((-math.sin(a0), math.cos(a0), 0)), Vector((0, 0, 1)),
                 Vector((-math.cos(a0), -math.sin(a0), 0)))
        decal_poly(bm, tb, star_poly(0, TIER_STAR_Z, 0.0105, 0.015), frame, 0.003, 'trim', center=(0, TIER_STAR_Z),
                   rings=2)
        decal_poly(bg, tb, ellipse(0, TIER_STAR_Z, 0.0034, 0.0034, 12), frame, 0.0042, 'gem', rings=1)
    out(PFX + 'TierStars', bm, 0, sharp=80, recalc=False)
    out(PFX + 'TierGems', bg, 0, sharp=80, recalc=False)


def build_sleeves_fq():
    """The Patriarch's sleeves on the Abbess's arms, their lace cuffs in accent."""
    build_sleeves()
    reslot(PFX + 'Frills', 'white', 'accent')


def puff_frames():
    """Each shoulder puff's dome: its centre and axis over the gown's shoulder, as the Abbess's shoulder
    plates sit (a dome() of radius PUFF_R opening PUFF_ALPHA degrees)."""
    gb = bvh_of(O(PFX + 'Robe'))
    frames = []
    for s in (-1, 1):
        A = Vector((s * math.sin(math.radians(46)), 0.0, math.cos(math.radians(46))))
        loc, _, _, _ = gb.ray_cast(Vector((s * 0.5, 0.0, 0.81)), Vector((-s * 0.5, 0, -0.12)).normalized())
        frames.append((loc + A * (0.006 + PUFF_R * (1 - math.cos(math.radians(PUFF_ALPHA)))) - A * PUFF_R, A))
    return frames


def build_puffs():
    """Puffed caps over the shoulders, scalloped at the rim: the gown covers them."""
    bm = new_bm()
    for C0, A in puff_frames():
        lathe(bm, dome(PUFF_R, PUFF_ALPHA), 32, lambda i, j: 'coat' if j < 6 else ('trim' if j < 10 else 'accent'),
              wrap=True, xform=Matrix.Translation(C0) @ axis_to(A),
              rmod=lambda r, z, a, j: r + (0.008 * max(0.0, math.cos(8 * a)) if j in (7, 8, 9) else 0.0))
    out(PFX + 'Puffs', bm, MID, sharp=40)


def build_hands_fq():
    """The Abbess's joined hands; the high collar closes the neck instead of her ruff."""
    build_ruff_hands()
    drop(PFX + 'Ruff')


def build_high_collar():
    """A high standing collar round the neck, lined in accent, its rim metal."""
    prof = [(0.05, 0.7), (0.06, 0.706), (0.064, 0.73), (0.069, 0.755), (0.075, 0.768), (0.073, 0.774), (0.066, 0.766),
            (0.058, 0.74), (0.052, 0.708)]
    bm = new_bm()
    lathe(bm, prof, 48, lambda i, j: 'coat' if j < 3 else ('trim' if j < 6 else 'accent'), sy=SY, wrap=True)
    out(PFX + 'HighCollar', bm, MID, sharp=50)


# ================================================================== the black rose
def rose_frame():
    """The rose head's frame: origin at its heart, z along its axis (tilted toward the viewer)."""
    z = ROSE_AXIS
    x = Vector((1, 0, 0))
    y = z.cross(x).normalized()
    return basis(ROSE, x, y, z)


def petal(bm, M, th0, width, h, r0, r1, flare, slot='coat', nu=4, nv=3):
    """One cupped petal into bm, in slot, in the rose's frame M, spanning the turn from th0 - width / 2 to
    th0 + width / 2 about its axis: it rises h from radius r0 to r1, its lip flaring out by flare, its top
    rounded. nu, nv: its sheet's cells across and up."""
    def P(i, j):
        f, t = i / nu, j / nv
        th = th0 + width * (f - 0.5)
        hh = h * t * (1 - 0.28 * (2 * f - 1) ** 2)
        rr = r0 + (r1 - r0) * t ** 1.3 + flare * t ** 3
        return M @ Vector((rr * math.cos(th), rr * math.sin(th), hh))
    sheet(bm, P, nu, nv, 0.0018, slot, slot, slot, outward=lambda p: (p - M.translation))


def build_rose():
    """The black rose held in the joined hands: a bud in three petals, five more round it, sepals under
    it, its stem down between the palms with two leaves below them."""
    M = rose_frame()
    bm = new_bm()
    ellipsoid(bm, M @ Vector((0, 0, 0.016)), (0.009, 0.009, 0.013), 'coat', segs=10, rings=6)
    for k in range(3):
        petal(bm, M, 2.1 * k, 2.6, 0.03, 0.005, 0.013, 0.003)
    for k in range(5):
        petal(bm, M, 2 * math.pi * k / 5 + 0.6, 1.9, 0.028, 0.008, 0.024, 0.011)
    out(PFX + 'Rose', bm, SMALL, sharp=60)
    bm = new_bm()
    tube(bm, [M @ Vector((0, 0, 0.002)), ROSE + Vector((0.0, 0.004, -0.06)), ROSE + Vector((0.002, 0.012, -0.15))],
         0.0034, 'leather', n=12, k=6)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        Ms = M @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((0.005, 0, 0.001)) @ Matrix.Rotation(math.radians(115), 4, 'Y')
        slab(bm, leaf(0.016, 0.0045, 0.1, n=4), Ms, 0.0016, bevel=0.0)
    for s, z, ang in ((1, -0.132, 118), (-1, -0.142, 128)):
        base = ROSE + Vector((0.0015 * s, 0.009, z))
        Ml = Matrix.Translation(base) @ Matrix.Rotation(s * math.radians(ang), 4, 'Y') @ Matrix.Rotation(-0.3, 4, 'X')
        slab(bm, leaf(0.026, 0.008, -0.25, n=8), Ml, 0.002, bevel=0.0)
    set_slot(bm, bm.faces, 'leather')
    out(PFX + 'RoseStem', bm, SMALL, sharp=50)


# ================================================================== face, horns, tiara
def build_face_fq():
    """The Abbess's chibi face made undead: glowing irises, and two small fangs under her smile, each a
    white triangle on a thin ink one (court.undead_fangs), joined into the Face part so the pack's lock
    keeps them."""
    build_head_q()
    undead_fangs(FANG_Z)


def build_hair_fq():
    """The Patriarch's long hair (with the overrides above), its cap closed over the crown: his stops
    under the mitre, and the queen's crown shows between her horns."""
    build_hair()
    drop(PFX + 'HairTufts')        # TUFTS is empty
    cols, rows, top = 84, 12, 88.0
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


def horn_frame(s):
    """A horn's root, a little inside the hair above the temple, in basis() terms: x out and forward
    (the curl's axis, turned HORN['turn'] degrees toward the front so the curl shows from there too),
    y back and out, z up."""
    root = surf(s * HORN['phi'], HORN['el'], -0.006, RH)
    t = math.radians(HORN['turn'])
    return basis(root, Vector((s * math.cos(t), -math.sin(t), 0)), Vector((s * math.sin(t), math.cos(t), 0)),
                 Vector((0, 0, 1)))


def build_horns():
    """Curled ram's horns from above the temples (court.horn), each with two metal bands near its root."""
    bm = new_bm()
    for s in (-1, 1):
        horn(bm, horn_frame(s), 0.034, 0.165, 0.11, turns=0.95, lean=0.15, splay=0.1, drift=0.02, tip=0.3, ridges=10,
             n=64)
    out(PFX + 'Horns', bm, MID, sharp=60)


def tiara_pt(phi, el, dr=0.0):
    """A point on the tiara's band at (phi, el) over the hair, dr off it."""
    return surf(phi, el, 0.011 + dr, RH)


def build_tiara_fq():
    """A metal band over the fringe between the horns, with slender blades rising from it, the front one
    tallest, and gems at their feet."""
    bm = new_bm()
    sheet(bm, lambda i, j: tiara_pt(-48 + 96 * i / 40, 31.0 + 4.5 * j / 2), 40, 2, 0.004, 'trim', 'trim', 'trim',
          outward=lambda p: p - HC)
    out(PFX + 'Tiara', bm, SMALL, sharp=40)
    bm, bg = new_bm(), new_bm()
    for phi, L, W in ((0, 0.11, 0.019), (-15, 0.07, 0.012), (15, 0.07, 0.012), (-30, 0.05, 0.01), (30, 0.05, 0.01),
                      (-42, 0.035, 0.008), (42, 0.035, 0.008)):
        foot = tiara_pt(phi, 35.0, 0.0)
        n = (foot - HC).normalized()
        t = Vector((math.cos(math.radians(phi)), math.sin(math.radians(phi)), 0.0))
        up = Vector((0, 0, 1)) - n * 0.25
        up = (up - t * up.dot(t)).normalized()
        M = basis(foot - n * 0.002, t, up.cross(t), up)
        spike(bm, M, L, W, 0.006, curve=0.04, waist=0.15)
        big = phi == 0
        gem_cut(bg, basis(tiara_pt(phi, 33.2, 0.004), t, -n, up), 0.011 if big else 0.006, 0.013 if big else 0.007,
                0.013 if big else 0.007, 0.006 if big else 0.004)
    out(PFX + 'TiaraSpikes', bm, MID, sharp=30)
    out(PFX + 'TiaraGems', bg, SMALL, smooth=False)


# ================================================================== wings
def wing_frame_fq(s, back):
    """A wing's root on the hair's back fall at the shoulder blade, standing off the outermost strand
    under the wing's inner half so none pokes through it: x out and back, z up, leaning back clear of
    the head."""
    hits = [back.ray_cast(Vector((s * x, 1.0, z)), Vector((0, -1, 0)))[0] for x in (0.03, 0.05, 0.07, 0.09, 0.11)
            for z in (0.56, 0.6, 0.64, 0.68)]
    root = Vector((s * 0.05, max(p.y for p in hits if p is not None) + 0.008, 0.64))
    X = Vector((s * math.cos(math.radians(40)), math.sin(math.radians(40)), 0.0))
    Z = Vector((0.0, math.sin(math.radians(25)), math.cos(math.radians(25))))
    Z = (Z - X * Z.dot(X)).normalized()
    return basis(root, X, Z.cross(X) * s, Z)


def build_wings():
    """Small bat wings (court.bat_wing) from the shoulder blades, no wider than the shoulders."""
    back = bvh_of(O(PFX + 'HairBack'), O(PFX + 'HairBackClumps'))
    bm, bb = new_bm(), new_bm()
    for s in (-1, 1):
        M = wing_frame_fq(s, back)
        bat_wing(bm, bb, M, 0.155, 0.24, wrist=(0.3, 1.0), tips=((1.0, 0.55), (0.9, 0.1), (0.6, -0.22)),
                 body=(0.08, -0.16))
        root = M.translation
        hit = back.ray_cast(root, Vector((0, -1, 0)))[0]
        tube(bb, [root + Vector((0, 0.003, 0)), (hit if hit is not None else root) - Vector((0, 0.006, 0))], 0.0062,
             'second', n=2, k=8)       # the arm's root, into the back
    out(PFX + 'Wings', bm, MID, sharp=50)
    out(PFX + 'WingBones', bb, SMALL, sharp=50)


# ================================================================== drawn lines
def scalp_pt(phi, el, dr=0.0):
    """A point on build_hair_fq's cap at (phi, el), dr off it."""
    t = max(0.0, (88 - el) / (88 - hem(phi)))
    return surf(phi, el, 0.004 + 0.016 * t ** 2.2 + dr, RH)


def tier_pt(a, z):
    """A point just outside the tiers at angle a (radians; -pi/2 is the front) and height z, for line3d to
    lay onto the outermost tier there."""
    R = robe_at(z) + 0.06
    return Vector((R * math.cos(a), R * math.sin(a) * SY, z))


def build_lines_fq():
    """The painted linework: engravings on the metal, cloth folds, hair strands and the tier's curls."""
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    tb = bvh_of(O(PFX + 'Tiers'))
    # ---- engravings on the metal: the gown's hem band and the cuffs
    bm = new_bm()
    pts = [p for p in (ray_in(rb, 2 * math.pi * q / 240, 0.147 + 0.011 * math.sin(26 * 2 * math.pi * q / 240))
                       for q in range(241)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
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
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    # ---- the tiara band's engraving (posed with the head)
    bm = new_bm()
    P = [tiara_pt(-46 + 92 * q / 60, 33.25) for q in range(61)]
    strip(bm, P, [(p - HC).normalized() for p in P], [0.0009] * 61, 'lgold', 0.0005)
    out(PFX + 'LinesHead', bm, 0, sharp=80, recalc=False)

    # ---- cloth folds: the tiers' coat at the gown's fold troughs, the sleeves, the puffs' gathers
    bm = new_bm()
    for za, zb in ((0.425, 0.372), (0.302, 0.278)):
        for k in range(10):
            a0 = (math.pi - 0.3 + 2 * math.pi * k) / 10
            line3d(bm, tb, [tier_pt(a0 + 0.015 * q, z) for q, z in enumerate((za, (za + zb) / 2, zb))], 0.0021, 'lcoat',
                   n=16, taper='end')
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
    al = math.radians(PUFF_ALPHA)
    for C0, A in puff_frames():
        Rm = axis_to(A).to_3x3()
        U, V = Rm @ Vector((1, 0, 0)), Rm @ Vector((0, 1, 0))
        for q in range(8):
            ph = 2 * math.pi * (q + 0.5) / 8
            d = [A * math.cos(th) + (U * math.cos(ph) + V * math.sin(ph)) * math.sin(th) for th in
                 (al * f for f in (0.18, 0.4, 0.62, 0.8))]
            strip(bm, catmull([C0 + v * PUFF_R for v in d], 12), [v.normalized() for v in catmull(d, 12)],
                  widths(13, 0.0017, 'start'), 'lcoat', 0.0012)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)

    # ---- hair strands (posed with the head)
    bm = new_bm()
    capH = bvh_of(O(PFX + 'HairCap'))
    for s in (-1, 1):
        for phi in (72, 92, 112, 132, 152, 172):
            line3d(bm, capH, [scalp_pt(s * phi, el) for el in (80, 60, 30, 5, hem(s * phi) + 4)], 0.0017, 'lhair', n=26)
        for phi in (12, 26, 40):      # from the parting over the crown, down to the tiara
            line3d(bm, capH, [scalp_pt(s * phi * f, el) for f, el in ((0.2, 84), (0.6, 70), (0.9, 52), (1.0, 38))],
                   0.0015, 'lhair', n=20)
    line3d(bm, capH, [scalp_pt(0, el) for el in (38, 60, 86)], 0.0012, 'lhair', n=16)

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
        strand_lines(qlock_pts(s), 0.046, 0.014, body_center, 20, bang_prof, (0.0, 0.5, -0.5))
        strand_lines(back_lock_pts(s), 0.034, 0.012, body_center, 14, bang_prof, (0.0,))
    back_y = make_back_y()
    curtB = bvh_of(O(PFX + 'HairBack'))
    for k in range(-4, 4):
        for u, tipline in (((k + 0.25) / 3.5, True), ((k - 0.25) / 3.5 + 0.05, False)):
            if abs(u) > 0.95:
                continue
            phi = 180 + 44 * u
            zh = 0.47 + 0.06 * abs(u) ** 1.4 + 0.07 * curtain_tooth(u)
            line3d(bm, curtB, [surf(phi, -10, 0.026, RH), curtain_pt(back_y, u, 0.76, 0.004),
                               curtain_pt(back_y, u, 0.64, 0.004),
                               curtain_pt(back_y, u, zh + (0.006 if tipline else 0.05), 0.004)], 0.0016, 'lhair', n=24)
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)

    # ---- metal curls either side of each of the upper tier's stars (TIER_STARS, build_tiers)
    bm = new_bm()
    for a0 in TIER_STARS:
        for s in (-1, 1):
            path = [(s * 0.014, TIER_STAR_Z), (s * 0.022, TIER_STAR_Z + 0.004), (s * 0.03, TIER_STAR_Z + 0.002)] + \
                scroll_pts(s * 0.034, TIER_STAR_Z - 0.004, s, 0.006, turns=1.1, n=8, start=90.0)[1:]
            line3d(bm, tb, [tier_pt(a0 + u / (robe_at(z) + 0.04), z) for u, z in path], 0.0022, 'trim', n=24,
                   lift=0.0016, taper='end')
    out(PFX + 'GoldScrolls', bm, 0, sharp=80, recalc=False)


def build_q():
    build_base()
    build_robe_fq()
    build_tiers()
    build_sleeves_fq()
    build_puffs()
    build_hands_fq()
    build_high_collar()
    build_rose()
    build_face_fq()
    build_hair_fq()
    build_brows_q()
    build_horns()
    build_tiara_fq()
    build_wings()
    build_lines_fq()
    pose_head()
    scale_figure(SCALE)

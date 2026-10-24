# Bone Rider (Knight). exec kit.py, holy-order/patriarch.py, holy-order/warden.py, holy-order/paladin.py, court.py,
# then this file into one dict; call build_n(). The Paladin's rider in dark armour with a pennant lance, built at the
# king's scale and shrunk onto the saddle, on a skeletal horse built in place where his horse stands, keeping its
# size and pose; then the whole scaled down by SCALE about the base's top.
import math

from mathutils import Matrix, Vector

PFX = 'BR_'
COLL = 'BoneRider'
SCALE = 0.88
# POSE, CAP_SLOT, RIDER_S, RIDER_T and BODY_C carry over from the Paladin.
# The right fist holds the lance out at the side, clear of the helm (the Paladin's raised sword passes through it);
# the left holds the reins as his does.
GRIP = Vector((-0.285, -0.09, 0.68))
ARMS = {'R': ((-0.12, 0.0, 0.675), (GRIP.x + 0.012, GRIP.y + 0.008, GRIP.z - 0.04)),
        'L': ((0.12, 0.0, 0.675), (0.07, -0.17, 0.575))}
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'Helm', 'HelmBand', 'HelmGems', 'HelmWings', 'HelmWingBones',
                 'HelmCrest', 'LinesHair', 'LinesHelm']
FANG_Z = 0.8622                                      # the Patriarch's mouth line at x = 0.006 either side (build_head)
# ---- the rider (the king's scale)
# the lance, upright through the right fist: its butt (above the knee), the foot of its head, its tip (the figure's
# top), the shaft's radius in the fist and its metal bands (bottom, height)
LANCE = {'butt': 0.44, 'head': 1.33, 'tip': 1.45, 'r': 0.0085}
LANCE_BANDS = ((0.44, 0.03), (0.6, 0.016), (0.73, 0.016), (1.145, 0.016))
# the pennant below the lance's head: its top and bottom at the shaft, its length, the way it streams (out and
# back), how deep the notch between its two tails is (a fraction of its length) and how far it ripples
PENNANT = {'top': 1.3, 'bottom': 1.17, 'len': 0.28, 'dir': Vector((-0.8, 0.6, 0.0)), 'notch': 0.3, 'wave': 0.018}
# the cape: the Paladin's, its hem cut into points (court.tatter outline: (u, hang) from the left shoulder round the
# back to the right), the notches' height and the points' depth below them
CAPE_POINTS = [(q / 12, float(q % 2)) for q in range(13)]
CAPE_CUT, CAPE_DEPTH = 0.42, 0.06
# ---- the horse (in place)
# the skull along its axis from the back of the cranium to the tip of the snout; its profile at even steps from back
# to front: half width, half height, how far its middle stands above the axis
SKULL_BACK, SKULL_TIP = Vector((0.0, -0.2, 0.705)), Vector((0.0, -0.462, 0.6))
SKULL_PROF = [(0.05, 0.05, 0.004), (0.066, 0.064, 0.006), (0.07, 0.068, 0.006), (0.066, 0.065, 0.002),
              (0.056, 0.058, -0.004), (0.048, 0.051, -0.007), (0.045, 0.048, -0.008), (0.044, 0.046, -0.008),
              (0.043, 0.044, -0.007)]
# the eye sockets: where along the skull, how far each turns from the side toward the nose and lifts toward the top
# (degrees), their half width and height
SOCKET = {'u': 0.33, 'turn': 48.0, 'lift': 18.0, 'r': (0.027, 0.029)}
# the vertebral column from the skull's back down the neck, along the back and into the tail (centres), and the
# beads along it (where, as a fraction of its length, and radius)
SPINE = [Vector(p) for p in ((0.0, -0.218, 0.645), (0.0, -0.19, 0.585), (0.0, -0.155, 0.53), (0.0, -0.105, 0.512),
                             (0.0, 0.0, 0.515), (0.0, 0.1, 0.515), (0.0, 0.2, 0.505), (0.0, 0.262, 0.49),
                             (0.0, 0.302, 0.468), (0.0, 0.332, 0.44), (0.0, 0.352, 0.405))]
SPINE_BEADS = ((0.025, 0.034), (0.095, 0.034), (0.165, 0.032), (0.235, 0.028), (0.31, 0.022), (0.68, 0.021),
               (0.75, 0.02), (0.82, 0.018), (0.87, 0.016), (0.92, 0.014), (0.97, 0.012))
SPINE_SPIKES = (0.27, 0.31, 0.69, 0.74, 0.79)          # short spines up from the withers and the croup
# ribs: their places along the body and how far round each reaches (degrees below the side; the last two float),
# and how far back each sweeps as it falls
RIBS = ((-0.115, 80), (-0.07, 80), (-0.025, 78), (0.02, 74), (0.065, 66), (0.11, 30), (0.155, 18))
RIB_SWEEP = 0.06
# the legs' joints, top to bottom (one side, x > 0): shoulder, elbow, knee, fetlock; hip, stifle, hock, fetlock
FORE_LEG = [Vector(p) for p in ((0.098, -0.165, 0.385), (0.085, -0.112, 0.3), (0.072, -0.13, 0.212),
                                (0.068, -0.12, 0.14))]
HIND_LEG = [Vector(p) for p in ((0.086, 0.232, 0.43), (0.09, 0.182, 0.315), (0.075, 0.245, 0.218),
                                (0.068, 0.2, 0.14))]
# the shoulder blade's and the hip bone's outlines (across, up from the joint)
SCAPULA = [(0.0, -0.01), (0.026, 0.03), (0.034, 0.09), (0.0, 0.11), (-0.03, 0.09), (-0.018, 0.03)]
ILIUM = [(0.0, -0.012), (0.03, 0.03), (0.036, 0.07), (0.0, 0.085), (-0.038, 0.06), (-0.02, 0.02)]
# the flames: along the neck's crest behind the skull (where, by the column's y; length, half width, the side it
# splays and sways to) and from the tail (where along the tail's last stretch, its angle above the horizontal
# behind, length, half width)
MANE = ((-0.188, 0.12, 0.024, 1), (-0.18, 0.155, 0.03, -1), (-0.172, 0.175, 0.034, 1), (-0.164, 0.18, 0.035, -1),
        (-0.156, 0.17, 0.034, 1), (-0.148, 0.15, 0.031, -1), (-0.14, 0.125, 0.027, 1), (-0.132, 0.095, 0.022, -1))
TAIL = ((0.0, 62.0, 0.1, 0.024), (0.2, 44.0, 0.12, 0.028), (0.4, 26.0, 0.13, 0.03), (0.6, 8.0, 0.125, 0.029),
        (0.8, -10.0, 0.11, 0.026), (1.0, -28.0, 0.09, 0.022))
# the tack: the breast strap's path round the chest, from one shoulder blade to the other; the small skull on it
# (centre, radius); the reins' path from each bit to the left fist (the left rein beside the neck, the right one over
# the withers)
STRAP = [Vector(p) for p in ((-0.105, -0.11, 0.44), (-0.085, -0.175, 0.415), (0.0, -0.198, 0.405),
                             (0.085, -0.175, 0.415), (0.105, -0.11, 0.44))]
CHEST_SKULL = (Vector((0.0, -0.222, 0.405)), 0.027)
REINS = {1: [Vector((0.05, -0.24, 0.585))], -1: [Vector((-0.05, -0.24, 0.6)), Vector((-0.02, -0.15, 0.645))]}


# ================================================================== the rider (the king's scale)
def build_rider_br():
    """The Paladin's rider (build_rider): his capelet, pauldrons, arms, gauntlets, tabard, head, helm and brows. His
    sword, the cross on his tabard, his cape and his helm's plume and wings make way for the pennant lance
    (build_lance_br), a cape cut into points (build_cape_br) and small bat wings and a longer comb on the helm
    (build_helm_br); his pauldrons turn steel, and his face undead (court.fangs joined into Face, court.undead_face)."""
    build_rider()
    for n in ('SwordGrip', 'SwordGuard', 'Blade', 'SwordGem', 'BladeGlow', 'TabardCross', 'Cape', 'Plume',
              'HelmWings'):
        drop(PFX + n)
    reslot(PFX + 'Pauldrons', 'trim', 'second')
    bm = new_bm()
    fangs(bm, bvh_of(O(PFX + 'Head')), FANG_Z)
    out(PFX + 'Fangs', bm, 0, sharp=80, recalc=False)
    join_into(PFX + 'Face', PFX + 'Fangs')
    undead_face(O(PFX + 'Face'))
    build_lance_br()
    build_cape_br()
    build_helm_br()


def pennant_pt(u, v):
    """A point of the pennant at u along it (0 at the shaft, 1 at its tails' tips) and v across it (0 its bottom
    edge, 1 its top): it narrows toward its tails and droops a little, ripples more the further it streams from the
    shaft, and its end is cut into two tails, the notch between them PENNANT['notch'] deep."""
    top, bot, L, d = PENNANT['top'], PENNANT['bottom'], PENNANT['len'], PENNANT['dir'].normalized()
    n = Vector((0.0, 0.0, 1.0)).cross(d)
    u *= 1 - PENNANT['notch'] * (1 - abs(2 * v - 1))
    h = (top - bot) * (1 - 0.4 * u)
    z = top - 0.12 * (top - bot) * u - h * (1 - v)
    wave = PENNANT['wave'] * math.sin(2 * math.pi * 1.1 * u + 0.4) * u
    return Vector((GRIP.x, GRIP.y, z)) + d * (L * u + LANCE['r']) + n * wave


def build_lance_br():
    """The pennant lance upright through the right fist (GRIP's axis): a leather shaft banded in metal, swelling a
    little above the fist and thinning toward the head; a metal spearhead (court.spike) on a socket, a barb raked down
    either side of its foot; and below the head the pennant (pennant_pt), accent edged in metal, its two tails
    streaming out and back."""
    M = Matrix.Translation((GRIP.x, GRIP.y, 0.0))
    b, h, r = LANCE['butt'], LANCE['head'], LANCE['r']

    def shaft_r(rr, z, a, j):
        """The shaft's radius rr at height z (lathe's rmod; a, j unused): as the fist holds it up to just above
        GRIP, then swelling over 6 cm to a fifth thicker and thinning from there to the head."""
        z0 = GRIP.z + 0.03
        if z <= z0:
            return rr
        if z <= z0 + 0.06:
            return rr * (1 + 0.2 * (z - z0) / 0.06)
        return rr * (1.2 - 0.4 * (z - z0 - 0.06) / (h - z0 - 0.06))
    bm = new_bm()
    zs = [b, GRIP.z - 0.06, GRIP.z + 0.03, GRIP.z + 0.06] + [GRIP.z + 0.09 + (h - GRIP.z - 0.09) * q / 8
                                                             for q in range(9)]
    lathe(bm, [(0.0, b)] + [(r, z) for z in zs] + [(0.0, h)], 14, 'leather', xform=M, rmod=shaft_r)
    for z0, dz in LANCE_BANDS:
        rr = shaft_r(r, z0 + dz / 2, 0, 0) + 0.0025
        lathe(bm, [(0.0, z0), (rr * 0.9, z0), (rr, z0 + dz * 0.3), (rr, z0 + dz * 0.7), (rr * 0.9, z0 + dz),
                   (0.0, z0 + dz)], 14, 'trim', xform=M)
    out(PFX + 'Lance', bm, MID, sharp=50)
    bm = new_bm()
    foot = Vector((GRIP.x, GRIP.y, h))
    spike(bm, Matrix.Translation(foot), LANCE['tip'] - h, 0.027, 0.013, waist=0.2)
    Y = Vector((0.0, 1.0, 0.0))
    for s in (-1, 1):                                  # a barb either side of the head's foot, raked down and out
        d = Vector((s * 0.6, 0.0, -0.8))
        spike(bm, basis(foot + Vector((s * 0.016, 0.0, 0.017)), Y.cross(d), Y, d), 0.045, 0.009, 0.0065)
    lathe(bm, [(0.0, h - 0.024), (r + 0.004, h - 0.024), (r + 0.0065, h - 0.012), (r + 0.004, h + 0.006),
               (0.0, h + 0.006)], 14, 'trim', xform=M)
    out(PFX + 'LanceHead', bm, MID, sharp=30)
    NU, NV = 18, 6

    def cloth(i, j):
        """The pennant's slot in cell (i, j), on both its faces: accent, the cells round its edges metal."""
        return 'trim' if i in (0, NU - 1) or j in (0, NV - 1) else 'accent'
    bm = new_bm()
    sheet(bm, lambda i, j: pennant_pt(i / NU, j / NV), NU, NV, 0.005, cloth, cloth, 'trim',
          outward=lambda p: Vector((0.0, 0.0, 1.0)).cross(PENNANT['dir']))
    out(PFX + 'Pennant', bm, MID, sharp=60)


def cape_br_P(u, v):
    """A point of the cape at u across it (0 at the left shoulder, round the back, 1 at the right) and v down it
    (0 at the shoulders, 1 at the hem): the Paladin's short cape, its hem cut into points (CAPE_POINTS, court.tatter)
    that hang CAPE_DEPTH below the notches at CAPE_CUT."""
    th = math.radians(-2 + 184 * u)
    zb = CAPE_CUT - CAPE_DEPTH * tatter(u, CAPE_POINTS)
    d = v * (0.665 - zb) / (0.665 - CAPE_CUT + CAPE_DEPTH)
    z = 0.665 - (0.665 - zb) * v
    r = 0.168 + 0.1 * d ** 0.85 + 0.012 * d ** 1.3 * math.cos(6 * (th - math.pi / 2))
    return Vector((r * math.cos(th), r * math.sin(th) * 0.95 + 0.16 * d * d, z + 0.04 * d * d))


def build_cape_br():
    """The cape (cape_br_P): coat outside, accent inside, a metal band along its edges and its pointed hem."""
    cols = tatter_cols(CAPE_POINTS, 30)
    NU, NV = len(cols) - 1, 14
    bm = new_bm()
    sheet(bm, lambda i, j: cape_br_P(cols[i], j / NV), NU, NV, 0.01,
          lambda i, j: 'trim' if j >= NV - 1 or i <= 1 or i >= NU - 2 else 'coat', 'accent', 'trim',
          outward=lambda p: Vector((p.x, p.y, 0.0)))
    out(PFX + 'Cape', bm, BIG, sharp=60)


def build_helm_br():
    """What the helm (the Warden's, without the Paladin's plume and wings) gains: small bat wings (court.bat_wing)
    where his gold wings were, rising up and back from each side, coat membranes on metal bones; and its metal comb
    carried on down the back, which his plume covered."""
    bm, bb = new_bm(), new_bm()
    for s in (-1, 1):
        X = Vector((s * 0.6, 1.0, 0.35)).normalized()  # back and splayed out, so the membrane shows from the front
        Z = Vector((0.0, -0.35, 1.0))
        Z = (Z - X * Z.dot(X)).normalized()
        bat_wing(bm, bb, basis(helm_pt(s * 96, 18, 0.006), X, Z.cross(X) * s, Z), 0.13, 0.14, thick=0.005, r=0.0048,
                 wrist=(0.25, 1.0), tips=((1.0, 0.7), (0.88, 0.25), (0.6, -0.08)), body=(0.12, -0.12), rib='trim')
    out(PFX + 'HelmWings', bm, MID, sharp=50)
    out(PFX + 'HelmWingBones', bb, SMALL, sharp=50)
    bm = new_bm()
    tube(bm, [helm_pt(180, el, 0.006) for el in (38, 20, 0, -20, -40)], 0.0085, 'trim', n=30, k=8)
    out(PFX + 'HelmCrest', bm, SMALL, sharp=40)


def build_lines_br():
    """The Paladin's linework (build_rider_lines: the pauldrons' lame rings, the fringe's strands, the helm's two
    rings), the helm's rings carried all the way round, where his plume no longer hides its back."""
    build_rider_lines()
    bm = new_bm()
    for el in (40, 60):
        P = [helm_pt(-180 + 360 * q / 144, el, 0.0072) for q in range(145)]
        strip(bm, P, [(p - HC).normalized() for p in P], [0.0013 * 1.5] * 145, 'lgold', 0.0004)
    out(PFX + 'LinesHelm', bm, 0, sharp=80, recalc=False)


# ================================================================== the skeletal horse (in place)
def skull_br_frame():
    """The horse skull's frame: its axis forward from SKULL_BACK to SKULL_TIP, up across it in the middle plane, x to
    the horse's left, and the axis's length."""
    F = SKULL_TIP - SKULL_BACK
    L = F.length
    F.normalize()
    X = Vector((1.0, 0.0, 0.0))
    return F, F.cross(X).normalized(), X, L


def skull_br_pt(u, a, dr=0.0):
    """A point on the horse skull at u along its axis (0 the back of the cranium, 1 the tip of the snout) and a round
    it (0 the left side, 90 the top; degrees), dr out from it across the axis: a round cranium and a long snout,
    squarer in section, ending in a blunt rounded nose (SKULL_PROF)."""
    F, U, X, L = skull_br_frame()
    w, h, c = (spline1([row[k] for row in SKULL_PROF], u) for k in range(3))
    cap = 1.0
    if u < 0.14:
        cap = math.sqrt(max(0.0, 1 - ((0.14 - u) / 0.14) ** 2))
    elif u > 0.86:
        cap = math.sqrt(max(0.0, 1 - ((u - 0.86) / 0.14) ** 2))
    p = 2.0 + 0.8 * min(1.0, max(0.0, (u - 0.4) / 0.3))       # the snout's section squarer than the cranium's
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    sx = math.copysign(abs(ca) ** (2 / p), ca)
    sz = math.copysign(abs(sa) ** (2 / p), sa)
    q = SKULL_BACK + F * (L * u) + X * (w * cap * sx) + U * (c + h * cap * sz)
    if dr:
        q += (X * sx * h + U * sz * w).normalized() * dr
    return q


def build_skull_br():
    """The horse's skull (skull_br_pt) in bone, and its decals, cast on the bare skull, the part HorseEyes that the
    pack locks: ink sockets with a glowing pupil and a glint in each, the mouth's ink line back along each side of the
    snout, two ink nostrils on the nose and white teeth with ink between them at its tip."""
    NR, NA = 26, 36
    us = [0.5 - 0.5 * math.cos(math.pi * j / NR) for j in range(NR + 1)]
    bm = new_bm()
    back, tip = bm.verts.new(skull_br_pt(0.0, 0.0)), bm.verts.new(skull_br_pt(1.0, 0.0))
    rows = [[bm.verts.new(skull_br_pt(u, 360 * i / NA)) for i in range(NA)] for u in us[1:-1]]
    for i in range(NA):
        i2 = (i + 1) % NA
        face(bm, [back, rows[0][i2], rows[0][i]], 'fur')
        face(bm, [tip, rows[-1][i], rows[-1][i2]], 'fur')
        for j in range(len(rows) - 1):
            face(bm, [rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]], 'fur')
    out(PFX + 'Skull', bm, BIG, sharp=70)
    sb = bvh_of(O(PFX + 'Skull'))
    F, U, X, L = skull_br_frame()
    bm = new_bm()
    for s in (-1, 1):
        t, l = math.radians(SOCKET['turn']), math.radians(SOCKET['lift'])
        n = (X * (s * math.cos(t)) + F * math.sin(t)) * math.cos(l) + U * math.sin(l)
        c = skull_br_pt(SOCKET['u'], 90 - s * 70)
        Uu = n.cross(U).normalized() * s              # across the socket, toward the nose on both sides
        Vv = Uu.cross(n).normalized() * s             # up
        frame = (c, Uu, Vv, -n)
        rx, rz = SOCKET['r']
        decal_poly(bm, sb, ellipse(0.0, 0.0, rx, rz, 32), frame, 0.0015, 'ink', rings=3)
        decal_poly(bm, sb, ellipse(0.003, -0.003, 0.0115, 0.013, 16), frame, 0.0026, 'glow', rings=2)
        decal_poly(bm, sb, ellipse(-0.0015, 0.004, 0.0042, 0.0046, 10), frame, 0.0034, 'white', rings=1)
    # the mouth's line back along each side of the snout, painted from that side
    for s in (-1, 1):
        side = (Vector((0.0, 0.0, 0.0)), Vector((0.0, -1.0, 0.0)), Vector((0.0, 0.0, 1.0)), Vector((-s, 0.0, 0.0)))
        line = [skull_br_pt(u, 90 - s * 125) for u in (0.95, 0.85, 0.74, 0.63, 0.55)]
        decal_band(bm, sb, [(-p.y, p.z) for p in line], [0.0026, 0.0024, 0.0021, 0.0016, 0.0008], side, 0.0015, 'ink',
                   n=16)
    # nose and teeth, painted from the front, back along the snout (lean: the pack locks every point of HorseEyes)
    nose = skull_br_pt(1.0, 0.0)
    frame = (nose, X, U, -F)
    for s in (-1, 1):
        decal_poly(bm, sb, ellipse(s * 0.015, 0.014, 0.0045, 0.011, 12, rot=s * 0.5), frame, 0.0015, 'ink', rings=2)
    hw, b0, b1 = 0.03, -0.034, -0.004
    decal_poly(bm, sb, round_rect(0.0, (b0 + b1) / 2, hw, (b1 - b0) / 2, 0.006, step=0.007), frame, 0.0015, 'ink',
               center=(0.0, (b0 + b1) / 2), rings=2)
    teeth = 4
    cw = 2 * (hw - 0.003) / teeth
    for z0, z1 in ((b0 + 0.016, b1 - 0.0015), (b0 + 0.0015, b0 + 0.0135)):
        for q in range(teeth):
            x0 = -hw + 0.003 + cw * q
            tooth = round_rect(x0 + cw / 2, (z0 + z1) / 2, cw / 2 - 0.0013, (z1 - z0) / 2, 0.0025, step=0.006,
                               corner=2)
            decal_poly(bm, sb, tooth, frame, 0.0024, 'white', center=(x0 + cw / 2, (z0 + z1) / 2), rings=1)
    out(PFX + 'HorseEyes', bm, 0, sharp=80, recalc=False)


def build_spine_br():
    """The vertebral column from the skull down the neck, along the back under the saddle and into a short tail: a
    bone rod with a bead for each vertebra, the neck's the biggest, and short spines up from the withers and the
    croup."""
    bm = new_bm()
    tube(bm, SPINE, 0.016, 'fur', n=60, k=8, radius=lambda t: 0.016 - 0.009 * t)
    C = catmull(SPINE, 60)
    for t, r in SPINE_BEADS:
        i = round(t * 60)
        tng = (C[min(i + 1, 60)] - C[max(i - 1, 0)]).normalized()
        ellipsoid(bm, C[i], (r, r * 0.72, r * 0.9), 'fur', segs=12, rings=8,
                  rot=Vector((0.0, 1.0, 0.0)).rotation_difference(tng).to_matrix())
    for t in SPINE_SPIKES:
        i = round(t * 60)
        tng = (C[min(i + 1, 60)] - C[max(i - 1, 0)]).normalized()
        up = (Vector((0.0, 0.0, 1.0)) - tng * tng.z).normalized()
        spike(bm, basis(C[i], Vector((1.0, 0.0, 0.0)), up.cross(Vector((1.0, 0.0, 0.0))), up + tng * 0.4), 0.03,
              0.008, 0.006, slot='fur')
    out(PFX + 'Spine', bm, MID, sharp=60)
    return C


def rib_pts(y, reach):
    """One rib's centreline on the horse's left (x > 0), from the spine at y round the side of the body to `reach`
    degrees below the side: the body's (BODY_C's ellipsoid) cross-section, a little inside it, the rib sweeping back
    by RIB_SWEEP as it falls."""
    k = math.sqrt(max(0.0, 1 - ((y - BODY_C.y) / 0.24) ** 2))
    rx, rz = 0.14 * k * 0.97, 0.13 * k * 0.95
    top = 0.515
    pts = []
    for q in range(9):
        a = math.radians(90 - (90 + reach) * q / 8)
        x = rx * math.cos(a)
        z = BODY_C.z + (top - BODY_C.z) * math.sin(a) if a > 0 else BODY_C.z + rz * math.sin(a)
        pts.append(Vector((max(x, 0.012), y + RIB_SWEEP * (q / 8) ** 1.3, z)))
    return pts


def build_ribs_br():
    """The rib cage: for each place in RIBS a pair of flat bone ribs from the spine round the body, the front ones
    meeting a breastbone along the belly, the last two short and floating; gaps between them show through."""
    bm = new_bm()
    for y, reach in RIBS:
        for s in (-1, 1):
            pts = [Vector((s * p.x, p.y, p.z)) for p in rib_pts(y, reach)]
            strand(bm, pts, 0.012, 0.0075, 'fur', lambda c: Vector((0.0, c.y, BODY_C.z)), n=16, k=8,
                   prof=lambda t: 1.0 - 0.25 * t)
    tube(bm, [Vector((0.0, -0.172, 0.335)), Vector((0.0, -0.1, 0.302)), Vector((0.0, 0.0, 0.282)),
              Vector((0.0, 0.07, 0.282))], 0.012, 'fur', n=16, k=8, radius=lambda t: 0.014 - 0.004 * t)
    out(PFX + 'Ribs', bm, MID, sharp=60)


def build_legs_br():
    """Bone legs where the Paladin's horse stood, down to his hooves (court.bone, knobbed at every joint), a shoulder
    blade over the front ribs and a hip bone either side of the croup."""
    bm = new_bm()
    for s in (-1, 1):
        for joints, radii in ((FORE_LEG, (0.017, 0.015, 0.013)), (HIND_LEG, (0.018, 0.015, 0.013))):
            J = [Vector((s * p.x, p.y, p.z)) for p in joints]
            for a, b, r in zip(J, J[1:], radii):
                bone(bm, a, b, r, 'fur', knob=1.45, k=8)
        # the shoulder blade, a flat plate from the shoulder joint up to the withers, and the hip bone, from the hip
        # joint up beside the croup: each lies flat against the body's side (slab: local y its thickness)
        for joint, top, plate in ((FORE_LEG[0], Vector((0.072, -0.12, 0.49)), SCAPULA),
                                  (HIND_LEG[0], Vector((0.045, 0.215, 0.505)), ILIUM)):
            a = Vector((s * joint.x, joint.y, joint.z))
            Zb = (Vector((s * top.x, top.y, top.z)) - a).normalized()
            Yb = Vector((s, 0.0, 0.0))
            Yb = (Yb - Zb * Yb.dot(Zb)).normalized()
            slab(bm, plate, basis(a, Yb.cross(Zb), Yb, Zb), 0.008, bevel=0.002, seg=1)
    set_slot(bm, bm.faces, 'fur')
    out(PFX + 'Legs', bm, MID, sharp=60)


def build_flames_br(C):
    """The ghost-flame mane and tail (court.flame) on the column C (build_spine_br's centreline, skull first): glow
    tongues rising from the neck's crest behind the skull, splayed to either side in turn, and fanned out behind from
    the tail's last stretch, their tips flicking up; no outline (width 0), so they glow clean."""
    Y = Vector((0.0, 1.0, 0.0))
    bm = new_bm()
    n = len(C) - 1
    for y, L, W, sw in MANE:                           # rising from the crest, splayed to either side in turn
        i = min(range(n // 3), key=lambda q: abs(C[q].y - y))      # on the neck, the column's first third
        up = Vector((sw * 0.45, 0.15, 1.0)).normalized()
        flame(bm, C[i] + Vector((sw * 0.008, 0.0, 0.012)), up, (Y - up * up.y).normalized() * sw, L, W,
              lean=Vector((sw * 0.3, 0.5, 0.8)))
    out(PFX + 'Mane', bm, 0, smooth=True, sharp=80)
    bm = new_bm()
    i0 = round(0.86 * n)                               # the tail: the column's last 14 per cent of samples
    for k, (t, ang, L, W) in enumerate(TAIL):          # fanned out behind, a little to either side in turn
        i = min(n, i0 + round(t * (n - i0)))
        a = math.radians(ang)
        up = Vector((0.35 * (-1) ** k, math.cos(a), math.sin(a))).normalized()
        side = Vector((0.0, -math.sin(a), math.cos(a)))
        flame(bm, C[i], up, (side - up * side.dot(up)).normalized(), L, W, lean=Vector((0.0, 0.3, 1.0)))
    out(PFX + 'Tail', bm, 0, smooth=True, sharp=80)


def build_tack_br():
    """A metal bridle round the skull (a noseband, a headpiece behind the sockets, a cheek strap between them), a
    ring at each corner of the mouth and the reins from them to the rider's left fist; a metal breast strap round the
    chest with a small skull (court.skull) on it, glowing pupils in its sockets."""
    bm = new_bm()
    for u in (0.72, 0.13):
        loop = [skull_br_pt(u, 360 * q / 32, 0.004) for q in range(33)]
        tube(bm, loop, 0.0045, 'trim', n=64, k=6)
    LF = rider_to_horse(Vector((0.062, -0.188, 0.565)))      # the left fist on the reins (the Paladin's build_rider)
    ring = [(0.012 + 0.0025 * math.cos(2 * math.pi * q / 6), 0.0025 * math.sin(2 * math.pi * q / 6)) for q in range(6)]
    for s in (-1, 1):
        a = 0.0 if s > 0 else 180.0
        tube(bm, [skull_br_pt(0.72, a, 0.004), skull_br_pt(0.42, a - s * 25, 0.004),
                  skull_br_pt(0.13, a - s * 10, 0.004)], 0.004, 'trim', n=16, k=6)
        bit = skull_br_pt(0.84, a - s * 40, 0.006)
        lathe(bm, ring, 16, 'trim', xform=Matrix.Translation(bit) @ axis_to((s, 0, 0)), wrap=True)
        tube(bm, [bit] + REINS[s] + [LF + Vector((s * 0.006, 0.0, 0.0))], 0.0042, 'trim', n=24, k=6)
    tube(bm, STRAP, 0.006, 'trim', n=40, k=8)
    out(PFX + 'Tack', bm, SMALL, sharp=45)
    bm, bf = new_bm(), new_bm()
    skull(bm, CHEST_SKULL[0], CHEST_SKULL[1], 'fur', face=bf, pupils='glow', segs=24, rings=18)
    out(PFX + 'ChestSkull', bm, SMALL, sharp=80)
    out(PFX + 'ChestSkullFace', bf, 0, sharp=80, recalc=False)


def build_horse_br():
    """The Paladin's horse (build_horse), of which the rider's legs in their stirrups, the saddle and the hooves
    stay (his hooves' fur fringe turned to metal); his horse's body, head, mane, legs, barding and tack make way for
    the skeleton: the skull, the column, the rib cage, bone legs, the ghost-flame mane and tail, and the tack."""
    build_horse()
    for n in ('Horse', 'Muzzle', 'Legs', 'Mane', 'Barding', 'BardCross', 'Tack', 'TackGems', 'Chamfron', 'HorseEyes'):
        drop(PFX + n)
    reslot(PFX + 'Hooves', 'white', 'trim')
    build_skull_br()
    C = build_spine_br()
    build_ribs_br()
    build_legs_br()
    build_flames_br(C)
    build_tack_br()


def build_n():
    """The Bone Rider: the base, the rider (posed, then shrunk onto the saddle as the Paladin's is), the skeletal
    horse, then the whole scaled to the knight's size."""
    build_base()
    before = {o.name for o in coll().objects}
    build_rider_br()
    build_lines_br()
    pose_head()
    move_rider([o.name for o in coll().objects if o.name not in before and o.type == 'MESH'])
    build_horse_br()
    scale_figure(SCALE)

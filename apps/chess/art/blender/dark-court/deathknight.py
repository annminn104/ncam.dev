# Death Knight (Rook). exec kit.py, holy-order/patriarch.py, holy-order/warden.py, court.py, then this file into one
# dict; call build_r(). Built at the king's scale on the Templar Warden's body (his ARMS, CAP_SLOT, arms, helm and
# shield frame carry over), then scaled down by SCALE about the base's top.
import math

from mathutils import Matrix, Vector

PFX = 'DK_'
COLL = 'DeathKnight'
# the head tilts toward the shield, away from the sword (the Warden's tilts the other way, -3); no cape_P reads the flare
POSE = {'head_roll': 3.0, 'head_pitch': -2.0, 'cape_flare': 0.0}
SCALE = 0.8
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'Helm', 'HelmBand', 'HelmGems', 'Horns', 'HelmSpikes', 'LinesHair',
                 'LinesHelm']
FANG_Z = 0.8622                                      # the Patriarch's mouth line at x = 0.006 either side (build_head)
# the cuirass over the chest, from behind the belt up under the capelet: a closed (r, z) profile
CUIRASS = [(0.163, 0.474), (0.176, 0.478), (0.178, 0.489), (0.171, 0.5), (0.168, 0.53), (0.17, 0.565), (0.168, 0.598),
           (0.157, 0.6), (0.156, 0.474)]
# the spikes along each top pauldron lame's crest: (where, from its apex as a fraction of the lame's opening, toward
# the back or, negative, the front; length; half width)
PAULDRON_SPIKES = ((-0.55, 0.08, 0.018), (0.0, 0.11, 0.022), (0.55, 0.08, 0.018))
# the tassets over the hips: (azimuth from the front, half width, both degrees; top, bottom at the middle)
TASSETS = ((42, 16, 0.448, 0.288), (70, 15, 0.44, 0.298))
# a horn on each side of the helm (court.horn): its root's azimuth and elevation on the helm, how far its first
# stretch rises above the horizontal and how far the way it curls (forward) is tipped up, in degrees
HELM_HORN = {'phi': 78.0, 'el': 30.0, 'rise': 40.0, 'lift': 15.0}
HELM_POINTS = (18.0, 8.0)                            # the points on the helm's rim: their width and depth, degrees
HELM_CREST = ((96, 0.075), (114, 0.068), (132, 0.058), (150, 0.045))   # spikes on the comb: (elevation, length)
# the cape hangs from CAPE_TOP; its tears reach up to CAPE_CUT and its longest strip hangs CAPE_RAG under that
CAPE_TOP, CAPE_CUT, CAPE_RAG = 0.665, 0.28, 0.15
CAPE_NV = 18
CAPE_EMBLEM = (0.43, 0.085, 0.042)                   # the emblem on the cape's back: its height, ring and skull radius
# the cape's torn hem (court.tatter): (u, hang) from its edge on the left shoulder (u 0) round the back to the right
CAPE_TATTERS = [(0.0, 0.35), (0.03, 0.6), (0.055, 0.75), (0.075, 0.55), (0.09, 0.05), (0.105, 0.7), (0.135, 0.95),
                (0.16, 0.7), (0.175, 0.25), (0.19, 0.55), (0.215, 0.68), (0.235, 0.5), (0.25, 0.0), (0.265, 0.75),
                (0.295, 1.0), (0.325, 0.72), (0.34, 0.15), (0.355, 0.5), (0.38, 0.62), (0.4, 0.45), (0.415, 0.08),
                (0.43, 0.7), (0.46, 0.9), (0.49, 0.65), (0.505, 0.2), (0.52, 0.75), (0.55, 0.98), (0.575, 0.7),
                (0.59, 0.02), (0.605, 0.55), (0.63, 0.7), (0.65, 0.5), (0.665, 0.3), (0.68, 0.6), (0.71, 0.85),
                (0.735, 0.6), (0.75, 0.1), (0.765, 0.72), (0.795, 0.92), (0.82, 0.65), (0.835, 0.18), (0.85, 0.5),
                (0.875, 0.66), (0.895, 0.48), (0.91, 0.05), (0.925, 0.6), (0.95, 0.78), (0.97, 0.6), (1.0, 0.4)]
# the tower shield, in the Warden's frame (SH_C, SH_R, UP, SH_N): half width, its foot's point, its top corners
# (heights), how much higher the foot's corners stand than its point, how much higher its top's middle than the corners
SHIELD = (0.175, 0.11, 0.8, 0.13, 0.035)
# the skull emblem: its centre (from SH_C along SH_R and UP), its ring's radius and its skull's (cranium) radius
EMBLEM = (0.0, 0.05, 0.116, 0.058)
# the sword: the grip's middle in the right fist (where the Warden holds his halberd), how far it leans out from the
# body and forward (degrees); the guard's height above the grip's middle (the grip runs long, so the guard clears the
# forearm) and its outline (x, z), one half from the middle out; the blade's foot above the grip's middle, its
# length, half width, teeth pitch and depth
SWORD = Vector((SX, SYY, 0.531))
SWORD_LEAN = (14.0, 8.0)
GUARD_Z = 0.11
GUARD = [(0.0, -0.009), (0.018, -0.011), (0.042, -0.006), (0.058, 0.012), (0.064, 0.03), (0.05, 0.012), (0.031, 0.004),
         (0.014, 0.009), (0.0, 0.012)]
BLADE = (0.12, 0.766, 0.034, 0.07, 0.016)


# ================================================================== body
def build_body_dk():
    """The Patriarch's robe as the Warden wears it (belt in leather, steel shoes), its lace in accent as the Court
    has it; a steel cuirass over the chest, tassets over the hips cut to a point, a buckle."""
    build_robe()
    reslot(PFX + 'Alb', 'white', 'accent')
    reslot(PFX + 'Sash', 'accent', 'leather')
    reslot(PFX + 'Shoes', 'accent', 'second')
    bm = new_bm()
    lathe(bm, CUIRASS, 72, lambda i, j: 'trim' if j <= 2 else 'second', sy=SY, wrap=True,     # a ridge down the front,
          rmod=lambda r, z, a, j: r + 0.008 * max(0.0, -math.sin(a)) ** 14 * min(1.0, max(0.0, (0.59 - z) / 0.03)))
    out(PFX + 'Cuirass', bm, MID, sharp=45)
    rb = bvh_of(O(PFX + 'Robe'))
    NU, NV = 10, 8
    bm, bg = new_bm(), new_bm()
    for s in (-1, 1):
        for az, half, z0, zb in TASSETS:
            def P(i, j, az=az, half=half, z0=z0, zb=zb, s=s):
                u = -1 + 2 * i / NU
                v = j / NV
                th = math.radians(-90 + s * (az + half * u))
                z = z0 + (zb + 0.03 * abs(u) - z0) * v
                hit = ray_in(rb, th, z)
                return hit + Vector((hit.x, hit.y, 0)).normalized() * (0.007 + 0.026 * v ** 1.5)
            sheet(bm, P, NU, NV, 0.006, lambda i, j: 'trim' if j >= NV - 1 or i in (0, NU - 1) else 'second', 'second',
                  'trim', outward=lambda p: Vector((p.x, p.y, 0)))
            top = P(NU // 2, 1.2)
            n = Vector((top.x, top.y, 0)).normalized()
            gem_cut(bg, Matrix.Translation(top + n * 0.007) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'),
                    0.009, 0.012, 0.014, 0.007)
    out(PFX + 'Tassets', bm, MID, sharp=40)
    out(PFX + 'TassetGems', bg, SMALL, smooth=False)
    BKL = Vector((0.0, -0.9 * 0.177 - 0.006, 0.455))
    bm = new_bm()
    slab(bm, [(-0.026, -0.022), (0.026, -0.022), (0.034, 0.0), (0.026, 0.022), (-0.026, 0.022), (-0.034, 0.0)],
         Matrix.Translation(BKL), 0.009, bevel=0.0022, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'Buckle', bm, SMALL, sharp=30)
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(BKL + Vector((0, -0.006, 0))), 0.011, 0.015, 0.015, 0.008)
    out(PFX + 'BuckleGem', bm, SMALL, smooth=False)


def build_pauldrons_dk():
    """The Patriarch's three-lame pauldrons (pauldron_frames, dome) as steel plates, their rims metal and cut into
    points; three metal spikes (court.spike, PAULDRON_SPIKES) along each top lame's crest, pointing out from the
    shoulder."""
    bm, bi, bs = new_bm(), new_bm(), new_bm()
    for s, k, A, C0, R, alpha in pauldron_frames():
        M = Matrix.Translation(C0) @ axis_to(A)
        lathe(bm, dome(R, alpha), 36, lambda i, j: 'trim' if 6 <= j <= 9 else 'second', xform=M, wrap=True,
              rmod=lambda r, z, a, j: r + (0.008 * (1 - abs((7 * a / (2 * math.pi)) % 1 * 2 - 1)) if j in (7, 8, 9)
                                           else 0.0))
        a2, a3 = math.radians(alpha * 0.72), math.radians(alpha * 0.86)     # the Patriarch's inlay ring
        ring = [((R + dr) * math.sin(a), (R + dr) * math.cos(a)) for dr, a in ((0.0012, a2), (0.0012, a3), (-0.002, a3),
                                                                             (-0.002, a2))]
        lathe(bi, ring, 36, 'accent', xform=M, wrap=True)
        if k == 0:
            Y = Vector((0, 1, 0))                    # A has no y, so the crest runs front (-y) to back (+y) over it
            for th, L, W in PAULDRON_SPIKES:
                t = math.radians(alpha) * th
                d = A * math.cos(t) + Y * math.sin(t)
                aim = (d + Vector((s, 0, 0)) * 0.9).normalized()     # out from the shoulder, clear of the helm
                w = Y * math.cos(t) - A * math.sin(t)                # along the crest: the blade's width
                w = (w - aim * w.dot(aim)).normalized()
                spike(bs, basis(C0 + d * (R - 0.004), w, aim.cross(w), aim), L, W, 0.01, waist=0.12)
    out(PFX + 'Pauldrons', bm, MID, sharp=35)
    out(PFX + 'PauldronInlay', bi, SMALL, sharp=35)
    out(PFX + 'PauldronSpikes', bs, MID, sharp=30)


# ================================================================== the tattered cape
def cape_dk_P(u, v):
    """A point of the cape at u across it (0 on the left shoulder, round the back, 1 on the right) and v down it
    (0 at the shoulders, 1 at the torn hem): the Warden's cape, long and flaring wide enough to clear the robe, its
    hem cut along CAPE_TATTERS (court.tatter); every strip lies on the one cloth, whatever its length."""
    th = math.radians(-6 + 192 * u)
    zb = CAPE_CUT - CAPE_RAG * tatter(u, CAPE_TATTERS)
    z = CAPE_TOP - (CAPE_TOP - zb) * v
    d = (CAPE_TOP - z) / (CAPE_TOP - CAPE_CUT + CAPE_RAG)
    r = 0.168 + 0.17 * d ** 0.85 + 0.016 * d ** 1.3 * math.cos(6 * (th - math.pi / 2))
    return Vector((r * math.cos(th) + 0.012 * d * d, r * math.sin(th) * 0.95 + 0.035 * d * d, z + 0.01 * d * d))


def build_cape_dk():
    """The tattered cape (cape_dk_P): coat outside, accent inside and along its torn edges, both faces shaded and
    outlined, the emblem (skull_emblem) on its back; the Warden's neck guard."""
    cols = tatter_cols(CAPE_TATTERS, 40)
    bm = new_bm()
    sheet(bm, lambda i, j: cape_dk_P(cols[i], j / CAPE_NV), len(cols) - 1, CAPE_NV, 0.01, 'coat', 'accent', 'accent',
          outward=lambda p: Vector((p.x, p.y, 0)))
    out(PFX + 'Cape', bm, BIG, sharp=60)
    bm, bk = new_bm(), new_bm()
    skull_emblem(bm, bk, bvh_of(O(PFX + 'Cape')), BACK, 0.0, CAPE_EMBLEM[0], CAPE_EMBLEM[1], CAPE_EMBLEM[2], off=0.0024)
    out(PFX + 'CapeEmblem', bm, 0, sharp=80, recalc=False)
    out(PFX + 'CapeSkull', bk, 0, sharp=80, recalc=False)
    bm = new_bm()
    lathe(bm, [(0.06, 0.73), (0.088, 0.735), (0.1, 0.752), (0.094, 0.79), (0.07, 0.8), (0.055, 0.78)], 48, 'second',
          sy=SY, wrap=True)
    lathe(bm, [(0.1, 0.748), (0.106, 0.752), (0.104, 0.762), (0.098, 0.762)], 48, 'trim', sy=SY, wrap=True)
    out(PFX + 'NeckGuard', bm, MID, sharp=45)


# ================================================================== the tower shield
def tower_pt(u, v, lift=0.0):
    """A point on the tower shield's front at u (-1..1 across) and v (0 at its foot, 1 at its top), lift off it, in
    the Warden's shield frame: straight sides, the foot drawn down to a point, the top arched, bulging forward
    across its width as his does."""
    w, zb, zt, foot, arch = SHIELD
    zbot = zb + foot * abs(u) ** 1.3
    ztop = zt + arch * (1 - u * u)
    z = zbot + (ztop - zbot) * v
    return SH_C + SH_R * (u * w) + UP * (z - SH_C.z) + SH_N * (0.032 * (1 - u * u) + lift)


def skull_outline(cx, cz, k, step=0.003):
    """The shield's skull in outline, (x, z) around (cx, cz), k its cranium's radius: a round cranium, cheekbones,
    the jaw drawn in under them to a small chin; points every step along it for a decal."""
    half = [(0.0, 1.0), (0.42, 0.92), (0.76, 0.68), (0.95, 0.32), (0.96, -0.02), (0.86, -0.3), (0.7, -0.42),
            (0.64, -0.66), (0.5, -0.9), (0.26, -1.02), (0.0, -1.04)]
    loop = half + [(-x, z) for x, z in reversed(half[1:-1])]
    pts = catmull_closed([(cx + x * k, cz + z * k) for x, z in loop], 4 * len(loop))[:-1]
    return edge_pts([(p.x, p.y) for p in pts], step)


def skull_emblem(bm, bk, bvh, frame, cx, cz, rr, k, off=0.003):
    """The death knight's emblem painted on bvh from frame, round (cx, cz): into bm (metal) a ring of radius rr and a
    crown of three blades over the skull; into bk the skull (skull_outline, cranium radius k) in white with ink
    sockets, nose and teeth. off: how far the ring stands off the surface; the skull stands a little further, its
    features further still."""
    ring = [(cx + rr * math.cos(2 * math.pi * q / 48), cz + rr * math.sin(2 * math.pi * q / 48)) for q in range(49)]
    decal_band(bm, bvh, ring, [0.06 * rr] * 49, frame, off, 'trim', n=144)
    z0 = cz + 1.04 * k
    for x, tip, w in ((0.0, 0.62, 0.21), (0.45, 0.41, 0.16), (-0.45, 0.41, 0.16)):
        blade = [(cx + (x - w) * k, z0), (cx + (x + w) * k, z0), (cx + x * k, z0 + tip * k)]
        decal_poly(bm, bvh, edge_pts(blade, 0.003), frame, off + 0.0006, 'trim',
                   center=(cx + x * k, z0 + 0.3 * tip * k), rings=2)
    sx, sz = cx, cz - 0.1 * k
    decal_poly(bk, bvh, skull_outline(sx, sz, k), frame, off + 0.0006, 'white', center=(sx, sz), rings=4)
    for s in (-1, 1):
        decal_poly(bk, bvh, socket_poly(sx + s * 0.4 * k, sz - 0.1 * k, 0.29 * k, 0.27 * k, s, n=28), frame,
                   off + 0.0016, 'ink', center=(sx + s * 0.4 * k, sz - 0.11 * k), rings=3)
    decal_poly(bk, bvh, nose_poly(sx, sz - 0.48 * k, 0.24 * k, 0.22 * k, n=20), frame, off + 0.0016, 'ink',
               center=(sx, sz - 0.49 * k), rings=2)
    decal_band(bk, bvh, [(sx - 0.36 * k, sz - 0.76 * k), (sx, sz - 0.79 * k), (sx + 0.36 * k, sz - 0.76 * k)],
               [0.021 * k, 0.028 * k, 0.021 * k], frame, off + 0.0016, 'ink', n=16)
    for x in (-0.24, 0.0, 0.24):
        decal_band(bk, bvh, [(sx + x * k, sz - 0.64 * k), (sx + x * k, sz - 0.9 * k)], [0.019 * k, 0.016 * k], frame,
                   off + 0.0016, 'ink', n=4)


def build_shield_dk():
    """The tower shield on the left arm: coat, a metal rim and an accent border, its back in second; on its front the
    emblem (skull_emblem) on a blade that runs from the top to the foot, all decals, and rivets round the rim."""
    NU, NV = 20, 24

    def outer(i, j):
        if i <= 1 or i >= NU - 2 or j <= 1 or j >= NV - 2:
            return 'trim'
        if i == 2 or i == NU - 3 or j == 2 or j == NV - 3:
            return 'accent'
        return 'coat'
    bm = new_bm()
    sheet(bm, lambda i, j: tower_pt(-1 + 2 * i / NU, j / NV), NU, NV, 0.012, outer, 'second', 'trim',
          outward=lambda p: SH_N)
    out(PFX + 'Shield', bm, BIG, sharp=40)
    sb = bvh_of(O(PFX + 'Shield'))
    frame = (SH_C, SH_R, UP, -SH_N)
    ex, ez, rr, k = EMBLEM
    bm, bk = new_bm(), new_bm()
    skull_emblem(bm, bk, sb, frame, ex, ez, rr, k)
    for z0, z1, w in ((ez + rr + 0.004, 0.262, 0.013), (ez - rr - 0.004, -0.262, 0.018)):    # the blade, up and down
        decal_poly(bm, sb, edge_pts([(ex - w, z0), (ex + w, z0), (ex, z1)], 0.004), frame, 0.0034, 'trim',
                   center=(ex, z0 + (z1 - z0) * 0.3), rings=3)
    out(PFX + 'ShieldEmblem', bm, 0, sharp=80, recalc=False)
    out(PFX + 'ShieldSkull', bk, 0, sharp=80, recalc=False)
    bm = new_bm()
    rivets = [(s * 0.9, v) for s in (-1, 1) for v in (0.12, 0.26, 0.4, 0.54, 0.68, 0.82, 0.93)]
    rivets += [(u, v) for u in (-0.6, -0.3, 0.0, 0.3, 0.6) for v in (0.042, 0.958)]
    for u, v in rivets:
        ellipsoid(bm, tower_pt(u, v, 0.004), (0.0052,) * 3, 'trim', segs=8, rings=6)
    out(PFX + 'ShieldRivets', bm, MID, sharp=45)


# ================================================================== the serrated sword
def sword_frame():
    """The sword's frame: origin at the grip's middle in the right fist, z up the blade (leaning out and forward by
    SWORD_LEAN), x across its face, which looks to the front."""
    lean_out, lean_fwd = (math.radians(a) for a in SWORD_LEAN)
    return Matrix.Translation(SWORD) @ Matrix.Rotation(-lean_out, 4, 'Y') @ Matrix.Rotation(lean_fwd, 4, 'X')


def blade_outline():
    """The blade's outline in the sword's frame (x, z): a narrow ricasso over the guard, then each edge cut into saw
    teeth raked toward the tip, the blade narrowing to a plain point."""
    z0, L, hw, pitch, depth = BLADE

    def width(z):
        return hw * (1 - 0.3 * (z - z0) / L)
    right = [(0.011, z0), (0.011, z0 + 0.045), (width(z0 + 0.07), z0 + 0.07)]
    z = z0 + 0.09
    while z + pitch < z0 + L - 0.15:
        right += [(width(z) - depth, z), (width(z + 0.85 * pitch), z + 0.85 * pitch)]
        z += pitch
    right += [(width(z) - 0.5 * depth, z), (0.95 * width(z), z + 0.04), (0.0, z0 + L)]
    return right + [(-x, zz) for x, zz in reversed(right[:-1])]


def build_sword():
    """The serrated sword in the right fist: its blade in second with a metal ridge down its middle, a metal guard
    (GUARD) whose quillons curve up to points, a gem either side of it, a long leather grip and a metal pommel."""
    M = sword_frame()
    bm = new_bm()
    slab(bm, blade_outline(), M, 0.007, bevel=0.0012, seg=1)
    set_slot(bm, bm.faces, 'second')
    out(PFX + 'Blade', bm, MID, sharp=30)
    z0, L = BLADE[:2]
    bm = new_bm()                                    # a metal ridge down the blade's middle, proud of both its faces
    ridge = [(0.0, z0 + 0.03), (0.0045, z0 + 0.1), (0.0045, z0 + 0.7 * L), (0.0, z0 + 0.82 * L)]
    slab(bm, ridge + [(-x, z) for x, z in reversed(ridge[1:-1])], M, 0.0086, bevel=0.0006, seg=1)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'BladeRidge', bm, SMALL, sharp=30)
    bm = new_bm()
    slab(bm, GUARD + [(-x, z) for x, z in reversed(GUARD[1:-1])], M @ Matrix.Translation((0, 0, GUARD_Z)), 0.016,
         bevel=0.0018, seg=2)
    set_slot(bm, bm.faces, 'trim')
    out(PFX + 'Guard', bm, MID, sharp=30)
    bm = new_bm()
    for side in (-1, 1):
        gem_cut(bm, M @ Matrix.Translation((0, side * 0.0085, GUARD_Z + 0.002)) @
                Matrix.Rotation(0.0 if side < 0 else math.pi, 4, 'Z'), 0.008, 0.01, 0.01, 0.004)
    out(PFX + 'GuardGems', bm, SMALL, smooth=False)
    bm = new_bm()
    lathe(bm, [(0.0, -0.075), (0.012, -0.075), (0.017, -0.066), (0.016, -0.055), (0.0095, -0.048), (0.0095, GUARD_Z),
               (0.0, GUARD_Z)], 16, lambda i, j: 'trim' if j <= 3 else 'leather', xform=M)
    out(PFX + 'Grip', bm, SMALL, sharp=50)


# ================================================================== face and helm
def build_face_dk():
    """The Patriarch's chibi face (build_head) made undead: glowing irises and two small fangs under the mouth
    (court.undead_fangs), joined into the Face part so the pack's lock keeps them."""
    build_head()
    undead_fangs(FANG_Z)


def helm_edge(phi):
    """The helm's lower edge (elevation, degrees) at azimuth phi, which warden.build_helm reads: the Warden's open
    face, its sides cut a little closer round the face, and its rim round the sides and back cut into points."""
    a = abs(phi)
    if a < 44:
        return 30.0
    if a < 52:
        u = (a - 44) / 8
        return 30 - 72 * (u * u * (3 - 2 * u))
    point = 1 - abs((a - 52) / HELM_POINTS[0] % 1 * 2 - 1)
    return -42 - 10 * min(1.0, (a - 52) / 90) - HELM_POINTS[1] * point


def helm_horn_frame(s):
    """A horn's root on the helm's side (HELM_HORN; s = +1 for the left horn, on +x, -1 for the right), a little
    inside the shell, in basis() terms: z out from the head and up (its first stretch), y forward and a little up (it
    curls that way), x up and in (it bends that way)."""
    root = helm_pt(s * HELM_HORN['phi'], HELM_HORN['el'], -0.004)
    o = Vector((root.x, root.y, 0)).normalized()
    e, f = math.radians(HELM_HORN['rise']), math.radians(HELM_HORN['lift'])
    Z = o * math.cos(e) + Vector((0, 0, math.sin(e)))
    F = Vector((0, -math.cos(f), math.sin(f)))
    Y = (F - Z * F.dot(Z)).normalized()
    return basis(root, Y.cross(Z) * s, Y, Z)


def crest_pt(el):
    """A point on the line of the Warden's comb over the helm (HelmBand's ridge) at elevation el, measured from the
    front over the top (90) to the back (180)."""
    return helm_pt(0, el, 0.006) if el <= 90 else helm_pt(180, 180 - el, 0.006)


def build_helm_dk():
    """The Warden's open helm (build_helm, with helm_edge above) without his crest plume and wings: a horn curving
    forward from each side (court.horn), bone on a metal band, and metal spikes raked back along the comb."""
    build_helm()
    for n in ('Plume', 'HelmWings'):
        drop(PFX + n)
    bm = new_bm()
    for s in (-1, 1):
        horn(bm, helm_horn_frame(s), 0.034, 0.14, 0.11, turns=0.33, lean=0.2, splay=0.2, drift=0.0, tip=0.25,
             ridges=6, rings=(0.05,), slot='fur', n=56)
    out(PFX + 'Horns', bm, MID, sharp=60)
    bm = new_bm()
    for el, L in HELM_CREST:
        root = crest_pt(el)
        t = (crest_pt(el + 1) - crest_pt(el - 1)).normalized()
        z = ((root - HC).normalized() + t * 0.6).normalized()
        x = (t - z * t.dot(z)).normalized()
        spike(bm, basis(root, x, z.cross(x), z), L, 0.02, 0.006, waist=0.1)
    out(PFX + 'HelmSpikes', bm, MID, sharp=30)


# ================================================================== drawn lines
def build_lines_dk():
    """The painted linework: engravings on the metal, the cape's and skirt's folds, hair strands, the helm's lines."""
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    # ---- engravings: the pauldrons' lames, the robe's hem band
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
    pts = [p for p in (ray_in(rb, 2 * math.pi * q / 240, 0.147 + 0.011 * math.sin(26 * 2 * math.pi * q / 240))
                       for q in range(241)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    # ---- cloth folds: the skirt's, the cape's down to just above its torn hem
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lmain', n=30)
    capeb = bvh_of(O(PFX + 'Cape'))
    for u0 in (0.1, 0.235, 0.355, 0.645, 0.765, 0.9):      # clear of the emblem on the back
        ctrl = []
        for q, v in enumerate((0.25, 0.45, 0.65, 0.85)):
            p = cape_dk_P(u0 + 0.004 * q, v * 0.97)
            ctrl.append(p + Vector((p.x, p.y, 0)).normalized() * 0.01)
        line3d(bm, capeb, ctrl, 0.0024, 'lcoat', n=30)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)
    # ---- hair strands (posed with the head)
    bm = new_bm()
    for phi, tip, w in BANGS:
        F = strand_frames(bang_pts(phi, tip + 6), HC, 12)
        P, N = [], []
        for i in range(1, 11):
            c, t, sd, nr = F[i]
            P.append(c + nr * 0.009 * bang_prof(i / 12))
            N.append(nr)
        strip(bm, P, N, widths(len(P), 0.0013, 'both'), 'lhair', 0.0011)
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    # ---- the helm's engraving and its plates' lines (posed with the head)
    bm = new_bm()
    hb = bvh_of(O(PFX + 'Helm'))
    for el in (40, 60):                                 # all the way round: no plume hides the helm's back
        P = [helm_pt(-180 + 360 * q / 144, el, 0.0072) for q in range(145)]
        strip(bm, P, [(p - HC).normalized() for p in P], [0.0013 * K] * 145, 'lgold', 0.0004)
    for ph in (-120, -70, 70, 120):
        line3d(bm, hb, [helm_pt(ph, el, 0.006) for el in (70, 40, 10, -20)], 0.0016, 'lmain', n=20)
    out(PFX + 'LinesHelm', bm, 0, sharp=80, recalc=False)


def build_r():
    """The Death Knight: the Warden's body in a steel cuirass and tassets under spiked pauldrons and a tattered cape,
    a tower shield with a skull emblem on the left arm, a serrated sword in the right fist and the Warden's open helm,
    horned, over an undead face; the head tilted toward the shield (POSE), then the whole scaled by SCALE, as the
    Warden is."""
    build_base()
    build_body_dk()
    build_mantle()
    build_arms_r()
    build_pauldrons_dk()
    build_cape_dk()
    build_shield_dk()
    build_sword()
    build_face_dk()
    build_helm_dk()
    build_brows_r()
    build_lines_dk()
    pose_head()
    scale_figure(SCALE)

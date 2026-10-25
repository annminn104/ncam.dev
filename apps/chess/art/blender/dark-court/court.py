# The Dark Overlord Court's set-wide pieces: its preview palettes (the game's palette lives in
# src/battle/scene/presets/dark-court/palette.ts, a copy of these) and the shape helpers its
# figures share. Runs after kit.py and holy-order/patriarch.py, in the same namespace.
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

DC_W = {'skin': '#efe7e6', 'hair': '#dcd6ea', 'eyes': '#a77bff', 'main': '#e9e4d6', 'second': '#b9c0cc',
        'trim': '#c4cad6', 'accent': '#5b3d8f', 'ink': '#241f2e', 'glow': '#b58cff', 'white': '#ffffff',
        'blush': '#e3a6c4', 'coat': '#3a2c52', 'gem': '#9b5cff', 'leather': '#4a3a46', 'fur': '#e9e4d6',
        'iris2': '#d6c2ff', 'lgold': '#5c6270', 'lmain': '#a9a294', 'lcoat': '#1c1428', 'lhair': '#9d97b3',
        'lskin': '#cdb8c0', 'glove': '#e9e4d6'}
DC_B = {'skin': '#e4dde0', 'hair': '#e8e6ee', 'eyes': '#ff3355', 'main': '#121016', 'second': '#2a1f26',
        'trim': '#d4a64a', 'accent': '#b3122e', 'ink': '#0a0809', 'glow': '#ff3b4f', 'white': '#ffffff',
        'blush': '#e09aa8', 'coat': '#5a0f1f', 'gem': '#ff2a4a', 'leather': '#2e2224', 'fur': '#9a8f82',
        'iris2': '#ff9aa8', 'lgold': '#4a2a0b', 'lmain': '#3a3036', 'lcoat': '#2a0610', 'lhair': '#a8a3b3',
        'lskin': '#c4b4b8', 'glove': '#1c181c'}
# The sheet's colours and metals per side (export.py --sheet): silver on white, gold on black.
PREVIEW = {'w': (DC_W, SILVER_STOPS), 'b': (DC_B, GOLD_STOPS)}
PAL_W = DC_W  # finalize() colours each part from PAL_W as it is built


def reslot(name, src, dst):
    """Moves a built part's faces from slot src to dst: a borrowed Holy Order builder's colour made
    the Court's (the point attribute _SLOT is what the game and the sheets read)."""
    me = bpy.data.objects[name].data
    a = me.attributes['_SLOT']
    vals = [0.0] * len(me.vertices)
    a.data.foreach_get('value', vals)
    si, di = float(SLOTS.index(src)), float(SLOTS.index(dst))
    a.data.foreach_set('value', [di if abs(v - si) < 0.1 else v for v in vals])
    me.update()


def spline1(vals, u):
    """A Catmull-Rom curve through vals, spaced evenly over u = 0..1: a smooth profile (an edge's
    height, a radius) from a few numbers."""
    n = len(vals) - 1
    t = min(max(u, 0.0), 1.0) * n
    i = min(int(t), n - 1)
    f = t - i
    p0, p1, p2, p3 = vals[max(i - 1, 0)], vals[i], vals[i + 1], vals[min(i + 2, n)]
    return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f ** 3)


def edge_pts(poly, step):
    """The closed outline poly [(x, z)] with points added along its edges, none longer than step: a
    decal across a curved surface follows it only where it has points (the queen's apron lesson)."""
    pts = []
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        k = max(1, int(math.ceil(math.hypot(x1 - x0, z1 - z0) / step)))
        pts += [(x0 + (x1 - x0) * q / k, z0 + (z1 - z0) * q / k) for q in range(k)]
    return pts


def round_rect(cx, cz, hw, hh, r, step=0.004, corner=4):
    """A rounded rectangle's outline, with points every step along its straight edges."""
    pts = []
    for qx, qz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        c = (cx + qx * (hw - r), cz + qz * (hh - r))
        pts += [(c[0] + r * math.cos(math.radians(a0 + 90 * q / corner)),
                 c[1] + r * math.sin(math.radians(a0 + 90 * q / corner))) for q in range(corner + 1)]
    return edge_pts(pts, step)


def star_poly(cx, cz, w, h, pinch=0.24):
    """A four-pointed star's outline (points up, down and to the sides, h and w long), with points
    along its edges for a decal."""
    pts = []
    for q in range(8):
        a = math.pi / 2 + math.pi * q / 4
        r = (h if q % 4 == 0 else w) if q % 2 == 0 else pinch * min(w, h) * 1.414
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return edge_pts(pts, 0.004)


def basis(o, x, y, z):
    """The 4x4 frame with origin o and axes x, y, z (normalized), to stand a slab, a gem or a blade on a
    surface: gem_cut and spike face local -y."""
    M = Matrix.Identity(4)
    for c, v in enumerate((x, y, z)):
        M.col[c] = (*Vector(v).normalized(), 0.0)
    M.col[3] = (*Vector(o), 1.0)
    return M


def scroll_pts(cx, cz, s, size, turns=1.3, n=16, start=100.0):
    """A spiral flourish winding in to (cx, cz), s = +1 or -1 for its hand: the path of an embroidered
    or painted scroll (decal_band, line3d)."""
    pts = []
    for k in range(n + 1):
        t = k / n
        r = size * (1 - 0.82 * t)
        th = math.radians(start) - turns * 2 * math.pi * t
        pts.append((cx + s * r * math.cos(th), cz + r * math.sin(th)))
    return pts


# ---------------------------------------------------------------- bones
def bone(bm, a, b, r, slot='skin', knob=1.5, k=8):
    """A small bone from a to b: a shaft of radius r with a round knob of knob * r at each end (a
    skeletal hand's metacarpals, the two bones of a forearm, ribs)."""
    a, b = Vector(a), Vector(b)
    tube(bm, [a, b], r, slot, n=3, k=k)
    for p in (a, b):
        ellipsoid(bm, p, (r * knob,) * 3, slot, segs=k, rings=6)


def finger(bm, pts, r, slot='skin', knuckle=0.45, tip=0.8, k=6):
    """A bony finger through its joints pts, knuckle first: one tube that swells into a knuckle at
    every joint and thins a little toward the end, closed by a round tip of tip * r."""
    segs = len(pts) - 1

    def rad(t):
        d = abs(t * segs - round(t * segs))       # 0 at a joint, 0.5 halfway along a bone
        return r * (1 + knuckle * max(0.0, 1 - d / 0.3) ** 2) * (1 - 0.2 * t)
    tube(bm, pts, r, slot, n=6 * segs, k=k, radius=rad)
    ellipsoid(bm, pts[-1], (r * tip,) * 3, slot, segs=k, rings=5)


# ---------------------------------------------------------------- the skull
def skull_deform(p, C=None, R=None):
    """Sphere point (radius R about C) -> the Court's round chibi skull: the Patriarch's head
    (deform) moved to C and scaled to R, with cheekbones, a brow over each socket, flatter temples,
    the jaw drawn in under the cheekbones and the row of teeth standing a little forward. At C = HC,
    R = HR it is the Overlord's head; a lantern's skull is the same shape at its own size."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    d = (p - C).normalized()
    s = deform(HC + d * HR) - HC

    def bump(phi, el, width):
        return math.exp(-(math.degrees(d.angle(dirv(phi, el))) / width) ** 2)
    dr = 0.008 * bump(0, -40, 22)
    for sx in (-1, 1):
        dr += 0.016 * bump(sx * 62, -12, 17) + 0.006 * bump(sx * 25, 12, 14) + 0.005 * bump(sx * 24, -62, 16)
        dr -= 0.008 * bump(sx * 95, 15, 28) + 0.022 * bump(sx * 72, -46, 24)
    s += s.normalized() * dr
    return C + s * (R / HR)


def skull_mesh(bm, C=None, R=None, slot='skin', segs=48, rings=32):
    """The skull's closed mesh (the cranium and the upper jaw), a uv sphere through skull_deform."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    ret = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=R)
    for v in ret['verts']:
        v.co = skull_deform(v.co + C, C, R)
    set_slot(bm, {f for v in ret['verts'] for f in v.link_faces}, slot)


def skull_pt(phi, el, dr=0.0, C=None, R=None):
    """A point on the skull at (phi, el) as surf() names them on the Patriarch's head, dr out from it."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    p = skull_deform(C + dirv(phi, el) * R, C, R)
    return p + (p - C).normalized() * dr


def skull_el(phi, z, C=None, R=None):
    """The elevation at azimuth phi where the skull's lower half is at height z."""
    lo, hi = -89.0, 0.0
    for _ in range(24):
        mid = 0.5 * (lo + hi)
        if skull_pt(phi, mid, 0.0, C, R).z < z:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


JAW_MOUTH = 0.84  # where the jaw meets the skull in front, at the Overlord's size: the upper teeth stand above it


def jaw_pt(phi, v, C=None, R=None, half=42.0):
    """A point on the outer face of skull_jaw's jaw at azimuth phi (from -half to half), from its top edge
    (v = 0) to its bottom edge under the chin (v = 1). The top edge lies over the skull's line at
    height JAW_MOUTH along the mouth and curves down from each corner of it; the jaw stands 6.5 mm
    proud of the skull, so in front that edge runs about 4 mm under JAW_MOUTH. The lower teeth hang
    from it."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    k = R / HR
    a = abs(phi)
    el_b = -80 + 14 * (a / half) ** 2
    el_m = skull_el(phi, C.z + (JAW_MOUTH - HC.z) * k, C, R)
    t = min(1.0, max(0.0, (a - 21) / (half - 21)))
    el_t = el_m + (el_b + 1.5 - el_m) * t * t * (3 - 2 * t)
    return skull_pt(phi, el_t + (el_b - el_t) * v, (0.0065 - 0.002 * t) * k, C, R)


def skull_jaw(bm, C=None, R=None, slot='skin', rim='lskin', nu=24, nv=8, half=42.0):
    """The skull's small lower jaw: a U-shaped shell standing proud of skull_mesh round the chin, flat
    along the mouth under the upper teeth, its edge curving down from each corner of the mouth to
    meet the jaw line under the cheek (a corner that rose would read as a grin). Its rim is a shade
    darker than the bone. Its outer face is jaw_pt's."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    k = R / HR
    sheet(bm, lambda i, j: jaw_pt(-half + 2 * half * i / nu, j / nv, C, R, half), nu, nv, 0.012 * k, slot, slot, rim,
          outward=lambda p: p - C)


def socket_poly(cx, cz, rx, rz, s, slant=0.32, n=36):
    """An eye socket's outline: a rounded, slightly square oval whose top falls toward the nose (s = +1
    for the socket on +x), so the skull frowns a little."""
    pts = []
    for q in range(n):
        a = 2 * math.pi * q / n
        c, sn = math.cos(a), math.sin(a)
        x = rx * math.copysign(abs(c) ** 0.8, c)
        z = rz * math.copysign(abs(sn) ** 0.85, sn)
        if z > 0:
            inner = 0.5 - 0.5 * s * x / rx       # 0 at the outer edge, 1 at the inner one
            z *= 1 - slant * inner
        pts.append((cx + x, cz + z))
    return pts


def nose_poly(cx, cz, w, h, n=28):
    """The nasal cavity's outline: an upside-down heart, its point up between the sockets."""
    pts = []
    for q in range(n):
        t = 2 * math.pi * q / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x / 32 * w, cz - (y + 2.5) / 30 * h))
    return pts


def skull_face(bm, bvh, C=None, R=None, frame=None, teeth=6):
    """Paints the face on bvh (the bare skull_mesh and skull_jaw): deep ink sockets with a glowing
    pupil and a glint in each, an ink nasal cavity, and white teeth with ink between them, the upper
    row on the skull above the jaw's rim, the lower on the jaw under its top edge as built (jaw_pt).
    Laid out for the Overlord's head and moved to C and R, for a skull that faces -y as the figures
    do (frame FR)."""
    C = HC if C is None else Vector(C)
    R = HR if R is None else R
    k = R / HR
    frame = frame or FR

    def m(pts):
        return [(C.x + x * k, C.z + (z - HC.z) * k) for x, z in pts]

    def mc(x, z):
        return C.x + x * k, C.z + (z - HC.z) * k
    for s in (-1, 1):
        ex = s * 0.082
        decal_poly(bm, bvh, m(socket_poly(ex, 0.95, 0.052, 0.05, s)), frame, 0.0015 * k, 'ink', center=mc(ex, 0.948),
                   rings=4)
        decal_poly(bm, bvh, m(ellipse(ex + s * 0.004, 0.94, 0.0175, 0.0205, 24)), frame, 0.0028 * k, 'glow', rings=2)
        decal_poly(bm, bvh, m(ellipse(ex - 0.006, 0.948, 0.0055, 0.0062, 12)), frame, 0.0038 * k, 'white', rings=1)
    decal_poly(bm, bvh, m(nose_poly(0.0, 0.888, 0.036, 0.032)), frame, 0.0015 * k, 'ink', center=mc(0, 0.887), rings=3)
    hw = 0.054
    cw = 2 * (hw - 0.004) / teeth
    lip = jaw_pt(0.0, 0.0).z  # the jaw's top edge in front, flat along the mouth: the lower row stays under it
    for row, (b0, b1) in enumerate(((JAW_MOUTH + 0.0055, JAW_MOUTH + 0.0255), (lip - 0.025, lip - 0.0015))):
        decal_poly(bm, bvh, m(round_rect(0, (b0 + b1) / 2, hw, (b1 - b0) / 2, 0.007)), frame, 0.0015 * k, 'ink',
                   center=mc(0, (b0 + b1) / 2), rings=3)
        for q in range(teeth):
            x0 = -hw + 0.004 + cw * q
            edge = abs(q - (teeth - 1) / 2) / ((teeth - 1) / 2)
            z0, z1 = b0 + 0.0016, b1 - 0.0018
            if row == 0:
                z0 += 0.003 * edge
            else:
                z1 -= 0.003 * edge
            tooth = round_rect(x0 + cw / 2, (z0 + z1) / 2, cw / 2 - 0.0016, (z1 - z0) / 2, 0.003, step=0.003, corner=2)
            decal_poly(bm, bvh, m(tooth), frame, 0.0026 * k, 'white', center=mc(x0 + cw / 2, (z0 + z1) / 2), rings=2)


# ---------------------------------------------------------------- blades and claws
def spike(bm, M, L, W, T, slot='trim', n=8, curve=0.0, waist=0.0):
    """A tapered blade with a diamond section standing on M's origin: tip at local z = L, its width
    W along x and thickness T along y, both narrowing to the point; curve bends it toward local -y
    over its length, waist pinches it just above the foot (crown points, a sword's edge, horns)."""
    rings = []
    for q in range(n + 1):
        u = q / n
        w = W * (1 - u) ** 0.9 * (1 - waist * math.exp(-((u - 0.12) / 0.08) ** 2))
        t = T * (1 - u) ** 0.8
        c = Vector((0.0, -curve * L * u * u, L * u))
        if q == n:
            rings.append([bm.verts.new(M @ c)])
            break
        rings.append([bm.verts.new(M @ (c + Vector(o))) for o in ((w, 0, 0), (0, -t, 0), (-w, 0, 0), (0, t, 0))])
    for q in range(n - 1):
        A, B = rings[q], rings[q + 1]
        for e in range(4):
            face(bm, [A[e], A[(e + 1) % 4], B[(e + 1) % 4], B[e]], slot)
    for e in range(4):
        face(bm, [rings[n - 1][e], rings[n - 1][(e + 1) % 4], rings[n][0]], slot)
    face(bm, rings[0][::-1], slot)


def talon(bm, pts, r, slot='trim', k=8, n=28):
    """A curved claw along pts, root first: a tube tapering to a sharp point, with two knuckle rings
    (a staff's grip on its orb, a bone hand's nails)."""
    def rad(t):
        ring = 0.22 * (math.exp(-((t - 0.3) / 0.04) ** 2) + math.exp(-((t - 0.58) / 0.04) ** 2))
        return r * ((1 - t) ** 0.75 * 0.92 + 0.08 * (1 - t)) * (1 + ring)
    tube(bm, pts, r, slot, n=n, k=k, radius=rad)


# ---------------------------------------------------------------- the chibi face, undead
def undead_face(ob):
    """Holy Order's chibi face made undead: its irises (slot 'eyes') turn to 'glow', unlit in the
    side's glow colour, while the highlights ('white') and the lower iris ('iris2') stay lit."""
    eyes, glow = SLOTS.index('eyes'), SLOTS.index('glow')
    for d in ob.data.attributes['_SLOT'].data:
        if int(round(d.value)) == eyes:
            d.value = float(glow)
    ob.data.update()


# ---------------------------------------------------------------- horns and wings
def horn(bm, M, r, rise, curl, turns=0.85, lean=0.25, splay=0.1, drift=0.03, tip=0.35, ridges=6,
         rings=(0.04, 0.2), slot='second', ring_slot='trim', n=48, k=10):
    """A curled ram's horn into bm, in slot, from M's origin (the root, a little inside the head), laid
    out in M's frame (basis(): local x the side it grows toward, y back, z up). It rises `rise` along z,
    bending back by lean x rise and out by splay x rise, then curls on back over the top and down
    round an axis along x for `turns` turns, the curl's radius shrinking from `curl` to tip x curl
    (slowly at first, then faster) while it drifts `drift` out along x, clear of the head. Its
    section is round: radius r at the root narrowing to a point, swelling in `ridges` low ridges
    across it like a ram's. A band in ring_slot circles it at each fraction of its length in
    `rings` (0 = root, 1 = tip). n, k: the tube's segments along and round it. Returns its
    centreline in world space, root first."""
    pts = [Vector((splay * rise * t * t, lean * rise * t * t, rise * t)) for t in (q / 10 for q in range(10))]
    top = Vector((splay * rise, lean * rise, rise))
    beta = math.atan2(2 * lean, 1.0)          # the curl starts along the stem's last direction
    span = turns * 2 * math.pi
    for q in range(49):
        f = q / 48
        a = span * f
        R = curl * (1 - (1 - tip) * f ** 1.5)
        yy, zz = curl - R * math.cos(a), R * math.sin(a)
        pts.append(top + Vector((drift * f, yy * math.cos(beta) + zz * math.sin(beta),
                                 -yy * math.sin(beta) + zz * math.cos(beta))))
    path = [M @ p for p in pts]
    dense = catmull(path, 240)
    step = sum((b - a).length for a, b in zip(dense, dense[1:])) / n
    C = resample(path, step)                  # even steps, so the ridges and the taper follow its length
    if (C[-1] - dense[-1]).length > 0.3 * step:
        C.append(dense[-1])
    else:
        C[-1] = dense[-1]
    N = len(C) - 1

    def rad(t):
        return r * max(0.06, (1 - t) ** 1.1) * (1 + 0.13 * math.sin(math.pi * ridges * t) ** 4)
    tube(bm, C, r, slot, n=N, k=k, radius=rad)
    for t in rings:
        i = max(1, min(N - 1, round(t * N)))
        rr = rad(i / N) + 0.0012
        band = [(rr + 0.0026 * math.cos(2 * math.pi * q / 8), 0.0042 * math.sin(2 * math.pi * q / 8)) for q in range(8)]
        lathe(bm, band, 20, ring_slot, xform=Matrix.Translation(C[i]) @ axis_to(C[i + 1] - C[i - 1]), wrap=True)
    return C


def bat_wing(membrane, bones, M, span, height, thick=0.006, r=0.0055, scallop=0.3, cup=0.012, nu=5, nv=5,
             wrist=(0.45, 1.0), tips=((1.0, 0.5), (0.82, -0.12), (0.5, -0.46)), body=(0.08, -0.3),
             slot='coat', rib='second'):
    """One small bat wing in M's frame (local x out along the span, z up; the membrane lies in the xz
    plane, its outer face toward -y). The arm rises from the root (M's origin) to the wrist, the
    wing's peak, at wrist (fractions of span and height); the fingers fan from the wrist to the tips
    (fractions of span and height, outermost first); the membrane spans them and its body edge, from
    the last tip to the body point and up to the root. Its trailing edge dips by scallop x the gap
    between two tips, and it billows `cup` toward +y between the bones. The membrane is a slab `thick`
    thick in `slot` on both faces, so it shades and outlines like a cape (into bmesh membrane); the
    bones, in `rib` (into bmesh bones), are tubes of radius r tapering to the finger tips, with a knob
    and a small claw at the wrist. nu, nv: the membrane's grid per gap and along a bone."""
    X, Y = (M.to_3x3() @ Vector((1, 0, 0))).normalized(), (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    W = Vector((wrist[0] * span, 0.0, wrist[1] * height))
    edge = [Vector((x * span, 0.0, z * height)) for x, z in tips] + [Vector((body[0] * span, 0.0, body[1] * height)),
                                                                   Vector((0.0, 0.0, 0.0))]
    ang = [math.atan2((p - W).z, (p - W).x) for p in edge]
    dist = [(p - W).length for p in edge]
    gaps = len(edge) - 1
    r0 = 1.25 * r                               # the membrane starts under the wrist's knob

    def P(i, j):
        g = min(i // nu, gaps - 1)
        f = i / nu - g
        a = ang[g] + (ang[g + 1] - ang[g]) * f
        re = dist[g] + (dist[g + 1] - dist[g]) * f
        if g < gaps - 1:                        # the trailing edge between two tips; the body edge is straight
            re -= scallop * (edge[g] - edge[g + 1]).length * math.sin(math.pi * f)
        rho = r0 + (re - r0) * j / nv
        return M @ Vector((W.x + rho * math.cos(a), cup * math.sin(math.pi * f) * j / nv, W.z + rho * math.sin(a)))
    sheet(membrane, P, nu * gaps, nv, thick, slot, slot, slot, outward=lambda p: -Y)
    mid = Vector((0.0, thick / 2, 0.0))         # the bones run through the slab's middle
    tube(bones, [M @ (edge[-1] - Vector((0.01 * span, 0, 0)) + mid), M @ (W * 0.5 + mid), M @ (W + mid)], r, rib,
         n=10, k=8, radius=lambda t: r * (1.12 - 0.12 * t))
    for p in edge[:-2]:
        tube(bones, [M @ (W + mid), M @ (W + (p - W) * 0.55 + mid), M @ (W + (p - W) * 1.05 + mid)], r, rib,
             n=10, k=6, radius=lambda t: r * (0.82 - 0.62 * t))
    c = M @ (W + mid)
    ellipsoid(bones, c, (1.6 * r,) * 3, rib, segs=10, rings=6)
    up = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
    talon(bones, [c, c + up * 0.012 + X * 0.003, c + up * 0.022 - X * 0.002], 0.8 * r, slot=rib, n=10, k=6)


# ---------------------------------------------------------------- fangs
def fangs(bm, bvh, z, x=0.006, frame=None):
    """Two small fangs under a chibi mouth, as the Fallen Queen has them: x either side of the middle,
    each a white triangle on a slightly larger ink one (a white fang alone vanishes on the pale skin),
    their tops at height z (the mouth line there) and their points 7 mm under it at the king's scale.
    Painted into bm on bvh (the bare head) from frame (FR, the front, if None). Join their part into
    the Face part (join_into), so the pack's lock keeps them: undead_fangs does all of that."""
    frame = frame or FR
    for s in (-1, 1):
        cx = s * x
        decal_poly(bm, bvh, [(cx - 0.0035, z + 0.0008), (cx + 0.0035, z + 0.0008), (cx + s * 0.0006, z - 0.0071)],
                   frame, 0.0019, 'ink', rings=1)
        decal_poly(bm, bvh, [(cx - 0.0026, z + 0.0006), (cx + 0.0026, z + 0.0006), (cx + s * 0.0005, z - 0.0058)],
                   frame, 0.0024, 'white', rings=1)


def join_into(dst, src):
    """Joins part src into part dst (dst keeps its name)."""
    a, b = O(dst), O(src)
    with bpy.context.temp_override(active_object=a, selected_editable_objects=[a, b]):
        bpy.ops.object.join()


def undead_fangs(z):
    """Makes a piece's chibi face undead once its head and face are built, as every Court face but the Overlord's
    skull is: the two fangs (fangs) painted on its bare head (the part PFX + 'Head'), their tops at height z (the
    piece's FANG_Z: its mouth line at x = 0.006 either side), sent out as the part PFX + 'Fangs' and joined into PFX +
    'Face' (join_into), so the pack's lock keeps them; then the face's irises glow (undead_face). PFX is the calling
    piece's own, read from the namespace the scripts share."""
    bm = new_bm()
    fangs(bm, bvh_of(O(PFX + 'Head')), z)
    out(PFX + 'Fangs', bm, 0, sharp=80, recalc=False)
    join_into(PFX + 'Face', PFX + 'Fangs')
    undead_face(O(PFX + 'Face'))


# ---------------------------------------------------------------- tattered hems
def tatter(u, pts):
    """How far a tattered hem hangs at u (0..1 across it), read off its outline pts: (u, hang) pairs in
    order of u from 0 to 1, straight between them; hang 0 is the top of the deepest tear, 1 the end of
    the longest strip. A sheet's hem row lies at its cut line minus its depth times this."""
    u = min(max(u, pts[0][0]), pts[-1][0])
    for (u0, h0), (u1, h1) in zip(pts, pts[1:]):
        if u <= u1:
            return h0 + (h1 - h0) * (u - u0) / max(u1 - u0, 1e-9)
    return pts[-1][1]


def tatter_cols(pts, n, gap=0.006):
    """The columns (u, 0..1) of a sheet whose hem follows the tattered outline pts (see tatter): n even
    steps and every point of the outline, so each tear and each strip's end lands on a column; an even
    step closer than gap to an outline point is left out."""
    keys = [u for u, _ in pts]
    return sorted(keys + [k / n for k in range(n + 1) if min(abs(k / n - q) for q in keys) >= gap])


# ---------------------------------------------------------------- small skulls
def point_in_poly(x, z, poly):
    """Whether the point (x, z) lies inside the closed outline poly [(x, z)] (even-odd rule)."""
    inside = False
    for (x0, z0), (x1, z1) in zip(poly, poly[-1:] + poly[:-1]):
        if (z0 > z) != (z1 > z) and x < x0 + (x1 - x0) * (z - z0) / (z1 - z0):
            inside = not inside
    return inside


def ray_to_poly(cx, cz, dx, dz, poly):
    """Where the ray from (cx, cz) along (dx, dz) first meets the closed outline poly [(x, z)] around it; the ray's
    own end (cx + dx, cz + dz) if it meets none."""
    best = None
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        ex, ez = x1 - x0, z1 - z0
        den = dx * ez - dz * ex
        if abs(den) < 1e-12:
            continue
        t = ((x0 - cx) * ez - (z0 - cz) * ex) / den
        s = ((x0 - cx) * dz - (z0 - cz) * dx) / den
        if t > 0 and 0 <= s <= 1 and (best is None or t < best):
            best = t
    t = 1.0 if best is None else best
    return cx + dx * t, cz + dz * t


def skull_open_sockets(bm, faces, bvh, frame, sockets):
    """Cuts skull()'s sockets through its bone, in bm: of faces (the skull's), those in front whose middle falls inside
    a socket's outline go, then each vertex left on a hole's edge moves along the line from its socket's centre onto
    the outline, back on the bone (bvh, the uncut skull), so each hole takes the socket's shape. frame: (centre, x,
    up, the way into the face) as decal_poly reads it; sockets: ((cx, cz), outline) pairs in that frame's x and up."""
    c, U, V, D = frame

    def local(p):
        """p in frame: its x, its up and how far behind the centre it lies."""
        q = p - c
        return q.dot(U), q.dot(V), q.dot(D)
    cut = []
    for f in faces:
        x, z, y = local(f.calc_center_median())
        if y < 0 and any(point_in_poly(x, z, poly) for _, poly in sockets):
            cut.append(f)
    verts = {v for f in faces for v in f.verts}
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    for v in verts:
        if not v.is_valid or not any(len(e.link_faces) == 1 for e in v.link_edges):
            continue
        x, z, _ = local(v.co)
        (cx, cz), poly = min(sockets, key=lambda sk: (x - sk[0][0]) ** 2 + (z - sk[0][1]) ** 2)
        tx, tz = ray_to_poly(cx, cz, x - cx, z - cz, poly)
        hit, _, _, _ = bvh.ray_cast(c + U * tx + V * tz - D, D)
        if hit is not None:
            v.co = hit


def skull(bm, c, r, slot='skin', face=None, pupils=None, hollow=False, rot=None, segs=32, rings=24, teeth=4):
    """A small round skull of radius r centred at c (a lantern, a pendant): the Overlord's skull (skull_deform) at that
    size without its lower jaw, built into bm in slot and turned by rot (a 3x3 matrix; None faces -y, as the figures
    do). face: a bmesh for a part at width 0 (decals draw no outline), into which go its decals, laid out as
    skull_face lays out the Overlord's: ink sockets (in each a pupil in slot pupils and a white glint, when pupils
    names a slot), an ink nasal cavity and one row of `teeth` white teeth with ink between them; without face the
    skull is bare bone, for the caller's own decals on the BVH returned. hollow: the sockets are cut through the bone
    instead of painted (skull_open_sockets), each ringed in ink, for a glow core inside to show through them. segs,
    rings: the uv sphere's resolution; a hollow skull wants about 40 x 30, so that each hole has points enough round
    it. Returns the BVH of the bone before any cut, for more decals."""
    c = Vector(c)
    k = r / HR
    R3 = rot if rot is not None else Matrix.Identity(3)
    frame = (c, R3 @ Vector((1, 0, 0)), R3 @ Vector((0, 0, 1)), R3 @ Vector((0, 1, 0)))
    verts = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)['verts']
    for v in verts:
        v.co = c + R3 @ (skull_deform(c + v.co, c, r) - c)
    faces = list({f for v in verts for f in v.link_faces})
    set_slot(bm, faces, slot)
    index = {v: q for q, v in enumerate(verts)}
    bvh = BVHTree.FromPolygons([v.co.copy() for v in verts], [[index[v] for v in f.verts] for f in faces])

    def m(x, z):
        """A point (x, z) of the Overlord's head, as skull_face names it, in this skull's frame."""
        return x * k, (z - HC.z) * k
    sockets = []
    for s in (-1, 1):
        cx, cz = m(s * 0.082, 0.95)
        sockets.append(((cx, cz), socket_poly(cx, cz, 0.052 * k, 0.05 * k, s)))
    if hollow:
        skull_open_sockets(bm, faces, bvh, frame, sockets)
    if face is None:
        return bvh
    off = 0.0006 + 0.0012 * k
    for _, poly in sockets if hollow else []:        # a dark rim round each open socket, over its cut edge
        decal_band(face, bvh, poly + poly[:2], [0.006 * k] * (len(poly) + 2), frame, off, 'ink', n=4 * len(poly))
    for s, (_, poly) in zip((-1, 1), [] if hollow else sockets):
        decal_poly(face, bvh, poly, frame, off, 'ink', center=m(s * 0.082, 0.948), rings=3)
        if pupils:
            px, pz = m(s * 0.086, 0.94)
            decal_poly(face, bvh, ellipse(px, pz, 0.0175 * k, 0.0205 * k, 20), frame, off + 0.0005, pupils, rings=2)
            gx, gz = m(s * 0.082 - 0.006, 0.948)
            decal_poly(face, bvh, ellipse(gx, gz, 0.0055 * k, 0.0062 * k, 12), frame, off + 0.001, 'white', rings=1)
    nx, nz = m(0.0, 0.888)
    decal_poly(face, bvh, nose_poly(nx, nz, 0.036 * k, 0.032 * k), frame, off, 'ink', center=m(0.0, 0.887), rings=3)
    hw, b0, b1 = 0.054, JAW_MOUTH + 0.0055, JAW_MOUTH + 0.0255      # skull_face's upper row
    cw = 2 * (hw - 0.004) / teeth
    decal_poly(face, bvh, [m(x, z) for x, z in round_rect(0, (b0 + b1) / 2, hw, (b1 - b0) / 2, 0.007)], frame, off,
               'ink', center=m(0, (b0 + b1) / 2), rings=3)
    for q in range(teeth):
        x0 = -hw + 0.004 + cw * q
        z0 = b0 + 0.0016 + 0.003 * abs(q - (teeth - 1) / 2) / max(0.5, (teeth - 1) / 2)    # the outer teeth shorter
        z1 = b1 - 0.0018
        tooth = round_rect(x0 + cw / 2, (z0 + z1) / 2, cw / 2 - 0.0016, (z1 - z0) / 2, 0.003, step=0.003, corner=2)
        decal_poly(face, bvh, [m(x, z) for x, z in tooth], frame, off + 0.0006, 'white',
                   center=m(x0 + cw / 2, (z0 + z1) / 2), rings=2)
    return bvh


# ---------------------------------------------------------------- ghost flames
def flame_prof(t):
    """A flame tongue's width at t along it (0 at its root, 1 at its tip), as a fraction of its widest: round at the
    root, widest a quarter of the way up, then narrowing to a long sharp point."""
    # 0.6695: the numerator's peak (0.6694 at t = 13/48, rounded up), so the profile peaks at 1
    return (1 - t) ** 1.4 * (0.5 + 2.0 * t) / 0.6695


def flame(bm, root, up, side, L, W, slot='glow', thick=0.5, sway=0.12, flick=0.3, lean=None, n=14, k=8):
    """One ghost-flame tongue (a horse's mane or tail, a torch) into bm in slot, from root (set a little inside what
    burns) along up for L: its spine sways in an S across it, first toward side then the other way, by sway x L, and
    its tip flicks toward lean (side when None) by flick x L. Its section is a lens reaching W either side of the
    spine along side and thick x W either side across that, swelling from the root to its widest a quarter of the
    way up (flame_prof), then narrowing to a sharp point. up and side are directions at right angles (they need not
    be unit length). Flames draw no outline: the caller sends their part out at width 0, so they glow clean. n, k:
    the strand's rings along it and points round it. Returns the spine's control points, root first."""
    up, side = Vector(up).normalized(), Vector(side).normalized()
    lean = side if lean is None else Vector(lean).normalized()
    deep = up.cross(side).normalized()
    pts = [Vector(root) + up * (L * t) + side * (sway * L * math.sin(2 * math.pi * t) * (1 - 0.3 * t)) +
           lean * (flick * L * t ** 3) for t in (q / 6 for q in range(7))]
    strand(bm, pts, W, thick * W, slot, lambda c: c - deep, n=n, k=k, prof=flame_prof)
    return pts

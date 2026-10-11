# Acolyte (Pawn). exec kit.py, patriarch.py, abbess.py, then this file into one dict; call build_p().
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PFX = 'A_'
COLL = 'Acolyte'
POSE = {'head_roll': -7.0, 'head_pitch': 6.0, 'cape_flare': 0.0}
SCALE = 0.7
RV = 0.262
CAP_SLOT = ['coat'] * 5 + ['accent', 'coat', 'trim', 'trim', 'trim'] + ['second'] * 5 + ['coat']
ARMS = {'R': ((-0.12, 0.0, 0.675), (-0.056, -0.165, 0.572)), 'L': ((0.12, 0.0, 0.675), (0.056, -0.165, 0.572))}
SLEEVE = [(0.0, -0.05), (0.044, -0.05), (0.047, 0.25), (0.052, 0.55), (0.056, 0.70), (0.058, 0.735), (0.061, 0.85),
          (0.064, 1.0), (0.06, 1.03), (0.051, 1.02), (0.044, 0.85), (0.0, 0.85)]
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'HairLocks', 'Hood', 'HoodBand', 'HoodGem', 'HoodEmblem', 'LinesHair',
                 'LinesHood']
CANDLE = Vector((0.0, -0.205, 0.585))
ROBE = [(0.0, 0.122), (0.286, 0.122), (0.293, 0.134), (0.289, 0.152), (0.281, 0.172), (0.268, 0.19), (0.236, 0.26),
        (0.203, 0.35), (0.170, 0.44), (0.160, 0.50), (0.163, 0.58), (0.160, 0.645), (0.146, 0.69), (0.112, 0.722),
        (0.07, 0.742), (0.0, 0.748)]


def robe_r(r, z, a, j):
    if z < 0.42:
        r += 0.013 * (0.42 - z) / 0.34 * math.cos(8 * a + 0.4)
    return r


def veil_edge(phi):
    a = abs(phi)
    if a < 44:
        return 36.0
    if a < 70:
        u = (a - 44) / 26
        return 36 - 74 * (u * u * (3 - 2 * u))
    return -40 - 22 * min(1.0, (a - 70) / 60)


def build_candle_hands():
    bm = new_bm()
    for s in (-1, 1):
        c = CANDLE + Vector((s * 0.033, 0.004, -0.004))
        tube(bm, [Vector((s * 0.052, -0.168, 0.574)), Vector((s * 0.045, -0.185, 0.578)), c + Vector((s * 0.008, 0.006, 0.0))],
             0.016, 'glove', n=8, k=10)
        ellipsoid(bm, c, (0.019, 0.024, 0.02), 'glove', segs=14, rings=10)
        ellipsoid(bm, c + Vector((-s * 0.012, -0.012, 0.014)), (0.008, 0.009, 0.011), 'glove', segs=8, rings=6)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)
    M = Matrix.Translation(CANDLE)
    bm = new_bm()
    lathe(bm, [(0.0, -0.012), (0.018, -0.012), (0.032, -0.004), (0.036, 0.004), (0.03, 0.008), (0.014, 0.01),
               (0.013, 0.02), (0.0, 0.021)], 24, 'trim', xform=M)
    ring = [(0.009 + 0.0025 * math.cos(2 * math.pi * q / 6), 0.0025 * math.sin(2 * math.pi * q / 6)) for q in range(6)]
    lathe(bm, ring, 12, 'trim', xform=Matrix.Translation(CANDLE + Vector((0.042, 0, 0.0))) @ axis_to((0, 1, 0)), wrap=True)
    out(PFX + 'Holder', bm, SMALL, sharp=45)
    bm = new_bm()
    lathe(bm, [(0.0, 0.02), (0.0125, 0.02), (0.0125, 0.118), (0.008, 0.124), (0.0, 0.125)], 16, 'white', xform=M,
          rmod=lambda r, z, a, j: r + (0.003 * max(0.0, math.cos(5 * a)) if j == 2 else 0.0))
    ellipsoid(bm, CANDLE + Vector((0.011, -0.004, 0.105)), (0.0045, 0.0045, 0.009), 'white', segs=8, rings=6)
    out(PFX + 'Candle', bm, SMALL, sharp=50)
    bm = new_bm()
    lathe(bm, [(0.0, 0.124), (0.0125, 0.134), (0.0135, 0.148), (0.008, 0.165), (0.0, 0.182)], 14, 'glow', xform=M)
    for k, (dx, dz, r) in enumerate(((-0.03, 0.17, 0.005), (0.032, 0.15, 0.0045), (0.02, 0.2, 0.004))):
        crystal(bm, CANDLE + Vector((dx, -0.004, dz)), r, r * 1.7, r * 1.7, n=4, slot='glow', twist=0.4 * k)
    out(PFX + 'Flame', bm, 0, smooth=False)
    bm = new_bm()
    ring = [(0.032 + 0.0018 * math.cos(2 * math.pi * q / 6), 0.0018 * math.sin(2 * math.pi * q / 6)) for q in range(6)]
    lathe(bm, ring, 40, 'glow', xform=Matrix.Translation(CANDLE + Vector((0, 0.004, 0.152))) @ axis_to((0, -1, 0)),
          wrap=True)
    out(PFX + 'FlameHalo', bm, 0, sharp=60)


def build_hood():
    bm = new_bm()
    for phi, tip, w in BANGS:
        strand(bm, bang_pts(phi, tip + 5), w, 0.009, 'hair', HC, n=12, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        strand(bm, [surf(s * 58, 24, 0.006, RH), surf(s * 64, -6, 0.016, RH), surf(s * 61, -30, 0.026, RH),
                    surf(s * 54, -46, 0.03, RH)], 0.036, 0.011, 'hair', HC, n=14, k=10, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)
    cols, rows = 96, 12
    tipc = dirv(180, 40)
    bm = new_bm()
    grid = []
    for i in range(cols):
        phi = -180 + 360 * i / cols
        e = veil_edge(phi)
        col = []
        for j in range(rows + 1):
            el = 88 + (e - 88) * j / rows
            p = veil_pt(phi, el)
            d = math.degrees(dirv(phi, el).angle(tipc))
            k = math.exp(-(d / 21) ** 2)
            p = p + Vector((0, 0.11, 0.07)) * k
            col.append(bm.verts.new(p))
        grid.append(col)
    for i in range(cols):
        i2 = (i + 1) % cols
        for j in range(rows):
            face(bm, [grid[i][j], grid[i][j + 1], grid[i2][j + 1], grid[i2][j]], 'main')
    crown = bm.verts.new(veil_pt(0, 90))
    for i in range(cols):
        face(bm, [grid[(i + 1) % cols][0], crown, grid[i][0]], 'main')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.009)
    lay = bm.faces.layers.int['slot']
    for f in bm.faces:
        c = f.calc_center_median()
        d = f.normal.dot((c - HC).normalized())
        front = abs(math.degrees(math.atan2(c.x, -c.y))) < 100
        f[lay] = SLOTS.index(('trim' if front else 'main') if abs(d) < 0.5 else ('main' if d > 0 else 'accent'))
    out(PFX + 'Hood', bm, BIG, sharp=60)
    bm = new_bm()
    sheet(bm, lambda i, j: veil_pt(-62 + 124 * i / 44, 31.5 + 4.5 * j / 2, 0.006), 44, 2, 0.004, 'trim', 'trim', 'trim',
          outward=lambda p: p - HC)
    out(PFX + 'HoodBand', bm, SMALL, sharp=40)
    bm = new_bm()
    c = veil_pt(0, 33.8, 0.012)
    n = (c - HC).normalized()
    gem_cut(bm, Matrix.Translation(c) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.011, 0.014, 0.016, 0.007)
    out(PFX + 'HoodGem', bm, SMALL, smooth=False)
    # the hood's back is what the other player sees: a gold cross in a blue ring, a gold seam to the tip
    hb = bvh_of(O(PFX + 'Hood'))
    bm = new_bm()
    decal_poly(bm, hb, [(x, 0.96 + z) for x, z in cross_poly(0.011, 0.05, 0.066, 0.042, flare=0.018, fl=0.016)], BACK,
               0.004, 'trim', center=(0, 0.96), rings=4)
    ring = [(0.062 * math.cos(2 * math.pi * k / 32), 0.96 + 0.062 * math.sin(2 * math.pi * k / 32)) for k in range(33)]
    decal_band(bm, hb, ring, [0.005] * 33, BACK, 0.003, 'accent', n=96)
    decal_poly(bm, hb, ellipse(0, 0.96, 0.009, 0.009, 14), BACK, 0.0055, 'gem', rings=1)
    out(PFX + 'HoodEmblem', bm, 0, sharp=80, recalc=False)


def build_face_p():
    # rounder child's eyes, a small open smile
    bm = new_bm()
    ret = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR)
    for v in ret['verts']:
        v.co = deform(v.co + HC)
    set_slot(bm, bm.faces, 'skin')
    head = out(PFX + 'Head', bm, BIG, sharp=80)
    bvh = bvh_of(head)
    ex0, ez, iw, ih = 0.088, 0.94, 0.037, 0.045
    bm = new_bm()
    for s in (-1, 1):
        ex = s * ex0
        decal_poly(bm, bvh, ellipse(ex, ez, iw, ih, 32), FR, 0.0015, 'eyes', rings=3)
        decal_poly(bm, bvh, ellipse(ex + s * 0.002, ez - 0.015, 0.028, 0.021, 24), FR, 0.002, 'iris2', rings=2)
        decal_poly(bm, bvh, ellipse(ex, ez + 0.003, 0.016, 0.022, 24), FR, 0.0027, 'ink', rings=2)
        decal_poly(bm, bvh, ellipse(ex - 0.012, ez + 0.016, 0.011, 0.012, 20), FR, 0.0037, 'white', rings=2)
        decal_poly(bm, bvh, ellipse(ex + 0.013, ez - 0.017, 0.0055, 0.0055, 14), FR, 0.0037, 'white', rings=1)
        lash = [(-1.0, 0.45), (-0.5, 0.9), (0.15, 1.04), (0.8, 0.92), (1.1, 0.62), (1.32, 0.7)]
        decal_band(bm, bvh, [(ex + s * iw * u, ez + ih * w) for u, w in lash], [0.0016, 0.005, 0.0066, 0.0068, 0.0058, 0.0014],
                   FR, 0.0047, 'ink', n=30)
        decal_poly(bm, bvh, ellipse(s * 0.124, 0.89, 0.024, 0.011, 18), FR, 0.0012, 'blush', rings=2)
    mouth = [(-0.012, 0.862), (-0.006, 0.854), (0.0, 0.852), (0.006, 0.854), (0.012, 0.862), (0.0, 0.86)]
    decal_poly(bm, bvh, mouth, FR, 0.0015, 'ink', center=(0, 0.857), rings=1)
    decal_poly(bm, bvh, ellipse(0, 0.8555, 0.0055, 0.0028, 10), FR, 0.0022, 'blush', rings=1)
    out(PFX + 'Face', bm, 0, sharp=80, recalc=False)


def build_brows_p():
    bvh = bvh_of(O(PFX + 'Head'), O(PFX + 'Bangs'))
    bm = new_bm()
    for s in (-1, 1):
        decal_band(bm, bvh, [(s * 0.05, 0.94 + 0.076), (s * 0.086, 0.94 + 0.086), (s * 0.12, 0.94 + 0.078)],
                   [0.0016, 0.0032, 0.0012], FR, 0.0035, 'lhair', n=18)
    out(PFX + 'Brows', bm, 0, sharp=80, recalc=False)


def build_lines_p():
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
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lmain', n=30)
    capb = bvh_of(O(PFX + 'Capelet'))
    for k in range(12):
        a = math.radians(15 + 30 * k)
        ctrl = [capb.find_nearest(Vector((0.3 * math.cos(a), 0.27 * math.sin(a), z)))[0] for z in (0.572, 0.59, 0.612)]
        line3d(bm, capb, ctrl, 0.0017, 'lcoat', n=10, taper='start')
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
    for phi, tip, w in BANGS:
        strand_lines(bang_pts(phi, tip + 5), w, 0.009, HC, 12, bang_prof, (0.0,))
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    hb = bvh_of(O(PFX + 'Hood'))
    for ph in (-150, -125, -100, 100, 125, 150, 180):
        line3d(bm, hb, [veil_pt(ph, el, 0.004) for el in (62, 30, 0, -28)], 0.0017, 'lmain', n=24)
    out(PFX + 'LinesHood', bm, 0, sharp=80, recalc=False)


def build_p():
    build_base()
    build_robe()
    build_sleeves()
    build_candle_hands()
    build_mantle()
    build_face_p()
    build_hood()
    build_brows_p()
    build_lines_p()
    pose_head()
    scale_figure(SCALE)

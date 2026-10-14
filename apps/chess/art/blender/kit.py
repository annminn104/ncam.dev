# Chibi figure kit for Blender (bpy). exec() this into a namespace dict, then the figure script.
# Geometry carries palette slots: corner colour 'Col' (white side) + point float '_SLOT' (index into SLOTS);
# the game recolours by slot, so one model serves both sides.
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

SLOTS = ['skin', 'hair', 'eyes', 'main', 'second', 'trim', 'accent', 'ink', 'glow', 'white', 'blush', 'coat',
         'gem', 'leather', 'fur', 'iris2', 'lgold', 'lmain', 'lcoat', 'lhair', 'lskin', 'glove']
PAL_W = {'skin': '#ffe6d6', 'hair': '#f3e4bd', 'eyes': '#5a8fd6', 'main': '#f4f6fb', 'second': '#dfe6f0',
         'trim': '#d6b25e', 'accent': '#3e5fbf', 'ink': '#2a2d3a', 'glow': '#e6fff6', 'white': '#ffffff',
         'blush': '#f4a6a6', 'coat': '#2b3a6e', 'gem': '#1fc8a8', 'leather': '#7a4a2a', 'fur': '#fbfbf6',
         'iris2': '#9cc8ff', 'lgold': '#6a3c10', 'lmain': '#a6b0cb', 'lcoat': '#121a38', 'lhair': '#bba25f',
         'lskin': '#dc9c86', 'glove': '#f7f8fc'}
PAL_B = {'skin': '#f5d9c8', 'hair': '#f2f4f8', 'eyes': '#c8283c', 'main': '#1c1d24', 'second': '#2b2d38',
         'trim': '#c9a24e', 'accent': '#b0233a', 'ink': '#0d0d12', 'glow': '#ffd27a', 'white': '#ffffff',
         'blush': '#e89a9a', 'coat': '#561524', 'gem': '#ff3b52', 'leather': '#3a2a24', 'fur': '#2c2b31',
         'iris2': '#ff9a9a', 'lgold': '#4a2a0b', 'lmain': '#444859', 'lcoat': '#26060e', 'lhair': '#a3a9bd',
         'lskin': '#d2917d', 'glove': '#2a2b33'}
COLL = 'Patriarch'
FR = (Vector((0, 0, 0)), Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0)))     # project from the front
BACK = (Vector((0, 0, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0)))  # project from behind


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def coll():
    c = bpy.data.collections.get(COLL)
    if c is None:
        c = bpy.data.collections.new(COLL)
        bpy.context.scene.collection.children.link(c)
    return c


# ---------------------------------------------------------------- bmesh building blocks
def new_bm():
    bm = bmesh.new()
    bm.faces.layers.int.new('slot')
    return bm


def face(bm, verts, slot):
    if any(v is None for v in verts):
        return None
    uniq = []
    for v in verts:
        if v not in uniq:
            uniq.append(v)
    if len(uniq) < 3:
        return None
    try:
        f = bm.faces.new(uniq)
    except ValueError:
        return None
    f[bm.faces.layers.int['slot']] = SLOTS.index(slot)
    return f


def set_slot(bm, faces, slot):
    lay = bm.faces.layers.int['slot']
    for f in faces:
        f[lay] = SLOTS.index(slot)


def drop(name):
    ob = bpy.data.objects.get(name)
    if ob is not None:
        me = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)


def finalize(name, bm, smooth=True, sharp=40.0, recalc=True):
    drop(name)
    lay = bm.faces.layers.int['slot']
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    cut = [e for e in bm.edges if len(e.link_faces) > 1 and len({f[lay] for f in e.link_faces}) > 1]
    if cut:
        bmesh.ops.split_edges(bm, edges=cut)
    col = bm.loops.layers.float_color.new('Col')
    sv = bm.verts.layers.float.new('_SLOT')
    for f in bm.faces:
        s = f[lay]
        c = hex_lin(PAL_W[SLOTS[s]])
        f.smooth = smooth
        for lp in f.loops:
            lp[col] = c
            lp.vert[sv] = float(s)
    bm.faces.layers.int.remove(lay)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth and sharp < 180:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    try:
        me.color_attributes.active_color_name = 'Col'
        me.color_attributes.default_color_name = 'Col'
    except Exception:
        pass
    ob = bpy.data.objects.new(name, me)
    coll().objects.link(ob)
    return ob


def lathe(bm, prof, segs, slot, a0=0.0, a1=2 * math.pi, rmod=None, xform=None, sy=1.0, wrap=False, zmod=None):
    """prof [(r, z)] bottom->top; slot: name or fn(i, j). Zero end radii become poles (unless wrap)."""
    full = abs((a1 - a0) - 2 * math.pi) < 1e-9
    cols = segs if full else segs + 1
    poles, grid = {}, []
    last = len(prof) - 1
    for i in range(cols):
        a = a0 + (a1 - a0) * i / segs
        col = []
        for j, (r, z) in enumerate(prof):
            if r <= 1e-9 and j in (0, last) and not wrap:
                if j not in poles:
                    p = Vector((0.0, 0.0, z))
                    poles[j] = bm.verts.new(xform @ p if xform is not None else p)
                col.append(poles[j])
                continue
            rr = rmod(r, z, a, j) if rmod else r
            zz = zmod(r, z, a, j) if zmod else z
            p = Vector((rr * math.cos(a), rr * math.sin(a) * sy, zz))
            col.append(bm.verts.new(xform @ p if xform is not None else p))
        grid.append(col)
    sf = slot if callable(slot) else (lambda i, j: slot)
    faces = []
    rows = len(prof) if wrap else len(prof) - 1
    for i in range(segs):
        i2 = (i + 1) % cols if full else i + 1
        for j in range(rows):
            j2 = (j + 1) % len(prof)
            s = sf(i, j)
            if s is None:
                continue
            f = face(bm, [grid[i][j], grid[i2][j], grid[i2][j2], grid[i][j2]], s)
            if f:
                faces.append(f)
    return grid, faces


def sheet(bm, P, nu, nv, thick, outer, inner, rim, outward=None):
    """Closed slab over grid P(i, j); the inner side is offset by -normal*thick."""
    pts = [[Vector(P(i, j)) for j in range(nv + 1)] for i in range(nu + 1)]

    def nrm(i, j):
        a = pts[min(i + 1, nu)][j] - pts[max(i - 1, 0)][j]
        b = pts[i][min(j + 1, nv)] - pts[i][max(j - 1, 0)]
        n = a.cross(b).normalized()
        if outward is not None and n.dot(outward(pts[i][j])) < 0:
            n = -n
        return n
    O = [[bm.verts.new(pts[i][j]) for j in range(nv + 1)] for i in range(nu + 1)]
    I = [[bm.verts.new(pts[i][j] - nrm(i, j) * thick) for j in range(nv + 1)] for i in range(nu + 1)]
    fo = outer if callable(outer) else (lambda i, j: outer)
    fi = inner if callable(inner) else (lambda i, j: inner)
    for i in range(nu):
        for j in range(nv):
            face(bm, [O[i][j], O[i + 1][j], O[i + 1][j + 1], O[i][j + 1]], fo(i, j))
            face(bm, [I[i][j + 1], I[i + 1][j + 1], I[i + 1][j], I[i][j]], fi(i, j))
    for i in range(nu):
        face(bm, [O[i][0], I[i][0], I[i + 1][0], O[i + 1][0]], rim)
        face(bm, [O[i + 1][nv], I[i + 1][nv], I[i][nv], O[i][nv]], rim)
    for j in range(nv):
        face(bm, [O[0][j + 1], I[0][j + 1], I[0][j], O[0][j]], rim)
        face(bm, [O[nu][j], I[nu][j], I[nu][j + 1], O[nu][j + 1]], rim)
    return O, I


def catmull(pts, n):
    P = [Vector(p) for p in pts]
    if len(P) == 2:
        return [P[0].lerp(P[1], k / n) for k in range(n + 1)]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    segs = len(pts) - 1
    out = []
    for k in range(n + 1):
        t = k / n * segs
        i = min(int(t), segs - 1)
        f = t - i
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        out.append(0.5 * ((2 * p1) + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * (f * f)
                          + (3 * p1 - p0 - 3 * p2 + p3) * (f * f * f)))
    return out


def catmull_closed(pts, n):
    P = [Vector(p) for p in pts]
    m = len(P)
    out = []
    for k in range(n):
        t = k / n * m
        i = int(t)
        f = t - i
        p0, p1, p2, p3 = P[(i - 1) % m], P[i % m], P[(i + 1) % m], P[(i + 2) % m]
        out.append(0.5 * ((2 * p1) + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * (f * f)
                          + (3 * p1 - p0 - 3 * p2 + p3) * (f * f * f)))
    out.append(out[0].copy())
    return out


def hair_prof(t):
    return (1 - t) ** 0.7 * (0.8 + 0.2 * min(1.0, t * 4))


def bang_prof(t):
    return (1 - t) ** 0.9 * (0.92 + 0.12 * math.sin(math.pi * min(1.0, t * 1.6)))


def strand_frames(pts, center, n):
    C = catmull(pts, n)
    out = []
    for i, c in enumerate(C):
        t = (C[min(i + 1, n)] - C[max(i - 1, 0)]).normalized()
        o = c - (center(c) if callable(center) else Vector(center))
        s = t.cross(o)
        if s.length < 1e-8:
            s = t.orthogonal()
        s.normalize()
        nr = s.cross(t).normalized()
        if nr.dot(o) < 0:
            nr = -nr
        out.append((c, t, s, nr))
    return out


def strand(bm, pts, width, thick, slot, center, n=14, k=10, prof=None):
    """Tapered lens-section strand along a Catmull-Rom curve; its wide axis lies along the surface."""
    prof = prof or hair_prof
    F = strand_frames(pts, center, n)
    rings = []
    for i, (c, t, s, nr) in enumerate(F):
        if i == n:
            rings.append([bm.verts.new(c)])
            break
        f = prof(i / n)
        rings.append([bm.verts.new(c + s * (width * f * math.cos(2 * math.pi * q / k))
                                   + nr * (thick * f * math.sin(2 * math.pi * q / k))) for q in range(k)])
    for i in range(n - 1):
        A, B = rings[i], rings[i + 1]
        for q in range(k):
            face(bm, [A[q], B[q], B[(q + 1) % k], A[(q + 1) % k]], slot)
    A, tip = rings[n - 1], rings[n][0]
    for q in range(k):
        face(bm, [A[q], tip, A[(q + 1) % k]], slot)
    face(bm, rings[0][:], slot)


def _orient(f, D):
    if f is None:
        return
    f.normal_update()
    if f.normal.dot(D) > 0:
        f.normal_flip()


def decal_poly(bm, bvh, poly, frame, off, slot, center=None, rings=3):
    O, U, V, D = frame
    if center is None:
        center = (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))
    cx, cy = center

    def at(x, y):
        loc, nrm, _, _ = bvh.ray_cast(O + U * x + V * y - D, D)
        return None if loc is None else bm.verts.new(loc + nrm * off)
    c = at(cx, cy)
    R = [[at(cx + (x - cx) * k / rings, cy + (y - cy) * k / rings) for x, y in poly] for k in range(1, rings + 1)]
    n = len(poly)
    for q in range(n):
        _orient(face(bm, [c, R[0][q], R[0][(q + 1) % n]], slot), D)
    for k in range(rings - 1):
        A, B = R[k], R[k + 1]
        for q in range(n):
            _orient(face(bm, [A[q], B[q], B[(q + 1) % n], A[(q + 1) % n]], slot), D)


def decal_band(bm, bvh, pts, widths_, frame, off, slot, n=20):
    O, U, V, D = frame
    C = catmull([(x, y, 0.0) for x, y in pts], n)
    W = catmull([(w, 0.0, 0.0) for w in widths_], n)

    def at(x, y):
        loc, nrm, _, _ = bvh.ray_cast(O + U * x + V * y - D, D)
        return None if loc is None else bm.verts.new(loc + nrm * off)
    L, R = [], []
    for i, c in enumerate(C):
        t = (C[min(i + 1, n)] - C[max(i - 1, 0)]).normalized()
        nl = Vector((-t.y, t.x, 0.0))
        w = max(W[i].x, 0.0004)
        L.append(at(c.x + nl.x * w, c.y + nl.y * w))
        R.append(at(c.x - nl.x * w, c.y - nl.y * w))
    for i in range(n):
        _orient(face(bm, [R[i], R[i + 1], L[i + 1], L[i]], slot), D)


def ellipse(cx, cy, rx, ry, n=24, rot=0.0):
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    return out


def ellipsoid(bm, c, r, slot, segs=16, rings=12, rot=None):
    ret = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    vs = ret['verts']
    M = Matrix.Translation(Vector(c)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4)) \
        @ Matrix.Diagonal((r[0], r[1], r[2], 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=vs)
    set_slot(bm, {f for v in vs for f in v.link_faces}, slot)
    return vs


def box(bm, c, size, slot, rot=None):
    ret = bmesh.ops.create_cube(bm, size=1.0)
    vs = ret['verts']
    M = Matrix.Translation(Vector(c)) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4)) \
        @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=vs)
    set_slot(bm, {f for v in vs for f in v.link_faces}, slot)
    return vs


def align_z(a, b):
    a, b = Vector(a), Vector(b)
    q = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4(), (b - a).length


def axis_to(n):
    return Vector((0, 0, 1)).rotation_difference(Vector(n).normalized()).to_matrix().to_4x4()


def bvh_of(*obs):
    """BVH of the objects' own meshes, without modifiers (an outline shell would catch every ray)."""
    bm = bmesh.new()
    for ob in obs:
        tmp = bmesh.new()
        tmp.from_mesh(ob.data)
        tmp.transform(ob.matrix_world)
        me = bpy.data.meshes.new('__tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def slab(bm, poly, M, thick, bevel=0.0015, seg=1):
    """Extrude a 2D (x, z) outline along local y and bevel it; the caller sets the slot afterwards."""
    fr = [bm.verts.new(M @ Vector((x, -thick / 2, z))) for x, z in poly]
    bk = [bm.verts.new(M @ Vector((x, thick / 2, z))) for x, z in poly]
    fs = [face(bm, fr, 'trim'), face(bm, bk[::-1], 'trim')]
    n = len(poly)
    for q in range(n):
        fs.append(face(bm, [fr[q], bk[q], bk[(q + 1) % n], fr[(q + 1) % n]], 'trim'))
    fs = [f for f in fs if f]
    bmesh.ops.recalc_face_normals(bm, faces=fs)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list({e for f in fs for e in f.edges}), offset=bevel, segments=seg, profile=0.5,
                        affect='EDGES')


def gem_cut(bm, M, w, top, bot, depth, slot='gem', n=8):
    """Faceted kite gem facing local -y: girdle ring, raised table, culet behind. Flat-shade its object."""
    def kite(a, k):
        x, z = math.sin(a), math.cos(a)
        return Vector((x * w * k, 0.0, z * (top if z > 0 else bot) * k))
    gird = [bm.verts.new(M @ kite(2 * math.pi * i / n, 1.0)) for i in range(n)]
    tab = [bm.verts.new(M @ (kite(2 * math.pi * i / n, 0.55) + Vector((0, -depth, 0)))) for i in range(n)]
    cul = bm.verts.new(M @ Vector((0, depth * 0.5, 0)))
    face(bm, tab[:], slot)
    for i in range(n):
        j = (i + 1) % n
        face(bm, [gird[i], gird[j], tab[j], tab[i]], slot)
        face(bm, [gird[j], gird[i], cul], slot)


def crystal(bm, c, r, top, bot, n=6, slot='gem', twist=0.0):
    ring = [bm.verts.new(c + Vector((r * math.cos(2 * math.pi * k / n + twist), r * math.sin(2 * math.pi * k / n + twist), 0)))
            for k in range(n)]
    t = bm.verts.new(c + Vector((0, 0, top)))
    b = bm.verts.new(c + Vector((0, 0, -bot)))
    for k in range(n):
        face(bm, [ring[k], ring[(k + 1) % n], t], slot)
        face(bm, [ring[(k + 1) % n], ring[k], b], slot)


def leaf(L, W, curve, n=12, start=0.0):
    right, left = [], []
    for k in range(n + 1):
        u = start + (1 - start) * k / n
        cx, cz = curve * u * u * L, u * L
        tx, tz = 2 * curve * u * L, L
        tl = math.hypot(tx, tz)
        tx, tz = tx / tl, tz / tl
        nx, nz = tz, -tx
        w = W * (math.sin(math.pi * min(1.0, u * 1.25 + 0.08)) ** 0.6) * (1 - u) ** 0.45
        right.append((cx + nx * w, cz + nz * w))
        left.append((cx - nx * w, cz - nz * w))
    return right + left[::-1]


def cross_poly(hw, lt, lb, lh, flare=0.018, fl=0.02):
    return [(hw, -lb), (hw, -hw), (lh - fl, -hw), (lh, -flare), (lh, flare), (lh - fl, hw), (hw, hw), (hw, lt - fl),
            (flare, lt), (-flare, lt), (-hw, lt - fl), (-hw, hw), (-(lh - fl), hw), (-lh, flare), (-lh, -flare),
            (-(lh - fl), -hw), (-hw, -hw), (-hw, -lb)]


def tube(bm, pts, r, slot, n=24, k=6, cap=True, radius=None):
    C = catmull(pts, n)
    N = len(C) - 1
    T = [(C[min(i + 1, N)] - C[max(i - 1, 0)]).normalized() for i in range(N + 1)]
    nv = T[0].orthogonal().normalized()
    rings = []
    for i in range(N + 1):
        nv = (nv - T[i] * nv.dot(T[i])).normalized()
        bv = T[i].cross(nv)
        rr = radius(i / N) if radius else r
        rings.append([bm.verts.new(C[i] + (nv * math.cos(2 * math.pi * q / k) + bv * math.sin(2 * math.pi * q / k)) * rr)
                      for q in range(k)])
    for i in range(N):
        for q in range(k):
            face(bm, [rings[i][q], rings[i][(q + 1) % k], rings[i + 1][(q + 1) % k], rings[i + 1][q]], slot)
    if cap:
        face(bm, rings[0][::-1], slot)
        face(bm, rings[-1][:], slot)


def resample(pts, spacing, n=240):
    C = catmull(pts, n)
    out, acc = [C[0]], 0.0
    for a, b in zip(C, C[1:]):
        seg = (b - a).length
        while acc + seg >= spacing and seg > 1e-9:
            t = (spacing - acc) / seg
            a = a.lerp(b, t)
            out.append(a)
            seg = (b - a).length
            acc = 0.0
        acc += seg
    return out


def tassel(bm, top, slot, length=0.05, r=0.011):
    ellipsoid(bm, top, (0.0075, 0.0075, 0.0075), slot, segs=10, rings=6)
    prof = [(0.0, -0.002), (0.005, -0.002), (0.0065, -0.012), (r * 0.8, -length * 0.6), (r, -length), (0.0, -length)]
    lathe(bm, prof, 12, slot, xform=Matrix.Translation(top),
          rmod=lambda rr, z, a, j: rr * (1 + 0.16 * math.cos(6 * a)) if j >= 3 else rr)


# ---------------------------------------------------------------- line strips (drawn linework as geometry)
def widths(n, w, taper):
    out = []
    for i in range(n):
        t = i / max(1, n - 1)
        if taper == 'both':
            k = max(0.15, math.sin(math.pi * t)) ** 0.5
        elif taper == 'end':
            k = max(0.12, 1 - t) ** 0.6
        elif taper == 'start':
            k = max(0.12, t) ** 0.6
        else:
            k = 1.0
        out.append(w * k)
    return out


def strip(bm, P, N, W, slot, lift=0.0012):
    L, R = [], []
    n = len(P)
    for i in range(n):
        t = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)])
        if t.length < 1e-9:
            continue
        t.normalize()
        sd = t.cross(N[i])
        if sd.length < 1e-9:
            continue
        sd.normalize()
        b = P[i] + N[i] * lift
        L.append(bm.verts.new(b + sd * W[i]))
        R.append(bm.verts.new(b - sd * W[i]))
    for i in range(len(L) - 1):
        f = face(bm, [R[i], R[i + 1], L[i + 1], L[i]], slot)
        if f:
            f.normal_update()
            if f.normal.dot(N[min(i, n - 1)]) < 0:
                f.normal_flip()


def line3d(bm, bvh, ctrl, w, slot, n=40, lift=0.0011, taper='both', closed=False):
    C = catmull_closed(ctrl, n) if closed else catmull(ctrl, n)
    P, N = [], []
    for c in C:
        loc, nrm, _, _ = bvh.find_nearest(c)
        if loc is None:
            continue
        P.append(loc)
        N.append(nrm)
    strip(bm, P, N, widths(len(P), w, 'none' if closed else taper), slot, lift)


def flat_line(bm, M, pts2, side, w, slot, taper='both', closed=False, half=0.0, n=None, lift=0.0009):
    """A line on a slab's flat face: pts2 in the slab's local (x, z); side -1 = front (-y), +1 = back."""
    src = [(x, 0, z) for x, z in pts2]
    C = catmull_closed(src, n or 4 * len(pts2)) if closed else catmull(src, n or 4 * len(pts2))
    nrm = (M.to_3x3() @ Vector((0, side, 0))).normalized()
    P = [M @ Vector((c.x, side * half, c.z)) for c in C]
    strip(bm, P, [nrm] * len(P), widths(len(P), w, 'none' if closed else taper), slot, lift)


# ---------------------------------------------------------------- preview materials + render
def _node(nt, kind, loc, **props):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n


def _ramp(nt, loc, stops, interp='LINEAR'):
    r = _node(nt, 'ShaderNodeValToRGB', loc)
    cr = r.color_ramp
    cr.interpolation = interp
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    cr.elements[0].position, cr.elements[0].color = stops[0][0], stops[0][1]
    for p, c in stops[1:]:
        e = cr.elements.new(p)
        e.color = c
    return r


def _mix(nt, loc, blend='MIX'):
    return _node(nt, 'ShaderNodeMix', loc, data_type='RGBA', blend_type=blend)


def _math(nt, loc, op, a=None, b=None):
    m = _node(nt, 'ShaderNodeMath', loc, operation=op)
    if a is not None:
        m.inputs[0].default_value = a
    if b is not None:
        m.inputs[1].default_value = b
    return m


def _rgba(h):
    c = hex_lin(h)
    return (c[0], c[1], c[2], 1.0)


GOLD_STOPS = [(0.0, '#3a1f08'), (0.38, '#74410f'), (0.6, '#b9761d'), (0.8, '#e9a932'), (0.885, '#f6c24a'),
              (0.94, '#ffe08a'), (0.972, '#fff4cf'), (0.99, '#ffffff')]
SILVER_STOPS = [(0.0, '#1b1e26'), (0.38, '#3b404c'), (0.6, '#69707f'), (0.8, '#a0a8b7'), (0.885, '#c0c6d2'),
                (0.94, '#dbe0e8'), (0.972, '#eef1f5'), (0.99, '#ffffff')]


def build_materials(metal=GOLD_STOPS):
    m = bpy.data.materials.get('M_Paint') or bpy.data.materials.new('M_Paint')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    L = nt.links.new
    out = _node(nt, 'ShaderNodeOutputMaterial', (2200, 0))
    col = _node(nt, 'ShaderNodeVertexColor', (-900, 300), layer_name='Col')
    attr = _node(nt, 'ShaderNodeAttribute', (-900, -700), attribute_name='_SLOT')
    dif = _node(nt, 'ShaderNodeBsdfDiffuse', (-900, 0))
    s2r = _node(nt, 'ShaderNodeShaderToRGB', (-700, 0))
    L(dif.outputs[0], s2r.inputs[0])
    bw = _node(nt, 'ShaderNodeRGBToBW', (-500, 0))
    L(s2r.outputs[0], bw.inputs[0])
    soft = _ramp(nt, (-300, 0), [(0.0, (0.40, 0.42, 0.60, 1)), (0.15, (0.40, 0.42, 0.60, 1)), (0.27, (1, 1, 1, 1))])
    L(bw.outputs[0], soft.inputs[0])
    cloth = _mix(nt, (0, 200), 'MULTIPLY')
    cloth.inputs[0].default_value = 1.0
    L(col.outputs['Color'], cloth.inputs[6])
    L(soft.outputs['Color'], cloth.inputs[7])
    lw = _node(nt, 'ShaderNodeLayerWeight', (-500, -250))
    lw.inputs['Blend'].default_value = 0.4
    rr = _ramp(nt, (-300, -250), [(0.0, (0, 0, 0, 1)), (0.58, (0, 0, 0, 1)), (0.78, (1, 1, 1, 1))])
    L(lw.outputs['Facing'], rr.inputs[0])
    litm = _math(nt, (-300, -450), 'GREATER_THAN', b=0.22)
    L(bw.outputs[0], litm.inputs[0])
    rim = _math(nt, (-50, -300), 'MULTIPLY')
    L(rr.outputs['Color'], rim.inputs[0])
    L(litm.outputs[0], rim.inputs[1])
    rim2 = _math(nt, (100, -300), 'MULTIPLY', b=0.28)
    L(rim.outputs[0], rim2.inputs[0])
    clothr = _mix(nt, (300, 200), 'ADD')
    L(rim2.outputs[0], clothr.inputs[0])
    L(cloth.outputs[2], clothr.inputs[6])
    clothr.inputs[7].default_value = (1, 1, 1, 1)
    geo = _node(nt, 'ShaderNodeNewGeometry', (-900, -1000))
    vt = _node(nt, 'ShaderNodeVectorTransform', (-700, -1000), vector_type='NORMAL', convert_from='WORLD',
               convert_to='CAMERA')
    L(geo.outputs['Normal'], vt.inputs[0])
    dot = _node(nt, 'ShaderNodeVectorMath', (-500, -1000), operation='DOT_PRODUCT')
    # Blender's camera space looks down +z, so the key vector's z is negative.
    dot.inputs[1].default_value = Vector((-0.35, 0.62, -0.70)).normalized()
    L(vt.outputs[0], dot.inputs[0])
    gold = _ramp(nt, (-300, -900), [(p, _rgba(h)) for p, h in metal])
    gold.name = 'Metal'
    mr = _node(nt, 'ShaderNodeMapRange', (-450, -1200))
    mr.inputs['From Min'].default_value = -1.0
    mr.inputs['From Max'].default_value = 1.0
    L(dot.outputs['Value'], mr.inputs['Value'])
    L(mr.outputs['Result'], gold.inputs[0])
    gsh = _math(nt, (-300, -1150), 'MULTIPLY_ADD')
    L(bw.outputs[0], gsh.inputs[0])
    gsh.inputs[1].default_value = 0.6
    gsh.inputs[2].default_value = 0.55
    gcl = _math(nt, (-150, -1150), 'MINIMUM', b=1.0)
    L(gsh.outputs[0], gcl.inputs[0])
    gk = _node(nt, 'ShaderNodeVectorMath', (0, -1100), operation='SCALE')
    L(gold.outputs['Color'], gk.inputs[0])
    L(gcl.outputs[0], gk.inputs['Scale'])
    gt = _node(nt, 'ShaderNodeMapRange', (-300, -1400))
    gt.inputs['From Min'].default_value = -0.5
    gt.inputs['From Max'].default_value = 0.88
    L(dot.outputs['Value'], gt.inputs['Value'])
    deep = _node(nt, 'ShaderNodeVectorMath', (-300, -1600), operation='SCALE')
    deep.inputs['Scale'].default_value = 0.22
    L(col.outputs['Color'], deep.inputs[0])
    bright = _node(nt, 'ShaderNodeVectorMath', (-300, -1750), operation='SCALE')
    bright.inputs['Scale'].default_value = 1.7
    L(col.outputs['Color'], bright.inputs[0])
    gm = _mix(nt, (0, -1500))
    L(gt.outputs['Result'], gm.inputs[0])
    L(deep.outputs[0], gm.inputs[6])
    L(bright.outputs[0], gm.inputs[7])
    glint = _math(nt, (0, -1700), 'GREATER_THAN', b=0.9)
    L(dot.outputs['Value'], glint.inputs[0])
    gemc = _mix(nt, (200, -1500))
    L(glint.outputs[0], gemc.inputs[0])
    L(gm.outputs[2], gemc.inputs[6])
    gemc.inputs[7].default_value = (1, 1, 1, 1)
    glowc = _node(nt, 'ShaderNodeVectorMath', (200, -1900), operation='SCALE')
    glowc.inputs['Scale'].default_value = 1.4
    L(col.outputs['Color'], glowc.inputs[0])

    def is_slot(name, loc):
        c = _math(nt, loc, 'COMPARE', b=float(SLOTS.index(name)))
        c.inputs[2].default_value = 0.1
        L(attr.outputs['Fac'], c.inputs[0])
        return c
    m1 = _mix(nt, (800, 100))
    L(is_slot('trim', (500, -600)).outputs[0], m1.inputs[0])
    L(clothr.outputs[2], m1.inputs[6])
    L(gk.outputs[0], m1.inputs[7])
    m2 = _mix(nt, (1000, 100))
    L(is_slot('gem', (500, -750)).outputs[0], m2.inputs[0])
    L(m1.outputs[2], m2.inputs[6])
    L(gemc.outputs[2], m2.inputs[7])
    m3 = _mix(nt, (1200, 100))
    L(is_slot('glow', (500, -900)).outputs[0], m3.inputs[0])
    L(m2.outputs[2], m3.inputs[6])
    L(glowc.outputs[0], m3.inputs[7])
    em = _node(nt, 'ShaderNodeEmission', (1500, 100))
    L(m3.outputs[2], em.inputs['Color'])
    L(em.outputs[0], out.inputs['Surface'])

    ln = bpy.data.materials.get('M_Line') or bpy.data.materials.new('M_Line')
    ln.use_nodes = True
    nt = ln.node_tree
    nt.nodes.clear()
    L = nt.links.new
    out = _node(nt, 'ShaderNodeOutputMaterial', (600, 0))
    col = _node(nt, 'ShaderNodeVertexColor', (-400, 0), layer_name='Col')
    mul = _mix(nt, (0, 0), 'MULTIPLY')
    mul.inputs[0].default_value = 1.0
    L(col.outputs['Color'], mul.inputs[6])
    mul.inputs[7].default_value = (0.085, 0.066, 0.08, 1)
    add = _mix(nt, (200, 0), 'ADD')
    add.inputs[0].default_value = 1.0
    L(mul.outputs[2], add.inputs[6])
    add.inputs[7].default_value = (0.006, 0.005, 0.009, 1)
    em = _node(nt, 'ShaderNodeEmission', (400, 0))
    L(add.outputs[2], em.inputs['Color'])
    L(em.outputs[0], out.inputs['Surface'])
    ln.use_backface_culling = True
    return m, ln


def set_metal(stops):
    """Gives M_Paint's metal ramp other stops (GOLD_STOPS or SILVER_STOPS), between a sheet's shots."""
    cr = bpy.data.materials['M_Paint'].node_tree.nodes['Metal'].color_ramp
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    cr.elements[0].position, cr.elements[0].color = stops[0][0], _rgba(stops[0][1])
    for p, h in stops[1:]:
        cr.elements.new(p).color = _rgba(h)


def dress(ob, width=0.0042, line_on=True):
    paint, line = bpy.data.materials['M_Paint'], bpy.data.materials['M_Line']
    ob.data.materials.clear()
    ob.data.materials.append(paint)
    ob.data.materials.append(line)
    for md in list(ob.modifiers):
        ob.modifiers.remove(md)
    if line_on:
        sol = ob.modifiers.new('Outline', 'SOLIDIFY')
        sol.thickness = width
        sol.offset = 1.0
        sol.use_flip_normals = True
        sol.use_rim = False
        sol.use_quality_normals = True
        sol.material_offset = 1
    return ob


def recolor(pal, ink_hex='#2a2d3a'):
    lut = [hex_lin(pal[s]) for s in SLOTS]
    for ob in coll().objects:
        if ob.type != 'MESH' or ob.name.startswith('X_'):
            continue
        me = ob.data
        sl = [0.0] * len(me.vertices)
        me.attributes['_SLOT'].data.foreach_get('value', sl)
        cols = []
        for lp in me.loops:
            cols.extend(lut[int(round(sl[lp.vertex_index]))])
        me.color_attributes['Col'].data.foreach_set('color', cols)
        me.update()


def scene_setup():
    scene = bpy.context.scene
    w = scene.world or bpy.data.worlds.new('World')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    amb = nt.nodes.new('ShaderNodeBackground')
    amb.inputs['Color'].default_value = (0.05, 0.055, 0.07, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Window'], sep.inputs[0])
    gr = nt.nodes.new('ShaderNodeValToRGB')
    gr.color_ramp.elements[0].color = _rgba('#1d2230')
    gr.color_ramp.elements[1].color = _rgba('#4b5468')
    nt.links.new(sep.outputs['Y'], gr.inputs[0])
    bgc = nt.nodes.new('ShaderNodeBackground')
    nt.links.new(gr.outputs['Color'], bgc.inputs['Color'])
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(bgc.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    sun = bpy.data.objects.get('Key')
    if sun is None:
        sd = bpy.data.lights.new('Key', 'SUN')
        sun = bpy.data.objects.new('Key', sd)
        scene.collection.objects.link(sun)
    sun.data.energy = 3.2
    sun.data.angle = math.radians(1.5)
    sun.data.use_shadow = False
    sun.rotation_euler = Vector((-0.55, 1.0, -1.25)).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.get('Cam')
    if cam is None:
        cd = bpy.data.cameras.new('Cam')
        cam = bpy.data.objects.new('Cam', cd)
        scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = False
    scene.eevee.taa_render_samples = 32
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'


def shoot(path, az, el, dist=4.1, tgt=(0, 0, 0.73), res=1200, lens=85):
    scene = bpy.context.scene
    cam = bpy.data.objects['Cam']
    cam.data.lens = lens
    t = Vector(tgt)
    a, e = math.radians(az), math.radians(el)
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def contact_sheet(paths_top, paths_bottom, out_path):
    import numpy as np

    def load(p):
        im = bpy.data.images.load(p, check_existing=False)
        w, h = im.size
        a = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(a)
        bpy.data.images.remove(im)
        a = a.reshape(h, w, 4)
        f = max(1, w // 600)
        return a.reshape(h // f, f, w // f, f, 4).mean(axis=(1, 3))
    rows = [np.concatenate([load(p) for p in r], axis=1) for r in (paths_bottom, paths_top)]
    sh = np.concatenate(rows, axis=0)
    h, w = sh.shape[:2]
    out = bpy.data.images.new('__sheet', w, h, alpha=True)
    out.pixels.foreach_set(sh.ravel())
    out.filepath_raw = out_path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)

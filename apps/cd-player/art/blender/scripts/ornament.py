"""ornament: cloisonné enamel for any model's faces. Motifs are drawn as metal wire outlines (the
wire's material is the caller's: Luxe passes luxe_metal, the suitcase hardware, so the outlines
follow the look) filled with enamel in a fixed palette, ENAMEL, which build_enamel_materials makes.
luxe_ornament.py lays Luxe's.

Exec'd after cdkit.py and parts.py, before a model's own scripts, into the same namespace: it reads
cdkit's M, MM, WEB, mat, lin, hexrgb and from_bm, parts.py's smooth_path, and nothing of any model.
Millimetres throughout; the web build (WEB, read at call time) leaves out every wall (as
clear_decor's ring) and draws every outline with fewer points.

Faces. A motif is drawn in a face's own 2D frame, (a, b) mm, as one sees the face from outside (a
to the right, b up), and stands h mm off it; a face's at(a, b, h) gives that point, (x, y, z) mm in
its group's frame, and step(points) how finely a flat piece over those points must be cut to follow
the face (None: it is flat there).
- Plane(origin, normal, up): a flat face through `origin`, its outward `normal` and its `up` (made
  square to the normal). It is the placement helper: lay(orn, Plane(...), items, wire) lays a 2D
  layout in mm on any flat face.
- Wall(outline, zero): the side of a vertical extrusion (a tier of a plinth): `outline` the solid's
  own points in plan (so that the wall's flat faces are its), a along it counter-clockwise seen from
  above from the point nearest `zero` (x, y), b the height (z), h out along its normal.
- Tube(p0, p1, radius, ref): round a cylinder from p0 to p1 (x, y, z): a round it from `ref` (a
  direction across its axis), counter-clockwise seen from p1, b along its axis from p0. A vertical
  drum is Tube((x, y, z0), (x, y, z1), r); `round` is its circumference.

Heights. Every part's foot is LIFT (0.02 mm) off its face, as the other decals in these scripts, so
nothing sinks into it or fights it for depth. Enamel and its wire come in three layers (LAYERS, the
enamel's top and its wire's top over the face): the ground (leaves, sprays, acanthus, shells),
the blooms (petals) and their hearts, so that a flower drawn over a leaf lies above it, its wire
too, and nothing coplanar of two colours overlaps. A flower's cells lie side by side, sharing their
outlines, as cloisonné's do. Stems and scrolls (wire alone) stand at STEM, over every layer. The
enamel is at most 0.58 mm proud and the wire 0.78, under the 0.8 mm of Luxe's bands. A bead (bead,
pearl_row) is the one round part: a flattened sphere's cap, its centre under the face and its top
PROUD off it, the cap carried on BEAD_FOOT under the face, hidden, so that it never floats over a
faceted corner (a 1.4 mm bead's foot is 1.31 mm round). Nothing stands more than PROUD (0.9 mm, the
spec's cap) off its face: an Ornament stops the run on a part that would.

Ornament(name, parent) collects one group's ornament (a deck's body, a stand, a ledge); done()
merges it into one mesh per material (`<name>_<material>`, the beads `<name>_<material>_beads`,
smooth-shaded) hanging from `parent`, so that it moves with it. Every face is turned out, as the
page draws front faces only. orn.placed lists every vertex laid (mm, the group's frame) and
orn.extent(since) boxes those laid since a count of them, so that a caller can hold a region's
ornament to where it may go. A Pen is a motif's own frame on a face (its cells, its ring of cells
side by side with their wires drawn once, its wires and dots).

Motifs. Each takes the Ornament, the face, `at` (a, b) (its centre, or for a leaf, a spray, an
acanthus and a shell its base), its size in mm, the wire's material, and the keywords `turn`
(radians counter-clockwise as one sees the face; 0 is upright, toward +b), `flip` (mirrored across
its own up), `layer` (its lowest layer) and its colours (keys of ENAMEL):
- camellia(orn, face, at, r, wire, colours=("rose", "coral"), heart="butter"): seven broad rounded
  petals round five, a raised heart dotted with stamens;
- daisy(orn, face, at, r, wire, petals=10, colour="ivory", heart="butter");
- rose(orn, face, at, r, wire, colours=("rose", "coral"), heart="butter", sepals="leaf"): five
  heart-shaped petals round five, green sepal tips between the outer ones;
- leaf(orn, face, at, length, wire, width=0.4, bend=0.12, colour="leaf"): a cell and its midrib;
- spray(orn, face, at, length, wire, leaves=5, bend=0.3, colour="leaf", berries="sky"): a curving
  stem, leaves alternating along it and one at its tip, berries on short twigs;
- acanthus(orn, face, at, length, wire, lobes=3, curl=0.3, colours=("leaf", "sky")): a lobed leaf
  curling to its right, a lens of the second colour along its middle;
- c_scroll(orn, face, at, size, wire): a C of wire `size` tall, its two ends curled in, opening to
  its right; s_scroll(orn, face, at, size, wire): an S of wire `size` long, lying along a;
- rocaille(orn, face, at, r, wire, ribs=7, colours=("ivory", "sky"), hinge="butter"): a shell, a
  fan of ribbed cells opening from its hinge;
- pearl_row(orn, face, path, wire, radius=1.4, pitch=6.0, loop=False, skip=None): beads along a
  path in (a, b);
- vine(orn, face, path, wire, every=25.0, leaf_len=7.0, flowers=()): a stem along a path, a leaf
  every `every` mm, tendrils, flowers on it;
- vine_round(orn, tube, wire, b0, b1, turns=3.0, window=None, ...): a vine winding up a Tube, or
  weaving within a window round it;
- garland(orn, tube, b, wire, flowers=("camellia", "daisy", "rose"), count=6, size=4.0, ...): a wavy
  vine all the way round a Tube at height b, flowers evenly round it.
lay(orn, face, items, wire) lays a layout (items (motif, (a, b), size, keywords)) on a face;
mirror(items) is its mirror image across a = 0 and mirrored(items) the layout and its mirror, for a
symmetric face.
"""
import bisect
import math

import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ENAMEL = (("rose", "#D94F6B"), ("coral", "#F2896B"), ("butter", "#F4C95D"), ("leaf", "#5E9E6E"),
          ("sky", "#3FA7B5"), ("ivory", "#F6F0E6"))
LIFT = 0.02                                          # every part's foot over its face
LAYERS = ((0.14, 0.26), (0.38, 0.50), (0.58, 0.70))  # (enamel's top, wire's top) mm, ground to hearts
GROUND, BLOOM = 0, 1                                 # the leaves' layer, the flowers'
STEM = 0.78                                          # stems and scrolls, wire alone, over every layer
WIRE_W, STEM_W = 0.5, 0.8                            # a cell's outline, a stem's or a scroll's: widths
PROUD = 0.9                                          # nothing stands further off its face (a bead's top)
BEAD_FOOT = 0.15                                     # a bead's cap goes on this far under the face
SAG = 0.04                                           # a flat piece strays at most this off a curved face


def build_enamel_materials():
    """The enamel palette, M["enamel_<colour>"] for each of ENAMEL (sRGB): fixed (no look recolours
    it), glossy, roughness 0.22 under a 0.7 coat, and none of it emissive. Idempotent: mat()
    rebuilds a material from scratch."""
    for key, colour in ENAMEL:
        M["enamel_" + key] = mat("enamel_" + key, lin(*hexrgb(colour)), rough=0.22, coat=0.7, coat_rough=0.08)
    return M


def _orn_n(render, web):
    """A count of points: `render`'s in a render, `web`'s in the web build."""
    return web if WEB else render


def _orn_pts(mm, least=3):
    """How many pieces draw a curve `mm` long: one every 0.5 mm in a render, every 1.8 mm in the web
    build, and at least `least`."""
    return max(least, int(math.ceil(mm / (1.8 if WEB else 0.5))))


# ------------------------------------------------------------------ 2D paths (mm)
def _orn_area(pts):
    """An outline's signed area: positive when it runs counter-clockwise."""
    return sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1])) / 2.0


def _orn_clean(pts, closed=True):
    """The points as float pairs, without consecutive repeats (nor, closed, a last one repeating
    the first)."""
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append((float(p[0]), float(p[1])))
    if closed and len(out) > 2 and math.dist(out[0], out[-1]) <= 1e-6:
        out.pop()
    return out


def _orn_ccw(pts):
    return pts if _orn_area(pts) >= 0 else pts[::-1]


def _orn_offset(pts, d, closed):
    """The path offset d mm to its left, mitred at its bends (a mitre at most three times d)."""
    n = len(pts)
    out = []
    for i in range(n):
        p = Vector(pts[i])
        ends = []
        if closed or i > 0:
            ends.append(p - Vector(pts[i - 1]))
        if closed or i < n - 1:
            ends.append(Vector(pts[(i + 1) % n]) - p)
        normals = [Vector((-t.y, t.x)).normalized() for t in ends if t.length > 1e-9]
        if not normals:
            out.append(tuple(p))
            continue
        m = normals[0] + normals[-1]
        m = m.normalized() if m.length > 1e-9 else normals[0]
        k = min(1.0 / max(m.dot(normals[0]), 1e-3), 3.0)
        out.append(tuple(p + m * (d * k)))
    return out


def _orn_resample(pts, step, closed):
    """The path with no piece running more than `step` mm along a (a curved face bends that way
    only: round a tube, round a wall's corner)."""
    n = len(pts)
    out = []
    for i in range(n if closed else n - 1):
        p, q = pts[i], pts[(i + 1) % n]
        k = max(1, int(math.ceil(abs(q[0] - p[0]) / step)))
        out += [(p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k) for j in range(k)]
    if not closed:
        out.append(pts[-1])
    return out


def _orn_cross(p, q, a):
    """Where the segment p q crosses the line at `a`, worked from its endpoints in a fixed order, so
    that two pieces sharing the segment cut it at the very same point."""
    u, v = sorted((p, q))
    t = (a - u[0]) / (v[0] - u[0])
    return (a, u[1] + (v[1] - u[1]) * t)


def _orn_clip(poly, a, side):
    """The convex polygon's part on `side` of the line at `a` (1: a and over, -1: a and under)."""
    out = []
    for p, q in zip(poly, poly[1:] + poly[:1]):
        pin, qin = side * (p[0] - a) >= 0, side * (q[0] - a) >= 0
        if pin:
            out.append(p)
        if pin != qin:
            out.append(_orn_cross(p, q, a))
    return out


class _OrnPath:
    """An open polyline in (a, b) mm walked by arc length: point_at(s) gives its point and its unit
    tangent s mm from its start."""

    def __init__(self, pts):
        self.pts = _orn_clean(pts, closed=False)
        self.cum = [0.0]
        for p, q in zip(self.pts, self.pts[1:]):
            self.cum.append(self.cum[-1] + math.dist(p, q))
        self.length = self.cum[-1]

    def point_at(self, s):
        s = min(max(s, 0.0), self.length)
        i = min(bisect.bisect_right(self.cum, s) - 1, len(self.pts) - 2)
        (pa, pb), (qa, qb) = self.pts[i], self.pts[i + 1]
        seg = self.cum[i + 1] - self.cum[i]
        t = (s - self.cum[i]) / seg
        return (pa + (qa - pa) * t, pb + (qb - pb) * t), ((qa - pa) / seg, (qb - pb) / seg)


# ------------------------------------------------------------------ faces
class Plane:
    """A flat face through `origin` (x, y, z mm), facing `normal`, its `up` made square to it: a
    runs along up x normal, to the right as one sees the face from outside."""

    def __init__(self, origin, normal, up):
        self.o = Vector(origin)
        self.n = Vector(normal).normalized()
        u = Vector(up)
        self.u = (u - self.n * u.dot(self.n)).normalized()
        self.r = self.u.cross(self.n)

    def at(self, a, b, h):
        return self.o + self.r * a + self.u * b + self.n * h

    def step(self, pts):
        return None


class Wall:
    """The side of a vertical extrusion of `outline` ((x, y) mm, closed, either winding: the solid's
    own points, so that its flat faces are the wall's): a along it counter-clockwise seen from above
    from the point nearest `zero`, b the height, h out along the side's normal. `length` is once
    round it; a_of((x, y)) the a of the point nearest (x, y)."""

    def __init__(self, outline, zero=(0.0, -1e6)):
        self.pts = _orn_ccw(_orn_clean(outline))
        n = len(self.pts)
        self.cum = [0.0]
        for i in range(n):
            self.cum.append(self.cum[-1] + math.dist(self.pts[i], self.pts[(i + 1) % n]))
        self.length = self.cum[-1]
        self.s0 = 0.0
        self.s0 = self.a_of(zero)

    def a_of(self, xy):
        """The a of the outline's point nearest `xy` (x, y)."""
        z = Vector(xy)
        n = len(self.pts)
        best = None
        for i in range(n):
            p, q = Vector(self.pts[i]), Vector(self.pts[(i + 1) % n])
            t = min(max((z - p).dot(q - p) / (q - p).length_squared, 0.0), 1.0)
            d = (p + (q - p) * t - z).length
            if best is None or d < best[0]:
                best = (d, self.cum[i] + t * (q - p).length)
        return (best[1] - self.s0) % self.length

    def _seg(self, a):
        s = (self.s0 + a) % self.length
        i = min(bisect.bisect_right(self.cum, s) - 1, len(self.pts) - 1)
        return i, s - self.cum[i]

    def at(self, a, b, h):
        i, s = self._seg(a)
        p, q = Vector(self.pts[i]), Vector(self.pts[(i + 1) % len(self.pts)])
        t = (q - p).normalized()
        c = p + t * s + Vector((t.y, -t.x)) * h
        return Vector((c.x, c.y, b))

    def step(self, pts):
        """1 mm where the points run round a corner of the outline, else None (one flat face)."""
        lo, hi = min(a for a, _ in pts), max(a for a, _ in pts)
        if hi - lo >= self.length / 2 or self._seg(lo)[0] != self._seg(hi)[0]:
            return 1.0
        return None


class Tube:
    """Round a cylinder of `radius` from p0 to p1 (x, y, z mm): a round it from `ref` (made square
    to the axis), counter-clockwise seen from p1, b along the axis from p0, h out from it. `round`
    is its circumference, `length` its length."""

    def __init__(self, p0, p1, radius, ref=(1.0, 0.0, 0.0)):
        self.p0 = Vector(p0)
        axis = Vector(p1) - self.p0
        self.length = axis.length
        self.axis = axis.normalized()
        e1 = Vector(ref) - self.axis * Vector(ref).dot(self.axis)
        self.e1 = e1.normalized()
        self.e2 = self.axis.cross(self.e1)
        self.radius = radius
        self.round = 2.0 * math.pi * radius

    def at(self, a, b, h):
        th = a / self.radius
        return self.p0 + self.axis * b + (self.e1 * math.cos(th) + self.e2 * math.sin(th)) * (self.radius + h)

    def step(self, pts):
        return math.sqrt(8.0 * self.radius * SAG)


def _orn_frame(face, a, b):
    """The face's point at (a, b) and its right, up and outward unit vectors there."""
    p = face.at(a, b, 0.0)
    e = 1e-3
    return (p, (face.at(a + e, b, 0.0) - p).normalized(), (face.at(a, b + e, 0.0) - p).normalized(),
            (face.at(a, b, 1.0) - p).normalized())


# ------------------------------------------------------------------ the collector
class Ornament:
    """One group's ornament: fills, strips and beads laid on faces, merged by material. done()
    makes the meshes, hanging from `parent`."""

    def __init__(self, name, parent):
        self.name, self.parent = name, parent
        self.meshes = {}
        self.placed = []          # every vertex laid, in the group's frame (mm), for extent()

    def _vert(self, bm, co, h):
        """A vertex at `co` (mm), `h` mm off its face: it stops the run past PROUD."""
        if h > PROUD + 1e-9:
            raise SystemExit("ornament.py: %s lays a part %.3f mm proud of its face, past PROUD (%.1f mm)"
                             % (self.name, h, PROUD))
        self.placed.append(co)
        return bm.verts.new(co * MM)

    def extent(self, since=0):
        """The box ((x, y, z) mm, least and most) of every vertex laid since `since` (a count of
        them, len(orn.placed) taken before), for a caller that holds its ornament to a region."""
        pts = self.placed[since:]
        return (Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)]))

    def _bm(self, material, smooth=False):
        key = (material.name, smooth)
        if key not in self.meshes:
            self.meshes[key] = (material, bmesh.new())
        return self.meshes[key][1]

    def fill(self, face, outline, material, top, holes=()):
        """`outline` ((a, b) mm) filled in `material`, `holes` cut out of it, its top `top` mm over
        the face and (but in the web build) its sides down to LIFT. On a curved face it is cut
        finely enough along a to follow it."""
        loops = [_orn_ccw(_orn_clean(outline))] + [_orn_ccw(_orn_clean(h))[::-1] for h in holes]
        loops = [loop for loop in loops if len(loop) >= 3]
        if not loops:
            return
        flat = [p for loop in loops for p in loop]
        tris = []
        for i, j, k in tessellate_polygon([[Vector((a, b, 0.0)) for a, b in loop] for loop in loops]):
            tri = (flat[i], flat[j], flat[k])
            tris.append(tri if _orn_area(list(tri)) > 0 else (tri[0], tri[2], tri[1]))
        step = face.step(flat)
        lines = []
        if step:
            # Cut into strips across a, each at most `step` wide, so that the flat pieces follow the
            # face's bend (round a tube, round a wall's corner).
            lo, hi = min(p[0] for p in flat), max(p[0] for p in flat)
            n = max(1, int(math.ceil((hi - lo) / step)))
            lines = [lo + (hi - lo) * k / n for k in range(1, n)]
            bounds = [lo - 1.0] + lines + [hi + 1.0]
            cut = []
            for tri in tris:
                for a0, a1 in zip(bounds, bounds[1:]):
                    if a1 <= min(p[0] for p in tri) or a0 >= max(p[0] for p in tri):
                        continue
                    poly = _orn_clip(_orn_clip(list(tri), a0, 1.0), a1, -1.0)
                    cut += [(poly[0], poly[i], poly[i + 1]) for i in range(1, len(poly) - 1)]
            tris = cut
        bm = self._bm(material)
        made = {}

        def vert(p, h):
            key = (round(p[0], 5), round(p[1], 5), h)
            if key not in made:
                made[key] = self._vert(bm, face.at(p[0], p[1], h), h)
            return made[key]
        for tri in tris:
            if abs(_orn_area(list(tri))) > 1e-9:
                bm.faces.new([vert(p, top) for p in tri])
        if WEB:
            return
        for loop in loops:
            ring = []
            for p, q in zip(loop, loop[1:] + loop[:1]):
                ring.append(p)
                crossed = [a for a in lines if min(p[0], q[0]) < a < max(p[0], q[0])]
                ring += [_orn_cross(p, q, a) for a in sorted(crossed, reverse=q[0] < p[0])]
            for p, q in zip(ring, ring[1:] + ring[:1]):
                bm.faces.new((vert(p, LIFT), vert(q, LIFT), vert(q, top), vert(p, top)))

    def strip(self, face, path, width, material, top, closed=False, caps=True):
        """A wire `width` mm wide along `path` ((a, b) mm), its top `top` mm over the face, mitred
        at its bends (closed: round an outline) and (but in the web build) its sides and ends down
        to LIFT."""
        pts = _orn_clean(path, closed)
        if len(pts) < 2:
            return
        step = face.step(pts)
        if step:
            pts = _orn_resample(pts, step, closed)
        left, right = _orn_offset(pts, width / 2, closed), _orn_offset(pts, -width / 2, closed)
        bm = self._bm(material)

        def row(side, h):
            return [self._vert(bm, face.at(a, b, h), h) for a, b in side]
        lt, rt = row(left, top), row(right, top)
        n = len(pts)
        spans = range(n if closed else n - 1)
        for i in spans:
            j = (i + 1) % n
            bm.faces.new((rt[i], rt[j], lt[j], lt[i]))
        if WEB:
            return
        lb, rb = row(left, LIFT), row(right, LIFT)
        for i in spans:
            j = (i + 1) % n
            bm.faces.new((rb[i], rb[j], rt[j], rt[i]))
            bm.faces.new((lb[j], lb[i], lt[i], lt[j]))
        if not closed and caps:
            bm.faces.new((lb[0], rb[0], rt[0], lt[0]))
            bm.faces.new((rb[-1], lb[-1], lt[-1], rt[-1]))

    def bead(self, face, a, b, r, material, top=PROUD):
        """A bead of radius r mm at (a, b): a flattened sphere's cap, its top `top` mm off the face
        (PROUD; at most r), its centre r - top under it, the cap carried on BEAD_FOOT under the
        face, smooth-shaded."""
        p, right, up, n = _orn_frame(face, a, b)
        hc = top - r                                        # the centre's height over the face
        lowest = math.acos(max(-1.0, min(1.0, (-BEAD_FOOT - hc) / r)))
        around, rings = _orn_n(16, 5), _orn_n(5, 2)
        bm = self._bm(material, smooth=True)
        pole = self._vert(bm, p + n * top, top)
        prev = None
        for k in range(1, rings + 1):
            phi = lowest * k / rings
            h = hc + r * math.cos(phi)
            ring = [self._vert(bm, p + (right * math.cos(t) + up * math.sin(t)) * (r * math.sin(phi)) + n * h, h)
                    for t in (2.0 * math.pi * i / around for i in range(around))]
            for i in range(around):
                j = (i + 1) % around
                bm.faces.new((pole, ring[i], ring[j]) if prev is None else (prev[i], ring[i], ring[j], prev[j]))
            prev = ring

    def done(self):
        """The meshes, one per material (`<name>_<material>`, the beads' `<name>_<material>_beads`),
        hanging from the parent."""
        made = []
        for (name, smooth), (material, bm) in self.meshes.items():
            if not bm.verts:
                bm.free()
                continue
            made.append(from_bm("%s_%s%s" % (self.name, name, "_beads" if smooth else ""), bm, [material],
                                smooth=smooth, parent=self.parent))
        self.meshes = {}
        return made


class Pen:
    """A motif's own frame on a face: local (u, v) mm round its origin, v its up, mirrored across v
    when `flip`, turned `turn` radians counter-clockwise as one sees the face, at `at` (a, b); its
    cells start on `layer`."""

    def __init__(self, orn, face, at, turn=0.0, flip=False, layer=GROUND):
        self.orn, self.face = orn, face
        self.a0, self.b0 = at
        self.c, self.s = math.cos(turn), math.sin(turn)
        self.m = -1.0 if flip else 1.0
        self.layer = layer

    def p(self, u, v):
        u *= self.m
        return (self.a0 + u * self.c - v * self.s, self.b0 + u * self.s + v * self.c)

    def heights(self, up):
        return LAYERS[min(self.layer + up, len(LAYERS) - 1)]

    def cell(self, local, colour, wire, up=0, holes=()):
        """An enamel cell: `local` filled in enamel_<colour> (less `holes`), outlined in wire, `up`
        layers over the motif's own."""
        enamel, top = self.heights(up)
        pts = [self.p(u, v) for u, v in local]
        holes = [[self.p(u, v) for u, v in h] for h in holes]
        self.orn.fill(self.face, pts, M["enamel_" + colour], enamel, holes)
        for loop in [pts] + holes:
            self.orn.strip(self.face, loop, WIRE_W, wire, top, closed=True)

    def ring(self, inner, outer, n, th0, span, steps, colours, wire, outer_wire=True, inner_wire=True):
        """n cells side by side between two edges (functions of the angle) from th0 over `span`
        radians (2 pi: all the way round), filled in `colours` in turn, their wires drawn once each:
        the outer edge, the inner edge (unless another ring's or a heart's outline draws it) and the
        dividers between them."""
        enamel, top = self.heights(0)
        full = abs(span - 2.0 * math.pi) < 1e-9
        for k in range(n):
            a = th0 + span * k / n
            cell = _orn_ring_cell(inner, outer, a, a + span / n, steps)
            self.orn.fill(self.face, [self.p(u, v) for u, v in cell], M["enamel_" + colours[k % len(colours)]], enamel)

        def edge(fn):
            m = n * steps
            ths = [th0 + span * i / m for i in range(m if full else m + 1)]
            return [self.p(fn(t) * math.cos(t), fn(t) * math.sin(t)) for t in ths]
        for fn, wanted in ((outer, outer_wire), (inner, inner_wire)):
            if wanted:
                self.orn.strip(self.face, edge(fn), WIRE_W, wire, top, closed=full)
        for k in range(n if full else n + 1):
            t = th0 + span * k / n
            c, s = math.cos(t), math.sin(t)
            self.orn.strip(self.face, [self.p(inner(t) * c, inner(t) * s), self.p(outer(t) * c, outer(t) * s)],
                           WIRE_W, wire, top)

    def wire(self, local, wire, width=STEM_W, top=STEM, closed=False, up=None):
        """A wire along `local`: at STEM, or `up` layers over the motif's own (a midrib, a vein)."""
        if up is not None:
            top = self.heights(up)[1]
        self.orn.strip(self.face, [self.p(u, v) for u, v in local], width, wire, top, closed=closed)

    def dot(self, u, v, r, wire, top=STEM):
        """A small round of wire (a stamen, a scroll's end), r mm in radius."""
        self.orn.fill(self.face, [self.p(u + r * math.cos(t), v + r * math.sin(t))
                                  for t in (2.0 * math.pi * i / _orn_n(12, 6) for i in range(_orn_n(12, 6)))],
                      wire, top)


# ------------------------------------------------------------------ shapes (local mm)
def _orn_scallop(peak, edge, n, phase, notch=0.0):
    """A ring's scalloped edge as a function of the angle: rounded lobes reaching `peak`, meeting
    at `edge`, n of them to a full turn (any number: a lobe spans 2 pi / n), the first starting at
    `phase`; `notch` dents each lobe's middle (a heart's)."""
    span = 2.0 * math.pi / n

    def radius(th):
        t = ((th - phase) / span) % 1.0
        x = 2.0 * t - 1.0
        r = edge + (peak - edge) * math.sqrt(max(0.0, 1.0 - x * x))
        return r - notch * (peak - edge) * max(0.0, 1.0 - abs(x) / 0.22)
    return radius


def _orn_ring_cell(inner, outer, th0, th1, steps):
    """The cell between two edges (functions of the angle) from th0 to th1: its outer edge
    counter-clockwise, its inner edge back."""
    ths = [th0 + (th1 - th0) * i / steps for i in range(steps + 1)]
    return ([(outer(t) * math.cos(t), outer(t) * math.sin(t)) for t in ths]
            + [(inner(t) * math.cos(t), inner(t) * math.sin(t)) for t in reversed(ths)])


def _orn_circle(r, n, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(2.0 * math.pi * i / n), cy + r * math.sin(2.0 * math.pi * i / n)) for i in range(n)]


def _orn_lens(length, width, n, bend=0.0, start=0.0):
    """A leaf's outline from its base (0, start) to its tip (bend x length to its right, start +
    length up): its right side up, its left side back."""
    right, left = [], []
    for i in range(n + 1):
        s = i / n
        w = 0.5 * width * math.sin(math.pi * s) ** 0.8 * (1.0 - 0.25 * s)
        x, y = bend * length * s * s, start + length * s
        right.append((x + w, y))
        left.append((x - w, y))
    return right + left[-2:0:-1]


def _orn_scroll_path(main, volute, n, s_curve=False, volute_end=None):
    """A scroll's centreline, one unit long, from integrating its curvature: `main` radians of turn
    along it and `volute` more curled into each end (an S turns the other way in its first half);
    `volute_end` (0 or 1) curls one end only (a tendril)."""
    th, x, y = 0.0, 0.0, 0.0
    pts = [(0.0, 0.0)]
    for i in range(n):
        t = (i + 0.5) / n
        if volute_end is None:
            k = main + 10.0 * volute * abs(2.0 * t - 1.0) ** 4
        else:
            far = t if volute_end == 1 else 1.0 - t
            k = main + 5.0 * volute * far ** 4
        if s_curve and t < 0.5:
            k = -k
        th += k / n
        x += math.cos(th) / n
        y += math.sin(th) / n
        pts.append((x, y))
    return pts


def _orn_thin(pts, turn=math.radians(24.0)):
    """A dense, evenly spaced path kept at the points that _orn_pts' spacing asks for, and wherever
    it has turned `turn` since the last kept one (a scroll's tight curls)."""
    longest = 1.8 if WEB else 0.5
    out, run, bend = [pts[0]], 0.0, 0.0
    for i in range(1, len(pts) - 1):
        run += math.dist(pts[i - 1], pts[i])
        a0 = math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
        a1 = math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])
        bend += abs((a1 - a0 + math.pi) % (2.0 * math.pi) - math.pi)
        if run >= longest or bend >= turn:
            out.append(pts[i])
            run, bend = 0.0, 0.0
    out.append(pts[-1])
    return out


def _orn_fit(pts, along, size):
    """Points turned so that their first-to-last chord runs along `along` ((1, 0) or (0, 1)),
    centred on their bounds and scaled so that the bounds measure `size` that way."""
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    ang = math.atan2(along[1], along[0]) - math.atan2(y1 - y0, x1 - x0)
    c, s = math.cos(ang), math.sin(ang)
    turned = [(x * c - y * s, x * s + y * c) for x, y in pts]
    us, vs = [p[0] for p in turned], [p[1] for p in turned]
    span = (max(us) - min(us)) if along[0] else (max(vs) - min(vs))
    k = size / span
    cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
    return [((u - cu) * k, (v - cv) * k) for u, v in turned]


# ------------------------------------------------------------------ the motifs
def camellia(orn, face, at, r, wire, turn=0.0, flip=False, layer=BLOOM, colours=("rose", "coral"), heart="butter"):
    """A camellia r mm in radius: seven broad rounded petals (colours[0]) round five
    (colours[1]), cells side by side, and its heart raised a layer, dotted with six stamens."""
    pen = Pen(orn, face, at, turn, flip, layer)
    rh = 0.27 * r
    inner = _orn_scallop(0.64 * r, 0.5 * r, 5, math.pi / 2 - math.pi / 5)
    outer = _orn_scallop(r, 0.83 * r, 7, math.pi / 2 - math.pi / 7)
    steps, inner_steps = _orn_pts(2.0 * math.pi * r / 7), _orn_pts(2.0 * math.pi * 0.64 * r / 5)
    pen.ring(inner, outer, 7, math.pi / 2 - math.pi / 7, 2.0 * math.pi, steps, colours[:1], wire)
    pen.ring(lambda t: rh, inner, 5, math.pi / 2 - math.pi / 5, 2.0 * math.pi, inner_steps, colours[1:], wire,
             outer_wire=False, inner_wire=False)
    pen.cell(_orn_circle(rh, _orn_pts(2.0 * math.pi * rh, 6)), heart, wire, up=1)
    for k in range(6):
        t = 2.0 * math.pi * (k + 0.5) / 6
        pen.dot(0.55 * rh * math.cos(t), 0.55 * rh * math.sin(t), max(0.22, 0.09 * rh), wire)


def daisy(orn, face, at, r, wire, turn=0.0, flip=False, layer=BLOOM, petals=10, colour="ivory", heart="butter"):
    """A daisy r mm in radius: `petals` narrow petals (colour) apart from each other round a raised
    heart, a dot of wire at its middle."""
    pen = Pen(orn, face, at, turn, flip, layer)
    rh = 0.3 * r
    half = min(0.5 * (r - 0.26 * r) * 0.5, math.pi * 0.62 * r / petals * 0.62)
    n = _orn_pts(2.2 * r, 6)
    for k in range(petals):
        t = math.pi / 2 + 2.0 * math.pi * k / petals
        c, s = math.cos(t), math.sin(t)
        mid, semi = (0.26 * r + r) / 2, (r - 0.26 * r) / 2
        pts = []
        for i in range(n):
            e = 2.0 * math.pi * i / n
            x, y = mid + semi * math.cos(e), half * math.sin(e) * (0.75 + 0.25 * math.cos(e))
            pts.append((x * c - y * s, x * s + y * c))
        pen.cell(pts, colour, wire)
    pen.cell(_orn_circle(rh, _orn_pts(2.0 * math.pi * rh, 6)), heart, wire, up=1)
    pen.dot(0.0, 0.0, max(0.25, 0.12 * rh), wire)


def rose(orn, face, at, r, wire, turn=0.0, flip=False, layer=BLOOM, colours=("rose", "coral"), heart="butter",
         sepals="leaf"):
    """A five-petal rose r mm in radius: five heart-shaped petals (colours[0]) round five
    (colours[1]), a raised heart, and (over a layer of its own) green sepal tips between the outer
    petals, under them."""
    pen = Pen(orn, face, at, turn, flip, layer)
    rh = 0.24 * r
    first = math.pi / 2 - math.pi / 5                      # a petal points up
    inner = _orn_scallop(0.6 * r, 0.44 * r, 5, first + math.pi / 5)
    outer = _orn_scallop(r, 0.76 * r, 5, first, notch=0.3)
    steps = _orn_pts(2.0 * math.pi * r / 5, 4)
    if layer > GROUND and sepals:
        under = Pen(orn, face, at, turn, flip, layer - 1)
        for k in range(5):
            t = first + 2.0 * math.pi * k / 5
            c, s = math.cos(t), math.sin(t)
            tip = [(0.62 * r, -0.16 * r), (1.08 * r, 0.0), (0.62 * r, 0.16 * r)]
            under.cell([(x * c - y * s, x * s + y * c) for x, y in tip], sepals, wire)
    pen.ring(inner, outer, 5, first, 2.0 * math.pi, steps, colours[:1], wire)
    pen.ring(lambda t: rh, inner, 5, first + math.pi / 5, 2.0 * math.pi, steps, colours[1:], wire, outer_wire=False,
             inner_wire=False)
    pen.cell(_orn_circle(rh, _orn_pts(2.0 * math.pi * rh, 6)), heart, wire, up=1)


def leaf(orn, face, at, length, wire, turn=0.0, flip=False, layer=GROUND, width=0.4, bend=0.12, colour="leaf"):
    """A leaf from its base at `at` toward `turn`, `length` mm long and `width` of that across,
    bending to its right by `bend` of its length: an enamel cell and its midrib."""
    pen = Pen(orn, face, at, turn, flip, layer)
    n = _orn_pts(length, 3)
    pen.cell(_orn_lens(length, width * length, n, bend), colour, wire)
    pen.wire([(bend * length * s * s, length * s) for s in (0.08, 0.3, 0.55, 0.8)], wire, WIRE_W * 0.8, up=0)


def spray(orn, face, at, length, wire, turn=0.0, flip=False, layer=GROUND, leaves=5, bend=0.3, colour="leaf",
          berries="sky"):
    """A leaf spray from `at` toward `turn`, `length` mm long: its stem in wire curving to its right
    by `bend` of its length, `leaves` leaves alternating along it (smaller toward its tip) and one
    at its tip, and (unless berries is None) three berries on short twigs."""
    pen = Pen(orn, face, at, turn, flip, layer)

    def stem(s):
        return (bend * length * s * s, length * s)

    def heading(s):
        return math.atan2(length, 2.0 * bend * length * s)   # the stem's direction, from +u
    n = _orn_pts(length, 4)
    pen.wire([stem(i / n) for i in range(n + 1)], wire)
    for k in range(leaves):
        s = 0.22 + 0.62 * k / max(1, leaves - 1)
        side = 1 if k % 2 == 0 else -1
        d = heading(s) - side * math.radians(48.0)
        u, v = stem(s)
        size = 0.34 * length * (1.0 - 0.35 * s)
        leaf(orn, face, pen.p(u, v), size, wire, turn=_orn_turn(pen, d), flip=(side < 0) != flip, layer=layer,
             colour=colour)
    u, v = stem(1.0)
    leaf(orn, face, pen.p(u, v), 0.3 * length, wire, turn=_orn_turn(pen, heading(1.0)), flip=flip, layer=layer,
         colour=colour)
    if berries:
        for k, s in enumerate((0.34, 0.58, 0.8)):
            side = -1 if k % 2 == 0 else 1
            d = heading(s) - side * math.radians(70.0)
            u, v = stem(s)
            tip = (u + 0.12 * length * math.cos(d), v + 0.12 * length * math.sin(d))
            pen.wire([(u, v), tip], wire, WIRE_W)
            pen.cell(_orn_circle(0.05 * length, _orn_pts(0.32 * length, 6), *tip), berries, wire, up=1)


def _orn_turn(pen, direction):
    """The `turn` (on the face) of a motif drawn inside `pen` pointing `direction` (radians from
    the pen's +u, in its own frame)."""
    du, dv = math.cos(direction) * pen.m, math.sin(direction)
    return math.atan2(du * pen.s + dv * pen.c, du * pen.c - dv * pen.s) - math.pi / 2


def acanthus(orn, face, at, length, wire, turn=0.0, flip=False, layer=GROUND, lobes=3, curl=0.3,
             colours=("leaf", "sky")):
    """An acanthus leaf from its base at `at` toward `turn`, `length` mm long, curling to its right
    by `curl` of its length: `lobes` pointed lobes along each side (the left's a little behind the
    right's), a lens of colours[1] along its middle and the midrib through it."""
    pen = Pen(orn, face, at, turn, flip, layer)
    n = _orn_pts(1.5 * length, 16)
    width = 0.44 * length

    def mid(s):
        return (curl * length * s ** 2.2, length * s)

    def normal(s):
        e = 1e-4
        (u0, v0), (u1, v1) = mid(max(s - e, 0.0)), mid(min(s + e, 1.0))
        d = math.hypot(u1 - u0, v1 - v0)
        return ((v1 - v0) / d, -(u1 - u0) / d)              # to the right

    def half(s, shift):
        env = 0.5 * width * math.sin(math.pi * min(1.0, s) ** 0.85) ** 0.9
        if s < 0.08:
            return env * 0.5
        f = ((s - 0.08) / 0.92 * lobes + shift) % 1.0
        return env * (0.42 + 0.58 * f ** 1.7)

    right, left = [], []
    for i in range(n + 1):
        s = i / n
        (u, v), (nu, nv) = mid(s), normal(s)
        wr, wl = half(s, 0.0), half(s, 0.35)
        right.append((u + nu * wr, v + nv * wr))
        left.append((u - nu * wl, v - nv * wl))
    outline = right + left[-2:0:-1]
    lens_r, lens_l = [], []
    m = _orn_pts(0.62 * length, 6)
    for i in range(m + 1):
        s = 0.14 + 0.62 * i / m
        (u, v), (nu, nv) = mid(s), normal(s)
        w = 0.13 * width * math.sin(math.pi * i / m) ** 0.9
        lens_r.append((u + nu * w, v + nv * w))
        lens_l.append((u - nu * w, v - nv * w))
    lens = lens_r + lens_l[-2:0:-1]
    pen.cell(outline, colours[0], wire, holes=[lens])
    pen.cell(lens, colours[1], wire)
    pen.wire([mid(0.16 + 0.6 * i / 6) for i in range(7)], wire, WIRE_W * 0.8, up=0)


def c_scroll(orn, face, at, size, wire, turn=0.0, flip=False, layer=GROUND, width=STEM_W, main=math.pi,
             volute=1.4 * math.pi):
    """A C-scroll of wire `size` mm tall, its chord upright, bulging to its left and opening to its
    right, both ends curled in (`volute` radians each), a round of wire at each end."""
    pen = Pen(orn, face, at, turn, flip, layer)
    pts = _orn_fit(_orn_scroll_path(main, volute, 400), (0.0, 1.0), size)
    if sum(u for u, _ in pts) > 0:
        pts = [(-u, v) for u, v in pts]
    pts = _orn_thin(pts)
    pen.wire(pts, wire, width)
    for u, v in (pts[0], pts[-1]):
        pen.dot(u, v, 0.7 * width, wire)


def s_scroll(orn, face, at, size, wire, turn=0.0, flip=False, layer=GROUND, width=STEM_W, main=0.9 * math.pi,
             volute=1.3 * math.pi):
    """An S-scroll of wire `size` mm long, lying along its u, its ends curled opposite ways."""
    pen = Pen(orn, face, at, turn, flip, layer)
    pts = _orn_thin(_orn_fit(_orn_scroll_path(main, volute, 400, s_curve=True), (1.0, 0.0), size))
    pen.wire(pts, wire, width)
    for u, v in (pts[0], pts[-1]):
        pen.dot(u, v, 0.7 * width, wire)


def rocaille(orn, face, at, r, wire, turn=0.0, flip=False, layer=GROUND, ribs=7, spread=1.2,
             colours=("ivory", "sky"), hinge="butter"):
    """A rocaille shell r mm in radius: `ribs` cells fanning from its hinge at `at` toward `turn`
    over twice `spread` radians, alternating colours, its rim scalloped, and its hinge."""
    pen = Pen(orn, face, at, turn, flip, layer)
    rh = 0.24 * r
    span = 2.0 * spread / ribs
    rim = _orn_scallop(r, 0.84 * r, 2.0 * math.pi / span, math.pi / 2 - spread)   # a lobe to each cell
    steps = _orn_pts(2.0 * spread * r / ribs)
    pen.ring(lambda t: rh, rim, ribs, math.pi / 2 - spread, 2.0 * spread, steps, colours, wire, inner_wire=False)
    fan = [(rh * math.cos(math.pi / 2 - spread + 2.0 * spread * i / steps),
            rh * math.sin(math.pi / 2 - spread + 2.0 * spread * i / steps)) for i in range(steps + 1)]
    pen.cell(fan + [(0.0, -0.25 * rh)], hinge, wire)


MOTIFS = {"camellia": camellia, "daisy": daisy, "rose": rose, "leaf": leaf, "spray": spray, "acanthus": acanthus,
          "c_scroll": c_scroll, "s_scroll": s_scroll, "rocaille": rocaille}


def pearl_row(orn, face, path, wire, radius=1.4, pitch=6.0, loop=False, skip=None):
    """Beads `radius` mm round every `pitch` mm along `path` ((a, b) mm). With `loop` the path runs
    once round the face (a wall's outline, a drum) back to its start, and the beads share its length
    evenly; else they are centred on it. skip(a, b) True leaves a bead out (where a rose sits).
    Returns the beads' (a, b)."""
    walk = _OrnPath(path)
    if loop:
        count = max(1, int(round(walk.length / pitch)))
        stations = [walk.length * k / count for k in range(count)]
    else:
        count = int(walk.length // pitch) + 1
        first = (walk.length - (count - 1) * pitch) / 2
        stations = [first + pitch * k for k in range(count)]
    placed = []
    for s in stations:
        (a, b), _ = walk.point_at(s)
        if skip is not None and skip(a, b):
            continue
        orn.bead(face, a, b, radius, wire)
        placed.append((a, b))
    return placed


def vine(orn, face, path, wire, every=25.0, leaf_len=7.0, flowers=(), tendrils=True, layer=GROUND, colour="leaf",
         width=STEM_W, leaf_width=0.42, leaf_angle=50.0, smooth=True):
    """A vine along `path` ((a, b) mm; smoothed through its points unless `smooth` is False): its
    stem in wire, a leaf every `every` mm along it, alternating sides and pointing `leaf_angle`
    degrees ahead, a tendril curling off the other side of every other one, and `flowers`, each
    (along, motif, size[, keywords]): that motif (a function or its name) centred on the stem
    `along` mm from its start, the stem stopping inside its petals and no leaf rooted under it (a
    leaf rooted just outside it tucks under it)."""
    pts = smooth_path(path, 6) if smooth and len(path) > 2 else list(path)
    walk = _OrnPath(pts)
    blooms = []
    for item in flowers:
        along, motif, size = item[:3]
        (a, b), _ = walk.point_at(along)
        blooms.append((along, (a, b), size, motif, item[3] if len(item) > 3 else {}))
    # The stem in runs between the flowers, each stopping just inside a flower's petals.
    cuts = sorted((along - 0.8 * size, along + 0.8 * size) for along, _, size, _, _ in blooms)
    s, runs = 0.0, []
    for lo, hi in cuts + [(walk.length, walk.length)]:
        if lo > s:
            runs.append((s, lo))
        s = max(s, hi)
    step = _orn_n(1.0, 2.5)
    for s0, s1 in runs:
        k = max(1, int(math.ceil((s1 - s0) / step)))
        Pen(orn, face, (0.0, 0.0), layer=layer).wire([walk.point_at(s0 + (s1 - s0) * i / k)[0] for i in range(k + 1)],
                                                      wire, width)
    count = int(walk.length / every)
    for k in range(count):
        s = every * (k + 0.5)
        if any(abs(s - along) < size for along, _, size, _, _ in blooms):
            continue
        (a, b), (ta, tb) = walk.point_at(s)
        side = 1 if k % 2 == 0 else -1
        heading = math.atan2(tb, ta) + side * math.radians(leaf_angle)
        leaf(orn, face, (a, b), leaf_len, wire, turn=heading - math.pi / 2, flip=side > 0, layer=layer,
             width=leaf_width, colour=colour)
        if tendrils and k % 2 == 1:
            curl = _orn_thin(_orn_fit(_orn_scroll_path(0.4 * math.pi, 1.6 * math.pi, 200, volute_end=1),
                                      (1.0, 0.0), 0.8 * leaf_len))
            curl = [(u - curl[0][0], v - curl[0][1]) for u, v in curl]
            out = math.atan2(tb, ta) - side * math.radians(40.0)
            c, sn = math.cos(out), math.sin(out)
            m = -1.0 if side > 0 else 1.0
            Pen(orn, face, (0.0, 0.0), layer=layer).wire(
                [(a + u * c - m * v * sn, b + u * sn + m * v * c) for u, v in curl], wire, WIRE_W)
    for _, at, size, motif, opts in blooms:
        (MOTIFS[motif] if isinstance(motif, str) else motif)(orn, face, at, size, wire, **opts)


def vine_round(orn, tube, wire, b0, b1, turns=3.0, window=None, a0=0.0, **kw):
    """A vine up a Tube from b0 to b1 mm along it, from a0 round it: `turns` times round it (a
    helix), or, given `window` (a_lo, a_hi) mm round it, `turns` times from side to side within it
    (where a full turn would meet something: a ledge's leg, which a sleeve leans on). The rest is
    vine()'s."""
    n = max(8, int(abs(b1 - b0) / _orn_n(1.5, 3.0)))
    pts = []
    for i in range(n + 1):
        t = i / n
        if window is None:
            a = a0 + tube.round * turns * t
        else:
            lo, hi = window
            a = (lo + hi) / 2 + (hi - lo) / 2 * math.sin(2.0 * math.pi * turns * t)
        pts.append((a, b0 + (b1 - b0) * t))
    vine(orn, tube, pts, wire, smooth=False, **kw)


def garland(orn, tube, b, wire, flowers=("camellia", "daisy", "rose"), count=6, size=4.0, wave=1.5, leaf_len=None,
            **kw):
    """A garland all the way round a Tube at height b mm along it: a vine rising and falling `wave`
    mm between `count` flowers evenly round it (the motifs `flowers` names, in turn, `size` mm in
    radius), a leaf either side of each. The rest is vine()'s."""
    n = max(24, int(tube.round / _orn_n(1.0, 2.0)))
    pts = [(tube.round * i / n, b + wave * math.sin(2.0 * math.pi * 2 * count * i / n)) for i in range(n + 1)]
    gap = tube.round / count
    walk = _OrnPath(pts)
    blooms = []
    for k in range(count):
        along = gap * (k + 0.5)
        blooms.append((along * walk.length / tube.round, flowers[k % len(flowers)], size))
    vine(orn, tube, pts, wire, every=walk.length / (2 * count), leaf_len=leaf_len or 1.3 * size, flowers=blooms,
         smooth=False, **kw)


def lay(orn, face, items, wire):
    """Lays a 2D layout on `face`: each item (motif, (a, b), size[, keywords]), the motif a function
    above or its name in MOTIFS, its keywords that motif's (turn, flip, layer, colours ...)."""
    for item in items:
        motif, at, size = item[:3]
        opts = item[3] if len(item) > 3 else {}
        (MOTIFS[motif] if isinstance(motif, str) else motif)(orn, face, at, size, wire, **opts)


def mirror(items):
    """The layout's mirror image across a = 0: each item with its a negated, its turn negated and
    its flip toggled."""
    out = []
    for motif, at, size, *rest in items:
        opts = dict(rest[0]) if rest else {}
        opts["turn"] = -opts.get("turn", 0.0)
        opts["flip"] = not opts.get("flip", False)
        out.append((motif, (-at[0], at[1]), size, opts))
    return out


def mirrored(items):
    """The layout and its mirror image across a = 0 (a symmetric face's two halves from one)."""
    return list(items) + mirror(items)

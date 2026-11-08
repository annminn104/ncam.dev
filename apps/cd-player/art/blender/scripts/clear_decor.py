"""The Clear model's decorations, each a `Relief` (shapes drawn in a face's own frame, merged into
one mesh): frosted circuit-maze etching on the shell's sides and top (clear_etch), a gold Đông Sơn
ring round the door (clear_dongson_ring) and hatched lozenge chains in relief on the plinth's front
and the keys' deck (clear_grooves). make_clear_player (clear.py) adds all three.

Exec'd after cdkit.py, parts.py and clear.py, into the same namespace: it reads clear.py's
dimensions (the body's, the plinth's, the door's DOOR_Z, the keys' deck round KEY_Y and its DECK_*,
the handle's, the knob's and the tag's cord, which the etching keeps off), its paths on a face
(offset_path, clip_segment, _ccw, _point_segment) and the materials build_clear_materials makes
(M: etch, gold, clear_frame).
"""
import math
import random

import bmesh
from mathutils import Vector

# ------------------------------------------------------------------ the decorations
ETCH_PROUD = 0.05                   # mm: the frosted etching off the shell's outer face
ETCH_LINE, ETCH_PAD = 0.45, 0.65     # mm: its lines' width, its pads' radius
ETCH_CLEAR = 2.0                     # mm it keeps off the deck, the handle's mounts, the knob and every bevel
RING_PROUD = 0.25                    # mm: the Đông Sơn ring's gold off the front plate
# Its edges: 0.3 mm off the bezel's rim, and inside the right speaker's basket rim, which the hero
# camera sees from r 82.78 on (over the plate, just right of the door's pull).
RING_IN, RING_OUT = 75.3, 82.6
# Where the ring opens, degrees counter-clockwise from the door's right as the viewer sees it: round
# the hinge, and under the door, where the hero and the inside cameras see the LCD's frame.
RING_OPEN = ((162.0, 198.0), (235.0, 287.0))
# Its bands from the inside out, radii in mm: a line along its inner edge (RING_LINES), a chain of
# tangent circles (CHAINS: its centre line, its circles' radius, their line's width), the ladder
# (LADDER: its inner rail's edges, its outer rail's; its rungs RUNG_W wide every RUNG_PITCH), the
# birds round BIRD_R, a second chain a little smaller, a line along its outer edge.
RING_LINES = ((RING_IN, RING_IN + 0.4), (RING_OUT - 0.4, RING_OUT))
CHAINS = ((76.47, 0.65, 0.3), (81.48, 0.6, 0.28))
CHAIN_PITCH = 2.0                    # a chain's circles two diameters apart: its links slant 30 degrees
LADDER = (77.24, 77.64, 78.04, 78.44)
RUNG_W, RUNG_PITCH = 0.5, 0.8
BIRD_R = 79.64                       # the birds' band runs 78.44 to 80.84
GROOVE_PROUD = 0.25                  # mm: the frame's lozenge relief


class Relief:
    """Decoration on one face (the shell's, the plinth's, the deck's), merged into one mesh: shapes
    in the face's own frame (a, b) mm, as one sees the face from outside (a to the right, b up),
    standing `h` mm proud of it; with `walls` their sides run down to the face, else each is its top
    alone. `at(a, b, h)` places a point of the frame h mm off the face, in (x, y, z) mm; a `warp`
    maps a shape drawn in other coordinates (the ring's, along its bands) onto the frame. Every
    face is turned to face out, as the page draws these materials' front faces only."""

    def __init__(self, at, h, walls=True):
        self.at, self.h, self.walls = at, h, walls
        self.bm = bmesh.new()

    def _row(self, pts, h):
        return [self.bm.verts.new(mmv(self.at(a, b, h))) for a, b in pts]

    def _sides(self, edges):
        """The walls down from the top's edges (p, q), each with the top on its left."""
        if not self.walls:
            return
        for p, q in edges:
            (tp, tq), (bp, bq) = self._row((p, q), self.h), self._row((p, q), 0.0)
            self.bm.faces.new((bp, bq, tq, tp))

    def _loop(self, loop, hole=False):
        loop = _ccw(list(loop))
        if hole:
            loop = loop[::-1]
        self._sides(zip(loop, loop[1:] + loop[:1]))

    def poly(self, outline, warp=None):
        """A filled outline, no holes, either winding."""
        pts = _ccw([warp(p) for p in outline] if warp else list(outline))
        self.bm.faces.new(self._row(pts, self.h))
        self._loop(pts)

    def disc(self, c, r, seg):
        self.poly(circle(r, seg, cx=c[0], cy=c[1]))

    def ring(self, c, ro, ri, seg):
        outer, inner = circle(ro, seg, cx=c[0], cy=c[1]), circle(ri, seg, cx=c[0], cy=c[1])
        ov, iv = self._row(outer, self.h), self._row(inner, self.h)
        for i in range(seg):
            j = (i + 1) % seg
            self.bm.faces.new((iv[i], ov[i], ov[j], iv[j]))
        self._loop(outer)
        self._loop(inner, hole=True)

    def strip(self, pts, width, closed=False, warp=None, caps=True):
        """A line `width` mm wide along the points, mitred at its bends (closed: round an outline);
        `caps` False leaves its ends' walls out, where it runs into another shape."""
        left, right = offset_path(pts, width / 2, closed), offset_path(pts, -width / 2, closed)
        if warp:
            left, right = [warp(p) for p in left], [warp(p) for p in right]
        if _area([right[0], right[1], left[1], left[0]]) < 0:    # a warp that mirrors it
            left, right = right, left
        lv, rv = self._row(left, self.h), self._row(right, self.h)
        n = len(pts)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            self.bm.faces.new((rv[i], rv[j], lv[j], lv[i]))
        if closed:
            outer, inner = (left, right) if abs(_area(left)) > abs(_area(right)) else (right, left)
            self._loop(outer)
            self._loop(inner, hole=True)
            return
        edges = list(zip(right, right[1:])) + list(zip(left[::-1], left[-2::-1]))
        if caps:
            edges += [(right[-1], left[-1]), (left[0], right[0])]
        self._sides(edges)

    def done(self, name, material, root):
        return from_bm(name, self.bm, [material], smooth=False, parent=root)


def _area(pts):
    """Twice an outline's signed area: positive when it runs counter-clockwise."""
    return sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1]))


# The etching: circuit-maze lines on the shell's sides and top.
STEPS = ((1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1))   # 45 degrees apart


def etch_maze(R, region, blocked, seed, pitch=1.0, fill=0.3):
    """Circuit-maze lines over a face's frame: walks over a `pitch` mm grid inside `region` (a0, b0,
    a1, b1), each from a random cell, going on straight and turning 45 degrees at a time, a cell
    clear of every other line, a pad at either end; `blocked(a, b)` is what they keep off. They
    stop once `fill` of the open cells are taken."""
    a0, b0, a1, b1 = (region[0] + ETCH_PAD, region[1] + ETCH_PAD, region[2] - ETCH_PAD, region[3] - ETCH_PAD)
    cells = [(i, j) for i in range(int((a1 - a0) / pitch) + 1) for j in range(int((b1 - b0) / pitch) + 1)
             if not blocked(a0 + i * pitch, b0 + j * pitch)]
    open_cells = set(cells)
    owner = {}
    rng = random.Random(seed)
    rng.shuffle(cells)

    def clear(c, head):
        """c is open, and nothing taken stands in or round it but the walk's own head."""
        if c not in open_cells:
            return False
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                n = (c[0] + di, c[1] + dj)
                if n in owner and n != head:
                    return False
        return True

    lines, taken = [], 0
    for start in cells:
        if taken >= fill * len(open_cells):
            break
        if not clear(start, None):
            continue
        k = rng.choice((0, 2, 4, 6)) if rng.random() < 0.75 else rng.choice((1, 3, 5, 7))
        path, run, want = [start], 0, rng.randint(8, 40)
        owner[start] = len(lines)
        while len(path) < want:
            turns = [(k + 1) % 8, (k + 7) % 8]
            rng.shuffle(turns)
            order = turns + [k] if run >= 3 and rng.random() < 0.2 else [k] + turns
            for d in order:
                c = (path[-1][0] + STEPS[d][0], path[-1][1] + STEPS[d][1])
                if clear(c, path[-1]):
                    break
            else:
                break                           # boxed in
            run, k = (run + 1 if d == k else 0), d
            path.append(c)
            owner[c] = len(lines)
        if len(path) < 6:
            for c in path:
                del owner[c]
            continue
        lines.append(path)
        taken += len(path)
    seg = 6 if WEB else 16
    for path in lines:
        corners = [c for i, c in enumerate(path) if i in (0, len(path) - 1) or
                   (c[0] - path[i - 1][0], c[1] - path[i - 1][1]) != (path[i + 1][0] - c[0], path[i + 1][1] - c[1])]
        pts = [(a0 + i * pitch, b0 + j * pitch) for i, j in corners]
        ends = (pts[0], pts[-1])
        # Each end stops at its pad's rim: the frosted lines are half clear, and a line drawn over
        # its pad would show through it.
        for at, nxt in ((0, 1), (-1, -2)):
            (px, pz), (qx, qz) = pts[at], pts[nxt]
            t = (ETCH_PAD - 0.04) / math.hypot(qx - px, qz - pz)
            pts[at] = (px + (qx - px) * t, pz + (qz - pz) * t)
        R.strip(pts, ETCH_LINE)
        for c in ends:
            R.disc(c, ETCH_PAD, seg)


def clear_etch(name, root):
    """Frosted circuit-maze lines (`etch`) on the shell's two side faces and its top, 0.05 mm proud
    of the band, never on the front plate, where the inside must stay readable: on the flat of each
    face, ETCH_CLEAR off its bevels, and on the top off the keys' deck, the handle's mounts, the knob
    and the tag's cord. One mesh per face, `<name>_etch_left`, `_right` and `_top`."""
    flat_y = IN_B - 0.5 - ETCH_CLEAR                       # the band's bevel at either plate
    flat_z = (Z0 + BODY_R + ETCH_CLEAR, Z1 - BODY_R - ETCH_CLEAR)
    for side, sx, seed in (("left", -1, 11), ("right", 1, 12)):
        # The frame as one sees the face from outside: a toward the viewer's right, b up.
        R = Relief(lambda a, b, h, sx=sx: (sx * (BODY_W / 2 + h), sx * a, b), ETCH_PROUD, walls=False)
        etch_maze(R, (-flat_y, flat_z[0], flat_y, flat_z[1]), lambda a, b: False, seed)
        R.done("%s_etch_%s" % (name, side), M["etch"], root)
    m = ETCH_CLEAR + ETCH_PAD                              # off each part, from a pad's middle
    cord = ((TAG_CORD_X, FRONT_Y), *CORD_ON_TOP,
            (HANDLE_X + 6.0, CORD_UPRIGHT_Y))              # clear_tag's cord where it lies on the top

    def blocked(x, y):
        if abs(x) <= DECK_W / 2 + m and abs(y - KEY_Y) <= DECK_D / 2 + m:         # the keys' deck
            return True
        if abs(abs(x) - HANDLE_X) <= HANDLE_MOUNT[0] / 2 + m and abs(y - HANDLE_Y) <= HANDLE_MOUNT[1] / 2 + m:   # the handle's mounts
            return True
        if math.hypot(x - KNOB_X, y - KNOB_Y) <= KNOB_RING + m:
            return True
        return any(_point_segment((x, y), p, q) <= 0.9 + m for p, q in zip(cord, cord[1:]))
    R = Relief(lambda a, b, h: (a, b, Z1 + h), ETCH_PROUD, walls=False)
    x1 = BODY_W / 2 - BODY_R - ETCH_CLEAR
    etch_maze(R, (-x1, -flat_y, x1, flat_y), blocked, 13)
    R.done(name + "_etch_top", M["etch"], root)


# The Đông Sơn ring round the door.
def _on_ring(r, deg):
    """The point r mm from the door's centre, deg degrees counter-clockwise from its right: (x, z)."""
    a = math.radians(deg)
    return (r * math.cos(a), DOOR_Z + r * math.sin(a))


def _polar(r_ref):
    """(u, v) mm along a band of the ring -> the front plate's (x, z): u clockwise round the circle of
    radius r_ref from the door's right, v out from it (a shape keeps its winding)."""
    def warp(p):
        a, r = -p[0] / r_ref, r_ref + p[1]
        return (r * math.cos(a), DOOR_Z + r * math.sin(a))
    return warp


# A Lạc bird, 16.2 mm long and 2.24 across its wings, in (u, v) mm along its band: flying toward -u
# (counter-clockwise round the ring), its back outward. The long beak, the crest's two plumes, the
# neck, the wings spread out and in with three feathers at each trailing edge, the tail's three
# long feathers; once round, counter-clockwise, from the beak's tip along its belly.
BIRD = ((-8.0, 0.0), (-4.95, -0.16), (-4.6, -0.3), (-3.8, -0.3), (-2.9, -0.3), (-2.0, -0.42), (-1.5, -0.45),
        (-1.0, -0.76), (-0.3, -0.99), (0.5, -1.1), (1.3, -1.12), (1.0, -0.9), (1.65, -0.88), (1.3, -0.66),
        (1.95, -0.62), (1.6, -0.45), (2.2, -0.41), (2.9, -0.36), (3.5, -0.28), (8.2, -0.74), (5.8, -0.14),
        (7.6, 0.0), (5.8, 0.14), (8.2, 0.74), (3.5, 0.28), (2.9, 0.36), (2.2, 0.41), (1.6, 0.45), (1.95, 0.62),
        (1.3, 0.66), (1.65, 0.88), (1.0, 0.9), (1.3, 1.12), (0.5, 1.1), (-0.3, 0.99), (-1.0, 0.76),
        (-1.5, 0.45), (-2.0, 0.42), (-2.9, 0.3), (-3.6, 0.33), (-2.6, 0.78), (-3.9, 0.54), (-2.3, 1.1),
        (-4.45, 0.5), (-4.8, 0.36), (-4.95, 0.16))


def _spread(spans, n, start):
    """n angles (degrees) evenly along the spans taken end to end, the first `start` degrees in."""
    total = sum(b - a for a, b in spans)
    out = []
    for k in range(n):
        s = start + total * k / n
        for a, b in spans:
            if s < b - a:
                out.append(a + s)
                break
            s -= b - a
    return out


def ring_chain(R, spans, rc, rad, line, seg):
    """A chain of tangent circles round the ring on the circle rc, after the drum's: rings of
    radius `rad` mm in a `line` mm line, each round its centre dot, CHAIN_PITCH diameters apart (as
    many to a full turn as fit), each linked to the next by the line tangent to both rims, from
    one's outer side to the other's inner side, slanting 30 degrees; at a bar the chain ends in the
    link to the circle that would stand beyond it."""
    pitch = 360.0 / round(2 * math.pi * rc / (CHAIN_PITCH * 2 * rad))
    warp = _polar(rc)

    def u(deg):
        return -math.radians(deg) * rc
    for b0, b1 in spans:
        margin = math.degrees((rad + 0.3) / rc)
        degs = [pitch * k for k in range(int(math.ceil((b0 + margin) / pitch)), int((b1 - margin) // pitch) + 1)]
        for deg in degs:
            R.ring(_on_ring(rc, deg), rad, rad - line, seg)
            R.disc(_on_ring(rc, deg), rad * 0.3, max(6, seg // 2))
        for d0, d1 in zip([degs[0] - pitch] + degs, degs + [degs[-1] + pitch]):
            u1, u2 = u(d1), u(d0)           # u runs clockwise: d1's circle comes first
            cb = 2 * rad / (u2 - u1)
            sb = math.sqrt(1.0 - cb * cb)
            t1, t2 = (u1 + rad * cb, rad * sb), (u2 - rad * cb, -rad * sb)
            lo, hi = max(t1[0], u(b1)), min(t2[0], u(b0))       # within the bars
            if hi - lo < 0.1:
                continue
            n = max(1, int(math.ceil((hi - lo) / (4.0 if WEB else 2.0))))
            pts = []
            for i in range(n + 1):
                uu = lo + (hi - lo) * i / n
                pts.append((uu, t1[1] + (t2[1] - t1[1]) * (uu - t1[0]) / (t2[0] - t1[0])))
            R.strip(pts, line, warp=warp)


def clear_dongson_ring(name, root):
    """A Đông Sơn ring round the door, after the Ngọc Lũ drum's face: gold relief 0.25 mm proud of
    the front plate from RING_IN to RING_OUT, bold enough to read as a band from the page's camera.
    From the inside out a line, a chain of tangent circles, a ladder whose rungs leave slots between
    them, eight Lạc birds flying counter-clockwise, a smaller chain and a line. It opens round the
    hinge and over the LCD (RING_OPEN), each band ending at a bar across the ring, and runs under the
    door's pull; the door swings clear of it. One mesh, `<name>_dongson_ring`; the web build leaves
    out its walls and draws its circles with fewer sides."""
    R = Relief(lambda a, b, h: (a, FRONT_Y - h, b), RING_PROUD, walls=not WEB)
    step = 2.0 if WEB else 1.0             # degrees per segment along a band
    bar = 0.45
    (h0, h1), (l0, l1) = RING_OPEN
    pad = math.degrees(bar / 2 / RING_IN)
    spans = [(a0 + pad, a1 - pad) for a0, a1 in ((h1, l0), (l1, h0 + 360.0))]   # between the bars' middles
    rail_in, rail_out = (LADDER[0] + LADDER[1]) / 2, (LADDER[2] + LADDER[3]) / 2
    for b0, b1 in spans:
        for deg in (b0, b1):
            R.strip([_on_ring(RING_IN, deg), _on_ring(RING_OUT, deg)], bar)
        for r0, r1 in RING_LINES + (LADDER[:2], LADDER[2:]):
            rc = (r0 + r1) / 2
            n = max(2, int(math.ceil((b1 - b0) / step)))
            R.strip([(-math.radians(b0 + (b1 - b0) * i / n) * rc, 0.0) for i in range(n + 1)], r1 - r0,
                    warp=_polar(rc), caps=False)
        # The ladder's rungs, about RUNG_PITCH apart, from one rail's middle to the other's.
        n = int(math.radians(b1 - b0) * (rail_in + rail_out) / 2 / RUNG_PITCH)
        for k in range(1, n):
            deg = b0 + (b1 - b0) * k / n
            R.strip([_on_ring(rail_in, deg), _on_ring(rail_out, deg)], RUNG_W, caps=False)
    for rc, rad, line in CHAINS:
        ring_chain(R, spans, rc, rad, line, 10 if WEB else 24)
    # The birds every 34 degrees along the two spans taken end to end, the first 23 degrees in: none
    # cut by an opening, none under the door's pull (at 0 degrees, 5.4 to either side).
    # The bird spans BIRD's own extent in u (beak at the least, tail at the greatest), and u grows
    # clockwise: in degrees it covers `behind` below its position and `ahead` above it.
    behind = math.degrees(max(u for u, _ in BIRD) / BIRD_R)
    ahead = math.degrees(-min(u for u, _ in BIRD) / BIRD_R)
    warp = _polar(BIRD_R)
    for deg in _spread(spans, 8, 23.0):
        at = (deg + 180.0) % 360.0 - 180.0
        clear_of_pull = at - behind > 5.4 or at + ahead < -5.4
        if not clear_of_pull or not any(b0 + 1.0 <= deg - behind and deg + ahead <= b1 - 1.0 for b0, b1 in spans):
            raise SystemExit("clear_decor.py: the Lạc bird at %.1f degrees is cut by an opening or under the pull" % deg)
        uc = -math.radians(deg) * BIRD_R
        R.poly([(uc + u, v) for u, v in BIRD], warp=warp)
    return R.done(name + "_dongson_ring", M["gold"], root)


# The frame's grooves.
def lozenges(R, x0, x1, yc, h, n, line, hatch, gap):
    """A chain of n lozenges tip to tip from x0 to x1 along b = yc, h mm tall: each outlined in `line`
    mm and hatched with `hatch` mm lines about `gap` mm apart, parallel to the side up from its left
    tip, the next one's to the side down from it."""
    w = (x1 - x0) / n
    for k in range(n):
        cx = x0 + w * (k + 0.5)
        quad = [(cx - w / 2, yc), (cx, yc - h / 2), (cx + w / 2, yc), (cx, yc + h / 2)]
        R.strip(quad, line, closed=True)
        inner = offset_path(quad, line / 2 - 0.02, closed=True)   # just under the outline's inner edge
        left = Vector(quad[0])
        d = Vector((w / 2, (h / 2) * (1 if k % 2 == 0 else -1))).normalized()
        across = Vector((d.y, -d.x)) if k % 2 == 0 else Vector((-d.y, d.x))   # into the lozenge
        span = (w * h / 2) / math.hypot(w / 2, h / 2)                  # from that side to the opposite one
        lines = max(1, int(round((span - line) / gap)))
        for i in range(lines):
            o = left + across * (line / 2 + (span - line) * (i + 0.5) / lines)
            seg = clip_segment(tuple(o - d * w), tuple(o + d * w), inner)
            if seg and math.dist(*seg) > 2 * hatch:
                R.strip(list(seg), hatch, caps=False)


def clear_grooves(name, root):
    """Lozenge chains with diagonal hatching, a Đông Sơn motif, in relief (GROOVE_PROUD) of the
    frame's own material: on the plinth's front either side of the nameplate, between two rails,
    and along the keys' deck's top in front of the keys and behind them, between the holes and the
    deck's edges. `<name>_grooves_plinth` and `<name>_grooves_deck`."""
    F = M["clear_frame"]
    face = PLINTH_Y - PLINTH_D / 2
    R = Relief(lambda a, b, h: (a, face - h, b), GROOVE_PROUD)
    zc = (FOOT_H + PLINTH_H) / 2              # the nameplate's middle
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 86.0, sx * 145.0))   # off the plate (82) and the plinth's rounded corner (147)
        for s in (-1, 1):
            R.strip([(x0, zc + s * 6.0), (x1, zc + s * 6.0)], 0.6)
        lozenges(R, x0, x1, zc, 9.0, 4, 0.5, 0.35, 1.1)
    R.done(name + "_grooves_plinth", F, root)
    # The deck (clear_keys) is DECK_D deep round KEY_Y, its holes KEY_HOLE_D, every edge bevelled 0.6: each
    # rim runs 7.7 to 12 mm off KEY_Y, its flat's middle DECK_RIM_Y (9.85) mm off it; its straight ends
    # at x = +-79.
    R = Relief(lambda a, b, h: (a, b, Z1 + 2.05 + h), GROOVE_PROUD)
    for s in (-1, 1):
        lozenges(R, -DECK_GROOVE_X, DECK_GROOVE_X, KEY_Y + s * DECK_RIM_Y, 2.2, 43, 0.28, 0.2, 0.62)
    R.done(name + "_grooves_deck", F, root)

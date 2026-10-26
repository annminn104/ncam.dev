"""The dog's corner (art/README.md, Carport and dog): an Akita sitting up, its dog house, its mat, a water and a food bowl and a ball.

The Akita is low-poly like the koi: faceted lumps (MeshBuilder.ellipsoid) and short limbs (stems) in a red-fawn coat,
the cream "urajiro" of the breed on its muzzle, cheeks, chest and paws (palette materials, so the glTF needs no vertex
colours: the export keeps only 'wind'), dark eyes and nose, pricked triangular ears and a thick tail curled over its
back (one tube swept along a smooth curve, cream inside the curl). It builds whole, or as its body, its head or its
tail alone (part=), each in the dog's own space: the kennel builds the head and the tail as objects of their own that
turn about catalog.AKITA_PIVOTS, the neck and the root of the tail, so the website can wag the tail and turn the head.
"""
import math

from ..catalog import AKITA_PIVOTS

PARTS = ("body", "head", "tail")
DOOR_SIDES = 6  # the segments of the arch over the dog house's door
# The tail's curl over the back, root first: (x, y, z) and the radius of the thick tube it is, curling forward and to
# the side until its tip lies on the back; the cream of its underside shows inside the curl near its root. The tube
# runs along a smooth curve through these points, TAIL_STEPS rings per span, TAIL_SIDES round.
TAIL = ((0.0, 0.31, 0.36, 0.06), (0.015, 0.33, 0.45, 0.07), (0.035, 0.305, 0.53, 0.072), (0.055, 0.225, 0.555, 0.066),
        (0.075, 0.15, 0.52, 0.055), (0.085, 0.13, 0.46, 0.04))
TAIL_CURL = (0.035, 0.235, 0.46)  # the middle of the curl
TAIL_STEPS, TAIL_SIDES = 2, 8


def _parts(part):
    if part is not None and part not in PARTS:
        raise ValueError(f"akita part must be one of {PARTS} or None, got {part!r}")
    return {part} if part else set(PARTS)


def _curve(points, steps):
    """`steps` samples per span of the Catmull-Rom curve through `points` (tuples of numbers, its ends held), and the
    last point: x, y, z and a radius along the tail."""
    held = [points[0]] + list(points) + [points[-1]]
    found = []
    for k in range(len(points) - 1):
        for s in range(steps):
            t = s / steps
            found.append(tuple(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                                      + (3 * b - a - 3 * c + d) * t ** 3) for a, b, c, d in zip(*held[k:k + 4])))
    return found + [tuple(points[-1])]


def _unit(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _tube(mb, mat, points, sides):
    """One tube through `points` (x, y, z, radius), `sides` round: a ring at every point square to the curve, each ring
    turned as little as it can from the last so the tube does not twist, the first ring capped flat and the last
    closed in a point a little beyond it (the tail's root sits in the rump, its tip on the back)."""
    rings, side = [], None
    for k, (x, y, z, radius) in enumerate(points):
        ahead, behind = points[min(k + 1, len(points) - 1)], points[max(k - 1, 0)]
        along = _unit([ahead[i] - behind[i] for i in range(3)])
        if side is None:  # square to the curve's start, across X unless it starts along X
            side = _cross(along, (1.0, 0.0, 0.0) if abs(along[0]) < 0.9 else (0.0, 0.0, 1.0))
        dot = sum(side[i] * along[i] for i in range(3))
        side = _unit([side[i] - along[i] * dot for i in range(3)])
        up = _cross(along, side)
        rings.append([(x + radius * (math.cos(a) * side[0] + math.sin(a) * up[0]),
                       y + radius * (math.cos(a) * side[1] + math.sin(a) * up[1]),
                       z + radius * (math.cos(a) * side[2] + math.sin(a) * up[2]))
                      for a in (2 * math.pi * j / sides for j in range(sides))])
    x, y, z, radius = points[-1]
    tip = (x + 0.9 * radius * along[0], y + 0.9 * radius * along[1], z + 0.9 * radius * along[2])
    verts = [p for ring in rings for p in ring] + [tip]
    faces = [tuple(reversed(range(sides)))]  # the root's cap, facing back along the curve
    for r in range(len(rings) - 1):
        a, b = r * sides, (r + 1) * sides
        faces += [(a + j, a + (j + 1) % sides, b + (j + 1) % sides, b + j) for j in range(sides)]
    last = (len(rings) - 1) * sides
    faces += [(last + j, last + (j + 1) % sides, len(verts) - 1) for j in range(sides)]
    mb.faces(verts, faces, mat)


def _ear(mb, m, side):
    """A pricked triangular ear standing on the skull, leaning a little out."""
    x, y, z = side * 0.07, -0.15, 0.795
    points = [(x - 0.045, y - 0.02, z), (x + 0.045, y - 0.02, z), (x, y + 0.028, z - 0.01),
              (x + side * 0.012, y + 0.005, 0.93)]
    mb.faces(points, [(0, 1, 3), (1, 2, 3), (2, 0, 3), (0, 2, 1)], m["akita_red"])


def akita(mb, m, w, d, h, part=None):
    # An Akita about 0.95 m to the tips of its ears, sitting up, nose to the front (-Y): red-fawn haunches and back, a
    # cream chest, forelegs and paws, its head on a thick neck (red skull, cream muzzle and cheeks, dark nose and eyes,
    # pricked red ears), its tail curled up over its back. ~1200 triangles.
    parts = _parts(part)
    red, cream, dark = m["akita_red"], m["akita_cream"], m["dog_dark"]
    if "body" in parts:
        mb.ellipsoid((0.0, 0.17, 0.2), (0.19, 0.21, 0.2), red)  # the haunches
        mb.stem((0.0, 0.12, 0.25), (0.0, -0.08, 0.52), 0.16, red, radius_end=0.13, segments=8)  # the back
        mb.ellipsoid((0.0, -0.07, 0.5), (0.14, 0.13, 0.12), red)  # the shoulders under the ruff of the neck
        mb.ellipsoid((0.0, -0.13, 0.4), (0.115, 0.08, 0.17), cream)  # the chest
        for side in (-1.0, 1.0):
            x = side * 0.075
            mb.stem((x, -0.11, 0.38), (x, -0.15, 0.2), 0.045, red, segments=6)  # the forelegs, cream below
            mb.stem((x, -0.15, 0.21), (x, -0.17, 0.04), 0.04, cream, segments=6)
            mb.ellipsoid((x, -0.2, 0.03), (0.045, 0.065, 0.03), cream, subdivisions=1)
            mb.ellipsoid((side * 0.12, 0.08, 0.12), (0.08, 0.15, 0.11), red)  # a thigh, folded
            mb.ellipsoid((side * 0.12, -0.02, 0.03), (0.05, 0.09, 0.03), cream, subdivisions=1)  # its foot, under it
    if "head" in parts:
        mb.ellipsoid(AKITA_PIVOTS["head"], (0.11, 0.11, 0.1), red)  # the neck the head turns on
        mb.ellipsoid((0.0, -0.17, 0.72), (0.12, 0.115, 0.1), red)  # the skull
        mb.ellipsoid((0.0, -0.29, 0.67), (0.06, 0.075, 0.05), cream)  # the muzzle
        for side in (-1.0, 1.0):
            mb.ellipsoid((side * 0.075, -0.235, 0.665), (0.05, 0.05, 0.045), cream, subdivisions=1)  # the cheeks
            mb.ellipsoid((side * 0.05, -0.268, 0.75), (0.018, 0.012, 0.014), dark, subdivisions=1)  # an eye
            _ear(mb, m, side)
        mb.ellipsoid((0.0, -0.37, 0.69), (0.022, 0.014, 0.017), dark, subdivisions=1)  # the nose
    if "tail" in parts:
        _tube(mb, red, _curve(TAIL, TAIL_STEPS), TAIL_SIDES)
        cx, cy, cz = TAIL_CURL  # the cream underside: a thinner tube along the inside of the curl, from the root up
        inside = [(x + 0.4 * (cx - x), y + 0.4 * (cy - y), z + 0.4 * (cz - z), 0.8 * radius)
                  for x, y, z, radius in TAIL[:3]]
        _tube(mb, cream, _curve(inside, TAIL_STEPS), TAIL_SIDES - 2)


def _prism_y(mb, mat, y0, y1, ring):
    """A prism along Y from y0 to y1 (y0 < y1) over `ring`, (x, z) points counter-clockwise seen from -Y: a gable, a
    roof's slope, a door's arch."""
    n = len(ring)
    points = [(x, y0, z) for x, z in ring] + [(x, y1, z) for x, z in ring]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(n + k, n + (k + 1) % n, (k + 1) % n, k) for k in range(n)]
    mb.faces(points, faces, mat)


def dog_house(mb, m, w, d, h):
    # A teak dog house on a dark plinth, its door to the front (-Y): an arched opening, a blank plate over it, a pitched
    # charcoal roof overhanging the walls.
    hw, hd = w / 2 - 0.1, d / 2 - 0.08  # the walls' half width and half depth
    wall, eave, ridge = 0.65, 0.56, h - 0.04
    mb.box((-hw - 0.05, -hd - 0.03, 0.0), (hw + 0.05, hd + 0.03, 0.06), m["frame"])
    mb.box((-hw, -hd, 0.06), (hw, hd, wall), m["teak"], uv_tile=2.0)
    _prism_y(mb, m["teak"], -hd, hd, [(-hw, wall), (hw, wall), (0.0, ridge - 0.02)])  # the gables
    for side in (-1.0, 1.0):  # the roof's two slopes, eave to ridge
        ring = [(side * w / 2, eave), (0.0, ridge), (0.0, h), (side * w / 2, eave + 0.04)]
        _prism_y(mb, m["frame"], -d / 2, d / 2, ring if side < 0 else list(reversed(ring)))
    radius, foot, spring = 0.17, 0.08, 0.38  # the door: straight jambs up to the spring of its arch
    arch = [(radius * math.cos(math.pi * k / DOOR_SIDES), spring + radius * math.sin(math.pi * k / DOOR_SIDES))
            for k in range(DOOR_SIDES + 1)]
    _prism_y(mb, m["frame"], -hd - 0.01, -hd + 0.002, [(-radius, foot), (radius, foot)] + arch)
    mb.box((-0.11, -hd - 0.012, wall + 0.04), (0.11, -hd, wall + 0.12), m["metal"])  # the name plate, blank


def dog_mat(mb, m, w, d, h):
    # A dark woven mat with rounded corners, lying flat.
    cut = 0.08
    outline = [(-w / 2 + cut, -d / 2), (w / 2 - cut, -d / 2), (w / 2, -d / 2 + cut), (w / 2, d / 2 - cut),
               (w / 2 - cut, d / 2), (-w / 2 + cut, d / 2), (-w / 2, d / 2 - cut), (-w / 2, -d / 2 + cut)]
    mb.slab(outline, 0.0, h, m["fabric_dark"])


BOWLS = ("water", "food")  # by variant


def dog_bowl(mb, m, w, d, h, variant=0):
    # A red bowl widening to its rim, filled with water (variant 0) or with kibble (variant 1).
    if not 0 <= variant < len(BOWLS):
        raise ValueError(f"dog_bowl variant must be 0..{len(BOWLS) - 1}, got {variant}")
    top = 0.065
    mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, top), 0.1, m["flower_red"], radius_end=w / 2, segments=12)
    if BOWLS[variant] == "water":
        mb.cylinder((0.0, 0.0, top), 0.11, 0.005, m["water"], segments=12)
        return
    for k in range(7):
        a = 2 * math.pi * k / 6
        reach = 0.0 if k == 6 else 0.06
        mb.ellipsoid((reach * math.cos(a), reach * math.sin(a), top + 0.005), (0.024, 0.024, 0.015), m["teak"],
                     subdivisions=1)


def dog_ball(mb, m, w, d, h):
    # A red rubber ball.
    mb.ellipsoid((0.0, 0.0, h / 2), (w / 2, d / 2, h / 2), m["flower_red"])


BUILDERS = {"akita": akita, "dog_house": dog_house, "dog_mat": dog_mat, "dog_bowl": dog_bowl, "dog_ball": dog_ball}

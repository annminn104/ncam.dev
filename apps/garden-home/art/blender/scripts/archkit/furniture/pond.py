"""Koi pond and tea corner pieces (villa v2 part 3): the round stone tea table, its drum stools and the tea set on it,
bonsai on a stone pedestal or in a glazed pot and the stone lantern of the tea corner; the lotus pads and flowers, the
koi and the rock peaks of the rockery in the pond.

Low-poly like the garden kit: faceted rocks of jittered rings stacked into a closed lump (MeshBuilder.faces), paler
facets where they face the sky; clouds of leaves as squashed lumps on a crooked trunk; leaf-blade petals; a koi of
six-sided rings with flat fins, its colours by the faces of its rings. The pond modules merge them into a few objects
(furniture.place_into, MeshBuilder.placed), one draw call per material; boulder() builds the stones along the pond's
edge and its pebbles, shrub() the small shrubs on the rockery.
"""
import math
import random

from ..catalog import LOTUS_PADS as PADS
from ..catalog import ROCK_PEAK_JITTER
from ..catalog import ROCK_PEAKS as PEAKS

LEAN_SIDES = 8  # the sides of a rock peak's rings
# A rock peak's column, (share of its height, share of its base radii) ring by ring up to its apex: wide high up, so
# that it ends in a blunt crag; and the ledges its moss grows on (shares of its height).
PEAK_COLUMN = ((0.0, 1.0), (0.22, 0.86), (0.45, 0.66), (0.68, 0.52), (0.84, 0.42), (0.95, 0.32))
PEAK_MOSS = (0.3, 0.52, 0.76)
PAD_NOTCH = math.radians(40.0)
LOTUS = ("lotus", "flower_white")  # the petals of an open flower by variant; variant 2 is a pink bud on its stem
# The koi by variant, colour keys of the faces of its body from the nose cone back (five bands): along the back, down
# the sides, under the belly, then the tail fin, the pectoral fins and the dorsal fin. o orange, w white, b black,
# g gold: an orange koi with a white belly, a kohaku (white with orange patches), black and orange, a gold ogon.
KOI_COLOURS = {"o": "koi_orange", "w": "koi_white", "b": "koi_black", "g": "koi_gold"}
KOI_PATTERNS = (
    {"back": "ooooo", "side": "ooooo", "belly": "w", "tail": "o", "fins": "o", "dorsal": "o"},
    {"back": "owoow", "side": "wwoww", "belly": "w", "tail": "w", "fins": "w", "dorsal": "o"},
    {"back": "bobob", "side": "bbobb", "belly": "w", "tail": "b", "fins": "b", "dorsal": "b"},
    {"back": "ggggg", "side": "ggggg", "belly": "g", "tail": "g", "fins": "g", "dorsal": "g"},
)
# The koi's body: rings (y, half width, half height) from just behind the nose to the narrow tail, round KOI_Z.
KOI_NOSE = -0.24
KOI_Z = 0.05
KOI_RINGS = ((-0.19, 0.035, 0.03), (-0.11, 0.055, 0.042), (-0.02, 0.058, 0.045), (0.06, 0.042, 0.034),
             (0.13, 0.018, 0.016))


def _variant(kind, variant, table):
    if not 0 <= variant < len(table):
        raise ValueError(f"{kind} variant must be 0..{len(table) - 1}, got {variant}")
    return table[variant]


def _ring(centre, z, radii, sides, rnd=None, jitter=0.0, turn=0.0):
    """`sides` points (x, y, z) round the ellipse of `radii` about `centre` (x, y) at height z, counter-clockwise from
    `turn` radians seen from above, each pulled in or pushed out by up to `jitter` of its radius."""
    (cx, cy), (rx, ry) = centre, radii
    points = []
    for k in range(sides):
        angle = turn + 2 * math.pi * k / sides
        scale = 1.0 + (rnd.uniform(-jitter, jitter) if rnd else 0.0)
        points.append((cx + rx * scale * math.cos(angle), cy + ry * scale * math.sin(angle), z))
    return points


def _stack(rings):
    """Faces (indices into the rings' points, then an apex just past them) of a closed lump: rings of one size stacked
    bottom to top, each counter-clockwise seen from above, a flat bottom and a fan up to the apex."""
    n = len(rings[0])
    faces = [tuple(reversed(range(n)))]  # the bottom, facing down
    for r in range(len(rings) - 1):
        a, b = r * n, (r + 1) * n
        faces += [(a + k, a + (k + 1) % n, b + (k + 1) % n, b + k) for k in range(n)]
    top, apex = (len(rings) - 1) * n, len(rings) * n
    return faces + [(top + k, top + (k + 1) % n, apex) for k in range(n)]


def _normal(points, face):
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = (points[i] for i in face[:3])
    return ((y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0), (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0),
            (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0))


def _shade(mb, m, points, faces):
    """Builds the faces of a rock in M_rock, every other face that looks up at the sky in the paler M_rock_light:
    weathered limestone, its tops bleached."""
    dark, light = [], []
    for face in faces:
        nx, ny, nz = _normal(points, face)
        up = nz / (math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0)
        (light if up > 0.35 and (len(dark) + len(light)) % 2 == 0 else dark).append(face)
    mb.faces(points, dark, m["rock"])
    mb.faces(points, light, m["rock_light"])


def _lump(rnd, centre, radius, height, sides, jitter=0.15):
    """Points and faces of a squashed, faceted lump standing on `centre` (x, y, z): a cloud of leaves, moss."""
    x, y, z = centre
    turn = rnd.uniform(0.0, 2 * math.pi)
    rings = [_ring((x, y), z, (radius * 0.75, radius * 0.75), sides, rnd, jitter, turn),
             _ring((x, y), z + 0.45 * height, (radius, radius), sides, rnd, jitter, turn + math.pi / sides)]
    points = [p for ring in rings for p in ring] + [(x, y, z + height)]
    return points, _stack(rings)


def boulder(mb, m, center, size, height, seed, sides=7):
    """A faceted stone about `size` across and `height` tall standing on `center` (x, y, z): the stones along the edge
    of the pond (sides=7, 40 triangles), its pebbles (sides=5) and the boulders at the foot of a rock peak. A caller
    sinks it a little into what it stands on by standing it lower."""
    rnd = random.Random(seed)
    x, y, z = center
    r = size / 2
    turn = rnd.uniform(0.0, 2 * math.pi)
    top = (x + rnd.uniform(-0.1, 0.1) * r, y + rnd.uniform(-0.1, 0.1) * r)
    rings = [_ring((x, y), z, (r * 0.85, r * 0.8), sides, rnd, 0.12, turn),
             _ring((x, y), z + 0.4 * height, (r, r * 0.92), sides, rnd, 0.18, turn),
             _ring(top, z + 0.8 * height, (r * 0.6, r * 0.55), sides, rnd, 0.2, turn)]
    apex = (top[0] + rnd.uniform(-0.1, 0.1) * r, top[1] + rnd.uniform(-0.1, 0.1) * r, z + height)
    _shade(mb, m, [p for ring in rings for p in ring] + [apex], _stack(rings))


def _cloud(mb, mat, rnd, centre, radius):
    """A cloud of clipped leaves, the bonsai way: a lump `radius` across its middle and two thirds as high, centred on
    `centre`."""
    x, y, z = centre
    points, faces = _lump(rnd, (x, y, z - 0.35 * radius), radius, 0.8 * radius, 7, jitter=0.1)
    mb.faces(points, faces, mat)


def _tree(mb, m, rnd, trunk, branches, clouds):
    """A crooked trunk through `trunk` [((x, y, z), radius), ...], branches [(start, end, radius)] and clouds of leaves
    [((x, y, z), radius)], alternately light and dark green."""
    for (a, ra), (b, rb) in zip(trunk, trunk[1:]):
        mb.stem(a, b, ra, m["bark"], radius_end=rb, segments=5)
    for a, b, radius in branches:
        mb.stem(a, b, radius, m["bark"], radius_end=radius * 0.6, segments=4)
    for k, (centre, radius) in enumerate(clouds):
        _cloud(mb, m["leaf" if k % 2 == 0 else "leaf_dark"], rnd, centre, radius)


def shrub(mb, m, base, height, seed):
    """A small wild shrub `height` tall growing from `base` (x, y, z): a crooked little trunk and two clouds of leaves,
    for the ledges of the rockery."""
    rnd = random.Random(seed)
    x, y, z = base
    lean = rnd.uniform(0.0, 2 * math.pi)
    dx, dy = math.cos(lean) * 0.25 * height, math.sin(lean) * 0.25 * height
    mid = (x + dx * 0.5, y + dy * 0.5, z + 0.5 * height)
    top = (x + dx, y + dy, z + 0.8 * height)
    _tree(mb, m, rnd, [((x, y, z), 0.035), (mid, 0.025), (top, 0.016)], [],
          [(top, 0.3 * height), ((mid[0] - dx, mid[1] - dy, mid[2] + 0.05), 0.22 * height)])


def stone_table_round(mb, m, w, d, h):
    # A round granite tea table: a top a metre across on a tapering drum and a low round foot.
    mb.cylinder((0.0, 0.0, 0.0), 0.3, 0.06, m["granite"], segments=10)
    mb.stem((0.0, 0.0, 0.06), (0.0, 0.0, h - 0.08), 0.17, m["granite"], radius_end=0.12, segments=8)
    mb.cylinder((0.0, 0.0, h - 0.08), w / 2, 0.08, m["granite"], segments=16)


def stone_stool(mb, m, w, d, h):
    # A granite drum stool, swelling at its middle, with a flat seat.
    mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, 0.22), 0.16, m["granite"], radius_end=w / 2, segments=8)
    mb.stem((0.0, 0.0, 0.22), (0.0, 0.0, h - 0.03), w / 2, m["granite"], radius_end=0.17, segments=8)
    mb.cylinder((0.0, 0.0, h - 0.03), 0.17, 0.03, m["granite"], segments=8)


def tea_set(mb, m, w, d, h):
    # A clay teapot and four white cups on a low teak tray: the pot at the left (-X), its spout towards the cups.
    mb.box((-0.2, -0.14, 0.0), (0.2, 0.14, 0.02), m["teak"])
    mb.ellipsoid((-0.09, 0.0, 0.07), (0.065, 0.065, 0.05), m["terracotta"], subdivisions=1)
    mb.cylinder((-0.09, 0.0, 0.115), 0.025, 0.015, m["terracotta"], segments=6)  # the lid
    mb.octahedron((-0.09, 0.0, 0.14), 0.012, m["terracotta"])  # its knob
    mb.stem((-0.04, 0.0, 0.06), (0.0, 0.0, 0.1), 0.012, m["terracotta"], radius_end=0.007, segments=4)  # the spout
    mb.stem((-0.15, 0.0, 0.1), (-0.175, 0.0, 0.065), 0.008, m["terracotta"], segments=4)  # the handle
    mb.stem((-0.175, 0.0, 0.065), (-0.15, 0.0, 0.035), 0.008, m["terracotta"], segments=4)
    for x in (0.06, 0.14):
        for y in (-0.07, 0.07):
            mb.cylinder((x, y, 0.02), 0.024, 0.04, m["ceramic"], segments=8)


# The bonsai by variant: the trunk [((x, y, z), radius)], its branches [(start, end, radius)] and its clouds of leaves
# [((x, y, z), radius)]: an informal upright on a granite pedestal, a broad one in a glazed pot on a low stand, a
# windswept one leaning off its pedestal.
BONSAI = (
    {"stand": "pedestal",
     "trunk": [((0.0, 0.0, 0.45), 0.075), ((0.06, 0.02, 0.62), 0.06), ((-0.04, 0.04, 0.8), 0.048),
               ((0.05, -0.02, 0.98), 0.036), ((0.0, 0.0, 1.14), 0.025)],
     "branches": [((-0.04, 0.04, 0.8), (-0.26, 0.1, 0.93), 0.028), ((0.05, -0.02, 0.98), (0.28, -0.08, 1.08), 0.024),
                  ((0.06, 0.02, 0.62), (0.2, 0.2, 0.78), 0.026)],
     "clouds": [((0.0, 0.0, 1.3), 0.2), ((-0.28, 0.1, 0.97), 0.17), ((0.3, -0.08, 1.11), 0.16),
                ((0.2, 0.2, 0.82), 0.13), ((-0.1, -0.12, 1.16), 0.14)]},
    {"stand": "pot",
     "trunk": [((0.0, 0.0, 0.3), 0.08), ((0.1, 0.0, 0.5), 0.064), ((-0.05, 0.03, 0.68), 0.05),
               ((0.08, 0.02, 0.85), 0.036), ((0.0, 0.0, 0.98), 0.024)],
     "branches": [((-0.05, 0.03, 0.68), (-0.3, 0.02, 0.76), 0.03), ((0.08, 0.02, 0.85), (0.3, 0.06, 0.9), 0.024)],
     "clouds": [((0.0, 0.0, 1.12), 0.2), ((-0.3, 0.02, 0.8), 0.17), ((0.3, 0.06, 0.94), 0.16),
                ((0.12, -0.14, 1.0), 0.13)]},
    {"stand": "pedestal",
     "trunk": [((-0.06, 0.0, 0.45), 0.07), ((0.1, 0.02, 0.6), 0.056), ((0.22, 0.0, 0.74), 0.042),
               ((0.31, -0.02, 0.86), 0.028)],
     "branches": [((0.1, 0.02, 0.6), (-0.12, -0.04, 0.82), 0.024), ((0.22, 0.0, 0.74), (0.18, 0.16, 0.96), 0.02)],
     "clouds": [((0.32, -0.02, 0.96), 0.15), ((-0.15, -0.05, 0.9), 0.14), ((0.17, 0.17, 1.08), 0.15)]},
)


def bonsai(mb, m, w, d, h, variant=0):
    # A bonsai: a crooked trunk and clouds of clipped leaves, on a hexagonal granite pedestal topped with soil (or in a
    # shallow celadon pot on a low granite stand). Only what grows sways (catalog.WIND_SPANS starts at the pedestal's
    # top).
    tree = _variant("bonsai", variant, BONSAI)
    if tree["stand"] == "pedestal":
        mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, 0.43), 0.25, m["granite"], radius_end=0.21, segments=6)
        mb.cylinder((0.0, 0.0, 0.43), 0.19, 0.02, m["soil"], segments=6)
    else:
        mb.box((-0.34, -0.22, 0.0), (0.34, 0.22, 0.16), m["granite"])
        mb.box((-0.3, -0.19, 0.16), (0.3, 0.19, 0.29), m["glaze"])
        mb.box((-0.27, -0.16, 0.29), (0.27, 0.16, 0.3), m["soil"])
    _tree(mb, m, random.Random(81 + variant), tree["trunk"], tree["branches"], tree["clouds"])


def stone_lantern(mb, m, w, d, h):
    # A granite garden lantern: a hexagonal foot, post and platform, the light box (M_led behind four corner posts),
    # a wide hexagonal roof and a finial.
    granite = m["granite"]
    mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, 0.12), 0.22, granite, radius_end=0.2, segments=6)
    mb.stem((0.0, 0.0, 0.12), (0.0, 0.0, 0.5), 0.08, granite, radius_end=0.07, segments=6)
    mb.stem((0.0, 0.0, 0.5), (0.0, 0.0, 0.6), 0.14, granite, radius_end=0.2, segments=6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.11, sy * 0.11
            mb.box((x - 0.025, y - 0.025, 0.6), (x + 0.025, y + 0.025, 0.85), granite)
    mb.box((-0.1, -0.1, 0.62), (0.1, 0.1, 0.84), m["led"])
    mb.stem((0.0, 0.0, 0.85), (0.0, 0.0, 1.0), w / 2, granite, radius_end=0.06, segments=6)
    mb.stem((0.0, 0.0, 1.0), (0.0, 0.0, 1.09), 0.045, granite, segments=6)
    mb.octahedron((0.0, 0.0, 1.14), 0.05, granite)


def lotus_pad(mb, m, w, d, h, variant=0):
    # A floating lotus pad: a shallow cup of ten triangles from its middle out to its rim, a wedge cut from the rim to
    # the middle; four sizes in two greens.
    radius, green, notch = _variant("lotus_pad", variant, PADS)
    steps = 10
    rim = [(radius * math.cos(notch + PAD_NOTCH / 2 + (2 * math.pi - PAD_NOTCH) * k / steps),
            radius * math.sin(notch + PAD_NOTCH / 2 + (2 * math.pi - PAD_NOTCH) * k / steps), h - 0.006)
           for k in range(steps + 1)]
    mb.faces([(0.0, 0.0, 0.004)] + rim, [(0, k + 1, k + 2) for k in range(steps)], m[green])


def lotus_flower(mb, m, w, d, h, variant=0):
    # A lotus flower held a little above the water: a ring of six petals opening outwards round five more upright
    # ones, about a yellow seed head (pink or white); variant 2 is a closed pink bud high on its stem.
    if not 0 <= variant <= len(LOTUS):
        raise ValueError(f"lotus_flower variant must be 0..{len(LOTUS)}, got {variant}")
    if variant == len(LOTUS):
        mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, 0.35), 0.012, m["leaf"], segments=4)
        mb.stem((0.0, 0.0, 0.34), (0.0, 0.0, 0.41), 0.016, m["lotus"], radius_end=0.045, segments=6)
        mb.stem((0.0, 0.0, 0.41), (0.0, 0.0, h - 0.01), 0.045, m["lotus"], radius_end=0.004, segments=6)
        return
    petal = m[LOTUS[variant]]
    base = (0.0, 0.0, 0.12)
    spread = 0.15 + 0.007 * variant  # the white one a little more open
    mb.stem((0.0, 0.0, 0.0), base, 0.012, m["leaf"], segments=4)
    for k in range(6):
        angle = 2 * math.pi * (k + 0.25 * variant) / 6
        mb.leaf(base, (spread * math.cos(angle), spread * math.sin(angle), 0.25 - 0.02 * variant), 0.1, petal,
                belly=0.55)
    for k in range(5):
        angle = 2 * math.pi * (k + 0.5) / 5
        mb.leaf(base, (0.08 * math.cos(angle), 0.08 * math.sin(angle), 0.31), 0.08, petal, belly=0.5)
    mb.cylinder((0.0, 0.0, 0.15), 0.035, 0.04, m["flower_yellow"], segments=6)


def _koi_faces(points, faces, centre):
    """The faces turned to face away from `centre` (x, y, z): outwards."""
    turned = []
    for face in faces:
        nx, ny, nz = _normal(points, face)
        middle = [sum(points[i][axis] for i in face) / len(face) for axis in range(3)]
        out = nx * (middle[0] - centre[0]) + ny * (middle[1] - centre[1]) + nz * (middle[2] - centre[2])
        turned.append(face if out >= 0 else tuple(reversed(face)))
    return turned


def _up(points, faces):
    """The faces of a flat fin turned to face up."""
    return [face if _normal(points, face)[2] >= 0 else tuple(reversed(face)) for face in faces]


def koi(mb, m, w, d, h, variant=0):
    # A koi about half a metre long, nose to the front (-Y): a body of six-sided rings tapering to a narrow tail, a
    # forked tail fin fanned out flat behind it (flat, so it reads from above), two pectoral fins and a dorsal fin; the
    # variant colours the faces of the rings (KOI_PATTERNS). 64 triangles.
    pattern = _variant("koi", variant, KOI_PATTERNS)
    sides = 6
    angles = [math.radians(30 + 60 * k) for k in range(sides)]
    points = [(0.0, KOI_NOSE, KOI_Z)]
    for y, half_w, half_h in KOI_RINGS:
        points += [(half_w * math.cos(a), y, KOI_Z + half_h * math.sin(a)) for a in angles]
    parts = {}  # colour key -> faces

    def colour(band, sector):
        if sector in (0, 1):
            return pattern["back"][band]
        return pattern["side"][band] if sector in (2, 5) else pattern["belly"]

    for k in range(sides):  # the nose cone, band 0
        j = (k + 1) % sides
        parts.setdefault(colour(0, k), []).append((0, 1 + k, 1 + j))
    for band in range(1, len(KOI_RINGS)):
        a, b = 1 + (band - 1) * sides, 1 + band * sides
        for k in range(sides):
            j = (k + 1) % sides
            parts.setdefault(colour(band, k), []).append((a + k, a + j, b + j, b + k))
    last = 1 + (len(KOI_RINGS) - 1) * sides
    parts.setdefault(pattern["side"][-1], []).append(tuple(range(last, last + sides)))  # the narrow tail's end
    for key, faces in sorted(parts.items()):
        mb.faces(points, _koi_faces(points, faces, (0.0, 0.0, KOI_Z)), m[KOI_COLOURS[key]])

    tail_y, peduncle = KOI_RINGS[-1][0] - 0.005, KOI_RINGS[-1][1] - 0.002
    fin = [(-peduncle, tail_y, KOI_Z), (peduncle, tail_y, KOI_Z), (0.075, d / 2, KOI_Z - 0.006), (0.0, 0.2, KOI_Z),
           (-0.075, d / 2, KOI_Z - 0.006)]
    mb.faces(fin, _up(fin, [(0, 1, 3), (1, 2, 3), (3, 4, 0)]), m[KOI_COLOURS[pattern["tail"]]])
    pectoral = []
    for side in (-1, 1):
        pectoral += [(side * 0.05, -0.12, KOI_Z - 0.02), (side * w / 2, -0.07, KOI_Z - 0.03),
                     (side * 0.048, -0.07, KOI_Z - 0.02)]
    mb.faces(pectoral, _up(pectoral, [(0, 1, 2), (3, 4, 5)]), m[KOI_COLOURS[pattern["fins"]]])
    dorsal = [(0.0, -0.07, KOI_Z + 0.044), (0.0, 0.06, KOI_Z + 0.034), (0.0, 0.03, KOI_Z + 0.065)]
    mb.faces(dorsal, [(0, 1, 2)], m[KOI_COLOURS[pattern["dorsal"]]])


def _column(rnd, base, height, radii, lean, profile, jitter):
    """Points and faces of a faceted limestone column standing on `base` (x, y, z): rings of LEAN_SIDES along
    `profile` [(share of the height, share of the radii)], each jittered and wobbling off the line that leans its top
    `lean` (x, y) metres off its foot, up to an apex."""
    x, y, z = base
    turn = rnd.uniform(0.0, 2 * math.pi)
    rings = []
    for t, scale in profile:
        wobble = (rnd.uniform(-0.12, 0.12) * radii[0] * t, rnd.uniform(-0.12, 0.12) * radii[1] * t)
        centre = (x + lean[0] * t * t + wobble[0], y + lean[1] * t * t + wobble[1])
        rings.append(_ring(centre, z + height * t, (radii[0] * scale, radii[1] * scale), LEAN_SIDES, rnd, jitter,
                           turn + rnd.uniform(0.0, 0.5)))
    apex = (x + lean[0] + rnd.uniform(-0.04, 0.04), y + lean[1] + rnd.uniform(-0.04, 0.04), z + height)
    return [p for ring in rings for p in ring] + [apex], _stack(rings)


def rock_peak(mb, m, w, d, h, variant=0):
    # A peak of the rockery: a craggy limestone column in jittered rings of eight, narrowing and leaning as it rises
    # to a blunt crag (no steeper than 45 degrees over its last ring, not a spire), a lower spur leaning out of its
    # side, two boulders shouldering its foot and three tufts of moss on its ledges; the four variants from the tallest
    # down. Every other face looking up is paler, weathered by the sun.
    share, sx, sy, (lx, ly), seed = _variant("rock_peak", variant, PEAKS)
    rnd = random.Random(seed)
    height, rx, ry = h * share, w / 2 * sx, d / 2 * sy
    lean = (lx * w / 2, ly * d / 2)
    points, faces = _column(rnd, (0.0, 0.0, 0.0), height, (rx, ry), lean, PEAK_COLUMN, ROCK_PEAK_JITTER)
    _shade(mb, m, points, faces)
    side = rnd.uniform(0.0, 2 * math.pi)
    spur = (0.45 * rx * math.cos(side), 0.45 * ry * math.sin(side), 0.0)
    points, faces = _column(rnd, spur, 0.55 * height, (0.5 * rx, 0.5 * ry),
                            (0.35 * rx * math.cos(side), 0.35 * ry * math.sin(side)),
                            ((0.0, 1.0), (0.45, 0.72), (0.85, 0.48)), 0.2)
    _shade(mb, m, points, faces)
    for k in range(2):  # the boulders at its foot
        angle = side + math.pi * (0.7 + 0.6 * k)
        size = 0.42 * min(rx, ry)
        boulder(mb, m, (0.6 * rx * math.cos(angle), 0.6 * ry * math.sin(angle), 0.0), 2 * size, 0.7 * size,
                seed * 10 + k)
    for k, t in enumerate(PEAK_MOSS):  # moss on three ledges, round the column from each other, half out of its face
        angle = side + math.pi * (1.0 + 0.7 * k)
        reach = 0.92 * next(s0 + (s1 - s0) * (t - t0) / (t1 - t0)
                            for (t0, s0), (t1, s1) in zip(PEAK_COLUMN, PEAK_COLUMN[1:]) if t0 <= t <= t1)
        centre = (lean[0] * t * t + reach * rx * math.cos(angle), lean[1] * t * t + reach * ry * math.sin(angle),
                  height * t - 0.04)
        moss_points, moss_faces = _lump(rnd, centre, 0.3 * min(rx, ry) + 0.05, 0.16, 6)
        mb.faces(moss_points, moss_faces, m["moss"])


BUILDERS = {
    "stone_table_round": stone_table_round, "stone_stool": stone_stool, "tea_set": tea_set, "bonsai": bonsai,
    "stone_lantern": stone_lantern, "lotus_pad": lotus_pad, "lotus_flower": lotus_flower, "koi": koi,
    "rock_peak": rock_peak,
}

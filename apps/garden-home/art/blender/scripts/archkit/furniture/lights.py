"""Light fittings built as furniture: the tiered crystal ring chandelier of the tall house's double-height living room
(catalog.CHANDELIER_RINGS)."""
import math

from ..catalog import CHANDELIER_RINGS

DROP = (0.05, 0.11)  # half width and half height of a crystal drop
DROP_PITCH = 0.22  # drop centre to drop centre down a strand: the drops hang point to point
STRAND_OUT = 0.035  # how far outside its ring a strand hangs, in front of the ring's crystal curtain
BAND = (0.06, 0.02)  # height and thickness of a ring's flat brass band
BAND_SEGMENTS = 24
CURTAIN = (0.22, 0.14)  # how deep a ring's crystal curtain hangs under its band at its points and between them
CURTAIN_SIDES = 24  # facets of a curtain, folded in and out by CURTAIN_PLEAT in turn so they catch the light in turn
CURTAIN_PLEAT = 0.025
ARMS = 3  # brass arms from the stem out to each ring
CANDLES = (16, 12, 8)  # candle bulbs standing on each ring, from the bottom one up
FLAME = (0.04, 0.09)  # half width and half height of a candle bulb's glowing flame
SLEEVE = (0.018, 0.08)  # radius and height of a candle's brass sleeve
CORE = 0.07  # radius of the glowing core round the stem, from under the lowest ring to over the top one
FINIAL = (0.05, 0.12)  # half width and half height of the crystal drop under the stem, at the piece's bottom


def _bipyramid(mb, mat, center, half_width, half_height):
    """A drop: an octahedron stretched along Z (8 triangles), its points half_width out along X and Y and half_height up
    and down."""
    x, y, z = center
    points = [(x, y, z + half_height), (x, y, z - half_height), (x + half_width, y, z), (x, y + half_width, z),
              (x - half_width, y, z), (x, y - half_width, z)]
    faces = [(2, 3, 0), (3, 4, 0), (4, 5, 0), (5, 2, 0), (3, 2, 1), (4, 3, 1), (5, 4, 1), (2, 5, 1)]
    mb.faces(points, faces, mat)


def _band(mb, mat, radius, z):
    """A ring's flat brass band round the Z axis, centred on height z: BAND tall and thick, in BAND_SEGMENTS straight
    pieces (four sides each)."""
    tall, thick = BAND
    section = [(radius + thick / 2, -tall / 2), (radius + thick / 2, tall / 2), (radius - thick / 2, tall / 2),
               (radius - thick / 2, -tall / 2)]
    points = [(r * math.cos(2 * math.pi * k / BAND_SEGMENTS), r * math.sin(2 * math.pi * k / BAND_SEGMENTS), z + dz)
              for k in range(BAND_SEGMENTS) for r, dz in section]
    faces = []
    for k in range(BAND_SEGMENTS):
        here, there = 4 * k, 4 * ((k + 1) % BAND_SEGMENTS)
        for i in range(4):
            j = (i + 1) % 4
            faces.append((here + i, there + i, there + j, here + j))
    mb.faces(points, faces, mat)


def _curtain(mb, mat, radius, top):
    """The open crystal curtain under a ring's band: CURTAIN_SIDES upright facets round the Z axis from `top` down,
    folded out to `radius` and in by CURTAIN_PLEAT in turn, its hem zig-zagging from a point under every outward fold
    (CURTAIN[0] deep) up between them (CURTAIN[1])."""
    deep, shallow = CURTAIN
    points = []
    for k in range(CURTAIN_SIDES):
        angle = 2 * math.pi * k / CURTAIN_SIDES
        r, depth = (radius, deep) if k % 2 == 0 else (radius - CURTAIN_PLEAT, shallow)
        x, y = r * math.cos(angle), r * math.sin(angle)
        points += [(x, y, top), (x, y, top - depth)]
    n = CURTAIN_SIDES
    faces = [(2 * k, 2 * ((k + 1) % n), 2 * ((k + 1) % n) + 1, 2 * k + 1) for k in range(n)]
    mb.faces(points, faces, mat)


def crystal_chandelier(mb, m, w, d, h, cord=0.0):
    # Grand tiered crystal ring chandelier, the widest ring at the bottom: a brass stem with a crystal finial under it,
    # a glowing core round it and a crown on top; the rings of CHANDELIER_RINGS, flat brass bands on three brass arms
    # each, every one with an open crystal curtain hanging under it, strands of crystal drops in front of the curtain
    # (long and short in turn; the long strands of the lowest ring reach down to the piece's bottom) and candle bulbs, a
    # brass sleeve and a glowing flame, standing on its band; a cord up to a canopy at the ceiling. `cord` lengthens the
    # cord above the piece's top, so the canopy meets a ceiling higher than WALL_MOUNTED + h.
    half_width, half_height = DROP
    tall, _thick = BAND
    _bipyramid(mb, m["crystal"], (0.0, 0.0, FINIAL[1]), *FINIAL)
    bottom, top = CHANDELIER_RINGS[0][1] - 0.15, CHANDELIER_RINGS[-1][1] + 0.1
    mb.cylinder((0.0, 0.0, 2 * FINIAL[1]), 0.025, h - 0.14 - 2 * FINIAL[1], m["brass"], segments=8)
    mb.cylinder((0.0, 0.0, bottom), CORE, top - bottom, m["led"], segments=10)
    mb.cylinder((0.0, 0.0, h - 0.14), 0.09, 0.08, m["brass"], segments=8)
    mb.cylinder((0.0, 0.0, h - 0.06), 0.008, cord + 0.04, m["brass"], segments=6)
    mb.cylinder((0.0, 0.0, h + cord - 0.02), 0.14, 0.02, m["brass"], segments=8)
    for tier, (radius, z, strands) in enumerate(CHANDELIER_RINGS):
        _band(mb, m["brass"], radius, z)
        _curtain(mb, m["crystal"], radius, z - tall / 2 + 0.005)
        for k in range(ARMS):
            angle = 2 * math.pi * (k + 0.5 * (tier % 2)) / ARMS + math.pi / ARMS
            mb.stem((CORE * math.cos(angle), CORE * math.sin(angle), z + 0.18),
                    (radius * 0.98 * math.cos(angle), radius * 0.98 * math.sin(angle), z), 0.012, m["brass"],
                    segments=3)
        out = radius + STRAND_OUT
        for j in range(strands):
            angle = 2 * math.pi * j / strands
            x, y = out * math.cos(angle), out * math.sin(angle)
            drops = (2 if j % 2 == 0 else 1) if tier == 0 else (3 if j % 2 == 0 else 2)
            for i in range(drops):
                _bipyramid(mb, m["crystal"], (x, y, z - tall / 2 - half_height - DROP_PITCH * i), half_width,
                           half_height)
        base = z + tall / 2
        for j in range(CANDLES[tier]):
            angle = 2 * math.pi * (j + 0.5) / CANDLES[tier]
            cx, cy = radius * math.cos(angle), radius * math.sin(angle)
            mb.stem((cx, cy, base), (cx, cy, base + SLEEVE[1]), SLEEVE[0], m["brass"], segments=4)
            _bipyramid(mb, m["led"], (cx, cy, base + SLEEVE[1] + FLAME[1]), *FLAME)


BUILDERS = {"crystal_chandelier": crystal_chandelier}

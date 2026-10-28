"""Stairs built as furniture: the tall house's open spiral stair (catalog.SPIRAL_STAIR, archkit.spiral) and the white,
glass and teak pavilion it comes out of on the roof (catalog.STAIR_PAVILION)."""
import math

from ..catalog import SPIRAL_STAIR, STAIR_PAVILION
from ..spiral import treads as spiral_treads

TREAD = 0.05  # teak slab thickness: open treads, no risers
BALUSTER = 0.012  # radius of the steel rods that carry the handrail, one per tread
HANDRAIL = 0.022  # radius of the handrail
RAIL_INSET = 0.05  # how far in from the treads' outer edge the balusters and the handrail run
RAIL_STEP = math.radians(12.5)  # the handrail is a chain of straight pieces this far round each


def _flight(mb, m, steps, radius, rail, base):
    """The wedge treads of one flight, a baluster on the outer end of each and its helical handrail, `rail` over the
    line through the treads' leading edges from over its first baluster to its top tread's leading edge; `base` is
    the height of the floor it starts from."""
    column = SPIRAL_STAIR["column"]
    start, end = steps[0][0], steps[-1][1]
    rise = steps[-1][2] - base

    def at(angle, r, z):
        return (r * math.cos(angle), r * math.sin(angle), z)

    def rail_z(angle):
        return base + (angle - start) / (end - start) * rise + rail

    out = radius - RAIL_INSET
    for a0, a1, top in steps:
        wedge = [at(a0, column, 0.0)[:2], at(a0, radius, 0.0)[:2], at((a0 + a1) / 2, radius, 0.0)[:2],
                 at(a1, radius, 0.0)[:2], at(a1, column, 0.0)[:2]]
        mb.slab(wedge, top - TREAD, top, m["teak"], uv_tile=2.0)
        middle = (a0 + a1) / 2
        mb.stem(at(middle, out, top), at(middle, out, rail_z(middle) - HANDRAIL), BALUSTER, m["frame"], segments=4)
    first = (steps[0][0] + steps[0][1]) / 2
    pieces = max(1, math.ceil((end - first) / RAIL_STEP))
    for i in range(pieces):
        b0 = first + (end - first) * i / pieces
        b1 = first + (end - first) * (i + 1) / pieces
        mb.stem(at(b0, out, rail_z(b0) - HANDRAIL), at(b1, out, rail_z(b1) - HANDRAIL), HANDRAIL, m["frame"],
                segments=4)


def spiral_stair(mb, m, w, d, h, rise=None, upper=None, treads=None, turns=None, cap=True):
    """Open spiral stair in a w x d square: catalog.SPIRAL_STAIR's teak wedge treads (archkit.spiral) from the steel
    column out to a radius of half the width, a baluster on the outer end of each and a helical handrail on them
    SPIRAL_STAIR["rail"] over the treads' leading edges, the column rising to the top of the handrail. `rise` (the
    floor-to-floor height it climbs) defaults to the catalog height less the handrail; the top tread ends on the +X
    axis at that height, flush with the floor it reaches. `treads` and `turns` replace the catalog's for a flight of
    another rise (the basement's); with cap=False the column stops at the top tread, where
    the stair over it goes on round the same column. `upper` ({"rise", "treads", "turns"}) adds a flight on up round the
    same column from a quarter-turn landing after that top tread (archkit.spiral.flights): the tall house's way on from
    the gallery to the roof."""
    rail = SPIRAL_STAIR["rail"]
    rise = h - rail if rise is None else rise
    radius = min(w, d) / 2
    lower = spiral_treads(rise, SPIRAL_STAIR["treads"] if treads is None else treads,
                          SPIRAL_STAIR["turns"] if turns is None else turns)
    _flight(mb, m, lower, radius, rail, 0.0)
    top = rise
    if upper is not None:
        start = lower[-1][1] + math.pi / 2
        steps = spiral_treads(upper["rise"], upper["treads"], upper["turns"], end=start + 2 * math.pi * upper["turns"],
                              base=rise)
        _flight(mb, m, steps, radius, rail, rise)
        top = rise + upper["rise"]
    mb.cylinder((0.0, 0.0, 0.0), SPIRAL_STAIR["column"], top + rail if cap else top, m["frame"], segments=10)


PAVILION_POST = 0.1  # teak posts at the glazed corners
PAVILION_ROOF = 0.1  # the thin white slab roof's depth
PAVILION_DOOR = 2.1  # head of the door opening


def stair_pavilion(mb, m, w, d, h):
    # The little house a stair comes out of on a roof deck, in the house's white: solid walls on its left (-X) and its
    # back (+Y), clear glass on its right and on the right half of its front (-Y) between teak posts, a door opening on
    # the left half of the front under a teak lintel, and a thin white slab roof over the whole footprint that
    # overhangs the glazed sides by catalog.STAIR_PAVILION's overhang (the walls are flush with its other two edges).
    o, t = STAIR_PAVILION["overhang"], STAIR_PAVILION["wall"]
    p, g = PAVILION_POST, 0.02
    top = h - PAVILION_ROOF
    x0, x1, y0, y1 = -w / 2, w / 2 - o, -d / 2 + o, d / 2  # the walls' outer faces
    jamb = (x0 + x1) / 2  # the door's right jamb, in the middle of the front
    mb.box((x0, y0, 0.0), (x0 + t, y1, top), m["white"])  # left
    mb.box((x0 + t, y1 - t, 0.0), (x1, y1, top), m["white"])  # back
    mb.box((-w / 2, -d / 2, top), (w / 2, d / 2, h), m["white"], uv_tile=2.0)  # the slab roof
    mb.box((x1 - p, y0, 0.0), (x1, y0 + p, top), m["teak"])  # the front right corner post
    mb.box((jamb - 0.03, y0, 0.0), (jamb + 0.03, y0 + p, top), m["teak"])  # the door's right jamb
    mb.box((x0 + t, y0, PAVILION_DOOR), (jamb - 0.03, y0 + p, top), m["teak"])  # the lintel
    inset = p / 2
    panes = [
        ((x1 - inset - g / 2, y0 + p, 0.02), (x1 - inset + g / 2, y1 - t, top)),  # right
        ((jamb + 0.03, y0 + inset - g / 2, 0.02), (x1 - p, y0 + inset + g / 2, top)),  # the front's right half
    ]
    for mn, mx in panes:
        mb.box(mn, mx, m["glass"])


BUILDERS = {"spiral_stair": spiral_stair, "stair_pavilion": stair_pavilion}

"""The grass tufts and small rocks that break up the island's rim, as plain data. Pure Python.

make_placeholders builds them into the yard's Rim_tufts, so the edge of the grass top does not read as a cut plane. The
garden's fence (garden/fence_layout.py) runs fence_layout.INSET metres inside the rim, and they keep clear of it: the
tufts grow in the strip between the fence line and the rim, every blade TUFT_STRIP metres outside the fence line (the
whole blade, not just its middle), leaning out over the edge, clear of the posts and their caps and never in a gateway; the rocks lie inside the fence, at
least ROCK_CLEAR metres and their own spread plus ROCK_MARGIN off its line, their spread off the zones and the garden's
island-wide pieces (garden/layout_check.ground) and CLEAR more off the yard's trees and lamp. Both follow the fence
line of the island that is built (a --yard-size island has a rim of its own) and draw from random streams of their own,
seeded by the island, so placing them never moves the rest of the yard.
"""
import math
import random

from garden import fence_layout, layout_check, shapes

from . import island as island_shape
from . import zones

TUFTS = 48  # clumps of BLADES blades along the rim
BLADES = 3
TUFT_STRIP = (0.05, 0.25)  # metres outside the fence line: a blade's inner edge, its middle at the most
BLADE_RADIUS = (0.06, 0.1)  # of a blade's base: a cone of three faces
BLADE_HEIGHT = (0.3, 0.5)
BLADE_LEAN = (0.04, 0.12)  # how far a blade's tip leans out over the rim
CLUMP = 0.25  # the blades of a clump spread this far either way along the fence line
GATEWAY_CLEAR = 0.8  # metres kept free of tufts round the line between a gate's pillars

ROCKS = 10
ROCK_SIZE = (0.3, 0.55)
ROCK_SPREAD = 1.4  # how far a rock's faceted base reaches, as a share of its size (1.15, jittered by up to 20 %)
ROCK_CLEAR = 0.8  # metres inside the fence line, at the least
ROCK_MARGIN = 0.2  # metres between a rock's base and the fence line, at the least
ROCK_BAND = 0.6  # how much further in than it has to a rock may lie
CLEAR = layout_check.CLEAR  # metres kept free round the yard's trees and its lamp, as the garden keeps them
TRIES = 10000


def fence_line(island):
    """The line the garden's fence follows on `island`: its jittered rim, fence_layout.INSET metres in."""
    return fence_layout.inset(island_shape.outline(island), fence_layout.INSET)


def _to_line(point, line):
    """How far `point` is from the closed polyline `line`."""
    best = math.inf
    for (x0, y0), (x1, y1) in zip(line, line[1:] + line[:1]):
        dx, dy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((point[0] - x0) * dx + (point[1] - y0) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(point[0] - x0 - t * dx, point[1] - y0 - t * dy))
    return best


def _along(line, at):
    """The point `at` metres along the closed counter-clockwise `line` from its first vertex, and the outward normal
    of the edge it lies on."""
    at %= sum(math.dist(a, b) for a, b in zip(line, line[1:] + line[:1]))
    for a, b in zip(line, line[1:] + line[:1]):
        length = math.dist(a, b)
        if at <= length:
            ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
            return (a[0] + ux * at, a[1] + uy * at), (uy, -ux)  # the right of a counter-clockwise edge: outwards
        at -= length
    raise AssertionError("unreachable: `at` is reduced modulo the line's length")


def _gateways():
    """The lines between the pillars of each gate of the fence."""
    return [tuple(p["pos"] for p in fence_layout.PILLARS if p["gate"] == gate["name"]) for gate in fence_layout.GATES]


def tufts(island):
    """The grass blades along the rim of `island`: (x, y, base radius, height, (lean x, lean y)) each, the lean being
    where the tip stands off the middle of the base, outwards."""
    rnd = random.Random(island["seed"] + 3)
    line, rim = fence_line(island), island_shape.outline(island)
    perimeter = sum(math.dist(a, b) for a, b in zip(line, line[1:] + line[:1]))
    gateways = _gateways()
    posts = _posts()
    blades = []
    for _ in range(TRIES):
        if len(blades) >= TUFTS * BLADES:
            return blades
        middle = rnd.uniform(0.0, perimeter)
        clump = []
        for _ in range(BLADES):
            (x, y), (nx, ny) = _along(line, middle + rnd.uniform(-CLUMP, CLUMP))
            radius = rnd.uniform(*BLADE_RADIUS)
            out = rnd.uniform(TUFT_STRIP[0] + radius, TUFT_STRIP[1])
            lean = rnd.uniform(*BLADE_LEAN)
            clump.append((x + nx * out, y + ny * out, radius, rnd.uniform(*BLADE_HEIGHT), (nx * lean, ny * lean)))
        if all(_tuft_fits(blade, line, rim, gateways, posts) for blade in clump):
            blades += clump
    raise ValueError(f"no room for {TUFTS} tufts along the rim after {TRIES} tries")


def _posts():
    """The footprints of the fence's posts with their caps (fence_layout.SHAPES), which stand out off the fence line."""
    return [shape for name, shape in fence_layout.SHAPES if name.startswith("post ")]


def _tuft_fits(blade, line, rim, gateways, posts):
    x, y, radius, _, (lean_x, lean_y) = blade
    gap = _to_line((x, y), line)
    return (not island_shape.contains(line, (x, y)) and island_shape.contains(rim, (x, y))
            and gap - radius >= TUFT_STRIP[0] and gap <= TUFT_STRIP[1]
            and _to_line((x + lean_x, y + lean_y), line) >= gap
            and all(shapes.distance(post, (x, y)) - radius >= TUFT_STRIP[0] for post in posts)
            and all(shapes.distance(shapes.band(a, b, 1e-6), (x, y)) > GATEWAY_CLEAR for a, b in gateways))


def rocks(island):
    """The small half-buried rocks inside the fence of `island`: (x, y, size) each."""
    rnd = random.Random(island["seed"] + 5)
    line = fence_line(island)
    perimeter = sum(math.dist(a, b) for a, b in zip(line, line[1:] + line[:1]))
    keep_off = ([shapes.box((x0, y0, x1, y1)) for (x0, y0), (x1, y1) in zones.ZONES.values()]
                + [shape for layout in layout_check.island_layouts() for _, shape in layout_check.ground(layout)])
    posts = list(zones.TREES) + [zones.LAMP]
    found = []
    for _ in range(TRIES):
        if len(found) >= ROCKS:
            return found
        size = rnd.uniform(*ROCK_SIZE)
        reach = ROCK_SPREAD * size
        need = max(ROCK_CLEAR, reach + ROCK_MARGIN)
        (x, y), (nx, ny) = _along(line, rnd.uniform(0.0, perimeter))
        depth = rnd.uniform(need, need + ROCK_BAND)
        x, y = x - nx * depth, y - ny * depth
        if (island_shape.contains(line, (x, y)) and _to_line((x, y), line) >= need
                and all(shapes.distance(shape, (x, y)) >= reach for shape in keep_off)
                and all(math.dist(post, (x, y)) >= reach + CLEAR for post in posts)
                and all(math.dist((x, y), (rx, ry)) >= ROCK_SPREAD * (size + other) for rx, ry, other in found)):
            found.append((x, y, size))
    raise ValueError(f"no room for {ROCKS} rocks inside the fence after {TRIES} tries")

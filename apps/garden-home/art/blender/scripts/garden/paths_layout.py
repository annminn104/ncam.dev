"""The stone walk from the main gate to the front door, the driveway from the car gate to the carport, and the bollards
along both (art/README.md, Garden), as plain data. Pure Python.

An island-wide module like the fence (module space is site space). The walk follows the path zones of
siteplan/zones.py (path_gate, path_turn, path_door): travertine slabs across it, a stride apart on the grass, from just
inside the walk gate (garden/fence_layout.py) up the middle of path_gate, a square landing at each turn, along
path_turn and up path_door to the foot of the house's front steps. The driveway is travertine edged with grey kerbs,
from just inside the car gate up the driveway zone, flaring at its top end into an apron (APRON) as wide as the
carport's two bays at the carport zone. Low bollards (garden_lamp, lights:garden) stand along both, with a few pebbles
at the gate and the turns.

build_paths.py reads STONES, DRIVEWAY_SLABS, KERBS, PEBBLES, PIECES and POOLS (the light the bollards cast,
garden/lights.py); layout_check reads WALK, STONES, DRIVEWAY, APRON, PIECES, POOLS and SHAPES.
"""
import math

from siteplan import zones

from . import fence_layout as fence
from . import lights, shapes

MODULE_ID = "garden_paths"
ROLE = "prop"
FOOTPRINT = zones.ISLAND["size"]
ISLAND_WIDE = True
ZONES_USED = ("path_gate", "path_turn", "path_door", "driveway")

STONE = (1.2, 0.6)  # across the walk, along it
STONE_TOP = 0.05
STRIDE = 0.85  # centre to centre along the walk
MAX_GAP = 0.45  # the widest step of grass between two slabs (layout_check)
GATE_CLEAR = 0.15  # the first slab starts this far inside the gate's leaves
DOOR = (6.1, 2.0)  # the foot of the house's front steps, centred on the door (house_parts/shell.py, in yard space)
WALK_GATE, DRIVE_GATE = "Gate_main", "Gate_car"
DRIVEWAY_X = (15.0, 19.0)  # the driveway zone's width
DRIVEWAY_TOP = 0.04
KERB = 0.12  # the grey kerbs along the driveway's sides, this wide square to them
KERB_TOP = 0.07
# The apron (part 4): over its last APRON_RUN metres the driveway flares out, kerbs and all, to APRON_X at the carport
# zone's front edge, so both of the carport's bays open onto it (the straight driveway met a metre of the pickup's).
APRON_X = (12.4, 19.8)
APRON_RUN = 2.4


# The line between the pillars of each gate the paths come in through (left, right), from the fence.
GATE_LINES = {name: tuple(pillar["pos"] for pillar in fence.PILLARS if pillar["gate"] == name)
              for name in (WALK_GATE, DRIVE_GATE)}


def _on_gate(name, x, inside):
    """The point at `x` on the line between a gate's pillars, moved `inside` metres in (+Y, into the island)."""
    (x0, y0), (x1, y1) = GATE_LINES[name]
    return (x, y0 + (x - x0) * (y1 - y0) / (x1 - x0) + inside)


# The walk's centre line: from its gate up path_gate, along path_turn, up path_door to the steps.
_TURN_Y = sum(zones.ZONES["path_turn"][k][1] for k in (0, 1)) / 2
WALK = [_on_gate(WALK_GATE, 0.0, 0.0), (0.0, _TURN_Y), (DOOR[0], _TURN_Y), DOOR]


def _stones(walk):
    """Slabs (rectangles, shapes.rect) along the walk, in order: a square landing at every turn, and between the ends
    and the landings as many slabs a stride apart as fit, evenly spread; the first starts GATE_CLEAR + the leaves' depth
    inside the gate, the last ends at the door."""
    across, along = STONE
    gap = STRIDE - along
    stones = []
    for k, (a, b) in enumerate(zip(walk, walk[1:])):
        length = math.dist(a, b)
        ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        start = fence.LEAF + GATE_CLEAR if k == 0 else across / 2 + gap
        end = 0.0 if k == len(walk) - 2 else across / 2 + gap
        count = max(1, round((length - start - end - along) / STRIDE) + 1)
        pitch = (length - start - end - along) / (count - 1) if count > 1 else 0.0
        size = (across, along) if abs(ux) < 0.5 else (along, across)  # slabs lie across the walk
        for i in range(count):
            s = start + along / 2 + i * pitch
            stones.append(shapes.rect((a[0] + ux * s, a[1] + uy * s), size))
        if k < len(walk) - 2:
            stones.append(shapes.rect(b, (across, across)))  # the landing at the turn
    return stones


STONES = _stones(WALK)
_FRONT = (_on_gate(DRIVE_GATE, DRIVEWAY_X[0], fence.LEAF + GATE_CLEAR + 0.05),
          _on_gate(DRIVE_GATE, DRIVEWAY_X[1], fence.LEAF + GATE_CLEAR + 0.05))
_BACK_Y = zones.ZONES["carport"][0][1]  # the carport zone's front edge
_FLARE_Y = _BACK_Y - APRON_RUN  # where the apron starts


def _front(x):
    """The driveway's front edge (parallel to the car gate) at x."""
    (fx0, fy0), (fx1, fy1) = _FRONT
    return (x, fy0 + (x - fx0) * (fy1 - fy0) / (fx1 - fx0))


def _inside(a, b, toward, by):
    """The line through the edge a-b moved `by` metres square to it towards the point `toward`: (point, direction)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    nx, ny = -dy / math.hypot(dx, dy), dx / math.hypot(dx, dy)
    if (toward[0] - a[0]) * nx + (toward[1] - a[1]) * ny < 0:
        nx, ny = -nx, -ny
    return (a[0] + by * nx, a[1] + by * ny), (dx, dy)


def _meet(line, other):
    """Where two lines (point, direction) cross."""
    (px, py), (dx, dy) = line
    (qx, qy), (ex, ey) = other
    t = ((qx - px) * ey - (qy - py) * ex) / (dx * ey - dy * ex)
    return (px + t * dx, py + t * dy)


def _paving():
    """The grey kerbs and the travertine slabs between them, as convex polygons side by side (no face of one lies on a
    face of another): a straight kerb up each side of the driveway to the flare, a slanted one on along each side of
    the apron, meeting it at a mitre; the driveway's slab between the straight kerbs and the apron's between the
    slanted ones."""
    (x0, x1), (ax0, ax1), y, back = DRIVEWAY_X, APRON_X, _FLARE_Y, _BACK_Y
    middle = ((x0 + x1) / 2, (y + back) / 2)
    top = ((0.0, back), (1.0, 0.0))
    kerbs, corners = [], []
    for side, apron, inward in ((x0, ax0, KERB), (x1, ax1, -KERB)):
        slant = _inside((side, y), (apron, back), middle, KERB)
        mitre = _meet(((side + inward, 0.0), (0.0, 1.0)), slant)  # where the kerbs' inner sides meet
        inner_top = _meet(slant, top)
        kerbs += [[_front(side), _front(side + inward), mitre, (side, y)], [(side, y), mitre, inner_top, (apron, back)]]
        corners.append((mitre, inner_top))
    (west, west_top), (east, east_top) = corners
    slabs = [[_front(x0 + KERB), _front(x1 - KERB), east, west], [west, east, east_top, west_top]]
    return kerbs, slabs


# The driveway as polygons (x, y): its outline from the car gate to the flare and the apron's on to the carport zone
# (what layout_check reads), the grey kerbs and the travertine slabs between them (for MeshBuilder.slab).
DRIVEWAY = [_front(DRIVEWAY_X[0]), _front(DRIVEWAY_X[1]), (DRIVEWAY_X[1], _FLARE_Y), (DRIVEWAY_X[0], _FLARE_Y)]
APRON = [(DRIVEWAY_X[0], _FLARE_Y), (DRIVEWAY_X[1], _FLARE_Y), (APRON_X[1], _BACK_Y), (APRON_X[0], _BACK_Y)]
KERBS, DRIVEWAY_SLABS = _paving()
# Pebbles (x, y, radius) at the gate and at the turns of the walk.
PEBBLES = [(-1.45, -21.75, 0.24), (-1.9, -21.4, 0.16), (1.5, -21.7, 0.2), (-1.0, -2.95, 0.2), (-1.4, -2.6, 0.14),
           (7.25, -2.75, 0.22), (7.55, -2.35, 0.15)]  # the last two clear of the tea zone (part 3), which reaches y -3

# Bollards: along the walk on alternate sides, by its turns and the door, and in pairs up the driveway.
_WALK_LAMPS = [(1.3, -18.0), (-1.3, -14.0), (1.3, -10.0), (-1.3, -6.0), (2.6, -3.3), (4.4, -0.7), (7.5, 0.3)]
_DRIVE_LAMPS = [(x, y) for y in (-18.0, -12.0, -6.0, 0.0) for x in (DRIVEWAY_X[0] - 0.28, DRIVEWAY_X[1] + 0.28)]
PIECES = [("garden_lamp", "Garden_lamps", pos, 0) for pos in _WALK_LAMPS + _DRIVE_LAMPS]
POOLS = [lights.pool("Garden_lamps", "garden_lamp", pos) for pos in _WALK_LAMPS + _DRIVE_LAMPS]  # their light


# What the paths take of the ground, for layout_check (the kerbs are part of the driveway and its apron).
SHAPES = ([(f"stone {k}", stone) for k, stone in enumerate(STONES, start=1)]
          + [("driveway", DRIVEWAY), ("apron", APRON)]
          + [(f"pebble {k}", shapes.square((x, y), 2 * r, 0.0)) for k, (x, y, r) in enumerate(PEBBLES, start=1)])

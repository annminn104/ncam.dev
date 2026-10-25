"""The fence round the island and its two gates (villa v2 part 2) as plain data. Pure Python.

An island-wide module (siteplan/zones.py): its slot stands at the island's centre unturned, so module space is site
space. The fence follows the rim of the island's grass top (siteplan/island.outline) INSET metres in: a travertine post
at every rim vertex and three teak boards from post to post, so it turns with the rim's facets. It opens at two gates on
the front (-Y) rim: the walk gate where the stone walk to the front door starts (x 0) and the car gate at the driveway
(x 17). A gate is a pair of travertine pillars, each with a lantern on top (lights:garden, garden/interact.py), and two
closed teak leaves of upright slats between them, on the straight line from pillar to pillar.

build_fence.py reads POSTS, SPANS, PILLARS, LEAVES, PIECES and POOLS; layout_check reads PIECES, POOLS and
SHAPES.
"""
import math

from siteplan import island, zones

from . import lights, shapes

MODULE_ID = "fence"
ROLE = "prop"
FOOTPRINT = zones.ISLAND["size"]  # the island's bounding size, as for the yard
ISLAND_WIDE = True
ZONES_USED = ()  # the fence keeps out of every zone: the walk and the driveway come in through its gates

INSET = 0.45  # the vegetable garden's corner (-23, -18) is 0.6 m from the rim: the posts stay clear of it
POST = 0.16
POST_TOP = 1.0
CAP = 0.05  # the travertine cap on a post or a pillar, 2 cm wider all round
BOARDS = ((0.16, 0.3), (0.42, 0.56), (0.68, 0.82))  # bottom and top of the three teak boards
BOARD = 0.04
SPAN_MAX = 3.2  # the longest board from post to post (the rim's longest facet is 3.1 m)
SPAN_MIN = 0.6  # a rim vertex nearer than this to a gate pillar gets no post of its own
PILLAR = 0.4
PILLAR_TOP = 1.35
LEAF = 0.07  # half the thickness a gate leaf takes: its slats and the rails behind them
SLAT, SLAT_PITCH = 0.07, 0.12  # the upright slats of a gate leaf
GATES = (
    {"name": "Gate_main", "kind": "walk", "x": (-1.15, 1.15), "top": 1.1},  # x of the pillar centres
    {"name": "Gate_car", "kind": "car", "x": (14.55, 19.45), "top": 1.2},
)


def inset(points, distance):
    """The closed counter-clockwise polygon `points` moved `distance` inwards: each vertex along the bisector of its two
    edges, so that both edges move by `distance` (siteplan/rim.py draws the fence line of any island with it)."""
    out = []
    for i, a in enumerate(points):
        normals = []
        for (x0, y0), (x1, y1) in ((points[i - 1], a), (a, points[(i + 1) % len(points)])):
            length = math.hypot(x1 - x0, y1 - y0)
            normals.append((-(y1 - y0) / length, (x1 - x0) / length))  # left of a counter-clockwise edge: inwards
        (ux, uy), (vx, vy) = normals
        scale = distance / (1 + ux * vx + uy * vy)
        out.append((a[0] + (ux + vx) * scale, a[1] + (uy + vy) * scale))
    return out


# The fence line: the rim INSET metres in, counter-clockwise from +X like island.outline.
LINE = inset(island.outline(zones.ISLAND), INSET)


def _crossing(x):
    """(edge index, point) where the fence line crosses x on the front half (y < 0); edge i runs from LINE[i] to
    LINE[i + 1], and x rises along the front as the line runs counter-clockwise."""
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(LINE, LINE[1:] + LINE[:1])):
        if y0 < 0 and y1 < 0 and x0 < x <= x1:
            return i, (x, y0 + (x - x0) * (y1 - y0) / (x1 - x0))
    raise ValueError(f"the fence line does not cross x = {x:g} on the front")


def _runs(gates):
    """The fence between the gates: lists of nodes (x, y), counter-clockwise from one gate's right pillar to the next
    gate's left pillar, through every vertex of the fence line in between (but those too near a pillar)."""
    ends = sorted((_crossing(gate["x"][0]), _crossing(gate["x"][1])) for gate in gates)
    runs = []
    for k, (_, (i_right, right)) in enumerate(ends):
        (i_left, left), _ = ends[(k + 1) % len(ends)]
        nodes = [right]
        i = i_right
        while i != i_left:
            i = (i + 1) % len(LINE)
            if math.dist(LINE[i], right) >= SPAN_MIN and math.dist(LINE[i], left) >= SPAN_MIN:
                nodes.append(LINE[i])
        runs.append(nodes + [left])
    return runs


RUNS = _runs(GATES)
# A post at every node of a run but its two ends (the pillars), turned along the fence there.
POSTS = [(node, math.atan2(after[1] - before[1], after[0] - before[0]))
         for run in RUNS for before, node, after in zip(run, run[1:], run[2:])]
SPANS = [(a, b) for run in RUNS for a, b in zip(run, run[1:])]
PILLARS = [{"gate": gate["name"], "side": side, "pos": _crossing(x)[1]}
           for gate in GATES for side, x in zip(("left", "right"), gate["x"])]


def _leaves(gate):
    """The two leaves of a gate, closed, on the line between its pillars: they start 2 cm off the pillars' faces and
    meet in the middle with a 2 cm gap."""
    left, right = (pillar["pos"] for pillar in PILLARS if pillar["gate"] == gate["name"])
    length = math.dist(left, right)
    ux, uy = (right[0] - left[0]) / length, (right[1] - left[1]) / length

    def at(s):
        return (left[0] + ux * s, left[1] + uy * s)

    start, end, middle = PILLAR / 2 + 0.02, length - PILLAR / 2 - 0.02, length / 2
    return [{"gate": gate["name"], "start": at(start), "end": at(middle - 0.01), "top": gate["top"]},
            {"gate": gate["name"], "start": at(middle + 0.01), "end": at(end), "top": gate["top"]}]


LEAVES = [leaf for gate in GATES for leaf in _leaves(gate)]

# The lanterns on the pillar tops: one object, lights:garden (garden/interact.py).
PIECES = [("pillar_lamp", "Gate_lamps", (*pillar["pos"], PILLAR_TOP), 0) for pillar in PILLARS]


def _inwards(gate):
    """The direction (radians) into the island across a gate: left of its line from the left pillar to the right one,
    as the fence line runs counter-clockwise."""
    (x0, y0), (x1, y1) = (pillar["pos"] for pillar in PILLARS if pillar["gate"] == gate)
    return math.atan2(y1 - y0, x1 - x0) + math.pi / 2


# The light each lantern casts on the ground (garden/lights.py): the half of its pool inside the fence.
POOLS = [lights.pool("Gate_lamps", "pillar_lamp", pillar["pos"], facing=_inwards(pillar["gate"]))
         for pillar in PILLARS]

# What the fence takes of the ground, for layout_check: the posts and pillars with their caps, the boards, the leaves.
# They meet one another (a board runs into its posts), so only what other modules build may not touch them.
SHAPES_MEET = True
SHAPES = ([(f"post {k}", shapes.square(pos, POST + 0.04, yaw)) for k, (pos, yaw) in enumerate(POSTS, start=1)]
          + [(f"{p['gate']} {p['side']} pillar", shapes.square(p["pos"], PILLAR + 0.04, 0.0)) for p in PILLARS]
          + [(f"fence span {k}", shapes.band(a, b, BOARD / 2)) for k, (a, b) in enumerate(SPANS, start=1)]
          + [(f"{leaf['gate']} leaf {k}", shapes.band(leaf["start"], leaf["end"], LEAF))
             for k, leaf in enumerate(LEAVES, start=1)])

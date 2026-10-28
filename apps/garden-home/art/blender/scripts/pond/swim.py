"""The paths the koi swim (art/README.md, Koi pond). Pure Python.

A koi loops for ever round a closed path in the pond, nose first: an ellipse (or a figure of eight) of `radii` round
`centre`, turned `tilt` degrees, at the height `z` of the fish's underside, bobbing `bob` metres up and down twice a
loop, `period` seconds a loop (negative: clockwise seen from above), starting `phase` radians into it. build_koi.py
stands every fish where it is at t = 0 and the website moves it on in a vertex shader (src/systems/koi.ts), which
evaluates these very formulas from the loops the glTF node carries (pack): keep the two in step.

A click on the pond feeds them (fed_position, koi.ts koiFedPosition): each koi leaves its loop for a ring round the
food, on a straight line from where its loop has it to where its ring has it, as far as its hunger says. The layout
check samples those lines (layout_check: the feeding disc).
"""
import math

EPS = 0.05  # seconds either side of t: the heading is the direction of motion over this step
SAMPLES = 96  # points per loop for the layout checks
# Feeding (src/systems/koi.ts KOI_FEED): the koi leave their loops for the food in `gather` seconds, circle it until
# `stay` and are back on their loops by `leave`; every other koi on an inner ring `rings[0]` metres round the food and
# `depths[0]` under the surface (their undersides), the others outside and a little deeper, the two rings turning
# opposite ways at `spin` radians a second. Food thrown again glides the rings' middle to it in `glide` seconds.
FEED = {"gather": 3.0, "stay": 9.0, "leave": 13.0, "glide": 1.0, "rings": (0.45, 0.8), "depths": (0.16, 0.25),
        "spin": 0.4}


def angle(loop, t):
    """How far round its loop the koi is at time t (radians)."""
    return loop["phase"] + 2 * math.pi * t / loop["period"]


def position(loop, t):
    """(x, y, z) of the koi at time t: the middle of its body, its underside's height."""
    s = angle(loop, t)
    rx, ry = loop["radii"]
    ex, ey = rx * math.cos(s), ry * (math.sin(2 * s) if loop.get("eight") else math.sin(s))
    c, n = math.cos(math.radians(loop["tilt"])), math.sin(math.radians(loop["tilt"]))
    cx, cy = loop["centre"]
    return (cx + c * ex - n * ey, cy + n * ex + c * ey, loop["z"] + loop.get("bob", 0.0) * math.sin(2 * s))


def heading(loop, t):
    """The koi's turn about Z at time t (radians): its nose, local -Y, points the way it moves."""
    (x0, y0, _), (x1, y1, _) = position(loop, t - EPS), position(loop, t + EPS)
    return math.atan2(x1 - x0, -(y1 - y0))


def samples(loop, count=SAMPLES):
    """Points (x, y, z) round the loop, evenly in time."""
    return [position(loop, abs(loop["period"]) * k / count) for k in range(count)]


def body(loop, t, length):
    """The nose and the tail tip (x, y) of a koi `length` long at time t."""
    x, y, _ = position(loop, t)
    yaw = heading(loop, t)
    dx, dy = math.sin(yaw) * length / 2, -math.cos(yaw) * length / 2  # local -Y turned by yaw
    return (x + dx, y + dy), (x - dx, y - dy)


def _smoothstep(edge0, edge1, x):
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def hunger(dt):
    """How far the koi have left their loops `dt` seconds after they set off for food: 0 to 1 and back to 0."""
    return _smoothstep(0.0, FEED["gather"], dt) * (1.0 - _smoothstep(FEED["stay"], FEED["leave"], dt))


def food_centre(food, now):
    """The middle of the rings at `now`: gliding from food["from"] to where the food fell (x, y) after it fell (at).
    `food` is {"x", "y", "at", "from": (x, y), "start": when the koi set off}, as koi.ts KoiFood."""
    k = _smoothstep(food["at"], food["at"] + FEED["glide"], now)
    (fx, fy) = food["from"]
    return fx + (food["x"] - fx) * k, fy + (food["y"] - fy) * k


def ring_point(index, count, food, now, water_z):
    """Where koi `index` of `count` circles the food at `now` (x, y and its underside's z)."""
    ring = index % 2
    angle = 2 * math.pi * index / count + now * FEED["spin"] * (-1 if ring else 1)
    x, y = food_centre(food, now)
    r = FEED["rings"][ring]
    return x + r * math.cos(angle), y + r * math.sin(angle), water_z - FEED["depths"][ring]


def fed_position(loop, t, now, index, count, food, water_z):
    """position() with the food (None: never fed): koi `index` of `count` at loop time t and clock time `now`."""
    swim = position(loop, t)
    weight = hunger(now - food["start"]) if food else 0.0
    if weight <= 0.0:
        return swim
    ring = ring_point(index, count, food, now, water_z)
    return tuple(a + (b - a) * weight for a, b in zip(swim, ring))


def pack(loops):
    """The loops as the flat list of floats the koi object carries (custom property `koi`, glTF extras), 12 per fish:
    centre x, y, radii x, y; tilt (radians), z, angular speed (radians a second), phase; eight (0 or 1), bob, 0, 0."""
    flat = []
    for loop in loops:
        flat += [loop["centre"][0], loop["centre"][1], loop["radii"][0], loop["radii"][1],
                 math.radians(loop["tilt"]), loop["z"], 2 * math.pi / loop["period"], loop["phase"],
                 1.0 if loop.get("eight") else 0.0, loop.get("bob", 0.0), 0.0, 0.0]
    return flat

"""Garden pieces (art/README.md, Garden): planted flower beds, flower pots and clipped shrubs; the raised beds, tomato
trellis, wheelbarrow, watering can, compost bin and tool shed of the vegetable garden; the grill and its glowing coals,
outdoor kitchen, six-seat teak dining set and parasol of the barbecue terrace; the lantern on a gate pillar; and a small
bush growing straight from the lawn (the dog's corner, part 4).

The plants are low-poly like the tropical ones: icosahedron mounds and heads, octahedron flowers on thin stems, leaf
blades. The ones that sway list their 'wind' span in catalog.WIND_SPANS; the garden modules build them into a few shared
objects (furniture.place_into), so a bed of flowers costs one draw call per colour for the whole garden.
"""
import math
import random

from ..catalog import GRILL_COALS_Z
from ._parts import _fronts, _legs
from .tropical import _pot

# The flower colours of a bed or a pot, by variant: palette keys, used in turn.
FLOWER_MIXES = (("flower_pink", "flower_yellow", "flower_white"), ("flower_red", "flower_yellow"),
                ("flower_pink", "flower_white"), ("flower_red", "flower_pink", "flower_yellow"))
CROPS = ("lettuce", "cabbage", "carrot", "herbs")


def _mix(variant):
    if not 0 <= variant < len(FLOWER_MIXES):
        raise ValueError(f"flower variant must be 0..{len(FLOWER_MIXES) - 1}, got {variant}")
    return FLOWER_MIXES[variant]


def _flower(mb, m, colour, root, head, radius):
    """A flower: a thin green stem from `root` up to an octahedron head of `radius` in `colour` at `head`."""
    mb.stem(root, (head[0], head[1], head[2] - radius), 0.008, m["leaf"], segments=3)
    mb.octahedron(head, radius, m[colour])


def _kerb(mb, m, w, d, top, kerb):
    """A ring of travertine kerbs round the w x d rectangle at the origin, `kerb` thick and `top` high."""
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, -d / 2 + kerb, top), m["stone"], uv_tile=2.0)
    mb.box((-w / 2, d / 2 - kerb, 0.0), (w / 2, d / 2, top), m["stone"], uv_tile=2.0)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - kerb)))
        mb.box((x0, -d / 2 + kerb, 0.0), (x1, d / 2 - kerb, top), m["stone"], uv_tile=2.0)


def _frame(mb, m, w, d, top, board, mat):
    """Four boards boxing in a w x d bed at the origin, `top` high (raised beds, the compost bin's floor)."""
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, -d / 2 + board, top), mat)
    mb.box((-w / 2, d / 2 - board, 0.0), (w / 2, d / 2, top), mat)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - board)))
        mb.box((x0, -d / 2 + board, 0.0), (x1, d / 2 - board, top), mat)


def flower_bed(mb, m, w, d, h, variant=0):
    # Travertine kerb round a bed of soil, three low leafy mounds and six clusters of three flowers on thin stems, a
    # cluster in one of the variant's colours: patches of colour that still read from the wallpaper's distance.
    colours = _mix(variant)
    rnd = random.Random(31 + variant)
    kerb, top = 0.08, 0.14
    _kerb(mb, m, w, d, top, kerb)
    mb.box((-w / 2 + kerb, -d / 2 + kerb, 0.0), (w / 2 - kerb, d / 2 - kerb, top - 0.02), m["soil"])
    inner = w / 2 - kerb
    for i in range(3):
        x = -inner + (i + 0.5) * 2 * inner / 3 + rnd.uniform(-0.02, 0.02)
        mb.blob((x, rnd.uniform(-0.04, 0.04), top + 0.03), 0.3, m["leaf" if i % 2 else "leaf_dark"], subdivisions=1,
                squash=0.5)
    for i in range(6):
        cx, cy = -0.7 + 0.28 * i + rnd.uniform(-0.04, 0.04), 0.12 * (1 if i % 2 else -1)
        for k in range(3):
            angle = 2 * math.pi * k / 3 + rnd.uniform(-0.3, 0.3)
            x, y = cx + 0.1 * math.cos(angle), cy + 0.1 * math.sin(angle)
            radius = rnd.uniform(0.08, 0.1)
            _flower(mb, m, colours[i % len(colours)], (x, y, top - 0.02),
                    (x, y, rnd.uniform(0.38, h - 0.01 - radius)), radius)


def flower_pot(mb, m, w, d, h, variant=0):
    # Terracotta pot with a leafy mound and a ring of flowers of the variant's colours above it.
    colours = _mix(variant)
    rnd = random.Random(41 + variant)
    start = _pot(mb, m, 0.26, 0.43)
    mb.blob((0.0, 0.0, start + 0.08), 0.25, m["leaf"], subdivisions=1, squash=0.75)
    for i in range(7):
        angle = 2 * math.pi * i / 7 + rnd.uniform(-0.2, 0.2)
        reach = 0.17 if i % 2 else 0.1
        x, y = reach * math.cos(angle), reach * math.sin(angle)
        _flower(mb, m, colours[i % len(colours)], (x * 0.5, y * 0.5, start), (x, y, rnd.uniform(0.72, 0.8)), 0.075)


def topiary_ball(mb, m, w, d, h):
    # A clipped ball of dark box leaves on a short trunk in a terracotta pot.
    start = _pot(mb, m, 0.3, 0.38)
    mb.stem((0.0, 0.0, start - 0.02), (0.0, 0.0, start + 0.12), 0.04, m["soil"], segments=5)
    mb.blob((0.0, 0.0, h - 0.38), 0.38, m["leaf_dark"], subdivisions=2)


# The lumps of a bush: (x, y, z) of each, its radii across and up, by share of the bush's half width and height.
BUSH = ((0.0, 0.0, 0.5, 0.75, 0.5), (-0.45, 0.2, 0.32, 0.5, 0.32), (0.45, 0.15, 0.3, 0.48, 0.3),
        (0.1, -0.4, 0.28, 0.5, 0.28))


def bush(mb, m, w, d, h):
    # A small natural bush straight from the lawn, no pot: four lumps of leaves, the tallest in the middle.
    for x, y, z, across, up in BUSH:
        mb.ellipsoid((x * w / 2, y * d / 2, z * h), (across * w / 2, across * d / 2, up * h), m["leaf"])


def topiary_cone(mb, m, w, d, h):
    # A clipped cone in two tiers, dark below and lighter at the tip, on a short trunk in a terracotta pot.
    start = _pot(mb, m, 0.28, 0.38)
    mb.stem((0.0, 0.0, start - 0.02), (0.0, 0.0, start + 0.1), 0.04, m["soil"], segments=5)
    mb.stem((0.0, 0.0, start + 0.08), (0.0, 0.0, 1.2), 0.33, m["leaf_dark"], radius_end=0.08, segments=8)
    mb.stem((0.0, 0.0, 1.0), (0.0, 0.0, h), 0.24, m["leaf"], radius_end=0.01, segments=8)


def _lettuce(mb, m, rnd, top):
    for row in (-0.27, 0.27):
        for i in range(5):
            x = -0.92 + 0.46 * i + rnd.uniform(-0.03, 0.03)
            colour = "cabbage" if (i + (row > 0)) % 2 else "leaf"
            mb.blob((x, row + rnd.uniform(-0.03, 0.03), top + 0.1), 0.2, m[colour], subdivisions=1, squash=0.75)


def _cabbage(mb, m, rnd, top):
    for row in (-0.27, 0.27):
        for i in range(4):
            x = -0.84 + 0.56 * i + rnd.uniform(-0.03, 0.03)
            mb.blob((x, row, top + 0.06), 0.24, m["leaf"], subdivisions=1, squash=0.45)  # the loose outer leaves
            mb.blob((x, row, top + 0.15), 0.18, m["cabbage"], subdivisions=2, squash=0.9)


def _carrot(mb, m, rnd, top):
    for row in (-0.32, 0.0, 0.32):
        for i in range(8):
            x = -0.98 + 0.28 * i + rnd.uniform(-0.03, 0.03)
            for k in range(3):  # a feathery top of three blades fanning out of the soil
                angle = 2 * math.pi * k / 3 + rnd.uniform(-0.3, 0.3)
                reach = rnd.uniform(0.06, 0.1)
                tip = (x + reach * math.cos(angle), row + reach * math.sin(angle), top + rnd.uniform(0.3, 0.42))
                mb.leaf((x, row, top), tip, 0.06, m["leaf"], belly=0.6)


def _herbs(mb, m, rnd, top):
    for row in (-0.27, 0.27):
        for i in range(3):
            x = -0.75 + 0.75 * i + rnd.uniform(-0.04, 0.04)
            mb.blob((x, row, top + 0.12), 0.24, m["leaf_dark" if (i + (row > 0)) % 2 else "leaf"], subdivisions=1,
                    squash=0.8)
            for k in range(2):  # a few blossoms on the basil and the chives
                mb.octahedron((x + rnd.uniform(-0.1, 0.1), row + rnd.uniform(-0.1, 0.1), top + 0.3), 0.04,
                              m["flower_white" if k else "flower_pink"])


CROP_BUILDERS = {"lettuce": _lettuce, "cabbage": _cabbage, "carrot": _carrot, "herbs": _herbs}


def raised_bed(mb, m, w, d, h, crop="lettuce"):
    # A teak raised bed 0.4 m high, filled with soil, planted with rows of one crop.
    if crop not in CROP_BUILDERS:
        raise ValueError(f"raised_bed crop must be one of {list(CROPS)}, got {crop!r}")
    _frame(mb, m, w, d, 0.4, 0.05, m["teak"])
    mb.box((-w / 2 + 0.05, -d / 2 + 0.05, 0.0), (w / 2 - 0.05, d / 2 - 0.05, 0.37), m["soil"])
    CROP_BUILDERS[crop](mb, m, random.Random(51 + CROPS.index(crop)), 0.37)


def tomato_trellis(mb, m, w, d, h):
    # A narrow teak bed with four tomato plants climbing bamboo stakes tied to a rail, ripe tomatoes among the leaves.
    rnd = random.Random(61)
    _frame(mb, m, w, d, 0.35, 0.05, m["teak"])
    mb.box((-w / 2 + 0.05, -d / 2 + 0.05, 0.0), (w / 2 - 0.05, d / 2 - 0.05, 0.32), m["soil"])
    stakes = (-0.9, -0.3, 0.3, 0.9)
    for x in stakes:
        mb.box((x - 0.015, -0.015, 0.3), (x + 0.015, 0.015, h), m["rattan"])
    mb.box((-1.0, -0.012, h - 0.12), (1.0, 0.012, h - 0.09), m["rattan"])
    for i, x in enumerate(stakes):
        for k, z in enumerate((0.62, 0.98, 1.32)):
            side = 0.05 if (i + k) % 2 else -0.05
            mb.blob((x + side, side, z), rnd.uniform(0.17, 0.2), m["leaf" if (i + k) % 2 else "leaf_dark"],
                    subdivisions=1, squash=0.85)
        for _ in range(5):
            angle = rnd.uniform(0.0, 2 * math.pi)
            mb.blob((x + 0.16 * math.cos(angle), 0.16 * math.sin(angle), rnd.uniform(0.55, 1.3)), 0.045,
                    m["flower_red"], subdivisions=1)


def wheelbarrow(mb, m, w, d, h):
    # A galvanised tray of soil on a teak frame: the wheel at the front (-Y), two legs and the handles at the back.
    mb.box((-0.28, -0.43, 0.3), (0.28, 0.33, 0.33), m["metal"])
    mb.box((-0.3, -0.45, 0.3), (0.3, -0.43, 0.62), m["metal"])
    mb.box((-0.3, 0.33, 0.3), (0.3, 0.35, 0.62), m["metal"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.3, sx * 0.28))
        mb.box((x0, -0.43, 0.3), (x1, 0.33, 0.62), m["metal"])
        mb.stem((sx * 0.2, -0.5, 0.17), (sx * 0.29, d / 2 - 0.01, 0.5), 0.02, m["teak"], segments=4)  # handle
        mb.box((sx * 0.22 - 0.02, 0.2, 0.0), (sx * 0.22 + 0.02, 0.24, 0.3), m["teak"])  # leg
    mb.stem((-0.045, -0.52, 0.16), (0.045, -0.52, 0.16), 0.16, m["frame"], segments=10)  # tyre, axle along X
    mb.blob((0.0, -0.05, 0.5), 0.25, m["soil"], subdivisions=1, squash=0.45)  # a load of soil


def watering_can(mb, m, w, d, h):
    # Galvanised can: body, a long spout to the front (+X) with its rose, a handle over the top and one at the back.
    mb.cylinder((0.0, 0.0, 0.0), 0.095, 0.26, m["metal"], segments=10)
    mb.stem((0.08, 0.0, 0.05), (0.205, 0.0, 0.28), 0.016, m["metal"], radius_end=0.011, segments=5)
    mb.stem((0.2, 0.0, 0.27), (0.225, 0.0, 0.3), 0.03, m["metal"], segments=6)
    mb.stem((-0.06, 0.0, 0.25), (0.0, 0.0, 0.34), 0.009, m["metal"], segments=4)
    mb.stem((0.0, 0.0, 0.34), (0.05, 0.0, 0.25), 0.009, m["metal"], segments=4)
    mb.stem((-0.09, 0.0, 0.23), (-0.2, 0.0, 0.17), 0.009, m["metal"], segments=4)
    mb.stem((-0.2, 0.0, 0.17), (-0.09, 0.0, 0.07), 0.009, m["metal"], segments=4)


def compost_bin(mb, m, w, d, h):
    # Teak slatted bin on four posts, heaped with compost.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - 0.03), sy * (d / 2 - 0.03)
            mb.box((x - 0.03, y - 0.03, 0.0), (x + 0.03, y + 0.03, h), m["teak"])
    for z in (0.08, 0.28, 0.48, 0.68):
        top = z + 0.14
        mb.box((-w / 2 + 0.06, -d / 2, z), (w / 2 - 0.06, -d / 2 + 0.03, top), m["teak"])
        mb.box((-w / 2 + 0.06, d / 2 - 0.03, z), (w / 2 - 0.06, d / 2, top), m["teak"])
        for sx in (-1, 1):
            x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.03)))
            mb.box((x0, -d / 2 + 0.06, z), (x1, d / 2 - 0.06, top), m["teak"])
    mb.box((-w / 2 + 0.03, -d / 2 + 0.03, 0.0), (w / 2 - 0.03, d / 2 - 0.03, 0.7), m["soil"])
    mb.blob((0.0, 0.0, 0.7), 0.4, m["soil"], subdivisions=1, squash=0.35)


def tool_shed(mb, m, w, d, h):
    # A small teak shed under a flat terracotta roof: a white-framed door at the front (-Y), a rake and a spade leaning
    # on its right side.
    mb.box((-0.85, -0.5, 0.0), (0.85, 0.5, 2.1), m["teak"])
    mb.box((-0.4, -0.52, 0.0), (0.4, -0.5, 1.9), m["white"])
    mb.box((-0.34, -0.53, 0.0), (0.34, -0.52, 1.84), m["teak"])
    mb.box((0.18, -0.545, 0.95), (0.26, -0.53, 0.99), m["metal"])  # door handle
    mb.box((-w / 2, -d / 2, 2.1), (w / 2, d / 2, h), m["terracotta"])
    mb.box((-w / 2 + 0.02, -d / 2 + 0.02, 2.06), (w / 2 - 0.02, d / 2 - 0.02, 2.1), m["white"])  # fascia under the roof
    for y, head in ((-0.2, "rake"), (0.2, "spade")):
        mb.stem((0.873, y, 0.12), (0.873, y + 0.05, 1.55), 0.012, m["teak"], segments=4)
        if head == "rake":
            mb.box((0.86, y - 0.16, 1.55), (0.886, y + 0.26, 1.6), m["metal"])
        else:
            mb.box((0.86, y - 0.08, 0.0), (0.882, y + 0.08, 0.26), m["metal"])


def bbq_grill(mb, m, w, d, h):
    # Charcoal grill cart: a dark firebox on four legs with a teak shelf below and a teak side table either side, a
    # grate of dark bars over the firebox (its coals are a bbq_coals of their own, GRILL_COALS_Z up), the lid standing
    # open at the back (+Y).
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.37, sy * 0.23
            mb.box((x - 0.02, y - 0.02, 0.0), (x + 0.02, y + 0.02, 0.7), m["frame"])
        x0, x1 = sorted((sx * 0.42, sx * w / 2))
        mb.box((x0, -0.22, 0.8), (x1, 0.22, 0.83), m["teak"])
        mb.box((sx * 0.4 - 0.01, -0.02, 0.74), (sx * 0.42 + 0.01, 0.02, 0.83), m["frame"])  # its bracket
    mb.box((-0.4, -0.26, 0.2), (0.4, 0.26, 0.23), m["teak"])
    mb.box((-0.4, -0.26, 0.7), (0.4, 0.26, GRILL_COALS_Z), m["frame"])
    for i in range(6):
        y = -0.2 + 0.08 * i
        mb.box((-0.38, y - 0.006, 0.9), (0.38, y + 0.006, 0.912), m["frame"])
    mb.box((-0.4, 0.24, 0.86), (0.4, 0.3, h), m["frame"])
    mb.box((-0.15, 0.3, h - 0.08), (0.15, 0.32, h - 0.05), m["metal"])  # the lid's handle


def bbq_coals(mb, m, w, d, h):
    # The bed of charcoal in a grill's firebox (M_ember, which glows), under the grill's grate.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, h), m["ember"])


def outdoor_kitchen(mb, m, w, d, h):
    # A travertine counter with teak doors and drawers, a steel sink set into its travertine worktop at the right.
    mb.box((-1.25, -0.3, 0.0), (1.25, 0.35, 0.9), m["stone"], uv_tile=2.0)
    _fronts(mb, -1.2, 1.2, 0.08, 0.84, -0.32, m["teak"], 5)
    sink = (0.5, 0.9, -0.15, 0.15)  # x0, x1, y0, y1 of the hole in the worktop
    mb.box((-w / 2, -d / 2, 0.9), (sink[0], d / 2, h), m["stone"], uv_tile=2.0)
    mb.box((sink[1], -d / 2, 0.9), (w / 2, d / 2, h), m["stone"], uv_tile=2.0)
    mb.box((sink[0], -d / 2, 0.9), (sink[1], sink[2], h), m["stone"], uv_tile=2.0)
    mb.box((sink[0], sink[3], 0.9), (sink[1], d / 2, h), m["stone"], uv_tile=2.0)
    mb.box((sink[0], sink[2], 0.86), (sink[1], sink[3], 0.92), m["metal"])


def _teak_chair(mb, m, x, y, facing, axis="y", seat=0.46):
    """Teak dining chair with a linen seat cushion centred at (x, y), facing +axis when facing = 1 (its back behind)."""
    s = seat / 2
    mb.box((x - s, y - s, 0.4), (x + s, y + s, 0.44), m["teak"])
    mb.box((x - s + 0.02, y - s + 0.02, 0.44), (x + s - 0.02, y + s - 0.02, 0.5), m["linen"])
    if axis == "x":
        back = x - facing * s
        x0, x1 = sorted((back, back + facing * 0.05))
        mb.box((x0, y - s, 0.44), (x1, y + s, 0.92), m["teak"])
    else:
        back = y - facing * s
        y0, y1 = sorted((back, back + facing * 0.05))
        mb.box((x - s, y0, 0.44), (x + s, y1, 0.92), m["teak"])
    for lx in (x - s + 0.03, x + s - 0.03):
        for ly in (y - s + 0.03, y + s - 0.03):
            mb.box((lx - 0.0175, ly - 0.0175, 0.0), (lx + 0.0175, ly + 0.0175, 0.4), m["teak"])


def dining_set_6(mb, m, w, d, h):
    # Teak table for six: two chairs on each long side, one at each end, all facing the table.
    mb.box((-0.9, -0.45, 0.72), (0.9, 0.45, 0.76), m["teak"])
    _legs(mb, 1.8, 0.9, 0.72, m["teak"], inset=0.08, size=0.07)
    for x in (-0.45, 0.45):
        for sy in (-1, 1):
            _teak_chair(mb, m, x, sy * (d / 2 - 0.23), facing=-sy)
    for sx in (-1, 1):
        _teak_chair(mb, m, sx * (w / 2 - 0.23), 0.0, facing=-sx, axis="x")


def parasol(mb, m, w, d, h):
    # A linen market parasol: travertine base, teak pole, an eight-sided canopy overhead and a teak finial.
    mb.cylinder((0.0, 0.0, 0.0), 0.25, 0.1, m["stone"], segments=10)
    mb.cylinder((0.0, 0.0, 0.1), 0.03, h - 0.2, m["teak"], segments=6)
    mb.stem((0.0, 0.0, 1.95), (0.0, 0.0, h - 0.1), w / 2, m["linen"], radius_end=0.06, segments=8)
    mb.cylinder((0.0, 0.0, h - 0.1), 0.04, 0.1, m["teak"], segments=6)


def pillar_lamp(mb, m, w, d, h):
    # Lantern for the top of a gate pillar: a dark base plate, four slim corner posts round a tall glowing core (it has
    # to read from the wallpaper at night), a dark cap.
    mb.box((-0.13, -0.13, 0.0), (0.13, 0.13, 0.04), m["frame"])
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.115, sy * 0.115
            mb.box((x - 0.01, y - 0.01, 0.04), (x + 0.01, y + 0.01, 0.38), m["frame"])
    mb.box((-0.105, -0.105, 0.05), (0.105, 0.105, 0.37), m["led"])
    mb.box((-w / 2, -d / 2, 0.38), (w / 2, d / 2, 0.42), m["frame"])
    mb.box((-0.04, -0.04, 0.42), (0.04, 0.04, h), m["frame"])


BUILDERS = {
    "flower_bed": flower_bed, "flower_pot": flower_pot, "topiary_ball": topiary_ball, "topiary_cone": topiary_cone,
    "raised_bed": raised_bed, "tomato_trellis": tomato_trellis, "wheelbarrow": wheelbarrow,
    "watering_can": watering_can, "compost_bin": compost_bin, "tool_shed": tool_shed, "bbq_grill": bbq_grill,
    "bbq_coals": bbq_coals, "outdoor_kitchen": outdoor_kitchen, "dining_set_6": dining_set_6, "parasol": parasol,
    "pillar_lamp": pillar_lamp, "bush": bush,
}

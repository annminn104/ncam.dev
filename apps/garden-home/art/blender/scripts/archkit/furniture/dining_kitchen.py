"""Dining, kitchen and bar furniture: dining sets, sideboard, kitchen counter, kitchen run, fridge tower, islands and
the wine cabinet."""
from ._parts import _chair, _fronts, _legs


def dining_set(mb, m, w, d, h):
    tw, td = 2.2, 1.0
    mb.box((-tw / 2, -td / 2, 0.72), (tw / 2, td / 2, 0.76), m["wood"], uv_tile=2.0)
    for sx in (-1, 1):
        x = sx * (tw / 2 - 0.25)
        mb.box((x - 0.04, -td / 2 + 0.1, 0.0), (x + 0.04, td / 2 - 0.1, 0.72), m["frame"])
    for sy in (-1, 1):
        for x in (-0.75, 0.0, 0.75):
            _chair(mb, m, x, sy * (td / 2 + 0.3), facing=-sy)


def kitchen_counter(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2 + 0.05, 0.0), (w / 2, d / 2, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2, 0.1), (w / 2, d / 2, 0.86), m["white"])
    mb.box((-w / 2, -d / 2, 0.86), (w / 2, d / 2, 0.9), m["counter"])
    mb.box((-w / 2, d / 2 - 0.35, 1.5), (w / 2, d / 2, h), m["wood"], uv_tile=2.0)


def kitchen_island(mb, m, w, d, h):
    mb.box((-w / 2, -0.3, 0.0), (w / 2, 0.5, 0.86), m["wood"], uv_tile=2.0)
    mb.box((-w / 2, -0.5, 0.86), (w / 2, 0.5, h), m["counter"])
    for x in (-0.8, 0.0, 0.8):
        mb.cylinder((x, -0.65, 0.0), 0.03, 0.62, m["frame"], segments=6)
        mb.cylinder((x, -0.65, 0.62), 0.18, 0.05, m["fabric_dark"], segments=12)


def dining_set_8(mb, m, w, d, h):
    td = 1.0
    mb.box((-w / 2, -td / 2, 0.72), (w / 2, td / 2, 0.76), m["wood"], uv_tile=2.0)
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.35)
        mb.box((x - 0.04, -td / 2 + 0.1, 0.0), (x + 0.04, td / 2 - 0.1, 0.72), m["frame"])
    for sy in (-1, 1):
        for x in (-1.05, -0.35, 0.35, 1.05):
            _chair(mb, m, x, sy * (td / 2 + 0.3), facing=-sy)


def sideboard(mb, m, w, d, h):
    # Low wood cabinet on frame legs with a vase on top.
    _legs(mb, w, d, 0.15, m["frame"], inset=0.05)
    mb.box((-w / 2, -d / 2 + 0.02, 0.15), (w / 2, d / 2, 0.66), m["wood"], uv_tile=2.0)
    _fronts(mb, -w / 2, w / 2, 0.15, 0.66, -d / 2, m["wood"], 3, uv_tile=2.0)
    mb.box((-w / 2, -d / 2, 0.66), (w / 2, d / 2, 0.69), m["wood"], uv_tile=2.0)
    mb.cylinder((0.55, 0.0, 0.69), 0.07, 0.1, m["ceramic"], segments=8)
    mb.cylinder((0.55, 0.0, 0.79), 0.035, 0.06, m["ceramic"], segments=8)


def kitchen_run(mb, m, w, d, h):
    # Base cabinets with white doors, a worktop with sink and cooktop, a hood between two runs of wall cabinets and a
    # coffee machine at the right-hand end. Cabinet fronts leave 1 cm gaps that show the dark carcass.
    mb.box((-w / 2, -d / 2 + 0.05, 0.0), (w / 2, d / 2, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2 + 0.02, 0.1), (w / 2, d / 2, 0.86), m["frame"])
    _fronts(mb, -w / 2, w / 2, 0.1, 0.86, -d / 2, m["white"], 9)
    mb.box((-w / 2, -d / 2, 0.86), (w / 2, d / 2, 0.9), m["counter"])
    # sink: dark basin inside a steel rim, tap behind it
    sx, hob = -1.6, 0.5
    mb.box((sx - 0.3, -0.2, 0.9), (sx + 0.3, 0.16, 0.904), m["frame"])
    for (x0, y0, x1, y1) in ((sx - 0.33, -0.23, sx + 0.33, -0.2), (sx - 0.33, 0.16, sx + 0.33, 0.19),
                             (sx - 0.33, -0.2, sx - 0.3, 0.16), (sx + 0.3, -0.2, sx + 0.33, 0.16)):
        mb.box((x0, y0, 0.9), (x1, y1, 0.915), m["metal"])
    mb.cylinder((sx, 0.24, 0.9), 0.014, 0.25, m["metal"], segments=6)
    mb.box((sx - 0.012, 0.06, 1.12), (sx + 0.012, 0.25, 1.15), m["metal"])
    # cooktop with four hobs, and the hood above it
    mb.box((hob - 0.3, -0.25, 0.9), (hob + 0.3, 0.2, 0.905), m["screen"])
    for hx in (hob - 0.15, hob + 0.15):
        for hy in (-0.12, 0.08):
            mb.cylinder((hx, hy, 0.905), 0.07, 0.003, m["metal"], segments=8)
    mb.box((hob - 0.45, -0.1, 1.55), (hob + 0.45, d / 2, 1.72), m["metal"])
    mb.box((hob - 0.17, 0.15, 1.72), (hob + 0.17, d / 2, h), m["metal"])
    # wall cabinets
    for x0, x1, doors in ((-w / 2, hob - 0.5, 4), (hob + 0.5, w / 2, 3)):
        mb.box((x0, -0.025, 1.5), (x1, d / 2, h), m["frame"])
        _fronts(mb, x0, x1, 1.5, h, -0.045, m["wood"], doors, uv_tile=2.0)
    # coffee machine
    cx = 2.2
    mb.box((cx - 0.15, 0.0, 0.9), (cx + 0.15, 0.28, 0.94), m["frame"])
    mb.box((cx - 0.15, 0.15, 0.94), (cx + 0.15, 0.3, 1.32), m["metal"])
    mb.box((cx - 0.15, 0.02, 1.12), (cx + 0.15, 0.3, 1.32), m["frame"])
    mb.cylinder((cx, 0.08, 0.94), 0.04, 0.08, m["white"], segments=8)


def fridge_tower(mb, m, w, d, h):
    # Left half: double-door steel fridge. Right half: white oven column with two dark oven doors and a drawer.
    front = -d / 2 + 0.04  # carcass front; door slabs stand 2.5 cm proud of it, handles 1.5 cm more
    mb.box((-w / 2, front, 0.0), (0.0, d / 2, h), m["frame"])
    _fronts(mb, -w / 2, 0.0, 0.05, h - 0.03, front - 0.025, m["metal"], 2, depth=0.025)
    for x in (-0.5, -0.4):
        mb.box((x - 0.012, -d / 2, 0.9), (x + 0.012, front - 0.025, 1.6), m["frame"])
    mb.box((0.0, front, 0.0), (w / 2, d / 2, h), m["white"])
    for z0, z1 in ((0.75, 1.35), (1.45, 2.05)):
        mb.box((0.1, front - 0.025, z0), (0.8, front, z1), m["screen"])
        mb.box((0.15, -d / 2, z1 - 0.1), (0.75, front - 0.025, z1 - 0.07), m["metal"])
    mb.box((0.05, front - 0.025, 0.05), (0.85, front, 0.65), m["white"])
    mb.box((0.15, -d / 2, 0.55), (0.75, front - 0.025, 0.58), m["metal"])


def kitchen_island_4(mb, m, w, d, h):
    # Island 2.8 x 1.0 on the +Y side, its counter overhanging the front; four bar stools on the -Y side.
    mb.box((-w / 2 + 0.05, 0.1, 0.0), (w / 2 - 0.05, d / 2 - 0.05, 0.08), m["frame"])
    mb.box((-w / 2, 0.05, 0.08), (w / 2, d / 2, 0.9), m["wood"], uv_tile=2.0)
    mb.box((-w / 2, -0.15, 0.9), (w / 2, d / 2, h), m["counter"])
    for i in range(4):
        x = (i - 1.5) * 0.67
        mb.cylinder((x, -0.5, 0.0), 0.14, 0.02, m["frame"], segments=8)
        mb.cylinder((x, -0.5, 0.0), 0.03, 0.6, m["frame"], segments=6)
        mb.cylinder((x, -0.5, 0.6), 0.18, 0.06, m["fabric_dark"], segments=12)


def bar_cabinet(mb, m, w, d, h):
    # Dark wine cabinet: closed base, open shelves of bottles with an LED strip under every board.
    mb.box((-w / 2, -d / 2 + 0.04, 0.0), (w / 2, d / 2, 0.8), m["frame"])
    _fronts(mb, -w / 2, w / 2, 0.04, 0.78, -d / 2 + 0.02, m["frame"], 2)
    for x in (-0.07, 0.07):
        mb.box((x - 0.01, -d / 2, 0.5), (x + 0.01, -d / 2 + 0.02, 0.7), m["metal"])
    mb.box((-w / 2, -d / 2, 0.8), (w / 2, d / 2, 0.84), m["frame"])
    mb.box((-w / 2 + 0.03, d / 2 - 0.03, 0.84), (w / 2 - 0.03, d / 2, h), m["frame"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.03)))
        mb.box((x0, -d / 2, 0.84), (x1, d / 2, h), m["frame"])
    for z in (1.2, 1.55, 1.9, h - 0.03):
        mb.box((-w / 2 + 0.03, -d / 2, z), (w / 2 - 0.03, d / 2, z + 0.03), m["frame"])
        mb.box((-w / 2 + 0.06, -d / 2 + 0.02, z - 0.012), (w / 2 - 0.06, -d / 2 + 0.05, z), m["led"])
    for row, z in enumerate((0.84, 1.23, 1.58)):
        for i in range(6):
            mb.cylinder((-0.8 + i * 0.32, 0.05, z), 0.033, 0.3, m["grape" if (i + row) % 2 else "leaf"], segments=6)


BUILDERS = {
    "dining_set": dining_set, "kitchen_counter": kitchen_counter, "kitchen_island": kitchen_island,
    "dining_set_8": dining_set_8, "sideboard": sideboard, "kitchen_run": kitchen_run, "fridge_tower": fridge_tower,
    "kitchen_island_4": kitchen_island_4, "bar_cabinet": bar_cabinet,
}

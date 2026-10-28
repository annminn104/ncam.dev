"""Bath and laundry furniture: toilet, vanities, bathtub, shower, towel rack, washer and dryer, laundry shelf."""
from ._parts import _fronts


def toilet(mb, m, w, d, h):
    # Wall-hung style: tall tank against the wall (+Y) with a steel flush plate, oval bowl and a closed seat.
    mb.box((-0.18, 0.2, 0.3), (0.18, d / 2, h), m["ceramic"])
    mb.box((-0.07, 0.185, 0.58), (0.07, 0.2, 0.72), m["metal"])
    mb.box((-0.17, -0.12, 0.2), (0.17, 0.2, 0.42), m["ceramic"])
    mb.cylinder((0.0, -0.12, 0.2), 0.17, 0.22, m["ceramic"], segments=12)
    mb.box((-0.18, -0.12, 0.42), (0.18, 0.2, 0.46), m["ceramic"])
    mb.cylinder((0.0, -0.12, 0.42), 0.18, 0.04, m["ceramic"], segments=12)


def _vanity(mb, m, w, d, h, basins):
    # Wood cabinet on a dark plinth with a ceramic top; each basin gets a vessel bowl, a steel tap and its own mirror.
    mb.box((-w / 2 + 0.05, -d / 2 + 0.05, 0.0), (w / 2 - 0.05, d / 2 - 0.05, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2 + 0.02, 0.1), (w / 2, d / 2, 0.8), m["wood"], uv_tile=2.0)
    _fronts(mb, -w / 2, w / 2, 0.1, 0.8, -d / 2, m["wood"], 2 * basins, uv_tile=2.0)
    mb.box((-w / 2, -d / 2, 0.8), (w / 2, d / 2, 0.84), m["ceramic"])
    mirror = w / basins - 0.1
    for i in range(basins):
        x = -w / 2 + (i + 0.5) * w / basins
        mb.cylinder((x, -0.02, 0.84), 0.17, 0.09, m["ceramic"], segments=12)
        mb.cylinder((x, -0.02, 0.93), 0.145, 0.004, m["screen"], segments=8)
        mb.cylinder((x, 0.17, 0.84), 0.012, 0.2, m["metal"], segments=6)
        mb.box((x - 0.012, 0.03, 1.02), (x + 0.012, 0.18, 1.04), m["metal"])
        mb.box((x - mirror / 2, d / 2 - 0.025, 1.1), (x + mirror / 2, d / 2, h), m["frame"])
        mb.box((x - mirror / 2 + 0.03, d / 2 - 0.04, 1.13), (x + mirror / 2 - 0.03, d / 2 - 0.025, h - 0.03), m["metal"])


def vanity_single(mb, m, w, d, h):
    _vanity(mb, m, w, d, h, basins=1)


def vanity_double(mb, m, w, d, h):
    _vanity(mb, m, w, d, h, basins=2)


def bathtub(mb, m, w, d, h):
    # Hollow tub on a dark plinth (tiled floor, four ceramic walls, rim at 0.5 m) and a steel floor-standing tap that
    # arcs over the rim at the +X end.
    left, right, wall = -w / 2, w / 2 - 0.15, 0.06
    mb.box((left + 0.05, -d / 2 + 0.05, 0.0), (right - 0.05, d / 2 - 0.05, 0.05), m["frame"])
    mb.box((left, -d / 2, 0.05), (right, d / 2, 0.14), m["tile_bath"])
    for y0, y1 in ((-d / 2, -d / 2 + wall), (d / 2 - wall, d / 2)):
        mb.box((left, y0, 0.14), (right, y1, 0.5), m["ceramic"])
    for x0, x1 in ((left, left + wall), (right - wall, right)):
        mb.box((x0, -d / 2 + wall, 0.14), (x1, d / 2 - wall, 0.5), m["ceramic"])
    mb.cylinder((right + 0.08, 0.0, 0.0), 0.018, h, m["metal"], segments=6)
    mb.box((right - 0.06, -0.015, h - 0.03), (right + 0.09, 0.015, h), m["metal"])


def shower(mb, m, w, d, h):
    # Corner stall: tile tray, glass on the front (-Y) and +X sides with a steel handle, rain head on a wall pipe.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.06), m["tile_bath"])
    mb.box((-w / 2, -d / 2, 0.06), (w / 2, -d / 2 + 0.015, 2.06), m["glass"])
    mb.box((w / 2 - 0.015, -d / 2 + 0.015, 0.06), (w / 2, d / 2, 2.06), m["glass"])
    mb.box((0.27, -d / 2 + 0.015, 0.9), (0.31, -d / 2 + 0.03, 1.3), m["metal"])
    mb.cylinder((-0.3, 0.46, 0.06), 0.012, 1.98, m["metal"], segments=6)
    mb.box((-0.312, 0.2, 2.03), (-0.288, 0.472, 2.05), m["metal"])
    mb.cylinder((-0.3, 0.2, 2.03), 0.12, 0.02, m["metal"], segments=12)


def towel_rack(mb, m, w, d, h):
    # Steel ladder rack with three folded towels draped over its rungs.
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.02)
        mb.box((x - 0.015, -0.03, 0.05), (x + 0.015, 0.03, h), m["metal"])
    for z in (0.3, 0.55, 0.8, 1.05):
        mb.box((-w / 2 + 0.03, -0.012, z), (w / 2 - 0.03, 0.012, z + 0.025), m["metal"])
    for colour, x, half, z0, z1 in (("white", 0.0, 0.22, 0.82, 1.08), ("fabric", 0.0, 0.2, 0.35, 0.58),
                                    ("cushion", 0.0, 0.18, 0.08, 0.32)):
        mb.box((x - half, -0.05, z0), (x + half, 0.05, z1), m[colour])


def washer_dryer(mb, m, w, d, h):
    # Washer and dryer side by side: white bodies, steel-ringed round doors facing front, dark control strips.
    front = -d / 2 + 0.02
    for x in (-w / 4, w / 4):
        mb.box((x - 0.31, front, 0.0), (x + 0.31, d / 2, h), m["white"])
        mb.cylinder((x, front - 0.01, 0.45), 0.2, 0.01, m["metal"], segments=12, axis="y")
        mb.cylinder((x, -d / 2, 0.45), 0.17, 0.02, m["screen"], segments=12, axis="y")
        mb.box((x - 0.2, front - 0.01, 0.78), (x + 0.2, front, 0.86), m["screen"])


def laundry_shelf(mb, m, w, d, h):
    # Floating shelf on two steel brackets: two baskets, a folded towel and a detergent bottle.
    for sx in (-1, 1):
        mb.box((sx * 0.5 - 0.015, -0.12, 0.0), (sx * 0.5 + 0.015, 0.15, 0.08), m["metal"])
    mb.box((-w / 2, -d / 2, 0.08), (w / 2, d / 2, 0.11), m["wood"], uv_tile=2.0)
    mb.box((-0.6, -0.12, 0.11), (-0.2, 0.12, 0.3), m["fabric"])
    mb.box((-0.15, -0.12, 0.11), (0.25, 0.12, 0.28), m["cushion"])
    mb.box((-0.12, -0.1, 0.28), (0.22, 0.1, 0.33), m["white"])
    mb.cylinder((0.45, 0.0, 0.11), 0.045, 0.28, m["ceramic"], segments=8)


BUILDERS = {
    "toilet": toilet, "vanity_single": vanity_single, "vanity_double": vanity_double, "bathtub": bathtub,
    "shower": shower, "towel_rack": towel_rack, "washer_dryer": washer_dryer, "laundry_shelf": laundry_shelf,
}

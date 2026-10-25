"""Bedroom, closet and study furniture: beds, nightstands, wardrobe, desk, dresser, bedroom TV and clothes rack."""
import random

from ._parts import _chair, _fronts, _legs


def _bed(mb, m, w, d, h, pillows):
    mb.box((-w / 2, -d / 2, 0.1), (w / 2, d / 2 - 0.1, 0.32), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.05, -d / 2 + 0.05, 0.32), (w / 2 - 0.05, d / 2 - 0.15, 0.52), m["fabric"])
    mb.box((-w / 2, d / 2 - 0.1, 0.0), (w / 2, d / 2, h), m["fabric_dark"])
    mb.box((-w / 2 + 0.03, -d / 2 + 0.03, 0.52), (w / 2 - 0.03, 0.2, 0.56), m["fabric_dark"])
    for i in range(pillows):
        x = -w / 2 + (i + 0.5) * w / pillows
        mb.blob((x, d / 2 - 0.4, 0.6), min(0.32, w / pillows * 0.4), m["fabric"], subdivisions=1, squash=0.35)


def bed_double(mb, m, w, d, h):
    _bed(mb, m, w, d, h, pillows=2)


def bed_single(mb, m, w, d, h):
    _bed(mb, m, w, d, h, pillows=1)


def nightstand(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, 0.08), (w / 2, d / 2, h), m["wood"], uv_tile=2.0)
    _legs(mb, w, d, 0.08, m["frame"])


def wardrobe(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2 + 0.02, 0.0), (w / 2, d / 2, h), m["white"])
    for i in range(3):
        x0, x1 = -w / 2 + i * w / 3 + 0.01, -w / 2 + (i + 1) * w / 3 - 0.01
        mb.box((x0, -d / 2, 0.05), (x1, -d / 2 + 0.02, h - 0.05), m["wood"], uv_tile=2.0)


def desk(mb, m, w, d, h):
    top_d = 0.6
    mb.box((-w / 2, d / 2 - top_d, 0.72), (w / 2, d / 2, 0.76), m["wood"], uv_tile=2.0)
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.03)
        mb.box((x - 0.02, d / 2 - top_d + 0.03, 0.0), (x + 0.02, d / 2 - 0.03, 0.72), m["frame"])
    _chair(mb, m, 0.0, -d / 2 + 0.25, facing=1)


def bed_king(mb, m, w, d, h):
    # Upholstered headboard at the +Y end, wood base on short feet, mattress, duvet with a folded throw, four pillows.
    mb.box((-w / 2, d / 2 - 0.12, 0.1), (w / 2, d / 2, h), m["cushion"])
    mb.box((-w / 2, -d / 2, 0.12), (w / 2, d / 2 - 0.12, 0.3), m["wood"], uv_tile=2.0)
    for sx in (-1, 1):
        for y in (-d / 2 + 0.06, d / 2 - 0.06):
            x = sx * (w / 2 - 0.06)
            mb.box((x - 0.03, y - 0.03, 0.0), (x + 0.03, y + 0.03, 0.12), m["frame"])
    mb.box((-w / 2 + 0.05, -d / 2 + 0.03, 0.3), (w / 2 - 0.05, d / 2 - 0.12, 0.52), m["white"])
    mb.box((-w / 2 + 0.03, -d / 2, 0.52), (w / 2 - 0.03, 0.25, 0.58), m["fabric"])
    mb.box((-w / 2 + 0.03, -0.85, 0.58), (w / 2 - 0.03, -0.55, 0.61), m["fabric_dark"])
    for x in (-0.5, 0.5):
        mb.blob((x, 0.73, 0.62), 0.3, m["white"], subdivisions=1, squash=0.35)
    for x in (-0.2, 0.2):
        mb.blob((x, 0.42, 0.62), 0.18, m["fabric_dark"], subdivisions=1, squash=0.4)


def nightstand_lamp(mb, m, w, d, h):
    # Two-drawer nightstand with a small table lamp whose shade glows.
    _legs(mb, w, d, 0.08, m["frame"])
    mb.box((-w / 2, -d / 2 + 0.03, 0.08), (w / 2, d / 2, 0.5), m["wood"], uv_tile=2.0)
    for z0, z1 in ((0.08, 0.28), (0.29, 0.5)):
        _fronts(mb, -w / 2, w / 2, z0, z1, -d / 2 + 0.01, m["wood"], 1, uv_tile=2.0)
        mb.box((-0.06, -d / 2, (z0 + z1) / 2), (0.06, -d / 2 + 0.01, (z0 + z1) / 2 + 0.015), m["metal"])
    mb.cylinder((0.0, 0.03, 0.5), 0.06, 0.015, m["frame"], segments=8)
    mb.cylinder((0.0, 0.03, 0.515), 0.01, 0.2, m["frame"], segments=6)
    mb.cylinder((0.0, 0.03, 0.7), 0.12, h - 0.7, m["led"], segments=10)


def dresser_mirror(mb, m, w, d, h):
    # Dressing table against the wall (+Y) with a drawer block and a steel mirror in a dark frame, stool in front.
    mb.box((-w / 2, 0.0, 0.72), (w / 2, d / 2, 0.76), m["wood"], uv_tile=2.0)
    for sx in (-1, 1):
        for y in (0.03, d / 2 - 0.03):
            x = sx * (w / 2 - 0.03)
            mb.box((x - 0.02, y - 0.02, 0.0), (x + 0.02, y + 0.02, 0.72), m["frame"])
    mb.box((0.15, 0.03, 0.4), (w / 2 - 0.05, d / 2 - 0.03, 0.72), m["wood"], uv_tile=2.0)
    mb.box((-0.4, d / 2 - 0.05, 0.8), (0.4, d / 2, h), m["frame"])
    mb.box((-0.36, d / 2 - 0.065, 0.84), (0.36, d / 2 - 0.05, h - 0.04), m["metal"])
    mb.cylinder((0.0, -0.22, 0.4), 0.19, 0.06, m["cushion"], segments=12)
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box((sx * 0.1 - 0.015, -0.22 + sy * 0.1 - 0.015, 0.0), (sx * 0.1 + 0.015, -0.22 + sy * 0.1 + 0.015, 0.4),
                   m["frame"])


def tv_cabinet(mb, m, w, d, h):
    # Low cabinet with a ~50" TV on a neck stand at the back of its top.
    mb.box((-w / 2 + 0.05, -0.2, 0.0), (w / 2 - 0.05, 0.2, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2 + 0.02, 0.1), (w / 2, d / 2, 0.5), m["wood"], uv_tile=2.0)
    _fronts(mb, -w / 2, w / 2, 0.1, 0.47, -d / 2, m["wood"], 2, uv_tile=2.0)
    mb.box((-w / 2, -d / 2, 0.47), (w / 2, d / 2, 0.5), m["wood"], uv_tile=2.0)
    mb.box((-0.2, 0.12, 0.5), (0.2, 0.22, 0.52), m["frame"])
    mb.box((-0.04, 0.17, 0.52), (0.04, 0.21, 0.84), m["frame"])
    mb.box((-0.58, 0.17, 0.84), (0.58, 0.21, h), m["frame"])
    mb.box((-0.55, 0.15, 0.87), (0.55, 0.17, h - 0.03), m["screen_on"])


def closet_rack(mb, m, w, d, h):
    # Open clothes rack: dark posts, white back, top shelf, a rail of hanging clothes over a two-row drawer base.
    rnd = random.Random(7)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.03)))
        mb.box((x0, -d / 2, 0.0), (x1, d / 2, h), m["frame"])
    mb.box((-w / 2 + 0.03, d / 2 - 0.02, 0.0), (w / 2 - 0.03, d / 2, h), m["white"])
    mb.box((-w / 2 + 0.03, -d / 2, h - 0.04), (w / 2 - 0.03, d / 2 - 0.02, h), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.03, -0.01, 1.9), (w / 2 - 0.03, 0.01, 1.92), m["metal"])
    for i in range(14):
        x = -w / 2 + 0.1 + i * 0.13
        colour = ("fabric", "fabric_dark", "grape", "cushion", "white", "leaf", "frame")[i % 7]
        mb.box((x, -0.2, 1.9 - rnd.uniform(0.6, 1.0)), (x + 0.05, 0.2, 1.9), m[colour])
    mb.box((-w / 2 + 0.03, -d / 2 + 0.02, 0.0), (w / 2 - 0.03, d / 2 - 0.02, 0.55), m["white"])
    for z0, z1 in ((0.03, 0.29), (0.29, 0.55)):
        _fronts(mb, -w / 2 + 0.03, w / 2 - 0.03, z0, z1, -d / 2, m["wood"], 2, uv_tile=2.0)


BUILDERS = {
    "bed_double": bed_double, "bed_single": bed_single, "nightstand": nightstand, "wardrobe": wardrobe, "desk": desk,
    "bed_king": bed_king, "nightstand_lamp": nightstand_lamp, "dresser_mirror": dresser_mirror,
    "tv_cabinet": tv_cabinet, "closet_rack": closet_rack,
}

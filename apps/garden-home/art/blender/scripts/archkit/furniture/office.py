"""Office and study furniture: gaming desk and chair, floating wall shelf and a narrow bookcase."""
import math
import random

from ._parts import _bookcase, _books


def _monitor(mb, m, x, y, turn):
    """27" monitor on a stand, centred on (x, y) and turned `turn` radians about Z (positive swings its face to +X)."""
    sin, cos = math.sin(turn), math.cos(turn)

    def part(back, width, depth, z0, z1, mat):
        # a box centred `back` metres behind the monitor's axis, turned with it
        cx, cy = x - back * sin, y + back * cos
        mb.box((cx - width / 2, cy - depth / 2, z0), (cx + width / 2, cy + depth / 2, z1), mat, rot_z=turn)

    part(0.05, 0.22, 0.14, 0.76, 0.772, m["frame"])
    part(0.03, 0.05, 0.03, 0.772, 0.9, m["frame"])
    part(0.0, 0.62, 0.03, 0.9, 1.3, m["frame"])
    part(-0.0125, 0.58, 0.015, 0.92, 1.28, m["screen_on"])


def gaming_desk(mb, m, w, d, h):
    # L-shaped desk: the long side along the back (+Y), the return on +X. Three monitors on the long side (the outer
    # two angled in), RGB PC tower on the return, keyboard, mouse and two speakers.
    mb.box((-w / 2, 0.1, 0.72), (w / 2, d / 2, 0.76), m["fabric_dark"])
    mb.box((0.4, -d / 2, 0.72), (w / 2, 0.1, 0.76), m["fabric_dark"])
    mb.box((-w / 2, 0.14, 0.0), (-w / 2 + 0.04, d / 2 - 0.02, 0.72), m["frame"])
    mb.box((w / 2 - 0.04, -d / 2 + 0.02, 0.0), (w / 2, d / 2 - 0.02, 0.72), m["frame"])
    mb.box((0.4, -d / 2 + 0.02, 0.0), (0.44, -0.2, 0.72), m["frame"])
    mb.box((-1.0, 0.12, 0.7), (0.4, 0.14, 0.72), m["rgb"])
    _monitor(mb, m, 0.0, 0.58, 0.0)
    _monitor(mb, m, -0.64, 0.52, math.radians(20))
    _monitor(mb, m, 0.64, 0.52, math.radians(-20))
    mb.box((0.68, -0.62, 0.76), (0.92, -0.18, 1.2), m["frame"])
    for x0, x1 in ((0.70, 0.72), (0.88, 0.90)):
        mb.box((x0, -0.63, 0.82), (x1, -0.62, 1.14), m["rgb"])
    for z0, z1 in ((0.84, 0.88), (1.08, 1.12)):
        mb.box((0.675, -0.58, z0), (0.68, -0.22, z1), m["rgb"])
    mb.box((-0.25, 0.14, 0.76), (0.19, 0.28, 0.78), m["metal"])
    mb.box((0.3, 0.17, 0.76), (0.36, 0.27, 0.785), m["frame"])
    for x in (-1.02, 1.02):
        mb.box((x - 0.06, 0.59, 0.76), (x + 0.06, 0.71, 1.01), m["frame"])


def gaming_chair(mb, m, w, d, h):
    # Racing bucket seat on a five-spoke base with casters: tall back, shoulder wings, headrest, a lit centre stripe.
    for i in range(5):
        a = math.radians(90 + 72 * i)
        mb.box((0.15 * math.cos(a) - 0.15, 0.15 * math.sin(a) - 0.025, 0.06),
               (0.15 * math.cos(a) + 0.15, 0.15 * math.sin(a) + 0.025, 0.1), m["frame"], rot_z=a)
        ex, ey = 0.28 * math.cos(a), 0.28 * math.sin(a)
        mb.box((ex - 0.025, ey - 0.025, 0.0), (ex + 0.025, ey + 0.025, 0.06), m["frame"])
    mb.cylinder((0.0, 0.0, 0.1), 0.03, 0.32, m["frame"], segments=6)
    mb.box((-0.25, -0.25, 0.42), (0.25, 0.25, 0.5), m["fabric_dark"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.25, sx * 0.3))  # seat bolster and the wing of the back
        mb.box((x0, -0.25, 0.5), (x1, 0.15, 0.58), m["fabric_dark"])
        mb.box((x0, 0.1, 0.58), (x1, 0.3, 1.0), m["fabric_dark"])
        x0, x1 = sorted((sx * 0.3, sx * 0.34))  # armrest post and pad
        mb.box((x0, -0.04, 0.5), (x1, 0.04, 0.65), m["frame"])
        mb.box((x0 - 0.005, -0.12, 0.65), (x1 + 0.005, 0.12, 0.69), m["fabric_dark"])
    mb.box((-0.23, 0.2, 0.5), (0.23, 0.3, 0.95), m["fabric_dark"])
    mb.box((-0.17, 0.2, 0.95), (0.17, 0.3, h), m["fabric_dark"])
    mb.box((-0.025, 0.19, 0.55), (0.025, 0.2, 1.27), m["rgb"])


def wall_shelf(mb, m, w, d, h):
    # Floating board with a few books, a small plant pot and a vase.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.04), m["wood"], uv_tile=2.0)
    _books(mb, m, -w / 2 + 0.05, 0.04, -0.07, 0.1, 0.25, random.Random(23), 5)
    mb.cylinder((0.25, 0.0, 0.04), 0.045, 0.1, m["ceramic"], segments=8)
    mb.blob((0.25, 0.0, 0.2), 0.08, m["leaf"], subdivisions=1)
    mb.cylinder((0.45, 0.0, 0.04), 0.035, 0.16, m["ceramic"], segments=8)


def bookshelf(mb, m, w, d, h):
    _bookcase(mb, m, w, d, h, shelves=4, seed=17, run=3)


BUILDERS = {"gaming_desk": gaming_desk, "gaming_chair": gaming_chair, "wall_shelf": wall_shelf, "bookshelf": bookshelf}

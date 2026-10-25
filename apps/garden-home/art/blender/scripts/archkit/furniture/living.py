"""Living-room furniture: sofa, coffee table, TV unit, rug, armchair, console, TV wall, bookcase and floor lamp."""
from ._parts import _bookcase, _fronts, _legs


def sofa_l(mb, m, w, d, h):
    seat, back = 0.95, 0.2
    mb.box((-w / 2, d / 2 - seat, 0.0), (w / 2, d / 2, 0.08), m["frame"])
    mb.box((w / 2 - seat, -d / 2, 0.0), (w / 2, d / 2 - seat, 0.08), m["frame"])
    mb.box((-w / 2, d / 2 - seat, 0.08), (w / 2, d / 2, 0.42), m["fabric"])
    mb.box((w / 2 - seat, -d / 2, 0.08), (w / 2, d / 2 - seat, 0.42), m["fabric"])
    mb.box((-w / 2, d / 2 - back, 0.42), (w / 2, d / 2, h), m["fabric"])
    mb.box((-w / 2, d / 2 - seat, 0.42), (-w / 2 + 0.2, d / 2 - back, 0.62), m["fabric"])
    for x in (-w / 2 + 0.6, 0.0, w / 2 - 0.6):
        mb.box((x - 0.35, d / 2 - back - 0.14, 0.42), (x + 0.35, d / 2 - back, 0.74), m["fabric_dark"])


def coffee_table(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, h - 0.05), (w / 2, d / 2, h), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.1, -d / 2 + 0.1, 0.0), (w / 2 - 0.1, d / 2 - 0.1, h - 0.05), m["frame"])


def tv_unit(mb, m, w, d, h):
    mb.box((-w / 2 + 0.05, -d / 2 + 0.05, 0.0), (w / 2 - 0.05, d / 2 - 0.05, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2, 0.1), (w / 2, d / 2, 0.55), m["wood"], uv_tile=2.0)
    mb.box((-0.8, d / 2 - 0.06, 0.85), (0.8, d / 2 - 0.02, h), m["screen"])


def rug(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, h), m["fabric_dark"])


def armchair(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, 0.1), (w / 2, d / 2, 0.42), m["fabric"])
    mb.box((-w / 2, d / 2 - 0.18, 0.42), (w / 2, d / 2, h), m["fabric"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.12)))
        mb.box((x0, -d / 2, 0.42), (x1, d / 2 - 0.18, 0.6), m["fabric"])
    _legs(mb, w, d, 0.1, m["frame"])


def console(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, h - 0.35), (w / 2, d / 2, h), m["wood"], uv_tile=2.0)
    _legs(mb, w, d, h - 0.35, m["frame"], inset=0.04)


def tv_wall(mb, m, w, d, h):
    # Low cabinet, a wood panel up the wall and a ~75" screen hung on it, soundbar on the cabinet.
    mb.box((-w / 2 + 0.1, -0.2, 0.0), (w / 2 - 0.1, 0.2, 0.1), m["frame"])
    mb.box((-w / 2, -d / 2 + 0.02, 0.1), (w / 2, d / 2, 0.5), m["wood"], uv_tile=2.0)
    _fronts(mb, -w / 2, w / 2, 0.1, 0.47, -d / 2, m["wood"], 4, uv_tile=2.0)
    mb.box((-w / 2, -d / 2, 0.47), (w / 2, d / 2, 0.5), m["wood"], uv_tile=2.0)
    mb.box((-1.1, 0.22, 0.5), (1.1, d / 2, h), m["wood"], uv_tile=2.0)
    mb.box((-0.86, 0.17, 0.78), (0.86, 0.22, 1.76), m["frame"])
    mb.box((-0.83, 0.15, 0.81), (0.83, 0.17, 1.73), m["screen_on"])
    mb.box((-0.6, -0.05, 0.5), (0.6, 0.1, 0.58), m["frame"])


def bookshelf_wall(mb, m, w, d, h):
    _bookcase(mb, m, w, d, h, shelves=5, seed=11)


def floor_lamp(mb, m, w, d, h):
    mb.cylinder((0.0, 0.0, 0.0), 0.17, 0.03, m["metal"], segments=12)
    mb.cylinder((0.0, 0.0, 0.03), 0.012, 1.27, m["metal"], segments=6)
    mb.cylinder((0.0, 0.0, 1.3), 0.2, h - 1.3, m["led"], segments=12)


BUILDERS = {
    "sofa_l": sofa_l, "coffee_table": coffee_table, "tv_unit": tv_unit, "rug": rug, "armchair": armchair,
    "console": console, "tv_wall": tv_wall, "bookshelf_wall": bookshelf_wall, "floor_lamp": floor_lamp,
}

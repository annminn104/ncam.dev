"""Outdoor furniture: lounger, side table, outdoor sofa, bistro set, towel stand, lounge armchair and garden lamp."""
from ._parts import _chair, _legs


def lounger(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.25), m["frame"])
    mb.box((-w / 2 + 0.03, -d / 2 + 0.03, 0.25), (w / 2 - 0.03, d / 2 - 0.55, 0.33), m["fabric"])
    mb.box((-w / 2 + 0.03, d / 2 - 0.55, 0.25), (w / 2 - 0.03, d / 2 - 0.03, h), m["fabric"])


def side_table(mb, m, w, d, h):
    mb.cylinder((0.0, 0.0, 0.0), 0.04, h - 0.03, m["frame"], segments=8)
    mb.cylinder((0.0, 0.0, h - 0.03), min(w, d) / 2, 0.03, m["wood"], segments=16)


def outdoor_sofa(mb, m, w, d, h):
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.12), m["frame"])
    mb.box((-w / 2, -d / 2, 0.12), (w / 2, d / 2, 0.4), m["fabric"])
    mb.box((-w / 2, d / 2 - 0.2, 0.4), (w / 2, d / 2, h), m["fabric"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.15)))
        mb.box((x0, -d / 2, 0.4), (x1, d / 2 - 0.2, 0.6), m["fabric"])


def bistro_set(mb, m, w, d, h):
    mb.cylinder((0.0, 0.0, 0.0), 0.04, 0.72, m["frame"], segments=8)
    mb.cylinder((0.0, 0.0, 0.72), 0.35, 0.03, m["wood"], segments=16)
    for sx in (-1, 1):
        _chair(mb, m, sx * 0.48, 0.0, facing=-sx, axis="x")


def towel_stand(mb, m, w, d, h):
    # Wood stand: two posts on cross feet, a top bar with three towels draped over it, a lower shelf with a stack.
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.04)
        mb.box((x - 0.02, -d / 2, 0.0), (x + 0.02, d / 2, 0.04), m["wood"], uv_tile=2.0)
        mb.box((x - 0.02, -0.02, 0.04), (x + 0.02, 0.02, h), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.04, -0.02, h - 0.08), (w / 2 - 0.04, 0.02, h - 0.04), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.04, -0.12, 0.3), (w / 2 - 0.04, 0.12, 0.33), m["wood"], uv_tile=2.0)
    for colour, x0, x1 in (("white", -0.23, -0.1), ("fabric", -0.07, 0.07), ("cushion", 0.1, 0.23)):
        mb.box((x0, -0.045, 0.62), (x1, 0.045, h - 0.01), m[colour])
    mb.box((-0.2, -0.1, 0.33), (0.2, 0.1, 0.39), m["white"])
    mb.box((-0.18, -0.09, 0.39), (0.18, 0.09, 0.45), m["fabric"])


def outdoor_armchair(mb, m, w, d, h):
    # Lounge armchair: frame on four short legs with panel arms, a deep seat cushion and a tall back cushion.
    _legs(mb, w, d, 0.12, m["frame"], inset=0.05)
    mb.box((-w / 2, -d / 2, 0.12), (w / 2, d / 2, 0.2), m["frame"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.07)))
        mb.box((x0, -d / 2, 0.2), (x1, d / 2, 0.55), m["frame"])
    mb.box((-w / 2 + 0.07, -d / 2 + 0.02, 0.2), (w / 2 - 0.07, d / 2 - 0.2, 0.36), m["fabric"])
    mb.box((-w / 2 + 0.07, d / 2 - 0.2, 0.2), (w / 2 - 0.07, d / 2 - 0.07, h), m["fabric"])
    mb.box((-w / 2 + 0.07, d / 2 - 0.07, 0.2), (w / 2 - 0.07, d / 2, h - 0.05), m["frame"])


def garden_lamp(mb, m, w, d, h):
    # Bollard: base plate, dark body, a tall glowing head (it has to read from the wallpaper at night) and a cap.
    mb.cylinder((0.0, 0.0, 0.0), 0.12, 0.03, m["frame"], segments=12)
    mb.cylinder((0.0, 0.0, 0.03), 0.06, 0.55, m["frame"], segments=8)
    mb.cylinder((0.0, 0.0, 0.58), 0.075, 0.29, m["led"], segments=12)
    mb.cylinder((0.0, 0.0, 0.87), 0.1, h - 0.87, m["frame"], segments=12)


BUILDERS = {
    "lounger": lounger, "side_table": side_table, "outdoor_sofa": outdoor_sofa, "bistro_set": bistro_set,
    "towel_stand": towel_stand, "outdoor_armchair": outdoor_armchair, "garden_lamp": garden_lamp,
}

"""The koi pond (villa v2 part 3) as plain data: a module of its own filling the `pond` zone. Pure Python.

Module space: the origin is the centre of the 11 x 8 m footprint (the zone), front to -Y. The pond is dug into the lawn
(the yard's grass top has a hole of OUTLINE, make_placeholders): a smooth irregular blob about 9 x 6 m (basin.blob)
whose bank falls along PROFILE from the grass to a floor 0.65 m deep in the middle, a green band down to the water and
mud below it, the dark floor in the middle; the water stands WATER_Z below the lawn. A ring of grey stones lines the
edge, with gaps where the grass meets the water. In the north-west corner, partly in the water, the rockery (hòn non
bộ): four peaks of limestone with shrubs on their ledges and a waterfall falling from the tallest into the pond, foam at
its foot (the click group waterfall). Fourteen koi swim their loops under the surface (swim.py), and three clusters of
lotus pads float on it with their flowers and buds.

build_koi.py builds the bank and floor into Pond_bank, the stones into Pond_stones, the peaks and shrubs into Rockery,
the water into WATER_surface, the falling water into WATER_waterfall_sheet and its foam into Waterfall_foam, the fish
into Koi and the lotus into Lotus; layout_check reads OUTLINE, PROFILE, STONES, PEAKS, WATERFALL, KOI, FEEDING, PADS and
FLOWERS.
"""
import math
import random

from . import basin

MODULE_ID = "koi_pond"
ROLE = "prop"
FOOTPRINT = (11.0, 8.0)  # the pond zone (siteplan/zones.py), which a test keeps equal to it
ZONE = "pond"

CENTRE = (-0.2, -0.15)  # of the outline, which is star-shaped round it
RADII = (4.6, 3.15)
HARMONICS = ((2, 0.05, 0.5), (3, 0.075, -0.8), (4, 0.04, 2.2), (5, 0.022, 0.6))
OUTLINE = basin.blob(CENTRE, RADII, HARMONICS, 56)
# The bank and floor, (share of the outline, height): tucked 1.2 cm under the lawn just outside the hole (no crack
# where the two modules meet), the grass edge, a green band down to the water, mud on the slope, the floor deepest in
# the middle.
PROFILE = ((1.04, -0.012), (1.0, 0.0), (0.97, -0.1), (0.9, -0.3), (0.75, -0.5), (0.5, -0.62), (0.0, -0.65))
GREEN_BAND = 0.97  # the bank is green from the outline down to this ring, mud below it, and the floor from FLOOR
FLOOR = 0.75
WATER_Z = -0.07
WATER_SHARE = 0.985  # the water's polygon reaches a little into the bank, so its edge hides under the bank's slope

# The rockery: (variant, (x, y), turn in degrees, sink: how far its foot stands below the bank under its middle).
PEAKS = [
    (0, (-4.15, 2.15), 15, 0.05),
    (1, (-2.6, 1.3), 200, 0.05),
    (2, (-4.6, 1.0), 110, 0.05),
    (3, (-3.05, 2.3), 290, 0.04),
]
PEAK_REACH = 0.62  # of a peak's catalog half size: what it covers of the ground, roughly (basin checks)
# Shrubs on the rockery's ledges: (x, y, z, height, seed); z is about where the ledge is, the generator plants the shrub
# on the rock it finds there. The tallest peak carries four, one on its crag.
SHRUBS = [(-3.95, 1.95, 1.35, 0.7, 3), (-2.45, 1.45, 0.95, 0.6, 4), (-4.5, 1.15, 0.75, 0.6, 5),
          (-4.35, 2.4, 1.0, 0.65, 6), (-3.15, 2.45, 0.6, 0.5, 7), (-4.02, 2.1, 1.95, 0.45, 8),
          (-4.42, 1.98, 1.2, 0.5, 9)]
# The waterfall: the top middle of the sheet of water and its width, which way it falls (degrees from +X, the way its
# front faces) and how far out from the rock it falls; the foam floats at its foot.
WATERFALL = {"top": (-3.75, 1.82, 1.05), "width": 0.42, "facing": -40.0, "throw": 0.18, "foam": 0.32}

# The ring of stones along the edge: one every STONE_STEP metres or so, none in the GAPS (metres along the outline from
# its first point, at +X) where the grass meets the water, nor under the rockery.
STONE_STEP = 0.5
STONE_SIZE = (0.32, 0.55)
GAPS = ((2.8, 4.5), (9.2, 10.9), (16.4, 18.1), (21.0, 22.6))
ROCKERY_CLEAR = 0.15


def _stones():
    rnd = random.Random(23)
    stones, at = [], 0.0
    total = basin.perimeter(OUTLINE)
    while at < total - STONE_STEP / 2:
        size = rnd.uniform(*STONE_SIZE)
        (x, y), (nx, ny) = basin.along(OUTLINE, at)
        out = rnd.uniform(-0.04, 0.08)  # astride the edge, a little more on the grass than in the water
        x, y = x + nx * out, y + ny * out
        free = all(not lo <= at <= hi for lo, hi in GAPS)
        clear = all(math.dist((x, y), pos) > PEAK_REACH * 0.8 + size / 2 + ROCKERY_CLEAR for _, pos, _, _ in PEAKS)
        if free and clear:
            stones.append((round(x, 3), round(y, 3), round(size, 3), round(size * rnd.uniform(0.45, 0.7), 3),
                           rnd.randrange(1000)))
        at += STONE_STEP * rnd.uniform(0.85, 1.25)
    return stones


STONES = _stones()  # (x, y, size, height, seed): boulder() stones standing on the bank
PEBBLES = [(1.2, -3.45, 0.16, 0.08, 11), (1.45, -3.3, 0.12, 0.06, 12), (-1.6, 2.95, 0.15, 0.07, 13),
           (4.3, 1.05, 0.14, 0.07, 14), (4.2, 1.3, 0.11, 0.05, 15)]

# The koi (swim.py): fourteen, orange, kohaku, black and orange, gold (archkit.furniture.pond.KOI_PATTERNS), in three
# layers a body's height apart, so that the loops of different layers may cross: just under the surface a big loop
# round the pond and a small one at its shallow east end, below them a figure of eight, deepest a loop in the middle and
# one at the west end. The fish of a loop follow one another round it; no two loops of a layer cross (layout_check).
KOI_LENGTH = 0.48  # the koi kind's length (catalog)
KOI_TOP = 0.115  # from its underside to the tip of its dorsal fin
KOI_BODY = 0.095  # from its underside to its back: koi this far apart in depth (and their bob) swim over one another
LAYERS = (-0.23, -0.345, -0.46)


def _school(variants, centre, radii, tilt, z, period, eight=False, start=0.0):
    """The koi of `variants` following one another round one loop, evenly spaced."""
    return [{"variant": variant, "centre": centre, "radii": radii, "tilt": tilt, "z": z, "period": period,
             "phase": round(start + 2 * math.pi * k / len(variants), 4), "eight": eight, "bob": 0.01}
            for k, variant in enumerate(variants)]


KOI = (_school((0, 1, 3, 0), (0.1, -0.35), (2.2, 1.3), 6, LAYERS[0], 48)
       + _school((1, 0), (3.35, 0.15), (0.62, 0.42), 15, LAYERS[0], -22, start=1.0)
       + _school((2, 1, 0), (0.4, -0.25), (2.05, 0.85), -12, LAYERS[1], 44, eight=True, start=0.4)
       + _school((0, 3, 2), (-0.1, -0.45), (1.45, 0.68), 20, LAYERS[2], -40, start=2.0)
       + _school((1, 2), (-2.55, -0.55), (0.55, 0.38), -10, LAYERS[2], 20, start=0.7))
KOI_BANK_CLEAR = 0.3  # metres between a koi and the bank (or the rockery), at the least
KOI_SURFACE_CLEAR = 0.025  # metres of water over a koi's dorsal fin, at the least
# A click on the pond feeds the koi (swim.fed_position): the food lands where the click fell but no further than
# `radius` from `centre`, the middle of the school (its fish's loop centres), so that their rings round it stay off the
# rockery and the bank (layout_check samples them). The Koi object carries it as `koi_feed` (x, y, radius).
FEEDING = {"centre": (0.21, -0.31), "radius": 1.2}

# The lotus: three clusters of pads (x, y, variant, turn in degrees: archkit.furniture.pond.PADS) with flowers and buds
# (x, y, variant: pink, white, bud) rising among them; they float at the water line.
PADS = [
    (2.75, -1.3, 0, 0), (3.35, -0.9, 1, 60), (3.3, -1.55, 2, 120), (2.2, -1.75, 3, 200), (3.85, -1.0, 2, 300),
    (-1.9, -1.95, 0, 90), (-1.3, -2.3, 2, 150), (-2.55, -1.6, 1, 30), (-2.4, -2.3, 2, 270),
    (0.75, 1.6, 1, 15), (1.3, 1.85, 2, 220), (0.1, 1.75, 0, 330), (1.25, 1.2, 3, 100),
]
FLOWERS = [(2.75, -1.3, 0), (3.35, -0.9, 1), (3.05, -1.05, 2), (-1.9, -1.95, 1), (-2.55, -1.6, 0), (-1.55, -2.05, 2),
           (0.1, 1.75, 0)]
LOTUS_Z = WATER_Z + 0.002  # pads and flowers float on the water

HOTSPOT = {"name": "HS_pond", "pos": (0.0, 0.0, 0.6), "action": "focus", "label": "Ao cá", "radius": 4.5}

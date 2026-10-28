"""The tea corner by the koi pond (art/README.md, Koi pond) as plain data: a module of its own filling the `tea` zone. Pure
Python.

Module space: the origin is the centre of the 6 x 3.5 m footprint (the zone), front to -Y, towards the pond. A round
travertine paving under a granite tea table with a clay teapot and cups on it and four drum stools round it; three
bonsai on its corners, two on granite pedestals and one in a celadon pot (they sway, Bonsai, and cast no shadow); a
granite lantern by the table, of the garden's lights (lights:garden), pooling its light on the paving at night; and
stepping stones from the paving up to the garden walk where it turns towards the door (garden/paths_layout.py), a
stride apart and clear of its slabs.

build_tea.py builds the paving (PAVING) and the stepping stones (STEPS) into Tea_corner with the table, stools and tea
set; layout_check reads PIECES, SHAPES (the stepping stones), POOLS, PAVING and STEPS.
"""
import math
import random

from garden import lights

MODULE_ID = "tea_garden"
ROLE = "prop"
FOOTPRINT = (6.0, 3.5)  # the tea zone (siteplan/zones.py), which a test keeps equal to it
ZONE = "tea"

STILL, BONSAI, LANTERN = "Tea_corner", "Bonsai", "Stone_lantern"
SHADOWLESS = (BONSAI,)  # small trees: their shadow pass is not worth its cost from the wallpaper camera
WIND = {"wind": True}
TABLE = (0.3, -0.45)
SEAT = 0.72  # from the table's middle to a stool's
PAVING = {"centre": TABLE, "radius": 1.2, "top": 0.03, "sides": 16}
TOP = PAVING["top"]
PIECES = ([("stone_table_round", STILL, (*TABLE, TOP), 0),
           ("tea_set", STILL, (*TABLE, TOP + 0.72), 0)]
          + [("stone_stool", STILL, (TABLE[0] + SEAT * math.cos(a), TABLE[1] + SEAT * math.sin(a), TOP), 0)
             for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2)]
          + [("bonsai", BONSAI, (-2.35, -1.05), 0, {"variant": 0, **WIND}),
             ("bonsai", BONSAI, (2.3, 0.9), 0, {"variant": 1, **WIND}),
             ("bonsai", BONSAI, (2.35, -1.1), 0, {"variant": 2, **WIND}),
             ("stone_lantern", LANTERN, (1.5, 0.45), 0)])
POOLS = [lights.pool(LANTERN, "stone_lantern", (1.5, 0.45))]  # its light on the paving and the grass round it

STEP_TOP = 0.05
STEP_SIZE = 0.24  # the radius of a stepping stone, about
STEP_CENTRES = [(-0.7, 0.8), (-0.95, 1.5)]  # from the paving up to the walk


def _step(centre, seed):
    """A stepping stone: a convex heptagon about STEP_SIZE round `centre`, its corners jittered a little."""
    rnd = random.Random(seed)
    turn = rnd.uniform(0.0, 2 * math.pi)
    return [(centre[0] + STEP_SIZE * rnd.uniform(0.92, 1.0) * math.cos(turn + 2 * math.pi * k / 7),
             centre[1] + STEP_SIZE * rnd.uniform(0.92, 1.0) * math.sin(turn + 2 * math.pi * k / 7)) for k in range(7)]


STEPS = [_step(centre, 31 + k) for k, centre in enumerate(STEP_CENTRES)]
SHAPES = [(f"stepping stone {k}", step) for k, step in enumerate(STEPS, start=1)]

"""Roof terrace of the villa v2 house (level 2 over the upper box): the jacuzzi in the front
left corner, the grape trellis with its lounge, loungers and planters; since the resort deco also a cabana daybed, an
outdoor bar, potted palms, lanterns and string lights. The tall house's bigger roof (20 x 14.5 m over the upper box)
keeps the layout, each piece the same way off its railings, and gains the way up: the spiral stair
comes out in a small white pavilion by the west parapet, glazed on its deck sides, its door onto the deck; the cabana
stands further east than it did, so the two read apart; the bedrooms' air conditioners' condensers stand along the
parapet behind the pavilion, out of sight between two low teak screens, one on the deck's side and one on the
parapet's. Pure Python.
"""
from archkit.catalog import STAIR_PAVILION
from archkit.trellis_posts import trellis_posts

from .common import BACK, EDGE, LEFT, LEVEL_Z, UPPER_RIGHT
from .shell import RAILINGS, STAIR

ROOF = LEVEL_Z[2]

ROOMS = [
    {"name": "roof", "level": 2, "min": (LEFT + 0.1, EDGE + 0.1), "max": (UPPER_RIGHT - 0.1, BACK - 0.1)},
]
ROOM_LABELS = {"roof": "Roof terrace"}

# archkit.rooftop.jacuzzi: the deck spans x -10.5..-6.9, y -6.0..-2.4 with its step on the -Y side. The name stays
# lower case: it names the clip ambient_jacuzzi too.
JACUZZI = {"name": "jacuzzi", "center": (-8.7, -4.2, ROOF), "deck": "teak"}  # deck: the palette key of its wood
# archkit.vines.grape_trellis: posts at the corners and at x = 0.5 on both long sides (archkit.trellis_posts, which the
# vines read too). leaf_density is the knob to turn when the house nears its triangle budget: the resort
# deco lowered it to 0.75, the cheaper string lights (8-triangle bulbs, a taut wire in one piece) gave the leaves back.
TRELLIS = {"name": "Trellis", "min": (-2.0, 1.9), "max": (5.0, 6.9), "z0": ROOF, "height": 2.6,
           "leaf_density": 1.0, "bunches": 16}

# The stair pavilion's walls stand round the stair's square (shell.STAIR): its slab roof overhangs them on the front and
# the east (catalog.STAIR_PAVILION), so the piece stands that much off the stair's centre.
_PAVILION = (round(STAIR["center"][0] + STAIR_PAVILION["overhang"] / 2, 3),
             round(STAIR["center"][1] - STAIR_PAVILION["overhang"] / 2, 3))

FURNITURE = [
    # lounge under the trellis, string lights zig-zagging under its lattice (STRING_LIGHTS)
    ("outdoor_sofa", "Roof_sofa", "roof", (1.5, 6.05), 0),
    ("coffee_table", "Roof_coffee_table", "roof", (1.5, 4.8), 0),
    ("outdoor_armchair", "Roof_armchair_1", "roof", (-0.2, 4.8), 90),
    ("outdoor_armchair", "Roof_armchair_2", "roof", (3.2, 4.8), 270),
    # a linen cabana daybed in the open behind the jacuzzi, east of the pavilion and the condensers
    ("daybed_cabana", "Daybed_cabana", "roof", (-6.2, 4.5), 0),
    # by the jacuzzi: two teak loungers sharing a side table, the towel stand behind them
    ("teak_lounger", "Roof_lounger_1", "roof", (-5.95, -4.2), 0),
    ("side_table", "Roof_side_table", "roof", (-5.3, -3.6), 0),
    ("teak_lounger", "Roof_lounger_2", "roof", (-4.65, -4.2), 0),
    ("towel_stand", "Roof_towel_stand", "roof", (-6.4, -1.9), 0),
    # the bar along the east railing, its stools facing the lounge; potted palms in the three free corners
    ("outdoor_bar", "Outdoor_bar", "roof", (7.7, 4.0), 270),
    ("palm_small", "Roof_palm_1", "roof", (7.95, -6.45), 0, {"wind": True}),
    ("palm_small", "Roof_palm_2", "roof", (7.95, 6.6), 0, {"wind": True}),
    ("palm_small", "Roof_palm_3", "roof", (-10.95, 6.95), 0, {"wind": True}),
    ("lantern", "Roof_lantern_1", "roof", (-6.6, -6.4), 0),
    ("lantern", "Roof_lantern_2", "roof", (6.1, 0.9), 0),
    # the stair pavilion over the stair (shell.STAIR), its door on its front left, over the landing one steps onto
    ("stair_pavilion", "Stair_pavilion", "roof", _PAVILION, 0),
    # the air conditioners' three condensers along the west parapet, facing the deck, between a low teak screen on the
    # deck's side and one on the parapet's, which hides them from outside through the glass railing; all one object
    # (build_house merges what goes "into" it)
    *[("ac_condenser", f"AC_condenser_{i + 1}", "roof", (-11.0, y), 90, {"into": "AC_condensers"})
      for i, y in enumerate((3.45, 4.3, 5.15))],
    ("teak_screen", "AC_screen", "roof", (-10.5, 4.3), 90, {"into": "AC_condensers"}),
    ("teak_screen", "AC_screen_parapet", "roof", (-11.33, 4.3), 270, {"into": "AC_condensers"}),
]

# A small planter at the foot of every trellis post for the vine to climb from (numbered by x, then y), shrub planters
# along the back edge and on the front edge right of the loungers.
_TRELLIS_FEET = sorted(trellis_posts(TRELLIS["min"], TRELLIS["max"]))
PLANTERS = [(f"PLANT_vine_{i + 1}", (x, y, ROOF), (0.5, 0.5, 0.35), 1) for i, (x, y) in enumerate(_TRELLIS_FEET)] + [
    ("PLANT_roof_1", (-9.0, 7.05, ROOF), (2.4, 0.5, 0.5), 3),
    ("PLANT_roof_2", (-5.5, 7.05, ROOF), (2.4, 0.5, 0.5), 3),
    ("PLANT_roof_3", (6.4, 7.05, ROOF), (2.0, 0.5, 0.5), 3),
    ("PLANT_roof_4", (2.3, -6.55, ROOF), (2.4, 0.5, 0.5), 3),
    ("PLANT_roof_5", (5.5, -6.55, ROOF), (2.4, 0.5, 0.5), 3),
]

# archkit.lighting.string_lights. Under the trellis the wire zig-zags between its two long beams, anchored under them
# (BEAM 0.16 and two 0.04 slat layers of archkit.vines below the top of the lattice) and sagging a little; along the
# front railing, the one facing the wallpaper camera, it runs taut with its globes resting on the handrail: the bulbs
# are centred on the wire, so it lies a bulb radius (and a little more) above the handrail.
# 12 cm globes: festoon-sized bulbs vanish at the wallpaper's distance.
_UNDERSIDE = TRELLIS["z0"] + TRELLIS["height"] - 0.24
_ZIGZAG = 5  # spans
_BULB = 0.06  # radius of a globe
_RAIL = {rail["name"]: rail for rail in RAILINGS}
_HANDRAIL = _RAIL["roof_front"]["z0"] + _RAIL["roof_front"]["height"]  # its top: the rail is 5 cm tall
_STRING_Z = _HANDRAIL + _BULB + 0.004
_RAIL_Y = _RAIL["roof_front"]["start"][1]
STRING_LIGHTS = [
    {"name": "String_lights_trellis", "bulbs_per_m": 1.5, "sag": 0.06, "bulb_radius": _BULB, "points": [
        (TRELLIS["min"][0] + (TRELLIS["max"][0] - TRELLIS["min"][0]) * i / _ZIGZAG,
         (TRELLIS["min"][1], TRELLIS["max"][1])[i % 2], _UNDERSIDE) for i in range(_ZIGZAG + 1)]},
    {"name": "String_lights_railing", "bulbs_per_m": 1.5, "sag": 0.0, "bulb_radius": _BULB, "points": [
        (LEFT + 0.05, _RAIL_Y, _STRING_Z), (UPPER_RIGHT - 0.05, _RAIL_Y, _STRING_Z)]},
]

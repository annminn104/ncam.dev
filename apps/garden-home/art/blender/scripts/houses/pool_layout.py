"""Pool layout as plain data. Pure Python.

The yard is a flat plane at z = 0 and a module cannot cut holes into it, so the pool sits in a raised stone platform
with a wood deck on top (the reference renders show the same raised terrace). The water surface therefore sits at
WATER_TOP, about 0.8 m above the basin floor.
Module space in metres, Blender axes; origin at the centre of the 12 x 7 m footprint at ground level.
"""
MODULE_ID = "pool"
ROLE = "prop"
FOOTPRINT = (12.0, 7.0)

DECK_TOP = 0.9
WATER_TOP = 0.82
DECK = 0.05            # wood layer on top of the stone platform
POOL_MIN, POOL_MAX = (-5.0, -2.0), (5.0, 2.0)
LINING = 0.02
STEPS_X = (4.2, 6.0)   # three stone steps up to the deck at the front right

_PLATFORM_TOP = DECK_TOP - DECK
_PX0, _PY0 = POOL_MIN
_PX1, _PY1 = POOL_MAX

STRUCTURE = [
    {"name": "Pool_platform", "uv_tile": 4.8, "boxes": [
        ("stone", (-6.0, -3.5, 0.0), (STEPS_X[0], _PY0, _PLATFORM_TOP)),
        ("stone", (-6.0, _PY1, 0.0), (6.0, 3.5, _PLATFORM_TOP)),
        ("stone", (-6.0, _PY0, 0.0), (_PX0, _PY1, _PLATFORM_TOP)),
        ("stone", (_PX1, _PY0, 0.0), (6.0, _PY1, _PLATFORM_TOP)),
        ("stone", (STEPS_X[0], -3.5, 0.0), (STEPS_X[1], -3.0, 0.3)),
        ("stone", (STEPS_X[0], -3.0, 0.0), (STEPS_X[1], -2.5, 0.6)),
        ("stone", (STEPS_X[0], -2.5, 0.0), (STEPS_X[1], _PY0, DECK_TOP)),
    ]},
    {"name": "Pool_basin", "uv_tile": 1.0, "boxes": [
        ("tile", (_PX0, _PY0, 0.0), (_PX1, _PY1, 0.05)),
        ("tile", (_PX0, _PY0, 0.05), (_PX1, _PY0 + LINING, _PLATFORM_TOP)),
        ("tile", (_PX0, _PY1 - LINING, 0.05), (_PX1, _PY1, _PLATFORM_TOP)),
        ("tile", (_PX0, _PY0, 0.05), (_PX0 + LINING, _PY1, _PLATFORM_TOP)),
        ("tile", (_PX1 - LINING, _PY0, 0.05), (_PX1, _PY1, _PLATFORM_TOP)),
    ]},
    {"name": "Deck", "uv_tile": 2.0, "boxes": [
        ("wood", (-6.0, -3.5, _PLATFORM_TOP), (STEPS_X[0], _PY0, DECK_TOP)),
        ("wood", (-6.0, _PY1, _PLATFORM_TOP), (6.0, 3.5, DECK_TOP)),
        ("wood", (-6.0, _PY0, _PLATFORM_TOP), (_PX0, _PY1, DECK_TOP)),
        ("wood", (_PX1, _PY0, _PLATFORM_TOP), (6.0, _PY1, DECK_TOP)),
    ]},
]

WATER = {"name": "WATER_pool", "min": (_PX0 + LINING, _PY0 + LINING, WATER_TOP - 0.02),
         "max": (_PX1 - LINING, _PY1 - LINING, WATER_TOP)}

ROOMS = [{"name": "deck_back", "level": 0, "min": (-6.0, _PY1), "max": (6.0, 3.5)}]
LEVEL_Z = {0: DECK_TOP}
# Resort deco: teak loungers with a lantern between each pair, a side table, and potted palms that sway at both ends.
# Furniture entries are (kind, object name, room, (x, y), rotation in degrees[, builder options]) as in the house.
FURNITURE = [
    ("palm_small", "Palm_pool_1", "deck_back", (-5.5, 2.75), 0, {"wind": True}),
    ("teak_lounger", "Lounger_1", "deck_back", (-4.0, 2.75), 90),
    ("lantern", "Lantern_pool_1", "deck_back", (-2.75, 2.75), 0),
    ("teak_lounger", "Lounger_2", "deck_back", (-1.5, 2.75), 90),
    ("lantern", "Lantern_pool_2", "deck_back", (-0.25, 2.75), 0),
    ("teak_lounger", "Lounger_3", "deck_back", (1.0, 2.75), 90),
    ("side_table", "Pool_side_table", "deck_back", (2.6, 2.75), 0),
    ("palm_small", "Palm_pool_2", "deck_back", (5.5, 2.75), 0, {"wind": True}),
]

# Underwater LED rim, just below the water surface along the inner lining.
_LED_Z = WATER_TOP - 0.06
_IN = LINING + 0.02
LED_STRIPS = [
    {"name": "LT_pool_front", "start": (_PX0 + _IN, _PY0 + _IN), "end": (_PX1 - _IN, _PY0 + _IN), "z": _LED_Z},
    {"name": "LT_pool_back", "start": (_PX0 + _IN, _PY1 - _IN), "end": (_PX1 - _IN, _PY1 - _IN), "z": _LED_Z},
    {"name": "LT_pool_left", "start": (_PX0 + _IN, _PY0 + _IN), "end": (_PX0 + _IN, _PY1 - _IN), "z": _LED_Z},
    {"name": "LT_pool_right", "start": (_PX1 - _IN, _PY0 + _IN), "end": (_PX1 - _IN, _PY1 - _IN), "z": _LED_Z},
]

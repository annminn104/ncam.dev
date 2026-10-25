"""The basement (villa v2 spec §12 "Tầng hầm") as plain data. Pure Python: build_basement.py turns it into geometry,
layout_check.py sanity-checks it.

A module of its own, so the house keeps its triangle budget, standing in the house's slot: module space is the
house's (houses/house_parts/common.py: origin at the footprint's centre on the ground, front to -Y), so the plan lines
are shared. Level -1 lies under the ground slab, 3.2 m clear: retaining walls stand round the house's plinth, the
outline of the pit the lawn has a hole for (PIT), and inside them six rooms tile the plan round a hall that runs east
from the foot of the spiral stair (the house's, continued down its column): the wine cellar behind a glass wall along
the hall's back, the karaoke lounge at its east end, and along the front the shower room, the spa (with its sauna
cabin and hot tub) and the gym, the spa looking through a glass wall into the light well (giếng trời) sunk into the lawn
in front of the plinth's front face, left of the walk (the zone `lightwell`, siteplan/zones.py).

The tables follow the house's (houses/house_parts): ROOMS, PARTITIONS with their doors, PASSAGES, DOWNLIGHTS (split into
one LT_down_<room> per room) and FURNITURE entries (kind, object name, room, (x, y), rotation[, builder options]), whose
"into" option names the object a piece is merged into (OBJECTS, one draw call per material) and "on" the piece it stands
on (the decor pass's few accents, villa v2 spec §12 "Rèm và phụ kiện": on a catalog.SURFACES top of the host,
houses/layout_check.top_under): the website draws an object "buried" only while it cuts the house down to the
basement, so on the wallpaper only the spa behind the light well, the hall under the stair's hole, the walls and floors
round them and the light well are drawn; an "uncut" object stands whole under that cut (the retaining walls, the light
well, the disco ball under the ceiling the cut takes away).
The light well's pieces (WELL_PIECES) are garden-style entries (kind, object, (x, y, z), rotation[, options]).
"""
import math

from archkit.catalog import FURNITURE as KIT, SPIRAL_STAIR
from houses.interact import split_downlights
from houses.house_parts.common import (BACK, BASEMENT_CEIL, BASEMENT_FLOOR, CUT_ABOVE_FLOOR, FOOTPRINT as HOUSE_FOOTPRINT,
                                       LEFT, LEVEL_Z, RIGHT, TERRACE)
from houses.house_parts.shell import STAIR as HOUSE_STAIR

MODULE_ID = "basement"
ROLE = "prop"
FOOTPRINT = HOUSE_FOOTPRINT
WELL_ZONE = "lightwell"

LEVEL = -1
FLOOR = round(BASEMENT_FLOOR + 0.02, 3)  # the floor's finish, where the pieces stand
CEIL = BASEMENT_CEIL  # the ground slab's underside
CUT = round(BASEMENT_FLOOR + CUT_ABOVE_FLOOR, 3)  # the website's cut while it shows the basement (cutaway.ts)
CUT_HEIGHTS = {LEVEL: CUT}
DOOR_HEAD = round(FLOOR + 2.2, 3)  # over a doorway the wall closes in a header

# The retaining walls stand round the house's plinth (house_parts/shell.py: its outline, the pit), WALL thick; the
# rooms are measured to their inner faces.
WALL = 0.2
INSIDE = ((LEFT + WALL, TERRACE + WALL), (RIGHT - WALL, BACK - WALL))
(_IX0, _IY0), (_IX1, _IY1) = INSIDE

# The light well (giếng trời): a sunken court open to the sky, the outer faces of its walls ((x0, y0), (x1, y1)); its
# back is the basement's front wall, under the plinth's front face, where a glass wall looks into the spa.
WELL = {"min": (-5.5, -11.1), "max": (-0.3, TERRACE)}
_WX0, _WY0 = WELL["min"]
_WX1 = WELL["max"][0]
SPA_GLASS = (_WX0 + WALL, _WX1 - WALL)  # the opening in the front wall over the light well's floor, x0..x1

# The hole in the yard's lawn (dev/make_placeholders.py): the house's plinth, which stands in it and covers the basement
# while the house shows, and the light well in front of it, counter-clockwise from the plinth's front left corner.
PIT = [(LEFT, TERRACE), (_WX0, TERRACE), (_WX0, _WY0), (_WX1, _WY0), (_WX1, TERRACE), (RIGHT, TERRACE), (RIGHT, BACK),
       (LEFT, BACK)]

# Inside the light well: its walls (travertine, from the basement's floor up to the lawn, a coping on top) round a floor
# of pebbles at the basement's floor level, the outer faces of its walls on the pit's outline; the spa's glass wall is
# its back. The walls darken towards the floor, in bands (palette key, bottom) from the lawn down: the wallpaper camera,
# some 15 degrees down, sees a metre or so of the far walls, a pale band under the coping, then shaded travertine, so
# the well reads as a court sunk into the lawn rather than a pale square; the deep band goes on down to the floor.
WELL_INSIDE = ((_WX0 + WALL, _WY0 + WALL), (_WX1 - WALL, TERRACE))
WELL_FLOOR = FLOOR
COPING = 0.05
WELL_BANDS = (("stone", -0.4), ("stone_shade", -1.1), ("stone_deep", BASEMENT_FLOOR))
_WELL_SIDES = [((_WX0, _WY0), (_WX0 + WALL, TERRACE)), ((_WX1 - WALL, _WY0), (_WX1, TERRACE)),
               ((_WX0 + WALL, _WY0), (_WX1 - WALL, _WY0 + WALL))]
WELL_WALLS = [(key, (x0, y0, z0), (x1, y1, z1)) for (x0, y0), (x1, y1) in _WELL_SIDES
              for (key, z0), z1 in zip(WELL_BANDS, (0.0,) + tuple(z for _key, z in WELL_BANDS[:-1]))]
WELL_WALLS += [("stone", (x0, y0, 0.0), (x1, y1, COPING)) for (x0, y0), (x1, y1) in _WELL_SIDES]

# The objects the build makes (build_basement.py) and how the website treats them.
WALLS, RIM = "Basement_walls", "Basement_rim"
PARTITIONS_OBJECT, FLOOR_OBJECT, ROOM_FLOORS = "Basement_partitions", "Basement_floor", "Basement_floor_rooms"
GLASS_SPA, GLASS_CELLAR = "Glass_spa", "Glass_cellar"
ROOMS_OBJECT = "Basement_rooms"  # the furniture of every room but the spa, merged
SPA, TUB, SAUNA = "Spa", "Hot_tub", "Sauna_stove"
PARTY, LEDS, DISCO = "Karaoke_party", "LED_party", "Disco_ball"
WELL_OBJECT, WELL_PLANTS, WELL_LIGHTS = "Light_well", "Light_well_plants", "Light_well_lights"

# The plan: a hall from the stair's foot east to the karaoke lounge, the wine cellar along its back behind glass, the
# shower room, the spa and the gym along the front; the karaoke lounge takes the east end, front to back.
_HALL_FRONT, _HALL_BACK = 0.0, 3.0  # the hall's front and back lines
_SHOWERS_SPA, _EAST = -7.6, 2.0  # the shower room's east wall; the line of the karaoke's and the gym's west walls
ROOMS = [
    {"name": "basement_hall", "level": LEVEL, "min": (_IX0, _HALL_FRONT), "max": (_EAST, _HALL_BACK), "interior": True},
    {"name": "wine_cellar", "level": LEVEL, "min": (_IX0, _HALL_BACK), "max": (_EAST, _IY1), "interior": True},
    {"name": "karaoke", "level": LEVEL, "min": (_EAST, _HALL_FRONT), "max": (_IX1, _IY1), "interior": True},
    {"name": "shower_room", "level": LEVEL, "min": (_IX0, _IY0), "max": (_SHOWERS_SPA, _HALL_FRONT), "interior": True},
    {"name": "spa", "level": LEVEL, "min": (_SHOWERS_SPA, _IY0), "max": (_EAST, _HALL_FRONT), "interior": True},
    {"name": "gym", "level": LEVEL, "min": (_EAST, _IY0), "max": (_IX1, _HALL_FRONT), "interior": True},
]
ROOM_LABELS = {"basement_hall": "sảnh hầm", "wine_cellar": "hầm rượu", "karaoke": "phòng karaoke", "spa": "spa",
               "gym": "phòng gym", "shower_room": "phòng tắm hầm"}
FLOOR_Z = {room["name"]: FLOOR for room in ROOMS}
# Each room's floor finish, by palette key, and the object it is built into: travertine through the hall, the cellar,
# the shower room and the spa (drawn always: the spa shows behind the light well, the hall under the stair's hole),
# dark carpet in the karaoke lounge and a grey sports floor in the gym (only under the cut).
FLOORS = [("basement_hall", "stone", FLOOR_OBJECT), ("wine_cellar", "stone", FLOOR_OBJECT),
          ("shower_room", "stone", FLOOR_OBJECT), ("spa", "stone", FLOOR_OBJECT),
          ("karaoke", "carpet", ROOM_FLOORS), ("gym", "fabric_dark", ROOM_FLOORS)]

# Retaining walls, floor to ceiling, round the inside, with the opening of the spa's glass wall onto the light well
# (key, min, max); the ground slab rests on them. Over them the slab's edge (RIM_BOXES, up to the ground's level) shows
# only while the website cuts the house away: otherwise the plinth stands there.
RETAINING = [
    ("white", (LEFT, TERRACE, BASEMENT_FLOOR), (SPA_GLASS[0], _IY0, CEIL)),
    ("white", (SPA_GLASS[1], TERRACE, BASEMENT_FLOOR), (RIGHT, _IY0, CEIL)),
    ("white", (LEFT, _IY1, BASEMENT_FLOOR), (RIGHT, BACK, CEIL)),
    ("white", (LEFT, _IY0, BASEMENT_FLOOR), (_IX0, _IY1, CEIL)),
    ("white", (_IX1, _IY0, BASEMENT_FLOOR), (RIGHT, _IY1, CEIL)),
]
RIM_BOXES = [
    ("concrete", (LEFT, TERRACE, CEIL), (RIGHT, _IY0, 0.0)),
    ("concrete", (LEFT, _IY1, CEIL), (RIGHT, BACK, 0.0)),
    ("concrete", (LEFT, _IY0, CEIL), (_IX0, _IY1, 0.0)),
    ("concrete", (_IX1, _IY0, CEIL), (RIGHT, _IY1, 0.0)),
]

DOOR_WIDTH = 0.9  # open doorways, no leaf, like the house's (spec §5.1)


def _partition(name, start, end, doors=()):
    """Floor-to-ceiling interior wall (0.12 m, white); `doors` are the offsets of 0.9 m openings from `start`."""
    return {"name": name, "level": LEVEL, "start": start, "end": end, "z0": FLOOR, "z1": CEIL,
            "doors": [(offset, DOOR_WIDTH) for offset in doors]}


# Each wall starts and ends at the face of the wall it meets.
PARTITIONS = [
    # the hall's front, on along the gym's back: the doors from the hall to the shower room and to the spa
    _partition("Wall_hall_front", (_IX0, _HALL_FRONT), (_IX1, _HALL_FRONT), doors=(2.7, 8.1)),
    _partition("Wall_showers_spa", (_SHOWERS_SPA, _IY0), (_SHOWERS_SPA, _HALL_FRONT - 0.06)),
    _partition("Wall_spa_gym", (_EAST, _IY0), (_EAST, _HALL_FRONT - 0.06), doors=(5.1,)),
    # the karaoke's west wall, along the hall's east end (its door) and the cellar's
    _partition("Wall_karaoke_west", (_EAST, _HALL_FRONT + 0.06), (_EAST, _IY1), doors=(0.94,)),
]
# The wine cellar's glass wall along the hall's back, floor to ceiling either side of its doorway (PASSAGES), and the
# spa's onto the light well, in the front wall's opening; panes between slim black mullions, each run one object of
# glass and frame (GLASS_<object>).
_CELLAR_DOOR = (-5.0, -5.0 + DOOR_WIDTH)
GLASS_WALLS = [
    {"name": "cellar_west", "object": GLASS_CELLAR, "start": (_IX0, _HALL_BACK), "end": (_CELLAR_DOOR[0], _HALL_BACK),
     "z0": FLOOR, "z1": CEIL, "panes": 4},
    {"name": "cellar_east", "object": GLASS_CELLAR, "start": (_CELLAR_DOOR[1], _HALL_BACK),
     "end": (_EAST - 0.06, _HALL_BACK), "z0": FLOOR, "z1": CEIL, "panes": 4},
    {"name": "spa_well", "object": GLASS_SPA, "start": (SPA_GLASS[0], TERRACE + WALL / 2),
     "end": (SPA_GLASS[1], TERRACE + WALL / 2), "z0": BASEMENT_FLOOR, "z1": CEIL, "panes": 3},
]
PASSAGES = [{"name": "cellar_door", "level": LEVEL, "start": (_CELLAR_DOOR[0], _HALL_BACK),
             "end": (_CELLAR_DOOR[1], _HALL_BACK)}]
# Over the cellar's doorway the glass wall's frame closes in a header (key, min, max).
CELLAR_HEADER = ("frame", (_CELLAR_DOOR[0], _HALL_BACK - 0.03, DOOR_HEAD), (_CELLAR_DOOR[1], _HALL_BACK + 0.03, CEIL))

# The karaoke's acoustic velvet on its back and east walls, floor to ceiling (key, min, max), in its room's object.
LININGS = [
    ("velvet", (_EAST + 0.06, _IY1 - 0.03, FLOOR), (_IX1, _IY1, CEIL)),
    ("velvet", (_IX1 - 0.03, _HALL_FRONT + 0.06, FLOOR), (_IX1, _IY1 - 0.03, CEIL)),
]

# The house's spiral stair goes on down its column to the hall: a flight of the house's treads (18 degrees each, here
# 19.4 cm), turned half a turn so its top tread ends flush with the ground floor on the -X axis, a quarter turn before
# the house's first tread: the quarter of the ground slab between them is the landing both leave from (shell.py).
STAIR_RISE = round(LEVEL_Z[0] - FLOOR, 3)
STAIR_TREADS = 21
STAIR = {"name": "Stair_basement", "center": HOUSE_STAIR["center"], "rot": 180,
         "opts": {"rise": STAIR_RISE, "treads": STAIR_TREADS,
                  "turns": round(STAIR_TREADS * SPIRAL_STAIR["turns"] / SPIRAL_STAIR["treads"], 6), "cap": False}}

_ROOMS = {"into": ROOMS_OBJECT}
_SPA = {"into": SPA}
_PARTY = {"into": PARTY}
FURNITURE = [
    # the hall: the stair down from the living room at its west end; a seating pair on a rug round a coffee table, a
    # living plant wall on its front wall, plants
    ("spiral_stair", STAIR["name"], "basement_hall", STAIR["center"], STAIR["rot"], STAIR["opts"]),
    ("rug", "Rug_basement_hall", "basement_hall", (-5.6, 1.5), 0, _ROOMS),
    ("rattan_armchair", "Armchair_basement_1", "basement_hall", (-6.75, 1.5), 90, _ROOMS),
    ("rattan_armchair", "Armchair_basement_2", "basement_hall", (-4.45, 1.5), 270, _ROOMS),
    ("coffee_table", "Coffee_table_basement", "basement_hall", (-5.6, 1.5), 90, _ROOMS),
    ("plant_wall", "Plant_wall_basement", "basement_hall", (-0.4, _HALL_FRONT + 0.16), 180, _ROOMS),
    ("plant_tall", "Plant_basement_hall", "basement_hall", (1.5, 2.55), 0, _ROOMS),
    ("plant_small", "Plant_basement_stair", "basement_hall", (-8.3, 2.6), 0, _ROOMS),
    # the wine cellar: racks of bottles along its back and both side walls, a tasting table with two bar stools on a
    # rug, two barrels by the glass
    *[("wine_rack", f"Wine_rack_{k + 1}", "wine_cellar", (x, _IY1 - 0.2), 0, {"variant": k, **_ROOMS})
      for k, x in enumerate((-10.2, -8.1, -6.0, -3.9, -1.8, 0.3))],
    ("wine_rack", "Wine_rack_west", "wine_cellar", (_IX0 + 0.2, 5.0), 90, {"variant": 6, **_ROOMS}),
    ("wine_rack", "Wine_rack_east", "wine_cellar", (_EAST - 0.26, 5.0), 270, {"variant": 7, **_ROOMS}),
    ("rug", "Rug_wine_cellar", "wine_cellar", (-5.6, 5.15), 0, _ROOMS),
    ("tasting_table", "Tasting_table", "wine_cellar", (-5.6, 5.15), 0, _ROOMS),
    ("wine_set", "Wine_set", "wine_cellar", (-5.6, 5.15), 0, {"on": "Tasting_table", **_ROOMS}),
    ("wine_barrel", "Wine_barrel_1", "wine_cellar", (-2.3, 4.6), 0, _ROOMS),
    ("wine_barrel", "Wine_barrel_2", "wine_cellar", (-1.4, 4.6), 0, _ROOMS),
    # the karaoke lounge: the U of velvet facing the TV on the east wall between the tower speakers, the microphones
    # between them, the disco ball over the middle, a plant in a corner
    ("karaoke_sofa", "Karaoke_sofa", "karaoke", (6.4, 3.6), 90, _ROOMS),
    ("cushion_pair", "Cushions_karaoke", "karaoke", (5.34, 3.6), 90, {"on": "Karaoke_sofa", **_ROOMS}),
    ("karaoke_tv", "TV_karaoke", "karaoke", (_IX1 - 0.225, 3.6), 270, _PARTY),
    ("tower_speaker", "Speaker_karaoke_1", "karaoke", (_IX1 - 0.2, 1.9), 270, _PARTY),
    ("tower_speaker", "Speaker_karaoke_2", "karaoke", (_IX1 - 0.2, 5.3), 270, _PARTY),
    ("mic_stand", "Mic_stand", "karaoke", (9.3, 3.6), 0, _PARTY),
    ("disco_ball", DISCO, "karaoke", (8.3, 3.6), 0, {"cord": round(CEIL - FLOOR - 2.1 - 0.45, 3), "into": DISCO}),
    ("plant_tall", "Plant_karaoke", "karaoke", (2.5, 6.8), 0, _ROOMS),
    # the gym: treadmills and the squat rack facing the mirror on the east wall, dumbbells on the front wall, yoga
    # mats by the spa's wall
    ("mirror_wall", "Mirror_gym", "gym", (_IX1 - 0.015, -3.3), 270, _ROOMS),
    ("treadmill", "Treadmill_1", "gym", (9.6, -5.4), 90, _ROOMS),
    ("treadmill", "Treadmill_2", "gym", (9.6, -4.2), 90, _ROOMS),
    ("weight_rack", "Squat_rack", "gym", (6.0, -1.6), 90, _ROOMS),
    ("dumbbell_rack", "Dumbbell_rack", "gym", (6.0, _IY0 + 0.25), 180, _ROOMS),
    *[("yoga_mat", f"Yoga_mat_{k + 1}", "gym", (x, -4.6), 0, _ROOMS) for k, x in enumerate((3.2, 4.1, 5.0))],
    ("plant_tall", "Plant_gym", "gym", (2.5, -6.2), 0, _ROOMS),
    ("gym_kit", "Gym_kit", "gym", (7.3, -6.3), 0, _ROOMS),
    # the spa: the sauna cabin in its front left corner, beside the shower room, its glass door to the room; the stone
    # hot tub in front of the light well's glass; two massage beds, the shelf of oils over them, candles (its plants
    # are the light well's, beyond the glass: the spa shows on the wallpaper, where each material is a draw call)
    ("sauna_cabin", "Sauna", "spa", (-6.34, _IY0 + 1.06), 180, {"part": "cabin", **_SPA}),
    ("hot_tub_small", TUB, "spa", (-3.6, -4.9), 0, {"into": TUB}),
    ("massage_bed", "Massage_bed_1", "spa", (0.1, -3.6), 0, _SPA),
    ("spa_towels", "Spa_towels", "spa", (0.1, -3.05), 0, {"on": "Massage_bed_1", **_SPA}),
    ("massage_bed", "Massage_bed_2", "spa", (1.15, -3.6), 0, _SPA),
    ("oil_shelf", "Oil_shelf", "spa", (0.6, _HALL_FRONT - 0.185), 0, _SPA),
    ("candle_set", "Candles_spa_1", "spa", (-2.2, -3.5), 0, {"into": "LT_down_spa"}),
    ("candle_set", "Candles_spa_2", "spa", (0.6, -5.0), 0, {"into": "LT_down_spa"}),
    ("candle_set", "Candles_spa_3", "spa", (-5.0, -3.6), 0, {"into": "LT_down_spa"}),
    # the shower room: two stalls along the front wall, the WC, a vanity on the spa's wall, a towel rack, a plant
    ("shower", "Shower_basement_1", "shower_room", (-10.75, _IY0 + 0.55), 180, _ROOMS),
    ("shower", "Shower_basement_2", "shower_room", (-9.65, _IY0 + 0.55), 180, _ROOMS),
    ("toilet", "Toilet_basement", "shower_room", (_IX0 + 0.35, -2.4), 90, _ROOMS),
    ("vanity_single", "Vanity_basement", "shower_room", (_SHOWERS_SPA - 0.31, -3.6), 270, _ROOMS),
    ("towel_rack", "Towel_rack_basement", "shower_room", (_IX0 + 0.06, -4.4), 90, _ROOMS),
    ("plant_small", "Plant_shower_room", "shower_room", (-8.1, _IY0 + 0.4), 0, _ROOMS),
    # one wall switch per room, 1 cm proud of its wall, 1.15 m up: under the cut, so a click reaches it while the
    # website shows the basement
    ("light_switch", "Switch_basement_hall", "basement_hall", (-7.35, _HALL_FRONT + 0.07), 180),
    ("light_switch", "Switch_wine_cellar", "wine_cellar", (_EAST - 0.07, 3.5), 270),
    ("light_switch", "Switch_karaoke", "karaoke", (_EAST + 0.07, 2.3), 90),
    ("light_switch", "Switch_gym", "gym", (_EAST + 0.07, -0.3), 90),
    ("light_switch", "Switch_spa", "spa", (-3.5, _HALL_FRONT - 0.07), 0),
    ("light_switch", "Switch_shower_room", "shower_room", (-9.0, _HALL_FRONT - 0.07), 0),
]

# One group for the level; split into one LT_down_<room> per room (houses/interact.py), each of which also holds the
# light its downlights cast on the floor (POOLS): the cut takes the ceiling away, the pools show the rooms lit at night.
DOWNLIGHTS = split_downlights([{"name": "LT_down_basement", "level": LEVEL, "z": CEIL, "points": [
    (-7.0, 1.5), (-3.5, 1.5), (0.0, 1.5),                    # hall
    (-8.0, 5.2), (-4.0, 5.2), (0.0, 5.2),                    # wine cellar
    (4.5, 1.6), (4.5, 5.6), (8.3, 1.2), (8.3, 6.0),          # karaoke
    (4.5, -3.3), (8.0, -5.0), (8.0, -1.6),                   # gym
    (-5.5, -2.5), (-3.6, -4.9), (0.6, -3.6),                 # spa
    (-9.5, -4.5), (-9.5, -1.5),                              # shower room
]}], ROOMS)
POOL_RADIUS = 1.2
POOL_LIFT = 0.006  # over the floor's finish
PARTY_POOL = {"group": LEDS, "center": (8.3, 3.6), "radius": 2.2, "start": 0.0, "sweep": 2 * math.pi}
POOLS = [{"group": group["name"], "center": point, "radius": POOL_RADIUS, "start": 0.0, "sweep": 2 * math.pi}
         for group in DOWNLIGHTS for point in group["points"]] + [PARTY_POOL]

# The karaoke's party LEDs (LED_party): a strip round its walls just over the floor and one at chest height, under the
# cut, which shows them round the room ((x0, y0), (x1, y1), top), skipping the door from the hall.
_KX0, _KY0, _KX1, _KY1 = _EAST + 0.08, _HALL_FRONT + 0.08, _IX1 - 0.06, _IY1 - 0.06
_DOOR_KARAOKE = (_HALL_FRONT + 0.06 + 0.94, _HALL_FRONT + 0.06 + 0.94 + DOOR_WIDTH)
PARTY_STRIPS = [segment for z in (FLOOR + 0.08, FLOOR + 1.5) for segment in (
    ((_KX0, _KY1), (_KX1, _KY1), z), ((_KX1, _KY0), (_KX1, _KY1), z), ((_KX0, _KY0), (_KX1, _KY0), z),
    ((_KX0, _KY0), (_KX0, _DOOR_KARAOKE[0]), z), ((_KX0, _DOOR_KARAOKE[1]), (_KX0, _KY1), z))]
# The sauna's faint warm light, an ember-lit strip under its upper bench (in its stove's object, the sauna group), in
# module space.
SAUNA_LIGHT = ((-7.38, -5.94), (-5.3, -5.94), FLOOR + 0.84)
# The hot tub's water, in its basin (WATER_hot_tub), and its bubbles (Hot_tub_bubbles_a), the house jacuzzi's way.
TUB_WATER = {"name": f"WATER_{TUB.lower()}", "top": round(FLOOR + 0.62, 3), "half": 0.88}

# The light well's palm in its middle, two potted palms and a bird of paradise by the glass (all of the palm's few
# colours: the light well is drawn on the wallpaper, where each is a draw call), which sway in the wind like the garden's
# plants (kind, object, (x, y, z), rotation[, options]); and ground uplights at the foot of three walls and
# under the palm, whose light washes up the walls at night (WASHES: half discs of GLOW_pool upright on a wall's face,
# `facing` the way the wall faces, radians from +X).
_WIND = {"wind": True}
_WCX = round((_WX0 + _WX1) / 2, 3)
_WCY = round((_WY0 + WALL + TERRACE) / 2, 3)
WELL_PIECES = [
    ("palm_courtyard", WELL_PLANTS, (_WCX, _WCY, WELL_FLOOR), 0, _WIND),
    ("palm_small", WELL_PLANTS, (_WX0 + WALL + 0.45, _WY0 + WALL + 0.45, WELL_FLOOR), 0, _WIND),
    ("palm_small", WELL_PLANTS, (_WX1 - WALL - 0.45, _WY0 + WALL + 0.45, WELL_FLOOR), 0, _WIND),
    ("bird_of_paradise", WELL_PLANTS, (_WX0 + WALL + 0.5, TERRACE - 0.6, WELL_FLOOR), 0, _WIND),
    ("uplight", WELL_LIGHTS, (_WX0 + WALL + 0.15, _WCY, WELL_FLOOR), 0),
    ("uplight", WELL_LIGHTS, (_WX1 - WALL - 0.15, _WCY, WELL_FLOOR), 0),
    ("uplight", WELL_LIGHTS, (_WCX, _WY0 + WALL + 0.15, WELL_FLOOR), 0),
    ("uplight", WELL_LIGHTS, (_WCX, _WCY + 1.5, WELL_FLOOR), 0),
]
WASHES = [
    {"group": WELL_LIGHTS, "center": (_WX0 + WALL + 0.005, _WCY, WELL_FLOOR), "radius": 1.9, "height": 3.4,
     "facing": 0.0},
    {"group": WELL_LIGHTS, "center": (_WX1 - WALL - 0.005, _WCY, WELL_FLOOR), "radius": 1.9, "height": 3.0,
     "facing": math.pi},
    {"group": WELL_LIGHTS, "center": (_WCX, _WY0 + WALL + 0.005, WELL_FLOOR), "radius": 2.3, "height": 3.0,
     "facing": math.pi / 2},
]
# A warm LED strip round the light well's top, under the coping on its walls and on the plinth's face over the glass,
# washing the far walls down from the rim (a negative height): the wallpaper camera sees down into the well a metre or
# so, where these glow at night, the uplights' only under the cut.
_RIM_Z = -0.06
WASHES += [
    {"group": WELL_LIGHTS, "center": (_WX0 + WALL + 0.005, _WCY, _RIM_Z), "radius": 2.0, "height": -2.4,
     "facing": 0.0},
    {"group": WELL_LIGHTS, "center": (_WCX, TERRACE - 0.005, _RIM_Z), "radius": 2.3, "height": -2.4,
     "facing": -math.pi / 2},
]
WELL_STRIPS = [
    ((_WX0 + WALL + 0.02, _WY0 + WALL), (_WX0 + WALL + 0.02, TERRACE), _RIM_Z),
    ((_WX0 + WALL, _WY0 + WALL + 0.02), (_WX1 - WALL, _WY0 + WALL + 0.02), _RIM_Z),
    ((_WX1 - WALL - 0.02, _WY0 + WALL), (_WX1 - WALL - 0.02, TERRACE), _RIM_Z),
    ((_WX0 + WALL, TERRACE - 0.03), (_WX1 - WALL, TERRACE - 0.03), _RIM_Z),
]
# The frameless glass railing round the light well's top, on the coping's middle along its three open sides, in a low
# steel shoe.
WELL_RAIL = {"object": "Light_well_rail", "z0": COPING, "height": 1.0, "runs": [
    ((_WX0 + WALL / 2, TERRACE - 0.02), (_WX0 + WALL / 2, _WY0 + WALL / 2)),
    ((_WX0 + WALL / 2, _WY0 + WALL / 2), (_WX1 - WALL / 2, _WY0 + WALL / 2)),
    ((_WX1 - WALL / 2, _WY0 + WALL / 2), (_WX1 - WALL / 2, TERRACE - 0.02)),
]}

# The objects the build makes, with what the website does to them (build_basement.py tags them): "buried" ones only
# show under the basement's cut, "uncut" ones stand whole under it, a "night" one is a night light.
OBJECTS = {
    WALLS: {"uncut": True}, RIM: {"buried": True, "uncut": True},
    PARTITIONS_OBJECT: {}, FLOOR_OBJECT: {}, ROOM_FLOORS: {"buried": True},
    GLASS_SPA: {}, GLASS_CELLAR: {"buried": True},
    ROOMS_OBJECT: {"buried": True},
    SPA: {}, TUB: {}, SAUNA: {"night": True, "buried": True},
    STAIR["name"]: {},
    PARTY: {"buried": True, "night": True}, LEDS: {"buried": True, "night": True},
    DISCO: {"buried": True, "uncut": True, "night": True},
    WELL_OBJECT: {"uncut": True}, WELL_PLANTS: {"uncut": True}, WELL_RAIL["object"]: {"uncut": True},
    WELL_LIGHTS: {"uncut": True, "night": True},
    **{group["name"]: {"night": True, **({} if group.get("room") == "spa" else {"buried": True})}
       for group in DOWNLIGHTS},
}

# What the website sees the basement through while the house stands over it (cutaway.ts showThroughOpenings): the light
# well's top inside its coping, and the ground slab's hole round the stair (the stair's whole square, at the ground
# floor), (x0, y0, x1, y1, z) in module space, on the object that stands in each (build_basement.py tags it "opening").
# Under the lawn the rest of the basement is drawn only where one of them lets the camera see it.
_SX, _SY = STAIR["center"]
_SR = KIT["spiral_stair"][0] / 2
OPENINGS = {
    WELL_OBJECT: (WELL_INSIDE[0][0], WELL_INSIDE[0][1], WELL_INSIDE[1][0], WELL_INSIDE[1][1], COPING),
    STAIR["name"]: (_SX - _SR, _SY - _SR, _SX + _SR, _SY + _SR, LEVEL_Z[0]),
}

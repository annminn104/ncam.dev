"""Ground floor of the villa v2 house (level 0, villa v2 spec §5.1, §5.4; the tall house, §12): rooms, furniture, lights
and, since the resort deco, the reflecting pool along the terrace and the wall fountain beside the door. The living room
is double height over its front part (common.VOID): the spiral stair climbs from it to the gallery and the crystal
chandelier hangs in the void from the upper floor's ceiling. Pure Python.

Furniture entries are (kind, object name, room, (x, y), rotation in degrees[, builder options]); rot 90 faces +X,
270 faces -X, 180 faces +Y. Pieces stand clear of the partitions in shell.py (0.12 m thick, centred on their line) and
on the floor of their room: its level's LEVEL_Z, or the room's own "floor" (the terrace's plinth).
"""
from .common import FRONT, GROUND_CEIL, LEFT, LEVEL_Z, PLINTH, RIGHT, STONE_LEFT, TERRACE, UPPER_CEIL, VOID, WALL, hang
from .shell import COLUMN_Y, COLUMNS_X, FACADE, STAIR

ROOMS = [
    # the double-height living room: the void at its front, the reading corner under the gallery behind it
    {"name": "living", "level": 0, "min": (LEFT + WALL, FRONT), "max": (-3.4, 7.3), "interior": True},
    # the dining room takes the strip up to the hall wall: the sideboard backs onto it
    {"name": "dining", "level": 0, "min": (-3.4, FRONT), "max": (STONE_LEFT, 0.5), "interior": True},
    {"name": "kitchen", "level": 0, "min": (-3.4, 0.5), "max": (STONE_LEFT, 7.3), "interior": True},
    {"name": "hall", "level": 0, "min": (STONE_LEFT, -0.5), "max": (9.0, 7.3), "interior": True},
    {"name": "foyer", "level": 0, "min": (STONE_LEFT, FRONT), "max": (RIGHT - WALL, -0.5), "interior": True},
    {"name": "wc", "level": 0, "min": (9.0, -0.5), "max": (RIGHT - WALL, 2.0), "interior": True},
    {"name": "laundry", "level": 0, "min": (9.0, 2.0), "max": (RIGHT - WALL, 7.3), "interior": True},
    # the plinth in front of the glass and of the stone block, where the steps come up to the door: it stops at the
    # stone front's outer face (FACADE), and its floor is the plinth top, 2 cm under the interior one (LEVEL_Z[0])
    {"name": "terrace", "level": 0, "min": (LEFT, TERRACE), "max": (RIGHT, FACADE), "floor": PLINTH},
]
# What the website calls each room on hover (interaction spec §3.1): "Đèn phòng khách", "TV phòng khách".
ROOM_LABELS = {"living": "phòng khách", "dining": "phòng ăn", "kitchen": "bếp", "hall": "sảnh", "foyer": "tiền sảnh",
               "wc": "phòng vệ sinh khách", "laundry": "phòng giặt", "terrace": "hiên trước"}

# the sofa group in the middle of the void, and the crystal chandelier over the front of its rug: from the wallpaper's
# camera (siteplan.zones CAM_idle) the stair, behind it, shows some 8 degrees off it rather than lined up with it
_SOFA_GROUP = (-7.4, -2.0)
_CHANDELIER = (-7.4, -2.8)
# the stair's upper flight, from the gallery's landing to the roof: 23 treads of 19 cm, a turn and a quarter
_UPPER_FLIGHT = {"rise": round(LEVEL_Z[2] - LEVEL_Z[1], 3), "treads": 23, "turns": 1.25}

FURNITURE = [
    # living: in the void, under the chandelier, the L sofa, its back to the tall west glass, faces the TV on the media
    # wall; a palm in the corner by the media wall, a monstera in the corner of the glass, a bird of paradise by the
    # TV. The spiral stair rises from the void's back left corner to the gallery and on to the roof. Behind, under the
    # gallery, a reading corner of two rattan armchairs on a rug in front of the built-in bookcase, a fern hanging from
    # the gallery
    ("rug", "Rug_living", "living", _SOFA_GROUP, 90),
    ("tv_wall", "TV_wall", "living", (-3.71, -2.0), 270),
    ("coffee_table", "Coffee_table", "living", _SOFA_GROUP, 90),
    ("sofa_l", "Sofa", "living", (-9.3, -2.0), 90),
    ("crystal_chandelier", "Chandelier", "living", _CHANDELIER, 0, hang("crystal_chandelier", 0, _CHANDELIER)),
    ("spiral_stair", STAIR["name"], "living", STAIR["center"], 0, {"upper": _UPPER_FLIGHT}),
    ("bird_of_paradise", "Bird_of_paradise_tv", "living", (-3.95, 0.35), 0),
    ("monstera", "Monstera_living", "living", (-10.5, -4.6), 0),   # clear of the tall curtains' stacks in the corner
    ("palm_tall", "Palm_living", "living", (-4.45, -4.4), 0),
    ("fern_hanging", "Fern_living_1", "living", (-4.2, 2.3), 0, hang("fern_hanging", 0, (-4.2, 2.3))),
    ("rug", "Rug_reading", "living", (-6.4, 5.0), 0),
    ("rattan_armchair", "Armchair_living_1", "living", (-7.4, 5.0), 90),
    ("rattan_armchair", "Armchair_living_2", "living", (-5.4, 5.0), 270),
    ("floor_lamp", "Floor_lamp", "living", (-8.4, 5.9), 0),
    ("bookshelf_wall", "Bookshelf_living", "living", (-6.4, 7.1), 0),
    ("plant_tall", "Plant_living", "living", (-10.9, 6.9), 0),
    ("painting_l", "Painting_living_1", "living", (-11.275, 4.8), 90, {"variant": 0}),
    ("painting_l", "Painting_living_2", "living", (-4.3, 7.275), 0, {"variant": 1}),
    # dining: table for eight under two rattan pendants, sideboard and painting on the hall wall
    ("dining_set_8", "Dining", "dining", (1.0, -2.6), 0),
    ("rattan_pendant", "Pendant_dining_1", "dining", (0.4, -2.6), 0, hang("rattan_pendant", 0)),
    ("rattan_pendant", "Pendant_dining_2", "dining", (1.6, -2.6), 0, hang("rattan_pendant", 0)),
    ("sideboard", "Sideboard", "dining", (5.19, -1.55), 270),
    ("painting_m", "Painting_dining", "dining", (5.415, -1.55), 270, {"variant": 2}),
    ("plant_tall", "Plant_dining", "dining", (-2.85, -4.85), 0),
    # kitchen: the run against the back wall, oven and fridge column on the hall wall, island with four stools under
    # three rattan pendants, a bird of paradise in the corner open to the living room
    ("kitchen_run", "Kitchen_run", "kitchen", (1.0, 6.975), 0),
    ("fridge_tower", "Fridge_tower", "kitchen", (5.115, 3.8), 270),
    ("kitchen_island_4", "Kitchen_island", "kitchen", (1.0, 3.8), 0),
    *[("rattan_pendant", f"Pendant_island_{i + 1}", "kitchen", (x, 3.8), 0, hang("rattan_pendant", 0))
      for i, x in enumerate((0.1, 1.0, 1.9))],
    ("bird_of_paradise", "Plant_kitchen", "kitchen", (-2.9, 6.8), 0),
    # hall: wine and bar cabinet on the kitchen wall
    ("bar_cabinet", "Bar_cabinet", "hall", (5.86, 2.6), 90),
    ("painting_m", "Painting_hall", "hall", (7.25, 7.275), 0, {"variant": 3}),
    ("plant_small", "Plant_hall", "hall", (8.6, 6.9), 0),
    # foyer behind the sliding door
    ("shoe_cabinet", "Shoe_cabinet", "foyer", (10.2, -5.2), 180),
    ("bench_mirror", "Bench_mirror", "foyer", (11.075, -3.2), 270),
    ("console", "Console_foyer", "foyer", (10.15, -0.735), 0),
    ("plant_tall", "Plant_foyer", "foyer", (6.05, -4.95), 0),
    # guest WC and laundry
    ("toilet", "Toilet_wc", "wc", (10.95, 1.4), 270),
    ("vanity_single", "Vanity_wc", "wc", (10.4, -0.19), 180),
    ("washer_dryer", "Washer_dryer", "laundry", (10.25, 6.975), 0),
    ("laundry_shelf", "Laundry_shelf", "laundry", (10.25, 7.15), 0),
    # entry: potted palms flanking the door, lanterns at the head of the steps
    ("palm_small", "Palm_door_l", "terrace", (6.5, -6.0), 0, {"wind": True}),
    ("palm_small", "Palm_door_r", "terrace", (8.7, -6.0), 0, {"wind": True}),
    ("lantern", "Lantern_steps_l", "terrace", (6.3, -6.62), 0),
    ("lantern", "Lantern_steps_r", "terrace", (8.9, -6.62), 0),
    # one wall switch per lit room, 1 cm proud of the wall face and 1.15 m up: beside the doorway where the room has
    # one (0.3 m past the leaf), on a wall of the open-plan rooms. They keep a room's lights in reach under the cut.
    # Facing -Y or +X they show from the website's default side (the south east), the others from the opposite one.
    ("light_switch", "Switch_living", "living", (-11.29, 3.2), 90),      # west wall, behind the stair
    ("light_switch", "Switch_dining", "dining", (5.43, 0.2), 270),        # hall wall, past the painting
    ("light_switch", "Switch_kitchen", "kitchen", (5.43, 1.0), 270),      # the same wall, kitchen side of y = 0.5
    ("light_switch", "Switch_hall", "hall", (8.93, 1.2), 270),            # beside the door to the WC
    ("light_switch", "Switch_foyer", "foyer", (8.5, -5.39), 180),         # inside the stone front, beside the door
    ("light_switch", "Switch_wc", "wc", (9.07, 1.2), 90),                 # beside its door, back to the hall's switch
    ("light_switch", "Switch_laundry", "laundry", (9.07, 4.6), 90),       # beside the door, past the leaf
]

# archkit.water.reflecting_pool, in place of the terrace planters: a strip along the whole glass front, from the
# plinth's front edge to just short of the glazing, that the columns rise out of. The stepping stones run down the
# middle of the basin a pace apart from the door end, where the plinth in front of the stone block leads onto them,
# to the living room's corner; two columns stand in the row in place of a stone.
_POOL_MIN, _POOL_MAX = (LEFT + 0.1, TERRACE), (STONE_LEFT - 0.1, FRONT - 0.06)
_PACE = (COLUMNS_X[1] - COLUMNS_X[0]) / 6  # a long stride: the columns stand six paces apart
_STONES = [round(COLUMNS_X[1] + _PACE * i, 3) for i in range(-15, 5)]
REFLECTING_POOLS = [
    {"name": "reflecting_pool", "level": 0, "min": _POOL_MIN, "max": _POOL_MAX, "z": PLINTH,
     "steps": [(x, round((_POOL_MIN[1] + _POOL_MAX[1]) / 2, 3)) for x in _STONES
               if min(abs(x - column) for column in COLUMNS_X) > 0.3]},
]
# archkit.water.wall_fountain on the stone front right of the door, its back 5 mm into the wall (no shared face).
WALL_FOUNTAINS = [
    {"name": "fountain", "start": (10.05, FACADE - 0.095), "end": (11.45, FACADE - 0.095), "z0": PLINTH,
     "height": 1.7, "facing": -1},
]

# One group per level here; house_layout splits it into one LT_down_<room> object per room (houses/interact.py). The
# living room's are in the ceiling of its void, the upper floor's: a group of their own at that height.
DOWNLIGHTS = [
    {"name": "LT_down_ground", "level": 0, "z": GROUND_CEIL, "points": [
        (-1.5, -4.0), (3.5, -4.0), (1.0, -0.6),                 # dining
        (-1.2, 5.6), (3.2, 5.6), (1.0, 1.6),                    # kitchen
        (7.25, 1.6), (7.25, 5.4),                               # hall
        (6.8, -4.0), (9.6, -4.0), (8.2, -1.6),                  # foyer
        (9.7, 0.75), (10.6, 0.75),                              # wc
        (10.15, 3.6), (10.15, 5.8),                             # laundry
    ]},
    {"name": "LT_down_void", "level": 0, "z": UPPER_CEIL, "points": [
        (-9.6, -4.0), (-5.2, -4.0), (-9.6, 0.0), (-5.2, 0.0),   # living
    ]},
]
PENDANTS = []  # the dining table's light is the pair of rattan pendants in FURNITURE
# Energies are three.js PointLight intensities (RAW export), tuned on the wallpaper at 21:00: the dining end of the
# kitchen light's room was the darkest of the four, so it gets the largest share. The living room's shines from inside
# the chandelier, among its crystals.
POINT_LIGHTS = [
    {"name": "L_living", "level": 0, "pos": (*_CHANDELIER, 4.0), "energy": 160.0},
    {"name": "L_kitchen", "level": 0, "pos": (1.0, 0.6, 3.8), "energy": 100.0},
]

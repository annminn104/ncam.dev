"""Upper floor of the villa v2 house (level 1, villa v2 spec §5.1, §5.4; the tall house, §12): the gallery along the
double-height living room's void, which is the hallway, the master suite with closet and bath at the east end, bedrooms
2 and 3, the shared bath, the gaming corner and the balcony; a split air conditioner in each bedroom. Pure Python.

Furniture entries are (kind, object name, room, (x, y), rotation in degrees[, builder options]); rot 90 faces +X,
270 faces -X, 180 faces +Y. Pieces stand clear of the partitions in shell.py, of their door clearances and of the
stair's hole and landing.
"""
from .common import EDGE, FRONT, LEFT, UPPER_CEIL, UPPER_FLOOR, UPPER_RIGHT, WALL, hang
from .shell import BALCONY_X0, VOID_Y1

ROOMS = [
    # the gallery along the back of the void, from the west wall past the stair's landing to the closet's door
    {"name": "gallery", "level": 1, "min": (LEFT + WALL, VOID_Y1), "max": (2.5, 3.1), "interior": True},
    {"name": "bedroom2", "level": 1, "min": (-3.4, FRONT), "max": (2.5, VOID_Y1), "interior": True},
    {"name": "master", "level": 1, "min": (2.5, FRONT), "max": (UPPER_RIGHT - WALL, VOID_Y1), "interior": True},
    {"name": "closet", "level": 1, "min": (2.5, VOID_Y1), "max": (4.7, 7.3), "interior": True},
    {"name": "bath_master", "level": 1, "min": (4.7, VOID_Y1), "max": (UPPER_RIGHT - WALL, 7.3), "interior": True},
    {"name": "bedroom3", "level": 1, "min": (LEFT + WALL, 3.1), "max": (-4.8, 7.3), "interior": True},
    {"name": "bath_shared", "level": 1, "min": (-4.8, 3.1), "max": (-1.8, 7.3), "interior": True},
    # the PC and gaming corner, open to the gallery
    {"name": "gaming", "level": 1, "min": (-1.8, 3.1), "max": (2.5, 7.3), "interior": True},
    {"name": "balcony", "level": 1, "min": (BALCONY_X0, EDGE + 0.1), "max": (UPPER_RIGHT, FRONT)},
]
ROOM_LABELS = {"gallery": "Hallway", "master": "Master bedroom", "bath_master": "Master bathroom",
               "closet": "Dressing room", "bedroom2": "Bedroom 2", "bedroom3": "Bedroom 3",
               "bath_shared": "Shared bathroom", "gaming": "Computer corner", "balcony": "Balcony"}

FURNITURE = [
    # master: king bed against the east wall facing the TV, dresser on the closet wall, reading chair and a bird of
    # paradise at the glass, a rattan pendant over the foot of the bed (every bedroom has one, and a plant); the curtains
    # and the accessories are the interior module's (interior/interior_layout.py)
    ("rug", "Rug_master", "master", (6.0, -2.0), 90),
    ("bed_king", "Bed_master", "master", (7.15, -2.0), 270),
    ("nightstand_lamp", "Nightstand_master_l", "master", (8.1, -3.3), 270),
    ("nightstand_lamp", "Nightstand_master_r", "master", (8.1, -0.7), 270),
    ("tv_cabinet", "TV_master", "master", (2.785, -2.0), 90),
    ("dresser_mirror", "Dresser_master", "master", (5.6, 0.99), 0),
    ("armchair", "Armchair_master", "master", (3.5, -4.6), 0),
    ("painting_l", "Painting_master", "master", (8.275, -2.0), 270, {"variant": 4}),
    ("rattan_pendant", "Pendant_master", "master", (5.5, -2.0), 0, hang("rattan_pendant", 1)),
    ("bird_of_paradise", "Plant_master", "master", (4.6, -4.98), 0),
    # master bath: tub under the frosted window, glass shower and double vanity on the back wall
    ("bathtub", "Bathtub_master", "bath_master", (7.9, 4.4), 90),
    ("shower", "Shower_master", "bath_master", (7.76, 6.76), 0),
    ("vanity_double", "Vanity_master", "bath_master", (5.9, 7.025), 0),
    ("toilet", "Toilet_master", "bath_master", (5.11, 4.6), 90),
    ("towel_rack", "Towel_rack_master", "bath_master", (6.5, 1.62), 180),
    # walk-in closet
    ("closet_rack", "Closet_rack", "closet", (2.86, 5.0), 90),
    ("shoe_cabinet", "Shoe_rack_closet", "closet", (3.7, 7.1), 0),
    # bedroom 2: bed on the gallery wall, a desk by the glass on the void's side, a reading chair
    ("bed_double", "Bed_room2", "bedroom2", (0.4, 0.34), 0),
    ("nightstand", "Nightstand_room2", "bedroom2", (-0.85, 1.24), 0),
    ("painting_m", "Painting_room2", "bedroom2", (0.4, 1.415), 0, {"variant": 6}),
    ("wardrobe", "Wardrobe_room2", "bedroom2", (2.14, -1.6), 270),
    ("desk", "Desk_room2", "bedroom2", (-2.79, -4.3), 90),
    ("armchair", "Armchair_room2", "bedroom2", (1.6, -4.6), 0),
    ("rug", "Rug_room2", "bedroom2", (0.0, -2.2), 0),
    ("rattan_pendant", "Pendant_room2", "bedroom2", (0.0, -2.2), 0, hang("rattan_pendant", 1)),
    ("bird_of_paradise", "Plant_room2", "bedroom2", (-0.4, -4.95), 0),
    # bedroom 3, at the back, its window in the west wall
    ("bed_single", "Bed_room3", "bedroom3", (-9.0, 6.25), 0),
    ("desk", "Desk_room3", "bedroom3", (-10.75, 5.0), 90),           # between the window's curtain stacks
    ("wardrobe", "Wardrobe_room3", "bedroom3", (-5.16, 5.6), 270),
    ("bookshelf", "Bookshelf_room3", "bedroom3", (-7.2, 7.125), 0),
    ("nightstand", "Nightstand_room3", "bedroom3", (-8.0, 7.1), 0),
    ("rug", "Rug_room3", "bedroom3", (-8.0, 4.9), 0),
    ("painting_m", "Painting_room3", "bedroom3", (-9.0, 7.275), 0, {"variant": 7}),
    ("rattan_pendant", "Pendant_room3", "bedroom3", (-8.0, 4.9), 0, hang("rattan_pendant", 1)),
    ("monstera", "Plant_room3", "bedroom3", (-10.55, 6.8), 0),       # clear of the window's north stack
    # shared bath
    ("shower", "Shower_shared", "bath_shared", (-2.36, 6.74), 0),
    ("vanity_single", "Vanity_shared", "bath_shared", (-3.8, 7.05), 0),
    ("toilet", "Toilet_shared", "bath_shared", (-4.39, 5.3), 90),
    ("towel_rack", "Towel_rack_shared", "bath_shared", (-2.15, 3.22), 180),
    # the gaming corner: the L desk with three screens and the PC against the back wall, the gaming chair facing it
    ("gaming_desk", "Gaming_desk", "gaming", (0.35, 6.44), 0),
    ("gaming_chair", "Gaming_chair", "gaming", (0.35, 5.25), 180),
    ("wall_shelf", "Wall_shelf_gaming", "gaming", (0.35, 7.175), 0),
    # the gallery: a painting facing the void, a tall plant at its east end by the gaming corner (the bench between
    # the doors is the interior module's)
    ("painting_m", "Painting_hallway", "gallery", (-8.0, 3.015), 0, {"variant": 5}),
    ("plant_tall", "Plant_hallway", "gallery", (-2.35, 2.75), 0),
    # balcony: the bistro set, a hanging egg chair and potted plants that sway, between the planters; its first metre
    # and a half by the void stays clear, so the chandelier shows over it from the front right (the wallpaper's side)
    ("bistro_set", "Balcony_set", "balcony", (1.0, -6.05), 0),
    ("palm_small", "Palm_balcony", "balcony", (2.4, -6.4), 0, {"wind": True}),
    ("egg_chair", "Egg_chair", "balcony", (5.6, -6.1), 0),
    ("monstera", "Monstera_balcony", "balcony", (6.75, -6.35), 0, {"wind": True}),
    # one wall switch per lit room, beside its doorway (0.3 m past the leaf) except the gallery's, the gaming corner's
    # and the balcony's (see ground.py): the gallery's where the stair arrives, the gaming corner's on its side wall,
    # the balcony's on the end of the upper box's east wall
    ("light_switch", "Switch_master", "master", (3.8, 1.43), 0),
    ("light_switch", "Switch_bath_master", "bath_master", (4.77, 3.2), 90),
    ("light_switch", "Switch_closet", "closet", (2.57, 3.1), 90),
    ("light_switch", "Switch_gallery", "gallery", (-9.0, 3.03), 0),
    ("light_switch", "Switch_bedroom2", "bedroom2", (-1.8, 1.43), 0),
    ("light_switch", "Switch_bedroom3", "bedroom3", (-5.2, 3.17), 180),
    ("light_switch", "Switch_bath_shared", "bath_shared", (-2.7, 3.17), 180),
    ("light_switch", "Switch_gaming", "gaming", (-1.73, 3.8), 90),
    ("light_switch", "Switch_balcony", "balcony", (UPPER_RIGHT - 0.12, FRONT - 0.01), 0),
    # a split air conditioner in each bedroom, high on a partition clear of its doors, of the glass and of the bed's
    # head, and its wall remote beside the room's light switch, under the cut (houses/interact.py: ac:<room>)
    ("ac_split", "AC_master", "master", (7.2, 1.33), 0),            # the closet and bath wall, over the dresser's side
    ("ac_split", "AC_bedroom2", "bedroom2", (-3.23, -1.0), 90),     # the wall to the void
    ("ac_split", "AC_bedroom3", "bedroom3", (-9.0, 3.27), 180),     # the gallery wall, over the desk's end
    ("ac_remote", "AC_remote_master", "master", (4.1, 1.43), 0),
    ("ac_remote", "AC_remote_bedroom2", "bedroom2", (-1.5, 1.43), 0),
    ("ac_remote", "AC_remote_bedroom3", "bedroom3", (-4.95, 3.17), 180),
]

# Along the balcony railing (object name, (x, y, z) base, (w, d, h) size, shrubs)
PLANTERS = [
    ("PLANT_balcony_1", (-0.7, -6.69, UPPER_FLOOR + 0.02), (1.6, 0.45, 0.45), 3),
    ("PLANT_balcony_2", (3.9, -6.69, UPPER_FLOOR + 0.02), (1.8, 0.45, 0.45), 3),
]

DOWNLIGHTS = [
    {"name": "LT_down_upper", "level": 1, "z": UPPER_CEIL, "points": [
        (-8.4, 2.3), (-5.0, 2.3), (-1.6, 2.3), (1.6, 2.3),     # gallery
        (-2.0, -4.0), (1.0, -4.0), (-0.5, -0.6),               # bedroom 2
        (4.0, -4.0), (7.0, -4.0), (5.4, -0.6),                 # master
        (3.6, 3.4), (3.6, 5.9),                                # closet
        (6.5, 3.0), (6.5, 5.9),                                # master bath
        (-9.6, 5.2), (-6.6, 5.2),                              # bedroom 3
        (-3.3, 4.2), (-3.3, 6.3),                              # shared bath
        (0.35, 4.3), (0.35, 6.3),                              # gaming corner
    ]},
    # under the roof slab where it shades the balcony
    {"name": "LT_down_balcony", "level": 1, "z": UPPER_CEIL - 0.02,
     "points": [(x, EDGE + 0.75) for x in (-2.4, 0.0, 2.4, 4.8, 7.2)]},
]
# Tuned on the wallpaper at 21:00 (see ground.py): the white upper rooms sit close to their ceiling lights and were already
# the brightest, so they go down a little to stay clear of pure white.
POINT_LIGHTS = [
    {"name": "L_master", "level": 1, "pos": (5.4, -2.0, 8.4), "energy": 60.0},
    {"name": "L_bedroom2", "level": 1, "pos": (-0.5, -2.0, 8.4), "energy": 55.0},
]

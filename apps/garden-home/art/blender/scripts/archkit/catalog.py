"""Furniture sizes in metres, shared by the bpy builders (furniture/) and layout_check.py.

Pure Python. Sizes are (w along X, d along Y, h); at rot 0 a piece's front faces -Y and its back faces +Y.
Villa v2 spec §5.1 adds the pieces below the v1 ones; the resort deco adds the tropical ones, the interactive house
(interaction spec §3.1) the wall switch, the garden (villa v2 part 2) the beds, pots, vegetable garden and barbecue
pieces, the koi pond (part 3) the tea corner, lotus, koi and rockery pieces, the carport (part 4) the cars and the
dog's corner, the tall house the spiral stair, the crystal chandelier, the roof's stair pavilion and the air
conditioning, the basement (villa v2 spec §12 "Basement") its rooms' pieces and its light well's, and the decor pass
(§12 "Curtains and accessories") the curtains as tall as their room, the roller blind and the accessories at the end.
"""
FURNITURE = {
    "sofa_l": (2.8, 2.2, 0.85),
    "coffee_table": (1.2, 0.7, 0.4),
    "tv_unit": (2.4, 0.45, 1.8),
    "rug": (3.2, 2.4, 0.01),
    "dining_set": (2.2, 2.1, 0.9),
    "kitchen_counter": (5.0, 0.6, 2.2),
    "kitchen_island": (2.4, 1.7, 0.9),
    "bed_double": (1.8, 2.2, 1.1),
    "bed_single": (1.0, 2.1, 0.9),
    "nightstand": (0.5, 0.4, 0.5),
    "wardrobe": (2.0, 0.6, 2.3),
    "desk": (1.4, 1.1, 0.85),
    "armchair": (0.8, 0.8, 0.8),
    "console": (1.2, 0.35, 0.8),
    "lounger": (0.7, 1.9, 0.75),
    "side_table": (0.5, 0.5, 0.45),
    "outdoor_sofa": (2.4, 0.9, 0.75),
    "bistro_set": (1.4, 1.0, 0.85),
    # villa v2: living, dining, kitchen, entry and decor
    "tv_wall": (3.2, 0.5, 2.0),
    "bookshelf_wall": (2.4, 0.4, 2.4),
    "floor_lamp": (0.45, 0.45, 1.7),
    "plant_tall": (0.6, 0.6, 1.8),
    "plant_small": (0.4, 0.4, 0.8),
    "painting_l": (1.6, 0.05, 1.0),
    "painting_m": (0.9, 0.05, 0.7),
    # the decor pass (villa v2 spec §12 "Curtains and accessories"): a curtain run, its track as wide as the glazing (the
    # builder's `width`) and as high over the floor as the room is tall (`drop`), the sizes here its defaults
    "curtain": (2.4, 0.22, 3.0),
    "dining_set_8": (2.8, 2.1, 0.9),
    "sideboard": (2.0, 0.5, 0.85),
    "kitchen_run": (5.6, 0.65, 2.4),
    "fridge_tower": (1.8, 0.65, 2.3),
    "kitchen_island_4": (2.8, 1.7, 0.95),
    "bar_cabinet": (2.0, 0.6, 2.2),
    "shoe_cabinet": (1.4, 0.4, 1.0),
    "bench_mirror": (1.2, 0.45, 2.0),
    # villa v2: bedroom, closet, office, bath, laundry and outdoor
    "bed_king": (2.0, 2.3, 1.15),
    "nightstand_lamp": (0.5, 0.4, 0.95),
    "dresser_mirror": (1.2, 0.9, 1.6),
    "tv_cabinet": (1.6, 0.45, 1.5),
    "closet_rack": (2.0, 0.6, 2.3),
    "gaming_desk": (2.2, 1.6, 1.35),
    "gaming_chair": (0.7, 0.7, 1.3),
    "wall_shelf": (1.2, 0.25, 0.3),
    "bookshelf": (0.9, 0.35, 1.9),
    "toilet": (0.4, 0.7, 0.8),
    "vanity_single": (0.9, 0.5, 1.9),
    "vanity_double": (1.6, 0.55, 1.9),
    "bathtub": (1.7, 0.8, 0.6),
    "shower": (1.0, 1.0, 2.1),
    "towel_rack": (0.6, 0.12, 1.2),
    "washer_dryer": (1.3, 0.65, 0.9),
    "laundry_shelf": (1.3, 0.3, 0.4),
    "towel_stand": (0.6, 0.4, 1.1),
    "outdoor_armchair": (0.8, 0.8, 0.75),
    "garden_lamp": (0.3, 0.3, 0.9),
    # resort deco: tropical plants, rattan, teak and linen
    "palm_tall": (1.6, 1.6, 3.0),
    "palm_small": (0.8, 0.8, 1.6),
    "monstera": (1.0, 1.0, 1.2),
    "bird_of_paradise": (0.9, 0.9, 1.8),
    "fern_hanging": (0.6, 0.6, 0.7),
    "plant_wall": (2.4, 0.2, 2.4),
    "rattan_pendant": (0.6, 0.6, 0.7),
    "rattan_armchair": (0.85, 0.85, 0.8),
    "egg_chair": (1.1, 1.1, 2.0),
    "daybed_cabana": (2.4, 2.0, 2.5),
    "teak_lounger": (0.75, 2.0, 0.45),
    "lantern": (0.35, 0.35, 0.6),
    "outdoor_bar": (2.4, 1.3, 1.1),
    # interactive house: the wall switch of a room's lights (houses/interact.py), the click target that stays in reach
    # while the dollhouse cut hides the ceiling and what hangs from it
    "light_switch": (0.09, 0.02, 0.12),
    # garden (villa v2 part 2): flower beds, pots and clipped shrubs; the vegetable garden; the barbecue terrace; the
    # lantern on a gate pillar. The garden modules merge them into a few objects (furniture.place_into).
    "flower_bed": (2.0, 0.9, 0.6),
    "flower_pot": (0.6, 0.6, 0.9),
    "topiary_ball": (0.8, 0.8, 1.2),
    "topiary_cone": (0.7, 0.7, 1.7),
    "raised_bed": (2.4, 1.2, 0.85),
    "tomato_trellis": (2.4, 0.6, 1.7),
    "wheelbarrow": (0.7, 1.4, 0.7),
    "watering_can": (0.5, 0.2, 0.35),
    "compost_bin": (1.0, 1.0, 0.9),
    "tool_shed": (1.8, 1.2, 2.3),
    "bbq_grill": (1.3, 0.65, 1.15),
    "bbq_coals": (0.72, 0.44, 0.02),  # the glowing bed of coals in a grill's firebox, GRILL_COALS_Z above its feet
    "outdoor_kitchen": (2.6, 0.7, 0.95),
    "dining_set_6": (2.9, 1.9, 0.95),
    "parasol": (2.6, 2.6, 2.5),
    "pillar_lamp": (0.3, 0.3, 0.45),
    # koi pond and tea corner (villa v2 part 3): the round stone tea table, its drum stools and the tea set on it,
    # bonsai and the stone lantern of the tea corner; the lotus pads and flowers, the koi and the rock peaks of the
    # rockery in the pond. The pond modules merge them into a few objects like the garden does.
    "stone_table_round": (1.0, 1.0, 0.72),
    "stone_stool": (0.4, 0.4, 0.45),
    "tea_set": (0.42, 0.3, 0.16),
    "bonsai": (1.0, 0.9, 1.45),
    "stone_lantern": (0.5, 0.5, 1.2),
    "lotus_pad": (0.7, 0.7, 0.03),
    "lotus_flower": (0.32, 0.32, 0.5),
    "koi": (0.18, 0.48, 0.12),  # nose to the front (-Y), the tail fin fanned out flat behind it
    "rock_peak": (1.6, 1.4, 2.2),
    # carport (villa v2 part 4): a double-cab pickup and a convertible supercar, generic designs with no badges, nose
    # to the front (-Y); the mirrors reach the width. The carport builds each car's body and its lights apart (part=).
    "pickup_truck": (1.9, 5.3, 1.85),
    "convertible_supercar": (2.0, 4.5, 1.15),
    # the dog's corner (part 4): the Akita sitting up, nose to the front, built whole or as its body, head or tail
    # (part=); its dog house, mat, bowls (water or food) and ball; a small bush
    "akita": (0.48, 0.8, 0.95),
    "dog_house": (1.1, 1.0, 1.1),
    "dog_mat": (1.1, 0.8, 0.03),
    "dog_bowl": (0.26, 0.26, 0.09),
    "dog_ball": (0.12, 0.12, 0.12),
    "bush": (0.8, 0.8, 0.7),
    # the tall house: the open spiral stair of the double-height living room, from its floor to the gallery's
    # (SPIRAL_STAIR: the storey's rise and the handrail over the top tread make its height), and the tiered crystal ring
    # chandelier that hangs in the void over it (CHANDELIER_RINGS), its lowest crystal tip to its crown, as wide as the
    # strands of crystal round its lowest ring
    "spiral_stair": (2.4, 2.4, 5.76),
    "crystal_chandelier": (2.4, 2.4, 2.2),
    # ... the pavilion the stair comes out of on the roof (its slab roof, which overhangs its walls: STAIR_PAVILION),
    # and the bedrooms' air conditioning: the split unit on the wall, its wall remote, the outdoor condenser and the
    # teak screen the condensers stand behind on the roof
    "stair_pavilion": (2.8, 2.8, 2.4),
    "ac_split": (0.9, 0.22, 0.3),
    "ac_remote": (0.08, 0.02, 0.12),
    "ac_condenser": (0.8, 0.3, 0.6),
    "teak_screen": (2.6, 0.06, 0.9),
    # the basement (villa v2 spec §12 "Basement"), merged per material into a few objects like the garden's pieces:
    # the wine cellar's wall racks of bottles (their ends rows of glass on the rack's front), a barrel lying on its
    # cradle along Y and the high tasting table with a bar stool at either end; the karaoke lounge's U-shaped velvet
    # sofa round its coffee table (open to the front), the big TV on its low unit, a tower speaker, a stand with two
    # microphones and the disco ball, hung from the ceiling; the spa's sauna cabin (walls and a glass door, two tiers
    # of benches, the stove whose stones glow: part=), a massage bed, the small stone-edged hot tub (its water is the
    # module's), a wall shelf of oils and a tray of candles; the gym's treadmill, squat rack with its bar and bench, a
    # dumbbell rack, a wall mirror and a yoga mat; the light well's palm, tall enough to show over the lawn, and the
    # ground uplights that wash its walls
    "wine_rack": (2.0, 0.4, 2.2),
    "wine_barrel": (0.75, 1.0, 0.85),
    "tasting_table": (1.6, 1.4, 1.05),
    "karaoke_sofa": (3.6, 2.8, 0.8),
    "karaoke_tv": (2.4, 0.45, 1.5),
    "tower_speaker": (0.35, 0.4, 1.15),
    "mic_stand": (0.5, 0.5, 1.5),
    "disco_ball": (0.45, 0.45, 0.45),
    "sauna_cabin": (2.4, 2.0, 2.2),
    "massage_bed": (0.75, 2.0, 0.75),
    "hot_tub_small": (2.2, 2.2, 0.7),
    "oil_shelf": (1.2, 0.25, 0.45),
    "candle_set": (0.35, 0.25, 0.22),
    "treadmill": (0.85, 2.0, 1.4),
    "weight_rack": (1.6, 2.2, 2.1),
    "dumbbell_rack": (1.4, 0.5, 0.85),
    "mirror_wall": (3.0, 0.03, 2.0),
    "yoga_mat": (0.65, 1.8, 0.01),
    "palm_courtyard": (2.6, 2.6, 5.5),
    "uplight": (0.14, 0.14, 0.12),
    # the decor pass (villa v2 spec §12 "Curtains and accessories"), built into the interior module: the roller blind of a
    # ribbon window (its `width` and `drop` the window's, like a curtain's); the accessories (furniture/interior.py):
    # throw cushions leaning on a sofa's or a bed's back (three, or a pair), a folded throw, the coffee table's tray of
    # candles with a bowl and books, a stack of books, a vase of leafy branches, a stone bowl, a terracotta floor vase
    # of dried pampas, a travertine drum side table, a fiddle-leaf fig, a small potted plant, a framed abstract print,
    # a round mirror in a teak ring, a towel bar, a teak and cane buffet, a slim console, a bench with a linen pad, a
    # table lamp whose shade glows, the dining table laid for eight round a linen runner, a fruit bowl, the kitchen
    # counter's board, crock, kettle and jars, herbs in pots, a stool's pad, a toiletries tray, a bath mat, an umbrella
    # stand, jute rugs (a runner, and a large one for under a dining table); and the basement's accents: the cellar's decanter and glasses on a tray, the spa's
    # rolled towels, the gym's towel and bottles
    "roller_blind": (1.2, 0.08, 1.0),
    "cushions": (1.2, 0.3, 0.45),
    "cushion_pair": (0.8, 0.28, 0.4),
    "throw": (0.9, 0.5, 0.08),
    "coffee_decor": (0.9, 0.5, 0.22),
    "book_stack": (0.3, 0.22, 0.16),
    "vase_branches": (0.3, 0.3, 0.7),
    "bowl": (0.3, 0.3, 0.09),
    "floor_vase": (0.45, 0.45, 1.5),
    "drum_table": (0.5, 0.5, 0.5),
    "fiddle_leaf": (0.9, 0.9, 2.1),
    "plant_pot": (0.3, 0.3, 0.45),
    "art_print": (0.9, 0.04, 1.2),
    "mirror_round": (0.9, 0.04, 0.9),
    "towel_bar": (0.6, 0.1, 0.5),
    "buffet": (2.0, 0.45, 0.8),
    "console_slim": (1.4, 0.35, 0.8),
    "bench": (1.4, 0.4, 0.46),
    "table_lamp": (0.35, 0.35, 0.62),
    "table_setting": (2.6, 0.95, 0.3),
    "fruit_bowl": (0.4, 0.4, 0.16),
    "counter_set": (0.9, 0.35, 0.45),
    "herb_pots": (0.6, 0.18, 0.3),
    "seat_pad": (0.36, 0.36, 0.05),
    "toiletry_tray": (0.35, 0.15, 0.2),
    "bath_mat": (0.8, 0.5, 0.01),
    "umbrella_stand": (0.3, 0.3, 0.75),
    "rug_jute": (2.4, 1.6, 0.01),
    "runner_rug": (3.0, 0.8, 0.01),
    "rug_large": (3.6, 2.8, 0.01),
    "wine_set": (0.45, 0.3, 0.32),
    "spa_towels": (0.45, 0.3, 0.18),
    "gym_kit": (0.4, 0.25, 0.25),
}
# The height of a bbq_grill's firebox top, where its bbq_coals lie: the garden builds the coals into an object of their
# own, a night light, so the grill itself is a still object that casts its shadow by day.
GRILL_COALS_Z = 0.86

# The rock peaks of a rockery by variant (archkit.furniture.pond.rock_peak), from the tallest down: share of the catalog
# height, base radii as shares of the footprint's half sizes, how far the top leans off the base (shares of the half
# sizes), the seed of its facets. The pond's layout check reads the base radii.
ROCK_PEAKS = (
    (1.0, 0.82, 0.8, (0.12, -0.08), 71),
    (0.74, 0.7, 0.72, (-0.1, 0.06), 72),
    (0.52, 0.62, 0.62, (0.08, 0.1), 73),
    (0.36, 0.54, 0.52, (-0.06, -0.1), 74),
)
# How far the rings of a rock peak stray in or out of their ellipse, at most (archkit.furniture.pond.rock_peak). Its
# foot is the widest of them, so the pond's layout check takes 1 + this times the larger base radius as a peak's reach.
ROCK_PEAK_JITTER = 0.22
# The lotus pads by variant (archkit.furniture.pond.lotus_pad): radius, palette green and the direction of the notch
# (radians from +X). The pond's layout check reads the radii.
LOTUS_PADS = ((0.33, "lotus_pad", 0.0), (0.27, "leaf", 2.3), (0.21, "lotus_pad", 4.2), (0.3, "leaf", 0.9))

# Where the Akita's head turns (its neck) and its tail wags (its root), in the dog's own space
# (archkit.furniture.animals): the kennel builds them as objects of their own with their origins there.
AKITA_PIVOTS = {"head": (0.0, -0.1, 0.6), "tail": (0.0, 0.3, 0.37)}

# The spiral stair (archkit.spiral, furniture/stairs.py): the rise it climbs by default (a storey of the tall house,
# floor to floor: houses/house_parts/common.py checks it), its treads and turns (a turn and a quarter, 18 degrees and
# 19 cm a tread), the handrail's height over the treads and the radius of the steel column the treads hang from.
SPIRAL_STAIR = {"rise": 4.81, "treads": 25, "turns": 1.25, "rail": 0.95, "column": 0.08}
# The stair pavilion (furniture/stairs.py): its thin white slab roof covers the whole footprint and overhangs its walls
# by "overhang" on the front (-Y) and the right (+X) at rot 0, where it is glazed, while its solid white left and back
# walls stand flush with the slab's edges; the walls are "wall" thick. Its walls are a (w - overhang) x (d - overhang)
# box, off the piece's centre by half the overhang to the left and back: the roof's layout centres them on the stair.
STAIR_PAVILION = {"overhang": 0.2, "wall": 0.08}
# The brass rings of the crystal chandelier (furniture/lights.py) from the bottom up, 2.2, 1.6 and 1.0 m across: radius,
# height over the piece's bottom and the strands of crystal drops hanging round it (long and short in turn; the long
# strands of the lowest ring reach down to the piece's bottom). The house's layout checks read the lowest ring.
CHANDELIER_RINGS = ((1.1, 0.5, 40), (0.8, 1.05, 28), (0.5, 1.55, 20))
# The split air conditioner's louvre flap (furniture/climate.py): its hinge along the unit's bottom front, in the unit's
# own space, where the house builds it as an object of its own; and how far its act_ac_<room> clip turns it about X to
# open it (degrees: out and down).
AC_FLAP_PIVOT = (0.0, -0.1, 0.085)
AC_FLAP_OPEN = -60.0

# A curtain run (furniture/decor.py): its slim ceiling track "track" high under the drop, the fabric's hem "hem" over
# the floor; at each end of the run a gathered stack of soft waves, "folds" a metre across its top, the linen drape
# "stack" wide (the builder's default) tied back at "tie" over the floor, the sheer behind it "sheer" times as wide and
# hanging straight. The interior's layout check reads the stacks' widths: they stand on the floor at the glass.
CURTAIN = {"track": 0.035, "hem": 0.02, "tie": 1.05, "folds": 8, "stack": 0.5, "sheer": 1.3}
# The roller blind's cassette, on top of it; the blind rolls down `lowered` of the length under it.
BLIND_CASSETTE = 0.09

# Kinds whose object glows at night (screens, lamps, LED): place() sets night_light = True on them.
NIGHT_KINDS = frozenset({"tv_wall", "floor_lamp", "bar_cabinet", "nightstand_lamp", "tv_cabinet", "gaming_desk",
                         "gaming_chair", "garden_lamp", "rattan_pendant", "lantern", "bbq_coals", "pillar_lamp",
                         "stone_lantern", "crystal_chandelier", "ac_split", "karaoke_tv", "candle_set", "uplight",
                         "disco_ball", "table_lamp"})

# Kinds hung on a wall or from the ceiling, with the height of their bottom edge above the floor: place() adds it to the
# piece's z.
WALL_MOUNTED = {"painting_l": 1.2, "painting_m": 1.4, "wall_shelf": 1.5, "laundry_shelf": 1.4, "fern_hanging": 2.1,
                "rattan_pendant": 2.3, "light_switch": 1.15, "crystal_chandelier": 3.0, "ac_split": 2.4,
                "ac_remote": 1.15, "disco_ball": 2.1, "oil_shelf": 0.95, "mirror_wall": 0.25,
                "art_print": 1.1, "mirror_round": 1.2, "towel_bar": 0.85}

# Where things stand on a piece of furniture (the decor pass: the interior's accessories on the house's tables, beds,
# counters and on its own buffet and benches): per kind, its tops as (height over the piece's feet, (x0, y0, x1, y1) in
# its own space at rot 0), clear of what the piece itself carries there (a sink, a basin, a lamp, a TV, a back cushion).
# The interior's layout check keeps a piece put "on" a host inside one of the host's tops, and its build stands it there.
SURFACES = {
    "coffee_table": [(0.4, (-0.6, -0.35, 0.6, 0.35))],
    "sideboard": [(0.69, (-1.0, -0.25, 1.0, 0.25))],
    "dining_set_8": [(0.76, (-1.4, -0.5, 1.4, 0.5))],
    # the island's counter, and the seats of its four stools in front of it
    "kitchen_island_4": [(0.95, (-1.4, -0.15, 1.4, 0.85))] + [(0.66, (x - 0.18, -0.68, x + 0.18, -0.32))
                                                              for x in (-1.005, -0.335, 0.335, 1.005)],
    # the worktop either side of the sink, the cooktop and the coffee machine
    "kitchen_run": [(0.9, (x0, -0.325, x1, 0.325)) for x0, x1 in ((-2.8, -1.95), (-1.25, 0.18), (0.82, 2.03),
                                                                   (2.37, 2.8))],
    "console": [(0.8, (-0.6, -0.175, 0.6, 0.175))],
    "nightstand": [(0.5, (-0.25, -0.2, 0.25, 0.2))],
    "desk": [(0.76, (-0.7, -0.05, 0.7, 0.55))],
    "dresser_mirror": [(0.76, (-0.6, 0.0, 0.6, 0.39))],
    # the duvets, from the foot to the pillows
    "bed_king": [(0.58, (-0.97, -1.15, 0.97, 0.25))],
    "bed_double": [(0.56, (-0.87, -1.07, 0.87, 0.2))],
    "bed_single": [(0.56, (-0.47, -1.02, 0.47, 0.2))],
    # the L sofa's long seat in front of its back cushions, and its return
    "sofa_l": [(0.42, (-1.2, 0.15, 1.4, 0.76)), (0.42, (0.45, -1.1, 1.4, 0.15))],
    "vanity_single": [(0.84, (-0.45, -0.25, -0.18, 0.25)), (0.84, (0.18, -0.25, 0.45, 0.25))],
    "vanity_double": [(0.84, (x0, -0.275, x1, 0.275)) for x0, x1 in ((-0.8, -0.58), (-0.22, 0.22), (0.58, 0.8))],
    "buffet": [(0.8, (-1.0, -0.225, 1.0, 0.225))],
    "console_slim": [(0.8, (-0.7, -0.175, 0.7, 0.175))],
    "bench": [(0.46, (-0.68, -0.18, 0.68, 0.18))],
    "drum_table": [(0.5, (-0.22, -0.22, 0.22, 0.22))],
    # the basement's: the tasting table's granite, the karaoke sofa's coffee table and the seat of its back run, a
    # massage bed's padded top short of its rolled towel
    "tasting_table": [(1.05, (-0.55, -0.45, 0.55, 0.45))],
    "karaoke_sofa": [(0.38, (-0.6, -0.8, 0.6, -0.1)), (0.42, (-1.58, 0.57, 1.58, 1.2))],
    "massage_bed": [(0.68, (-0.355, -0.78, 0.355, 0.75))],
}

# The plants that sway outdoors (place(..., wind=True)) and the heights (z at weight 0, z at weight 1) their 'wind'
# colour attribute runs between: from the soil in the pot to the highest leaf tip; a hanging fern is still at its basket
# and sways most at its tips. place() and layout_check reject the option on any other kind.
WIND_SPANS = {
    "palm_tall": (0.47, FURNITURE["palm_tall"][2]),
    "palm_small": (0.32, FURNITURE["palm_small"][2]),
    "monstera": (0.34, FURNITURE["monstera"][2]),
    "bird_of_paradise": (0.32, FURNITURE["bird_of_paradise"][2]),
    "fern_hanging": (0.3, 0.0),
    # garden: from the top of the kerb, the pot's soil or the bed's frame up to the flower heads, crowns and stakes
    "flower_bed": (0.14, FURNITURE["flower_bed"][2]),
    "flower_pot": (0.45, FURNITURE["flower_pot"][2]),
    "topiary_ball": (0.4, FURNITURE["topiary_ball"][2]),
    "topiary_cone": (0.4, FURNITURE["topiary_cone"][2]),
    "raised_bed": (0.4, 0.65),  # lettuce grows lower than the carrot tops: every crop sways in full above 0.65 m
    "tomato_trellis": (0.35, FURNITURE["tomato_trellis"][2]),
    # pond (villa v2 part 3): a bonsai from the top of its pedestal (or above its pot) up to its crown; the lotus
    # floats, so its span starts below the water and reaches far above it: a pad drifts by a quarter of the sway, a
    # flower's head by less than half, a few centimetres
    "bonsai": (0.45, FURNITURE["bonsai"][2]),
    "lotus_pad": (-0.06, 0.2),
    "lotus_flower": (-0.1, 1.4),
    # the dog's corner (part 4): a bush still at its foot, swaying most at its top
    "bush": (0.1, FURNITURE["bush"][2]),
    # the basement's light well: its palm from above the planter it grows in
    "palm_courtyard": (0.5, FURNITURE["palm_courtyard"][2]),
}

# Pieces that lie flat under others; layout_check exempts them from the overlap test.
OVERLAYS = frozenset({"rug", "yoga_mat", "bath_mat", "rug_jute", "runner_rug", "rug_large"})

# What a wall fountain (archkit.water.wall_fountain) takes of the floor: its wall is FOUNTAIN_WALL thick, centred on the
# line from start to end, and its basin reaches FOUNTAIN_BASIN in front of the wall's face, lip included.
FOUNTAIN_WALL = 0.2
FOUNTAIN_BASIN = 0.5

ROTATIONS = (0, 90, 180, 270)


def footprint(kind, rot):
    """(x extent, y extent) of a piece after rotating it `rot` degrees about Z."""
    w, d, _ = FURNITURE[kind]
    return (d, w) if rot % 180 == 90 else (w, d)

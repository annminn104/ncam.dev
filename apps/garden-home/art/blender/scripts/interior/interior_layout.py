"""The decor pass (villa v2 spec §12 "Rèm và phụ kiện") as plain data: the curtains along the house's glazing and the
accessories that furnish its rooms. Pure Python: build_interior.py turns it into geometry, layout_check.py sanity-checks
it.

A module of its own, so the house keeps its triangle budget (46k of its 50k), standing in the house's slot like the
basement: module space is the house's (houses/house_parts/common.py: origin at the footprint's centre on the ground,
front to -Y), its rooms are the house's (houses.house_layout.ROOMS) and its pieces stand on the house's floors, against
its walls or on its furniture. Everything is merged into a handful of objects (OBJECTS, one draw call per material): the
static decor, and per lit room the shades of its table lamps, which glow with the room's light group (interact.py).

CURTAINS are runs along a glazing of the house (shell.CURTAIN_WALLS, by name) over `span` (the run's ends along the
glass's line), as tall as the room under its ceiling (drop()), their gathered stacks `stack` wide at both ends; BLINDS
hang in the ribbon windows (shell.WINDOWS), lowered a share of their length. FURNITURE entries are the house's (kind,
object name, room, (x, y), rotation[, builder options]); the option "on" names the piece (the house's or this layout's)
it stands on, whose catalog.SURFACES top holds it (stand()), and "into" the object it is merged into (into(): DETAILS
for the small kinds, DECOR for the rest, when none).
"""
from archkit.catalog import BLIND_CASSETTE, CURTAIN, FURNITURE, WALL_MOUNTED, footprint
from houses import house_layout as H
from houses import layout_check as house_check
from houses.house_parts.common import LEFT, STONE_LEFT, WALL, ceiling_over

MODULE_ID = "interior"
ROLE = "prop"
FOOTPRINT = H.FOOTPRINT
ROOMS = H.ROOMS
FLOOR_Z = H.FLOOR_Z
ROOM_LABELS = H.ROOM_LABELS
LEVELS = {room["name"]: room["level"] for room in ROOMS}

# The objects the build makes: the static decor, the curtains and every accessory that shows through the glass from afar
# merged (the lamps' bases with them: their shades glow in objects of their own, drawn whenever the house is, and must
# never float over a bare top); the details, the small things (cushions, books, vases, the table laid, toiletries, the
# counter's things, the prints, the umbrella stand, the drum tables), which from afar are a pixel or two and most of the
# triangles, so the website draws them only while the camera is near the house, close enough to make them out
# (cutaway.ts), and never on the wallpaper; and per lit room the glowing shades of its table lamps (a night light of the
# room's light:<room> group).
DECOR = "Interior_decor"
DETAILS = "Interior_details"
DETAIL_KINDS = frozenset({"cushions", "cushion_pair", "throw", "coffee_decor", "book_stack", "vase_branches", "bowl",
                          "plant_pot", "towel_bar", "table_setting", "fruit_bowl", "counter_set", "herb_pots", "seat_pad",
                          "toiletry_tray", "bath_mat", "art_print", "umbrella_stand", "drum_table"})
LAMP_ROOMS = ("dining", "bedroom2", "bedroom3")
LAMPS = {room: f"LT_lamp_{room}" for room in LAMP_ROOMS}
OBJECTS = {DECOR: {}, DETAILS: {"detail": True}, **{name: {"night": True, "room": room} for room, name in LAMPS.items()}}

# How a curtain stands at its glass: its back this far off the glazing's line (clear of the mullions, 3 cm each side of
# it), and never closer than CURTAIN_WALL to the wall face of its room; its track this far under the ceiling.
CURTAIN_OFF = 0.05
CURTAIN_WALL = 0.02
CURTAIN_TOP = 0.01
CURTAIN_DEPTH = FURNITURE["curtain"][1]


def drop(room, point):
    """The height of a curtain's track over the floor of `room` at the (x, y) point: up to CURTAIN_TOP under its
    ceiling (the void's, the upper floor's ceiling, over the double-height living room: common.ceiling_over)."""
    return round(ceiling_over(LEVELS[room], point) - FLOOR_Z[room] - CURTAIN_TOP, 3)


# The glazings the curtains hang at: the double-height living room's front and west glass (its sheers run the full
# height, gathered at both ends, clear of the stair's foot), the dining room's glass front, each bedroom's glass (the
# master's onto the balcony, bedroom 3's west window, whose run reaches a little past the glass onto the wall either
# side). The living room's west run starts behind the front run's stack in the corner.
_VOID_STACK = 0.9
CURTAINS = [
    {"name": "Curtain_living_front", "room": "living", "glass": "living_front", "span": (LEFT + WALL, -3.46),
     "stack": _VOID_STACK},
    {"name": "Curtain_living_west", "room": "living", "glass": "living_west", "span": (-5.2, 0.25),
     "stack": _VOID_STACK},
    {"name": "Curtain_dining", "room": "dining", "glass": "ground_front", "span": (-3.4, STONE_LEFT), "stack": 0.6},
    {"name": "Curtain_bedroom2", "room": "bedroom2", "glass": "upper_front_bed2", "span": (-3.34, 2.44),
     "stack": CURTAIN["stack"]},
    {"name": "Curtain_master", "room": "master", "glass": "upper_front_master", "span": (2.56, 8.3),
     "stack": CURTAIN["stack"]},
    {"name": "Curtain_bedroom3", "room": "bedroom3", "glass": "upper_west_bed3", "span": (3.55, 6.85),
     "stack": CURTAIN["stack"]},
]
# The ribbon windows over the kitchen run and the gaming desk: a roller blind each, rolled down a third.
BLINDS = [
    {"name": "Blind_kitchen", "room": "kitchen", "window": "kitchen", "lowered": 0.3},
    {"name": "Blind_gaming", "room": "gaming", "window": "gaming", "lowered": 0.3},
]
BLIND_OVER = 0.05  # a blind is this much wider than its window either side
BLIND_DEPTH = FURNITURE["roller_blind"][1]


def _on(host, **opts):
    """Builder options of a piece that stands on `host` (a FURNITURE object name of the house or of this layout)."""
    return {"on": host, **opts}


FURNITURE = [
    # living: cushions and a throw on the L sofa, the coffee table's tray, two rattan armchairs facing the sofa across the
    # rug with a travertine drum table between them, a floor vase of pampas by the TV's bird of paradise, a fiddle-leaf
    # fig at the stair's foot, a teak and cane buffet on the back wall under a round mirror, a drum table between the
    # reading corner's armchairs
    ("cushions", "Cushions_sofa", "living", (-9.91, -2.3), 90, _on("Sofa")),
    ("cushion_pair", "Cushions_sofa_corner", "living", (-9.92, -1.15), 90, _on("Sofa")),
    ("throw", "Throw_sofa", "living", (-8.85, -1.075), 90, _on("Sofa")),
    ("coffee_decor", "Coffee_decor", "living", (-7.4, -2.0), 90, _on("Coffee_table")),
    ("rattan_armchair", "Armchair_living_3", "living", (-8.2, -4.15), 180),
    ("rattan_armchair", "Armchair_living_4", "living", (-6.6, -4.15), 180),
    ("drum_table", "Drum_table_living", "living", (-7.4, -4.4), 0),
    ("plant_pot", "Plant_drum_living", "living", (-7.4, -4.4), 0, _on("Drum_table_living")),
    ("floor_vase", "Floor_vase_living", "living", (-3.95, 1.2), 0),
    ("fiddle_leaf", "Fig_living", "living", (-8.3, 3.3), 0),
    ("buffet", "Buffet_living", "living", (-9.6, 7.075), 0),
    ("vase_branches", "Vase_buffet_living", "living", (-10.25, 7.1), 0, _on("Buffet_living")),
    ("bowl", "Bowl_buffet_living", "living", (-9.6, 7.05), 0, _on("Buffet_living")),
    ("book_stack", "Books_buffet_living", "living", (-8.95, 7.06), 0, _on("Buffet_living")),
    ("mirror_round", "Mirror_living", "living", (-9.6, 7.28), 0),
    ("drum_table", "Drum_table_reading", "living", (-6.4, 5.0), 0),
    ("book_stack", "Books_reading", "living", (-6.4, 5.0), 0, _on("Drum_table_reading")),
    # dining: a large jute rug under the table laid for eight, two table lamps and a bowl on the sideboard, a fiddle-leaf
    # fig in the corner by the glass
    ("rug_large", "Rug_dining", "dining", (1.0, -2.6), 0),
    ("table_setting", "Table_setting", "dining", (1.0, -2.6), 0, _on("Dining")),
    ("table_lamp", "Lamp_sideboard_1", "dining", (5.19, -2.35), 0, _on("Sideboard")),
    ("table_lamp", "Lamp_sideboard_2", "dining", (5.19, -0.75), 0, _on("Sideboard")),
    ("bowl", "Bowl_sideboard", "dining", (5.19, -1.55), 0, _on("Sideboard")),
    ("fiddle_leaf", "Fig_dining", "dining", (5.0, -4.6), 0),
    # kitchen: a fruit bowl on the island, linen pads on its four stools, the counter's board, crock, kettle and jars,
    # herbs and a potted plant on the worktop
    ("fruit_bowl", "Fruit_bowl", "kitchen", (1.6, 4.25), 0, _on("Kitchen_island")),
    *[("seat_pad", f"Seat_pad_{k + 1}", "kitchen", (round(1.0 + x, 3), 3.3), 0, _on("Kitchen_island"))
      for k, x in enumerate((-1.005, -0.335, 0.335, 1.005))],
    ("counter_set", "Counter_set", "kitchen", (0.45, 7.12), 0, _on("Kitchen_run")),
    ("herb_pots", "Herb_pots", "kitchen", (2.4, 7.18), 0, _on("Kitchen_run")),
    ("plant_pot", "Plant_counter", "kitchen", (-1.4, 7.1), 0, _on("Kitchen_run")),
    # hall and foyer: a runner down the hall; a vase and a bowl on the foyer's console under a round mirror, an umbrella
    # stand by the door, a jute rug
    ("runner_rug", "Runner_hall", "hall", (7.25, 3.0), 90),
    ("vase_branches", "Vase_console_foyer", "foyer", (9.8, -0.735), 0, _on("Console_foyer")),
    ("bowl", "Bowl_console_foyer", "foyer", (10.4, -0.735), 0, _on("Console_foyer")),
    ("mirror_round", "Mirror_foyer", "foyer", (10.15, -0.58), 0),
    ("umbrella_stand", "Umbrella_stand", "foyer", (9.2, -5.2), 0),
    ("rug_jute", "Rug_foyer", "foyer", (8.2, -3.0), 0),
    # the guest WC: a toiletries tray on the vanity, a plant
    ("toiletry_tray", "Toiletries_wc", "wc", (10.715, -0.19), 90, _on("Vanity_wc")),
    ("plant_pot", "Plant_wc", "wc", (9.35, 1.7), 0),
    # gallery: a slim console with a vase and books under the painting, a bench with cushions under a print between the
    # two back doors, a runner along it; a fiddle-leaf fig in the gaming corner
    ("console_slim", "Console_gallery", "gallery", (-7.65, 2.865), 0),
    ("vase_branches", "Vase_console_gallery", "gallery", (-8.1, 2.865), 0, _on("Console_gallery")),
    ("book_stack", "Books_console_gallery", "gallery", (-7.2, 2.88), 0, _on("Console_gallery")),
    ("bench", "Bench_gallery", "gallery", (-4.7, 2.84), 0),
    ("cushion_pair", "Cushions_bench_gallery", "gallery", (-4.85, 2.88), 0, _on("Bench_gallery")),
    ("art_print", "Print_gallery", "gallery", (-4.7, 3.02), 0, {"variant": 0}),
    ("runner_rug", "Runner_gallery", "gallery", (-6.0, 2.25), 0),
    ("fiddle_leaf", "Fig_gaming", "gaming", (1.99, 6.85), 0),
    # master: cushions on the bed, a bench at its foot, a vase and books on the dresser, a drum table and books by the
    # armchair at the glass
    ("cushions", "Cushions_master", "master", (7.25, -2.0), 270, _on("Bed_master")),
    ("bench", "Bench_master", "master", (5.75, -2.0), 90),
    ("vase_branches", "Vase_dresser_master", "master", (5.25, 1.2), 0, _on("Dresser_master")),
    ("book_stack", "Books_dresser_master", "master", (5.95, 1.2), 0, _on("Dresser_master")),
    ("drum_table", "Drum_table_master", "master", (2.85, -4.0), 0),
    ("book_stack", "Books_master", "master", (2.85, -4.0), 0, _on("Drum_table_master")),
    # master bath: toiletries between the basins, a bath mat by the tub, a towel bar by the vanity, a plant
    ("toiletry_tray", "Toiletries_master", "bath_master", (5.9, 7.15), 0, _on("Vanity_master")),
    ("bath_mat", "Bath_mat_master", "bath_master", (7.05, 4.4), 90),
    ("towel_bar", "Towel_bar_master", "bath_master", (4.81, 6.3), 90),
    ("plant_pot", "Plant_bath_master", "bath_master", (8.05, 1.8), 0),
    # bedroom 2: a bedside lamp, cushions and a throw on the bed and a bench at its foot; the desk nook by the glass
    # (lamp, books, plant, a print over it); a low buffet as a dresser on the west wall under a round mirror
    ("table_lamp", "Lamp_nightstand_room2", "bedroom2", (-0.85, 1.24), 0, _on("Nightstand_room2")),
    ("cushions", "Cushions_room2", "bedroom2", (0.4, 0.38), 0, _on("Bed_room2")),
    ("throw", "Throw_room2", "bedroom2", (0.4, -0.45), 0, _on("Bed_room2")),
    ("bench", "Bench_room2", "bedroom2", (0.4, -1.05), 0),
    ("table_lamp", "Lamp_desk_room2", "bedroom2", (-3.1, -3.85), 0, _on("Desk_room2")),
    ("book_stack", "Books_desk_room2", "bedroom2", (-3.12, -4.3), 90, _on("Desk_room2")),
    ("plant_pot", "Plant_desk_room2", "bedroom2", (-3.12, -4.75), 0, _on("Desk_room2")),
    ("art_print", "Print_room2", "bedroom2", (-3.32, -4.3), 90, {"variant": 1}),
    ("buffet", "Dresser_room2", "bedroom2", (-3.115, -2.2), 90),
    ("vase_branches", "Vase_dresser_room2", "bedroom2", (-3.1, -2.85), 0, _on("Dresser_room2")),
    ("book_stack", "Books_dresser_room2", "bedroom2", (-3.1, -1.6), 90, _on("Dresser_room2")),
    ("mirror_round", "Mirror_room2", "bedroom2", (-3.32, -2.2), 90),
    # bedroom 3: a bedside lamp, cushions and a throw on the bed, books and a plant on the desk by the window, a rattan
    # armchair by the bookshelf
    ("table_lamp", "Lamp_nightstand_room3", "bedroom3", (-8.0, 7.1), 0, _on("Nightstand_room3")),
    ("cushion_pair", "Cushions_room3", "bedroom3", (-9.0, 6.3), 0, _on("Bed_room3")),
    ("throw", "Throw_room3", "bedroom3", (-9.0, 5.6), 0, _on("Bed_room3")),
    ("book_stack", "Books_desk_room3", "bedroom3", (-11.05, 4.6), 90, _on("Desk_room3")),
    ("plant_pot", "Plant_desk_room3", "bedroom3", (-11.0, 5.4), 0, _on("Desk_room3")),
    ("rattan_armchair", "Armchair_room3", "bedroom3", (-6.6, 6.5), 0),
    # shared bath: toiletries on the vanity, a bath mat by the shower, a towel bar, a plant
    ("toiletry_tray", "Toiletries_shared", "bath_shared", (-3.485, 7.05), 90, _on("Vanity_shared")),
    ("bath_mat", "Bath_mat_shared", "bath_shared", (-2.36, 5.95), 0),
    ("towel_bar", "Towel_bar_shared", "bath_shared", (-4.69, 6.3), 90),
    ("plant_pot", "Plant_bath_shared", "bath_shared", (-4.55, 6.95), 0),
]


def _entries(furniture=None):
    """Every FURNITURE entry of the house and of the interior (this layout's, or `furniture`) by object name."""
    return {entry[1]: entry for entry in list(H.FURNITURE) + list(FURNITURE if furniture is None else furniture)}


def options(entry):
    return dict(entry[5]) if len(entry) > 5 else {}


def into(entry):
    """The object a FURNITURE entry is merged into: its "into" option, else DETAILS for the small kinds, DECOR for the
    rest (a table lamp's shade goes into its room's LAMPS object, which glows from afar too, its base in the decor so the shade never floats)."""
    return options(entry).get("into", DETAILS if entry[0] in DETAIL_KINDS else DECOR)


def rect(entry):
    """(x0, y0, x1, y1) a FURNITURE entry covers on its floor (catalog footprint at its rotation)."""
    kind, _name, _room, (x, y), rot = entry[:5]
    w, d = footprint(kind, rot)
    return (x - w / 2, y - d / 2, x + w / 2, y + d / 2)


def surfaces(host):
    """The tops of the FURNITURE entry `host` in module space: (height over its room's floor, (x0, y0, x1, y1))."""
    return house_check.host_tops(host)


def host_of(entry, furniture=None):
    """The FURNITURE entry (the house's or the interior's: this layout's, or `furniture`) the piece stands on, None for
    a floor or wall piece."""
    name = options(entry).get("on")
    return None if name is None else _entries(furniture).get(name)


def top_under(entry, furniture=None):
    """The height over its room's floor of the host's top that holds the piece (its rectangle inside that top's), None
    when no top does (layout_check reports it)."""
    return house_check.top_under(entry, _entries(furniture))


def stand(entry, furniture=None):
    """Where the build stands a FURNITURE entry: (x, y, z) in module space, z its room's floor, or the top of its host
    (on its own feet: a wall piece hangs WALL_MOUNTED over it, furniture.place_into adds that)."""
    _kind, _name, room, (x, y), _rot = entry[:5]
    host = host_of(entry, furniture)
    z = FLOOR_Z[room]
    if host is not None:
        z = FLOOR_Z[host[2]] + (top_under(entry, furniture) or 0.0)
    return (x, y, round(z, 4))


_GLASS = {glass["name"]: glass for glass in H.CURTAIN_WALLS}
_WINDOWS = {window["name"]: window for window in H.WINDOWS}
_ROOM_RECTS = {room["name"]: (*room["min"], *room["max"]) for room in ROOMS}


def _along(start, end):
    """(axis, line): a glazing from start to end runs along X (axis 0) at y = line, or along Y (axis 1) at x = line."""
    (x0, y0), (x1, y1) = start, end
    return (0, y0) if abs(y1 - y0) < 1e-9 else (1, x0)


def curtain_at(curtain):
    """Where a curtain run stands: {"pos": (x, y, z), "rot", "width", "drop", "axis", "line", "back", "side"}: on its
    room's floor, its back CURTAIN_OFF off the glass's line (no nearer than CURTAIN_WALL to its room's wall), facing into
    the room (rot: its back, +Y at rot 0, towards the glass), its track at drop() over the stacks' middles."""
    glass = _GLASS[curtain["glass"]]
    axis, line = _along(glass["start"], glass["end"])
    rx0, ry0, rx1, ry1 = _ROOM_RECTS[curtain["room"]]
    low, high = (ry0, ry1) if axis == 0 else (rx0, rx1)
    side = 1 if (low + high) / 2 > line else -1  # which way the room lies from the glass
    back = max(line + CURTAIN_OFF, low + CURTAIN_WALL) if side > 0 else min(line - CURTAIN_OFF, high - CURTAIN_WALL)
    across = back + side * CURTAIN_DEPTH / 2
    a0, a1 = curtain["span"]
    middle = (a0 + a1) / 2
    inset = curtain["stack"] / 2
    ends = ((a0 + inset, across), (a1 - inset, across)) if axis == 0 else ((across, a0 + inset), (across, a1 - inset))
    room = curtain["room"]
    height = min(drop(room, point) for point in ends)
    pos = (middle, across) if axis == 0 else (across, middle)
    rot = {(0, 1): 180, (0, -1): 0, (1, 1): 90, (1, -1): 270}[(axis, side)]
    return {"pos": (round(pos[0], 4), round(pos[1], 4), FLOOR_Z[room]), "rot": rot, "width": round(a1 - a0, 4),
            "drop": height, "axis": axis, "line": line, "back": back, "side": side}


def stack_width(curtain):
    """How far along the glass each of a run's stacks reaches from its end: the sheer behind the linen, wider."""
    return curtain["stack"] * CURTAIN["sheer"]


def stacks(curtain):
    """The floor rectangles (x0, y0, x1, y1) of a run's two gathered stacks, at its ends."""
    at = curtain_at(curtain)
    a0, a1 = curtain["span"]
    reach = stack_width(curtain)
    across = sorted((at["back"], at["back"] + at["side"] * CURTAIN_DEPTH))
    found = []
    for s0, s1 in ((a0, a0 + reach), (a1 - reach, a1)):
        found.append((s0, across[0], s1, across[1]) if at["axis"] == 0 else (across[0], s0, across[1], s1))
    return found


def run_rect(curtain):
    """The floor rectangle of a whole run, its track's reach (x0, y0, x1, y1)."""
    at = curtain_at(curtain)
    a0, a1 = curtain["span"]
    across = sorted((at["back"], at["back"] + at["side"] * CURTAIN_DEPTH))
    return (a0, across[0], a1, across[1]) if at["axis"] == 0 else (across[0], a0, across[1], a1)


def blind_at(blind):
    """Where a roller blind hangs: {"pos": (x, y, z), "rot", "width", "drop", "lowered"}: in front of its window on the
    wall face of its room, its foot 2 cm under the sill, its cassette over the window's head."""
    window = _WINDOWS[blind["window"]]
    axis, line = _along(window["start"], window["end"])
    rx0, ry0, rx1, ry1 = _ROOM_RECTS[blind["room"]]
    low, high = (ry0, ry1) if axis == 0 else (rx0, rx1)
    side = 1 if (low + high) / 2 > line else -1
    face = low if side > 0 else high
    across = face + side * (0.005 + BLIND_DEPTH / 2)
    (sx, sy), (ex, ey) = window["start"], window["end"]
    a0, a1 = sorted((sx, ex) if axis == 0 else (sy, ey))
    foot = window["z0"] - 0.02
    pos = ((a0 + a1) / 2, across) if axis == 0 else (across, (a0 + a1) / 2)
    rot = {(0, 1): 180, (0, -1): 0, (1, 1): 90, (1, -1): 270}[(axis, side)]
    return {"pos": (round(pos[0], 4), round(pos[1], 4), round(foot, 4)), "rot": rot,
            "width": round(a1 - a0 + 2 * BLIND_OVER, 4), "drop": round(window["z1"] + BLIND_CASSETTE - foot, 4),
            "lowered": blind["lowered"]}


def wall_z(entry):
    """(bottom, top) of a wall piece over its room's floor."""
    kind = entry[0]
    return WALL_MOUNTED[kind], WALL_MOUNTED[kind] + FURNITURE[kind][2]

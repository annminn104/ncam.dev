"""The villa v2 shell (villa v2 spec §5, §5.1, §5.3; the tall house, §12): structure, glazing, interior partitions,
frosted bathroom panels, the main door and where the stair climbs through the upper floor, plus the LED strips and wall
lights fixed to it. Pure Python.
"""
from archkit.catalog import FURNITURE

from .common import (BACK, BASEMENT_CEIL, CEILING, DOOR_TOP, EDGE, FRONT, GROUND_CEIL, LEFT, LEVEL_Z, PLINTH, RIGHT,
                     ROOF_TOP, STONE_LEFT, TERRACE, UPPER_CEIL, UPPER_FLOOR, UPPER_RIGHT, VOID, WALL)

# The edges of the upper floor round the double-height living room's void: bedroom 2 east of it, the gallery behind it.
VOID_X1, VOID_Y1 = VOID[1]
# The upper box's cantilever over the terrace (the balcony) starts this far east of the void: from the front right
# (the wallpaper's side) the chandelier shows over its end.
BALCONY_X0 = -2.8

# The open spiral stair (catalog spiral_stair, placed in ground.py) stands in the void's back left corner, centred on the
# gallery's edge: its front half climbs in the void; the gallery's floor runs on over its back right quarter, the
# landing one steps onto off its top tread (towards +Y, archkit.spiral); the upper floor leaves a hole over its back left
# quarter, behind the column, from the west wall's inner face. Its upper flight climbs on from that landing round the
# same column to the roof (archkit.spiral.flights), through a hole in the roof slab over the whole of its square but
# the quarter one steps onto off its top tread (towards -Y, its front left), inside the stair pavilion (roof.py). The
# basement's flight (basement/basement_layout.py, villa v2 spec §12 "Tầng hầm") comes up the same column the same way:
# its top tread ends on the -X axis flush with the ground floor, so the ground slab (the plinth, grown down to the
# basement's ceiling) keeps that same quarter as the landing both flights leave from and is holed over the rest of the
# square, a balustrade on the hole's open sides (Columns): steel, but glass where the house's flight climbs over it.
STAIR = {"name": "Stair", "center": (-10.05, VOID_Y1)}
_STAIR_RADIUS = FURNITURE["spiral_stair"][0] / 2
_CX, _CY = STAIR["center"]
STAIR_HOLE = ((LEFT + WALL, _CY), (_CX, _CY + _STAIR_RADIUS))
_HOLE_BACK = STAIR_HOLE[1][1]
ROOF_LANDING = ((_CX - _STAIR_RADIUS, _CY - _STAIR_RADIUS), (_CX, _CY))
_SQ = (_CX - _STAIR_RADIUS, _CY - _STAIR_RADIUS, _CX + _STAIR_RADIUS, _CY + _STAIR_RADIUS)  # the stair's square


def _round_the_roof_hole(key, x0, y0, x1, y1, z0, z1):
    """Boxes over x0..x1, y0..y1 between z0 and z1 but for the stair's square, of which they keep ROOF_LANDING: the
    roof's and the ground slab's, whose landing is the same quarter."""
    sx0, sy0, sx1, sy1 = _SQ
    (lx0, ly0), (lx1, ly1) = ROOF_LANDING
    return [(key, (x0, y0, z0), (x1, sy0, z1)), (key, (x0, sy1, z0), (x1, y1, z1)),
            (key, (x0, sy0, z0), (sx0, sy1, z1)), (key, (sx1, sy0, z0), (x1, sy1, z1)),
            (key, (lx0, ly0, z0), (lx1, ly1, z1))]

DOOR = {"name": "Door_main", "x0": 7.0, "x1": 8.2, "y": FRONT, "z0": PLINTH, "z1": DOOR_TOP, "slide": 1.2}
HOTSPOTS = [
    {"name": "HS_door", "location": ((DOOR["x0"] + DOOR["x1"]) / 2, FRONT - 0.6, 1.6),
     "props": {"action": "toggle", "clip": "act_door_open", "label": "Cửa chính", "radius": 0.8}},
]

# Window openings for the frosted panels, (start, end) along the wall and (bottom, top): the WC in the stone wall at
# x = RIGHT, the master bath in the upper box's side at x = UPPER_RIGHT, which shows above the stone block's roof, and
# the shared bath in the back wall. Bedroom 3 has clear glass in the west wall, floor to ceiling like the front's.
WC_WINDOW = (0.2, 1.4, PLINTH + 1.3, PLINTH + 2.5)
BATH_MASTER_WINDOW = (3.6, 5.2, UPPER_FLOOR + 1.2, UPPER_FLOOR + 2.5)
BATH_SHARED_WINDOW = (-3.3, -2.0, UPPER_FLOOR + 1.2, UPPER_FLOOR + 2.5)
BED3_WINDOW = (3.7, 6.7)
# High ribbon windows of clear glass in the back wall, (x0, x1, z0, z1), so the back facade is not blank: over the
# kitchen run (2.4 m high) and over the gaming corner's desk and wall shelf.
KITCHEN_WINDOW = (-1.6, 3.6, PLINTH + 2.8, GROUND_CEIL - 0.52)
GAMING_WINDOW = (-1.45, 2.15, UPPER_FLOOR + 2.3, UPPER_FLOOR + 3.3)
WINDOW_FRAME = 0.05  # the black frame round a ribbon window, in the wall's opening (STRUCTURE's Facade_details)

COLUMNS_X = (-2.5, 1.75, 6.0)  # slim black columns under the cantilever, on the terrace (in the reflecting pool)
COLUMN_Y = FRONT - 0.8
LOUVER_Y = [round(FRONT + 0.15 + 0.3 * i, 2) for i in range(23)]  # wood fins on the master's x = UPPER_RIGHT face
FACADE = FRONT - 0.1  # outer face of the stone front wall
_LAMP = DOOR_TOP - 0.77  # bottom of the wall lights beside the door, 0.49 m under its head


def _balustrade(start, end, posts):
    """Frame boxes of a steel balustrade on the ground floor from start to end (x, y), straight along X or Y: `posts`
    posts, a handrail at a metre and a mid rail, BALUSTER wide."""
    (x0, y0), (x1, y1) = start, end
    b, floor = BALUSTER / 2, LEVEL_Z[0]
    boxes = []
    for k in range(posts):
        x, y = x0 + (x1 - x0) * k / (posts - 1), y0 + (y1 - y0) * k / (posts - 1)
        boxes.append(("frame", (x - b, y - b, floor), (x + b, y + b, floor + 1.0)))
    for z0, z1 in ((floor + 0.95, floor + 1.0), (floor + 0.45, floor + 0.48)):
        boxes.append(("frame", (min(x0, x1) - b, min(y0, y1) - b, z0), (max(x0, x1) + b, max(y0, y1) + b, z1)))
    return boxes


BALUSTER = 0.03  # the stair hole's balustrade, its posts' and rails' width
_OFF = 0.03  # it stands this far outside the hole, clear of the treads' outer corners
# The house's flight leaves the landing over the hole's front right quarter, its first five treads between 0.64 m and
# 1.41 m over the floor: there the hole's guard is frameless glass (GUARD_GLASS thick, a metre high), which can pass a
# couple of centimetres off their edges; the steel takes over on the east side where the treads have climbed over its
# handrail (_STEEL_FROM north of the column, 15 cm clear of the fifth tread's end on the +X axis).
GUARD_GLASS = 0.02
_STEEL_FROM = _CY + 0.15
_EAST = _CX + _STAIR_RADIUS + _OFF
_FRONT = _CY - _STAIR_RADIUS - _OFF
_STAIR_BALUSTRADE = (_balustrade((_EAST, _STEEL_FROM), (_EAST, _CY + _STAIR_RADIUS + _OFF), 2)
                     + _balustrade((LEFT + WALL + _OFF, _CY + _STAIR_RADIUS + _OFF),
                                   (_EAST, _CY + _STAIR_RADIUS + _OFF), 4)
                     + [("glass", (_CX + 0.1, _FRONT - GUARD_GLASS / 2, LEVEL_Z[0]),
                         (_EAST - GUARD_GLASS / 2 - 0.005, _FRONT + GUARD_GLASS / 2, LEVEL_Z[0] + 1.0)),
                        ("glass", (_EAST - GUARD_GLASS / 2, _FRONT - GUARD_GLASS / 2, LEVEL_Z[0]),
                         (_EAST + GUARD_GLASS / 2, _STEEL_FROM - BALUSTER, LEVEL_Z[0] + 1.0))])


def _pierced(key, mn, mx, window):
    """Boxes of the wall mn..mx (thin along X, running along Y) minus a window (y0, y1, z0, z1)."""
    (x0, y0, z0), (x1, y1, z1) = mn, mx
    wy0, wy1, wz0, wz1 = window
    return [(key, (x0, y0, z0), (x1, wy0, z1)), (key, (x0, wy1, z0), (x1, y1, z1)),
            (key, (x0, wy0, z0), (x1, wy1, wz0)), (key, (x0, wy0, wz1), (x1, wy1, z1))]


def _pierced_along_x(key, mn, mx, *windows):
    """Boxes of the wall mn..mx (thin along Y, running along X) minus the windows (x0, x1, z0, z1), which must not
    overlap along X."""
    (x0, y0, z0), (x1, y1, z1) = mn, mx
    boxes, left = [], x0
    for wx0, wx1, wz0, wz1 in sorted(windows):
        boxes += [(key, (left, y0, z0), (wx0, y1, z1)), (key, (wx0, y0, z0), (wx1, y1, wz0)),
                  (key, (wx0, y0, wz1), (wx1, y1, z1))]
        left = wx1
    return boxes + [(key, (left, y0, z0), (x1, y1, z1))]


def _window_frame(key, window, y, depth=0.06):
    """Boxes of the frame round a back wall window (x0, x1, z0, z1) on the line y: head, sill, jambs and a mullion in
    the middle, WINDOW_FRAME wide, `depth` across the wall (the glass, 2 cm thick, runs inside them)."""
    wx0, wx1, wz0, wz1 = window
    f, h, mid = WINDOW_FRAME, depth / 2, (wx0 + wx1) / 2
    return [(key, (wx0, y - h, wz0), (wx1, y + h, wz0 + f)), (key, (wx0, y - h, wz1 - f), (wx1, y + h, wz1)),
            (key, (wx0, y - h, wz0 + f), (wx0 + f, y + h, wz1 - f)),
            (key, (wx1 - f, y - h, wz0 + f), (wx1, y + h, wz1 - f)),
            (key, (mid - f / 2, y - h, wz0 + f), (mid + f / 2, y + h, wz1 - f))]


STRUCTURE = [
    {"name": "Plinth", "uv_tile": 4.8, "boxes": [
        *_round_the_roof_hole("stone", LEFT, TERRACE, RIGHT, BACK, BASEMENT_CEIL, PLINTH),
        ("stone", (6.5, -7.5, 0.0), (8.7, TERRACE, 0.15)),
        ("stone", (6.5, -7.25, 0.15), (8.7, TERRACE, 0.30)),
        ("stone", (6.5, -7.0, 0.30), (8.7, TERRACE, PLINTH)),
    ]},
    # Resort deco: travertine on the ground floor and the roof terrace, laid on the plinth's 1.2 m slab grid, and teak
    # upstairs.
    {"name": "Floors_stone", "uv_tile": 4.8, "boxes": [
        *_round_the_roof_hole("stone", LEFT + WALL, FRONT, RIGHT - WALL, BACK - WALL, PLINTH, PLINTH + 0.02),
        *_round_the_roof_hole("stone", LEFT + 0.1, EDGE + 0.1, UPPER_RIGHT - 0.1, BACK - 0.1, ROOF_TOP, ROOF_TOP + 0.02),
    ]},
    {"name": "Floors", "uv_tile": 1.0, "boxes": [
        # the upper floor round the void: east of it, the gallery and the stair's landing behind it, and behind the
        # stair's hole
        ("teak", (VOID_X1, FRONT, UPPER_FLOOR), (UPPER_RIGHT - WALL, BACK - WALL, UPPER_FLOOR + 0.02)),
        ("teak", (_CX, VOID_Y1, UPPER_FLOOR), (VOID_X1, BACK - WALL, UPPER_FLOOR + 0.02)),
        ("teak", (LEFT + WALL, _HOLE_BACK, UPPER_FLOOR), (_CX, BACK - WALL, UPPER_FLOOR + 0.02)),
    ]},
    {"name": "Walls_white", "uv_tile": 1.0, "boxes": [
        *_pierced_along_x("white", (LEFT, BACK - WALL, PLINTH), (STONE_LEFT, BACK, GROUND_CEIL), KITCHEN_WINDOW),
        # the west wall behind the void, both storeys (in front of it the void's tall glass): beside the stair's hole it
        # fills the upper floor's height, upstairs it frames bedroom 3's window
        ("white", (LEFT, VOID_Y1, PLINTH), (LEFT + WALL, BACK, GROUND_CEIL)),
        ("white", (LEFT, VOID_Y1, GROUND_CEIL), (LEFT + WALL, _HOLE_BACK, UPPER_FLOOR)),
        ("white", (LEFT, VOID_Y1, UPPER_FLOOR), (LEFT + WALL, BED3_WINDOW[0], UPPER_CEIL)),
        ("white", (LEFT, BED3_WINDOW[1], UPPER_FLOOR), (LEFT + WALL, BACK, UPPER_CEIL)),
        *_pierced_along_x("white", (LEFT, BACK - WALL, UPPER_FLOOR), (UPPER_RIGHT, BACK, UPPER_CEIL),
                          BATH_SHARED_WINDOW, GAMING_WINDOW),
        *_pierced("white", (UPPER_RIGHT - WALL, FRONT, UPPER_FLOOR), (UPPER_RIGHT, BACK, UPPER_CEIL),
                  BATH_MASTER_WINDOW),
    ]},
    {"name": "Walls_stone", "uv_tile": 4.8, "boxes": [
        ("stone", (STONE_LEFT, BACK - WALL, PLINTH), (RIGHT, BACK, GROUND_CEIL)),
        *_pierced("stone", (RIGHT - WALL, FRONT, PLINTH), (RIGHT, BACK, GROUND_CEIL), WC_WINDOW),
        ("stone", (STONE_LEFT, FACADE, PLINTH), (DOOR["x0"], FRONT + 0.1, GROUND_CEIL)),
        ("stone", (DOOR["x1"], FACADE, PLINTH), (RIGHT, FRONT + 0.1, GROUND_CEIL)),
        ("stone", (DOOR["x0"], FACADE, DOOR_TOP), (DOOR["x1"], FRONT + 0.1, GROUND_CEIL)),
    ]},
    {"name": "Slabs", "uv_tile": 1.0, "boxes": [
        # the upper slab round the void (no slab over it, nor a cantilever in front of it): east of it and the balcony,
        # the gallery and the stair's landing behind it, and behind the stair's hole
        ("white", (VOID_X1, FRONT, GROUND_CEIL), (UPPER_RIGHT, BACK, UPPER_FLOOR)),
        ("white", (BALCONY_X0, EDGE, GROUND_CEIL), (UPPER_RIGHT, FRONT, UPPER_FLOOR)),
        ("white", (_CX, VOID_Y1, GROUND_CEIL), (VOID_X1, BACK, UPPER_FLOOR)),
        ("white", (LEFT, _HOLE_BACK, GROUND_CEIL), (_CX, BACK, UPPER_FLOOR)),
        # roof of the stone block beside the upper box, and the roof over the upper box (it shades the balcony and
        # the void's tall glass), holed for the stair
        ("white", (UPPER_RIGHT, FACADE, GROUND_CEIL), (RIGHT, BACK, UPPER_FLOOR)),
        *_round_the_roof_hole("white", LEFT, EDGE, UPPER_RIGHT, BACK, UPPER_CEIL, ROOF_TOP),
    ]},
    # teak soffits under the cantilever and the roof slab, and the balcony deck
    {"name": "Soffits_wood", "uv_tile": 2.0, "boxes": [
        ("teak", (BALCONY_X0, EDGE, GROUND_CEIL - 0.02), (UPPER_RIGHT, FRONT, GROUND_CEIL)),
        ("teak", (LEFT, EDGE, UPPER_CEIL - 0.02), (UPPER_RIGHT, FRONT, UPPER_CEIL)),
        ("teak", (BALCONY_X0, EDGE, UPPER_FLOOR), (UPPER_RIGHT, FRONT, UPPER_FLOOR + 0.02)),
    ]},
    {"name": "Columns", "uv_tile": 1.0, "boxes": [
        *[("frame", (x - 0.075, COLUMN_Y - 0.075, PLINTH), (x + 0.075, COLUMN_Y + 0.075, GROUND_CEIL - 0.02))
          for x in COLUMNS_X],
        *_STAIR_BALUSTRADE,
    ]},
    {"name": "Louvers_wood", "uv_tile": 2.0, "boxes": [
        *[("teak", (UPPER_RIGHT, y - 0.03, UPPER_FLOOR), (UPPER_RIGHT + 0.1, y + 0.03, ROOF_TOP - 0.05))
          for y in LOUVER_Y],
        ("teak", (UPPER_RIGHT, LOUVER_Y[0] - 0.06, UPPER_FLOOR), (UPPER_RIGHT + 0.12, LOUVER_Y[-1] + 0.06,
                                                                  UPPER_FLOOR + 0.06)),
        ("teak", (UPPER_RIGHT, LOUVER_Y[0] - 0.06, ROOF_TOP - 0.11), (UPPER_RIGHT + 0.12, LOUVER_Y[-1] + 0.06,
                                                                      ROOF_TOP - 0.05)),
    ]},
    # Beside the door: two wall-light housings (their LEDs are in LED_STRIPS), the house number plate with two
    # raised figures, and a mailbox with a slot, left of the wall fountain (ground.WALL_FOUNTAINS). The lights and the
    # plate rise with the door's head; the mailbox stays at hand height. In the back wall: the frames of the ribbon
    # windows (their panes are in WINDOWS), here rather than an object of their own, which would be a draw call.
    {"name": "Facade_details", "uv_tile": 1.0, "boxes": [
        *_window_frame("frame", KITCHEN_WINDOW, BACK - WALL / 2),
        *_window_frame("frame", GAMING_WINDOW, BACK - WALL / 2),
        ("frame", (6.62, FACADE - 0.08, _LAMP), (6.78, FACADE, _LAMP + 0.28)),
        ("frame", (8.42, FACADE - 0.08, _LAMP), (8.58, FACADE, _LAMP + 0.28)),
        ("frame", (8.85, FACADE - 0.03, _LAMP - 0.06), (9.35, FACADE, _LAMP + 0.22)),
        ("white", (8.94, FACADE - 0.04, _LAMP - 0.01), (9.0, FACADE - 0.03, _LAMP + 0.17)),
        ("white", (9.1, FACADE - 0.04, _LAMP - 0.01), (9.26, FACADE - 0.03, _LAMP + 0.17)),
        ("frame", (9.45, FACADE - 0.22, 1.05), (9.85, FACADE, 1.45)),
        ("teak", (9.5, FACADE - 0.23, 1.32), (9.8, FACADE - 0.22, 1.36)),
    ]},
]

CURTAIN_WALLS = [
    # The double-height living room: its front and its side are each one tall glass wall from the plinth to the upper
    # ceiling, the mullions running through, on the lines of the glazing and of the west wall.
    {"name": "living_front", "start": (LEFT + WALL / 2, FRONT), "end": (-3.4, FRONT),
     "z0": PLINTH, "z1": UPPER_CEIL - 0.02, "panes": 6},
    {"name": "living_west", "start": (LEFT + WALL / 2, FRONT), "end": (LEFT + WALL / 2, VOID_Y1),
     "z0": PLINTH, "z1": UPPER_CEIL - 0.02, "panes": 5},
    {"name": "ground_front", "start": (-3.4, FRONT), "end": (STONE_LEFT, FRONT),
     "z0": PLINTH, "z1": GROUND_CEIL - 0.02, "panes": 6},
    # Upstairs one run per room, so each partition meets a mullion.
    {"name": "upper_front_bed2", "start": (-3.4, FRONT), "end": (2.5, FRONT),
     "z0": LEVEL_Z[1], "z1": UPPER_CEIL - 0.02, "panes": 3},
    {"name": "upper_front_master", "start": (2.5, FRONT), "end": (UPPER_RIGHT - WALL, FRONT),
     "z0": LEVEL_Z[1], "z1": UPPER_CEIL - 0.02, "panes": 3},
    {"name": "upper_west_bed3", "start": (LEFT + WALL / 2, BED3_WINDOW[0]), "end": (LEFT + WALL / 2, BED3_WINDOW[1]),
     "z0": LEVEL_Z[1], "z1": UPPER_CEIL - 0.02, "panes": 2},
]

RAILINGS = [
    {"name": "balcony", "start": (BALCONY_X0, EDGE + 0.05), "end": (UPPER_RIGHT, EDGE + 0.05),
     "z0": LEVEL_Z[1], "height": 1.1, "panes": 6},
    {"name": "balcony_left", "start": (BALCONY_X0 + 0.05, EDGE + 0.1), "end": (BALCONY_X0 + 0.05, FRONT),
     "z0": LEVEL_Z[1], "height": 1.1, "panes": 1},
    {"name": "balcony_right", "start": (UPPER_RIGHT - 0.05, EDGE + 0.1), "end": (UPPER_RIGHT - 0.05, FRONT),
     "z0": LEVEL_Z[1], "height": 1.1, "panes": 1},
    # The gallery's glass balustrade along the void, from the stair's landing (the stretch the stair's top tread
    # arrives at stays open) to the void's east edge; and behind the stair's hole (on the landing's side the upper flight
    # climbs on through it).
    {"name": "gallery", "start": (_CX + _STAIR_RADIUS, VOID_Y1 + 0.05), "end": (VOID_X1, VOID_Y1 + 0.05),
     "z0": LEVEL_Z[1], "height": 1.1, "panes": 4},
    {"name": "stair_hole_back", "start": (LEFT + WALL, _HOLE_BACK + 0.05), "end": (_CX, _HOLE_BACK + 0.05),
     "z0": LEVEL_Z[1], "height": 1.1, "panes": 1},
    {"name": "roof_front", "start": (LEFT, EDGE + 0.05), "end": (UPPER_RIGHT, EDGE + 0.05),
     "z0": ROOF_TOP, "height": 1.1, "panes": 8},
    {"name": "roof_back", "start": (LEFT, BACK - 0.05), "end": (UPPER_RIGHT, BACK - 0.05),
     "z0": ROOF_TOP, "height": 1.1, "panes": 8},
    {"name": "roof_left", "start": (LEFT + 0.05, EDGE + 0.1), "end": (LEFT + 0.05, BACK - 0.1),
     "z0": ROOF_TOP, "height": 1.1, "panes": 6},
    {"name": "roof_right", "start": (UPPER_RIGHT - 0.05, EDGE + 0.1), "end": (UPPER_RIGHT - 0.05, BACK - 0.1),
     "z0": ROOF_TOP, "height": 1.1, "panes": 6},
]

DOOR_WIDTH = 0.9  # open doorways, no leaf (spec §5.1)
_KITCHEN_HALL_END = 6.2  # where the hall's kitchen wall stops, 1.1 m short of the back wall's inner face


def _partition(name, level, start, end, doors=()):
    """Floor-to-ceiling interior wall on `level`; `doors` are the offsets of 0.9 m openings measured from `start`."""
    return {"name": name, "level": level, "start": start, "end": end, "z0": LEVEL_Z[level], "z1": CEILING[level],
            "doors": [(offset, DOOR_WIDTH) for offset in doors]}


# Spec §5.1: partitions only round the wet rooms, the closet and the bedrooms; living, dining and kitchen stay open.
# Each wall starts and ends at the face of the wall it meets.
PARTITIONS = [
    # ground floor: the TV's media wall between the living and the dining room, free standing; the hall behind the
    # kitchen (its west face backs the dining sideboard; it stops short of the back wall, the way from the hall to the
    # kitchen: PASSAGES), the WC and the laundry off the hall
    _partition("Wall_media", 0, (-3.4, -3.9), (-3.4, -0.1)),
    _partition("Wall_kitchen_hall", 0, (STONE_LEFT, -2.6), (STONE_LEFT, _KITCHEN_HALL_END)),
    _partition("Wall_hall_east", 0, (9.0, -0.56), (9.0, BACK - WALL), doors=(0.56, 3.96)),
    _partition("Wall_wc_front", 0, (9.06, -0.5), (RIGHT - WALL, -0.5)),
    _partition("Wall_wc_laundry", 0, (9.06, 2.0), (RIGHT - WALL, 2.0)),
    # upper floor: the gallery along the void is the hallway; bedroom 2 and the master off it at the front (the master
    # through the closet: gallery -> closet (x = 2.5) -> master (y = 1.5), the master bath off the closet (x = 4.7)),
    # bedroom 3 and the shared bath off it at the back (y = 3.1), the gaming corner open to it
    _partition("Wall_upper_middle", 1, (VOID_X1, VOID_Y1), (UPPER_RIGHT - WALL, VOID_Y1), doors=(0.46, 6.06)),
    _partition("Wall_bed2_west", 1, (-3.4, FRONT), (-3.4, VOID_Y1 - 0.06)),
    _partition("Wall_bed2_master", 1, (2.5, FRONT), (2.5, VOID_Y1 - 0.06)),
    _partition("Wall_closet_west", 1, (2.5, VOID_Y1 + 0.06), (2.5, BACK - WALL), doors=(0.34,)),
    _partition("Wall_closet_bath", 1, (4.7, VOID_Y1 + 0.06), (4.7, BACK - WALL), doors=(0.44,)),
    _partition("Wall_gallery_back", 1, (LEFT + WALL, 3.1), (-1.8, 3.1), doors=(4.9, 7.4)),
    _partition("Wall_bed3_bath", 1, (-4.8, 3.16), (-4.8, BACK - WALL)),
    _partition("Wall_bath_gaming", 1, (-1.8, 3.16), (-1.8, BACK - WALL)),
]

# The ribbon windows' clear panes, one GLASS_window_<name> each on the back wall's centre line (archkit.glazing.window).
WINDOWS = [
    {"name": "kitchen", "start": (KITCHEN_WINDOW[0], BACK - WALL / 2), "end": (KITCHEN_WINDOW[1], BACK - WALL / 2),
     "z0": KITCHEN_WINDOW[2], "z1": KITCHEN_WINDOW[3]},
    {"name": "gaming", "start": (GAMING_WINDOW[0], BACK - WALL / 2), "end": (GAMING_WINDOW[1], BACK - WALL / 2),
     "z0": GAMING_WINDOW[2], "z1": GAMING_WINDOW[3]},
]

# Ways between two rooms that are no partition's door: the gap a partition stops short of a wall, from `start` to `end`
# along the wall's line. layout_check keeps them clear like a doorway: the hall's only way into the kitchen.
PASSAGES = [
    {"name": "kitchen_hall", "level": 0, "start": (STONE_LEFT, _KITCHEN_HALL_END), "end": (STONE_LEFT, BACK - WALL)},
]

# Frosted panels in the window openings, on the wall's centre line (FROSTED_<name>).
FROSTED = [
    {"name": "wc", "start": (RIGHT - WALL / 2, WC_WINDOW[0]), "end": (RIGHT - WALL / 2, WC_WINDOW[1]),
     "z0": WC_WINDOW[2], "z1": WC_WINDOW[3]},
    {"name": "bath_master", "start": (UPPER_RIGHT - WALL / 2, BATH_MASTER_WINDOW[0]),
     "end": (UPPER_RIGHT - WALL / 2, BATH_MASTER_WINDOW[1]), "z0": BATH_MASTER_WINDOW[2], "z1": BATH_MASTER_WINDOW[3]},
    {"name": "bath_shared", "start": (BATH_SHARED_WINDOW[0], BACK - WALL / 2),
     "end": (BATH_SHARED_WINDOW[1], BACK - WALL / 2), "z0": BATH_SHARED_WINDOW[2], "z1": BATH_SHARED_WINDOW[3]},
]

LED_STRIPS = [
    {"name": "LT_led_ground_soffit", "start": (BALCONY_X0, EDGE + 0.05), "end": (UPPER_RIGHT, EDGE + 0.05),
     "z": GROUND_CEIL - 0.02},
    {"name": "LT_led_roof_edge", "start": (LEFT, EDGE + 0.05), "end": (UPPER_RIGHT, EDGE + 0.05),
     "z": UPPER_CEIL - 0.02},
    {"name": "LT_led_plinth", "start": (LEFT, TERRACE - 0.02), "end": (6.4, TERRACE - 0.02), "z": PLINTH - 0.05},
    {"name": "LT_led_plinth_right", "start": (8.8, TERRACE - 0.02), "end": (RIGHT, TERRACE - 0.02),
     "z": PLINTH - 0.05},
    # wall lights beside the door: an 8 cm glowing block under each housing in STRUCTURE's Facade_details
    {"name": "LT_wall_door_l", "start": (6.66, FACADE - 0.04), "end": (6.74, FACADE - 0.04), "z": _LAMP,
     "size": 0.08},
    {"name": "LT_wall_door_r", "start": (8.46, FACADE - 0.04), "end": (8.54, FACADE - 0.04), "z": _LAMP,
     "size": 0.08},
]

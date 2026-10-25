"""The tall house (villa v2 spec §12 "Nhà cao + thông tầng"): every storey of the villa 30 % taller over the same plinth,
both storeys grown to 23 x 15 m, a double-height living room under a gallery with a glass balustrade, an open spiral stair
up to it and a tiered crystal ring chandelier in the void. Pure Python."""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit import spiral  # noqa: E402
from archkit.catalog import (CHANDELIER_RINGS, FURNITURE, SPIRAL_STAIR, STAIR_PAVILION, WALL_MOUNTED,  # noqa: E402
                             footprint)
from garden import paths_layout  # noqa: E402
from houses import house_layout, layout_check  # noqa: E402
from houses.house_parts import common, shell  # noqa: E402
from siteplan import zones, zones_check  # noqa: E402

# The glass villa's heights (villa v2 spec §5), which the tall house raises over the plinth.
GLASS_VILLA = {"GROUND_CEIL": 3.85, "UPPER_FLOOR": 4.15, "UPPER_CEIL": 7.25, "ROOF_TOP": 7.55, "DOOR_TOP": 2.85}


class TallHeightsTest(unittest.TestCase):
    def test_the_plinth_stays_and_every_height_over_it_grows_by_thirty_per_cent(self):
        self.assertEqual(common.PLINTH, 0.45)
        self.assertEqual(common.HEIGHT_SCALE, 1.3)
        for name, old in GLASS_VILLA.items():
            self.assertEqual(getattr(common, name), round(common.PLINTH + (old - common.PLINTH) * 1.3, 2), name)

    def test_the_storeys_are_four_point_eight_metres_floor_to_floor(self):
        self.assertAlmostEqual(common.UPPER_FLOOR - common.PLINTH, 4.81, places=9)
        self.assertAlmostEqual(common.LEVEL_Z[1] - common.LEVEL_Z[0], 4.81, places=9)
        self.assertAlmostEqual(common.CEILING[0] - common.LEVEL_Z[0], 4.4, places=9)  # clear height downstairs
        self.assertAlmostEqual(common.CEILING[1] - common.LEVEL_Z[1], 4.01, places=9)  # and upstairs
        self.assertEqual(common.ROOF_TOP, 9.68)
        self.assertEqual(common.LEVEL_Z, {0: 0.47, 1: 5.28, 2: 9.70})

    def test_the_cuts_stay_at_chest_height_over_each_floor(self):
        self.assertEqual(house_layout.CUT_HEIGHTS, {0: 2.05, 1: 6.86})


def boxes(*groups):
    """(key, min, max) of every STRUCTURE box of the named groups (all of them by default)."""
    return [box for group in house_layout.STRUCTURE if not groups or group["name"] in groups for box in group["boxes"]]


def overlap(a, b):
    """Whether two rects (x0, y0, x1, y1) share more than an edge."""
    return a[0] < b[2] - 1e-6 and b[0] < a[2] - 1e-6 and a[1] < b[3] - 1e-6 and b[1] < a[3] - 1e-6


def at_upper_floor(box):
    """A box of the floor between the storeys: it spans part of the upper slab's height."""
    _key, (_x0, _y0, z0), (_x1, _y1, z1) = box
    return z0 < common.UPPER_FLOOR + 0.02 - 1e-6 and z1 > common.GROUND_CEIL + 1e-6


def rect(box):
    _key, (x0, y0, _z0), (x1, y1, _z1) = box
    return (x0, y0, x1, y1)


def piece(name):
    (entry,) = [entry for entry in house_layout.FURNITURE if entry[1] == name]
    return entry


def rooms():
    return {room["name"]: room for room in house_layout.ROOMS}


VOID = (*common.VOID[0], *common.VOID[1])


class TallFootprintTest(unittest.TestCase):
    """Both storeys grow to 23 x 15 m: 3 m to the left and 2 m to the back in site space, the front line, the east wall
    and the front door staying where the garden walk, the carport and the driveway meet them."""

    def test_the_house_is_23_by_15_metres_on_its_plan_lines(self):
        self.assertEqual(house_layout.FOOTPRINT, (23.0, 15.0))
        self.assertEqual((common.LEFT, common.RIGHT, common.BACK), (-11.5, 11.5, 7.5))
        self.assertEqual((common.FRONT, common.EDGE, common.TERRACE), (-5.5, -7.0, -6.8))
        self.assertEqual((common.UPPER_RIGHT, common.STONE_LEFT, common.WALL), (8.5, 5.5, 0.2))
        # the facade language: glazing 2 m behind the front edge, the upper box cantilevered 1.5 m over the terrace,
        # the stone block one storey high on the right, 6 m wide, the upper box stopping above it
        w, d = house_layout.FOOTPRINT
        self.assertEqual(common.FRONT - common.EDGE, 1.5)
        self.assertEqual(common.FRONT - (-d / 2), 2.0)
        self.assertEqual(common.RIGHT - common.STONE_LEFT, 6.0)
        self.assertEqual(common.RIGHT - common.UPPER_RIGHT, 3.0)

    def test_its_zone_and_slot_grow_left_and_back_and_keep_the_front_the_east_wall_and_the_door(self):
        self.assertEqual(zones.ZONES["house"], ((-13.0, 2.0), (10.0, 17.0)))
        slot = zones.SLOTS["house_01"]
        self.assertEqual((slot["pos"], slot["yaw"], slot["footprint"]), ((-1.5, 9.5), 0.0, (23.0, 15.0)))
        (sx, sy), (w, d) = slot["pos"], slot["footprint"]
        self.assertEqual(sy - d / 2, 2.0)  # the front line
        self.assertEqual(sx + common.RIGHT, 10.0)  # the east wall, 2 m off the carport
        door = house_layout.DOOR
        self.assertAlmostEqual(sx + (door["x0"] + door["x1"]) / 2, paths_layout.DOOR[0], places=6)  # the walk's end
        self.assertEqual(paths_layout.DOOR, (6.1, 2.0))
        self.assertEqual(zones_check.check(zones), [])

    def test_the_back_trees_stand_clear_of_the_new_back_wall(self):
        (x0, y0), (x1, y1) = zones.ZONES["house"]
        for x, y in zones.TREES:
            gap = math.hypot(max(x0 - x, 0.0, x - x1), max(y0 - y, 0.0, y - y1))
            self.assertGreaterEqual(gap, 2.0, (x, y))  # the placeholder canopy is 1.2 m across its middle
        self.assertIn((-11.0, 19.5), zones.TREES)
        self.assertIn((11.0, 19.5), zones.TREES)

    def test_every_room_stands_inside_the_footprint(self):
        self.assertEqual([problem for problem in layout_check.check(house_layout) if "footprint" in problem], [])


class DoubleHeightLivingRoomTest(unittest.TestCase):
    """The living room on the left is double height: no upper floor over its front part (the void), its front and side
    glass one tall wall each, and a gallery with a glass balustrade along the void's back, which is the upper hallway."""

    def test_the_void_is_about_eight_metres_square_in_the_living_room_against_the_front_and_the_west_wall(self):
        x0, y0, x1, y1 = VOID
        self.assertTrue(7.0 <= x1 - x0 <= 8.0 and 7.0 <= y1 - y0 <= 9.0, VOID)
        self.assertEqual((x0, y0), (common.LEFT + common.WALL, common.FRONT))
        living = rooms()["living"]
        self.assertEqual(living["level"], 0)
        self.assertTrue(living["min"][0] <= x0 and living["min"][1] <= y0 and x1 <= living["max"][0] + 0.1
                        and y1 < living["max"][1], (living, VOID))

    def test_no_upper_floor_slab_spans_the_void(self):
        spanning = [box for box in boxes() if at_upper_floor(box) and overlap(rect(box), VOID)]
        self.assertEqual(spanning, [])
        upper = [box for box in boxes("Slabs", "Floors") if at_upper_floor(box)]
        self.assertGreaterEqual(len(upper), 3)  # the rest of the upper floor is still there
        # in front of the void the upper box does not cantilever either: the tall glass shows from top to bottom
        front = (common.LEFT, common.EDGE, VOID[2], common.FRONT)
        self.assertEqual([box for box in boxes() if at_upper_floor(box) and overlap(rect(box), front)], [])

    def test_its_front_and_side_glass_each_run_the_full_double_height_in_one_wall(self):
        walls = {wall["name"]: wall for wall in house_layout.CURTAIN_WALLS}
        tall = [wall for wall in walls.values() if wall["z0"] == common.PLINTH and wall["z1"] >= common.UPPER_CEIL - 0.03]
        self.assertEqual(len(tall), 2, sorted(walls))
        x0, y0, x1, y1 = VOID
        front = [wall for wall in tall if wall["start"][1] == wall["end"][1] == common.FRONT]
        side = [wall for wall in tall if wall["start"][0] == wall["end"][0]]
        self.assertEqual(len(front), 1)
        self.assertEqual(len(side), 1)
        (fx0, _), (fx1, _) = front[0]["start"], front[0]["end"]
        self.assertTrue(min(fx0, fx1) <= x0 + 0.1 and max(fx0, fx1) >= x1, front[0])
        (sx, sy0), (_, sy1) = side[0]["start"], side[0]["end"]
        self.assertTrue(common.LEFT <= sx <= x0 and min(sy0, sy1) <= y0 and max(sy0, sy1) >= y1, side[0])
        for wall in (front[0], side[0]):
            span = abs((wall["end"][0] - wall["start"][0]) + (wall["end"][1] - wall["start"][1]))
            self.assertTrue(1.0 <= span / wall["panes"] <= 1.6, wall)  # tall narrow panes, continuous mullions

    def test_a_gallery_runs_along_the_back_of_the_void_upstairs(self):
        gallery = rooms()["gallery"]
        self.assertEqual(gallery["level"], 1)
        self.assertEqual(gallery["min"][1], VOID[3])
        self.assertTrue(gallery["min"][0] <= VOID[0] and gallery["max"][0] > VOID[2], gallery)
        self.assertGreaterEqual(gallery["max"][1] - gallery["min"][1], 1.5)
        self.assertEqual(house_layout.ROOM_LABELS["gallery"], "hành lang")

    def test_a_glass_balustrade_guards_the_void_along_the_gallery_but_where_the_stair_arrives(self):
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        rails = [rail for rail in house_layout.RAILINGS if rail["z0"] == common.LEVEL_Z[1]]
        along = [rail for rail in rails if abs(rail["start"][1] - VOID[3]) <= 0.1 and rail["start"][1] == rail["end"][1]]
        spans = sorted(tuple(sorted((rail["start"][0], rail["end"][0]))) for rail in along)
        self.assertEqual(len(spans), 1, spans)
        self.assertAlmostEqual(spans[0][0], cx + radius, delta=0.05)  # from the stair's landing
        self.assertAlmostEqual(spans[0][1], VOID[2], delta=0.05)  # to the void's east edge
        # the stair's hole behind its column has glass along its back; on the landing's side the upper flight climbs
        # on from the landing through the hole to the roof, so no glass stands in its way there
        hole = shell.STAIR_HOLE
        self.assertTrue(any(abs(rail["start"][1] - rail["end"][1]) < 1e-6 and abs(rail["start"][1] - hole[1][1]) <= 0.1
                            for rail in rails), rails)
        self.assertFalse(any(abs(rail["start"][0] - rail["end"][0]) < 1e-6 and abs(rail["start"][0] - hole[1][0]) <= 0.12
                             for rail in rails), rails)
        for rail in rails:
            self.assertGreaterEqual(rail["height"], 1.0, rail["name"])

    def test_no_upstairs_room_reaches_over_the_void(self):
        for room in house_layout.ROOMS:
            if room["level"] == 1:
                self.assertFalse(overlap((*room["min"], *room["max"]), VOID), room["name"])

    def test_the_upper_floor_keeps_its_rooms_with_the_master_suite_moved_east(self):
        upper = {name for name, room in rooms().items() if room["level"] == 1}
        self.assertEqual(upper, {"gallery", "master", "bath_master", "closet", "bedroom2", "bedroom3", "bath_shared",
                                 "gaming", "balcony"})
        master = rooms()["master"]
        self.assertGreater(master["min"][0], VOID[2])  # off the void, at the front
        self.assertEqual(master["min"][1], common.FRONT)
        self.assertEqual(house_layout.ROOM_LABELS["gaming"], "góc máy tính")
        kinds = {kind for kind, _name, room, *_ in house_layout.FURNITURE if rooms()[room]["level"] == 1}
        self.assertLessEqual({"bed_king", "bed_double", "bed_single", "gaming_desk", "gaming_chair", "bathtub", "shower",
                              "closet_rack", "vanity_double", "tv_cabinet", "egg_chair"}, kinds)


class SpiralStairInPlanTest(unittest.TestCase):
    """The open spiral stair stands in the living room, centred on the void's back edge: its front half rises in the
    void, the gallery's landing covers its back-right quarter and a hole in the upper floor the back-left one."""

    def stair(self):
        kind, name, room, center, rot, *opts = piece("Stair")
        return kind, room, center, rot

    def test_it_is_the_kit_stair_in_the_living_room_on_the_gallery_edge(self):
        kind, room, center, rot = self.stair()
        self.assertEqual((kind, room, rot), ("spiral_stair", "living", 0))
        self.assertEqual(center, shell.STAIR["center"])
        self.assertEqual(center[1], VOID[3])
        self.assertFalse(hasattr(shell, "STAIR_END_X"))  # the straight stair along the back wall is gone
        x0, y0, x1, y1 = layout_check._rect(center, footprint("spiral_stair", 0))
        living = rooms()["living"]
        self.assertTrue(living["min"][0] <= x0 and living["min"][1] <= y0 and x1 <= living["max"][0]
                        and y1 <= living["max"][1])

    def test_it_climbs_the_storey_to_its_top_tread_flush_with_the_upper_floor(self):
        self.assertAlmostEqual(SPIRAL_STAIR["rise"], common.LEVEL_Z[1] - common.LEVEL_Z[0], places=9)
        top = house_layout.FLOOR_Z["living"] + spiral.treads(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"],
                                                            SPIRAL_STAIR["turns"])[-1][2]
        self.assertAlmostEqual(top, common.LEVEL_Z[1], places=9)

    def test_the_landing_covers_the_quarter_one_steps_onto_and_the_hole_the_one_behind_the_column(self):
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        upper = [rect(box) for box in boxes("Slabs") if at_upper_floor(box)]

        def covered(x, y):
            return any(x0 < x < x1 and y0 < y < y1 for x0, y0, x1, y1 in upper)

        self.assertTrue(covered(cx + radius / 2, cy + radius / 2))  # the landing
        self.assertFalse(covered(cx - radius / 2, cy + radius / 2))  # the hole
        self.assertFalse(covered(cx + radius / 2, cy - radius / 2))  # the void
        self.assertFalse(covered(cx - radius / 2, cy - radius / 2))
        (hx0, hy0), (hx1, hy1) = shell.STAIR_HOLE
        self.assertEqual((hx1, hy0, hy1), (cx, cy, cy + radius))
        self.assertLessEqual(hx0, cx - radius)

    def test_there_is_two_metres_of_headroom_under_the_landings_all_the_way_up(self):
        # under the gallery's landing, the roof's and the pavilion's roof, both flights: every slab over a tread
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        floor = house_layout.FLOOR_Z["living"]
        overhead = [(x0, y0, z0, x1, y1) for _key, (x0, y0, z0), (x1, y1, _z1) in boxes("Slabs")]
        pavilion_at = piece("Stair_pavilion")[3]
        pw, pd, ph = FURNITURE["stair_pavilion"]
        roof = common.LEVEL_Z[2] + ph - 0.12  # under the pavilion's flat roof
        overhead.append((pavilion_at[0] - pw / 2, pavilion_at[1] - pd / 2, roof, pavilion_at[0] + pw / 2,
                         pavilion_at[1] + pd / 2))
        opts = piece("Stair")[5]
        under = set()
        for a0, a1, top in spiral.flights(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"],
                                          upper=opts["upper"]):
            for k in range(1, 8):
                angle = a0 + (a1 - a0) * k / 8
                for r in (0.3, 0.7, radius - 0.05):
                    x, y = cx + r * math.cos(angle), cy + r * math.sin(angle)
                    for x0, y0, z0, x1, y1 in overhead:
                        if x0 < x < x1 and y0 < y < y1 and z0 > floor + top:
                            under.add(round(z0, 2))
                            self.assertGreaterEqual(z0 - (floor + top), 2.0, (math.degrees(angle), top))
        # the gallery's landing, the roof's and the pavilion's roof do overhang treads
        self.assertEqual(under, {common.GROUND_CEIL, common.UPPER_CEIL, round(roof, 2)})

    def test_nothing_upstairs_stands_on_the_stair_or_in_its_hole(self):
        stair = layout_check._rect(shell.STAIR["center"], footprint("spiral_stair", 0))
        levels = {name: room["level"] for name, room in rooms().items()}
        for kind, name, room, center, rot, *opts in house_layout.FURNITURE:
            if levels[room] == 1 and kind not in WALL_MOUNTED:
                self.assertFalse(overlap(layout_check._rect(center, footprint(kind, rot)), stair), name)


class ChandelierInTheVoidTest(unittest.TestCase):
    """The tiered crystal ring chandelier hangs in the middle of the void from its ceiling, under the roof, clear of the
    stair and the gallery, its lowest ring well over the heads of the living room."""

    def test_it_hangs_from_the_ceiling_of_the_void_in_the_living_room(self):
        kind, name, room, (x, y), rot, opts = piece("Chandelier")
        self.assertEqual((kind, room), ("crystal_chandelier", "living"))
        floor = house_layout.FLOOR_Z["living"]
        top = floor + WALL_MOUNTED[kind] + FURNITURE[kind][2] + opts["cord"]
        self.assertAlmostEqual(top, common.UPPER_CEIL, places=3)  # the void's ceiling is the upper floor's
        self.assertEqual(common.ceiling_over(0, (x, y)), common.UPPER_CEIL)
        self.assertEqual(common.ceiling_over(0, (VOID[2] + 1.0, VOID[3] + 1.0)), common.GROUND_CEIL)
        self.assertEqual(common.ceiling_over(1, (x, y)), common.UPPER_CEIL)

    def test_it_is_near_the_middle_of_the_void_clear_of_the_stair_and_the_gallery(self):
        kind, name, room, (x, y), rot, opts = piece("Chandelier")
        x0, y0, x1, y1 = VOID
        self.assertAlmostEqual(x, (x0 + x1) / 2, delta=0.3)
        self.assertAlmostEqual(y, (y0 + y1) / 2, delta=0.9)  # over the front of the sofa group's rug
        reach = FURNITURE[kind][0] / 2
        for side in (x - reach - x0, x1 - (x + reach), y - reach - y0, y1 - (y + reach)):
            self.assertGreaterEqual(side, 0.4)  # the gallery's edge is the void's back
        sx, sy = shell.STAIR["center"]
        gap = math.hypot(x - sx, y - sy) - reach - FURNITURE["spiral_stair"][0] / 2
        self.assertGreaterEqual(gap, 0.4)

    def test_from_the_wallpapers_camera_the_stair_does_not_line_up_behind_it(self):
        # CAM_idle looks in over the front right: past the chandelier the stair must stand well off its line of sight
        # (some 8 degrees in plan), so the two read as two things rather than one tangle
        camera = zones.CAMERAS["CAM_idle"]
        (cx, cy, _cz), (tx, ty, _tz) = camera["pos"], camera["target"]
        sight = math.atan2(ty - cy, tx - cx)
        sx, sy = zones.SLOTS["house_01"]["pos"]
        _kind, _name, _room, (x, y), *_ = piece("Chandelier")
        stair_x, stair_y = shell.STAIR["center"]
        behind = math.atan2(stair_y - y, stair_x - x)  # module and site axes are parallel (the slot is not turned)
        self.assertEqual(zones.SLOTS["house_01"]["yaw"], 0.0)
        off = abs(math.degrees(math.atan2(math.sin(behind - sight), math.cos(behind - sight))))
        self.assertGreaterEqual(off, 6.0, (x + sx, y + sy))

    def test_its_lowest_ring_hangs_over_two_point_six_metres_above_the_living_room_floor(self):
        self.assertGreaterEqual(WALL_MOUNTED["crystal_chandelier"] + CHANDELIER_RINGS[0][1], 2.6)
        self.assertTrue(3.0 <= WALL_MOUNTED["crystal_chandelier"] + CHANDELIER_RINGS[0][1] <= 3.5)

    def test_the_living_rooms_point_light_shines_from_inside_it(self):
        kind, name, room, (x, y), rot, opts = piece("Chandelier")
        (light,) = [light for light in house_layout.POINT_LIGHTS if light["name"] == "L_living"]
        lx, ly, lz = light["pos"]
        reach = FURNITURE[kind][0] / 2
        self.assertTrue(abs(lx - x) <= reach and abs(ly - y) <= reach, light)
        bottom = house_layout.FLOOR_Z["living"] + WALL_MOUNTED[kind]
        self.assertTrue(bottom < lz < bottom + FURNITURE[kind][2], light)
        self.assertEqual([light["name"] for light in house_layout.POINT_LIGHTS],
                         ["L_living", "L_kitchen", "L_master", "L_bedroom2"])  # still four: the hero's budget

    def test_the_living_rooms_downlights_are_in_the_ceiling_of_the_void(self):
        (living,) = [group for group in house_layout.DOWNLIGHTS if group["name"] == "LT_down_living"]
        self.assertEqual(living["z"], common.UPPER_CEIL)
        x0, y0, x1, y1 = VOID
        self.assertTrue(all(x0 < x < x1 and y0 < y < y1 for x, y in living["points"]), living["points"])



class RoofAccessTest(unittest.TestCase):
    """The way up to the roof terrace: the spiral stair climbs on from the gallery's landing round the same column,
    through a hole in the roof slab, into a small pavilion on the roof deck (white solid walls, glass towards the deck)."""

    def test_the_stairs_upper_flight_climbs_from_the_gallery_to_the_roof_floor(self):
        kind, name, room, center, rot, opts = piece("Stair")
        upper = opts["upper"]
        self.assertAlmostEqual(upper["rise"], common.LEVEL_Z[2] - common.LEVEL_Z[1], places=9)
        self.assertLessEqual(upper["rise"] / upper["treads"], 0.2)
        both = spiral.flights(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"], upper=upper)
        self.assertAlmostEqual(house_layout.FLOOR_Z["living"] + both[-1][2], common.LEVEL_Z[2], places=9)
        lower_top = both[SPIRAL_STAIR["treads"] - 1]
        self.assertAlmostEqual(house_layout.FLOOR_Z["living"] + lower_top[2], common.LEVEL_Z[1], places=9)

    def test_the_roof_slab_has_the_stairs_hole_but_for_the_landing_one_steps_onto_up_there(self):
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        roof = [rect(box) for box in boxes("Slabs") if box[1][2] >= common.UPPER_CEIL - 1e-6]
        floor = [rect(box) for box in boxes("Floors_stone") if box[1][2] >= common.ROOF_TOP - 1e-6]

        def covered(rects, x, y):
            return any(x0 < x < x1 and y0 < y < y1 for x0, y0, x1, y1 in rects)

        # the top tread ends on the -X axis (archkit.spiral.flights): one steps off it towards -Y, onto the quarter
        # behind it, x < cx and y < cy
        opts = piece("Stair")[5]
        end = spiral.flights(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"],
                             upper=opts["upper"])[-1][1]
        self.assertAlmostEqual(math.cos(end), -1.0, places=9)
        (lx0, ly0), (lx1, ly1) = shell.ROOF_LANDING
        self.assertEqual((lx0, ly0, lx1, ly1), (cx - radius, cy - radius, cx, cy))
        for rects in (roof, floor):
            self.assertTrue(covered(rects, cx - radius / 2, cy - radius / 2))  # the landing
            for sx, sy in ((1, 1), (-1, 1), (1, -1)):
                self.assertFalse(covered(rects, cx + sx * radius / 2, cy + sy * radius / 2), (sx, sy))
            self.assertTrue(covered(rects, cx + radius + 1.0, cy))  # the rest of the roof is still there

    def test_a_white_glass_and_teak_pavilion_over_the_stair_opens_onto_the_roof_deck(self):
        kind, name, room, (x, y), rot, *opts = piece("Stair_pavilion")
        self.assertEqual((kind, room, rot), ("stair_pavilion", "roof", 0))
        pw, pd, ph = FURNITURE["stair_pavilion"]
        overhang, wall = STAIR_PAVILION["overhang"], STAIR_PAVILION["wall"]
        # its walls, the footprint but for the slab's overhang on the front and the east, stand round the stair's square
        walls = (x - pw / 2, y - pd / 2 + overhang, x + pw / 2 - overhang, y + pd / 2)
        sx, sy = shell.STAIR["center"]
        self.assertAlmostEqual((walls[0] + walls[2]) / 2, sx, places=9)
        self.assertAlmostEqual((walls[1] + walls[3]) / 2, sy, places=9)
        radius = FURNITURE["spiral_stair"][0] / 2
        self.assertGreaterEqual((walls[2] - walls[0]) / 2 - wall, radius)  # the treads clear the solid walls' faces
        pavilion = (x - pw / 2, y - pd / 2, x + pw / 2, y + pd / 2)
        j = house_layout.JACUZZI["center"]
        t = house_layout.TRELLIS
        for other in ((j[0] - 1.8, j[1] - 2.2, j[0] + 1.8, j[1] + 1.8), (*t["min"], *t["max"])):
            self.assertFalse(overlap(pavilion, other), other)  # the jacuzzi's deck with its step, the trellis
        # its door opening, the front left half (-Y at rot 0), leads onto open deck: 1.5 m in front of it nothing stands
        door = (walls[0], walls[1] - 1.5, (walls[0] + walls[2]) / 2, walls[1])
        roof = rooms()["roof"]
        self.assertTrue(roof["min"][0] <= door[0] and roof["min"][1] <= door[1], door)
        for kind_b, name_b, room_b, center_b, rot_b, *_ in house_layout.FURNITURE:
            if room_b == "roof" and kind_b not in WALL_MOUNTED and name_b != name:  # its own slab overhangs it
                self.assertFalse(overlap(door, layout_check._rect(center_b, footprint(kind_b, rot_b))), name_b)
        self.assertEqual(layout_check.check(house_layout), [])  # inside the parapet, clear of the cabana and the rest
        # it is lower than the trellis: the camera's roof clearance stays what it is
        self.assertLess(common.LEVEL_Z[2] + ph, t["z0"] + t["height"])
        # its glass (the east side and the front's right half) stands well off the parapet's glass railings, its solid
        # west and back walls face the west and back ones: no two glass planes close behind one another
        for rail in shell.RAILINGS:
            (rx0, ry0), (rx1, ry1) = rail["start"], rail["end"]
            if rail["z0"] < common.ROOF_TOP - 1e-6:
                continue
            if abs(rx0 - rx1) < 1e-6:  # along Y
                self.assertGreaterEqual(abs(rx0 - walls[2]), 0.3, rail["name"])
            else:
                self.assertGreaterEqual(abs(ry0 - walls[1]), 0.3, rail["name"])

    def test_the_pavilion_and_the_cabana_stand_well_apart(self):
        # both are boxes about as high on the roof's west half: a metre and more between them so they read as two
        def footprint_rect(name):
            kind, _name, _room, center, rot, *_ = piece(name)
            return layout_check._rect(center, footprint(kind, rot))

        (ax0, ay0, ax1, ay1), (bx0, by0, bx1, by1) = footprint_rect("Stair_pavilion"), footprint_rect("Daybed_cabana")
        gap = math.hypot(max(bx0 - ax1, ax0 - bx1, 0.0), max(by0 - ay1, ay0 - by1, 0.0))
        self.assertGreaterEqual(gap, 1.0)


AC_ROOMS = {"master": "phòng master", "bedroom2": "phòng ngủ 2", "bedroom3": "phòng ngủ 3"}


class AirConditionerTest(unittest.TestCase):
    """A split air conditioner high on a solid wall of each bedroom, its wall remote beside the light switch under the
    cut, the outdoor condensers out of sight on the roof behind a low teak screen."""

    def units(self, kind):
        return {room: entry for entry in house_layout.FURNITURE if entry[0] == kind for room in [entry[2]]}

    def test_each_bedroom_has_one_split_unit_and_one_remote(self):
        for kind in ("ac_split", "ac_remote"):
            entries = [entry for entry in house_layout.FURNITURE if entry[0] == kind]
            self.assertEqual(sorted(entry[2] for entry in entries), sorted(AC_ROOMS), kind)
        for room, entry in self.units("ac_split").items():
            self.assertEqual(entry[1], f"AC_{room}")
        for room, entry in self.units("ac_remote").items():
            self.assertEqual(entry[1], f"AC_remote_{room}")

    def test_each_unit_hangs_on_a_solid_wall_clear_of_doors_glass_and_the_bed_head_well_under_the_ceiling(self):
        kind = "ac_split"
        w, d, h = FURNITURE[kind]
        for room, (_, name, _, (x, y), rot, *_) in self.units(kind).items():
            level = rooms()[room]["level"]
            top = house_layout.FLOOR_Z[room] + WALL_MOUNTED[kind] + h
            self.assertLessEqual(top, common.CEILING[level] - 0.25, name)
            x0, y0, x1, y1 = layout_check._rect((x, y), footprint(kind, rot))
            # its back face, the side opposite the one it faces (rot 0: -Y, 90: +X, 180: +Y)
            back = {0: ("y", y1), 90: ("x", x0), 180: ("y", y0), 270: ("x", x1)}[rot]
            span = (x0, x1) if back[0] == "y" else (y0, y1)
            wall = None
            for p in house_layout.PARTITIONS:
                (sx, sy), (ex, ey) = p["start"], p["end"]
                along_x = abs(sy - ey) < 1e-6
                if (back[0] == "y") != along_x or p["level"] != level:
                    continue
                line = sy if along_x else sx
                lo, hi = sorted((sx, ex) if along_x else (sy, ey))
                if abs(abs(back[1] - line) - 0.06) < 0.011 and lo <= span[0] and span[1] <= hi:
                    wall = p
            self.assertIsNotNone(wall, name)  # its back on the face of a partition, along the whole unit
            (sx, sy), (ex, ey) = wall["start"], wall["end"]
            a0 = sx if abs(sy - ey) < 1e-6 else sy
            sign = 1.0 if (ex if abs(sy - ey) < 1e-6 else ey) >= a0 else -1.0
            for offset, width in wall["doors"]:
                lo, hi = sorted((a0 + sign * offset, a0 + sign * (offset + width)))
                self.assertFalse(lo < span[1] and span[0] < hi, (name, wall["name"]))
            for glass in house_layout.CURTAIN_WALLS:
                (gx0, gy0), (gx1, gy1) = glass["start"], glass["end"]
                self.assertFalse(overlap((min(gx0, gx1) - 0.2, min(gy0, gy1) - 0.2, max(gx0, gx1) + 0.2,
                                          max(gy0, gy1) + 0.2), (x0, y0, x1, y1)), (name, glass["name"]))
            reach = layout_check._in_front((x0, y0, x1, y1), rot, 1.0)
            for bed, bed_name, bed_room, bed_at, bed_rot, *_ in house_layout.FURNITURE:
                if bed.startswith("bed_") and bed_room == room:
                    self.assertFalse(overlap(reach, layout_check._rect(bed_at, footprint(bed, bed_rot))), name)

    def test_each_remote_hangs_beside_its_rooms_light_switch_under_the_cut(self):
        switches = {entry[2]: entry[3] for entry in house_layout.FURNITURE if entry[0] == "light_switch"}
        for room, (kind, name, _, (x, y), rot, *_) in self.units("ac_remote").items():
            top = house_layout.FLOOR_Z[room] + WALL_MOUNTED[kind] + FURNITURE[kind][2]
            self.assertLess(top, house_layout.CUT_HEIGHTS[rooms()[room]["level"]], name)
            sx, sy = switches[room]
            self.assertLess(math.hypot(x - sx, y - sy), 1.0, name)

    def test_the_condensers_stand_on_the_roof_between_two_teak_screens_out_of_sight_from_the_deck_and_outside(self):
        condensers = [entry for entry in house_layout.FURNITURE if entry[0] == "ac_condenser"]
        screens = {entry[1]: entry for entry in house_layout.FURNITURE if entry[0] == "teak_screen"}
        self.assertEqual(len(condensers), 3)
        self.assertEqual(sorted(screens), ["AC_screen", "AC_screen_parapet"])
        for entry in condensers + list(screens.values()):
            self.assertEqual(entry[2], "roof", entry[1])
            self.assertEqual(entry[5], {"into": "AC_condensers"}, entry[1])  # one merged object: few draw calls
        rects = [layout_check._rect(at, footprint(kind, rot)) for kind, _n, _r, at, rot, *_ in condensers]
        deck, parapet = (layout_check._rect(screens[name][3], footprint("teak_screen", screens[name][4]))
                         for name in ("AC_screen", "AC_screen_parapet"))
        # the parapet's screen faces out (rot 270: -X), its slats towards the glass railing, the deck's faces the deck
        self.assertEqual((screens["AC_screen"][4], screens["AC_screen_parapet"][4]), (90, 270))
        for x0, y0, x1, y1 in rects:
            self.assertGreater(y0, 0.0)  # the back half of the roof, far from the front facade
            for sx0, sy0, sx1, sy1 in (deck, parapet):
                self.assertTrue(sy0 <= y0 and y1 <= sy1, (x0, y0, x1, y1))
            self.assertLessEqual(x1, deck[0])  # behind the deck's screen, seen from the deck
            self.assertLessEqual(parapet[2], x0)  # and behind the parapet's, seen from outside through the railing
            self.assertLess(x0 - common.LEFT, 1.0)  # along the west parapet
        self.assertGreaterEqual(FURNITURE["teak_screen"][2], FURNITURE["ac_condenser"][2] + 0.2)


class BackFacadeTest(unittest.TestCase):
    """The back facade has windows: a high ribbon of clear glass over the kitchen run and one in the gaming corner,
    each a pane in a hole in the back wall, framed in black."""

    def test_a_ribbon_window_over_the_kitchen_run_and_one_in_the_gaming_corner(self):
        windows = {pane["name"]: pane for pane in house_layout.WINDOWS}
        self.assertEqual(sorted(windows), ["gaming", "kitchen"])
        line = common.BACK - common.WALL / 2
        for name, room, piece_name in (("kitchen", "kitchen", "Kitchen_run"), ("gaming", "gaming", "Gaming_desk")):
            pane = windows[name]
            (x0, y0), (x1, y1) = pane["start"], pane["end"]
            self.assertEqual((y0, y1), (line, line), name)  # in the back wall
            (rx0, _ry0), (rx1, _ry1) = rooms()[room]["min"], rooms()[room]["max"]
            self.assertTrue(rx0 + 0.2 <= x0 < x1 <= rx1 - 0.2, name)
            self.assertGreaterEqual(x1 - x0, 3.0, name)  # a ribbon
            kind, _n, _r, (px, _py), rot, *_ = piece(piece_name)
            floor = house_layout.FLOOR_Z[room]
            self.assertGreater(pane["z0"], floor + FURNITURE[kind][2] + 0.2, name)  # high over the run, the screens
            self.assertTrue(0.8 <= pane["z1"] - pane["z0"] <= 1.4, name)
            self.assertLessEqual(pane["z1"], common.CEILING[rooms()[room]["level"]] - 0.3, name)
            middle = ((x0 + x1) / 2, (pane["z0"] + pane["z1"]) / 2)
            for key, (bx0, by0, bz0), (bx1, by1, bz1) in boxes("Walls_white"):  # the wall is holed for it
                self.assertFalse(bx0 < middle[0] < bx1 and by0 < line < by1 and bz0 < middle[1] < bz1, name)
            frames = [box for box in boxes("Facade_details") if box[0] == "frame" and box[1][1] < line < box[2][1]
                      and x0 - 1e-6 <= box[1][0] and box[2][0] <= x1 + 1e-6]
            self.assertGreaterEqual(len(frames), 4, name)  # head, sill and jambs, in an object drawn anyway

    def test_the_hall_reaches_the_kitchen_through_a_passage_kept_clear_like_a_doorway(self):
        (passage,) = [p for p in house_layout.PASSAGES if p["name"] == "kitchen_hall"]
        (wall,) = [w for w in house_layout.PARTITIONS if w["name"] == "Wall_kitchen_hall"]
        self.assertEqual(passage["start"], wall["end"])  # from where the hall's kitchen wall stops
        self.assertEqual(passage["end"], (common.STONE_LEFT, common.BACK - common.WALL))  # to the back wall's face
        self.assertGreaterEqual(passage["end"][1] - passage["start"][1], shell.DOOR_WIDTH)
        self.assertEqual(passage["level"], 0)

        class Blocked:  # the house with a plant in the passage
            pass

        for key in dir(house_layout):
            if key.isupper():
                setattr(Blocked, key, getattr(house_layout, key))
        Blocked.FURNITURE = [*house_layout.FURNITURE, ("plant_small", "Plant_in_the_way", "hall", (5.9, 6.8), 0)]
        self.assertIn("Plant_in_the_way (plant_small) blocks the passage kitchen_hall", layout_check.check(Blocked))


if __name__ == "__main__":
    unittest.main()

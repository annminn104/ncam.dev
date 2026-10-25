"""The basement's plan (villa v2 spec §12 "Basement"): under the tall house's ground slab, round a hall at the foot of
the spiral stair, a wine cellar behind a glass wall, a karaoke lounge, a spa with its sauna and hot tub, a gym and a
shower room, each with its furniture, lights and a wall switch under the website's cut. Pure Python."""
import copy
import math
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit.catalog import FURNITURE, WALL_MOUNTED, footprint  # noqa: E402
from basement import basement_layout as L  # noqa: E402
from basement import layout_check  # noqa: E402
from houses import house_layout  # noqa: E402
from houses.house_parts import common  # noqa: E402

EPS = 1e-6
ROOMS = {"basement_hall": "Basement lobby", "wine_cellar": "Wine cellar", "karaoke": "Karaoke room", "spa": "Spa",
         "gym": "Gym", "shower_room": "Basement bathroom"}


def layout(**changes):
    """A copy of the shipped layout with some names replaced, for the checker to find a problem in."""
    names = {name: copy.deepcopy(value) for name, value in vars(L).items()
             if not name.startswith("_") and not isinstance(value, types.ModuleType) and not callable(value)}
    names.update(changes)
    return types.SimpleNamespace(**names)


def rooms():
    return {room["name"]: room for room in L.ROOMS}


def area(rect):
    (x0, y0), (x1, y1) = rect
    return (x1 - x0) * (y1 - y0)


def overlap(a, b):
    (ax0, ay0), (ax1, ay1) = a
    (bx0, by0), (bx1, by1) = b
    return ax0 < bx1 - EPS and bx0 < ax1 - EPS and ay0 < by1 - EPS and by0 < ay1 - EPS


def pieces(room=None, kind=None):
    return [p for p in L.FURNITURE if (room is None or p[2] == room) and (kind is None or p[0] == kind)]


class BasementHeightsTest(unittest.TestCase):
    def test_the_basement_lies_under_the_ground_slab_with_3_2_m_clear_under_it(self):
        # the plinth grows down into a slab GROUND_SLAB thick, whose underside is the basement's ceiling
        self.assertEqual(common.GROUND_SLAB, 0.85)
        self.assertEqual(common.BASEMENT_CEIL, round(common.PLINTH - common.GROUND_SLAB, 2))
        self.assertEqual(common.BASEMENT_FLOOR, -3.62)
        self.assertEqual(L.LEVEL, -1)
        self.assertEqual(L.FLOOR, round(common.BASEMENT_FLOOR + 0.02, 3))  # its finish, like the storeys'
        self.assertAlmostEqual(L.CEIL - L.FLOOR, 3.2, places=9)
        self.assertEqual(L.CEIL, common.BASEMENT_CEIL)

    def test_the_website_cuts_it_at_chest_height_over_its_floor(self):
        self.assertEqual(L.CUT, round(common.BASEMENT_FLOOR + common.CUT_ABOVE_FLOOR, 3))
        self.assertEqual(L.CUT, -2.02)
        self.assertEqual(L.CUT_HEIGHTS, {L.LEVEL: L.CUT})
        self.assertEqual(L.FLOOR_Z, {room["name"]: L.FLOOR for room in L.ROOMS})


class BasementPlanTest(unittest.TestCase):
    def test_the_shipped_layout_is_clean(self):
        self.assertEqual(layout_check.check(L), [])

    def test_its_retaining_walls_stand_round_the_houses_plinth(self):
        # the plinth's outline (house_parts/shell.py Plinth): the pit the lawn has a hole for
        (x0, y0), (x1, y1) = L.INSIDE
        self.assertEqual((x0, y0, x1, y1), (common.LEFT + L.WALL, common.TERRACE + L.WALL, common.RIGHT - L.WALL,
                                            common.BACK - L.WALL))
        outer = [(lo[0], lo[1], hi[0], hi[1]) for _key, lo, hi in L.RETAINING]
        self.assertEqual((min(b[0] for b in outer), min(b[1] for b in outer), max(b[2] for b in outer),
                          max(b[3] for b in outer)), (common.LEFT, common.TERRACE, common.RIGHT, common.BACK))
        for _key, (bx0, by0, bz0), (bx1, by1, bz1) in L.RETAINING:
            self.assertEqual((bz0, bz1), (common.BASEMENT_FLOOR, L.CEIL))  # floor to ceiling; the slab over them
            self.assertTrue(bx0 <= x0 + EPS or bx1 >= x1 - EPS or by0 <= y0 + EPS or by1 >= y1 - EPS)  # round it

    def test_it_has_the_rooms_asked_for_with_their_labels(self):
        self.assertEqual(sorted(rooms()), sorted(ROOMS))
        self.assertEqual(L.ROOM_LABELS, ROOMS)
        for room in L.ROOMS:
            self.assertEqual(room["level"], L.LEVEL, room["name"])
            self.assertTrue(room.get("interior"), room["name"])  # each lit by its own downlights

    def test_the_rooms_tile_the_inside_of_the_retaining_walls(self):
        inside = L.INSIDE
        for room in L.ROOMS:
            (x0, y0), (x1, y1) = room["min"], room["max"]
            self.assertTrue(inside[0][0] - EPS <= x0 and inside[0][1] - EPS <= y0 and x1 <= inside[1][0] + EPS
                            and y1 <= inside[1][1] + EPS, room["name"])
        for i, a in enumerate(L.ROOMS):
            for b in L.ROOMS[i + 1:]:
                self.assertFalse(overlap((a["min"], a["max"]), (b["min"], b["max"])), (a["name"], b["name"]))
        self.assertAlmostEqual(sum(area((room["min"], room["max"])) for room in L.ROOMS), area(inside), places=6)

    def test_every_room_is_a_good_size(self):
        for room in L.ROOMS:
            (x0, y0), (x1, y1) = room["min"], room["max"]
            low = 8.0 if room["name"] == "shower_room" else 25.0
            self.assertGreaterEqual((x1 - x0) * (y1 - y0), low, room["name"])
            self.assertGreaterEqual(min(x1 - x0, y1 - y0), 2.8, room["name"])

    def test_the_hall_is_the_way_into_every_room(self):
        links = layout_check.links(L)
        reached, todo = {"basement_hall"}, ["basement_hall"]
        while todo:
            here = todo.pop()
            for a, b in links:
                for there in ((b,) if a == here else (a,) if b == here else ()):
                    if there not in reached:
                        reached.add(there)
                        todo.append(there)
        self.assertEqual(reached, set(ROOMS))
        self.assertIn(("basement_hall", "wine_cellar"), {tuple(sorted(link)) for link in links})

    def test_the_wine_cellar_shows_through_a_glass_wall_onto_the_hall(self):
        cellar, hall = rooms()["wine_cellar"], rooms()["basement_hall"]
        line = cellar["min"][1]
        self.assertEqual(hall["max"][1], line)
        runs = [wall for wall in L.GLASS_WALLS if abs(wall["start"][1] - line) < EPS and abs(wall["end"][1] - line) < EPS]
        self.assertGreaterEqual(len(runs), 2)  # either side of its doorway
        glazed = sum(abs(wall["end"][0] - wall["start"][0]) for wall in runs)
        self.assertGreater(glazed, 0.7 * (cellar["max"][0] - cellar["min"][0]))
        for wall in runs:
            self.assertEqual((wall["z0"], wall["z1"]), (L.FLOOR, L.CEIL))

    def test_each_room_has_the_furniture_asked_for(self):
        def kinds(room):
            return [p[0] for p in pieces(room)]

        self.assertLessEqual({"wine_rack", "tasting_table", "wine_barrel"}, set(kinds("wine_cellar")))
        self.assertGreaterEqual(kinds("wine_cellar").count("wine_rack"), 5)
        karaoke = kinds("karaoke")
        self.assertLessEqual({"karaoke_sofa", "karaoke_tv", "mic_stand", "disco_ball"}, set(karaoke))
        self.assertEqual(karaoke.count("tower_speaker"), 2)
        spa = kinds("spa")
        self.assertLessEqual({"sauna_cabin", "hot_tub_small", "oil_shelf", "candle_set"}, set(spa))
        self.assertEqual(spa.count("massage_bed"), 2)
        self.assertLessEqual({"treadmill", "weight_rack", "dumbbell_rack", "mirror_wall", "yoga_mat"}, set(kinds("gym")))
        self.assertLessEqual({"shower", "toilet", "vanity_single"}, set(kinds("shower_room")))

    def test_a_few_accents_where_the_rooms_looked_bare_stand_on_their_hosts_tops(self):
        # the decor pass (villa v2 spec §12 "Curtains and accessories"): the cellar's decanter and glasses on the tasting table,
        # a pair of cushions on the karaoke's sofa, rolled towels on a massage bed, a towel and bottles by the gym's
        # dumbbells (the basement keeps within its 15k triangles)
        from houses import layout_check as house_check
        entries = {p[1]: p for p in L.FURNITURE}
        found = {}
        for kind, name, room, _pos, _rot, *opts in L.FURNITURE:
            if kind in ("wine_set", "cushion_pair", "spa_towels", "gym_kit"):
                options = opts[0] if opts else {}
                found[kind] = (room, options.get("on"), options.get("into"))
        self.assertEqual(found, {"wine_set": ("wine_cellar", "Tasting_table", L.ROOMS_OBJECT),
                                 "cushion_pair": ("karaoke", "Karaoke_sofa", L.ROOMS_OBJECT),
                                 "spa_towels": ("spa", "Massage_bed_1", L.SPA),  # behind the light well's glass
                                 "gym_kit": ("gym", None, L.ROOMS_OBJECT)})
        for entry in L.FURNITURE:
            host = (entry[5] if len(entry) > 5 else {}).get("on")
            if host is not None:
                self.assertIsNotNone(house_check.top_under(entry, entries), entry[1])
                self.assertEqual(entries[host][2], entry[2], entry[1])

    def test_the_tv_and_speakers_face_the_sofa_and_the_mirror_faces_the_gym(self):
        (tv,) = pieces("karaoke", "karaoke_tv")
        (sofa,) = pieces("karaoke", "karaoke_sofa")
        facing = {0: (0, -1), 90: (1, 0), 180: (0, 1), 270: (-1, 0)}
        to_sofa = (sofa[3][0] - tv[3][0], sofa[3][1] - tv[3][1])
        self.assertGreater(facing[tv[4]][0] * to_sofa[0] + facing[tv[4]][1] * to_sofa[1], 0)
        to_tv = (-to_sofa[0], -to_sofa[1])
        self.assertGreater(facing[sofa[4]][0] * to_tv[0] + facing[sofa[4]][1] * to_tv[1], 0)
        for speaker in pieces("karaoke", "tower_speaker"):
            self.assertLess(math.dist(speaker[3], tv[3]), 2.5)
            self.assertEqual(speaker[4], tv[4])

    def test_a_switch_per_room_in_reach_under_the_cut(self):
        switches = pieces(kind="light_switch")
        self.assertEqual(sorted(p[2] for p in switches), sorted(ROOMS))
        for kind, name, room, _pos, _rot, *_ in switches:
            top = L.FLOOR_Z[room] + WALL_MOUNTED[kind] + FURNITURE[kind][2]
            self.assertLess(top, L.CUT, name)
            self.assertEqual(name, f"Switch_{room}")

    def test_every_room_has_two_to_four_downlights_with_their_light_on_the_floor(self):
        by_room = {group["room"]: group for group in L.DOWNLIGHTS if "room" in group}
        self.assertEqual(sorted(by_room), sorted(ROOMS))
        for room, group in by_room.items():
            self.assertTrue(2 <= len(group["points"]) <= 4, room)
            self.assertEqual(group["name"], f"LT_down_{room}")
            self.assertEqual(group["z"], L.CEIL)
        # the cut takes the ceiling away: what shows the room lit at night is the light its downlights cast on the floor
        pooled = {(pool["group"], tuple(pool["center"])) for pool in L.POOLS}
        for group in by_room.values():
            for point in group["points"]:
                self.assertIn((group["name"], tuple(point)), pooled)

    def test_merged_pieces_go_into_objects_the_build_makes_and_what_glows_into_a_night_light(self):
        from archkit.catalog import NIGHT_KINDS
        for kind, name, _room, _pos, _rot, *opts in L.FURNITURE:
            into = (opts[0] if opts else {}).get("into")
            if kind in ("light_switch", "spiral_stair"):
                self.assertIsNone(into, name)  # objects of their own
                continue
            self.assertIn(into, L.OBJECTS, name)
            if kind in NIGHT_KINDS:  # its glow follows the night (or its group's toggle) only in a night light
                self.assertTrue(L.OBJECTS[into].get("night"), (name, into))

    def test_only_the_spa_behind_the_light_well_and_the_hall_under_the_stairs_hole_show_while_the_house_stands(self):
        # the website draws the basement's other rooms only under its cut (cutaway.ts): they lie under the plinth
        shown = {name for name, spec in L.OBJECTS.items() if not spec.get("buried")}
        self.assertLessEqual({L.SPA, L.WALLS, L.PARTITIONS_OBJECT, L.FLOOR_OBJECT}, shown)
        self.assertNotIn(L.ROOMS_OBJECT, shown)
        for kind, name, room, _pos, _rot, *opts in L.FURNITURE:
            into = (opts[0] if opts else {}).get("into")
            if into is not None and room != "spa":
                self.assertTrue(L.OBJECTS[into].get("buried"), (name, into))


def house_boxes(*groups):
    """(key, min, max) of the house's STRUCTURE boxes of the named groups."""
    return [box for group in house_layout.STRUCTURE if group["name"] in groups for box in group["boxes"]]


class BasementStairTest(unittest.TestCase):
    """The house's spiral stair goes on down its column from the living room to the basement's hall: a flight of its
    own, of the house's treads (18 degrees and some 19 cm each), whose top tread ends flush with the ground floor on the
    -X axis, a quarter turn before the house's first tread, so the quarter of floor between them is the landing both
    leave from (like the roof's, house_parts/shell.py ROOF_LANDING); the ground slab is holed over the rest of the
    stair's square, a steel balustrade along the hole's open sides."""

    def stair(self):
        (piece,) = pieces(kind="spiral_stair")
        return piece

    def flight(self):
        """(start, end, top) of every tread in module space: angles turned by the piece's rotation, tops over FLOOR."""
        from archkit import spiral
        kind, name, room, center, rot, opts = self.stair()
        turn = math.radians(rot)
        return [(a0 + turn, a1 + turn, L.FLOOR + top)
                for a0, a1, top in spiral.treads(opts["rise"], opts["treads"], opts["turns"])]

    def test_it_stands_in_the_hall_under_the_houses_stair_on_the_same_column(self):
        from houses.house_parts import shell
        kind, name, room, center, rot, opts = self.stair()
        self.assertEqual((name, room), ("Stair_basement", "basement_hall"))
        self.assertEqual(center, shell.STAIR["center"])
        self.assertIs(opts["cap"], False)  # its column runs on as the house stair's, which caps it

    def test_it_climbs_to_the_ground_floor_in_the_houses_treads(self):
        from archkit.catalog import SPIRAL_STAIR
        kind, name, room, center, rot, opts = self.stair()
        self.assertAlmostEqual(L.FLOOR + opts["rise"], common.LEVEL_Z[0], places=9)
        self.assertTrue(0.18 <= opts["rise"] / opts["treads"] <= 0.2, opts)
        self.assertAlmostEqual(opts["turns"] / opts["treads"], SPIRAL_STAIR["turns"] / SPIRAL_STAIR["treads"], places=9)
        self.assertAlmostEqual(self.flight()[-1][2], common.LEVEL_Z[0], places=9)

    def test_its_top_tread_ends_on_the_minus_x_axis_a_quarter_turn_before_the_houses_first(self):
        from archkit import spiral
        from archkit.catalog import SPIRAL_STAIR
        end = self.flight()[-1][1]
        self.assertAlmostEqual(math.cos(end), -1.0, places=9)
        house_start = spiral.treads(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"])[0][0]
        quarter = (house_start - end) % (2 * math.pi)
        self.assertAlmostEqual(quarter, math.pi / 2, places=9)

    def test_the_ground_slab_keeps_the_landing_quarter_and_is_holed_over_the_rest_of_the_stair(self):
        from houses.house_parts import shell
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        plinth = house_boxes("Plinth")
        self.assertEqual(min(lo[2] for _key, lo, _hi in plinth), common.BASEMENT_CEIL)  # the slab under the plinth
        floor = [box for box in house_boxes("Floors_stone") if box[1][2] < common.UPPER_FLOOR]

        def covered(boxes, x, y):
            return any(lo[0] < x < hi[0] and lo[1] < y < hi[1] for _key, lo, hi in boxes)

        for boxes in (plinth, floor):
            self.assertTrue(covered(boxes, cx - radius / 2, cy - radius / 2))  # the landing, x < cx and y < cy
            for sx, sy in ((1, 1), (-1, 1), (1, -1)):
                self.assertFalse(covered(boxes, cx + sx * radius / 2, cy + sy * radius / 2), (sx, sy))
            self.assertTrue(covered(boxes, cx + radius + 0.3, cy))  # the living room round it
            self.assertTrue(covered(boxes, cx, cy + radius + 0.3))

    def test_there_is_two_metres_of_headroom_over_every_tread(self):
        # under the ground slab's landing and under the house's own flight above, whose treads are 5 cm thick
        from archkit import spiral
        from archkit.catalog import SPIRAL_STAIR
        from houses.house_parts import shell
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        slab = [(lo[0], lo[1], lo[2], hi[0], hi[1]) for _key, lo, hi in house_boxes("Plinth")]
        house = [(a0, a1, common.LEVEL_Z[0] + top - 0.05)
                 for a0, a1, top in spiral.treads(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"])]
        clear = []
        for a0, a1, top in self.flight():
            for k in range(1, 8):
                angle = a0 + (a1 - a0) * k / 8
                for r in (0.3, 0.7, radius - 0.05):
                    x, y = cx + r * math.cos(angle), cy + r * math.sin(angle)
                    over = [z0 - top for x0, y0, z0, x1, y1 in slab if x0 < x < x1 and y0 < y < y1]
                    over += [under - top for b0, b1, under in house
                             if (angle - b0) % (2 * math.pi) < (b1 - b0) and under > top]
                    clear.append(min(over) if over else math.inf)
        self.assertGreaterEqual(min(clear), 2.0)
        self.assertLess(min(clear), 2.5)  # the landing does hang over the lowest treads

    def test_a_steel_balustrade_guards_the_holes_open_sides_on_the_ground_floor(self):
        from houses.house_parts import shell
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        rails = [(lo, hi) for key, lo, hi in house_boxes("Columns")
                 if key == "frame" and lo[2] >= common.PLINTH and hi[2] <= common.LEVEL_Z[0] + 1.2]
        east = [(lo, hi) for lo, hi in rails if abs((lo[0] + hi[0]) / 2 - (cx + radius)) < 0.05]
        north = [(lo, hi) for lo, hi in rails if abs((lo[1] + hi[1]) / 2 - (cy + radius)) < 0.05]
        for side in (east, north):
            self.assertTrue(side)
            self.assertGreaterEqual(max(hi[2] for _lo, hi in side), common.LEVEL_Z[0] + 1.0)
        self.assertLessEqual(max(hi[0] for lo, hi in east), cx + radius + 0.05)

    def test_the_balustrade_keeps_clear_of_the_houses_treads_climbing_over_the_hole_glass_where_they_pass(self):
        # the house's flight leaves the landing over the hole's front right quarter, its treads 1 to 5 between 0.64 m and
        # 1.41 m over the floor: a steel rail at their height a few centimetres off their edge would run into them, so the
        # hole is guarded there by frameless glass panels (the Columns' glass), clear of them, and steel only where the
        # treads pass over the rails
        from archkit import spiral
        from archkit.catalog import SPIRAL_STAIR
        from houses.house_parts import shell
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        floor = common.LEVEL_Z[0]
        treads = [(a0, a1, floor + top - 0.05, floor + top)
                  for a0, a1, top in spiral.treads(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"])]

        def near_stair(lo, hi):
            return (lo[2] >= common.PLINTH - 1e-6 and hi[2] <= floor + 1.2 and cx - radius - 0.2 < hi[0]
                    and lo[0] < cx + radius + 0.2 and cy - radius - 0.2 < hi[1] and lo[1] < cy + radius + 0.2)

        def gap(lo, hi):
            """How far the box lo..hi keeps from the treads sharing its height, horizontally (inf when none does)."""
            nearest = math.inf
            for a0, a1, z0, z1 in treads:
                if z1 <= lo[2] or hi[2] <= z0:
                    continue
                for k in range(9):
                    angle = a0 + (a1 - a0) * k / 8
                    for r in (0.15, 0.4, 0.7, 1.0, radius):
                        x, y = cx + r * math.cos(angle), cy + r * math.sin(angle)
                        dx, dy = max(lo[0] - x, 0.0, x - hi[0]), max(lo[1] - y, 0.0, y - hi[1])
                        nearest = min(nearest, math.hypot(dx, dy))
            return nearest

        columns = [(key, lo, hi) for key, lo, hi in house_boxes("Columns") if near_stair(lo, hi)]
        steel = [(lo, hi) for key, lo, hi in columns if key == "frame"]
        glass = [(lo, hi) for key, lo, hi in columns if key == "glass"]
        self.assertTrue(steel and glass)
        for lo, hi in steel:
            self.assertGreaterEqual(gap(lo, hi), 0.1, (lo, hi))
        for lo, hi in glass:
            self.assertGreaterEqual(gap(lo, hi), 0.01, (lo, hi))  # off their edges
            self.assertGreaterEqual(hi[2] - lo[2], 1.0)  # as high as the steel's handrail
        # the glass guards the quarter's front and its east side up to where the steel takes over
        front = [(lo, hi) for lo, hi in glass if hi[1] < cy - radius]
        east = [(lo, hi) for lo, hi in glass if lo[0] > cx + radius]
        self.assertTrue(front and east)
        self.assertLessEqual(min(lo[0] for lo, _hi in front), cx + 0.1 + 1e-6)
        self.assertGreaterEqual(max(hi[0] for _lo, hi in front), cx + radius)
        self.assertLessEqual(min(lo[1] for lo, _hi in east), cy - radius)
        east_steel = [lo[1] for lo, hi in steel if lo[0] > cx + radius]
        self.assertAlmostEqual(max(hi[1] for _lo, hi in east), min(east_steel), delta=0.05)

    def test_nothing_on_the_ground_floor_stands_on_the_stairs_hole(self):
        from houses import layout_check as house_check
        from houses.house_parts import shell
        stair = house_check._rect(shell.STAIR["center"], footprint("spiral_stair", 0))
        levels = {room["name"]: room["level"] for room in house_layout.ROOMS}
        for kind, name, room, center, rot, *opts in house_layout.FURNITURE:
            if levels[room] == 0 and kind not in WALL_MOUNTED and kind != "spiral_stair":
                rect = house_check._rect(center, footprint(kind, rot))
                self.assertFalse(rect[0] < stair[2] and stair[0] < rect[2] and rect[1] < stair[3] and stair[1] < rect[3],
                                 name)


def site(point):
    """Site (x, y) of a module (x, y): the basement's slot is the house's, unturned."""
    sx, sy = __import__("siteplan.zones", fromlist=["SLOTS"]).SLOTS["basement_01"]["pos"]
    return point[0] + sx, point[1] + sy


class OpeningsTest(unittest.TestCase):
    """What the website sees the basement through while the house shows (cutaway.ts showThroughOpenings): the light
    well's top and the ground slab's stair hole, each a rectangle in module space (x0, y0, x1, y1, z) on the object that
    stands in it; under the lawn the rest of the basement is drawn only where one of them lets the camera see it."""

    def test_the_light_wells_top_and_the_stair_hole_are_the_openings(self):
        from houses.house_parts import shell
        self.assertEqual(set(L.OPENINGS), {L.WELL_OBJECT, L.STAIR["name"]})
        (ix0, iy0), (ix1, iy1) = L.WELL_INSIDE
        x0, y0, x1, y1, z = L.OPENINGS[L.WELL_OBJECT]
        self.assertTrue(x0 <= ix0 and y0 <= iy0 and ix1 <= x1 and iy1 <= y1)  # all of its inside, its glass side too
        self.assertEqual(z, L.COPING)
        cx, cy = shell.STAIR["center"]
        radius = FURNITURE["spiral_stair"][0] / 2
        x0, y0, x1, y1, z = L.OPENINGS[L.STAIR["name"]]
        self.assertTrue(x0 <= cx - radius and y0 <= cy - radius and cx + radius <= x1 and cy + radius <= y1)
        self.assertEqual(z, common.LEVEL_Z[0])  # the ground floor's, where the slab is holed


class LightWellTest(unittest.TestCase):
    """The light well: a court sunk to the basement's floor in the lawn in front of the house, left of the
    walk, that lights the spa through its glass wall: travertine walls, pebbles, a palm whose crown shows over the lawn,
    planters, a frameless glass railing round its top and warm uplights washing its walls at night."""

    def test_it_lies_in_its_zone_in_front_of_the_plinth_its_back_on_the_basements_front_wall(self):
        from siteplan import zones
        (x0, y0), (x1, y1) = zones.ZONES[L.WELL_ZONE]
        (wx0, wy0), (wx1, wy1) = L.WELL["min"], L.WELL["max"]
        sx0, sy0 = site((wx0, wy0))
        sx1, sy1 = site((wx1, wy1))
        self.assertTrue(x0 <= sx0 < sx1 <= x1 and y0 <= sy0, (sx0, sy0, sx1, sy1))
        self.assertEqual(wy1, common.TERRACE)  # up to the plinth's front face: the basement's front wall
        self.assertEqual(y1, zones.ZONES["house"][0][1])  # the zone ends where the house's begins
        self.assertGreaterEqual((wx1 - wx0) * (wy1 - wy0), 18.0)  # big enough to read from the wallpaper

    def test_it_keeps_clear_of_the_pool_the_walk_the_flower_beds_the_lamp_and_the_trees(self):
        from archkit.catalog import footprint as fp
        from garden import beds_layout, paths_layout
        from siteplan import zones
        (wx0, wy0), (wx1, wy1) = L.WELL["min"], L.WELL["max"]
        (sx0, sy0), (sx1, sy1) = site((wx0, wy0)), site((wx1, wy1))
        well = ((sx0 - 0.3, sy0 - 0.3), (sx1 + 0.3, sy1))
        for name in ("pool", "path_gate", "path_turn", "path_door", "tea", "pond"):
            self.assertFalse(overlap(well, zones.ZONES[name]), name)
        for x, y in list(zones.TREES) + [zones.LAMP]:
            self.assertFalse(well[0][0] - 1.0 < x < well[1][0] + 1.0 and well[0][1] - 1.0 < y < well[1][1] + 1.0,
                             (x, y))
        for layout in (beds_layout, paths_layout):
            for kind, _group, pos, rot, *_ in layout.PIECES:
                (px, py), (w, d) = pos[:2], fp(kind, rot)
                self.assertFalse(overlap(well, ((px - w / 2, py - d / 2), (px + w / 2, py + d / 2))), (kind, pos))

    def test_its_glass_wall_looks_into_the_spa_across_its_whole_width(self):
        from houses.interact import room_at
        (glass,) = [wall for wall in L.GLASS_WALLS if wall["object"] == L.GLASS_SPA]
        (wx0, _wy0), (wx1, wy1) = L.WELL["min"], L.WELL["max"]
        self.assertEqual((glass["start"][0], glass["end"][0]), (wx0 + L.WALL, wx1 - L.WALL))
        self.assertEqual(glass["start"][1], wy1 + L.WALL / 2)  # in the front wall's opening
        middle = ((glass["start"][0] + glass["end"][0]) / 2, glass["start"][1] + 0.5)
        self.assertEqual(room_at(L.ROOMS, L.LEVEL, middle), "spa")
        self.assertEqual((glass["z0"], glass["z1"]), (common.BASEMENT_FLOOR, L.CEIL))

    def test_its_floor_is_the_basements_its_walls_rise_to_the_lawn_with_a_coping(self):
        self.assertEqual(L.WELL_FLOOR, L.FLOOR)
        (wx0, wy0), (wx1, wy1) = L.WELL["min"], L.WELL["max"]
        for key, lo, hi in L.WELL_WALLS:
            self.assertIn(key, ("stone", "stone_shade", "stone_deep"))  # travertine
            self.assertTrue(wx0 - 1e-6 <= lo[0] and hi[0] <= wx1 + 1e-6 and wy0 - 1e-6 <= lo[1] and hi[1] <= wy1 + 1e-6)
        self.assertEqual(min(lo[2] for _key, lo, _hi in L.WELL_WALLS), common.BASEMENT_FLOOR)
        self.assertEqual(max(hi[2] for _key, _lo, hi in L.WELL_WALLS), L.COPING)
        self.assertTrue(0.03 <= L.COPING <= 0.1)

    def test_its_walls_darken_towards_its_floor_under_a_pale_top_so_it_reads_as_a_sunken_court(self):
        # from the wallpaper camera, some 15 degrees down, the far walls show a metre or so deep: a pale band under the
        # coping, then shaded and deep travertine (palette stone, stone_shade, stone_deep) down to the floor
        def bands(key):
            return sorted((round(lo[2], 3), round(hi[2], 3)) for k, lo, hi in L.WELL_WALLS if k == key)
        stone, shade, deep = bands("stone"), bands("stone_shade"), bands("stone_deep")
        self.assertEqual(len(shade), 3)  # each of its three walls, the spa's glass wall its fourth side
        self.assertEqual(len(deep), 3)
        self.assertEqual({z0 for z0, _z1 in deep}, {common.BASEMENT_FLOOR})
        ((shade_z0, shade_z1),), (deep_z1,) = set(shade), {z1 for _z0, z1 in deep}
        self.assertEqual(deep_z1, shade_z0)
        self.assertEqual({z0 for z0, z1 in stone if z1 <= 0.0}, {shade_z1})  # the pale band down from the lawn
        self.assertTrue(-0.6 <= shade_z1 <= -0.2, shade_z1)  # a pale band a few tens of centimetres deep
        self.assertTrue(-1.4 <= shade_z0 <= -0.8, shade_z0)  # shaded within the metre the wallpaper sees
        self.assertEqual(max(z1 for _z0, z1 in stone), L.COPING)

    def test_it_holds_a_palm_showing_over_the_lawn_potted_palms_and_uplights(self):
        from archkit.catalog import FURNITURE as F, footprint as fp
        (ix0, iy0), (ix1, iy1) = L.WELL_INSIDE
        kinds = [kind for kind, *_ in L.WELL_PIECES]
        self.assertEqual(kinds.count("palm_courtyard"), 1)
        self.assertGreaterEqual(kinds.count("palm_small"), 2)  # potted palms, of the big one's few colours
        self.assertGreaterEqual(kinds.count("uplight"), 3)
        for kind, obj, (x, y, z), rot, *opts in L.WELL_PIECES:
            w, d = fp(kind, rot)
            self.assertTrue(ix0 <= x - w / 2 and x + w / 2 <= ix1 and iy0 <= y - d / 2 and y + d / 2 <= iy1, kind)
            self.assertEqual(z, L.WELL_FLOOR)
            self.assertIn(obj, L.OBJECTS)
            if kind == "palm_courtyard":
                self.assertGreater(z + F[kind][2], 1.0)  # its crown over the lawn: the well reads from afar

    def test_a_frameless_glass_railing_runs_round_its_three_open_sides(self):
        (wx0, wy0), (wx1, wy1) = L.WELL["min"], L.WELL["max"]
        sides = {"west": False, "south": False, "east": False}
        for (x0, y0), (x1, y1) in L.WELL_RAIL["runs"]:
            if abs(x0 - x1) < 1e-6 and x0 < wx0 + L.WALL:
                sides["west"] = True
            elif abs(x0 - x1) < 1e-6 and x0 > wx1 - L.WALL:
                sides["east"] = True
            elif abs(y0 - y1) < 1e-6 and y0 < wy0 + L.WALL:
                sides["south"] = True
        self.assertEqual(sides, {"west": True, "south": True, "east": True})
        self.assertGreaterEqual(L.WELL_RAIL["height"], 0.9)
        self.assertEqual(L.WELL_RAIL["z0"], L.COPING)

    def test_its_lights_wash_its_walls_and_it_stands_whole_and_drawn_under_every_cut(self):
        self.assertGreaterEqual(len(L.WASHES), 3)
        for wash in L.WASHES:
            self.assertEqual(wash["group"], L.WELL_LIGHTS)
        for name in (L.WELL_OBJECT, L.WELL_PLANTS, L.WELL_RAIL["object"], L.WELL_LIGHTS):
            self.assertEqual(L.OBJECTS[name].get("uncut"), True, name)
            self.assertFalse(L.OBJECTS[name].get("buried"), name)
        self.assertTrue(L.OBJECTS[L.WELL_LIGHTS].get("night"))

    def test_at_night_its_rim_glows_and_washes_its_far_walls_down_where_the_wallpaper_camera_looks_in(self):
        # the camera at the front right sees a metre or so down into the well: its west wall and its back (the plinth's
        # face over the spa's glass), so a strip of light runs round the rim under the coping and washes them downwards
        (wx0, wy0), (wx1, wy1) = L.WELL_INSIDE
        sides = set()
        for (x0, y0), (x1, y1), z in L.WELL_STRIPS:
            self.assertTrue(-0.2 < z < 0.0, z)
            if abs(x0 - x1) < 1e-6:
                sides.add("west" if x0 < (wx0 + wx1) / 2 else "east")
            else:
                sides.add("south" if y0 < (wy0 + wy1) / 2 else "north")
        self.assertEqual(sides, {"west", "east", "south", "north"})
        down = [wash for wash in L.WASHES if wash.get("height", wash["radius"]) < 0]
        self.assertEqual(sorted(round(wash["facing"], 6) for wash in down), [round(-math.pi / 2, 6), 0.0])
        for wash in down:
            self.assertTrue(-0.2 < wash["center"][2] < 0.0)
            self.assertLessEqual(wash["center"][2] + wash["height"], -2.0)

    def test_layout_check_keeps_the_well_in_its_zone_and_its_pieces_inside(self):
        moved = layout(WELL={"min": (-5.5, -14.0), "max": (-0.3, common.TERRACE)})
        found = layout_check.check(moved)
        self.assertTrue(any("light well" in problem and "zone 'lightwell'" in problem for problem in found), found)
        pieces = [p if p[0] != "palm_courtyard" else (p[0], p[1], (p[2][0], -12.0, p[2][2]), p[3], *p[4:])
                  for p in L.WELL_PIECES]
        found = layout_check.check(layout(WELL_PIECES=pieces))
        self.assertTrue(any("palm_courtyard" in problem and "light well" in problem for problem in found), found)


class BasementCheckTest(unittest.TestCase):
    """layout_check finds what would build wrong."""

    def test_a_piece_out_of_its_room_or_in_a_doorway_is_reported(self):
        furniture = [list(p) for p in L.FURNITURE]
        rack = next(p for p in furniture if p[0] == "wine_rack")
        rack[3] = (rack[3][0], rack[3][1] - 6.0)
        found = layout_check.check(layout(FURNITURE=[tuple(p) for p in furniture]))
        self.assertTrue(any("sticks out of room 'wine_cellar'" in problem for problem in found), found)

    def test_overlapping_rooms_and_a_room_off_the_hall_are_reported(self):
        changed = [dict(room) for room in L.ROOMS]
        gym = next(room for room in changed if room["name"] == "gym")
        gym["max"] = (gym["max"][0], gym["max"][1] + 1.0)
        found = layout_check.check(layout(ROOMS=changed))
        self.assertTrue(any("rooms 'gym' and 'karaoke' overlap" in problem for problem in found), found)
        walls = [dict(wall, doors=[]) for wall in L.PARTITIONS]
        found = layout_check.check(layout(PARTITIONS=walls))
        self.assertTrue(any("no way from the hall into room" in problem for problem in found), found)

    def test_a_piece_into_an_unknown_object_is_reported(self):
        furniture = [p if p[0] != "treadmill" else p[:5] + ({"into": "Nowhere"},) for p in L.FURNITURE]
        found = layout_check.check(layout(FURNITURE=furniture))
        self.assertTrue(any("goes into 'Nowhere'" in problem for problem in found), found)

    def test_a_switch_over_the_cut_is_reported(self):
        found = layout_check.check(layout(CUT_HEIGHTS={L.LEVEL: L.FLOOR + 1.0}))
        self.assertTrue(any("over the" in problem and "cut of level -1" in problem for problem in found), found)


if __name__ == "__main__":
    unittest.main()

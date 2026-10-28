"""Villa v2 part 2: the garden layouts (garden/*_layout.py), their checks (garden/layout_check.py) and what a click
toggles in the garden (garden/interact.py). Pure Python."""
import importlib
import math
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit import catalog  # noqa: E402
from siteplan import island, zones  # noqa: E402
from garden import fence_layout, interact, layout_check, paths_layout, shapes  # noqa: E402

RIM = island.outline(zones.ISLAND)
LIGHTS = {"interact": "lights:garden", "label": "Garden lights"}
BBQ = {"interact": "bbq", "label": "Barbecue"}


def rim_distance(point):
    """How far `point` is from the island's rim."""
    return min(_to_segment(point, a, b) for a, b in zip(RIM, RIM[1:] + RIM[:1]))


def _to_segment(point, a, b):
    (px, py), (ax, ay), (bx, by) = point, a, b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def site(**overrides):
    """A minimal island-wide garden layout (site space) with nothing in it."""
    base = {"MODULE_ID": "test", "ROLE": "prop", "FOOTPRINT": zones.ISLAND["size"], "ISLAND_WIDE": True,
            "ZONES_USED": (), "PIECES": []}
    base.update(overrides)
    return types.SimpleNamespace(**base)


def plot(**overrides):
    """A minimal zoned garden layout: an 8 x 6 m footprint in module space."""
    base = {"MODULE_ID": "plot", "ROLE": "prop", "FOOTPRINT": (8.0, 6.0), "PIECES": []}
    base.update(overrides)
    return types.SimpleNamespace(**base)


BORDER_GAP = 0.15  # flower beds this close stand end to end in one border


def chains(polygons, gap):
    """The polygons grouped into chains of neighbours no more than `gap` apart."""
    groups = []
    for polygon in polygons:
        linked = [group for group in groups if any(shapes.gap(polygon, other) <= gap for other in group)]
        groups = [group for group in groups if all(group is not other for other in linked)]
        groups.append([polygon] + [member for group in linked for member in group])
    return groups


def runs(beds):
    """The straight runs of (rot, bed) rectangles: beds turned alike in one line (the same centre across the run),
    end to end, as (rot, [bed, ...])."""
    lines = {}
    for rot, bed in beds:
        x0, y0, x1, y1 = shapes.bounds(bed)
        across = round((x0 + x1) / 2, 6) if rot in (90, 270) else round((y0 + y1) / 2, 6)
        lines.setdefault((rot % 180, across), []).append(bed)
    return [(rot, run) for (rot, _), line in sorted(lines.items()) for run in chains(line, BORDER_GAP)]


def copy(module, **overrides):
    """The public names of a layout module, as a namespace with some of them replaced."""
    names = {name: getattr(module, name) for name in dir(module) if name.isupper()}
    names.update(overrides)
    return types.SimpleNamespace(**names)


class FenceLayoutTest(unittest.TestCase):
    def test_the_shipped_fence_is_clean(self):
        self.assertEqual(layout_check.check(fence_layout), [])

    def test_it_is_an_island_wide_prop_with_the_island_as_footprint(self):
        self.assertEqual((fence_layout.MODULE_ID, fence_layout.ROLE), ("fence", "prop"))
        self.assertEqual(fence_layout.FOOTPRINT, zones.ISLAND["size"])
        self.assertTrue(fence_layout.ISLAND_WIDE)
        self.assertEqual(fence_layout.ZONES_USED, ())

    def test_posts_follow_the_rim_inset_by_about_half_a_metre(self):
        self.assertTrue(0.4 <= fence_layout.INSET <= 0.6)
        self.assertGreaterEqual(len(fence_layout.POSTS), 55)  # nearly every one of the rim's 64 vertices
        for (x, y), _ in fence_layout.POSTS:
            self.assertTrue(island.contains(RIM, (x, y)), (x, y))
            self.assertAlmostEqual(rim_distance((x, y)), fence_layout.INSET, delta=0.05, msg=(x, y))

    def test_boards_run_from_post_to_post_no_longer_than_a_board(self):
        for a, b in fence_layout.SPANS:
            self.assertTrue(fence_layout.SPAN_MIN - 1e-6 <= math.dist(a, b) <= fence_layout.SPAN_MAX, (a, b))
        self.assertEqual(len(fence_layout.BOARDS), 3)
        self.assertLessEqual(fence_layout.POST_TOP, 1.2)  # a low fence: the lawn shows over it from the wallpaper

    def test_the_fence_closes_round_the_island_through_its_two_gates(self):
        def key(point):
            return (round(point[0], 6), round(point[1], 6))

        degree = {}
        edges = list(fence_layout.SPANS) + [tuple(p["pos"] for p in fence_layout.PILLARS if p["gate"] == gate["name"])
                                            for gate in fence_layout.GATES]
        for a, b in edges:
            for point in (a, b):
                degree[key(point)] = degree.get(key(point), 0) + 1
        self.assertEqual(set(degree.values()), {2})  # every node joins two runs: one closed loop, no loose ends
        neighbours = {}
        for a, b in edges:
            neighbours.setdefault(key(a), []).append(key(b))
            neighbours.setdefault(key(b), []).append(key(a))
        start = key(edges[0][0])
        seen, previous, node = {start}, None, start
        while True:  # walk the loop: it visits every node once
            nxt = next(n for n in neighbours[node] if n != previous)
            if nxt == start:
                break
            previous, node = node, nxt
            seen.add(node)
        self.assertEqual(len(seen), len(degree))

    def test_the_walk_gate_is_at_the_main_path_and_the_car_gate_at_the_driveway(self):
        gates = {gate["name"]: gate for gate in fence_layout.GATES}
        self.assertEqual({name: gate["kind"] for name, gate in gates.items()}, {"Gate_main": "walk", "Gate_car": "car"})
        pillars = {(p["gate"], p["side"]): p["pos"] for p in fence_layout.PILLARS}
        (walk_l, walk_r), (car_l, car_r) = ((pillars[(name, "left")], pillars[(name, "right")])
                                            for name in ("Gate_main", "Gate_car"))
        self.assertLess(abs((walk_l[0] + walk_r[0]) / 2), 0.5)  # the main path's x
        (drive_x0, _), (drive_x1, _) = zones.ZONES["driveway"]
        self.assertTrue(drive_x0 < (car_l[0] + car_r[0]) / 2 < drive_x1)
        for point in (walk_l, walk_r, car_l, car_r):
            self.assertLess(point[1], -20.0)  # on the front rim, past the end of the path zones
        self.assertGreaterEqual(math.dist(walk_l, walk_r) - fence_layout.PILLAR, paths_layout.STONE[0] + 0.4)
        self.assertGreaterEqual(math.dist(car_l, car_r) - fence_layout.PILLAR, drive_x1 - drive_x0)
        self.assertGreater(fence_layout.PILLAR_TOP, fence_layout.POST_TOP)
        self.assertEqual(len(fence_layout.LEAVES), 4)  # two closed leaves per gate

    def test_every_gate_pillar_carries_a_lantern_of_the_garden_lights(self):
        tops = sorted((round(x, 6), round(y, 6), z) for x, y, z in (piece[2] for piece in fence_layout.PIECES))
        self.assertEqual(tops, sorted((round(p["pos"][0], 6), round(p["pos"][1], 6), fence_layout.PILLAR_TOP)
                                      for p in fence_layout.PILLARS))
        self.assertEqual({(kind, group) for kind, group, *_ in fence_layout.PIECES}, {("pillar_lamp", "Gate_lamps")})
        self.assertEqual(interact.tags(fence_layout), {"Gate_lamps": LIGHTS})

    def test_the_fence_passes_the_corner_of_the_vegetable_garden_without_touching_it(self):
        corner = (-23.0, -18.0)  # 0.6 m from the rim (siteplan/zones.py)
        nearest = min(shapes.distance(shape, corner) for _, shape in fence_layout.SHAPES)
        self.assertGreater(nearest, 0.0)
        self.assertLess(nearest, 0.5)  # and the fence does run past it


class PathsLayoutTest(unittest.TestCase):
    def test_the_shipped_paths_are_clean(self):
        self.assertEqual(layout_check.check(paths_layout), [])

    def test_it_is_an_island_wide_prop_using_the_path_zones_and_the_driveway(self):
        self.assertEqual((paths_layout.MODULE_ID, paths_layout.ROLE), ("garden_paths", "prop"))
        self.assertEqual(paths_layout.FOOTPRINT, zones.ISLAND["size"])
        self.assertEqual(sorted(paths_layout.ZONES_USED), ["driveway", "path_door", "path_gate", "path_turn"])

    def test_the_walk_runs_from_the_main_gate_up_the_path_zones_to_the_front_door(self):
        walk = paths_layout.WALK
        left, right = paths_layout.GATE_LINES["Gate_main"]
        self.assertTrue(left[0] < walk[0][0] < right[0])
        self.assertEqual(walk[-1], (6.1, 2.0))  # the foot of the front steps, under the door
        path = [zones.ZONES[name] for name in ("path_gate", "path_turn", "path_door")]
        for (x, y) in walk[1:]:
            self.assertTrue(any(x0 <= x <= x1 and y0 <= y <= y1 for (x0, y0), (x1, y1) in path), (x, y))
        for stone in paths_layout.STONES:  # on the path zones, but where the walk comes in from the gate
            x0, y0, x1, y1 = shapes.bounds(stone)
            in_zone = any(shapes.overlap(stone, shapes.box((zx0, zy0, zx1, zy1))) for (zx0, zy0), (zx1, zy1) in path)
            self.assertTrue(in_zone or y1 <= zones.ZONES["path_gate"][0][1] + 1e-6, (x0, y0, x1, y1))

    def test_slabs_lie_a_stride_apart_with_a_square_landing_at_each_turn(self):
        stones = paths_layout.STONES
        self.assertTrue(30 <= len(stones) <= 40, len(stones))
        for a, b in zip(stones, stones[1:]):
            self.assertTrue(0.15 <= shapes.gap(a, b) <= paths_layout.MAX_GAP, (a, b))
        landings = [shapes.bounds(s) for s in stones if math.isclose(shapes.bounds(s)[2] - shapes.bounds(s)[0], 1.2)
                    and math.isclose(shapes.bounds(s)[3] - shapes.bounds(s)[1], 1.2)]
        self.assertEqual([((x0 + x1) / 2, (y0 + y1) / 2) for x0, y0, x1, y1 in landings],
                         [paths_layout.WALK[1], paths_layout.WALK[2]])

    def test_the_driveway_runs_from_the_car_gate_up_its_zone_and_flares_into_an_apron_at_the_carport(self):
        (x0, _), (x1, _) = zones.ZONES["driveway"]
        carport = zones.ZONES["carport"][0][1]
        bx0, by0, bx1, by1 = shapes.bounds(paths_layout.DRIVEWAY)
        self.assertEqual((bx0, bx1), (x0, x1))
        self.assertLess(by0, -21.0)  # past the driveway zone's end, to the car gate
        self.assertGreater(by1, 0.5)  # past the last bollards (y 0), which stand by the straight driveway
        # the apron carries on from the driveway's end, widening to both of the carport's bays at the carport zone
        apron = paths_layout.APRON
        self.assertEqual(sorted(apron[:2]), [(x0, by1), (x1, by1)])
        ax0, ay0, ax1, ay1 = shapes.bounds(apron)
        self.assertEqual((ax0, ax1, ay1), (*paths_layout.APRON_X, carport))
        self.assertTrue(ax0 < x0 and x1 < ax1)
        self.assertEqual(len(paths_layout.KERBS), 4)  # up the driveway's sides and on along the apron's
        for kerb in paths_layout.KERBS:
            kx0, ky0, kx1, ky1 = shapes.bounds(kerb)
            self.assertTrue(ax0 <= kx0 < kx1 <= ax1 and ky1 <= carport, kerb)
        self.assertEqual(max(shapes.bounds(kerb)[3] for kerb in paths_layout.KERBS), carport)

    def test_the_driveway_slabs_lie_between_its_kerbs_without_sharing_a_face_with_them(self):
        # Slab and kerbs once both covered the kerbs' strips: their coplanar ends and bottoms z-fought.
        slabs, kerbs = paths_layout.DRIVEWAY_SLABS, paths_layout.KERBS
        paving = slabs + kerbs
        for i, a in enumerate(paving):
            for b in paving[i + 1:]:
                self.assertFalse(shapes.overlap(a, b), (a, b))
        for slab in slabs:
            self.assertAlmostEqual(min(shapes.gap(slab, kerb) for kerb in kerbs), 0.0)  # no grass between them
        sx0, sy0, sx1, sy1 = shapes.bounds(slabs[0])  # up the driveway, and then the apron's
        x0, y0, x1, y1 = shapes.bounds(paths_layout.DRIVEWAY)
        self.assertAlmostEqual(sx0, x0 + paths_layout.KERB)
        self.assertAlmostEqual(sx1, x1 - paths_layout.KERB)
        self.assertAlmostEqual(shapes.bounds(slabs[1])[3], shapes.bounds(paths_layout.APRON)[3])

        def area(polygon):
            return abs(sum(xa * yb - xb * ya for (xa, ya), (xb, yb) in zip(polygon, polygon[1:] + polygon[:1]))) / 2

        self.assertAlmostEqual(sum(area(piece) for piece in paving),
                               area(paths_layout.DRIVEWAY) + area(paths_layout.APRON))  # together they pave all of it
        for kerb in kerbs:  # each as wide as the next, slanted or not: KERB square to its long sides
            (a, b), (c, d) = sorted(zip(kerb, kerb[1:] + kerb[:1]), key=lambda edge: -math.dist(*edge))[:2]
            ux, uy = b[0] - a[0], b[1] - a[1]
            self.assertAlmostEqual(abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / math.hypot(ux, uy),
                                   paths_layout.KERB, places=6)

    def test_bollards_light_the_walk_and_the_driveway_and_are_garden_lights(self):
        lamps = [pos for kind, group, pos, *_ in paths_layout.PIECES if kind == "garden_lamp"]
        self.assertEqual({(kind, group) for kind, group, *_ in paths_layout.PIECES}, {("garden_lamp", "Garden_lamps")})
        walk = [shapes.band(a, b, 2.0) for a, b in zip(paths_layout.WALK, paths_layout.WALK[1:])]
        along_walk = [p for p in lamps if any(shapes.distance(band, p) == 0.0 for band in walk)]
        along_drive = [p for p in lamps if shapes.distance(paths_layout.DRIVEWAY, p) < 0.5]
        self.assertGreaterEqual(len(along_walk), 6)
        self.assertGreaterEqual(len(along_drive), 6)
        self.assertEqual(len(along_walk) + len(along_drive), len(lamps))
        self.assertEqual(interact.tags(paths_layout), {"Garden_lamps": LIGHTS})


class BedsLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.beds = importlib.import_module("garden.beds_layout")

    def kinds(self, *kinds):
        return [(kind, pos) for kind, _, pos, *_ in self.beds.PIECES if kind in kinds]

    def test_the_shipped_beds_are_clean_and_stand_on_nothing_of_the_fence_or_the_paths(self):
        self.assertEqual(layout_check.check(self.beds), [])
        self.assertIn(self.beds, layout_check.island_layouts())
        self.assertEqual(layout_check.check_island(layout_check.island_layouts()), [])

    def test_it_is_an_island_wide_prop_that_keeps_out_of_every_zone(self):
        self.assertEqual((self.beds.MODULE_ID, self.beds.ROLE), ("flower_beds", "prop"))
        self.assertEqual(self.beds.FOOTPRINT, zones.ISLAND["size"])
        self.assertTrue(self.beds.ISLAND_WIDE)
        self.assertEqual(self.beds.ZONES_USED, ())

    def bed_shapes(self):
        return [(rot, shapes.rect(pos, layout_check.footprint("flower_bed", rot)))
                for kind, _, pos, rot, *_ in self.beds.PIECES if kind == "flower_bed"]

    def test_the_beds_stand_end_to_end_in_two_or_three_borders(self):
        # Single beds dotted over the lawn read as a grid of crates from the wallpaper camera.
        borders = chains([bed for _, bed in self.bed_shapes()], BORDER_GAP)
        self.assertTrue(2 <= len(borders) <= 3, [len(border) for border in borders])
        self.assertTrue(all(len(border) >= 4 for border in borders), [len(border) for border in borders])
        self.assertLessEqual(len(self.bed_shapes()), 14)  # no more beds than the scattered ones they replace
        self.assertLessEqual(len(self.beds.PIECES), 28)

    def test_a_straight_border_runs_along_each_side_of_the_walk(self):
        (zx0, zy0), (zx1, zy1) = zones.ZONES["path_gate"]
        for side, near in (("left", lambda x: zx0 - 1.5 < x < zx0), ("right", lambda x: zx1 < x < zx1 + 1.5)):
            beds = sorted(shapes.bounds(bed) for rot, bed in self.bed_shapes()
                          if near((shapes.bounds(bed)[0] + shapes.bounds(bed)[2]) / 2))
            self.assertGreaterEqual(len(beds), 4, side)
            self.assertEqual(len({round(x0 + x1, 6) for x0, _, x1, _ in beds}), 1, side)  # in one line
            beds.sort(key=lambda b: b[1])
            for (_, _, _, top), (_, bottom, _, _) in zip(beds, beds[1:]):
                self.assertTrue(-1e-9 <= bottom - top <= BORDER_GAP, (side, top, bottom))  # end to end
            self.assertTrue(zy0 <= beds[0][1] and beds[-1][3] <= zy1, side)

    def test_a_border_runs_along_the_edge_of_the_pond_zone_outside_it(self):
        (px0, py0), (px1, py1) = zones.ZONES["pond"]
        pond = shapes.box((px0, py0, px1, py1))
        edge = [bed for _, bed in self.bed_shapes() if shapes.gap(bed, pond) <= 0.3]
        self.assertGreaterEqual(len(edge), 4)
        self.assertFalse(any(shapes.overlap(bed, pond) for bed in edge))  # the zone itself is kept for part 3
        self.assertEqual(len(chains(edge, BORDER_GAP)), 1)  # end to end along the edge

    def test_topiary_or_pots_mark_the_ends_of_every_border(self):
        dressing = [pos for kind, _, pos, *_ in self.beds.PIECES
                    if kind in ("topiary_ball", "topiary_cone", "flower_pot")]
        beds = self.bed_shapes()
        for rot, run in runs(beds):
            axis = 1 if rot == 90 else 0  # the run's direction: y for beds turned a quarter, x for the others
            others = [bed for _, bed in beds if all(bed is not member for member in run)]
            for end, edge in ((min(run, key=lambda b: shapes.bounds(b)[axis]), axis),
                              (max(run, key=lambda b: shapes.bounds(b)[axis + 2]), axis + 2)):
                bounds = shapes.bounds(end)
                tip = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
                tip[axis] = bounds[edge]  # the middle of the bed's end
                joined = any(shapes.gap(end, other) <= BORDER_GAP for other in others)  # another border goes on
                dressed = any(math.dist(tip, pos) <= 0.8 for pos in dressing)
                self.assertTrue(joined or dressed, f"the border end at {tuple(tip)} is bare")

    def test_pots_clipped_shrubs_and_palms_dress_the_gates_the_door_and_the_corners(self):
        self.assertGreaterEqual(len(self.kinds("flower_pot")), 2)
        self.assertGreaterEqual(len(self.kinds("topiary_ball", "topiary_cone")), 4)
        palms = self.kinds("palm_tall", "palm_small")
        self.assertGreaterEqual(len(palms), 4)
        left, right = paths_layout.GATE_LINES["Gate_main"]
        self.assertGreaterEqual(sum(1 for _, (x, y) in palms if math.dist((x, y), left) < 3.5
                                    or math.dist((x, y), right) < 3.5), 2)  # a palm either side of the main gate
        self.assertGreaterEqual(len({p[4]["variant"] for p in self.beds.PIECES if p[0] == "flower_bed"}), 3)

    def test_every_plant_sways_and_the_whole_garden_is_one_object(self):
        self.assertTrue(all(len(piece) > 4 and piece[4].get("wind") is True for piece in self.beds.PIECES))
        self.assertEqual({group for _, group, *_ in self.beds.PIECES}, {"Flower_beds"})
        self.assertEqual(interact.tags(self.beds), {})  # nothing to click


class VegLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.veg = importlib.import_module("garden.veg_layout")

    def kinds(self):
        return [kind for kind, *_ in self.veg.PIECES]

    def test_the_shipped_vegetable_garden_is_clean(self):
        self.assertEqual(layout_check.check(self.veg), [])

    def test_it_is_a_prop_that_fills_the_vegetables_zone(self):
        self.assertEqual((self.veg.MODULE_ID, self.veg.ROLE), ("veg_garden", "prop"))
        (x0, y0), (x1, y1) = zones.ZONES["vegetables"]
        self.assertEqual(self.veg.FOOTPRINT, (x1 - x0, y1 - y0))
        self.assertFalse(getattr(self.veg, "ISLAND_WIDE", False))

    def test_raised_beds_of_several_crops_a_tomato_trellis_and_the_tools(self):
        beds = [piece for piece in self.veg.PIECES if piece[0] == "raised_bed"]
        self.assertEqual(len(beds), 6)
        self.assertGreaterEqual(len({piece[4]["crop"] for piece in beds}), 4)
        for kind in ("tomato_trellis", "wheelbarrow", "watering_can", "compost_bin", "tool_shed"):
            self.assertIn(kind, self.kinds())

    def test_a_gravel_path_runs_between_the_two_columns_of_beds(self):
        rects = [shapes.bounds(shapes.rect(pos[:2], layout_check.footprint(kind, rot)))
                 for kind, _, pos, rot, *_ in self.veg.PIECES if kind == "raised_bed"]
        left = max(x1 for x0, _, x1, _ in rects if x1 <= 0.0)
        right = min(x0 for x0, _, x1, _ in rects if x0 >= 0.0)
        self.assertGreaterEqual(right - left, 0.6)
        x0, y0, x1, y1 = self.veg.GRAVEL
        for rect in rects:  # the beds stand on the gravel
            self.assertTrue(x0 <= rect[0] and rect[2] <= x1 and y0 <= rect[1] and rect[3] <= y1, rect)

    def test_the_corner_by_the_rim_is_left_to_the_gravel(self):
        # the zone's front-left corner is 0.6 m from the island's rim, the fence passes just outside it
        w, d = self.veg.FOOTPRINT
        corner = (-w / 2, -d / 2)
        for kind, _, pos, rot, *_ in self.veg.PIECES:
            rect = shapes.rect(pos[:2], layout_check.footprint(kind, rot))
            self.assertGreater(shapes.distance(rect, corner), 1.0, kind)

    def test_the_plants_sway_and_the_tools_stand_still(self):
        for kind, group, _, _, *opts in self.veg.PIECES:
            sways = bool(opts and opts[0].get("wind"))
            self.assertEqual(sways, kind in ("raised_bed", "tomato_trellis"), kind)
            self.assertEqual(group, "Veg_beds" if sways else "Veg_garden", kind)
        self.assertEqual(interact.tags(self.veg), {})


class BbqLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bbq = importlib.import_module("garden.bbq_layout")

    def piece(self, kind):
        return next(piece for piece in self.bbq.PIECES if piece[0] == kind)

    def test_the_shipped_barbecue_terrace_is_clean(self):
        self.assertEqual(layout_check.check(self.bbq), [])

    def test_it_is_a_prop_that_fills_the_bbq_zone(self):
        self.assertEqual((self.bbq.MODULE_ID, self.bbq.ROLE), ("bbq_area", "prop"))
        (x0, y0), (x1, y1) = zones.ZONES["bbq"]
        self.assertEqual(self.bbq.FOOTPRINT, (x1 - x0, y1 - y0))

    def test_a_teak_pergola_over_a_table_for_six_with_string_lights_under_its_slats(self):
        (px0, py0), (px1, py1) = self.bbq.PERGOLA["min"], self.bbq.PERGOLA["max"]
        kind, _, pos, rot, *_ = self.piece("dining_set_6")
        x0, y0, x1, y1 = shapes.bounds(shapes.rect(pos[:2], layout_check.footprint(kind, rot)))
        self.assertTrue(px0 < x0 and x1 < px1 and py0 < y0 and y1 < py1)
        self.assertTrue(2.2 <= self.bbq.PERGOLA["height"] <= 2.8)
        (string,) = self.bbq.STRING_LIGHTS
        for x, y, z in string["points"]:
            self.assertTrue(px0 - 1e-6 <= x <= px1 + 1e-6 and py0 - 1e-6 <= y <= py1 + 1e-6, (x, y))
            self.assertTrue(2.0 <= z < self.bbq.PERGOLA["height"], z)

    def test_the_kitchen_the_grill_the_parasol_and_planters_stand_on_the_terrace(self):
        kinds = [piece[0] for piece in self.bbq.PIECES]
        for kind in ("outdoor_kitchen", "bbq_grill", "parasol"):
            self.assertIn(kind, kinds)
        self.assertGreaterEqual(sum(1 for kind in kinds if kind in ("flower_pot", "palm_small", "monstera")), 3)
        for kind, _, pos, *_ in self.bbq.PIECES:  # but the coals, which lie in the grill's firebox
            self.assertEqual(pos[2], self.bbq.PAVING_TOP + (catalog.GRILL_COALS_Z if kind == "bbq_coals" else 0.0))

    def test_the_grill_and_its_coals_are_the_bbq_group_and_the_string_lights_are_garden_lights(self):
        # The grill is a still object that casts its shadow by day; only its coals glow (a night light of their own).
        self.assertEqual([piece[0] for piece in self.bbq.PIECES if piece[1] == "BBQ_grill"], ["bbq_grill"])
        self.assertEqual([piece[0] for piece in self.bbq.PIECES if piece[1] == "BBQ_coals"], ["bbq_coals"])
        (gx, gy, gz), (cx, cy, cz) = self.piece("bbq_grill")[2], self.piece("bbq_coals")[2]
        self.assertEqual((cx, cy, cz - gz), (gx, gy, catalog.GRILL_COALS_Z))
        self.assertIn("bbq_coals", catalog.NIGHT_KINDS)
        self.assertNotIn("bbq_grill", catalog.NIGHT_KINDS)
        self.assertEqual(interact.tags(self.bbq), {"BBQ_grill": BBQ, "BBQ_coals": BBQ, "String_lights_bbq": LIGHTS})

    def test_the_string_lights_hang_globes_that_read_from_the_wallpaper(self):
        (string,) = self.bbq.STRING_LIGHTS
        self.assertTrue(0.08 <= string["bulb_radius"] <= 0.1, string["bulb_radius"])  # festoon bulbs were 0.05 m

    def test_nothing_tall_stands_between_the_grill_and_the_wallpaper_camera(self):
        # the idle camera looks from the front-right (siteplan/zones.CAMERAS): the grill must show and be clickable
        _, _, (gx, gy, _), _, *_ = self.piece("bbq_grill")
        for kind, _, (x, y, _), *_ in self.bbq.PIECES:
            if kind not in ("bbq_grill", "bbq_coals") and x > gx - 0.5 and y < gy and math.dist((x, y), (gx, gy)) < 3.0:
                self.assertLessEqual(layout_check.FURNITURE[kind][2], 1.0, kind)


class GardenLightsTest(unittest.TestCase):
    """The garden lights must read at 21:00: a pool of warm light (GLOW_pool, garden/lights.py) on the ground under
    every lamp, merged into the lamp's object; the groups too flat or too small for a shadow worth drawing cast none."""

    @classmethod
    def setUpClass(cls):
        cls.lights = importlib.import_module("garden.lights")

    def test_every_lamp_has_its_pool_on_the_ground_under_it_in_its_object(self):
        for layout in (fence_layout, paths_layout):
            lamps = sorted((group, kind, round(pos[0], 6), round(pos[1], 6)) for kind, group, pos, *_ in layout.PIECES
                           if kind in self.lights.POOL_RADIUS)
            self.assertTrue(lamps, layout.MODULE_ID)
            pools = sorted((p["group"], p["kind"], round(p["center"][0], 6), round(p["center"][1], 6))
                           for p in layout.POOLS)
            self.assertEqual(pools, lamps, layout.MODULE_ID)
            for pool in layout.POOLS:
                self.assertEqual(pool["radius"], self.lights.POOL_RADIUS[pool["kind"]])
        self.assertTrue(0.02 <= self.lights.POOL_Z <= 0.03)

    def test_a_bollard_lights_a_disc_and_a_gate_lantern_the_half_inside_the_fence(self):
        # 1.6 and 2.2 m across, and 2 m round the stone lantern of the tea corner (part 3)
        self.assertEqual(self.lights.POOL_RADIUS, {"garden_lamp": 0.8, "pillar_lamp": 1.1, "stone_lantern": 1.0})
        for pool in paths_layout.POOLS:
            self.assertAlmostEqual(pool["sweep"], 2 * math.pi)
        for pool in fence_layout.POOLS:
            self.assertAlmostEqual(pool["sweep"], math.pi)
            middle = pool["start"] + pool["sweep"] / 2
            x, y = pool["center"]
            inward = (x + math.cos(middle), y + math.sin(middle))
            self.assertTrue(island.contains(fence_layout.LINE, inward), pool)  # towards the lawn, not the void

    def test_the_pools_stay_on_the_island(self):
        for layout in (fence_layout, paths_layout):
            for pool in layout.POOLS:
                self.assertTrue(shapes.inside_rim(self.lights.outline(pool), RIM), pool)

    def test_a_pool_off_the_island_is_a_layout_problem(self):
        x, y = fence_layout.PILLARS[0]["pos"]
        layout = site(PIECES=[("garden_lamp", "Lamps", (-5.0, -10.0), 0)],
                      POOLS=[self.lights.pool("Lamps", "garden_lamp", (x, y))])
        self.assertEqual(layout_check.check(layout), ["Lamps pool 1 is outside the island"])
        lone = plot(PIECES=[("garden_lamp", "Lamps", (3.6, 0.0), 0)],
                    POOLS=[self.lights.pool("Lamps", "garden_lamp", (3.6, 0.0))])
        self.assertEqual(layout_check.check(lone), ["Lamps pool 1 sticks out of the 8 x 6 m footprint"])

    def test_flat_and_small_groups_cast_no_shadow(self):
        beds, veg = importlib.import_module("garden.beds_layout"), importlib.import_module("garden.veg_layout")
        self.assertEqual(beds.SHADOWLESS, ("Flower_beds",))
        self.assertEqual(veg.SHADOWLESS, ("Veg_beds",))
        for layout in (beds, veg):
            self.assertLessEqual(set(layout.SHADOWLESS), {group for _, group, *_ in layout.PIECES})


class IslandChecksTest(unittest.TestCase):
    def test_the_island_wide_layouts_are_clean_together(self):
        self.assertEqual(layout_check.check_island(layout_check.island_layouts()), [])
        self.assertLessEqual({fence_layout, paths_layout}, set(layout_check.island_layouts()))

    def test_what_one_module_builds_may_not_stand_on_what_another_does(self):
        x0, y0, x1, y1 = shapes.bounds(paths_layout.STONES[4])
        bed = site(PIECES=[("flower_pot", "Pots", ((x0 + x1) / 2, (y0 + y1) / 2), 0)])
        self.assertEqual(layout_check.check_island([paths_layout, bed]),
                         ["stone 5 (garden_paths) overlaps Pots #1 (flower_pot) (test)"])

    def test_every_gate_leads_to_a_path_of_its_kind(self):
        gates = fence_layout.GATES + ({"name": "Gate_side", "kind": "walk", "x": (-20.0, -18.0), "top": 1.1},)
        self.assertEqual(layout_check.check_island([copy(fence_layout, GATES=gates), paths_layout]),
                         ["gate Gate_side leads to no path"])
        swapped = copy(paths_layout, WALK_GATE="Gate_car", DRIVE_GATE="Gate_main")
        self.assertEqual(layout_check.check_island([fence_layout, swapped]), [
            "the walk comes in through Gate_car, which is not a walk gate of the fence",
            "the driveway comes in through Gate_main, which is not a car gate of the fence",
        ])


class GardenCheckRulesTest(unittest.TestCase):
    def test_a_minimal_layout_is_clean(self):
        self.assertEqual(layout_check.check(site()), [])
        self.assertEqual(layout_check.check(plot()), [])

    def test_pieces_are_known_kinds_at_catalog_rotations_and_only_plants_sway(self):
        pieces = [("gazebo", "Things", (-5.0, -10.0), 0), ("flower_pot", "Pots", (-3.0, -10.0), 45),
                  ("wheelbarrow", "Tools", (-7.0, -10.0), 0, {"wind": True}),
                  ("flower_pot", "Pots", (-3.0, -12.0), 0, {"wind": True})]
        self.assertEqual(layout_check.check(site(PIECES=pieces)), [
            "Things #1: unknown kind 'gazebo'",
            "Pots #1 (flower_pot): rotation must be one of [0, 90, 180, 270], got 45",
            f"Tools #1: wheelbarrow does not sway, wind is for {sorted(layout_check.WIND_SPANS)}",
        ])

    def test_lights_and_what_a_click_toggles_keep_to_their_own_groups(self):
        pieces = [("garden_lamp", "Lamps", (-5.0, -10.0), 0), ("flower_pot", "Lamps", (-3.0, -10.0), 0),
                  ("garden_lamp", "Hot", (-7.0, -14.0), 0), ("bbq_coals", "Hot", (-5.0, -14.0), 0)]
        self.assertEqual(layout_check.check(site(PIECES=pieces)), [
            "group Lamps mixes lights (garden_lamp) with pieces that do not glow (flower_pot)",
            "group Lamps mixes what a click toggles (lights:garden) with other pieces",
            "group Hot mixes what a click toggles (bbq, lights:garden) with other pieces",
        ])

    def test_pieces_and_shapes_on_the_ground_may_not_overlap_unless_the_shapes_meet(self):
        pieces = [("flower_pot", "Pots", (-5.0, -10.0), 0), ("flower_pot", "Pots", (-4.7, -10.0), 0),
                  ("pillar_lamp", "Lamps", (-5.0, -10.0, 1.0), 0)]  # raised onto something: it takes no ground
        shaped = [("slab", shapes.rect((-5.0, -12.0), (1.0, 1.0))), ("post", shapes.rect((-4.6, -12.0), (0.2, 0.2)))]
        self.assertEqual(layout_check.check(site(PIECES=pieces, SHAPES=shaped)), [
            "Pots #1 (flower_pot) overlaps Pots #2 (flower_pot)", "slab overlaps post"])
        self.assertEqual(layout_check.check(site(SHAPES=shaped, SHAPES_MEET=True)), [])
        on_slab = [("flower_pot", "Pots", (-5.0, -12.0), 0)]
        self.assertEqual(layout_check.check(site(PIECES=on_slab, SHAPES=shaped, SHAPES_MEET=True)), [
            "Pots #1 (flower_pot) overlaps slab"])

    def test_island_wide_pieces_stay_on_the_island_out_of_unused_zones_and_off_the_trees_and_the_lamp(self):
        tree = zones.TREES[0]
        pieces = [("flower_pot", "Pots", (0.0, 8.0), 0), ("flower_pot", "Pots", (26.9, 0.0), 0),
                  ("flower_pot", "Pots", (tree[0] + 0.5, tree[1]), 0),
                  ("flower_pot", "Pots", (zones.LAMP[0], zones.LAMP[1] - 0.6), 0)]
        self.assertEqual(layout_check.check(site(PIECES=pieces)), [
            "Pots #1 (flower_pot) is in zone 'house'",
            "Pots #2 (flower_pot) is outside the island",
            f"Pots #3 (flower_pot) is closer than 0.35 m to the tree at ({tree[0]:g}, {tree[1]:g})",
            f"Pots #4 (flower_pot) is closer than 0.35 m to the lamp at ({zones.LAMP[0]:g}, {zones.LAMP[1]:g})",
        ])
        self.assertEqual(layout_check.check(site(PIECES=pieces[:1], ZONES_USED=("house",))), [])
        for reserved in ("pond", "tea", "carport", "kennel"):  # the zones of parts 3 and 4
            (x0, y0), (x1, y1) = zones.ZONES[reserved]
            inside = [("flower_pot", "Pots", ((x0 + x1) / 2, (y0 + y1) / 2), 0)]
            self.assertEqual(layout_check.check(site(PIECES=inside)), [f"Pots #1 (flower_pot) is in zone '{reserved}'"])

    def test_zoned_pieces_stay_inside_the_footprint_raised_ones_too(self):
        pieces = [("flower_pot", "Pots", (3.9, 0.0), 0), ("pillar_lamp", "Lamps", (0.0, 2.95, 1.0), 0),
                  ("flower_pot", "Pots", (0.0, -10.0), 0)]  # far outside: module space knows no zones or rim
        self.assertEqual(layout_check.check(plot(PIECES=pieces)), [
            "Pots #1 (flower_pot) sticks out of the 8 x 6 m footprint",
            "Pots #2 (flower_pot) sticks out of the 8 x 6 m footprint",
            "Lamps #1 (pillar_lamp) sticks out of the 8 x 6 m footprint",
        ])

    def test_a_parasol_shades_what_stands_under_it(self):
        under = [("parasol", "Terrace", (0.0, 0.0), 0), ("rattan_armchair", "Terrace", (0.5, 0.5), 0)]
        self.assertEqual(layout_check.check(plot(PIECES=under)), [])
        crowded = under + [("rattan_armchair", "Terrace", (0.9, 0.5), 0)]
        self.assertEqual(layout_check.check(plot(PIECES=crowded)), [
            "Terrace #2 (rattan_armchair) overlaps Terrace #3 (rattan_armchair)"])

    def test_a_floor_under_a_piece_is_still_the_ground_but_a_piece_raised_onto_another_takes_none(self):
        floor = [("flower_pot", "Pots", (0.0, 0.0, 0.05), 0), ("flower_pot", "Pots", (0.3, 0.0, 0.05), 0)]
        self.assertEqual(layout_check.check(plot(PIECES=floor)), ["Pots #1 (flower_pot) overlaps Pots #2 (flower_pot)"])
        stacked = [("compost_bin", "Bins", (0.0, 0.0), 0), ("watering_can", "Bins", (0.0, 0.0, 0.9), 0)]
        self.assertEqual(layout_check.check(plot(PIECES=stacked)), [])

    def test_string_lights_hang_from_anchors_inside_the_footprint(self):
        strings = [{"name": "String_lights_x", "points": [(-3.0, 0.0, 2.3), (4.5, 0.0, 2.3)]}]
        self.assertEqual(layout_check.check(plot(STRING_LIGHTS=strings)), [
            "String_lights_x anchor 2 sticks out of the 8 x 6 m footprint"])
        self.assertEqual(interact.tags(plot(STRING_LIGHTS=strings)), {"String_lights_x": LIGHTS})

    def test_the_walk_runs_without_a_gap_from_its_gate_to_the_door(self):
        stones = paths_layout.STONES
        missing = copy(paths_layout, STONES=stones[:5] + stones[6:], SHAPES=[])
        self.assertEqual(len(layout_check.check(missing)), 1)
        self.assertRegex(layout_check.check(missing)[0],
                         r"^walk: 1\.\d\d m of grass between stones 5 and 6, more than 0\.45 m$")
        late = copy(paths_layout, STONES=stones[2:], SHAPES=[])
        self.assertRegex(" ".join(layout_check.check(late)), r"walk: the first stone is 1\.\d\d m from Gate_main")
        short = copy(paths_layout, STONES=stones[:-1], SHAPES=[])
        self.assertEqual(layout_check.check(short), ["walk: the last stone does not reach the door at (6.1, 2)"])

    def test_the_driveway_starts_at_its_gate_and_reaches_the_carport(self):
        front = [(x, y + 1.0) for x, y in paths_layout.DRIVEWAY[:2]]
        late = copy(paths_layout, DRIVEWAY=front + paths_layout.DRIVEWAY[2:], SHAPES=[])
        self.assertRegex(" ".join(layout_check.check(late)), r"driveway: its front is 1\.\d\d m from Gate_car")
        short = copy(paths_layout, APRON=paths_layout.APRON[:2] + [(19.0, 2.0), (15.0, 2.0)], SHAPES=[])
        self.assertIn("driveway: it stops short of the carport zone (y 3)", layout_check.check(short))
        apart = copy(paths_layout, APRON=[(x, y + 0.5) for x, y in paths_layout.APRON], SHAPES=[])
        self.assertIn("driveway: its apron does not start at its end", layout_check.check(apart))


class ShapesTest(unittest.TestCase):
    def test_overlap_is_for_interiors_only(self):
        a = shapes.rect((0.0, 0.0), (1.0, 1.0))
        self.assertTrue(shapes.overlap(a, shapes.rect((0.9, 0.0), (1.0, 1.0))))
        self.assertFalse(shapes.overlap(a, shapes.rect((1.0, 0.0), (1.0, 1.0))))  # sharing an edge
        diamond = shapes.square((1.2, 1.2), 1.0, math.pi / 4)  # its corner points at a's corner, 0.2 m short of it
        self.assertFalse(shapes.overlap(a, diamond))
        self.assertTrue(shapes.overlap(a, shapes.band((-1.0, 0.45), (1.0, 0.45), 0.1)))

    def test_distances_and_the_rim(self):
        a = shapes.rect((0.0, 0.0), (1.0, 1.0))
        self.assertEqual(shapes.distance(a, (0.2, 0.2)), 0.0)
        self.assertAlmostEqual(shapes.distance(a, (1.5, 0.0)), 1.0)
        self.assertAlmostEqual(shapes.gap(a, shapes.rect((2.0, 0.0), (1.0, 1.0))), 1.0)
        self.assertTrue(shapes.inside_rim(shapes.rect((0.0, 0.0), (2.0, 2.0)), RIM))
        self.assertFalse(shapes.inside_rim(shapes.rect((26.8, 0.0), (1.0, 1.0)), RIM))


if __name__ == "__main__":
    unittest.main()

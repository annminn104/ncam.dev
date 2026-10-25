"""Villa v2 part 4: the carport layout (carport/carport_layout.py), its checks (carport/layout_check.py) and what a
click toggles there (carport/interact.py). Pure Python."""
import math
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit import catalog  # noqa: E402
from garden import paths_layout, shapes  # noqa: E402
from siteplan import zones  # noqa: E402
from carport import carport_layout, interact, layout_check  # noqa: E402

LIGHTS = {"interact": "lights:carport", "label": "Đèn nhà xe"}
PICKUP = {"interact": "lights:car_pickup", "label": "Đèn xe bán tải"}
SUPERCAR = {"interact": "lights:car_super", "label": "Đèn siêu xe"}


def copy(layout, **overrides):
    """The layout module's data as a namespace, with some of it changed."""
    data = {key: getattr(layout, key) for key in dir(layout) if key.isupper()}
    data.update(overrides)
    return types.SimpleNamespace(**data)


def car_shape(car):
    """The rectangle a car of the layout takes of the floor (module space)."""
    return shapes.rect(car["pos"], catalog.footprint(car["kind"], car["rot"]))


def moved(layout, name, pos):
    return copy(layout, CARS=[dict(car, pos=pos) if car["name"] == name else car for car in layout.CARS])


class CarportLayoutTest(unittest.TestCase):
    L = carport_layout

    def test_the_shipped_carport_is_clean_in_its_footprint_and_on_the_site(self):
        self.assertEqual(layout_check.check_carport(self.L), [])
        self.assertEqual(layout_check.check_carport_site(self.L), [])

    def test_the_carport_is_a_prop_filling_its_zone(self):
        self.assertEqual((self.L.MODULE_ID, self.L.ROLE, self.L.ZONE), ("carport", "prop", "carport"))
        (x0, y0), (x1, y1) = zones.ZONES[self.L.ZONE]
        self.assertEqual(self.L.FOOTPRINT, (x1 - x0, y1 - y0))
        self.assertEqual(layout_check.site_origin(self.L), ((x0 + x1) / 2, (y0 + y1) / 2))

    def test_two_cars_a_pickup_and_a_supercar_each_with_its_own_lights(self):
        self.assertEqual([(car["kind"], car["name"], car["lights"]) for car in self.L.CARS],
                         [("pickup_truck", "Pickup", "Pickup_lights"),
                          ("convertible_supercar", "Supercar", "Supercar_lights")])
        for car in self.L.CARS:
            self.assertEqual(car["rot"], 0, car["name"])  # nose out, its headlights towards the driveway (-Y)

    def test_each_car_parks_in_its_bay_with_room_either_side_and_clear_of_the_posts(self):
        self.assertEqual(len(self.L.BAYS), len(self.L.CARS))
        structure = [shape for _, shape in layout_check.structure(self.L)]
        for car, bay in zip(self.L.CARS, self.L.BAYS):
            x0, y0, x1, y1 = shapes.bounds(car_shape(car))
            (bx0, by0), (bx1, by1) = bay["min"], bay["max"]
            self.assertTrue(by0 <= y0 and y1 <= by1, car["name"])
            self.assertGreaterEqual(x0 - bx0, layout_check.SIDE_CLEAR, car["name"])
            self.assertGreaterEqual(bx1 - x1, layout_check.SIDE_CLEAR, car["name"])
            self.assertGreaterEqual(layout_check.SIDE_CLEAR, 0.5)
            for shape in structure:
                self.assertFalse(shapes.overlap(car_shape(car), shape), car["name"])
        (_, _), (west_end, _) = self.L.BAYS[0]["min"], self.L.BAYS[0]["max"]
        self.assertLessEqual(west_end, self.L.BAYS[1]["min"][0])  # the bays side by side, not overlapping

    def test_the_structure_holds_the_roof_posts_on_the_far_side_a_pillar_and_the_wall_on_the_house_side(self):
        labels = [label for label, _ in layout_check.structure(self.L)]
        self.assertIn("pillar", labels)
        self.assertIn("back wall", labels)
        posts = [shape for label, shape in layout_check.structure(self.L) if label.startswith("post")]
        self.assertGreaterEqual(len(posts), 2)
        for post in posts:  # thin steel posts on the east side, away from the house
            x0, _, x1, _ = shapes.bounds(post)
            self.assertGreater(x0, 0.4 * self.L.FOOTPRINT[0])
            self.assertLessEqual(x1 - x0, 0.15)
        x0, _, x1, _ = shapes.bounds(dict(layout_check.structure(self.L))["pillar"])
        self.assertLess(x1, -0.4 * self.L.FOOTPRINT[0])  # the house side

    def test_everything_stays_inside_the_footprint(self):
        w, d = self.L.FOOTPRINT
        (rx0, ry0), (rx1, ry1) = self.L.ROOF["min"], self.L.ROOF["max"]
        self.assertTrue(-w / 2 <= rx0 and rx1 <= w / 2 and -d / 2 <= ry0 and ry1 <= d / 2)
        out = copy(self.L, POSTS=[(w / 2, 0.0)] + list(self.L.POSTS[1:]))
        self.assertIn("post 1 sticks out of the 8 x 7 m footprint", layout_check.check_carport(out))

    def test_a_car_in_a_post_or_too_close_to_the_side_of_its_bay_is_a_problem(self):
        pickup, supercar = self.L.CARS
        x0, y0, x1, y1 = shapes.bounds(car_shape(pickup))
        bay = self.L.BAYS[0]
        near = moved(self.L, "Pickup", (bay["min"][0] + (x1 - x0) / 2 + 0.3, pickup["pos"][1]))
        self.assertIn("Pickup is 0.30 m from the west side of its bay, less than 0.5 m",
                      layout_check.check_carport(near))
        post = self.L.POSTS[1]
        into = moved(self.L, "Supercar", (post[0] - 0.9, post[1]))
        problems = layout_check.check_carport(into)
        self.assertIn("Supercar overlaps post 2", problems)
        self.assertIn("Supercar sticks out of its bay", problems)

    def test_the_cars_stand_under_the_roof(self):
        (rx0, ry0), (rx1, ry1) = self.L.ROOF["min"], self.L.ROOF["max"]
        for car in self.L.CARS:
            x0, y0, x1, y1 = shapes.bounds(car_shape(car))
            self.assertTrue(rx0 < x0 and x1 < rx1 and ry0 < y0 and y1 < ry1, car["name"])
            w, d, h = catalog.FURNITURE[car["kind"]]
            self.assertGreater(layout_check.heights(self.L)["lowest"], self.L.SLAB_TOP + h + 0.4,
                               car["name"])  # room over the roof bars

    def test_the_roof_and_its_beam_keep_clear_of_the_house(self):
        self.assertGreaterEqual(layout_check.house_gap(self.L), layout_check.HOUSE_CLEAR)
        self.assertGreater(layout_check.HOUSE_CLEAR, 0.0)
        house = zones.SLOTS["house_01"]
        east_wall = house["pos"][0] + house["footprint"][0] / 2
        ox, _ = layout_check.site_origin(self.L)
        self.assertLess(ox + self.L.ROOF["min"][0] - east_wall, 3.0)  # close to the house's east wall
        closer = copy(self.L, ROOF=dict(self.L.ROOF, min=(-4.0 - 1.5, self.L.ROOF["min"][1])))
        problems = layout_check.check_carport_site(closer)
        self.assertIn("the carport comes within 0.50 m of the house, less than 1 m", problems)

    def test_the_driveway_ends_on_the_carport_slab_flush_with_it(self):
        ox, oy = layout_check.site_origin(self.L)
        x0, y0, x1, y1 = self.L.SLAB
        dx0, dy0, dx1, dy1 = shapes.bounds(paths_layout.APRON)  # the driveway's end, flared out to the bays
        self.assertAlmostEqual(oy + y0, dy1)  # the slab's front edge is the driveway's end
        self.assertTrue(ox + x0 < dx0 and dx1 < ox + x1)  # across the whole width of it
        self.assertEqual(self.L.SLAB_TOP, paths_layout.DRIVEWAY_TOP)
        short = copy(self.L, SLAB=(x0, y0 + 0.2, x1, y1))
        self.assertIn("the driveway ends 0.20 m short of the carport's slab", layout_check.check_carport_site(short))
        narrow = copy(self.L, SLAB=(dx0 - ox + 0.5, y0, x1, y1))
        self.assertIn("the carport's slab does not reach across the driveway's end",
                      layout_check.check_carport_site(narrow))
        step = copy(self.L, SLAB_TOP=0.08)
        self.assertIn("the carport's slab is not flush with the driveway (0.08 m, the driveway 0.04 m)",
                      layout_check.check_carport_site(step))

    def test_each_car_drives_out_onto_the_driveways_apron(self):
        # the straight driveway (x 15-19) met only a metre of the pickup's bay: its apron flares out to both bays
        ox, oy = layout_check.site_origin(self.L)
        ax0, _, ax1, end = shapes.bounds(paths_layout.APRON)
        self.assertAlmostEqual(end, oy + self.L.SLAB[1])
        for car in self.L.CARS:
            x0, _, x1, _ = shapes.bounds(car_shape(car))
            self.assertTrue(ax0 <= ox + x0 and ox + x1 <= ax1, (car["name"], ox + x0, ox + x1))

    def test_the_roof_keeps_clear_of_the_yards_trees(self):
        ox, oy = layout_check.site_origin(self.L)
        (rx0, ry0), (rx1, ry1) = self.L.ROOF["min"], self.L.ROOF["max"]
        roof = shapes.box((ox + rx0, oy + ry0, ox + rx1, oy + ry1))
        for tree in zones.TREES:
            self.assertGreaterEqual(shapes.distance(roof, tree), layout_check.TREE_CLEAR, tree)
        wide = copy(self.L, ROOF=dict(self.L.ROOF, max=(4.0 + 1.0, self.L.ROOF["max"][1])))
        self.assertTrue(any("tree at (22, 6)" in problem for problem in layout_check.check_carport_site(wide)))

    def test_the_roof_is_a_glass_sheet_over_teak_louvres_in_a_white_fascia_on_beams_carrying_the_downlights(self):
        found = layout_check.heights(self.L)
        roof = self.L.ROOF
        self.assertTrue(roof["under"] < found["slats"] < found["glass"] < roof["top"], found)  # inside the fascia
        self.assertLess(found["beams"], found["slats"])
        self.assertGreater(self.L.LOUVRES["slats"] * self.L.LOUVRES["slat"], 0.4 * self.L.FOOTPRINT[0])

    def test_downlights_under_the_beams_pool_their_light_on_the_slab_between_the_cars(self):
        self.assertGreaterEqual(len(self.L.DOWNLIGHTS), 2)
        x0, y0, x1, y1 = self.L.SLAB
        (rx0, ry0), (rx1, ry1) = self.L.ROOF["min"], self.L.ROOF["max"]
        cars = [car_shape(car) for car in self.L.CARS]
        for x, y in self.L.DOWNLIGHTS:
            self.assertTrue(rx0 < x < rx1 and ry0 < y < ry1)
            self.assertIn(y, self.L.BEAMS["ys"])
            self.assertFalse(any(shapes.distance(car, (x, y)) == 0.0 for car in cars))  # over the aisle
        self.assertEqual([pool["center"] for pool in self.L.POOLS], list(self.L.DOWNLIGHTS))
        for pool in self.L.POOLS:
            self.assertEqual(pool["group"], self.L.LIGHTS)
        self.assertEqual(layout_check.check_carport(self.L), [])
        spill = copy(self.L, POOLS=[dict(self.L.POOLS[0], center=(x1 - 0.2, 0.0))])
        self.assertIn(f"{self.L.LIGHTS} pool 1 spills off the slab", layout_check.check_carport(spill))

    def test_each_cars_headlights_pool_their_light_on_the_ground_ahead_of_its_nose(self):
        from siteplan import island
        pools = layout_check.car_pools(self.L)
        self.assertEqual([pool["group"] for pool in pools], [car["lights"] for car in self.L.CARS])
        ox, oy = layout_check.site_origin(self.L)
        rim = island.outline(zones.ISLAND)
        house = zones.SLOTS["house_01"]
        walls = shapes.rect(house["pos"], house["footprint"])
        for car, pool in zip(self.L.CARS, pools):
            x0, y0, x1, y1 = shapes.bounds(car_shape(car))
            self.assertAlmostEqual(pool["center"][0], car["pos"][0])
            self.assertAlmostEqual(pool["center"][1], y0, delta=0.1)  # at its nose
            self.assertAlmostEqual(pool["sweep"], math.pi)  # the half ahead of it, towards -Y
            self.assertAlmostEqual(pool["start"], -math.pi)
            self.assertGreaterEqual(pool["radius"], 1.0)
            outline = [(ox + x, oy + y) for x, y in layout_check.lights.outline(pool)]
            self.assertTrue(shapes.inside_rim(outline, rim), car["name"])
            self.assertEqual(shapes.gap(outline, walls) > 0.0, True, car["name"])
        self.assertEqual(layout_check.check_carport(self.L), [])  # off the slab, ahead of the cars: no spill

    def test_the_headlights_pools_lie_just_over_the_driveways_kerbs(self):
        # they reach over the kerbs along the driveway's sides: a pool under the kerbs' top shows them as dark stripes
        self.assertTrue(paths_layout.KERB_TOP < self.L.HEADLIGHT_POOL_TOP < paths_layout.KERB_TOP + 0.02,
                        self.L.HEADLIGHT_POOL_TOP)
        low = copy(self.L, HEADLIGHT_POOL_TOP=paths_layout.KERB_TOP - 0.01)
        self.assertIn("the headlights' pools lie under the driveway's kerbs (0.06 m, the kerbs 0.07 m)",
                      layout_check.check_carport_site(low))

    def test_a_click_on_the_carport_or_a_car_switches_its_lights(self):
        self.assertEqual(interact.tags(self.L), {
            "Carport": LIGHTS, "Carport_lights": LIGHTS,
            "Pickup": PICKUP, "Pickup_lights": PICKUP,
            "Supercar": SUPERCAR, "Supercar_lights": SUPERCAR,
        })
        for props in interact.tags(self.L).values():
            self.assertRegex(props["interact"], interact.GROUP_RE)


if __name__ == "__main__":
    unittest.main()

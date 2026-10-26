import importlib
import math
import os
import sys
import types
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
# The package cannot be called `site`: the standard library's site module is always imported first and shadows it.
from houses import house_layout, pool_layout  # noqa: E402
from houses.house_parts import common  # noqa: E402
from siteplan import island, zones, zones_check  # noqa: E402

# A smooth (unjittered) island around the 20 x 10 m test yard, roomy enough to hold the whole yard.
ISLAND = {"size": (26.0, 16.0), "exponent": 4.0, "rim": 48, "jitter": 0.0, "seed": 1, "depth": 6.0}


def site(**overrides):
    """A 20 x 10 m yard with a 12 x 4 m house zone (the house fills it) and a 6 x 3 m pond zone in front of it."""
    base = {
        "YARD": (20.0, 10.0),
        "ISLAND": ISLAND,
        "ZONES": {"house": ((-6.0, 0.0), (6.0, 4.0)), "pond": ((2.0, -4.0), (8.0, -1.0))},
        "SLOTS": {"house_01": {"module": "house", "zone": "house", "pos": (0.0, 2.0), "yaw": 0.0,
                               "footprint": (12.0, 4.0)}},
        "TREES": [(-8.0, 3.0)],
        "LAMP": (-3.0, -3.0),
    }
    base.update(overrides)
    return types.SimpleNamespace(**base)


def pond_slot(yaw, footprint=(4.0, 2.9)):
    """The pond in the middle of its 6 x 3 m zone, turned by `yaw` degrees."""
    slots = dict(site().SLOTS)
    slots["pond_01"] = {"module": "pond", "zone": "pond", "pos": (5.0, -2.5), "yaw": yaw, "footprint": footprint}
    return site(SLOTS=slots)


class ZonesCheckTest(unittest.TestCase):
    def test_shipped_zones_are_clean(self):
        self.assertEqual(zones_check.check(zones), [])

    def test_shipped_zones_are_the_yard_zones_and_slots_of_the_spec(self):
        self.assertEqual(zones.YARD, (48.0, 40.0))
        self.assertEqual(sorted(zones.ZONES), sorted([
            "house", "pool", "pond", "tea", "carport", "driveway", "bbq", "vegetables", "kennel", "path_gate",
            "path_turn", "path_door", "lightwell",
        ]))
        self.assertEqual(zones.ZONES["house"], ((-13.0, 2.0), (10.0, 17.0)))  # the tall house, 23 x 15 m
        self.assertEqual(zones.ZONES["lightwell"], ((-7.5, -2.0), (-1.5, 2.0)))  # the basement's light well
        self.assertEqual(zones.ZONES["kennel"], ((20.5, 11.0), (23.5, 14.0)))
        self.assertEqual(zones.ZONES["tea"], ((4.0, -6.5), (10.0, -3.0)))  # up to the walk's turn (part 3)
        self.assertEqual(zones.SLOTS, {
            "house_01": {"module": "house", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0, "footprint": (23.0, 15.0)},
            "pool_01": {"module": "pool", "zone": "pool", "pos": (-14.0, -2.0), "yaw": 0.0, "footprint": (12.0, 7.0)},
            # the koi pond and the tea corner by it (part 3), each filling its zone
            "koi_pond_01": {"module": "koi_pond", "zone": "pond", "pos": (9.0, -11.0), "yaw": 0.0,
                            "footprint": (11.0, 8.0)},
            "tea_garden_01": {"module": "tea_garden", "zone": "tea", "pos": (7.0, -4.75), "yaw": 0.0,
                              "footprint": (6.0, 3.5)},
            # the garden (part 2): three modules spread over the whole island, two in their zones
            "fence_01": {"module": "fence", "zone": "island", "pos": (0.0, 0.0), "yaw": 0.0, "footprint": (54.0, 46.0)},
            "garden_paths_01": {"module": "garden_paths", "zone": "island", "pos": (0.0, 0.0), "yaw": 0.0,
                                "footprint": (54.0, 46.0)},
            "flower_beds_01": {"module": "flower_beds", "zone": "island", "pos": (0.0, 0.0), "yaw": 0.0,
                               "footprint": (54.0, 46.0)},
            "veg_garden_01": {"module": "veg_garden", "zone": "vegetables", "pos": (-19.0, -14.0), "yaw": 0.0,
                              "footprint": (8.0, 8.0)},
            "bbq_area_01": {"module": "bbq_area", "zone": "bbq", "pos": (-19.0, 6.0), "yaw": 0.0,
                            "footprint": (8.0, 6.0)},
            # the carport and the dog's corner (part 4), each filling its zone
            "carport_01": {"module": "carport", "zone": "carport", "pos": (16.0, 6.5), "yaw": 0.0,
                           "footprint": (8.0, 7.0)},
            "kennel_01": {"module": "kennel", "zone": "kennel", "pos": (22.0, 12.5), "yaw": 0.0,
                          "footprint": (3.0, 3.0)},
            # the basement under the tall house, in the house's zone and place (art/README.md, Basement)
            "basement_01": {"module": "basement", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0,
                            "footprint": (23.0, 15.0)},
            # the house's curtains and accessories, in its zone and place too (art/README.md, Interior)
            "interior_01": {"module": "interior", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0,
                            "footprint": (23.0, 15.0)},
        })
        self.assertEqual(zones.ZONE_SHARED, {"basement_01": "house_01", "interior_01": "house_01"})
        self.assertTrue(5 <= len(zones.TREES) <= 7)
        self.assertEqual(len(zones.LAMP), 2)

    def test_the_light_well_zone_lies_on_the_lawn_in_front_of_the_house_between_the_pool_and_the_walk(self):
        # Seen from the wallpaper camera (front right): in front of the living room's tall glass, off the pool's zone
        # and the walk's, its back edge on the house zone's front, where the basement's front wall stands below.
        (x0, y0), (x1, y1) = zones.ZONES["lightwell"]
        (hx0, hy0), (hx1, _hy1) = zones.ZONES["house"]
        self.assertEqual(y1, hy0)
        self.assertTrue(hx0 < x0 < x1 < hx1)
        self.assertGreater(x0, zones.ZONES["pool"][1][0])
        self.assertLess(x1, zones.ZONES["path_gate"][0][0])
        self.assertLess(x1, zones.ZONES["path_turn"][0][0])
        lx, ly = zones.LAMP
        self.assertFalse(x0 <= lx <= x1 and y0 <= ly <= y1)  # the lamp moved off it
        self.assertGreaterEqual(math.dist(zones.LAMP, (-3.5, 0.5)), 2.0)

    def test_the_yard_stands_on_a_floating_island_a_little_bigger_than_the_yard(self):
        # 52 x 44 m (the first guess) leaves the vegetable garden's corner (-23, -18) outside a squircle of exponent 4.
        self.assertEqual(zones.ISLAND["size"], (54.0, 46.0))
        self.assertEqual(zones.ISLAND["exponent"], 4.0)
        self.assertEqual(zones.ISLAND["rim"], 64)
        self.assertTrue(15.0 <= zones.ISLAND["depth"] <= 16.0)
        self.assertTrue(0.0 < zones.ISLAND["jitter"] <= 0.02)
        self.assertIsInstance(zones.ISLAND["seed"], int)

    def test_house_and_pool_slots_have_the_footprints_of_their_modules(self):
        self.assertEqual(zones.SLOTS["house_01"]["footprint"], house_layout.FOOTPRINT)
        self.assertEqual(zones.SLOTS["pool_01"]["footprint"], pool_layout.FOOTPRINT)

    def test_the_basement_slot_is_the_house_slot_with_the_basement_module(self):
        # Module space is the house's: same origin, footprint and yaw, so plan lines are shared (house_parts/common.py).
        from basement import basement_layout
        basement, house = zones.SLOTS["basement_01"], zones.SLOTS["house_01"]
        self.assertEqual(basement["module"], basement_layout.MODULE_ID)
        self.assertEqual(basement["footprint"], basement_layout.FOOTPRINT)
        self.assertEqual(basement_layout.FOOTPRINT, house_layout.FOOTPRINT)
        self.assertEqual({k: v for k, v in basement.items() if k != "module"},
                         {k: v for k, v in house.items() if k != "module"})

    def test_slot_footprints_are_derived_from_the_module_layouts_not_copied(self):
        # The house and the pool follow their pure layout modules (the garden's and the pond's below too).
        try:
            with mock.patch.object(common, "FOOTPRINT", (22.0, 14.0)), \
                    mock.patch.object(pool_layout, "FOOTPRINT", (13.0, 8.0)):
                importlib.reload(zones)
                self.assertEqual(zones.SLOTS["house_01"]["footprint"], (22.0, 14.0))
                self.assertEqual(zones.SLOTS["pool_01"]["footprint"], (13.0, 8.0))
        finally:
            importlib.reload(zones)
        self.assertEqual(zones.SLOTS["house_01"]["footprint"], (23.0, 15.0))

    def test_garden_slots_take_their_footprints_from_the_garden_layouts(self):
        from garden import bbq_layout, beds_layout, fence_layout, paths_layout, veg_layout
        for slot, layout in (("fence_01", fence_layout), ("garden_paths_01", paths_layout),
                             ("flower_beds_01", beds_layout), ("veg_garden_01", veg_layout),
                             ("bbq_area_01", bbq_layout)):
            self.assertEqual(zones.SLOTS[slot]["module"], layout.MODULE_ID, slot)
            self.assertEqual(zones.SLOTS[slot]["footprint"], layout.FOOTPRINT, slot)
        self.assertEqual(island.ISLAND_WIDE, "island")
        self.assertNotIn(island.ISLAND_WIDE, zones.ZONES)  # a slot's zone, never a zone of the plan

    def test_the_pond_slots_fill_their_zones_unturned_with_the_footprints_of_the_pond_layouts(self):
        # The pond's layout checks place it in site space as standing centred on its zone, unturned.
        from pond import koi_layout, tea_layout
        for slot, layout in (("koi_pond_01", koi_layout), ("tea_garden_01", tea_layout)):
            spec = zones.SLOTS[slot]
            (x0, y0), (x1, y1) = zones.ZONES[layout.ZONE]
            self.assertEqual((spec["module"], spec["zone"]), (layout.MODULE_ID, layout.ZONE), slot)
            self.assertEqual(spec["footprint"], layout.FOOTPRINT, slot)
            self.assertEqual(spec["footprint"], (x1 - x0, y1 - y0), slot)
            self.assertEqual((spec["pos"], spec["yaw"]), (((x0 + x1) / 2, (y0 + y1) / 2), 0.0), slot)

    def test_the_carport_and_kennel_slots_fill_their_zones_unturned_with_the_footprints_of_their_layouts(self):
        # Their layout checks place them in site space as standing centred on their zones, unturned (part 4).
        from carport import carport_layout, kennel_layout
        for slot, layout in (("carport_01", carport_layout), ("kennel_01", kennel_layout)):
            spec = zones.SLOTS[slot]
            (x0, y0), (x1, y1) = zones.ZONES[layout.ZONE]
            self.assertEqual((spec["module"], spec["zone"]), (layout.MODULE_ID, layout.ZONE), slot)
            self.assertEqual(spec["footprint"], layout.FOOTPRINT, slot)
            self.assertEqual(spec["footprint"], (x1 - x0, y1 - y0), slot)
            self.assertEqual((spec["pos"], spec["yaw"]), (((x0 + x1) / 2, (y0 + y1) / 2), 0.0), slot)

    def test_the_placeholder_pond_is_gone(self):
        self.assertNotIn("pond", {spec["module"] for spec in zones.SLOTS.values()})
        self.assertFalse(hasattr(zones, "POND_FOOTPRINT"))

    def test_an_island_wide_slot_stands_at_the_island_centre_unturned_and_takes_the_whole_island(self):
        # Its module is laid out in site space: anywhere else, turned or smaller, its content would not be where its
        # layout check placed it.
        def spread(**spec):
            slots = dict(site().SLOTS)
            slots["fence_01"] = dict({"module": "fence", "zone": "island", "pos": (0.0, 0.0), "yaw": 0.0,
                                      "footprint": ISLAND["size"]}, **spec)
            return site(SLOTS=slots)

        self.assertEqual(zones_check.check(spread()), [])
        self.assertEqual(zones_check.check(spread(yaw=180.0)),
                         ["slot 'fence_01' (fence) spreads over the island: its yaw must be 0, got 180"])
        self.assertEqual(zones_check.check(spread(pos=(1.0, 0.0))),
                         ["slot 'fence_01' (fence) spreads over the island: it must stand at (0, 0), got (1, 0)"])
        self.assertEqual(zones_check.check(spread(yaw=90.0)),
                         ["slot 'fence_01' (fence) spreads over the island: its yaw must be 0, got 90"])
        self.assertEqual(zones_check.check(spread(footprint=(20.0, 10.0), pos=(2.0, 1.0))), [
            "slot 'fence_01' (fence) spreads over the island: it must stand at (0, 0), got (2, 1)",
            "slot 'fence_01' (fence) spreads over the island: its footprint must be the 26 x 16 m island, got 20 x 10",
        ])

    def test_an_island_wide_slot_keeps_the_planned_island_when_a_bigger_one_is_built(self):
        # --yard-size builds another island; the garden modules are still laid out on zones.ISLAND.
        slots = dict(site().SLOTS)
        slots["fence_01"] = {"module": "fence", "zone": "island", "pos": (0.0, 0.0), "yaw": 0.0,
                             "footprint": ISLAND["size"]}
        self.assertEqual(zones_check.check(site(SLOTS=slots), island=dict(ISLAND, size=(40.0, 30.0))), [])

    def test_minimal_site_is_clean(self):
        self.assertEqual(zones_check.check(site()), [])

    def test_zones_must_stay_inside_the_yard(self):
        sideways = site(ZONES={"house": ((-6.0, 0.0), (6.0, 4.0)), "pond": ((8.0, -4.0), (11.0, -1.0))})
        self.assertEqual(zones_check.check(sideways), ["zone 'pond' extends outside the 20 x 10 m yard"])
        behind = site(ZONES={"house": ((-6.0, 0.0), (6.0, 5.5)), "pond": ((2.0, -4.0), (8.0, -1.0))})
        self.assertEqual(zones_check.check(behind), ["zone 'house' extends outside the 20 x 10 m yard"])

    def test_zones_must_stay_inside_the_island(self):
        # The pond zone takes the yard's front-right corner, which a 20 x 10 m squircle rounds off.
        corner = site(ZONES={"house": ((-6.0, 0.0), (6.0, 4.0)), "pond": ((6.0, -5.0), (10.0, -2.0))},
                      ISLAND=dict(ISLAND, size=(20.0, 10.0)))
        self.assertEqual(zones_check.check(corner), ["zone 'pond' extends outside the 20 x 10 m island"])

    def test_trees_and_the_lamp_must_stand_on_the_island(self):
        small = dict(ISLAND, size=(20.0, 10.0))
        self.assertEqual(zones_check.check(site(TREES=[(9.5, 4.5)], ISLAND=small)),
                         ["tree at (9.5, 4.5) is outside the island"])
        self.assertEqual(zones_check.check(site(LAMP=(-9.5, -4.5), ISLAND=small)),
                         ["lamp at (-9.5, -4.5) is outside the island"])

    def test_the_island_to_check_against_can_be_given_instead_of_the_one_in_zones(self):
        # `--yard-size` builds an island other than zones.ISLAND: the zones, trees and lamp must fit that one.
        self.assertEqual(zones_check.check(site(), island=ISLAND), [])
        self.assertEqual(zones_check.check(site(), island=dict(ISLAND, size=(12.0, 5.0))), [
            "zone 'house' extends outside the 12 x 5 m island",
            "zone 'pond' extends outside the 12 x 5 m island",
            "tree at (-8, 3) is outside the island",
            "lamp at (-3, -3) is outside the island",
        ])
        self.assertEqual(zones_check.check(site(), island=dict(ISLAND, size=(40.0, 30.0))), [])  # more room only

    def test_zones_must_not_overlap_and_each_pair_is_reported_once_in_sorted_order(self):
        # Declared pond first: the pair still reads house, pond.
        overlapping = site(ZONES={"pond": ((2.0, 3.0), (8.0, 5.0)), "house": ((-6.0, 0.0), (6.0, 4.0))})
        self.assertEqual(zones_check.check(overlapping), ["zones 'house' and 'pond' overlap"])

    def test_zones_that_share_an_edge_do_not_overlap(self):
        touching = site(ZONES={"house": ((-6.0, 0.0), (6.0, 4.0)), "pond": ((2.0, 4.0), (8.0, 5.0))})
        self.assertEqual(zones_check.check(touching), [])

    def test_a_slot_needs_a_known_zone(self):
        slots = {"house_01": dict(site().SLOTS["house_01"], zone="attic")}
        self.assertEqual(zones_check.check(site(SLOTS=slots)), ["slot 'house_01': unknown zone 'attic'"])

    def test_a_slot_footprint_must_stay_inside_its_zone(self):
        slots = {"house_01": dict(site().SLOTS["house_01"], pos=(1.0, 2.0))}
        self.assertEqual(zones_check.check(site(SLOTS=slots)), ["slot 'house_01' (house) sticks out of zone 'house'"])

    def test_the_footprint_is_tested_after_turning_it_by_the_yaw(self):
        self.assertEqual(zones_check.check(pond_slot(yaw=0.0)), [])
        # 4 x 2.9 m turned 30 degrees spans 4.9 x 4.5 m: it only fits the 6 x 3 m zone upright.
        self.assertEqual(zones_check.check(pond_slot(yaw=30.0)), ["slot 'pond_01' (pond) sticks out of zone 'pond'"])

    def test_a_zone_holds_one_slot_but_for_a_slot_zone_shared_lets_share_the_place_of_another(self):
        # The basement stands where the house does, a storey under it (art/README.md, Basement): ZONE_SHARED names
        # it and the slot whose place it shares, and nothing else may double up in a zone.
        slots = dict(site().SLOTS)
        slots["cellar_01"] = dict(slots["house_01"], module="cellar")
        self.assertEqual(zones_check.check(site(SLOTS=slots)),
                         ["zone 'house' holds slots 'cellar_01' and 'house_01': only ZONE_SHARED slots share a zone"])
        self.assertEqual(zones_check.check(site(SLOTS=slots, ZONE_SHARED={"cellar_01": "house_01"})), [])
        moved = dict(slots, cellar_01=dict(slots["cellar_01"], pos=(0.5, 2.0), footprint=(11.0, 4.0)))
        self.assertEqual(zones_check.check(site(SLOTS=moved, ZONE_SHARED={"cellar_01": "house_01"})), [
            "slot 'cellar_01' (cellar) shares the place of 'house_01': it must stand at (0, 2), yaw 0, with its "
            "12 x 4 m footprint",
        ])
        self.assertEqual(zones_check.check(site(ZONE_SHARED={"cellar_01": "house_01"})),
                         ["ZONE_SHARED: slot 'cellar_01' or 'house_01' is not in SLOTS"])
        elsewhere = dict(slots, cellar_01=dict(slots["cellar_01"], zone="pond"))
        self.assertIn("slot 'cellar_01' (cellar) shares the place of 'house_01': it must be in zone 'house'",
                      zones_check.check(site(SLOTS=elsewhere, ZONE_SHARED={"cellar_01": "house_01"})))

    def test_a_quarter_turn_swaps_width_and_depth(self):
        self.assertEqual(zones_check.check(pond_slot(yaw=0.0, footprint=(5.0, 2.0))), [])
        self.assertEqual(zones_check.check(pond_slot(yaw=90.0, footprint=(5.0, 2.0))),
                         ["slot 'pond_01' (pond) sticks out of zone 'pond'"])

    def test_trees_stay_out_of_every_zone(self):
        self.assertEqual(zones_check.check(site(TREES=[(0.0, 2.0)])), ["tree at (0, 2) is inside zone 'house'"])
        self.assertEqual(zones_check.check(site(TREES=[(6.0, 2.0)])), ["tree at (6, 2) is inside zone 'house'"])
        self.assertEqual(zones_check.check(site(TREES=[(-8.0, 3.0), (5.0, -2.5)])),
                         ["tree at (5, -2.5) is inside zone 'pond'"])

    def test_trees_stay_inside_the_yard(self):
        self.assertEqual(zones_check.check(site(TREES=[(12.0, 0.0)])), ["tree at (12, 0) is outside the yard"])
        self.assertEqual(zones_check.check(site(TREES=[(-8.0, -5.5)])), ["tree at (-8, -5.5) is outside the yard"])

    def test_the_lamp_is_held_to_the_same_two_rules(self):
        self.assertEqual(zones_check.check(site(LAMP=(5.0, -2.0))), ["lamp at (5, -2) is inside zone 'pond'"])
        self.assertEqual(zones_check.check(site(LAMP=(0.0, 6.0))), ["lamp at (0, 6) is outside the yard"])

    def test_every_problem_is_reported_zones_then_slots_then_trees_then_the_lamp(self):
        broken = site(
            ZONES={"house": ((-6.0, 0.0), (6.0, 4.0)), "pond": ((2.0, -4.0), (12.0, 3.0))},
            SLOTS={"house_01": dict(site().SLOTS["house_01"], zone="attic")},
            TREES=[(0.0, 2.0)], LAMP=(0.0, 6.0))
        self.assertEqual(zones_check.check(broken), [
            "zone 'pond' extends outside the 20 x 10 m yard",
            "zones 'house' and 'pond' overlap",
            "slot 'house_01': unknown zone 'attic'",
            "tree at (0, 2) is inside zone 'house'",
            "lamp at (0, 6) is outside the yard",
        ])


class IslandOutlineTest(unittest.TestCase):
    """The rim of the island's flat top, shared by the placeholder generator and zones_check."""

    def test_the_rim_has_one_point_per_rim_vertex_counter_clockwise_from_plus_x(self):
        rim = island.outline(ISLAND)
        self.assertEqual(len(rim), 48)
        self.assertAlmostEqual(rim[0][0], 13.0)
        self.assertAlmostEqual(rim[0][1], 0.0)
        doubled_area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(rim, rim[1:] + rim[:1]))
        self.assertGreater(doubled_area, 0.0)

    def test_an_unjittered_rim_lies_on_the_superellipse(self):
        for x, y in island.outline(ISLAND):
            self.assertAlmostEqual(abs(x / 13.0) ** 4 + abs(y / 8.0) ** 4, 1.0)
        self.assertAlmostEqual(island.superellipse_radius(0.0, (26.0, 16.0), 4.0), 13.0)
        self.assertAlmostEqual(island.superellipse_radius(math.pi / 2, (26.0, 16.0), 4.0), 8.0)

    def test_the_jitter_only_pulls_the_rim_in_and_follows_the_seed(self):
        jittered = dict(ISLAND, jitter=0.05, seed=7)
        rim = island.outline(jittered)
        ratios = [math.hypot(*p) / math.hypot(*q) for p, q in zip(rim, island.outline(ISLAND))]
        self.assertTrue(all(0.95 - 1e-9 <= r <= 1.0 + 1e-9 for r in ratios))
        self.assertGreater(max(ratios) - min(ratios), 0.02)  # not a uniformly shrunk squircle
        self.assertTrue(all(abs(x) <= 13.0 and abs(y) <= 8.0 for x, y in rim))  # inside the footprint
        self.assertEqual(island.outline(jittered), rim)
        self.assertNotEqual(island.outline(dict(jittered, seed=8)), rim)

    def test_points_inside_and_outside_a_non_convex_rim(self):
        slot = [(-4.0, -4.0), (4.0, -4.0), (4.0, -0.2), (-3.0, -0.2), (-3.0, 0.2), (4.0, 0.2), (4.0, 4.0), (-4.0, 4.0)]
        self.assertTrue(island.contains(slot, (0.0, 2.0)))
        self.assertFalse(island.contains(slot, (0.0, 0.0)))  # in the slot
        self.assertFalse(island.contains(slot, (5.0, 2.0)))

    def test_a_rect_is_inside_only_when_no_rim_edge_cuts_through_it(self):
        # A slot bites into the square from the right, through the middle of the rect: all four corners are inside.
        slot = [(-4.0, -4.0), (4.0, -4.0), (4.0, -0.2), (-3.0, -0.2), (-3.0, 0.2), (4.0, 0.2), (4.0, 4.0), (-4.0, 4.0)]
        self.assertTrue(all(island.contains(slot, c) for c in ((-2.0, -2.0), (2.0, -2.0), (2.0, 2.0), (-2.0, 2.0))))
        self.assertFalse(island.contains_rect(slot, (-2.0, -2.0, 2.0, 2.0)))
        self.assertTrue(island.contains_rect(slot, (-2.0, 1.0, 2.0, 3.0)))
        self.assertFalse(island.contains_rect(slot, (-2.0, 1.0, 5.0, 3.0)))  # a corner sticks out


def segment_distance(point, a, b):
    (px, py), (ax, ay), (bx, by) = point, a, b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


class RimDressingTest(unittest.TestCase):
    """The grass tufts and small rocks that break up the rim (siteplan/rim.py, built by make_placeholders) keep clear
    of the garden's fence, which runs fence_layout.INSET metres inside the rim: once they stood where the fence does."""

    @classmethod
    def setUpClass(cls):
        from garden import fence_layout, layout_check
        cls.fence = fence_layout
        cls.layout_check = layout_check
        cls.rim = importlib.import_module("siteplan.rim")
        cls.line = fence_layout.LINE

    def to_fence(self, point):
        return min(segment_distance(point, a, b) for a, b in zip(self.line, self.line[1:] + self.line[:1]))

    def test_the_dressing_follows_the_fence_line_of_the_island_it_dresses(self):
        self.assertEqual(self.rim.fence_line(zones.ISLAND), self.line)
        bigger = dict(zones.ISLAND, size=(60.0, 50.0))
        self.assertEqual(self.rim.fence_line(bigger), self.fence.inset(island.outline(bigger), self.fence.INSET))

    def test_tufts_grow_in_the_strip_between_the_fence_and_the_rim_leaning_out(self):
        rim = island.outline(zones.ISLAND)
        blades = self.rim.tufts(zones.ISLAND)
        self.assertGreaterEqual(len(blades), 100)
        for x, y, radius, height, (lean_x, lean_y) in blades:
            gap = self.to_fence((x, y))
            self.assertFalse(island.contains(self.line, (x, y)), (x, y))  # outside the fence
            self.assertGreaterEqual(gap - radius, 0.05 - 1e-9, (x, y))  # the whole blade, not just its middle
            self.assertLessEqual(gap, 0.25 + 1e-9, (x, y))
            self.assertTrue(island.contains(rim, (x, y)), (x, y))
            self.assertTrue(0.05 <= radius <= 0.15 and 0.25 <= height <= 0.6, (radius, height))
            self.assertGreaterEqual(self.to_fence((x + lean_x, y + lean_y)), gap - 1e-9)  # away from the fence

    def test_no_tuft_touches_a_fence_post_or_its_cap(self):
        from garden import shapes
        posts = [shape for name, shape in self.fence.SHAPES if name.startswith("post ")]
        self.assertEqual(len(posts), len(self.fence.POSTS))
        for x, y, radius, *_ in self.rim.tufts(zones.ISLAND):
            clear = min(shapes.distance(post, (x, y)) for post in posts) - radius
            self.assertGreaterEqual(clear, self.rim.TUFT_STRIP[0] - 1e-9, (x, y))

    def test_no_tuft_grows_in_a_gateway(self):
        for gate in self.fence.GATES:
            left, right = (p["pos"] for p in self.fence.PILLARS if p["gate"] == gate["name"])
            for x, y, *_ in self.rim.tufts(zones.ISLAND):
                self.assertGreater(segment_distance((x, y), left, right), self.rim.GATEWAY_CLEAR, gate["name"])

    def test_rocks_lie_inside_the_fence_clear_of_it_the_zones_and_the_garden_by_their_size(self):
        rocks = self.rim.rocks(zones.ISLAND)
        self.assertEqual(len(rocks), self.rim.ROCKS)
        ground = [shape for layout in self.layout_check.island_layouts()
                  for _, shape in self.layout_check.ground(layout)]
        for x, y, size in rocks:
            reach = self.rim.ROCK_SPREAD * size  # the widest its faceted base spreads
            self.assertTrue(island.contains(self.line, (x, y)), (x, y))
            self.assertGreaterEqual(self.to_fence((x, y)), max(0.8, reach + self.rim.ROCK_MARGIN) - 1e-9, (x, y))
            for name, ((x0, y0), (x1, y1)) in zones.ZONES.items():
                self.assertGreaterEqual(shapes_distance(((x0, y0), (x1, y0), (x1, y1), (x0, y1)), (x, y)), reach,
                                        f"rock at ({x:g}, {y:g}) in zone {name}")
            for shape in ground:
                self.assertGreaterEqual(shapes_distance(shape, (x, y)), reach, (x, y, shape))
            for tree in zones.TREES + (zones.LAMP,):
                self.assertGreaterEqual(math.dist(tree, (x, y)), reach + 0.35, (x, y))

    def test_the_dressing_is_seeded(self):
        self.assertEqual(self.rim.tufts(zones.ISLAND), self.rim.tufts(zones.ISLAND))
        self.assertEqual(self.rim.rocks(zones.ISLAND), self.rim.rocks(zones.ISLAND))
        self.assertNotEqual(self.rim.tufts(dict(zones.ISLAND, seed=4)), self.rim.tufts(zones.ISLAND))


def shapes_distance(polygon, point):
    """How far `point` is from the convex polygon (0 inside it)."""
    if island.contains(list(polygon), point):
        return 0.0
    return min(segment_distance(point, a, b) for a, b in zip(polygon, list(polygon[1:]) + [polygon[0]]))


if __name__ == "__main__":
    unittest.main()

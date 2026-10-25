"""The decor pass's plan (villa v2 spec §12 "Curtains and accessories"): curtains along the tall house's glazing, as tall as the
rooms they hang in, and the accessories that furnish its rooms, in a module of their own standing in the house's slot.
Pure Python."""
import copy
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit.catalog import FURNITURE, OVERLAYS, SURFACES, WALL_MOUNTED, footprint  # noqa: E402
from houses import house_layout  # noqa: E402
from houses import layout_check as house_check  # noqa: E402
from houses.house_parts import common  # noqa: E402
from siteplan import zones, zones_check  # noqa: E402

from interior import interact  # noqa: E402
from interior import interior_layout as L  # noqa: E402
from interior import layout_check  # noqa: E402

EPS = 1e-6
# The rooms the decor pass furnishes, with the least number of accessories each gets.
FURNISHED = {"living": 10, "dining": 3, "kitchen": 5, "foyer": 3, "gallery": 4, "master": 4, "bedroom2": 6,
             "bedroom3": 4, "bath_master": 3, "bath_shared": 3}
# Where the curtains hang (glazing: room) and where they do not.
CURTAINED = {"living_front": "living", "living_west": "living", "ground_front": "dining",
             "upper_front_bed2": "bedroom2", "upper_front_master": "master", "upper_west_bed3": "bedroom3"}
BARE = {"kitchen", "bath_master", "bath_shared", "wc", "laundry"}
LAMP_ROOMS = {"dining", "bedroom2", "bedroom3"}


def layout(**changes):
    """A copy of the shipped layout's data with some names replaced, for the checker to find a problem in."""
    names = {name: copy.deepcopy(value) for name, value in vars(L).items()
             if not name.startswith("_") and not isinstance(value, types.ModuleType) and not callable(value)}
    names.update(changes)
    return types.SimpleNamespace(**names)


def rooms():
    return {room["name"]: room for room in house_layout.ROOMS}


def room_rect(name):
    room = rooms()[name]
    return (*room["min"], *room["max"])


def entries():
    return {entry[1]: entry for entry in list(house_layout.FURNITURE) + list(L.FURNITURE)}


def opts(entry):
    return dict(entry[5]) if len(entry) > 5 else {}


def rect(entry):
    kind, _name, _room, center, rot = entry[:5]
    return house_check._rect(center, footprint(kind, rot))


def overlap(a, b):
    return a[0] < b[2] - EPS and b[0] < a[2] - EPS and a[1] < b[3] - EPS and b[1] < a[3] - EPS


def moved(name, **changes):
    """The interior's FURNITURE with the entry `name` changed: its (x, y) `at`, its options `opts`."""
    found = []
    for entry in L.FURNITURE:
        if entry[1] == name:
            kind, _name, room, center, rot = entry[:5]
            entry = (kind, name, room, changes.get("at", center), rot, changes.get("opts", opts(entry)))
        found.append(entry)
    return found


class InteriorModuleTest(unittest.TestCase):
    def test_it_is_a_prop_in_the_houses_place_and_module_space(self):
        self.assertEqual(L.MODULE_ID, "interior")
        self.assertEqual(L.ROLE, "prop")
        self.assertEqual(L.FOOTPRINT, house_layout.FOOTPRINT)
        self.assertIs(L.ROOMS, house_layout.ROOMS)

    def test_its_slot_shares_the_houses_cell_as_zone_shared_allows(self):
        slot, house = zones.SLOTS["interior_01"], zones.SLOTS["house_01"]
        self.assertEqual(slot["module"], "interior")
        self.assertEqual({k: v for k, v in slot.items() if k != "module"},
                         {k: v for k, v in house.items() if k != "module"})
        self.assertEqual(zones.ZONE_SHARED, {"basement_01": "house_01", "interior_01": "house_01"})
        self.assertEqual(zones_check.check(zones), [])
        # ZONE_SHARED lets it stand only where the house does
        wrong = types.SimpleNamespace(**{k: getattr(zones, k) for k in dir(zones) if k.isupper()})
        wrong.ZONE_SHARED = {"basement_01": "house_01", "interior_01": "pool_01"}
        self.assertIn("slot 'interior_01' (interior) shares the place of 'pool_01': it must be in zone 'pool'",
                      zones_check.check(wrong))
        alone = types.SimpleNamespace(**{k: getattr(zones, k) for k in dir(zones) if k.isupper()})
        alone.ZONE_SHARED = {"basement_01": "house_01"}
        self.assertTrue(any("'interior_01'" in p and "zone 'house'" in p for p in zones_check.check(alone)))

    def test_the_shipped_layout_is_clean(self):
        self.assertEqual(layout_check.check(L), [])

    def test_the_house_no_longer_has_its_old_curtain(self):
        names = {entry[1] for entry in house_layout.FURNITURE}
        self.assertNotIn("Curtain_master", names)
        self.assertNotIn("curtain", {entry[0] for entry in house_layout.FURNITURE})

    def test_everything_goes_into_a_handful_of_objects_and_only_lamp_shades_glow(self):
        self.assertEqual(set(L.OBJECTS), {L.DECOR, L.DETAILS, *L.LAMPS.values()})
        self.assertLessEqual(len(L.OBJECTS), 5)
        self.assertEqual(set(L.LAMPS), LAMP_ROOMS)
        for room, name in L.LAMPS.items():
            self.assertEqual(name, f"LT_lamp_{room}")
            self.assertIs(L.OBJECTS[name].get("night"), True)
        self.assertFalse(L.OBJECTS[L.DECOR].get("night"))
        for entry in L.FURNITURE:
            self.assertIn(L.into(entry), L.OBJECTS, entry[1])

    def test_the_small_things_go_into_the_details_the_website_draws_only_under_the_cut(self):
        # from afar (the house whole, the wallpaper) books, cushions and the table laid are a pixel or two: the site
        # route draws them only once it cuts the house, close enough to make them out (cutaway.ts)
        self.assertEqual(L.DETAILS, "Interior_details")
        self.assertIs(L.OBJECTS[L.DETAILS].get("detail"), True)
        self.assertFalse(L.OBJECTS[L.DECOR].get("detail"))
        details = {entry[0] for entry in L.FURNITURE if L.into(entry) == L.DETAILS}
        decor = {entry[0] for entry in L.FURNITURE if L.into(entry) == L.DECOR}
        self.assertLessEqual({"cushions", "book_stack", "vase_branches", "table_setting", "toiletry_tray", "counter_set",
                              "seat_pad", "plant_pot", "coffee_decor", "drum_table"}, details)
        # what shows through the glass from afar stays: the chairs, the trees, the buffets, the mirrors, the lamps' bases
        # (their glowing shades are objects of their own, drawn whenever the house is: a shade must never float)
        self.assertLessEqual({"rattan_armchair", "fiddle_leaf", "buffet", "mirror_round", "table_lamp", "floor_vase",
                              "bench"}, decor)
        self.assertEqual(details & decor, set())
        self.assertEqual(details, set(L.DETAIL_KINDS) & {entry[0] for entry in L.FURNITURE})

    def test_a_lamps_shade_joins_its_rooms_light_group(self):
        self.assertEqual(interact.tags(L), {
            "LT_lamp_dining": {"interact": "light:dining", "label": "Dining room lights"},
            "LT_lamp_bedroom2": {"interact": "light:bedroom2", "label": "Bedroom 2 lights"},
            "LT_lamp_bedroom3": {"interact": "light:bedroom3", "label": "Bedroom 3 lights"},
        })
        lamps = {entry[2] for entry in L.FURNITURE if entry[0] == "table_lamp"}
        self.assertEqual(lamps, LAMP_ROOMS)


class CurtainPlanTest(unittest.TestCase):
    def test_curtains_hang_at_every_bedrooms_glass_the_living_rooms_tall_glass_and_the_dining_glazing(self):
        hung = {curtain["glass"]: curtain["room"] for curtain in L.CURTAINS}
        self.assertEqual(hung, CURTAINED)
        self.assertEqual(BARE & {curtain["room"] for curtain in L.CURTAINS}, set())
        blinds = {blind["window"]: blind["room"] for blind in L.BLINDS}
        self.assertEqual(blinds, {"kitchen": "kitchen", "gaming": "gaming"})

    def test_a_curtain_runs_along_its_glass_just_inside_its_room(self):
        glasses = {glass["name"]: glass for glass in house_layout.CURTAIN_WALLS}
        for curtain in L.CURTAINS:
            glass = glasses[curtain["glass"]]
            at = L.curtain_at(curtain)
            (gx0, gy0), (gx1, gy1) = glass["start"], glass["end"]
            g0, g1 = sorted((gx0, gx1) if at["axis"] == 0 else (gy0, gy1))
            a0, a1 = curtain["span"]
            self.assertTrue(g0 - layout_check.CURTAIN_OVER - EPS <= a0 < a1 <= g1 + layout_check.CURTAIN_OVER + EPS,
                            curtain["name"])
            self.assertLessEqual(abs(at["back"] - at["line"]), layout_check.CURTAIN_NEAR, curtain["name"])
            self.assertTrue(house_check._inside(L.run_rect(curtain), room_rect(curtain["room"])), curtain["name"])

    def test_its_height_comes_from_its_room_under_the_ceiling_to_a_centimetre_over_the_floor(self):
        for curtain in L.CURTAINS:
            at = L.curtain_at(curtain)
            level = rooms()[curtain["room"]]["level"]
            floor = house_layout.FLOOR_Z[curtain["room"]]
            for stack in L.stacks(curtain):
                middle = ((stack[0] + stack[2]) / 2, (stack[1] + stack[3]) / 2)
                ceiling = common.ceiling_over(level, middle)
                self.assertLessEqual(floor + at["drop"], ceiling + EPS, curtain["name"])  # top <= ceiling
                self.assertGreater(floor + at["drop"], ceiling - 0.05, curtain["name"])  # right up to it
        # (the bottom >= floor + 1 cm is the built fabric's: test_interior_module checks the exported stacks' hems)
        tall = {c["name"]: L.curtain_at(c)["drop"] for c in L.CURTAINS if c["room"] == "living"}
        for name, height in tall.items():
            self.assertGreater(height, 8.7, name)  # the living room's sheers run the full double height
        # a bedroom's curtains are the upper floor's 4.03 m clear, not the old kit's 3 m
        master = next(c for c in L.CURTAINS if c["room"] == "master")
        self.assertAlmostEqual(L.curtain_at(master)["drop"], common.UPPER_CEIL - common.LEVEL_Z[1] - 0.01, places=3)

    def test_the_stacks_stand_clear_of_doors_the_stair_furniture_and_the_runs_of_the_chandelier(self):
        house = [(entry[1], rect(entry), rooms()[entry[2]]["level"]) for entry in house_layout.FURNITURE
                 if entry[0] not in OVERLAYS and entry[0] not in WALL_MOUNTED]
        doors = [(wall["level"], clearance) for wall in house_layout.PARTITIONS
                 for *_, clearance in house_check._doorways(wall)[1]]
        chandelier = next(rect(entry) for entry in house_layout.FURNITURE if entry[0] == "crystal_chandelier")
        stair = next(rect(entry) for entry in house_layout.FURNITURE if entry[0] == "spiral_stair")
        for curtain in L.CURTAINS:
            level = rooms()[curtain["room"]]["level"]
            self.assertFalse(overlap(L.run_rect(curtain), chandelier), curtain["name"])
            for stack in L.stacks(curtain):
                self.assertFalse(overlap(stack, stair), curtain["name"])
                for name, other, other_level in house:
                    self.assertFalse(other_level == level and overlap(stack, other), (curtain["name"], name))
                for door_level, clearance in doors:
                    self.assertFalse(door_level == level and overlap(stack, clearance), curtain["name"])

    def test_the_glass_between_the_stacks_stays_open(self):
        for curtain in L.CURTAINS:
            a0, a1 = curtain["span"]
            covered = 2 * L.stack_width(curtain)
            self.assertLess(covered, 0.5 * (a1 - a0), curtain["name"])

    def test_blinds_hang_in_front_of_their_windows_under_the_ceiling(self):
        windows = {window["name"]: window for window in house_layout.WINDOWS}
        for blind in L.BLINDS:
            window, at = windows[blind["window"]], L.blind_at(blind)
            x, y, z = at["pos"]
            self.assertLessEqual(z, window["z0"])
            self.assertGreaterEqual(z + at["drop"], window["z1"])
            self.assertLessEqual(z + at["drop"], common.CEILING[rooms()[blind["room"]]["level"]])
            self.assertTrue(0 < blind["lowered"] < 0.5)  # the window shows under it


class AccessoryPlanTest(unittest.TestCase):
    def test_every_room_the_pass_names_gets_its_accessories(self):
        counts = {}
        for entry in L.FURNITURE:
            counts[entry[2]] = counts.get(entry[2], 0) + 1
        for room, least in FURNISHED.items():
            self.assertGreaterEqual(counts.get(room, 0), least, room)

    def test_the_rooms_get_what_the_brief_lists(self):
        kinds = {}
        for entry in L.FURNITURE:
            kinds.setdefault(entry[2], set()).add(entry[0])
        self.assertLessEqual({"cushions", "throw", "coffee_decor", "floor_vase", "drum_table", "rattan_armchair",
                              "fiddle_leaf", "buffet", "mirror_round"}, kinds["living"])
        self.assertLessEqual({"table_setting", "table_lamp", "rug_large"}, kinds["dining"])
        self.assertLessEqual({"fruit_bowl", "counter_set", "herb_pots", "seat_pad"}, kinds["kitchen"])
        self.assertLessEqual({"cushions", "throw", "bench", "table_lamp", "buffet", "mirror_round", "art_print",
                              "book_stack", "plant_pot"}, kinds["bedroom2"])
        self.assertLessEqual({"table_lamp", "cushion_pair", "throw", "rattan_armchair"}, kinds["bedroom3"])
        self.assertLessEqual({"cushions", "bench"}, kinds["master"])
        self.assertLessEqual({"console_slim", "vase_branches", "bench", "art_print", "runner_rug"}, kinds["gallery"])
        for bath in ("bath_master", "bath_shared"):
            self.assertLessEqual({"toiletry_tray", "bath_mat", "towel_bar", "plant_pot"}, kinds[bath], bath)
        self.assertLessEqual({"mirror_round", "umbrella_stand", "vase_branches"}, kinds["foyer"])

    def test_every_accessory_stands_inside_its_room(self):
        for entry in L.FURNITURE:
            self.assertTrue(house_check._inside(rect(entry), room_rect(entry[2])), entry[1])

    def test_what_stands_on_a_host_sits_on_its_top_within_a_centimetre(self):
        found = 0
        for entry in L.FURNITURE:
            name = opts(entry).get("on")
            if name is None:
                continue
            host = entries()[name]
            tops = L.surfaces(host)
            self.assertTrue(tops, name)
            z = L.stand(entry)[2]
            held = [top for top, top_rect in tops if house_check._inside(rect(entry), top_rect)]
            self.assertTrue(held, entry[1])
            self.assertLessEqual(abs(z - (L.FLOOR_Z[host[2]] + held[0])), 0.01, entry[1])
            self.assertIn(host[0], SURFACES)
            found += 1
        self.assertGreater(found, 30)

    def test_floor_pieces_stand_clear_of_the_houses_furniture_and_of_each_other(self):
        house = [(entry[1], rect(entry), rooms()[entry[2]]["level"]) for entry in house_layout.FURNITURE
                 if entry[0] not in OVERLAYS and entry[0] not in WALL_MOUNTED]
        floor = [entry for entry in L.FURNITURE if "on" not in opts(entry) and entry[0] not in OVERLAYS
                 and entry[0] not in WALL_MOUNTED]
        self.assertGreater(len(floor), 15)
        for i, entry in enumerate(floor):
            level = rooms()[entry[2]]["level"]
            for name, other, other_level in house:
                self.assertFalse(level == other_level and overlap(rect(entry), other), (entry[1], name))
            for other in floor[i + 1:]:
                self.assertFalse(rooms()[other[2]]["level"] == level and overlap(rect(entry), rect(other)),
                                 (entry[1], other[1]))

    def test_wall_pieces_hang_on_solid_walls(self):
        hung = [entry for entry in L.FURNITURE if entry[0] in WALL_MOUNTED and "on" not in opts(entry)]
        self.assertGreaterEqual(len(hung), 6)
        for entry in hung:
            level = rooms()[entry[2]]["level"]
            self.assertTrue(layout_check._on_wall(entry, L.FLOOR_Z[entry[2]], level), entry[1])


class InteriorCheckTest(unittest.TestCase):
    """What layout_check reports."""

    def problems(self, **changes):
        return layout_check.check(layout(**changes))

    def test_a_piece_moved_off_its_hosts_top_is_reported(self):
        found = self.problems(FURNITURE=moved("Coffee_decor", at=(-7.4, -2.6)))
        self.assertIn("Coffee_decor (coffee_decor) is not on a top of Coffee_table (coffee_table)", found)
        found = self.problems(FURNITURE=moved("Coffee_decor", opts={"on": "Nowhere"}))
        self.assertTrue(any("stands on 'Nowhere'" in p for p in found), found)

    def test_a_floor_piece_on_the_houses_furniture_in_a_doorway_or_on_the_stair_is_reported(self):
        found = self.problems(FURNITURE=moved("Drum_table_living", at=(-9.3, -2.0)))
        self.assertIn("Drum_table_living (drum_table) overlaps the house's Sofa (sofa_l)", found)
        found = self.problems(FURNITURE=moved("Bench_gallery", at=(-5.95, 2.84)))
        self.assertTrue(any(p.startswith("Bench_gallery (bench) blocks door") for p in found), found)
        found = self.problems(FURNITURE=moved("Fig_living", at=(-10.0, 1.6)))
        self.assertIn("Fig_living (fiddle_leaf) blocks the stair Stair", found)
        found = self.problems(FURNITURE=moved("Console_gallery", at=(-7.65, 1.9)))
        self.assertIn("Console_gallery (console_slim) blocks the walk along the gallery's balustrade", found)

    def test_a_wall_piece_on_glass_or_over_a_doorway_is_reported(self):
        found = self.problems(FURNITURE=moved("Mirror_living", at=(-7.0, -5.48)))
        self.assertTrue(any("Mirror_living (mirror_round) does not hang on a solid wall" in p for p in found), found)
        found = self.problems(FURNITURE=moved("Print_gallery", at=(-5.95, 3.02)))
        self.assertTrue(any("Print_gallery (art_print) does not hang on a solid wall" in p for p in found), found)

    def test_a_curtain_off_its_glass_too_long_or_into_the_stair_is_reported(self):
        curtains = copy.deepcopy(L.CURTAINS)
        west = next(c for c in curtains if c["name"] == "Curtain_living_west")
        west["span"] = (-5.2, 1.4)
        found = self.problems(CURTAINS=curtains)
        self.assertTrue(any("Curtain_living_west: a stack blocks the stair Stair" in p for p in found), found)
        curtains = copy.deepcopy(L.CURTAINS)
        master = next(c for c in curtains if c["name"] == "Curtain_master")
        master["glass"] = "upper_front_bed2"
        found = self.problems(CURTAINS=curtains)
        self.assertTrue(any(p.startswith("Curtain_master runs") or "sticks out of room 'master'" in p
                            for p in found), found)

    def test_a_lamp_without_a_lamp_object_and_a_piece_into_an_unknown_object_are_reported(self):
        furniture = list(L.FURNITURE) + [("table_lamp", "Lamp_extra", "master", (5.95, 1.2), 0,
                                          {"on": "Dresser_master"})]
        found = self.problems(FURNITURE=[e for e in furniture if e[1] != "Books_dresser_master"])
        self.assertIn("room 'master' has a table lamp but no lamp object in LAMPS", found)
        found = self.problems(FURNITURE=moved("Bowl_sideboard", opts={"on": "Sideboard", "into": "Nowhere"}))
        self.assertIn("Bowl_sideboard (bowl) goes into 'Nowhere', which is not one of the interior's OBJECTS", found)


if __name__ == "__main__":
    unittest.main()

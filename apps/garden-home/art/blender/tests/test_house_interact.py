"""The items of the house a click on the website toggles, as houses/interact.py tags them
for build_house.py, and the downlights split into one object per room. Pure Python."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from houses import house_layout, interact  # noqa: E402

INTERIOR = {room["name"] for room in house_layout.ROOMS if room.get("interior")}


class HouseTagsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tags = interact.tags(house_layout)

    def group(self, group):
        return {name for name, props in self.tags.items() if props["interact"] == group}

    def test_every_lit_room_has_its_own_light_group(self):
        lights = {props["interact"] for props in self.tags.values() if props["interact"].startswith("light:")}
        # the balcony is not an interior room, but the downlights under the roof slab light it
        self.assertEqual(lights, {f"light:{room}" for room in INTERIOR | {"balcony"}})

    def test_a_room_group_holds_its_point_light_downlights_and_lamps(self):
        # and the wall switch of the room, which stays in reach when the cut hides the ceiling
        # the crystal chandelier of the double-height living room among them (the tall house)
        self.assertEqual(self.group("light:living"),
                         {"L_living", "LT_down_living", "Floor_lamp", "Chandelier", "Switch_living"})
        self.assertEqual(self.group("light:kitchen"),
                         {"L_kitchen", "LT_down_kitchen", "Pendant_island_1", "Pendant_island_2", "Pendant_island_3",
                          "Switch_kitchen"})
        self.assertEqual(self.group("light:dining"),
                         {"LT_down_dining", "Pendant_dining_1", "Pendant_dining_2", "Switch_dining"})
        self.assertEqual(self.group("light:master"), {"L_master", "LT_down_master", "Nightstand_master_l",
                                                      "Nightstand_master_r", "Pendant_master", "Switch_master"})
        self.assertEqual(self.group("light:bedroom2"),
                         {"L_bedroom2", "LT_down_bedroom2", "Pendant_room2", "Switch_bedroom2"})
        # a frosted window glows with the bathroom behind it
        self.assertEqual(self.group("light:bath_master"),
                         {"LT_down_bath_master", "FROSTED_bath_master", "Switch_bath_master"})
        self.assertEqual(self.group("light:wc"), {"LT_down_wc", "FROSTED_wc", "Switch_wc"})
        self.assertEqual(self.group("light:balcony"), {"LT_down_balcony", "Switch_balcony"})

    def test_every_lit_room_has_one_wall_switch_in_its_group(self):
        switches = {name: props for name, props in self.tags.items() if name.startswith("Switch_")}
        self.assertEqual(sorted(switches), sorted(f"Switch_{room}" for room in INTERIOR | {"balcony"}))
        for name, props in switches.items():
            self.assertEqual(props["interact"], "light:" + name[len("Switch_"):], name)
        placed = {entry[1]: entry[2] for entry in house_layout.FURNITURE if entry[0] == "light_switch"}
        self.assertEqual(placed, {name: name[len("Switch_"):] for name in switches})  # each stands in the room it lights

    def test_screens_showers_door_jacuzzi_fountain_and_string_lights(self):
        self.assertEqual(self.group("tv:TV_wall"), {"TV_wall"})
        self.assertEqual(self.group("tv:TV_master"), {"TV_master"})
        self.assertEqual(self.group("pc:Gaming_desk"), {"Gaming_desk"})
        self.assertEqual(self.group("shower:Shower_master"), {"Shower_master", "WATER_Shower_master_flow"})
        self.assertEqual(self.group("shower:Shower_shared"), {"Shower_shared", "WATER_Shower_shared_flow"})
        self.assertEqual(self.group("door:main"), {"Door_main"})
        self.assertEqual(self.group("jacuzzi"), {"jacuzzi", "WATER_jacuzzi", "jacuzzi_bubbles_a", "jacuzzi_bubbles_b",
                                                 "jacuzzi_bubbles_c"})
        self.assertEqual(self.group("fountain"), {"fountain", "WATER_fountain", "WATER_fountain_sheet"})
        self.assertEqual(self.group("lights:string"), {"String_lights_trellis", "String_lights_railing"})

    def test_labels_are_english_and_shared_by_a_group(self):
        labels = {}
        for name, props in self.tags.items():
            if not name.startswith(("Switch_", "AC_remote_")) and name != "Chandelier":  # labels of their own
                labels.setdefault(props["interact"], set()).add(props["label"])
        self.assertEqual({group: names for group, names in labels.items() if len(names) != 1}, {})
        label = {group: names.pop() for group, names in labels.items()}
        self.assertEqual(self.tags["Switch_living"]["label"], "Living room light switch")
        self.assertEqual(self.tags["Switch_bath_master"]["label"], "Master bathroom light switch")
        self.assertEqual(self.tags["Switch_balcony"]["label"], "Balcony light switch")
        self.assertEqual(self.tags["Chandelier"]["label"], "Crystal chandelier")
        self.assertEqual(label["light:living"], "Living room lights")
        self.assertEqual(label["light:master"], "Master bedroom lights")
        self.assertEqual(label["tv:TV_wall"], "Living room TV")
        self.assertEqual(label["tv:TV_master"], "Master bedroom TV")
        self.assertEqual(label["pc:Gaming_desk"], "Computer")
        self.assertEqual(label["shower:Shower_master"], "Master bathroom shower")
        self.assertEqual(label["shower:Shower_shared"], "Shared bathroom shower")
        self.assertEqual(label["door:main"], "Front door")
        self.assertEqual(label["jacuzzi"], "Hot tub")
        self.assertEqual(label["fountain"], "Water wall")
        self.assertEqual(label["lights:string"], "String lights")

    def test_each_bedrooms_air_conditioner_its_flap_and_its_remote_toggle_together(self):
        labels = {"master": "Master bedroom", "bedroom2": "Bedroom 2", "bedroom3": "Bedroom 3"}
        for room, label in labels.items():
            self.assertEqual(self.group(f"ac:{room}"), {f"AC_{room}", f"AC_{room}_flap", f"AC_remote_{room}"})
            self.assertEqual(self.tags[f"AC_{room}"]["label"], f"{label} AC")
            self.assertEqual(self.tags[f"AC_{room}_flap"]["label"], f"{label} AC")
            self.assertEqual(self.tags[f"AC_remote_{room}"]["label"], f"{label} AC remote")
        self.assertEqual(interact.ac_flaps(house_layout), [(f"AC_{room}_flap", f"AC_{room}", room)
                                                            for room in ("master", "bedroom2", "bedroom3")])

    def test_the_dollhouse_cut_clips_the_chandelier_in_the_void_at_its_crown_not_at_the_ground_floors_cut(self):
        # it hangs in the double-height living room, over the ground floor's cut: clipped at the void's plane instead,
        # it still shows (and takes a click) while the cut shows the living room (AGENTS.md, Controls); under that cut
        # the plane runs at its crown (cut_top: the living room's floor, 3 m up, 2.2 m of chandelier and a 5 cm stub of
        # its cord), so no cord rises over the cut walls to the void's ceiling
        self.assertEqual(interact.UNCUT_KINDS, frozenset({"crystal_chandelier"}))
        self.assertEqual(interact.uncut(house_layout), {"Chandelier": round(0.47 + 3.0 + 2.2 + 0.05, 3)})
        top = interact.uncut(house_layout)["Chandelier"]
        self.assertTrue(house_layout.CUT_HEIGHTS[0] < top < house_layout.CUT_HEIGHTS[1], top)

    def test_group_ids_are_well_formed_and_labels_never_empty(self):
        for name, props in self.tags.items():
            self.assertRegex(props["interact"], interact.GROUP_RE, name)
            self.assertTrue(props["label"].strip(), name)

    def test_the_door_and_the_jacuzzi_name_the_clip_they_play(self):
        self.assertEqual(self.tags["Door_main"]["clip"], "act_door_open")
        for name in self.group("jacuzzi"):
            self.assertEqual(self.tags[name]["clip"], "ambient_jacuzzi", name)
        self.assertEqual({name for name, props in self.tags.items() if "clip" in props},
                         {"Door_main", "AC_master_flap", "AC_bedroom2_flap", "AC_bedroom3_flap"} | self.group("jacuzzi"))
        for room in ("master", "bedroom2", "bedroom3"):  # the louvre flap opens with its unit
            self.assertEqual(self.tags[f"AC_{room}_flap"]["clip"], f"act_ac_{room}")

    def test_every_shower_gets_falling_water(self):
        showers = [entry for entry in house_layout.FURNITURE if entry[0] == "shower"]
        self.assertEqual(len(showers), 2)
        self.assertEqual([(name, pos, rot) for name, pos, rot in interact.shower_flows(house_layout)],
                         [(f"WATER_{name}_flow", (x, y, house_layout.FLOOR_Z[room]), rot)
                          for _kind, name, room, (x, y), rot, *_ in showers])


def _room(name, level, mn, mx):
    return {"name": name, "level": level, "min": mn, "max": mx, "interior": True}


class DownlightSplitTest(unittest.TestCase):
    ROOMS = [_room("bath", 0, (-4.0, -3.0), (0.0, 3.0)), _room("porch", 0, (0.0, -3.0), (4.0, 3.0)),
             _room("attic", 1, (-4.0, -3.0), (4.0, 3.0))]

    def test_a_group_splits_into_one_object_per_room_on_its_level(self):
        groups = [{"name": "LT_down_ground", "level": 0, "z": 3.0, "points": [(-3.0, 0.0), (1.0, 0.0), (-1.0, 1.0)]},
                  {"name": "LT_down_upper", "level": 1, "z": 6.0, "points": [(0.0, 0.0)]}]
        self.assertEqual(interact.split_downlights(groups, self.ROOMS), [
            {"name": "LT_down_bath", "level": 0, "z": 3.0, "points": [(-3.0, 0.0), (-1.0, 1.0)], "room": "bath"},
            {"name": "LT_down_porch", "level": 0, "z": 3.0, "points": [(1.0, 0.0)], "room": "porch"},
            {"name": "LT_down_attic", "level": 1, "z": 6.0, "points": [(0.0, 0.0)], "room": "attic"},
        ])

    def test_a_point_on_a_shared_edge_goes_to_the_first_room(self):
        groups = [{"name": "LT_down", "level": 0, "z": 3.0, "points": [(0.0, 0.0)]}]
        self.assertEqual([g["name"] for g in interact.split_downlights(groups, self.ROOMS)], ["LT_down_bath"])

    def test_points_outside_every_room_and_groups_without_a_level_keep_their_group(self):
        groups = [{"name": "LT_down", "level": 0, "z": 3.0, "points": [(-3.0, 0.0), (4.5, 0.0)]},
                  {"name": "LT_free", "z": 2.0, "points": [(9.0, 9.0)]}]
        self.assertEqual(interact.split_downlights(groups, self.ROOMS), [
            {"name": "LT_down_bath", "level": 0, "z": 3.0, "points": [(-3.0, 0.0)], "room": "bath"},
            {"name": "LT_down", "level": 0, "z": 3.0, "points": [(4.5, 0.0)]},
            {"name": "LT_free", "z": 2.0, "points": [(9.0, 9.0)]},
        ])

    def test_two_heights_in_one_room_are_refused(self):
        groups = [{"name": "LT_a", "level": 0, "z": 3.0, "points": [(-3.0, 0.0)]},
                  {"name": "LT_b", "level": 0, "z": 2.5, "points": [(-2.0, 0.0)]}]
        with self.assertRaisesRegex(ValueError, "bath"):
            interact.split_downlights(groups, self.ROOMS)

    def test_the_house_has_one_downlight_object_per_lit_room_and_keeps_every_disc(self):
        names = [group["name"] for group in house_layout.DOWNLIGHTS]
        self.assertEqual(sorted(names), sorted(f"LT_down_{room}" for room in INTERIOR | {"balcony"}))
        self.assertEqual(sum(len(group["points"]) for group in house_layout.DOWNLIGHTS), 19 + 20 + 5)


if __name__ == "__main__":
    unittest.main()

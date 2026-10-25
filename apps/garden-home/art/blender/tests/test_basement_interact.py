"""What a click toggles in the basement (interaction spec §3.1, villa v2 spec §12 "Basement") and what the website's cut
does to its objects: each room's lights and wall switch, the karaoke's party mode, the sauna, the spa's hot tub and the
light well's lights, which join the garden's; what shows only under the basement's cut and what stands whole under it.
Pure Python."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit.catalog import FURNITURE, WALL_MOUNTED  # noqa: E402
from basement import basement_layout as L  # noqa: E402
from basement import interact  # noqa: E402
from houses.house_parts import common  # noqa: E402

GROUP_RE = re.compile(r"^[a-z]+(:[A-Za-z0-9_]+)?$")  # src/interact/groups.ts


class BasementTagsTest(unittest.TestCase):
    def setUp(self):
        self.tags = interact.tags(L)

    def test_every_room_has_a_light_group_its_downlights_and_its_switch_named_after_the_room(self):
        for room, label in L.ROOM_LABELS.items():
            self.assertEqual(self.tags[f"LT_down_{room}"], {"interact": f"light:{room}", "label": f"{label} lights"})
            self.assertEqual(self.tags[f"Switch_{room}"], {"interact": f"light:{room}",
                                                          "label": f"{label} light switch"})
        self.assertEqual(self.tags["LT_down_wine_cellar"]["label"], "Wine cellar lights")
        self.assertEqual(self.tags["LT_down_basement_hall"]["label"], "Basement lobby lights")

    def test_the_karaoke_tv_speakers_leds_and_disco_ball_are_the_party_mode(self):
        for name in (L.PARTY, L.LEDS):
            self.assertEqual(self.tags[name], {"interact": "party", "label": "Party mode"}, name)
        self.assertEqual(self.tags[L.DISCO], {"interact": "party", "label": "Party mode", "clip": "ambient_disco_ball"})

    def test_the_sauna_the_hot_tub_and_the_light_well(self):
        self.assertEqual(self.tags[L.SAUNA], {"interact": "sauna", "label": "Sauna"})
        tub = {"interact": "jacuzzi:spa", "label": "Soaking tub"}
        self.assertEqual(self.tags[L.TUB], dict(tub, clip="ambient_hot_tub"))
        self.assertEqual(self.tags[L.TUB_WATER["name"]], tub)
        self.assertEqual(self.tags["Hot_tub_bubbles_a"], tub)
        self.assertEqual(self.tags[L.WELL_LIGHTS], {"interact": "lights:garden", "label": "Garden lights"})

    def test_every_group_id_is_one_the_website_reads(self):
        for name, props in self.tags.items():
            self.assertRegex(props["interact"], GROUP_RE, name)
        self.assertEqual(interact.GROUP_RE.pattern, GROUP_RE.pattern)

    def test_the_switches_hang_under_the_cut_the_party_is_reached_on_its_speakers_too(self):
        for kind, name, room, *_ in L.FURNITURE:
            if kind == "light_switch":
                self.assertLess(L.FLOOR + WALL_MOUNTED[kind] + FURNITURE[kind][2], L.CUT, name)
        speakers = [name for kind, name, *_ in L.FURNITURE if kind == "tower_speaker"]
        self.assertTrue(all(opts.get("into") == L.PARTY for kind, name, room, pos, rot, *rest in L.FURNITURE
                            for opts in rest if kind in ("tower_speaker", "karaoke_tv")), speakers)
        self.assertLessEqual(FURNITURE["tower_speaker"][2], L.CUT - L.FLOOR)  # whole under the cut


class BasementCutTest(unittest.TestCase):
    def test_what_shows_only_under_the_basements_cut(self):
        # every wall switch and the sauna's stove, in its cabin, too: nobody sees them through the light well's glass
        buried = set(interact.buried(L))
        self.assertEqual(buried, {name for name, spec in L.OBJECTS.items() if spec.get("buried")}
                         | {f"Switch_{room}" for room in L.ROOM_LABELS})
        self.assertNotIn(L.SPA, buried)
        self.assertNotIn(L.WELL_OBJECT, buried)
        self.assertIn("Switch_spa", buried)
        self.assertIn(L.SAUNA, buried)
        self.assertIn(L.ROOMS_OBJECT, buried)

    def test_what_stands_whole_under_it_up_to_its_top(self):
        uncut = interact.uncut(L)
        self.assertEqual(set(uncut), {name for name, spec in L.OBJECTS.items() if spec.get("uncut")})
        self.assertEqual(uncut[L.WALLS], round(L.CEIL + interact.CUT_TOP_STUB, 3))
        self.assertEqual(uncut[L.RIM], interact.CUT_TOP_STUB)  # the slab's edge up to the lawn
        self.assertGreater(uncut[L.WELL_PLANTS], 1.0)  # the palm's crown over the lawn
        self.assertEqual(uncut[L.WELL_RAIL["object"]], round(L.COPING + L.WELL_RAIL["height"] + interact.CUT_TOP_STUB, 3))
        ball = round(L.CEIL + interact.CUT_TOP_STUB, 3)  # its cord up to the ceiling the cut takes away
        self.assertEqual(uncut[L.DISCO], ball)
        for name, top in uncut.items():
            self.assertGreater(top, L.CUT, name)
            self.assertLess(top, common.PLINTH + common.CUT_ABOVE_FLOOR, name)  # under the ground floor's cut


if __name__ == "__main__":
    unittest.main()

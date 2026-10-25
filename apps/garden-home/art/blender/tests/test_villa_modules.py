import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from helpers import (BLENDER_DIR, SCRIPTS_DIR, blender_available, blender_bin, glb_triangle_count, read_glb_json,
                     run_blender)

sys.path.insert(0, SCRIPTS_DIR)
from houses.house_parts.common import LEVEL_Z, PLINTH, UPPER_CEIL  # noqa: E402

MODULES = os.path.join(BLENDER_DIR, "modules")
MODULE_IDS = ("house", "pool")
GENERATORS = ("build_house.py", "build_pool.py")


def run_generator(script, *args):
    """Runs scripts/houses/<script> in a fresh headless Blender."""
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1",
           "-P", os.path.join(SCRIPTS_DIR, "houses", script), "--", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class VillaModulesTest(unittest.TestCase):
    """Glass villa spec §11, villa v2 spec §10: the committed villa modules, their exports and the generators."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.exports = {}
        for module_id in MODULE_IDS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--out-dir", cls.tmp)
            if result.returncode != 0:
                raise AssertionError(result.stderr[-2000:])
            cls.exports[module_id] = read_glb_json(os.path.join(cls.tmp, module_id + ".raw.glb"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_villa_modules_pass_the_contract(self):
        for module_id in MODULE_IDS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--check")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"CONTRACT {module_id}: ok", result.stderr)

    def test_house_ships_four_night_point_lights_in_raw_units(self):
        house = self.exports["house"]
        lights = house["extensions"]["KHR_lights_punctual"]["lights"]
        self.assertEqual({light["name"]: (light["type"], light["intensity"]) for light in lights},
                         {"L_living": ("point", 160.0), "L_kitchen": ("point", 100.0), "L_master": ("point", 60.0),
                          "L_bedroom2": ("point", 55.0)})  # tuned on the 21:00 wallpaper (the living room: the tall house)
        light_nodes = [n for n in house["nodes"] if "KHR_lights_punctual" in n.get("extensions", {})]
        self.assertEqual(len(light_nodes), 4)
        self.assertTrue(all(n["extras"]["night_light"] is True for n in light_nodes))

    def test_house_lights_are_warm_interior_white(self):
        # ~3000 K in linear RGB: red full, green about half, blue low, so rooms read amber against the blue night
        for light in self.exports["house"]["extensions"]["KHR_lights_punctual"]["lights"]:
            r, g, b = light["color"]
            self.assertEqual(r, 1.0, light["name"])
            self.assertTrue(0.5 <= g <= 0.65 and 0.2 <= b <= 0.4, (light["name"], light["color"]))

    def test_house_glass_and_frosted_panels_are_alpha_blended(self):
        materials = {m["name"]: m for m in self.exports["house"]["materials"]}
        self.assertEqual(sorted(name for name in materials if name.startswith(("GLASS_", "FROSTED_"))),
                         ["FROSTED_bath", "GLASS_clear"])
        for name, alpha in (("GLASS_clear", 0.2), ("FROSTED_bath", 0.6)):
            self.assertEqual(materials[name]["alphaMode"], "BLEND", name)
            self.assertAlmostEqual(materials[name]["pbrMetallicRoughness"]["baseColorFactor"][3], alpha, places=3)

    def test_frosted_panels_glow_at_night(self):
        house = self.exports["house"]
        frosted = [n for n in house["nodes"] if n["name"].startswith("FROSTED_")]
        self.assertEqual(sorted(n["name"] for n in frosted), ["FROSTED_bath_master", "FROSTED_bath_shared", "FROSTED_wc"])
        self.assertTrue(all(n["extras"]["night_light"] is True for n in frosted))
        material = next(m for m in house["materials"] if m["name"] == "FROSTED_bath")
        red, green, blue = material["emissiveFactor"]
        self.assertTrue(0.0 < blue < green < red <= 1.0, material["emissiveFactor"])  # warm and soft, never white

    def test_every_node_with_an_emissive_material_carries_night_light(self):
        # The runtime scales the emission of night_light nodes by the night factor; without the flag it glows by day.
        for module_id, gltf in self.exports.items():
            emissive = {i for i, m in enumerate(gltf["materials"]) if any(m.get("emissiveFactor", (0.0, 0.0, 0.0)))}
            glowing = [n["name"] for n in gltf["nodes"] if "mesh" in n
                       and any(p.get("material") in emissive for p in gltf["meshes"][n["mesh"]]["primitives"])]
            self.assertGreaterEqual(len(glowing), 4, module_id)  # the check must not pass by finding nothing
            unflagged = [name for name in glowing
                         if not next(n for n in gltf["nodes"] if n["name"] == name).get("extras", {}).get("night_light")]
            self.assertEqual(unflagged, [], module_id)

    def test_house_is_furnished_within_the_hero_budget(self):
        house = self.exports["house"]
        tris = glb_triangle_count(house)
        self.assertGreaterEqual(tris, 30000)  # villa v2 spec §5.5 estimated ~32k for the 20 x 13 m glass villa
        self.assertLessEqual(tris, 48000)  # the tall house keeps 2k of the hero's 50k free
        names = {n["name"] for n in house["nodes"]}
        self.assertGreaterEqual(sum(1 for name in names if name.startswith("GLASS_")), 40)
        self.assertGreaterEqual(sum(1 for name in names if name.startswith("FROSTED_")), 3)
        key = {"Sofa", "Kitchen_run", "Bathtub_master", "Gaming_desk", "Trellis", "Trellis_vines", "jacuzzi",
               "WATER_jacuzzi", "LT_jacuzzi", "Door_main", "HS_door", "Stair", "Chandelier", "GLASS_gallery_01",
               "GLASS_living_front_01", "GLASS_living_west_01", "GLASS_stair_hole_back_01", "Stair_pavilion",
               "AC_condensers", "GLASS_window_kitchen", "GLASS_window_gaming"}
        self.assertEqual(key - names, set())

    def test_house_is_dressed_as_a_tropical_resort(self):
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}
        key = {"Daybed_cabana", "Egg_chair", "Outdoor_bar", "Palm_living", "Monstera_living", "Fern_living_1",
               "Pendant_dining_1", "Pendant_island_1", "Pendant_master", "Palm_door_l", "Palm_door_r", "Palm_balcony",
               "Roof_palm_1", "Lantern_steps_l", "String_lights_trellis", "String_lights_railing", "reflecting_pool",
               "WATER_reflecting_pool", "reflecting_pool_steps", "fountain", "WATER_fountain", "WATER_fountain_sheet",
               "LT_fountain"}
        self.assertEqual(key - set(nodes), set())
        self.assertNotIn("LT_pendant_dining", nodes)
        pendants = sorted(name for name in nodes if name.startswith("Pendant_"))
        self.assertEqual(len(pendants), 8, pendants)
        for name in ("String_lights_trellis", "String_lights_railing", "LT_fountain", "Lantern_steps_l", *pendants):
            self.assertIs(nodes[name].get("extras", {}).get("night_light"), True, name)

    def test_outdoor_palms_sway_and_indoor_plants_stand_still(self):
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}

        def sways(name):
            primitives = house["meshes"][nodes[name]["mesh"]]["primitives"]
            return all("COLOR_0" in p["attributes"] for p in primitives)

        for name in ("Palm_door_l", "Palm_door_r", "Palm_balcony", "Roof_palm_1"):
            self.assertTrue(sways(name), name)
        for name in ("Palm_living", "Monstera_living", "Fern_living_1"):
            self.assertFalse(sways(name), name)

    def test_terrace_pieces_stand_on_the_plinth_not_two_centimetres_above_it(self):
        nodes = {n["name"]: n for n in self.exports["house"]["nodes"]}
        for name in ("Palm_door_l", "Palm_door_r", "Lantern_steps_l", "Lantern_steps_r"):
            self.assertAlmostEqual(nodes[name]["translation"][1], PLINTH, places=4, msg=name)  # glTF is Y-up

    def test_house_floors_are_travertine_downstairs_and_teak_upstairs(self):
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}

        def materials(name):
            mesh = house["meshes"][nodes[name]["mesh"]]
            return sorted({house["materials"][p["material"]]["name"] for p in mesh["primitives"]})

        self.assertEqual(materials("Floors_stone"), ["M_stone"])
        for name in ("Floors", "Soffits_wood", "Louvers_wood"):
            self.assertEqual(materials(name), ["M_teak"], name)
        self.assertIn("M_teak", materials("jacuzzi"))
        self.assertNotIn("M_floor", {m["name"] for m in house["materials"]})

    def test_house_textures_are_stone_wood_and_art(self):
        self.assertEqual(sorted(image["name"] for image in self.exports["house"]["images"]),
                         ["T_art", "T_stone", "T_wood"])

    def test_house_keeps_its_door_clip_and_hotspot_and_loops_the_jacuzzi(self):
        house = self.exports["house"]
        self.assertEqual(sorted(a["name"] for a in house["animations"]),
                         ["act_ac_bedroom2", "act_ac_bedroom3", "act_ac_master", "act_door_open", "ambient_jacuzzi"])
        hotspot = next(n for n in house["nodes"] if n["name"] == "HS_door")
        self.assertEqual(hotspot["extras"], {"action": "toggle", "clip": "act_door_open", "label": "Cửa chính",
                                             "radius": 0.8})

    def test_house_items_carry_their_click_group_and_label(self):
        # interaction spec §3.1, §4: the website toggles a group when any of its nodes is clicked
        nodes = {n["name"]: n for n in self.exports["house"]["nodes"]}
        expected = {
            "L_living": ("light:living", "Đèn phòng khách"), "LT_down_living": ("light:living", "Đèn phòng khách"),
            "Floor_lamp": ("light:living", "Đèn phòng khách"), "Pendant_island_1": ("light:kitchen", "Đèn bếp"),
            "Switch_living": ("light:living", "Công tắc đèn phòng khách"),
            "Switch_master": ("light:master", "Công tắc đèn phòng ngủ master"),
            "Nightstand_master_l": ("light:master", "Đèn phòng ngủ master"),
            "Chandelier": ("light:living", "Đèn chùm pha lê"),
            "TV_wall": ("tv:TV_wall", "TV phòng khách"), "TV_master": ("tv:TV_master", "TV phòng ngủ master"),
            "Gaming_desk": ("pc:Gaming_desk", "Máy tính"),
            "Shower_master": ("shower:Shower_master", "Vòi sen phòng tắm master"),
            "WATER_Shower_master_flow": ("shower:Shower_master", "Vòi sen phòng tắm master"),
            "Shower_shared": ("shower:Shower_shared", "Vòi sen phòng tắm chung"),
            "WATER_Shower_shared_flow": ("shower:Shower_shared", "Vòi sen phòng tắm chung"),
            "Door_main": ("door:main", "Cửa chính"), "jacuzzi": ("jacuzzi", "Bể sục"),
            "jacuzzi_bubbles_a": ("jacuzzi", "Bể sục"), "fountain": ("fountain", "Tường nước"),
            "WATER_fountain_sheet": ("fountain", "Tường nước"), "String_lights_trellis": ("lights:string", "Dây đèn"),
            "String_lights_railing": ("lights:string", "Dây đèn"),
        }
        got = {name: (nodes[name].get("extras", {}).get("interact"), nodes[name].get("extras", {}).get("label"))
               for name in expected if name in nodes}
        self.assertEqual(got, expected)
        self.assertEqual(nodes["Door_main"]["extras"]["clip"], "act_door_open")
        self.assertEqual(nodes["jacuzzi_bubbles_b"]["extras"]["clip"], "ambient_jacuzzi")

    def test_house_light_groups_each_hold_a_night_light(self):
        groups = {}
        for node in self.exports["house"]["nodes"]:
            extras = node.get("extras", {})
            if "interact" in extras:
                self.assertRegex(extras["interact"], r"^[a-z]+(:[A-Za-z0-9_]+)?$", node["name"])
                self.assertTrue(extras.get("label", "").strip(), node["name"])
                groups.setdefault(extras["interact"], []).append(extras.get("night_light") is True)
        lights = {group: flags for group, flags in groups.items() if group.startswith("light:")}
        self.assertGreaterEqual(len(lights), 16)
        self.assertEqual([group for group, flags in lights.items() if not any(flags)], [])

    def test_every_lit_room_has_a_wall_switch_that_carries_its_light_group(self):
        # interaction spec §3.1: the lamps and downlights hang above the dollhouse cut, so each room also gets a switch
        # at 1.15 m, the click target of its light:<room> group
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}
        rooms = ("living", "dining", "kitchen", "hall", "foyer", "wc", "laundry", "master", "bath_master", "closet",
                 "gallery", "gaming", "bedroom2", "bedroom3", "bath_shared", "balcony")
        labels = {"living": "phòng khách", "bath_master": "phòng tắm master", "balcony": "ban công",
                  "gallery": "hành lang", "gaming": "góc máy tính", "foyer": "tiền sảnh"}
        for room in rooms:
            node = nodes.get(f"Switch_{room}")
            self.assertIsNotNone(node, f"Switch_{room}")
            extras = node["extras"]
            self.assertEqual(extras["interact"], f"light:{room}", room)
            self.assertRegex(extras["label"], r"^Công tắc đèn .+", room)
            self.assertNotIn("night_light", extras, room)  # the switch itself never glows
            self.assertIs(extras["cast_shadow"], False, room)  # a 9 x 12 cm plate: no shadow pass for it
            self.assertNotIn("clip", extras, room)
            primitives = house["meshes"][node["mesh"]]["primitives"]
            self.assertEqual(sum(house["accessors"][p["indices"]]["count"] // 3 for p in primitives), 24, room)
        for room, label in labels.items():
            self.assertEqual(nodes[f"Switch_{room}"]["extras"]["label"], f"Công tắc đèn {label}")
        # at switch height over the floor of its level (glTF Y is up): ground floor top 0.47, upper floor top 5.28
        self.assertAlmostEqual(nodes["Switch_living"]["translation"][1], 0.47 + 1.15, places=4)
        self.assertAlmostEqual(nodes["Switch_master"]["translation"][1], 5.28 + 1.15, places=4)
        self.assertAlmostEqual(nodes["Switch_balcony"]["translation"][1], 5.28 + 1.15, places=4)

    def test_house_downlights_are_one_object_per_room_with_the_same_discs(self):
        house = self.exports["house"]
        downlights = {n["name"]: n for n in house["nodes"] if n["name"].startswith("LT_down")}
        rooms = ("living", "dining", "kitchen", "hall", "foyer", "wc", "laundry", "master", "bath_master", "closet",
                 "gallery", "gaming", "bedroom2", "bedroom3", "bath_shared", "balcony")
        self.assertEqual(sorted(downlights), sorted(f"LT_down_{room}" for room in rooms))
        self.assertTrue(all(n["extras"]["night_light"] is True for n in downlights.values()))
        discs = sum(house["accessors"][p["indices"]]["count"] // 3 for n in downlights.values()
                    for p in house["meshes"][n["mesh"]]["primitives"])
        self.assertEqual(discs, (19 + 20 + 5) * 36)  # a 10-sided disc is 36 triangles, as in the per-floor objects
        # the living room's hang in the ceiling of its void, under the roof (glTF Y is up)
        living = house["accessors"][house["meshes"][downlights["LT_down_living"]["mesh"]]["primitives"][0]["attributes"]
                                    ["POSITION"]]
        self.assertAlmostEqual(living["max"][1], UPPER_CEIL, places=3)

    def test_the_crystal_chandelier_hangs_in_the_void_from_its_ceiling_cut_at_its_crown_under_the_ground_cut(self):
        # the tall house: one merged object in three materials (the crystals one mesh, one material), a night light in
        # the living room's light group with a label of its own, which the dollhouse cut clips at the void's plane
        # (uncut), at its crown (cut_top, module space) under the ground floor's cut
        house = self.exports["house"]
        node = next(n for n in house["nodes"] if n["name"] == "Chandelier")
        self.assertEqual(node["extras"], {"night_light": True, "interact": "light:living", "label": "Đèn chùm pha lê",
                                          "uncut": True, "cut_top": 5.72})
        primitives = house["meshes"][node["mesh"]]["primitives"]
        self.assertEqual(sorted(house["materials"][p["material"]]["name"] for p in primitives),
                         ["M_brass", "M_crystal", "M_led"])
        x, y, z = node["translation"]  # glTF: x, up, -y
        self.assertEqual((round(x, 3), round(z, 3)), (-7.4, 2.8))
        lit = max(house["accessors"][p["attributes"]["POSITION"]]["max"][1] for p in primitives
                  if house["materials"][p["material"]]["name"] != "M_brass")
        self.assertLess(y + lit, node["extras"]["cut_top"])  # its crystals and bulbs, under its brass crown
        self.assertAlmostEqual(y, LEVEL_Z[0] + 3.0, places=4)  # its lowest crystal 3 m over the living room floor
        top = max(house["accessors"][p["attributes"]["POSITION"]]["max"][1] for p in primitives)
        self.assertAlmostEqual(y + top, UPPER_CEIL, places=3)  # its canopy on the ceiling of the void
        crystal = next(p for p in primitives if house["materials"][p["material"]]["name"] == "M_crystal")
        self.assertEqual(house["materials"][crystal["material"]].get("alphaMode", "OPAQUE"), "OPAQUE")
        lights = {n["name"]: n for n in house["nodes"] if "KHR_lights_punctual" in n.get("extensions", {})}
        lx, ly, lz = lights["L_living"]["translation"]
        self.assertTrue(abs(lx - x) < 1.2 and abs(lz - z) < 1.2 and y < ly < y + 2.2, lights["L_living"])

    def test_the_spiral_stair_climbs_from_the_living_room_floor_past_the_gallery_to_the_roof(self):
        house = self.exports["house"]
        node = next(n for n in house["nodes"] if n["name"] == "Stair")
        primitives = house["meshes"][node["mesh"]]["primitives"]
        self.assertEqual(sorted(house["materials"][p["material"]]["name"] for p in primitives), ["M_frame", "M_teak"])
        x, y, z = node["translation"]
        self.assertEqual((round(x, 3), round(z, 3)), (-10.05, -1.5))
        self.assertAlmostEqual(y, LEVEL_Z[0], places=4)
        teak = next(p for p in primitives if house["materials"][p["material"]]["name"] == "M_teak")
        self.assertAlmostEqual(y + house["accessors"][teak["attributes"]["POSITION"]]["max"][1], LEVEL_Z[2], places=3)
        pavilion = next(n for n in house["nodes"] if n["name"] == "Stair_pavilion")
        px, py, pz = pavilion["translation"]
        # over the stair, its slab overhanging the front and the east by 20 cm, on the roof deck
        self.assertEqual((round(px, 3), round(pz, 3)), (-9.95, -1.4))
        self.assertAlmostEqual(py, LEVEL_Z[2], places=4)
        self.assertEqual(sorted(house["materials"][p["material"]]["name"]
                                for p in house["meshes"][pavilion["mesh"]]["primitives"]),
                         ["GLASS_clear", "M_teak", "M_white"])

    def test_each_bedrooms_air_conditioner_opens_its_louvre_flap_with_its_group(self):
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}
        labels = {"master": "phòng master", "bedroom2": "phòng ngủ 2", "bedroom3": "phòng ngủ 3"}
        animations = {a["name"]: a for a in house["animations"]}
        for room, label in labels.items():
            unit, flap, remote = nodes[f"AC_{room}"], nodes[f"AC_{room}_flap"], nodes[f"AC_remote_{room}"]
            # none of them casts a shadow worth its draw call; the flap is the unit's status light, the night light
            self.assertEqual(unit["extras"], {"interact": f"ac:{room}", "label": f"Máy lạnh {label}",
                                              "cast_shadow": False})
            self.assertEqual(flap["extras"], {"night_light": True, "interact": f"ac:{room}",
                                              "label": f"Máy lạnh {label}", "clip": f"act_ac_{room}",
                                              "cast_shadow": False})
            self.assertEqual(remote["extras"], {"interact": f"ac:{room}", "label": f"Điều khiển máy lạnh {label}",
                                                "cast_shadow": False})
            # one material each: two draw calls a unit, one a remote
            for node, material in ((unit, "M_white"), (flap, "M_ac_light"), (remote, "M_screen")):
                self.assertEqual([house["materials"][p["material"]]["name"]
                                  for p in house["meshes"][node["mesh"]]["primitives"]], [material], node["name"])
            self.assertIn(house["nodes"].index(flap), unit.get("children", []))  # it hangs on the unit's hinge
            clip = animations[f"act_ac_{room}"]
            targets = {house["nodes"][c["target"]["node"]]["name"]: c["target"]["path"] for c in clip["channels"]}
            self.assertEqual(targets, {f"AC_{room}_flap": "rotation"})
            # 2.4 m over its floor (glTF Y is up): over the upper floor's cut, so the remote takes the click there
            self.assertAlmostEqual(unit["translation"][1], LEVEL_Z[1] + 2.4, places=4)
            self.assertAlmostEqual(remote["translation"][1], LEVEL_Z[1] + 1.15, places=4)
        condensers = nodes["AC_condensers"]
        self.assertEqual(condensers.get("extras"), {"cast_shadow": False})  # low, behind their screen
        self.assertEqual(sorted(house["materials"][p["material"]]["name"]
                                for p in house["meshes"][condensers["mesh"]]["primitives"]),
                         ["M_metal", "M_teak"])  # three condensers and their two screens, one object in two

    def test_every_shower_has_falling_water_under_its_rain_head(self):
        house = self.exports["house"]
        nodes = {n["name"]: n for n in house["nodes"]}
        for shower in ("Shower_master", "Shower_shared"):
            flow = nodes[f"WATER_{shower}_flow"]
            # built where the shower stands, so both share one node transform
            self.assertEqual((flow.get("translation"), flow.get("rotation")),
                             (nodes[shower].get("translation"), nodes[shower].get("rotation")), shower)
            for primitive in house["meshes"][flow["mesh"]]["primitives"]:
                position = house["accessors"][primitive["attributes"]["POSITION"]]
                (x0, z0, _), (x1, z1, _) = position["min"], position["max"]  # glTF: x, up, -y
                self.assertTrue(-0.45 <= x0 < x1 <= 0.45 and 0.05 <= z0 < z1 <= 2.03, (shower, position))

    def test_pool_has_water_and_underwater_leds_but_no_lights(self):
        pool = self.exports["pool"]
        nodes = {n["name"]: n for n in pool["nodes"]}
        self.assertIn("WATER_pool", nodes)
        leds = [n for name, n in nodes.items() if name.startswith("LT_pool_")]
        self.assertEqual(len(leds), 4)
        self.assertTrue(all(n["extras"]["night_light"] is True for n in leds))
        self.assertNotIn("KHR_lights_punctual", pool.get("extensions", {}))

    def test_pool_is_a_travertine_deck_with_teak_loungers_palms_and_lanterns(self):
        pool = self.exports["pool"]
        nodes = {n["name"]: n for n in pool["nodes"]}
        self.assertLessEqual(glb_triangle_count(pool), 15000)  # prop budget
        stone = next(m for m in pool["materials"] if m["name"] == "M_stone")
        self.assertEqual([round(c, 3) for c in stone["pbrMetallicRoughness"]["baseColorFactor"]],
                         [1.0, 0.95, 0.86, 1.0])  # the travertine tint of the resort palette
        self.assertIn("M_teak", {m["name"] for m in pool["materials"]})
        for name in ("Palm_pool_1", "Palm_pool_2"):
            primitives = pool["meshes"][nodes[name]["mesh"]]["primitives"]
            self.assertTrue(all("COLOR_0" in p["attributes"] for p in primitives), name)
        for name in ("Lantern_pool_1", "Lantern_pool_2"):
            self.assertIs(nodes[name].get("extras", {}).get("night_light"), True, name)

    def test_generators_leave_existing_files_alone(self):
        for script in GENERATORS:
            out = os.path.join(self.tmp, f"keep_{script}.blend")
            with open(out, "w", encoding="utf-8") as f:
                f.write("hand-tuned")
            result = run_generator(script, "--out", out)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn("skip:", result.stdout)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(f.read(), "hand-tuned")

    def test_regenerating_the_house_is_reproducible(self):
        glbs = []
        for run in range(2):
            blend = os.path.join(self.tmp, f"gen_{run}", "house.blend")  # module id comes from the file name
            result = run_generator("build_house.py", "--out", blend, "--force")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            out_dir = os.path.join(self.tmp, f"gen_{run}_out")
            result = run_blender(blend, "export_module.py", "--out-dir", out_dir)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            with open(os.path.join(out_dir, "house.raw.glb"), "rb") as f:
                glbs.append(f.read())
        self.assertEqual(glbs[0], glbs[1])


if __name__ == "__main__":
    unittest.main()

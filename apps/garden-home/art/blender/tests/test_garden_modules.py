"""Villa v2 part 2: the committed garden modules, their exports and their generators (garden/build_*.py)."""
import os
import shutil
import subprocess
import tempfile
import unittest

from helpers import (BLENDER_DIR, SCRIPTS_DIR, accessor_rows, blender_available, blender_bin, glb_triangle_count,
                     read_glb, read_glb_json, run_blender)

MODULES = os.path.join(BLENDER_DIR, "modules")
GENERATORS = {"fence": "build_fence.py", "garden_paths": "build_paths.py", "flower_beds": "build_beds.py",
              "veg_garden": "build_veg.py", "bbq_area": "build_bbq.py"}
# Triangles each module aims at (the prop budget is 15k) and the primitives it may draw: one draw call each at noon.
# All five together stay well under the 120 draw calls the garden may add to the ~640 of the scene at noon.
TRIS_AIM = {"fence": 7000, "garden_paths": 5000, "flower_beds": 12000, "veg_garden": 7000, "bbq_area": 6000}
PRIMITIVES_AIM = {"fence": 6, "garden_paths": 6, "flower_beds": 11, "veg_garden": 16, "bbq_area": 20}
DRAW_CALLS_BUDGET = 120
LIGHTS = {"interact": "lights:garden", "label": "Đèn sân vườn"}


def run_generator(script, *args):
    """Runs scripts/garden/<script> in a fresh headless Blender."""
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1",
           "-P", os.path.join(SCRIPTS_DIR, "garden", script), "--", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class GardenModulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.exports = {}
        for module_id in GENERATORS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--out-dir", cls.tmp)
            if result.returncode != 0:
                raise AssertionError(result.stderr[-2000:])
            cls.exports[module_id] = read_glb_json(os.path.join(cls.tmp, module_id + ".raw.glb"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def nodes(self, module_id):
        return {n["name"]: n for n in self.exports[module_id]["nodes"]}

    def materials(self, module_id, name):
        gltf = self.exports[module_id]
        mesh = gltf["meshes"][self.nodes(module_id)[name]["mesh"]]
        return sorted(gltf["materials"][p["material"]]["name"] for p in mesh["primitives"])

    def sways(self, module_id, name):
        gltf = self.exports[module_id]
        primitives = gltf["meshes"][self.nodes(module_id)[name]["mesh"]]["primitives"]
        return all("COLOR_0" in p["attributes"] for p in primitives)

    def test_garden_modules_pass_the_contract(self):
        for module_id in GENERATORS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--check")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"CONTRACT {module_id}: ok", result.stderr)

    def test_each_is_a_low_poly_prop_merged_into_a_few_objects(self):
        for module_id, gltf in self.exports.items():
            tris = glb_triangle_count(gltf)
            self.assertLessEqual(tris, TRIS_AIM[module_id], module_id)
            self.assertGreater(tris, 500, module_id)
            primitives = sum(len(gltf["meshes"][n["mesh"]]["primitives"]) for n in gltf["nodes"] if "mesh" in n)
            self.assertLessEqual(primitives, PRIMITIVES_AIM[module_id], module_id)

    def test_the_five_garden_modules_fit_the_draw_call_budget_together(self):
        primitives = sum(len(gltf["meshes"][n["mesh"]]["primitives"]) for gltf in self.exports.values()
                         for n in gltf["nodes"] if "mesh" in n)
        self.assertEqual(sorted(self.exports), sorted(TRIS_AIM))
        self.assertLessEqual(primitives, DRAW_CALLS_BUDGET // 2)  # half the budget: the rest is headroom for parts 3-4

    def test_the_vegetable_garden_sways_on_its_gravel_plot(self):
        self.assertEqual(sorted(self.nodes("veg_garden")), ["Veg_beds", "Veg_garden"])
        self.assertLessEqual({"M_teak", "M_soil", "M_cabbage", "M_leaf", "M_leaf_dark", "M_flower_red", "M_rattan"},
                             set(self.materials("veg_garden", "Veg_beds")))
        self.assertLessEqual({"M_gravel", "M_teak", "M_metal", "M_terracotta", "M_white"},
                             set(self.materials("veg_garden", "Veg_garden")))
        self.assertTrue(self.sways("veg_garden", "Veg_beds"))
        self.assertFalse(self.sways("veg_garden", "Veg_garden"))
        self.assertFalse(any(n.get("extras", {}).get("night_light") for n in self.exports["veg_garden"]["nodes"]))
        self.assertIs(self.nodes("veg_garden")["Veg_beds"].get("extras", {}).get("cast_shadow"), False)  # low beds
        self.assertNotIn("cast_shadow", self.nodes("veg_garden")["Veg_garden"].get("extras", {}))  # the shed casts one

    def test_the_barbecue_terrace_grills_under_its_pergola_and_string_lights(self):
        nodes = self.nodes("bbq_area")
        self.assertEqual(sorted(nodes), ["BBQ_coals", "BBQ_grill", "BBQ_plants", "BBQ_terrace", "Pergola",
                                         "String_lights_bbq"])
        self.assertEqual(self.materials("bbq_area", "Pergola"), ["M_teak"])
        self.assertLessEqual({"M_stone", "M_teak", "M_linen", "M_rattan", "M_metal"},
                             set(self.materials("bbq_area", "BBQ_terrace")))
        self.assertNotIn("M_ember", self.materials("bbq_area", "BBQ_grill"))
        self.assertEqual(self.materials("bbq_area", "BBQ_coals"), ["M_ember"])
        self.assertTrue(self.sways("bbq_area", "BBQ_plants"))
        # the grill is still and casts its shadow by day; only its coals are a night light; a click toggles both
        grill, coals = nodes["BBQ_grill"]["extras"], nodes["BBQ_coals"]["extras"]
        self.assertEqual({key: grill.get(key) for key in ("interact", "label", "night_light")},
                         {"interact": "bbq", "label": "Bếp nướng", "night_light": None})
        self.assertEqual({key: coals.get(key) for key in ("interact", "label", "night_light")},
                         {"interact": "bbq", "label": "Bếp nướng", "night_light": True})
        string = nodes["String_lights_bbq"]["extras"]
        self.assertEqual({key: string.get(key) for key in ("interact", "label", "night_light")},
                         {**LIGHTS, "night_light": True})
        ember = next(m for m in self.exports["bbq_area"]["materials"] if m["name"] == "M_ember")
        red, green, blue = ember["emissiveFactor"]
        self.assertTrue(red > green > blue, ember["emissiveFactor"])  # glowing coals, not a white lamp
        self.assertNotIn("T_wood", {image["name"] for image in self.exports["bbq_area"].get("images", [])})

    def test_the_garden_draws_no_point_lights_and_everything_that_glows_is_a_night_light(self):
        for module_id, gltf in self.exports.items():
            self.assertNotIn("KHR_lights_punctual", gltf.get("extensions", {}), module_id)
            emissive = {i for i, m in enumerate(gltf["materials"]) if any(m.get("emissiveFactor", (0.0, 0.0, 0.0)))}
            glowing = [n for n in gltf["nodes"] if "mesh" in n
                       and any(p.get("material") in emissive for p in gltf["meshes"][n["mesh"]]["primitives"])]
            self.assertEqual([n["name"] for n in glowing if not n.get("extras", {}).get("night_light")], [], module_id)
        for module_id in ("fence", "garden_paths", "bbq_area"):
            self.assertTrue(any(n.get("extras", {}).get("night_light") for n in self.exports[module_id]["nodes"]))

    def test_the_flower_beds_are_one_swaying_object_of_bright_flowers_leaves_soil_travertine_and_terracotta(self):
        self.assertEqual(sorted(self.nodes("flower_beds")), ["Flower_beds"])
        self.assertLessEqual({"M_flower_pink", "M_flower_yellow", "M_flower_red", "M_flower_white", "M_leaf",
                              "M_leaf_dark", "M_soil", "M_stone", "M_terracotta"},
                             set(self.materials("flower_beds", "Flower_beds")))
        self.assertTrue(self.sways("flower_beds", "Flower_beds"))
        self.assertNotIn("night_light", self.nodes("flower_beds")["Flower_beds"].get("extras", {}))
        self.assertIs(self.nodes("flower_beds")["Flower_beds"].get("extras", {}).get("cast_shadow"), False)

    def test_the_fence_is_travertine_and_teak_with_lanterns_on_its_gate_pillars(self):
        nodes = self.nodes("fence")
        self.assertEqual(sorted(name for name in nodes), ["Fence", "Gate_lamps"])
        self.assertEqual(self.materials("fence", "Fence"), ["M_stone", "M_teak"])
        self.assertEqual(self.materials("fence", "Gate_lamps"), ["GLOW_pool", "M_frame", "M_led"])  # its light pools
        self.assertFalse(self.sways("fence", "Fence"))
        lamps = nodes["Gate_lamps"]["extras"]
        self.assertEqual({key: lamps.get(key) for key in ("interact", "label", "night_light")},
                         {**LIGHTS, "night_light": True})

    def test_the_fence_runs_round_the_rim_of_the_island(self):
        gltf = self.exports["fence"]
        (primitive, *_) = gltf["meshes"][self.nodes("fence")["Fence"]["mesh"]]["primitives"]
        position = gltf["accessors"][primitive["attributes"]["POSITION"]]
        (x0, y0, z0), (x1, y1, z1) = position["min"], position["max"]  # glTF: x, up, -y
        self.assertTrue(52.0 <= x1 - x0 <= 54.0, (x0, x1))  # the 54 x 46 m island, the fence a little inside its rim
        self.assertTrue(44.0 <= z1 - z0 <= 46.0, (z0, z1))
        self.assertLessEqual(y1, 1.6)  # a low fence, gate pillars and their lanterns included

    def test_the_paths_are_travertine_and_grey_stone_with_bollards_of_the_garden_lights(self):
        nodes = self.nodes("garden_paths")
        self.assertEqual(sorted(name for name in nodes), ["Garden_lamps", "Paving"])
        self.assertEqual(self.materials("garden_paths", "Paving"), ["M_pebble", "M_stone"])
        self.assertEqual(self.materials("garden_paths", "Garden_lamps"), ["GLOW_pool", "M_frame", "M_led"])
        self.assertIs(nodes["Paving"].get("extras", {}).get("cast_shadow"), False)  # 4 to 7 cm high: no shadow
        lamps = nodes["Garden_lamps"]["extras"]
        self.assertEqual({key: lamps.get(key) for key in ("interact", "label", "night_light")},
                         {**LIGHTS, "night_light": True})

    def test_the_light_pools_carry_the_uvs_their_falloff_runs_along(self):
        for module_id, lamps in (("fence", "Gate_lamps"), ("garden_paths", "Garden_lamps")):
            gltf = self.exports[module_id]
            pools = [p for p in gltf["meshes"][self.nodes(module_id)[lamps]["mesh"]]["primitives"]
                     if gltf["materials"][p["material"]]["name"] == "GLOW_pool"]
            self.assertEqual(len(pools), 1, module_id)
            _, binary = read_glb(os.path.join(self.tmp, module_id + ".raw.glb"))
            us = {round(u, 4) for u, _ in accessor_rows(gltf, binary, pools[0]["attributes"]["TEXCOORD_0"])}
            self.assertEqual(us, {0.0, 1.0}, module_id)  # u: 0 at a pool's centre, 1 on its rim
            position = gltf["accessors"][pools[0]["attributes"]["POSITION"]]
            self.assertTrue(0.02 <= position["min"][1] <= position["max"][1] <= 0.03, module_id)  # glTF y is up

    def test_generators_leave_existing_files_alone(self):
        for script in GENERATORS.values():
            out = os.path.join(self.tmp, f"keep_{script}.blend")
            with open(out, "w", encoding="utf-8") as f:
                f.write("hand-tuned")
            result = run_generator(script, "--out", out)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn("skip:", result.stdout)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(f.read(), "hand-tuned")

    def test_regenerating_the_garden_is_reproducible_and_matches_the_committed_modules(self):
        for module_id, script in GENERATORS.items():
            blend = os.path.join(self.tmp, "gen", module_id + ".blend")  # the module id comes from the file name
            result = run_generator(script, "--out", blend, "--force")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"{module_id}: wrote", result.stdout)
            out_dir = os.path.join(self.tmp, "gen_out")
            result = run_blender(blend, "export_module.py", "--out-dir", out_dir)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            with open(os.path.join(out_dir, module_id + ".raw.glb"), "rb") as fresh, \
                    open(os.path.join(self.tmp, module_id + ".raw.glb"), "rb") as committed:
                self.assertEqual(fresh.read(), committed.read(), module_id)

    def test_a_layout_problem_stops_the_generator_before_anything_is_written(self):
        out = os.path.join(self.tmp, "refused", "garden_paths.blend")
        cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr",
               f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from garden import paths_layout as L; "
               "L.PIECES = L.PIECES + [('flower_pot', 'Pots', (0.0, 8.0), 0)]",  # the middle of the house
               "-P", os.path.join(SCRIPTS_DIR, "garden", "build_paths.py"), "--", "--out", out, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("LAYOUT garden_paths: Pots #1 (flower_pot) is in zone 'house'", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()

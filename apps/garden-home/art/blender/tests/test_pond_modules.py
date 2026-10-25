"""Villa v2 part 3: the committed pond modules, their exports and their generators (pond/build_*.py)."""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from helpers import (BLENDER_DIR, SCRIPTS_DIR, accessor_rows, blender_available, blender_bin, glb_triangle_count,
                     read_glb, run_blender, run_blender_expr)

sys.path.insert(0, SCRIPTS_DIR)
from pond import koi_layout, swim  # noqa: E402
from siteplan import zones  # noqa: E402

MODULES = os.path.join(BLENDER_DIR, "modules")
GENERATORS = {"koi_pond": "build_koi.py", "tea_garden": "build_tea.py"}
# Triangles each module aims at (the prop budget is 15k) and the primitives it may draw: one draw call each at noon.
# Both together add at most 40 draw calls to the scene at noon (less the placeholder pond's they replace).
TRIS_AIM = {"koi_pond": 9000, "tea_garden": 6000}
PRIMITIVES_AIM = {"koi_pond": 24, "tea_garden": 15}
DRAW_CALLS_BUDGET = 40
# The edges of the committed yard's lawn (Ground) that only one face uses, in Blender (x, y): its rim and its holes.
GROUND_EDGES = """
import bpy, json
bpy.ops.wm.open_mainfile(filepath={yard!r})
ground = bpy.data.objects["Ground"]
uses = {{}}
for polygon in ground.data.polygons:
    for key in polygon.edge_keys:
        uses[key] = uses.get(key, 0) + 1
ends = sorted({{v for key, n in uses.items() if n == 1 for v in key}})
print("GROUND " + json.dumps([list((ground.matrix_world @ ground.data.vertices[v].co).xy) for v in ends]))
"""
LIGHTS = {"interact": "lights:garden", "label": "Garden lights"}
WATERFALL = {"interact": "waterfall", "label": "Waterfall"}
KOI = {"M_koi_orange", "M_koi_white", "M_koi_black", "M_koi_gold"}


def run_generator(script, *args):
    """Runs scripts/pond/<script> in a fresh headless Blender."""
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1",
           "-P", os.path.join(SCRIPTS_DIR, "pond", script), "--", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


def blender_xy(position):
    """Blender (x, y) of a glTF position (x, up, -y)."""
    return position[0], -position[2]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class PondModulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.exports = {}
        for module_id in GENERATORS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--out-dir", cls.tmp)
            if result.returncode != 0:
                raise AssertionError(result.stderr[-2000:])
            cls.exports[module_id] = read_glb(os.path.join(cls.tmp, module_id + ".raw.glb"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def gltf(self, module_id):
        return self.exports[module_id][0]

    def nodes(self, module_id):
        return {n["name"]: n for n in self.gltf(module_id)["nodes"]}

    def primitives(self, module_id, name):
        return self.gltf(module_id)["meshes"][self.nodes(module_id)[name]["mesh"]]["primitives"]

    def materials(self, module_id, name):
        gltf = self.gltf(module_id)
        return sorted(gltf["materials"][p["material"]]["name"] for p in self.primitives(module_id, name))

    def rows(self, module_id, primitive, attribute):
        gltf, binary = self.exports[module_id]
        return accessor_rows(gltf, binary, primitive["attributes"][attribute])

    def weights(self, module_id, primitive):
        """The 'wind' weights (COLOR_0 red) of a primitive, 0 to 1 whichever way the exporter stored them."""
        accessor = self.gltf(module_id)["accessors"][primitive["attributes"]["COLOR_0"]]
        scale = {5121: 255.0, 5123: 65535.0}.get(accessor["componentType"], 1.0) if accessor.get("normalized") else 1.0
        return [r / scale for r, *_ in self.rows(module_id, primitive, "COLOR_0")]

    def triangles(self, module_id, primitive):
        gltf, binary = self.exports[module_id]
        positions = self.rows(module_id, primitive, "POSITION")
        indices = [i for (i,) in accessor_rows(gltf, binary, primitive["indices"])]
        return [tuple(positions[i] for i in indices[k:k + 3]) for k in range(0, len(indices), 3)]

    def by_material(self, module_id, name, material):
        gltf = self.gltf(module_id)
        return [p for p in self.primitives(module_id, name) if gltf["materials"][p["material"]]["name"] == material]

    def extras(self, module_id, name):
        return self.nodes(module_id)[name].get("extras", {})

    def sways(self, module_id, name):
        return all("COLOR_0" in p["attributes"] for p in self.primitives(module_id, name))

    def test_pond_modules_pass_the_contract(self):
        for module_id in GENERATORS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--check")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"CONTRACT {module_id}: ok", result.stderr)

    def test_each_is_a_low_poly_prop_merged_into_a_few_objects(self):
        for module_id in GENERATORS:
            gltf = self.gltf(module_id)
            tris = glb_triangle_count(gltf)
            self.assertLessEqual(tris, TRIS_AIM[module_id], module_id)
            self.assertGreater(tris, 1000, module_id)
            primitives = sum(len(gltf["meshes"][n["mesh"]]["primitives"]) for n in gltf["nodes"] if "mesh" in n)
            self.assertLessEqual(primitives, PRIMITIVES_AIM[module_id], module_id)

    def test_the_two_modules_fit_the_draw_call_budget_together(self):
        primitives = sum(len(self.gltf(m)["meshes"][n["mesh"]]["primitives"]) for m in GENERATORS
                         for n in self.gltf(m)["nodes"] if "mesh" in n)
        glow = sum(1 for m in GENERATORS for p in self.gltf(m)["meshes"] for q in p["primitives"]
                   if self.gltf(m)["materials"][q["material"]]["name"].startswith("GLOW_"))
        self.assertLessEqual(primitives - glow, DRAW_CALLS_BUDGET)  # a light pool is not drawn by day

    def test_the_pond_draws_no_point_lights_and_nothing_glows(self):
        for module_id in ("koi_pond",):
            gltf = self.gltf(module_id)
            self.assertNotIn("KHR_lights_punctual", gltf.get("extensions", {}))
            self.assertEqual([m["name"] for m in gltf["materials"] if any(m.get("emissiveFactor", (0, 0, 0)))], [])
            self.assertFalse(any(n.get("extras", {}).get("night_light") for n in gltf["nodes"]))

    def test_the_koi_pond_is_its_bank_stones_rockery_water_waterfall_koi_lotus_and_hotspot(self):
        self.assertEqual(sorted(self.nodes("koi_pond")),
                         ["HS_pond", "Koi", "Lotus", "Pond_bank", "Pond_stones", "Rockery", "WATER_surface",
                          "WATER_waterfall_sheet", "Waterfall_foam"])
        self.assertEqual(self.extras("koi_pond", "HS_pond"), {"action": "focus", "label": "Koi pond", "radius": 4.5})

    def test_the_bank_falls_from_the_lawn_through_a_green_band_and_mud_to_the_dark_floor(self):
        self.assertEqual(self.materials("koi_pond", "Pond_bank"), ["M_moss", "M_pond_bank", "M_pond_floor"])
        self.assertIs(self.extras("koi_pond", "Pond_bank").get("cast_shadow"), False)
        heights = {}
        for material in ("M_moss", "M_pond_bank", "M_pond_floor"):
            (primitive,) = self.by_material("koi_pond", "Pond_bank", material)
            ys = [y for _, y, _ in self.rows("koi_pond", primitive, "POSITION")]
            heights[material] = (min(ys), max(ys))
        self.assertAlmostEqual(heights["M_moss"][1], 0.0, places=3)  # the grass edge at the lawn's height
        self.assertLess(heights["M_moss"][0], koi_layout.WATER_Z)  # the green band reaches into the water
        self.assertAlmostEqual(heights["M_pond_floor"][0], koi_layout.PROFILE[-1][1], places=3)
        self.assertLess(heights["M_pond_floor"][1], koi_layout.WATER_Z - 0.3)  # the floor lies deep
        (green,) = self.by_material("koi_pond", "Pond_bank", "M_moss")
        rim = {(round(x, 3), round(y, 3)) for x, y in map(blender_xy, self.rows("koi_pond", green, "POSITION"))}
        self.assertLessEqual({(round(x, 3), round(y, 3)) for x, y in koi_layout.OUTLINE}, rim)  # meets the lawn's hole

    def test_the_water_lies_flat_just_below_the_lawn_over_the_whole_pond(self):
        self.assertEqual(self.materials("koi_pond", "WATER_surface"), ["M_water"])
        (primitive,) = self.primitives("koi_pond", "WATER_surface")
        points = self.rows("koi_pond", primitive, "POSITION")
        self.assertEqual({round(y, 4) for _, y, _ in points}, {koi_layout.WATER_Z})
        xs = [x for x, _, _ in points]
        outline = [x for x, _ in koi_layout.OUTLINE]
        self.assertGreater(max(xs) - min(xs), 0.95 * (max(outline) - min(outline)))
        self.assertLessEqual(max(xs) - min(xs), max(outline) - min(outline))

    def test_the_pond_and_its_waterfall_take_the_websites_pond_water(self):
        for name in ("WATER_surface", "WATER_waterfall_sheet"):  # darker, greener and calmer than the pool's
            self.assertEqual(self.extras("koi_pond", name).get("water"), "pond", name)

    def test_a_click_on_the_pond_feeds_the_koi(self):
        extras = self.extras("koi_pond", "WATER_surface")
        self.assertEqual({key: extras.get(key) for key in ("interact", "label")},
                         {"interact": "koi", "label": "Feed the koi"})

    def test_stones_line_the_edge(self):
        self.assertEqual(self.materials("koi_pond", "Pond_stones"), ["M_rock", "M_rock_light"])
        self.assertIs(self.extras("koi_pond", "Pond_stones").get("cast_shadow"), False)

    def test_the_rockery_is_limestone_moss_and_swaying_shrubs_and_a_click_on_it_toggles_the_waterfall(self):
        self.assertLessEqual({"M_rock", "M_rock_light", "M_moss", "M_bark", "M_leaf"},
                             set(self.materials("koi_pond", "Rockery")))
        self.assertTrue(self.sways("koi_pond", "Rockery"))
        for material in ("M_rock", "M_rock_light"):  # only the shrubs sway, never the rock
            for primitive in self.by_material("koi_pond", "Rockery", material):
                self.assertEqual(max(self.weights("koi_pond", primitive)), 0.0, material)
        self.assertNotIn("cast_shadow", self.extras("koi_pond", "Rockery"))  # a tall rock casts its shadow
        for name in ("Rockery", "WATER_waterfall_sheet", "Waterfall_foam"):
            extras = self.extras("koi_pond", name)
            self.assertEqual({key: extras.get(key) for key in WATERFALL}, WATERFALL, name)
        tallest = max(y for p in self.primitives("koi_pond", "Rockery") for _, y, _ in self.rows("koi_pond", p, "POSITION"))
        self.assertGreater(tallest, 1.8)

    def test_the_waterfall_falls_in_a_steep_sheet_from_the_rock_into_the_pond_onto_its_foam(self):
        (sheet,) = self.primitives("koi_pond", "WATER_waterfall_sheet")
        ys = [y for _, y, _ in self.rows("koi_pond", sheet, "POSITION")]
        top = koi_layout.WATERFALL["top"][2]
        self.assertAlmostEqual(max(ys), top, places=3)
        self.assertLess(min(ys), koi_layout.WATER_Z)  # it reaches under the water
        steep = total = 0.0
        for a, b, c in self.triangles("koi_pond", sheet):  # the water shader streaks faces steeper than 60 degrees
            u = [b[i] - a[i] for i in range(3)]
            v = [c[i] - a[i] for i in range(3)]
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            area = math.sqrt(sum(k * k for k in n)) / 2
            total += area
            steep += area if n[1] * n[1] < 0.25 * sum(k * k for k in n) else 0.0
        self.assertGreater(steep / total, 0.85)
        self.assertEqual(self.materials("koi_pond", "Waterfall_foam"), ["M_foam"])
        (foam,) = self.primitives("koi_pond", "Waterfall_foam")
        points = self.rows("koi_pond", foam, "POSITION")
        self.assertTrue(all(abs(y - koi_layout.WATER_Z) < 0.12 for _, y, _ in points))  # it floats on the water
        fall = koi_layout.WATERFALL
        (x, y, _), facing = fall["top"], math.radians(fall["facing"])
        foot = (x + math.cos(facing) * fall["throw"], y + math.sin(facing) * fall["throw"])
        middle = [sum(c) / len(points) for c in zip(*map(blender_xy, points))]
        self.assertLess(math.dist(middle, foot), 0.15)

    def test_the_koi_are_one_object_that_swims_in_the_websites_vertex_shader(self):
        koi = self.extras("koi_pond", "Koi")
        self.assertEqual(len(koi["koi"]), 12 * len(koi_layout.KOI))
        for got, want in zip(koi["koi"], swim.pack(koi_layout.KOI)):
            self.assertAlmostEqual(got, want, places=5)
        self.assertAlmostEqual(koi["koi_water"], koi_layout.WATER_Z, places=5)
        # the feeding disc (x, y, radius): the website drops the food a click puts on the pond inside it
        feeding = koi_layout.FEEDING
        for got, want in zip(koi["koi_feed"], (*feeding["centre"], feeding["radius"])):
            self.assertAlmostEqual(got, want, places=5)
        self.assertEqual(len(koi["koi_feed"]), 3)
        self.assertIs(koi.get("cast_shadow"), False)
        self.assertEqual(set(self.materials("koi_pond", "Koi")), KOI)
        self.assertFalse(any("COLOR_0" in p["attributes"] for p in self.primitives("koi_pond", "Koi")))
        fish = {}  # index -> Blender points; the "koi" UV map numbers the fish: u = (index + 0.5) / 16
        for primitive in self.primitives("koi_pond", "Koi"):
            uvs = self.rows("koi_pond", primitive, "TEXCOORD_1")
            for (u, _), point in zip(uvs, self.rows("koi_pond", primitive, "POSITION")):
                fish.setdefault(int(u * 16), []).append(point)
        self.assertEqual(sorted(fish), list(range(len(koi_layout.KOI))))
        for index, loop in enumerate(koi_layout.KOI):  # each stands where its loop starts, its nose the way it swims
            x, y, z = swim.position(loop, 0.0)
            points = [(px, -pz, py) for px, py, pz in fish[index]]
            nose = max(points, key=lambda p: math.sin(swim.heading(loop, 0.0)) * (p[0] - x)
                       - math.cos(swim.heading(loop, 0.0)) * (p[1] - y))
            (nose_xy, _) = swim.body(loop, 0.0, koi_layout.KOI_LENGTH)
            self.assertLess(math.dist(nose[:2], nose_xy), 0.03, index)
            self.assertTrue(all(z - 1e-3 <= p[2] <= z + koi_layout.KOI_TOP + 1e-3 for p in points), index)

    def test_the_lotus_floats_on_the_water_and_drifts_a_little(self):
        self.assertLessEqual({"M_lotus_pad", "M_leaf", "M_lotus", "M_flower_white", "M_flower_yellow"},
                             set(self.materials("koi_pond", "Lotus")))
        self.assertTrue(self.sways("koi_pond", "Lotus"))
        self.assertIs(self.extras("koi_pond", "Lotus").get("cast_shadow"), False)
        weights = [w for p in self.primitives("koi_pond", "Lotus") for w in self.weights("koi_pond", p)]
        self.assertTrue(0.0 < min(weights) and max(weights) <= 0.45, (min(weights), max(weights)))
        lowest = min(y for p in self.primitives("koi_pond", "Lotus") for _, y, _ in self.rows("koi_pond", p, "POSITION"))
        self.assertAlmostEqual(lowest, koi_layout.LOTUS_Z, delta=0.005)

    def test_the_tea_corner_is_its_table_stools_and_paving_its_bonsai_and_its_lantern(self):
        self.assertEqual(sorted(self.nodes("tea_garden")), ["Bonsai", "Stone_lantern", "Tea_corner"])
        self.assertLessEqual({"M_granite", "M_stone", "M_teak", "M_terracotta", "M_ceramic"},
                             set(self.materials("tea_garden", "Tea_corner")))
        self.assertNotIn("cast_shadow", self.extras("tea_garden", "Tea_corner"))  # the table shades the paving
        self.assertFalse(self.sways("tea_garden", "Tea_corner"))
        self.assertLessEqual({"M_granite", "M_glaze", "M_bark", "M_leaf", "M_leaf_dark"},
                             set(self.materials("tea_garden", "Bonsai")))
        self.assertTrue(self.sways("tea_garden", "Bonsai"))
        self.assertIs(self.extras("tea_garden", "Bonsai").get("cast_shadow"), False)
        self.assertEqual(self.materials("tea_garden", "Stone_lantern"), ["GLOW_pool", "M_granite", "M_led"])
        lantern = self.extras("tea_garden", "Stone_lantern")
        self.assertEqual({key: lantern.get(key) for key in ("interact", "label", "night_light")},
                         {**LIGHTS, "night_light": True})
        gltf = self.gltf("tea_garden")
        self.assertNotIn("KHR_lights_punctual", gltf.get("extensions", {}))
        emissive = {i for i, m in enumerate(gltf["materials"]) if any(m.get("emissiveFactor", (0.0, 0.0, 0.0)))}
        glowing = [n["name"] for n in gltf["nodes"] if "mesh" in n
                   and any(p.get("material") in emissive for p in gltf["meshes"][n["mesh"]]["primitives"])]
        self.assertEqual(glowing, ["Stone_lantern"])

    def test_the_tea_corners_paving_and_stepping_stones_lie_low_on_the_lawn(self):
        (paving,) = self.by_material("tea_garden", "Tea_corner", "M_stone")
        ys = [y for _, y, _ in self.rows("tea_garden", paving, "POSITION")]
        self.assertEqual((round(min(ys), 4), round(max(ys), 4)), (0.0, 0.05))  # 3 cm paving, 5 cm stepping stones

    def test_the_committed_yards_lawn_has_the_hole_of_the_current_pond_outline(self):
        # the yard cuts its lawn round koi_layout.OUTLINE where the pond's slot stands (dev/make_placeholders.py): when
        # the outline changes, the yard is regenerated too (pnpm --filter @ncam/garden-home art:models -- --force --only koi_pond yard site)
        result = run_blender_expr(GROUND_EDGES.format(yard=os.path.join(MODULES, "yard.blend")))
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        line = next(line for line in result.stdout.splitlines() if line.startswith("GROUND "))
        ends = [tuple(point) for point in json.loads(line[len("GROUND "):])]
        (slot,) = [spec for spec in zones.SLOTS.values() if spec["module"] == koi_layout.MODULE_ID]
        (sx, sy), yaw = slot["pos"], math.radians(slot["yaw"])
        hole = [(sx + math.cos(yaw) * x - math.sin(yaw) * y, sy + math.sin(yaw) * x + math.cos(yaw) * y)
                for x, y in koi_layout.OUTLINE]
        for point in hole:
            self.assertLess(min(math.dist(point, end) for end in ends), 1e-3, point)
        near = [end for end in ends if min(math.dist(end, point) for point in hole) < 0.5]  # not the island's rim
        self.assertEqual(len(near), len(hole))

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

    def test_regenerating_the_pond_is_reproducible_and_matches_the_committed_modules(self):
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
        out = os.path.join(self.tmp, "refused", "koi_pond.blend")
        cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr",
               f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from pond import koi_layout as L; "
               "L.PADS = L.PADS + [L.PADS[0]]",  # a second pad on the first
               "-P", os.path.join(SCRIPTS_DIR, "pond", "build_koi.py"), "--", "--out", out, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn(f"LAYOUT koi_pond: pad 1 overlaps pad {len(koi_layout.PADS) + 1}", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()

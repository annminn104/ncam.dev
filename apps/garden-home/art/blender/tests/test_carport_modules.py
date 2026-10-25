"""Villa v2 part 4: the committed carport and kennel modules, their exports and their generators
(carport/build_*.py)."""
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from helpers import (BLENDER_DIR, SCRIPTS_DIR, accessor_rows, blender_available, blender_bin, glb_triangle_count,
                     read_glb, run_blender)

sys.path.insert(0, SCRIPTS_DIR)
from carport import carport_layout, kennel_layout, layout_check  # noqa: E402
from garden import paths_layout  # noqa: E402

MODULES = os.path.join(BLENDER_DIR, "modules")
GENERATORS = {"carport": "build_carport.py", "kennel": "build_kennel.py"}
# Triangles each module aims at (the prop budget is 15k) and the primitives it may draw: one draw call each at noon.
# Both together add at most 40 draw calls to the scene at noon.
TRIS_AIM = {"carport": (2000, 9000), "kennel": (1000, 5000)}  # readable, and low-poly
PRIMITIVES_AIM = {"carport": 23, "kennel": 16}
DRAW_CALLS_BUDGET = 40
LIGHTS = {"interact": "lights:carport", "label": "Carport lights"}
PICKUP = {"interact": "lights:car_pickup", "label": "Pickup truck lights"}
SUPERCAR = {"interact": "lights:car_super", "label": "Supercar lights"}
DOG = {"interact": "dog", "label": "Akita pup", "clip": "act_dog_happy"}
CLIPS = {"ambient_dog_breathe": {"Akita": ["scale"]}, "ambient_dog_tail": {"Akita_tail": ["rotation"]},
         "act_dog_happy": {"Akita": ["rotation", "translation"], "Akita_head": ["rotation"],
                           "Akita_tail": ["rotation"]}}


def run_generator(script, *args):
    """Runs scripts/carport/<script> in a fresh headless Blender."""
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1",
           "-P", os.path.join(SCRIPTS_DIR, "carport", script), "--", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


def blender_xyz(position):
    """Blender (x, y, z) of a glTF position (x, up, -y)."""
    return position[0], -position[2], position[1]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class CarportModulesTest(unittest.TestCase):
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

    def by_material(self, module_id, name, material):
        gltf = self.gltf(module_id)
        return [p for p in self.primitives(module_id, name) if gltf["materials"][p["material"]]["name"] == material]

    def points(self, module_id, name, material=None):
        """Blender (x, y, z) of every vertex of a node's mesh (of one material only, if given), in module space."""
        gltf, binary = self.exports[module_id]
        node = self.nodes(module_id)[name]
        tx, ty, tz = node.get("translation", (0.0, 0.0, 0.0))
        found = []
        for primitive in self.primitives(module_id, name):
            if material is not None and gltf["materials"][primitive["material"]]["name"] != material:
                continue
            found += [blender_xyz((x + tx, y + ty, z + tz))
                      for x, y, z in accessor_rows(gltf, binary, primitive["attributes"]["POSITION"])]
        return found

    def extent(self, module_id, name, material=None):
        xs, ys, zs = zip(*self.points(module_id, name, material))
        return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

    def extras(self, module_id, name):
        return self.nodes(module_id)[name].get("extras", {})

    def test_the_carport_and_the_kennel_pass_the_contract(self):
        for module_id in GENERATORS:
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--check")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"CONTRACT {module_id}: ok", result.stderr)

    def test_each_is_a_low_poly_prop_merged_into_a_few_objects(self):
        for module_id in GENERATORS:
            gltf = self.gltf(module_id)
            tris = glb_triangle_count(gltf)
            least, most = TRIS_AIM[module_id]
            self.assertTrue(least < tris <= most, (module_id, tris))
            primitives = sum(len(gltf["meshes"][n["mesh"]]["primitives"]) for n in gltf["nodes"] if "mesh" in n)
            self.assertLessEqual(primitives, PRIMITIVES_AIM[module_id], module_id)

    def test_the_carport_is_its_floor_its_roof_and_posts_its_downlights_and_two_cars_with_their_lights(self):
        self.assertEqual(sorted(self.nodes("carport")),
                         ["Carport", "Carport_floor", "Carport_glass", "Carport_lights", "Pickup", "Pickup_lights",
                          "Supercar", "Supercar_lights"])
        gltf = self.gltf("carport")
        self.assertNotIn("KHR_lights_punctual", gltf.get("extensions", {}))  # no point lights: emissive and pools only

    def test_the_floor_is_a_travertine_slab_flush_with_the_driveway_that_casts_no_shadow(self):
        self.assertEqual(self.materials("carport", "Carport_floor"), ["M_stone"])
        self.assertIs(self.extras("carport", "Carport_floor").get("cast_shadow"), False)
        x0, x1, y0, y1, z0, z1 = self.extent("carport", "Carport_floor")
        sx0, sy0, sx1, sy1 = carport_layout.SLAB
        for got, want in ((x0, sx0), (x1, sx1), (y0, sy0), (y1, sy1), (z0, 0.0), (z1, carport_layout.SLAB_TOP)):
            self.assertAlmostEqual(got, want, places=4)

    def test_the_roof_is_glass_over_teak_louvres_in_a_white_fascia_on_dark_posts_a_travertine_pillar_and_wall(self):
        self.assertEqual(self.materials("carport", "Carport"), ["M_frame", "M_stone", "M_teak", "M_white"])
        self.assertNotIn("cast_shadow", self.extras("carport", "Carport"))  # the louvres shade the cars
        roof, found = carport_layout.ROOF, layout_check.heights(carport_layout)
        x0, x1, y0, y1, z0, z1 = self.extent("carport", "Carport", "M_white")
        self.assertAlmostEqual(z1, roof["top"], places=4)
        self.assertAlmostEqual(x1 - x0, roof["max"][0] - roof["min"][0], places=4)
        self.assertAlmostEqual(y1 - y0, roof["max"][1] - roof["min"][1], places=4)
        self.assertEqual(self.materials("carport", "Carport_glass"), ["GLASS_clear"])
        gx0, gx1, gy0, gy1, gz0, gz1 = self.extent("carport", "Carport_glass")
        self.assertAlmostEqual(gz0, found["glass"], places=4)  # a sheet over the whole roof inside the fascia
        self.assertAlmostEqual(gx1 - gx0, roof["max"][0] - roof["min"][0] - 2 * roof["fascia"], places=4)
        slats = [p for p in self.points("carport", "Carport", "M_teak") if p[2] > roof["under"]]
        self.assertAlmostEqual(min(z for _, _, z in slats), found["slats"], places=4)
        self.assertGreater(max(x for x, _, _ in slats) - min(x for x, _, _ in slats),
                           0.9 * (roof["max"][0] - roof["min"][0] - 2 * roof["fascia"]))
        steel = self.extent("carport", "Carport", "M_frame")
        self.assertGreaterEqual(steel[5], roof["under"] - 1e-4)  # the posts carry the fascia
        self.assertEqual(self.extras("carport", "Carport").get("interact"), LIGHTS["interact"])
        # the glass sheet is no item of its own: a click aimed at a car from above goes through it (web interact/pick)
        self.assertNotIn("interact", self.extras("carport", "Carport_glass"))

    def test_the_downlights_glow_at_night_and_pool_their_light_on_the_floor(self):
        self.assertEqual(self.materials("carport", "Carport_lights"), ["GLOW_pool", "M_led"])
        extras = self.extras("carport", "Carport_lights")
        self.assertEqual({key: extras.get(key) for key in ("interact", "label", "night_light")},
                         {**LIGHTS, "night_light": True})
        x0, x1, y0, y1, z0, z1 = self.extent("carport", "Carport_lights", "M_led")
        self.assertAlmostEqual(z1, layout_check.heights(carport_layout)["beams"], places=3)  # under the beams
        pools = self.extent("carport", "Carport_lights", "GLOW_pool")
        self.assertTrue(carport_layout.SLAB_TOP < pools[4] == pools[5] < carport_layout.SLAB_TOP + 0.02, pools)

    def test_the_cars_stand_on_the_floor_in_their_bays_their_lights_night_lights_a_click_switches(self):
        for car, tags in zip(carport_layout.CARS, (PICKUP, SUPERCAR)):
            name, lights = car["name"], car["lights"]
            body = set(self.materials("carport", name))
            self.assertIn("GLASS_tinted", body, name)
            self.assertIn("M_rubber", body, name)
            self.assertFalse({"M_headlight", "M_taillight"} & body, name)
            self.assertEqual(self.materials("carport", lights), ["GLOW_beam", "M_headlight", "M_taillight"])
            self.assertEqual({key: self.extras("carport", name).get(key) for key in tags}, tags, name)
            self.assertNotIn("night_light", self.extras("carport", name))
            extras = self.extras("carport", lights)
            self.assertEqual({key: extras.get(key) for key in ("interact", "label", "night_light")},
                             {**tags, "night_light": True}, lights)
            x0, x1, y0, y1, z0, z1 = self.extent("carport", name)
            self.assertAlmostEqual(z0, carport_layout.SLAB_TOP, places=3)
            self.assertAlmostEqual((x0 + x1) / 2, car["pos"][0], places=2)
            hx0, hx1, hy0, hy1, _, _ = self.extent("carport", lights, "M_headlight")
            self.assertLess(hy0, y0 + 0.1, name)  # headlights at the nose, towards the driveway
            bx0, bx1, by0, by1, bz0, bz1 = self.extent("carport", lights, "GLOW_beam")
            self.assertTrue(by1 <= y0 + 0.11 and by0 < y0 - 1.0, (name, by0, by1, y0))  # their light ahead of it
            self.assertAlmostEqual(bz0, bz1, places=4)  # flat on the ground
            # just over the driveway's kerbs, which would cut dark stripes through a pool lying under their top
            self.assertTrue(paths_layout.KERB_TOP < bz0 < paths_layout.KERB_TOP + 0.02, (name, bz0))
        self.assertIn("M_paint_green", self.materials("carport", "Pickup"))
        self.assertIn("M_paint_red", self.materials("carport", "Supercar"))

    def test_only_the_lights_glow(self):
        gltf = self.gltf("carport")
        emissive = {i for i, m in enumerate(gltf["materials"]) if any(m.get("emissiveFactor", (0.0, 0.0, 0.0)))}
        glowing = sorted(n["name"] for n in gltf["nodes"] if "mesh" in n
                         and any(p.get("material") in emissive for p in gltf["meshes"][n["mesh"]]["primitives"]))
        self.assertEqual(glowing, ["Carport_lights", "Pickup_lights", "Supercar_lights"])
        for name in glowing:
            self.assertIs(self.extras("carport", name).get("night_light"), True, name)

    def test_the_two_modules_fit_the_draw_call_budget_together(self):
        primitives = sum(len(self.gltf(m)["meshes"][n["mesh"]]["primitives"]) for m in GENERATORS
                         for n in self.gltf(m)["nodes"] if "mesh" in n)
        glow = sum(1 for m in GENERATORS for p in self.gltf(m)["meshes"] for q in p["primitives"]
                   if self.gltf(m)["materials"][q["material"]]["name"].startswith("GLOW_"))
        self.assertLessEqual(primitives - glow, DRAW_CALLS_BUDGET)  # a light pool is not drawn by day

    def test_the_kennel_is_the_dog_house_the_dogs_corner_and_the_akita_with_its_head_and_tail(self):
        self.assertEqual(sorted(self.nodes("kennel")), ["Akita", "Akita_head", "Akita_tail", "Dog_corner", "Kennel"])
        nodes, names = self.gltf("kennel")["nodes"], [n["name"] for n in self.gltf("kennel")["nodes"]]
        children = sorted(names[i] for i in self.nodes("kennel")["Akita"].get("children", []))
        self.assertEqual(children, ["Akita_head", "Akita_tail"])  # they turn and wag on the dog as it moves
        self.assertEqual(self.materials("kennel", "Kennel"), ["M_frame", "M_metal", "M_teak"])
        self.assertNotIn("cast_shadow", self.extras("kennel", "Kennel"))
        self.assertEqual(self.materials("kennel", "Dog_corner"),
                         ["M_fabric_dark", "M_flower_red", "M_leaf", "M_teak", "M_water"])
        self.assertIs(self.extras("kennel", "Dog_corner").get("cast_shadow"), False)
        self.assertTrue(any("COLOR_0" in p["attributes"] for p in self.primitives("kennel", "Dog_corner")))  # the bush
        self.assertEqual(self.materials("kennel", "Akita"), ["M_akita_cream", "M_akita_red"])
        self.assertEqual(self.materials("kennel", "Akita_head"), ["M_akita_cream", "M_akita_red", "M_dog_dark"])
        self.assertEqual(self.materials("kennel", "Akita_tail"), ["M_akita_cream", "M_akita_red"])
        gltf = self.gltf("kennel")
        self.assertNotIn("KHR_lights_punctual", gltf.get("extensions", {}))
        self.assertEqual([m["name"] for m in gltf["materials"] if any(m.get("emissiveFactor", (0, 0, 0)))], [])

    def test_a_click_on_the_akita_plays_its_happy_clip(self):
        extras = self.extras("kennel", "Akita")
        self.assertEqual({key: extras.get(key) for key in DOG}, DOG)
        for name in ("Akita_head", "Akita_tail"):  # the click finds the dog through its parent
            self.assertNotIn("interact", self.extras("kennel", name))

    def test_the_akita_sits_on_its_mat_facing_the_wallpaper_camera(self):
        node = self.nodes("kennel")["Akita"]
        x, _, z = node["translation"]
        dog = kennel_layout.DOG
        self.assertAlmostEqual(x, dog["pos"][0], places=3)
        self.assertAlmostEqual(-z, dog["pos"][1], places=3)
        qx, qy, qz, qw = node["rotation"]  # a turn about glTF's up axis by the dog's yaw
        self.assertAlmostEqual(math.degrees(2 * math.atan2(qy, qw)), dog["yaw"], places=1)
        self.assertLess(abs(qx) + abs(qz), 1e-5)

    def test_the_akita_breathes_and_wags_in_loops_and_plays_a_happy_clip_once(self):
        gltf, binary = self.exports["kennel"]
        names = [n["name"] for n in gltf["nodes"]]
        found = {}
        for animation in gltf.get("animations", []):
            targets = {}
            for channel in animation["channels"]:
                targets.setdefault(names[channel["target"]["node"]], []).append(channel["target"]["path"])
            found[animation["name"]] = {node: sorted(paths) for node, paths in targets.items()}
            times = [t for sampler in animation["samplers"] for (t,) in accessor_rows(gltf, binary, sampler["input"])]
            self.assertAlmostEqual(min(times), 0.0, places=4)  # keyed from frame 0: no held first frame
            length = {"ambient_dog_breathe": kennel_layout.BREATHE, "ambient_dog_tail": kennel_layout.WAG,
                      "act_dog_happy": kennel_layout.HAPPY}[animation["name"]]["frames"] / 24
            self.assertAlmostEqual(max(times), length, places=3, msg=animation["name"])
            for sampler in animation["samplers"]:  # loops without a seam, and the happy clip ends at rest
                values = accessor_rows(gltf, binary, sampler["output"])
                for a, b in zip(values[0], values[-1]):
                    self.assertAlmostEqual(a, b, places=4, msg=animation["name"])
        self.assertEqual(found, CLIPS)

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

    def test_regenerating_is_reproducible_and_matches_the_committed_module(self):
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
        out = os.path.join(self.tmp, "refused", "carport.blend")
        cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr",
               f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from carport import carport_layout as L; "
               "L.CARS = [dict(L.CARS[0], pos=(L.POSTS[1][0] - 0.9, L.POSTS[1][1]))] + L.CARS[1:]",
               "-P", os.path.join(SCRIPTS_DIR, "carport", "build_carport.py"), "--", "--out", out, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("LAYOUT carport: Pickup overlaps post 2", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()

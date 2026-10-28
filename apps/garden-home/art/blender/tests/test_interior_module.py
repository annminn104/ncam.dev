"""The committed interior module, its export and its generator (interior/
build_interior.py), and the house without its old curtain."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from helpers import (BLENDER_DIR, SCRIPTS_DIR, accessor_rows, blender_available, blender_bin, glb_triangle_count,
                     read_glb, run_blender)

sys.path.insert(0, SCRIPTS_DIR)
from archkit.catalog import CURTAIN  # noqa: E402
from houses.house_parts import common  # noqa: E402
from interior import interact  # noqa: E402
from interior import interior_layout as L  # noqa: E402

MODULES = os.path.join(BLENDER_DIR, "modules")
GENERATOR = os.path.join(SCRIPTS_DIR, "interior", "build_interior.py")
TRIS_AIM = (6000, 15000)  # a prop: 15k triangles
# What the wallpaper draws of the interior: one draw call per primitive, the decor in at most nine (one per material of
# its small palette), each lamp object one; a dozen for what it draws of the module (the wallpaper's budget is +15); the
# details, drawn only while the camera is near the house, in at most ten.
DECOR_DRAWS = 9
DETAIL_DRAWS = 10
DRAWS = 12
PALETTE = {"M_linen", "M_drape", "M_sheer", "M_teak", "M_bronze", "M_ceramic", "M_leaf", "M_terracotta", "M_rattan",
           "M_stone", "M_glassware"}
# The fabric's hem: at least this far over the floor (the curtains never touch it).
HEM_CLEAR = 0.01


def blender_xyz(position):
    """Blender (x, y, z) of a glTF position (x, up, -y)."""
    return position[0], -position[2], position[1]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class InteriorModuleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        result = run_blender(os.path.join(MODULES, "interior.blend"), "export_module.py", "--out-dir", cls.tmp)
        if result.returncode != 0:
            raise AssertionError(result.stderr[-2000:])
        cls.gltf, cls.binary = read_glb(os.path.join(cls.tmp, "interior.raw.glb"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def nodes(self):
        return {n["name"]: n for n in self.gltf["nodes"]}

    def extras(self, name):
        return self.nodes()[name].get("extras", {})

    def primitives(self, name):
        return self.gltf["meshes"][self.nodes()[name]["mesh"]]["primitives"]

    def materials(self, name):
        return sorted(self.gltf["materials"][p["material"]]["name"] for p in self.primitives(name))

    def points(self, name, material=None):
        """Blender (x, y, z) of a node's vertices (of one material only, if given), in module space."""
        node = self.nodes()[name]
        tx, ty, tz = node.get("translation", (0.0, 0.0, 0.0))
        found = []
        for primitive in self.primitives(name):
            if material is not None and self.gltf["materials"][primitive["material"]]["name"] != material:
                continue
            found += [blender_xyz((x + tx, y + ty, z + tz))
                      for x, y, z in accessor_rows(self.gltf, self.binary, primitive["attributes"]["POSITION"])]
        return found

    def test_it_passes_the_contract_as_a_low_poly_prop_without_lights(self):
        result = run_blender(os.path.join(MODULES, "interior.blend"), "export_module.py", "--check")
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("CONTRACT interior: ok", result.stderr)
        tris = glb_triangle_count(self.gltf)
        self.assertTrue(TRIS_AIM[0] < tris <= TRIS_AIM[1], tris)
        self.assertNotIn("KHR_lights_punctual", self.gltf.get("extensionsUsed", []))  # the lamps' shades glow only

    def test_it_is_the_layouts_handful_of_objects_in_a_dozen_draw_calls(self):
        meshes = {name for name, node in self.nodes().items() if "mesh" in node}
        self.assertEqual(meshes, set(L.OBJECTS))
        self.assertLessEqual(len(self.primitives(L.DECOR)), DECOR_DRAWS)
        # what the wallpaper and the whole house draw: the details only show under the cut
        drawn = meshes - {L.DETAILS}
        self.assertLessEqual(sum(len(self.primitives(name)) for name in drawn), DRAWS)
        self.assertLessEqual(len(self.primitives(L.DETAILS)), DETAIL_DRAWS)
        for name in (L.DECOR, L.DETAILS):
            self.assertLessEqual(set(self.materials(name)), PALETTE, name)
        for name in L.LAMPS.values():
            self.assertEqual(self.materials(name), ["M_led"], name)

    def test_its_one_see_through_primitive_is_the_curtains_voile_and_the_drape_is_single_sided(self):
        # three draws a blended primitive in the transparent pass: the voile only (the table's glasses are an opaque
        # glassware), which the website draws in one pass (prepareModule forceSinglePass)
        materials = self.gltf["materials"]
        blended = [(name, materials[p["material"]]["name"]) for name in L.OBJECTS for p in self.primitives(name)
                   if materials[p["material"]].get("alphaMode") == "BLEND"]
        self.assertEqual(blended, [(L.DECOR, "M_sheer")])
        glassware = next(m for m in materials if m["name"] == "M_glassware")
        self.assertNotIn("alphaMode", glassware)
        # the drape's ribbons turn their front to the room: from outside at night their moonlit backs read as dark
        # stripes behind the voile, so they are culled (the throws, the runner and the blinds are closed boxes); under the
        # cut the website draws every opaque material double-sided anyway (cutaway.ts applyCut)
        drape = next(m for m in materials if m["name"] == "M_drape")
        self.assertFalse(drape.get("doubleSided", False))
        sheer = next(m for m in materials if m["name"] == "M_sheer")
        self.assertIs(sheer.get("doubleSided"), True)

    def test_the_details_are_tagged_for_the_website_to_draw_only_near_the_house(self):
        self.assertIs(self.extras(L.DETAILS).get("detail"), True)
        for name in (L.DECOR, *L.LAMPS.values()):
            self.assertNotIn("detail", self.extras(name), name)
        # most of the triangles are the details': what the whole house draws of the interior is the lighter half
        details = sum(self.gltf["accessors"][p["indices"]]["count"] // 3 for p in self.primitives(L.DETAILS))
        self.assertGreater(details, 0.35 * glb_triangle_count(self.gltf))

    def test_nothing_sways_and_nothing_casts_a_shadow(self):
        for name in L.OBJECTS:
            attributes = {key for p in self.primitives(name) for key in p["attributes"]}
            self.assertNotIn("COLOR_0", attributes, name)  # indoors: no wind
            self.assertIs(self.extras(name).get("cast_shadow"), False, name)

    def test_the_lamps_shades_glow_at_night_with_their_rooms_light_group_and_the_decor_does_not(self):
        for name, props in interact.tags(L).items():
            extras = self.extras(name)
            self.assertIs(extras.get("night_light"), True, name)
            self.assertEqual({key: extras.get(key) for key in props}, props, name)
        decor = self.extras(L.DECOR)
        self.assertNotIn("night_light", decor)
        self.assertNotIn("interact", decor)

    def test_the_lamps_stand_on_their_hosts(self):
        bases = self.points(L.DECOR, "M_ceramic")
        for entry in L.FURNITURE:
            if entry[0] != "table_lamp":
                continue
            x, y, z = L.stand(entry)
            shade = [p for p in self.points(L.LAMPS[entry[2]]) if abs(p[0] - x) < 0.2 and abs(p[1] - y) < 0.2]
            self.assertTrue(shade, entry[1])
            self.assertAlmostEqual(min(p[2] for p in shade), z + 0.38, places=2)  # its shade over its base
            # its base in the decor, drawn whenever the shade is (the details are not): no shade floats over a bare top
            base = [p for p in bases if abs(p[0] - x) < 0.12 and abs(p[1] - y) < 0.12 and z - 1e-3 <= p[2] <= z + 0.3]
            self.assertTrue(base, entry[1])
            self.assertAlmostEqual(min(p[2] for p in base), z, places=3)

    def test_every_curtain_hangs_its_stacks_at_its_glass_up_to_under_its_ceiling(self):
        sheer = self.points(L.DECOR, "M_sheer")
        linen = self.points(L.DECOR, "M_drape")
        for curtain in L.CURTAINS:
            at = L.curtain_at(curtain)
            floor = L.FLOOR_Z[curtain["room"]]
            for x0, y0, x1, y1 in L.stacks(curtain):
                inside = [p for p in sheer if x0 - 1e-3 <= p[0] <= x1 + 1e-3 and y0 - 1e-3 <= p[1] <= y1 + 1e-3
                          and floor <= p[2] <= floor + at["drop"]]
                self.assertTrue(inside, curtain["name"])
                self.assertAlmostEqual(min(p[2] for p in inside), floor + CURTAIN["hem"], places=3)
                self.assertAlmostEqual(max(p[2] for p in inside), floor + at["drop"] - CURTAIN["track"], places=3)
                drape = [p for p in linen if x0 - 1e-3 <= p[0] <= x1 + 1e-3 and y0 - 1e-3 <= p[1] <= y1 + 1e-3
                         and floor <= p[2] <= floor + at["drop"]]
                self.assertTrue(drape, curtain["name"])
                # both layers' hems clear the floor by a centimetre or more, under the track at the room's drop
                for layer in (inside, drape):
                    self.assertGreaterEqual(min(p[2] for p in layer), floor + HEM_CLEAR - 1e-4, curtain["name"])
                    self.assertLessEqual(max(p[2] for p in layer), floor + at["drop"] + 1e-4, curtain["name"])
        # the living room's sheers run the double height of its void, up under the upper floor's ceiling
        top = max(p[2] for p in sheer)
        self.assertGreater(top, common.UPPER_CEIL - 0.1)
        self.assertLessEqual(top, common.UPPER_CEIL)

    def test_the_generator_leaves_existing_files_alone(self):
        out = os.path.join(self.tmp, "keep.blend")
        with open(out, "w", encoding="utf-8") as f:
            f.write("hand-tuned")
        result = subprocess.run([blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "-P", GENERATOR,
                                 "--", "--out", out], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("skip:", result.stdout)
        with open(out, encoding="utf-8") as f:
            self.assertEqual(f.read(), "hand-tuned")

    def test_regenerating_is_reproducible_and_matches_the_committed_module(self):
        blend = os.path.join(self.tmp, "gen", "interior.blend")
        result = subprocess.run([blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "-P", GENERATOR,
                                 "--", "--out", blend, "--force"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("interior: wrote", result.stdout)
        out_dir = os.path.join(self.tmp, "gen_out")
        result = run_blender(blend, "export_module.py", "--out-dir", out_dir)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        with open(os.path.join(out_dir, "interior.raw.glb"), "rb") as fresh, \
                open(os.path.join(self.tmp, "interior.raw.glb"), "rb") as committed:
            self.assertEqual(fresh.read(), committed.read())

    def test_a_layout_problem_stops_the_generator_before_anything_is_written(self):
        out = os.path.join(self.tmp, "refused", "interior.blend")
        cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr",
               f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from interior import interior_layout as L; "
               "L.FURNITURE = [p if p[1] != 'Drum_table_living' else p[:3] + ((-9.3, -2.0),) + p[4:] for p in L.FURNITURE]",
               "-P", GENERATOR, "--", "--out", out, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("LAYOUT interior: Drum_table_living (drum_table) overlaps the house's Sofa (sofa_l)", result.stderr)
        self.assertFalse(os.path.exists(out))


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class HouseWithoutItsCurtainTest(unittest.TestCase):
    """The old fixed 3 m curtain left the house for the interior's (art/README.md, Interior)."""

    def test_the_committed_house_has_no_curtain_of_its_own(self):
        tmp = tempfile.mkdtemp()
        try:
            result = run_blender(os.path.join(MODULES, "house.blend"), "export_module.py", "--out-dir", tmp)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            gltf, _binary = read_glb(os.path.join(tmp, "house.raw.glb"))
        finally:
            shutil.rmtree(tmp)
        names = {node["name"] for node in gltf["nodes"]}
        self.assertNotIn("Curtain_master", names)
        self.assertFalse({name for name in names if name.startswith("Curtain")})
        self.assertIn("Bed_master", names)  # still the house it was


if __name__ == "__main__":
    unittest.main()

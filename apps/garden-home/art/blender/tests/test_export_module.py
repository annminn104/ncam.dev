import json
import os
import shutil
import tempfile
import unittest

from helpers import BLENDER_DIR, blender_available, glb_triangle_count, read_glb_json, run_blender, run_blender_expr

MODULES = os.path.join(BLENDER_DIR, "modules")
BROKEN_RULES = ("footprint-invalid", "role-invalid", "scale-not-applied",
                "clip-name-invalid", "hotspot-action-invalid", "wind-not-exclusive")
# Builds a minimal valid module (collection id = file name) whose only mesh carries an Array modifier.
MODIFIER_MODULE_EXPR = """
import bmesh, bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.data.collections.new("arraymod")
bpy.context.scene.collection.children.link(col)
col["footprint"] = [3.0, 1.0]
col["role"] = "prop"
mesh = bpy.data.meshes.new("Block")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bm.to_mesh(mesh)
bm.free()
ob = bpy.data.objects.new("Block", mesh)
col.objects.link(ob)
modifier = ob.modifiers.new("Array", "ARRAY")
modifier.count = 3
bpy.ops.wm.save_as_mainfile(filepath={path})
"""


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ExportModuleTest(unittest.TestCase):
    def test_check_passes_for_the_placeholder_yard_and_the_koi_pond(self):
        for module_id in ("yard", "koi_pond"):
            result = run_blender(os.path.join(MODULES, module_id + ".blend"), "export_module.py", "--check")
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])
            self.assertIn(f"CONTRACT {module_id}: ok", result.stderr)

    def test_check_fails_for_broken_fixture_with_every_rule(self):
        result = run_blender(os.path.join(BLENDER_DIR, "fixtures", "broken_module.blend"), "export_module.py", "--check")
        self.assertNotEqual(result.returncode, 0)
        for rule in BROKEN_RULES:
            self.assertIn(f"CONTRACT broken_module: {rule}:", result.stderr)

    def test_export_writes_glb_and_meta(self):
        out = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, out)
        result = run_blender(os.path.join(MODULES, "koi_pond.blend"), "export_module.py", "--out-dir", out)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        gltf = read_glb_json(os.path.join(out, "koi_pond.raw.glb"))
        nodes = {n["name"]: n for n in gltf["nodes"]}
        self.assertEqual(nodes["HS_pond"]["extras"], {"action": "focus", "label": "Ao cá", "radius": 4.5})
        self.assertNotIn("animations", gltf)  # the koi swim in the website's vertex shader, not in clips
        lotus = gltf["meshes"][nodes["Lotus"]["mesh"]]
        self.assertIn("COLOR_0", lotus["primitives"][0]["attributes"])
        koi = gltf["meshes"][nodes["Koi"]["mesh"]]
        self.assertIn("TEXCOORD_1", koi["primitives"][0]["attributes"])  # the "koi" UV map numbers the fish
        with open(os.path.join(out, "koi_pond.meta.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"id": "koi_pond", "footprint": [11.0, 8.0], "role": "prop"})

    def test_export_applies_modifiers_so_the_budgeted_tris_are_the_shipped_tris(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        blend = os.path.join(tmp, "arraymod.blend")
        # One 12-tri cube with an Array modifier (count 3): 36 tris once evaluated, which is what
        # facts.collect budgets, so that is what the GLB must contain.
        made = run_blender_expr(MODIFIER_MODULE_EXPR.format(path=json.dumps(blend)))
        self.assertEqual(made.returncode, 0, made.stderr[-2000:])
        out = os.path.join(tmp, "out")
        result = run_blender(blend, "export_module.py", "--out-dir", out)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        gltf = read_glb_json(os.path.join(out, "arraymod.raw.glb"))
        self.assertEqual(glb_triangle_count(gltf), 36)


if __name__ == "__main__":
    unittest.main()

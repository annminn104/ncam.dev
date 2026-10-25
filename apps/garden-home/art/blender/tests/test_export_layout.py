import json
import math
import os
import shutil
import tempfile
import unittest

from helpers import BLENDER_DIR, blender_available, run_blender


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def rotate(q, v):
    """Rotate vector v by quaternion q = [x, y, z, w]."""
    x, y, z, w = q
    c1 = cross((x, y, z), v)
    c2 = cross((x, y, z), c1)
    return tuple(v[i] + 2 * w * c1[i] + 2 * c2[i] for i in range(3))


def normalize(v):
    n = math.sqrt(sum(c * c for c in v))
    return tuple(c / n for c in v)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


# Duplicates the existing CAM_stop_01 under each of {names}.
ADD_STOPS_EXPR = """
import bpy
source = bpy.data.objects["CAM_stop_01"]
for name in {names}:
    copy = source.copy()
    copy.name = name
    for collection in source.users_collection:
        collection.objects.link(copy)
"""


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ExportLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        out = os.path.join(cls.tmp, "layout.json")
        result = run_blender(os.path.join(BLENDER_DIR, "site.blend"), "export_layout.py", "--out", out)
        if result.returncode != 0:
            raise AssertionError(result.stderr[-2000:])
        with open(out, encoding="utf-8") as f:
            cls.layout = json.load(f)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def assertVecAlmostEqual(self, actual, expected, places=4):
        self.assertEqual(len(actual), len(expected))
        for a, e in zip(actual, expected):
            self.assertAlmostEqual(a, e, places=places, msg=f"{actual} != {expected}")

    def test_slots_convert_to_gltf_space(self):
        slots = {s["id"]: s for s in self.layout["slots"]}
        self.assertEqual(sorted(slots), ["basement_01", "bbq_area_01", "carport_01", "fence_01", "flower_beds_01",
                                         "garden_paths_01", "house_01", "interior_01", "kennel_01", "koi_pond_01",
                                         "pool_01", "tea_garden_01", "veg_garden_01", "yard_01"])
        # the basement under the tall house and its curtains and accessories in it, in its place (villa v2 spec §12
        # "Tầng hầm", "Rèm và phụ kiện")
        for slot, module in (("basement_01", "basement"), ("interior_01", "interior")):
            self.assertEqual(slots[slot]["module"], module)
            self.assertVecAlmostEqual(slots[slot]["position"], [-1.5, 0.0, -9.5])
            self.assertVecAlmostEqual(slots[slot]["rotation"], [0.0, 0.0, 0.0, 1.0])
        pond = slots["koi_pond_01"]
        self.assertEqual(pond["module"], "koi_pond")
        self.assertVecAlmostEqual(pond["position"], [9.0, 0.0, 11.0])  # Blender (9, -11, 0)
        self.assertVecAlmostEqual(pond["rotation"], [0.0, 0.0, 0.0, 1.0])  # unturned, filling its zone
        self.assertVecAlmostEqual(pond["scale"], [1.0, 1.0, 1.0])
        self.assertEqual(slots["tea_garden_01"]["module"], "tea_garden")
        self.assertVecAlmostEqual(slots["tea_garden_01"]["position"], [7.0, 0.0, 4.75])  # Blender (7, -4.75, 0)
        self.assertVecAlmostEqual(slots["yard_01"]["rotation"], [0.0, 0.0, 0.0, 1.0])
        self.assertVecAlmostEqual(slots["house_01"]["position"], [-1.5, 0.0, -9.5])  # Blender (-1.5, 9.5, 0): tall house
        self.assertVecAlmostEqual(slots["pool_01"]["position"], [-14.0, 0.0, 2.0])  # Blender (-14, -2, 0)
        # the garden: the island-wide modules at the yard's origin, the others in their zones
        for slot in ("fence_01", "garden_paths_01", "flower_beds_01"):
            self.assertVecAlmostEqual(slots[slot]["position"], [0.0, 0.0, 0.0])
            self.assertVecAlmostEqual(slots[slot]["rotation"], [0.0, 0.0, 0.0, 1.0])
        self.assertVecAlmostEqual(slots["veg_garden_01"]["position"], [-19.0, 0.0, 14.0])  # Blender (-19, -14, 0)
        self.assertVecAlmostEqual(slots["bbq_area_01"]["position"], [-19.0, 0.0, -6.0])  # Blender (-19, 6, 0)
        # the carport and the dog's corner (part 4), unturned in their zones
        self.assertEqual(slots["carport_01"]["module"], "carport")
        self.assertVecAlmostEqual(slots["carport_01"]["position"], [16.0, 0.0, -6.5])  # Blender (16, 6.5, 0)
        self.assertEqual(slots["kennel_01"]["module"], "kennel")
        self.assertVecAlmostEqual(slots["kennel_01"]["position"], [22.0, 0.0, -12.5])  # Blender (22, 12.5, 0)
        for slot in ("carport_01", "kennel_01"):
            self.assertVecAlmostEqual(slots[slot]["rotation"], [0.0, 0.0, 0.0, 1.0])

    def test_idle_camera_looks_at_its_target(self):
        # Tuned for the wallpaper framed on the right (?align=right): the whole floating island on the right of 1280 x
        # 800 and 1512 x 982 screens, seen from 15.5 degrees up so the rock underside shows below the rim.
        idle = self.layout["camera"]["idle"]
        self.assertVecAlmostEqual(idle["position"], [72.5, 29.6, 85.6])  # Blender (72.5, -85.6, 29.6)
        forward = rotate(idle["rotation"], (0.0, 0.0, -1.0))
        # Blender target (4, -4, 0) is glTF (4, 0, 4)
        to_target = normalize(tuple(t - p for t, p in zip((4.0, 0.0, 4.0), idle["position"])))
        self.assertTrue(15.0 <= math.degrees(math.asin(-forward[1])) <= 22.0)  # a low angle on the island
        self.assertGreater(dot(forward, to_target), 0.999)
        self.assertGreater(rotate(idle["rotation"], (0.0, 1.0, 0.0))[1], 0.0)  # upright
        self.assertAlmostEqual(idle["fov"], math.degrees(2 * math.atan(12 / 42)), places=2)  # 42 mm

    def test_first_stop_stands_in_front_of_the_house_and_looks_at_it(self):
        stop = self.layout["camera"]["stops"][0]
        x, _, z = stop["position"]
        self.assertLess(abs(x), 10.0)  # within the house's width
        self.assertGreater(z, -2.0)  # in front of the house zone, whose front edge is Blender y = 2
        forward = rotate(stop["rotation"], (0.0, 0.0, -1.0))
        self.assertLess(forward[2], -0.8)  # looking towards the back of the yard (glTF -Z), not sideways

    def export_layout_with(self, pre_expr):
        out = os.path.join(self.tmp, "variant.json")
        result = run_blender(os.path.join(BLENDER_DIR, "site.blend"), "export_layout.py", "--out", out, pre_expr=pre_expr)
        return result, out

    def test_stops_are_in_numeric_order_not_text_order(self):
        result, out = self.export_layout_with(ADD_STOPS_EXPR.format(names=["CAM_stop_10", "CAM_stop_2"]))
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        with open(out, encoding="utf-8") as f:
            stops = json.load(f)["camera"]["stops"]
        self.assertEqual([s["id"] for s in stops], ["CAM_stop_01", "CAM_stop_2", "CAM_stop_10"])

    def test_non_numeric_stop_suffix_fails_with_a_clear_message(self):
        result, _ = self.export_layout_with(ADD_STOPS_EXPR.format(names=["CAM_stop_a"]))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("layout:", result.stderr)
        self.assertIn("CAM_stop_a", result.stderr)

    def test_malformed_sky_fails_instead_of_shipping_a_scene_the_runtime_rejects(self):
        result, _ = self.export_layout_with('import bpy; bpy.context.scene["sunrise"] = "6:00"')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("layout: sky sunrise must be HH:MM", result.stderr)

    def test_sunrise_after_sunset_fails(self):
        result, _ = self.export_layout_with('import bpy; bpy.context.scene["sunrise"] = "20:00"')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("sunrise (20:00) must be before sunset (18:00)", result.stderr)

    def test_stops_and_sky(self):
        self.assertEqual([s["id"] for s in self.layout["camera"]["stops"]], ["CAM_stop_01"])
        self.assertEqual(self.layout["sky"], {"sunrise": "06:00", "sunset": "18:00"})


if __name__ == "__main__":
    unittest.main()

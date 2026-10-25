"""Villa v2 spec §12 "Tầng hầm": the committed basement module, its export and its generator (basement/
build_basement.py)."""
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
from archkit.catalog import footprint  # noqa: E402
from basement import basement_layout as L  # noqa: E402
from basement import interact  # noqa: E402
from houses.house_parts import common, shell  # noqa: E402

MODULES = os.path.join(BLENDER_DIR, "modules")
GENERATOR = os.path.join(SCRIPTS_DIR, "basement", "build_basement.py")
TRIS_AIM = (7000, 15000)  # a prop: 15k triangles
# What the wallpaper draws of the basement by day: its objects but the buried ones, one draw call per primitive, the
# light pools (GLOW_*) hidden by day. Its villa v2 budget: at most 40 more draw calls at noon (villa v2 spec §12); on the
# site route each costs about a tenth of a millisecond on SwiftShader, where the budget is 2 ms. Two of them shade the
# light well's walls darker towards its floor (stone_shade, stone_deep), so it reads as sunk into the lawn.
WALLPAPER_DRAWS = 28


def blender_xyz(position):
    """Blender (x, y, z) of a glTF position (x, up, -y)."""
    return position[0], -position[2], position[1]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class BasementModuleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        result = run_blender(os.path.join(MODULES, "basement.blend"), "export_module.py", "--out-dir", cls.tmp)
        if result.returncode != 0:
            raise AssertionError(result.stderr[-2000:])
        cls.gltf, cls.binary = read_glb(os.path.join(cls.tmp, "basement.raw.glb"))

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

    def extent(self, name, material=None):
        xs, ys, zs = zip(*self.points(name, material))
        return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)

    def test_it_passes_the_contract_as_a_low_poly_prop_without_point_lights(self):
        result = run_blender(os.path.join(MODULES, "basement.blend"), "export_module.py", "--check")
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("CONTRACT basement: ok", result.stderr)
        tris = glb_triangle_count(self.gltf)
        self.assertTrue(TRIS_AIM[0] < tris <= TRIS_AIM[1], tris)
        self.assertNotIn("KHR_lights_punctual", self.gltf.get("extensionsUsed", []))  # emissives and pools only

    def test_it_is_the_layouts_objects(self):
        expected = set(L.OBJECTS) | {L.TUB_WATER["name"], "Hot_tub_bubbles_a"}
        expected |= {f"Switch_{room}" for room in L.ROOM_LABELS}
        meshes = {name for name, node in self.nodes().items() if "mesh" in node or "children" in node}
        self.assertEqual(meshes, expected)

    def test_buried_objects_show_only_under_the_cut_and_the_wallpaper_draws_few(self):
        buried = set(interact.buried(L))
        for name in self.nodes():
            self.assertEqual(self.extras(name).get("buried") is True, name in buried, name)
        drawn = sum(1 for name, node in self.nodes().items() if "mesh" in node and name not in buried
                    for p in self.primitives(name)
                    if not self.gltf["materials"][p["material"]]["name"].startswith("GLOW_"))
        self.assertLessEqual(drawn, WALLPAPER_DRAWS)

    def test_the_retaining_walls_and_the_light_well_stand_whole_under_the_cut(self):
        for name, top in interact.uncut(L).items():
            self.assertIs(self.extras(name).get("uncut"), True, name)
            self.assertAlmostEqual(self.extras(name).get("cut_top"), top, places=4)
            self.assertLessEqual(self.extent(name)[5], top + 1e-3, name)
        x0, x1, y0, y1, z0, z1 = self.extent(L.WALLS)
        self.assertEqual((round(x0, 3), round(x1, 3), round(y0, 3), round(y1, 3)),
                         (common.LEFT, common.RIGHT, common.TERRACE, common.BACK))
        self.assertAlmostEqual(z1, L.CEIL, places=3)
        self.assertAlmostEqual(self.extent(L.RIM)[5], 0.0, places=3)  # the slab's edge to the lawn
        self.assertEqual(self.materials(L.RIM), ["M_concrete"])

    def test_the_spa_looks_into_the_light_well_through_glass(self):
        self.assertEqual(self.materials(L.GLASS_SPA), ["GLASS_clear"])
        self.assertNotIn("GLASS_clear", self.materials(L.SPA))  # the sauna's glass door is in it: the spa draws opaque
        front = [p for p in self.points(L.GLASS_SPA, "GLASS_clear") if p[1] < common.TERRACE + L.WALL]  # not the sauna's
        xs = [x for x, _y, _z in front]
        self.assertTrue(L.SPA_GLASS[0] - 0.01 <= min(xs) and max(xs) <= L.SPA_GLASS[1] + 0.01, (min(xs), max(xs)))
        self.assertTrue(all(common.TERRACE < y < common.TERRACE + L.WALL for _x, y, _z in front))
        self.assertGreater(max(xs) - min(xs), 0.9 * (L.SPA_GLASS[1] - L.SPA_GLASS[0]))
        self.assertEqual(self.materials(L.WELL_OBJECT), ["M_pebble", "M_stone", "M_stone_deep", "M_stone_shade"])
        # its walls darken towards its floor: pale travertine under the coping, shaded, then deep down to the pebbles
        tops = {mat: max(z for _x, _y, z in self.points(L.WELL_OBJECT, mat)) for mat in ("M_stone_deep", "M_stone_shade")}
        bottom = min(z for _x, _y, z in self.points(L.WELL_OBJECT, "M_stone"))
        self.assertTrue(tops["M_stone_deep"] < tops["M_stone_shade"] <= bottom + 1e-3 < 0.0, (tops, bottom))
        self.assertEqual(self.materials(L.WELL_RAIL["object"]), ["GLASS_rail"])  # a fainter reflection than the spa's
        wx0, wx1, wy0, wy1, wz0, wz1 = self.extent(L.WELL_OBJECT)
        self.assertEqual((round(wx0, 3), round(wx1, 3), round(wy0, 3)), (L.WELL["min"][0], L.WELL["max"][0],
                                                                         L.WELL["min"][1]))
        self.assertAlmostEqual(wz1, L.COPING, places=3)

    def test_the_hot_tub_holds_water_and_bubbles_that_bob(self):
        self.assertEqual(self.materials(L.TUB), ["M_granite", "M_pool_tile"])
        x0, x1, y0, y1, z0, z1 = self.extent(L.TUB_WATER["name"])
        tx0, tx1, ty0, ty1, tz0, tz1 = self.extent(L.TUB)
        self.assertTrue(tx0 < x0 and x1 < tx1 and ty0 < y0 and y1 < ty1)
        self.assertTrue(tz0 < z0 and z1 < tz1)  # under the stone rim
        names = [n["name"] for n in self.gltf["nodes"]]
        clips = {a["name"]: {names[c["target"]["node"]]: c["target"]["path"] for c in a["channels"]}
                 for a in self.gltf.get("animations", [])}
        self.assertEqual(clips["ambient_hot_tub"], {"Hot_tub_bubbles_a": "translation"})

    def test_the_disco_ball_turns_round_once_a_loop_and_hangs_over_the_karaoke(self):
        names = [n["name"] for n in self.gltf["nodes"]]
        (clip,) = [a for a in self.gltf["animations"] if a["name"] == "ambient_disco_ball"]
        self.assertEqual({names[c["target"]["node"]]: c["target"]["path"] for c in clip["channels"]},
                         {L.DISCO: "rotation"})
        sampler = clip["samplers"][clip["channels"][0]["sampler"]]
        times = [t for (t,) in accessor_rows(self.gltf, self.binary, sampler["input"])]
        turns = accessor_rows(self.gltf, self.binary, sampler["output"])
        self.assertAlmostEqual(min(times), 0.0, places=4)
        for (x, y, z, w) in turns:  # about the vertical (glTF Y)
            self.assertAlmostEqual(x, 0.0, places=4)
            self.assertAlmostEqual(z, 0.0, places=4)
        angles = [2 * math.atan2(y, w) for (_x, y, _z, w) in turns]
        self.assertAlmostEqual(abs(angles[-1] - angles[0]) % (2 * math.pi), 0.0, places=3)  # a seamless loop
        self.assertGreaterEqual(len(turns), 4)
        x0, x1, y0, y1, z0, z1 = self.extent(L.DISCO)
        self.assertTrue(L.CUT < z0 < L.CEIL)
        # mirror tiles that glow with the party's LEDs (the website cycles M_disco's colour with theirs)
        self.assertIn("M_disco", self.materials(L.DISCO))
        self.assertIs(self.extras(L.DISCO).get("night_light"), True)

    def test_the_lights_glow_at_night_and_pool_on_the_floors(self):
        for room in L.ROOM_LABELS:
            name = f"LT_down_{room}"
            self.assertIs(self.extras(name).get("night_light"), True, name)
            # the pools only (and the spa's candles): the downlights' discs would hang in the ceiling the cut takes away
            self.assertEqual(self.materials(name), ["GLOW_room", "M_ceramic", "M_led"] if room == "spa" else ["GLOW_room"],
                             name)
            pools = self.extent(name, "GLOW_room")
            self.assertTrue(L.FLOOR < pools[4] == pools[5] < L.FLOOR + 0.02, pools)
            self.assertIs(self.extras(f"Switch_{room}").get("cast_shadow"), False, room)
        self.assertEqual(self.materials(L.LEDS), ["GLOW_party", "M_party_led"])
        self.assertIs(self.extras(L.LEDS).get("night_light"), True)
        self.assertIs(self.extras(L.SAUNA).get("night_light"), True)
        self.assertIn("M_ember", self.materials(L.SAUNA))
        self.assertIs(self.extras(L.WELL_LIGHTS).get("night_light"), True)
        self.assertEqual(self.materials(L.WELL_LIGHTS), ["GLOW_pool", "M_frame", "M_led"])
        washes = self.points(L.WELL_LIGHTS, "GLOW_pool")
        self.assertGreater(max(z for _x, _y, z in washes) - min(z for _x, _y, z in washes), 1.5)  # up the walls

    def test_the_accents_stand_on_their_hosts_tops(self):
        from houses import layout_check as house_check
        entries = {p[1]: p for p in L.FURNITURE}
        for entry in L.FURNITURE:
            options = entry[5] if len(entry) > 5 else {}
            if "on" not in options:
                continue
            top = L.FLOOR + house_check.top_under(entry, entries)
            x0, y0, x1, y1 = house_check._rect(entry[3], footprint(entry[0], entry[4]))
            near = [p for p in self.points(options["into"])
                    if x0 - 0.01 <= p[0] <= x1 + 0.01 and y0 - 0.01 <= p[1] <= y1 + 0.01]
            self.assertTrue(any(abs(p[2] - top) < 0.01 for p in near), entry[1])  # on the host's top
            self.assertTrue(any(p[2] > top + 0.1 for p in near), entry[1])

    def test_the_openings_the_website_sees_the_basement_through_are_on_their_objects(self):
        for name, rect in L.OPENINGS.items():
            self.assertEqual([round(v, 4) for v in self.extras(name).get("opening", [])], [round(v, 4) for v in rect], name)

    def test_the_interact_extras_are_on_their_objects(self):
        for name, props in interact.tags(L).items():
            extras = self.extras(name)
            self.assertEqual({key: extras.get(key) for key in props}, props, name)

    def test_the_stair_comes_down_the_house_stairs_column_to_the_hall_floor(self):
        cx, cy = shell.STAIR["center"]
        column = [p for p in self.points(L.STAIR["name"], "M_frame") if math.hypot(p[0] - cx, p[1] - cy) < 0.09]
        self.assertAlmostEqual(min(z for _x, _y, z in column), L.FLOOR, places=3)
        self.assertAlmostEqual(max(z for _x, _y, z in column), common.LEVEL_Z[0], places=3)
        teak = self.extent(L.STAIR["name"], "M_teak")
        self.assertAlmostEqual(teak[5], common.LEVEL_Z[0], places=3)

    def test_the_palm_sways(self):
        node = self.nodes()[L.WELL_PLANTS]
        attributes = {key for p in self.gltf["meshes"][node["mesh"]]["primitives"] for key in p["attributes"]}
        self.assertIn("COLOR_0", attributes)

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
        blend = os.path.join(self.tmp, "gen", "basement.blend")
        result = subprocess.run([blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "-P", GENERATOR,
                                 "--", "--out", blend, "--force"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("basement: wrote", result.stdout)
        out_dir = os.path.join(self.tmp, "gen_out")
        result = run_blender(blend, "export_module.py", "--out-dir", out_dir)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        with open(os.path.join(out_dir, "basement.raw.glb"), "rb") as fresh, \
                open(os.path.join(self.tmp, "basement.raw.glb"), "rb") as committed:
            self.assertEqual(fresh.read(), committed.read())

    def test_a_layout_problem_stops_the_generator_before_anything_is_written(self):
        out = os.path.join(self.tmp, "refused", "basement.blend")
        cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr",
               f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from basement import basement_layout as L; "
               "L.FURNITURE = [p if p[1] != 'Treadmill_1' else p[:3] + ((9.6, -4.4),) + p[4:] for p in L.FURNITURE]",
               "-P", GENERATOR, "--", "--out", out, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("LAYOUT basement: Treadmill_1 overlaps Treadmill_2", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()

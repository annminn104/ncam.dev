import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from helpers import (SCRIPTS_DIR, accessor_rows, blender_available, blender_bin, glb_triangle_count, read_glb,
                     run_blender, run_blender_expr)

sys.path.insert(0, SCRIPTS_DIR)
from siteplan import zones  # noqa: E402  (not called `site`: that would be shadowed by the standard library)

ISLAND_TRIS_AIM = 6000  # the island part of the yard (top, rim, rock, chunks, roots, tufts); the prop budget is 15k
ISLAND_MATERIALS = {"M_grass_lip", "M_soil", "M_rock", "M_rock_dark", "M_rock_light", "M_root"}


def in_triangle(p, a, b, c, eps=1e-6):
    """True when 2D point p lies in (or on the edge of) triangle abc, whichever way it winds."""
    def side(o, u, v):
        return (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0])
    d1, d2, d3 = side(a, b, p), side(b, c, p), side(c, a, p)
    return (d1 >= -eps and d2 >= -eps and d3 >= -eps) or (d1 <= eps and d2 <= eps and d3 <= eps)


def boundary(zone, step=0.5):
    """Points every `step` metres along the edges of zone ((x0, y0), (x1, y1)), corners included."""
    (x0, y0), (x1, y1) = zone
    points = []
    for (ax, ay), (bx, by) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        n = max(1, int(round(max(abs(bx - ax), abs(by - ay)) / step)))
        points += [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(n + 1)]
    return points


def pond_hole():
    """The koi pond's outline (pond/koi_layout.py) in site space, where its slot stands: the hole in the lawn."""
    from pond import koi_layout
    (sx, sy) = zones.SLOTS["koi_pond_01"]["pos"]
    return [(sx + x, sy + y) for x, y in koi_layout.OUTLINE]


def pit_hole():
    """The basement's pit (basement/basement_layout.py PIT: the house's plinth and the light well in front of it) in site
    space, where its slot stands: the hole in the lawn that the plinth covers and the light well opens."""
    from basement import basement_layout
    (sx, sy) = zones.SLOTS["basement_01"]["pos"]
    return [(sx + x, sy + y) for x, y in basement_layout.PIT]


def run_placeholders(root, *args, pre_expr=None):
    """Runs dev/make_placeholders.py in a fresh headless Blender; pre_expr (Python source) runs first."""
    pre = ["--python-expr", pre_expr] if pre_expr else []
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", *pre,
           "-P", os.path.join(SCRIPTS_DIR, "dev", "make_placeholders.py"), "--", "--root", root, *args]
    return subprocess.run(cmd, capture_output=True, text=True)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class PlaceholderYardTest(unittest.TestCase):
    """Villa v2 spec §4: the placeholder yard takes its trees and lamp from siteplan/zones.py; it stands on a floating
    island (zones.ISLAND) with a flat grass top at ground level and a faceted rock underside."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        root = os.path.join(cls.tmp, "blender")
        result = run_placeholders(root, "--only", "yard")
        if result.returncode != 0:
            raise AssertionError(result.stderr[-2000:])
        out = os.path.join(cls.tmp, "out")
        result = run_blender(os.path.join(root, "modules", "yard.blend"), "export_module.py", "--out-dir", out)
        if result.returncode != 0:
            raise AssertionError(result.stderr[-2000:])
        cls.yard, cls.binary = read_glb(os.path.join(out, "yard.raw.glb"))
        with open(os.path.join(out, "yard.meta.json"), encoding="utf-8") as f:
            cls.meta = json.load(f)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def positions(self, prefix):
        """Blender (x, y) of every glTF node named <prefix>*, sorted: a glTF translation is (x, z, -y)."""
        nodes = [n for n in self.yard["nodes"] if n["name"].startswith(prefix)]
        return sorted((round(n["translation"][0], 4), round(-n["translation"][2], 4)) for n in nodes)

    def node(self, name):
        return next(n for n in self.yard["nodes"] if n["name"] == name)

    def island_nodes(self):
        return [n for n in self.yard["nodes"] if n["name"] == "Ground" or n["name"].startswith("Island_")]

    def primitives(self, node):
        return self.yard["meshes"][node["mesh"]]["primitives"]

    def triangles(self, primitive, attribute="POSITION"):
        rows = accessor_rows(self.yard, self.binary, primitive["attributes"][attribute])
        indices = [i for (i,) in accessor_rows(self.yard, self.binary, primitive["indices"])]
        return [tuple(rows[i] for i in indices[k:k + 3]) for k in range(0, len(indices), 3)]

    def test_the_island_top_is_flat_at_ground_level_and_keeps_the_ground_texture(self):
        ground = self.node("Ground")
        self.assertNotIn("translation", ground)
        (primitive,) = self.primitives(ground)
        accessor = self.yard["accessors"][primitive["attributes"]["POSITION"]]
        self.assertEqual((accessor["min"][1], accessor["max"][1]), (0.0, 0.0))  # glTF Y is up: the top is flat at z 0
        width, depth = zones.ISLAND["size"]
        extent = (accessor["max"][0] - accessor["min"][0], accessor["max"][2] - accessor["min"][2])
        self.assertTrue(0.97 * width <= extent[0] <= width + 1e-4, extent)
        self.assertTrue(0.97 * depth <= extent[1] <= depth + 1e-4, extent)
        self.assertIn("TEXCOORD_0", primitive["attributes"])
        material = self.yard["materials"][primitive["material"]]
        self.assertEqual(material["name"], "M_ground")
        self.assertIn("baseColorTexture", material["pbrMetallicRoughness"])

    def test_the_island_top_holds_every_zone_tree_and_the_lamp(self):
        (primitive,) = self.primitives(self.node("Ground"))
        top = [tuple((x, -z) for x, _, z in tri) for tri in self.triangles(primitive)]  # Blender (x, y)

        def on_top(point):
            return any(in_triangle(point, *tri) for tri in top)

        def in_pit(point):  # the light well's zone and the house's front edge open into the basement's pit
            x, y = point
            outline = pit_hole()
            inside = False
            for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]):
                if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
                    inside = not inside
            return inside

        for name, zone in sorted(zones.ZONES.items()):
            off = [p for p in boundary(zone) if not on_top(p) and not in_pit(p)]
            self.assertEqual(off, [], f"zone '{name}' hangs off the island")
        for point in list(zones.TREES) + [zones.LAMP]:
            self.assertTrue(on_top(point), point)

    def test_the_rock_underside_tapers_to_a_tip_15_to_16_m_below_the_top(self):
        lowest = {}
        for node in self.yard["nodes"]:
            if "mesh" in node:
                drop = node.get("translation", (0.0, 0.0, 0.0))[1]
                lowest[node["name"]] = min(self.yard["accessors"][p["attributes"]["POSITION"]]["min"][1] + drop
                                           for p in self.primitives(node))
        deepest = min(lowest, key=lowest.get)
        self.assertEqual(deepest, "Island_rock")
        self.assertTrue(-16.0 <= lowest[deepest] <= -15.0, lowest[deepest])
        self.assertAlmostEqual(lowest[deepest], -zones.ISLAND["depth"], places=3)

    def test_the_rock_stays_under_the_rim_seen_from_above(self):
        width, depth = zones.ISLAND["size"]
        for node in self.island_nodes():
            for primitive in self.primitives(node):
                accessor = self.yard["accessors"][primitive["attributes"]["POSITION"]]
                self.assertTrue(all(abs(accessor[k][0]) <= width / 2 + 1e-4 for k in ("min", "max")), node["name"])
                self.assertTrue(all(abs(accessor[k][2]) <= depth / 2 + 1e-4 for k in ("min", "max")), node["name"])
                self.assertLessEqual(accessor["max"][1], 1e-4, node["name"])  # nothing of the island pokes above the top

    def test_the_rock_is_faceted_low_poly_with_grass_lip_soil_rock_shades_and_root_materials(self):
        rock = self.node("Island_rock")
        names = {self.yard["materials"][p["material"]]["name"] for p in self.primitives(rock)}
        self.assertEqual(names, ISLAND_MATERIALS)
        for primitive in self.primitives(rock):
            for normals in self.triangles(primitive, "NORMAL"):
                self.assertTrue(all(abs(a - b) < 1e-4 for n in normals[1:] for a, b in zip(n, normals[0])),
                                "rock triangles are flat shaded")

    def edge_counts(self, name):
        """{edge: faces sharing it} of the triangles of node `name`; an edge is a pair of positions rounded to 0.1 mm."""
        counts = {}
        for primitive in self.primitives(self.node(name)):
            for tri in self.triangles(primitive):
                corners = [tuple(round(c, 4) for c in v) for v in tri]
                for a, b in zip(corners, corners[1:] + corners[:1]):
                    edge = tuple(sorted((a, b)))
                    counts[edge] = counts.get(edge, 0) + 1
        return counts

    def test_the_rock_is_a_closed_shell_under_the_grass_top(self):
        """Every edge of Island_rock is shared by exactly two faces: by the flat grass top of `Ground` along the rim, and
        within the rock itself everywhere else, but for the buried top ends of the roots (z -0.8, inside the soil band),
        the rim of the hole the koi pond is dug into (its own bank meets the lawn there) and the rim of the basement's
        pit (the house's plinth stands in it, the light well's walls line it)."""
        edges = self.edge_counts("Ground")
        for edge, count in self.edge_counts("Island_rock").items():
            edges[edge] = edges.get(edge, 0) + count
        self.assertGreater(len(edges), 1000)
        self.assertEqual([e for e, count in edges.items() if count > 2], [], "an edge shared by more than two faces")
        holes = [[(x, -y) for x, y in hole] for hole in (pond_hole(), pit_hole())]  # glTF (x, -y) of the corners

        def on_hole(point, hole):
            return abs(point[1]) < 1e-4 and min(math.dist((point[0], point[2]), corner) for corner in hole) < 1e-3

        open_edges = [e for e, count in edges.items() if count == 1]
        self.assertTrue(all((abs(a[1] + 0.8) < 1e-3 and abs(b[1] + 0.8) < 1e-3)
                            or any(on_hole(a, hole) and on_hole(b, hole) for hole in holes)
                            for a, b in open_edges), "a hole in the rock or between the rock and the grass top")
        for hole in holes:  # the pond's hole and the pit's, all round: one open edge per corner
            self.assertEqual(sum(1 for a, b in open_edges if on_hole(a, hole) and on_hole(b, hole)), len(hole))

    def test_the_lawn_has_a_hole_where_the_koi_pond_is_dug_into_it(self):
        (primitive,) = self.primitives(self.node("Ground"))
        top = [tuple((x, -z) for x, _, z in tri) for tri in self.triangles(primitive)]  # Blender (x, y)
        normals = self.triangles(primitive, "NORMAL")
        self.assertTrue(all(n[1] > 0.99 for tri in normals for n in tri))  # every triangle of the lawn faces up

        def on_top(point):
            return any(in_triangle(point, *tri) for tri in top)

        outline = pond_hole()
        cx, cy = (sum(x for x, _ in outline) / len(outline), sum(y for _, y in outline) / len(outline))
        for x, y in outline[::4]:
            self.assertFalse(on_top((cx + (x - cx) * 0.97, cy + (y - cy) * 0.97)), (x, y))  # inside: the pond
            self.assertTrue(on_top((cx + (x - cx) * 1.03, cy + (y - cy) * 1.03)), (x, y))  # outside: the lawn

    def test_the_lawn_has_a_hole_where_the_basement_is_dug_under_the_house_and_its_light_well(self):
        """The basement's pit (villa v2 spec §12 "Tầng hầm"): the house's plinth covers the part under the house, so the
        lawn does not hide the basement when the website cuts the house down to it, and the light well in front of the
        house opens to the sky. Just inside each edge of its outline is no lawn, just outside it is."""
        (primitive,) = self.primitives(self.node("Ground"))
        top = [tuple((x, -z) for x, _, z in tri) for tri in self.triangles(primitive)]  # Blender (x, y)

        def on_top(point):
            return any(in_triangle(point, *tri) for tri in top)

        outline = pit_hole()
        area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]))
        self.assertGreater(area, 0)  # counter-clockwise: inside is on the left of each edge
        for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]):
            length = math.dist((x0, y0), (x1, y1))
            nx, ny = -(y1 - y0) / length, (x1 - x0) / length  # the inward normal
            for t in (0.25, 0.5, 0.75):
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                self.assertFalse(on_top((x + 0.05 * nx, y + 0.05 * ny)), (x, y))  # inside: the pit
                self.assertTrue(on_top((x - 0.05 * nx, y - 0.05 * ny)), (x, y))  # outside: the lawn
        hx, hy = zones.SLOTS["house_01"]["pos"]
        self.assertFalse(on_top((hx, hy)))  # under the house
        (x0, y0), (x1, y1) = zones.ZONES["lightwell"]
        self.assertFalse(on_top(((x0 + x1) / 2, (y0 + y1) / 2)))  # the light well

    def rock_triangles(self):
        """{material name: [triangle, ...]} of Island_rock, in glTF coordinates."""
        rock = self.node("Island_rock")
        return {self.yard["materials"][p["material"]]["name"]: self.triangles(p) for p in self.primitives(rock)}

    def test_the_rock_darkens_towards_the_tip_with_a_few_lighter_facets(self):
        rock = self.rock_triangles()

        def mean_height(tris):
            return sum(v[1] for tri in tris for v in tri) / (3 * len(tris))

        self.assertLess(mean_height(rock["M_rock_dark"]), mean_height(rock["M_rock"]) - 3.0)
        self.assertGreater(mean_height(rock["M_soil"]), mean_height(rock["M_rock"]))  # the earthy band under the grass
        tip = -zones.ISLAND["depth"]
        at_tip = [name for name, tris in rock.items() for tri in tris if any(abs(v[1] - tip) < 1e-4 for v in tri)]
        self.assertEqual(set(at_tip), {"M_rock_dark"})
        shades = sum(len(rock[name]) for name in ("M_rock", "M_rock_dark", "M_rock_light"))
        self.assertTrue(0.03 * shades <= len(rock["M_rock_light"]) <= 0.25 * shades, len(rock["M_rock_light"]))

    def test_tufts_and_small_rocks_break_up_the_rim_and_keep_out_of_the_zones(self):
        tufts = self.node("Rim_tufts")
        names = {self.yard["materials"][p["material"]]["name"] for p in self.primitives(tufts)}
        self.assertEqual(names, {"M_leaf", "M_rock"})
        self.assertIs(tufts.get("extras", {}).get("cast_shadow"), False)  # blades and pebbles: no shadow worth drawing
        width, depth = zones.ISLAND["size"]
        tris = [tri for p in self.primitives(tufts) for tri in self.triangles(p)]
        self.assertGreater(len(tris), 60)
        for tri in tris:
            x, z = sum(v[0] for v in tri) / 3, sum(v[2] for v in tri) / 3
            point = (x, -z)  # Blender (x, y)
            level = abs(2 * point[0] / width) ** 4 + abs(2 * point[1] / depth) ** 4
            self.assertGreater(level, 0.85 ** 4, point)  # along the rim, not out on the lawn
            self.assertLess(level, 1.0, point)
            for name, ((x0, y0), (x1, y1)) in zones.ZONES.items():
                self.assertFalse(x0 <= point[0] <= x1 and y0 <= point[1] <= y1, f"rim tuft in zone '{name}'")
            self.assertTrue(all(-0.4 <= v[1] <= 0.8 for v in tri))

    def test_the_island_stays_under_its_triangle_budget(self):
        meshes = {node["mesh"] for node in self.island_nodes() + [self.node("Rim_tufts")]}
        island_tris = glb_triangle_count({"meshes": [self.yard["meshes"][m] for m in meshes],
                                          "accessors": self.yard["accessors"]})
        self.assertGreater(island_tris, 500)  # a real rock underside, not a slab
        self.assertLessEqual(island_tris, ISLAND_TRIS_AIM)
        self.assertLessEqual(glb_triangle_count(self.yard), 15000)  # prop budget (the contract checks it as well)

    def test_the_yard_footprint_is_the_bounding_size_of_the_island(self):
        self.assertEqual(self.meta["footprint"], list(zones.ISLAND["size"]))
        self.assertEqual(self.meta["role"], "prop")

    def test_trees_and_the_lamp_stand_where_the_zones_put_them(self):
        trees = sorted(zones.TREES)
        self.assertEqual(self.positions("Tree_trunk_"), trees)
        self.assertEqual(self.positions("Tree_canopy_"), trees)
        self.assertEqual(self.positions("Lamp_post"), [zones.LAMP])
        self.assertEqual(self.positions("Lamp_bulb"), [zones.LAMP])

    def test_unclean_zones_stop_the_generator_before_anything_is_written(self):
        root = os.path.join(self.tmp, "refused")
        tweak = (f"import sys; sys.path.insert(0, {SCRIPTS_DIR!r}); from siteplan import zones; "
                 "zones.TREES = zones.TREES + ((0.0, 8.0),)")  # the middle of the house zone
        result = run_placeholders(root, "--force", pre_expr=tweak)
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("ZONES: tree at (0, 8) is inside zone 'house'", result.stderr)
        self.assertFalse(os.path.exists(root))

    def test_a_yard_size_the_zones_do_not_fit_is_refused_before_anything_is_written(self):
        # --yard-size is the island's bounding size (the yard module's footprint).
        root = os.path.join(self.tmp, "too_small")
        result = run_placeholders(root, "--force", "--only", "yard", "--yard-size", "20", "20")
        self.assertEqual(result.returncode, 1, result.stderr[-2000:])
        self.assertIn("ZONES: zone 'house' extends outside the 20 x 20 m island", result.stderr)
        self.assertFalse(os.path.exists(root))

    def test_a_bigger_yard_is_built_at_that_size(self):
        root = os.path.join(self.tmp, "big")
        result = run_placeholders(root, "--yard-size", "60", "50", "--only", "yard")
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        yard = os.path.join(root, "modules", "yard.blend")
        result = run_blender_expr(f"import bpy, json; bpy.ops.wm.open_mainfile(filepath={yard!r}); "
                                  "print('FOOTPRINT ' + json.dumps(list(bpy.data.collections['yard']['footprint'])))")
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        line = next(line for line in result.stdout.splitlines() if line.startswith("FOOTPRINT "))
        self.assertEqual(json.loads(line[len("FOOTPRINT "):]), [60.0, 50.0])


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class NoPlaceholderPondTest(unittest.TestCase):
    """The placeholder pond made way for the koi pond (villa v2 part 3, pond/build_koi.py): the placeholder script
    builds the yard, the site and the broken fixture only."""

    def test_the_placeholder_script_no_longer_builds_a_pond(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        result = run_placeholders(os.path.join(tmp, "blender"), "--only", "pond")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid choice: 'pond'", result.stderr)
        self.assertFalse(os.path.exists(os.path.join(SCRIPTS_DIR, "..", "modules", "pond.blend")))


if __name__ == "__main__":
    unittest.main()

"""Tall house kit: the open spiral stair that climbs the double-height living room to the gallery (and on, through its
upper flight, to the roof), the tiered crystal ring chandelier that hangs in the void over it, the glass and teak stair
pavilion the stair comes out of on the roof, and the bedrooms' split air conditioners (the wall unit with its louvre
flap, its wall remote, the outdoor condenser and the teak screen that hides the condensers). archkit.spiral (pure) lays
out the stair's treads, which the house's layout checks read too; archkit.furniture.stairs builds the stair and the
pavilion, archkit.furniture.lights the chandelier, archkit.furniture.climate the air conditioners."""
import math
import os
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)
from archkit import catalog, spiral  # noqa: E402
from archkit.catalog import FURNITURE, NIGHT_KINDS, SPIRAL_STAIR, WALL_MOUNTED, footprint  # noqa: E402

TALL_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS

KINDS = {kinds!r}

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def extent(ob):
    return [round(f(v.co[axis] for v in ob.data.vertices), 3) for axis in range(3) for f in (min, max)]

def islands(ob, material):
    # the pieces of `material` in a mesh, faces joined through the vertices they share: a list of vertex index sets
    names = [m.name for m in ob.data.materials]
    parent = {{}}
    def root(v):
        while parent.setdefault(v, v) != v:
            v = parent[v]
        return v
    polys = [p for p in ob.data.polygons if names[p.material_index] == material]
    for p in polys:
        for v in p.vertices[1:]:
            parent[root(v)] = root(p.vertices[0])
    found = {{}}
    for p in polys:
        for v in p.vertices:
            found.setdefault(root(v), set()).add(v)
    return list(found.values())

def pieces_of(ob, material):
    # per island of `material`: [x0, x1, y0, y1, z0, z1], sorted by their lowest point
    boxes = []
    for piece in islands(ob, material):
        co = [ob.data.vertices[v].co for v in piece]
        boxes.append([round(f(c[axis] for c in co), 3) for axis in range(3) for f in (min, max)])
    return sorted(boxes, key=lambda b: (b[4], b[0], b[2]))

def spans(ob):
    found = {{}}
    for index, mat in enumerate(ob.data.materials):
        used = {{v for poly in ob.data.polygons if poly.material_index == index for v in poly.vertices}}
        if used:
            found[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                               for axis in range(3) for f in (min, max)]
    return found

def summary_of(ob):
    used = sorted(ob.data.materials[i].name for i in {{poly.material_index for poly in ob.data.polygons}})
    return {{"tris": tris(ob), "extent": extent(ob), "materials": used, "spans": spans(ob),
            "night": ob.get("night_light") is True, "attrs": [a.name for a in ob.data.color_attributes]}}

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS), "pieces": {{}}}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    ob = furniture.place(col, "P_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    again = furniture.place(col, "P2_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    out["pieces"][kind] = dict(summary_of(ob), same_twice=digest(ob) == digest(again))
if "spiral_stair" in KINDS and "spiral_stair" in FURNITURE:
    ob = bpy.data.objects["P_spiral_stair"]
    out["treads"] = pieces_of(ob, "M_teak")
    low = furniture.place(col, "P_low_stair", "spiral_stair", (0.0, 0.0, 0.0), 0, mats, rise=3.0)
    out["low"] = dict(summary_of(low), treads=pieces_of(low, "M_teak"))
    two = furniture.place(col, "P_two_stair", "spiral_stair", (0.0, 0.0, 0.0), 0, mats,
                          upper={{"rise": 4.42, "treads": 23, "turns": 1.25}})
    out["two"] = dict(summary_of(two), treads=pieces_of(two, "M_teak"))
if "ac_split" in KINDS and "ac_split" in FURNITURE:
    for part in ("body", "flap"):
        ob = furniture.place(col, "P_ac_" + part, "ac_split", (0.0, 0.0, 0.0), 0, mats, part=part)
        out["ac_" + part] = summary_of(ob)
    try:
        furniture.place(col, "P_ac_bad", "ac_split", (0.0, 0.0, 0.0), 0, mats, part="fan")
        out["ac_bad"] = None
    except ValueError:
        out["ac_bad"] = "ValueError"
if "stair_pavilion" in KINDS and "stair_pavilion" in FURNITURE:
    ob = bpy.data.objects["P_stair_pavilion"]
    names = [m.name for m in ob.data.materials]
    # where a ray at waist height through each side's two halves meets glass or teak: the door opening lets it pass
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    tree = BVHTree.FromPolygons([v.co[:] for v in ob.data.vertices], [p.vertices[:] for p in ob.data.polygons])
    w, d, h = FURNITURE["stair_pavilion"]
    rays = {{}}
    for side, (origin, direction) in {{
            "front_left": ((-w / 4, -d, 1.0), (0, 1, 0)), "front_right": ((w / 4, -d, 1.0), (0, 1, 0)),
            "back": ((0.0, d, 1.0), (0, -1, 0)), "left": ((-w, 0.0, 1.0), (1, 0, 0)), "right": ((w, 0.0, 1.0), (-1, 0, 0))}}.items():
        hit = tree.ray_cast(Vector(origin), Vector(direction), 0.75 * w)  # as far as the side it looks through
        rays[side] = None if hit[0] is None else names[ob.data.polygons[hit[2]].material_index]
    out["pavilion_rays"] = rays
if "crystal_chandelier" in KINDS and "crystal_chandelier" in FURNITURE:
    ob = bpy.data.objects["P_crystal_chandelier"]
    names = [m.name for m in ob.data.materials]
    out["crystals"] = pieces_of(ob, "M_crystal")
    out["crystal_tris"] = sum(len(p.vertices) - 2 for p in ob.data.polygons if names[p.material_index] == "M_crystal")
    out["bulbs"] = pieces_of(ob, "M_led")
    out["brass"] = pieces_of(ob, "M_brass")
    hung = furniture.place(col, "P_hung_chandelier", "crystal_chandelier", (0.0, 0.0, 0.0), 0, mats, cord=4.0)
    out["hung"] = summary_of(hung)
    out["palette"] = {{}}
    for key in ("crystal", "brass"):
        mat = mats.get(key)
        if mat is None:
            continue
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        out["palette"][key] = {{"name": mat.name, "color": [round(c, 4) for c in bsdf.inputs["Base Color"].default_value[:3]],
                               "roughness": round(bsdf.inputs["Roughness"].default_value, 4),
                               "metallic": round(bsdf.inputs["Metallic"].default_value, 4),
                               "alpha": round(bsdf.inputs["Alpha"].default_value, 4),
                               "emission": [round(c, 4) for c in bsdf.inputs["Emission Color"].default_value[:3]],
                               "strength": round(bsdf.inputs["Emission Strength"].default_value, 4)}}
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

STAIR_SIZE = [2.4, 2.4, 5.76]


class SpiralStairPlanTest(unittest.TestCase):
    """archkit.spiral: 25 wedge treads round a steel column, a turn and a quarter from the front to the landing behind.
    Pure Python."""

    def test_the_stair_is_a_kit_kind_climbing_the_villas_storey_under_its_handrail(self):
        self.assertEqual(FURNITURE["spiral_stair"], tuple(STAIR_SIZE))
        self.assertEqual((SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"]), (25, 1.25))
        # the catalog height is the rise of a storey of the tall house and the handrail over its top tread
        self.assertAlmostEqual(SPIRAL_STAIR["rise"] + SPIRAL_STAIR["rail"], FURNITURE["spiral_stair"][2], places=9)
        self.assertTrue(0.85 <= SPIRAL_STAIR["rail"] <= 1.0, SPIRAL_STAIR)
        self.assertTrue(0.05 <= SPIRAL_STAIR["column"] <= 0.12, SPIRAL_STAIR)

    def test_treads_rise_evenly_no_more_than_twenty_centimetres_each_to_the_top(self):
        treads = spiral.treads(4.81, 25, 1.25)
        self.assertEqual(len(treads), 25)
        tops = [top for _a0, _a1, top in treads]
        for i, top in enumerate(tops):
            self.assertAlmostEqual(top, 4.81 * (i + 1) / 25, places=9)
        self.assertLessEqual(4.81 / 25, 0.2)
        self.assertAlmostEqual(tops[-1], 4.81, places=9)  # the top tread is flush with the floor above

    def test_treads_sweep_a_turn_and_a_quarter_wedge_by_wedge_from_the_front_to_the_plus_x_axis(self):
        treads = spiral.treads(4.81, 25, 1.25)
        for (a0, a1, _), (b0, _b1, _) in zip(treads, treads[1:]):
            self.assertAlmostEqual(a1, b0, places=9)  # each tread starts where the one below ends
        for a0, a1, _top in treads:
            self.assertAlmostEqual(a1 - a0, math.radians(18.0), places=9)
        self.assertAlmostEqual(treads[-1][1], 0.0, places=9)  # the top tread's leading edge lies along +X
        self.assertAlmostEqual(treads[-1][1] - treads[0][0], 2.5 * math.pi, places=9)
        # the first tread starts on the -Y side: the stair is entered from its front
        a0 = treads[0][0]
        self.assertAlmostEqual(math.cos(a0), 0.0, places=9)
        self.assertAlmostEqual(math.sin(a0), -1.0, places=9)

    def test_the_walk_line_gives_a_comfortable_going(self):
        # two thirds of the way out, where one walks, a tread is over a quarter of a metre deep
        radius = FURNITURE["spiral_stair"][0] / 2
        a0, a1, _ = spiral.treads(SPIRAL_STAIR["rise"], SPIRAL_STAIR["treads"], SPIRAL_STAIR["turns"])[0]
        self.assertGreater((a1 - a0) * radius * 2 / 3, 0.25)

    def test_treads_need_a_positive_rise_and_count(self):
        for rise, count, turns in ((0.0, 25, 1.25), (4.81, 0, 1.25), (4.81, 25, 0.0)):
            with self.assertRaises(ValueError):
                spiral.treads(rise, count, turns)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class SpiralStairKitTest(unittest.TestCase):
    """The spiral stair as built: teak wedge treads, and the column, balusters and helical handrail in black steel."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(TALL_EXPR, kinds=["spiral_stair"])

    def piece(self):
        piece = self.out["pieces"].get("spiral_stair")
        self.assertIsNotNone(piece, "spiral_stair is not in the catalog")
        return piece

    def test_it_fits_its_footprint_and_height_in_teak_and_steel_and_stays_low_poly(self):
        w, d, h = STAIR_SIZE
        piece = self.piece()
        x0, x1, y0, y1, z0, z1 = piece["extent"]
        eps = 1e-3
        self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                        and z0 >= -eps and z1 <= h + eps, piece["extent"])
        self.assertGreater(x1 - x0, 0.95 * w)
        self.assertGreater(z1, h - 0.05)  # the column and the handrail reach the top
        self.assertEqual(piece["materials"], ["M_frame", "M_teak"])
        self.assertLess(piece["tris"], 2000)
        self.assertTrue(piece["same_twice"])
        self.assertFalse(piece["night"])
        self.assertEqual(piece["attrs"], [])

    def test_twenty_five_open_teak_treads_float_round_the_column_up_to_the_top(self):
        treads = self.out["treads"]
        self.assertEqual(len(treads), 25)
        rise = SPIRAL_STAIR["rise"]
        for i, (x0, x1, y0, y1, z0, z1) in enumerate(treads):
            self.assertAlmostEqual(z1, round(rise * (i + 1) / 25, 3), places=3, msg=i)
            self.assertTrue(0.03 <= z1 - z0 <= 0.08, (i, z0, z1))  # a slab, no riser under it: an open stair
        self.assertAlmostEqual(treads[-1][5], rise, places=3)
        # the top tread lies on the +X side just under the +X axis, its leading edge along it
        x0, x1, y0, y1, _z0, _z1 = treads[-1]
        self.assertGreater(x0, 0.0)
        self.assertAlmostEqual(y1, 0.0, places=3)
        self.assertLess(y0, -0.3)
        # and the bottom one at the front, on the -Y side
        x0, x1, y0, y1, _z0, _z1 = treads[0]
        self.assertLess(y1, 0.0)
        self.assertGreater(x1, 0.3)
        self.assertLess(x0, 0.1)

    def test_the_steel_column_and_handrail_rise_from_the_floor_to_the_top(self):
        x0, x1, y0, y1, z0, z1 = self.piece()["spans"]["M_frame"]
        self.assertAlmostEqual(z0, 0.0, places=3)
        self.assertAlmostEqual(z1, STAIR_SIZE[2], places=2)
        self.assertGreater(x1 - x0, 2.2)  # the handrail runs round the outer edge

    def test_the_rise_is_an_option_and_the_handrail_follows_it(self):
        low = self.out["low"]
        self.assertEqual(len(low["treads"]), 25)
        self.assertAlmostEqual(low["treads"][-1][5], 3.0, places=3)
        self.assertAlmostEqual(low["extent"][5], 3.0 + SPIRAL_STAIR["rail"], places=2)

    def test_a_module_with_the_stair_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


CHANDELIER_SIZE = [2.4, 2.4, 2.2]
CHANDELIER_STRANDS = [40, 28, 20]


def _radius(box):
    x0, x1, y0, y1, _z0, _z1 = box
    return math.hypot((x0 + x1) / 2, (y0 + y1) / 2)


class ChandelierPlanTest(unittest.TestCase):
    """The tiered crystal ring chandelier as catalog data: three brass rings, the widest at the bottom, hung with
    strands of crystal drops. Pure Python."""

    def test_it_is_a_hanging_night_kind(self):
        self.assertEqual(FURNITURE["crystal_chandelier"], tuple(CHANDELIER_SIZE))
        self.assertEqual(WALL_MOUNTED["crystal_chandelier"], 3.0)  # its lowest crystal 3 m over the floor
        self.assertIn("crystal_chandelier", NIGHT_KINDS)  # the candle bulbs and the crystals glow at night

    def test_three_grand_rings_step_in_as_they_rise_two_point_two_one_point_six_and_one_metre_across(self):
        rings = catalog.CHANDELIER_RINGS
        self.assertEqual([round(2 * radius, 3) for radius, _z, _strands in rings], [2.2, 1.6, 1.0])
        heights = [z for _radius, z, _strands in rings]
        self.assertEqual(heights, sorted(heights))
        w, _d, h = CHANDELIER_SIZE
        self.assertGreaterEqual(heights[0], 0.3)  # crystals hang under the lowest ring down to the piece's bottom
        self.assertLessEqual(heights[-1], h - 0.3)  # the crown and the canopy above the top one
        self.assertEqual([strands for _radius, _z, strands in rings], CHANDELIER_STRANDS)  # dense curtains of drops
        for radius, _z, strands in rings:
            self.assertEqual(strands % 2, 0)  # long and short strands take turns
            self.assertLess(radius, w / 2)

    def test_the_lowest_ring_hangs_about_three_and_a_half_metres_over_the_floor(self):
        lowest = WALL_MOUNTED["crystal_chandelier"] + catalog.CHANDELIER_RINGS[0][1]
        self.assertTrue(3.0 <= lowest <= 3.5, lowest)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ChandelierKitTest(unittest.TestCase):
    """The chandelier as built: a brass frame of flat bands on arms round a central stem, an open crystal curtain under
    every band with strands of big crystal drops in front of it, candle bulbs on all three rings and a glowing core
    round the stem, one object in three materials (one draw call each: the crystals are one merged mesh)."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(TALL_EXPR, kinds=["crystal_chandelier"])

    def piece(self):
        piece = self.out["pieces"].get("crystal_chandelier")
        self.assertIsNotNone(piece, "crystal_chandelier is not in the catalog")
        return piece

    def drops(self):  # the drops of the strands, but the finial under the stem
        return [c for c in self.out["crystals"] if max(c[1] - c[0], c[3] - c[2]) < 0.3 and _radius(c) > 0.3]

    def curtains(self):
        return [c for c in self.out["crystals"] if max(c[1] - c[0], c[3] - c[2]) >= 0.3]

    def test_it_fits_its_footprint_in_brass_crystal_and_led_within_a_grand_pieces_budget(self):
        w, d, h = CHANDELIER_SIZE
        piece = self.piece()
        x0, x1, y0, y1, z0, z1 = piece["extent"]
        eps = 1e-3
        self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                        and z0 >= -eps and z1 <= h + eps, piece["extent"])
        self.assertGreater(x1 - x0, 2.3)
        self.assertAlmostEqual(z0, 0.0, places=3)
        self.assertAlmostEqual(z1, h, places=3)
        self.assertEqual(piece["materials"], ["M_brass", "M_crystal", "M_led"])
        self.assertLess(piece["tris"], 3500)  # the old 2k plus the 1.5k the grand one may take
        self.assertTrue(piece["same_twice"])
        self.assertTrue(piece["night"])
        self.assertEqual(piece["attrs"], [])

    def test_each_ring_is_a_flat_brass_band(self):
        bands = sorted((b for b in self.out["brass"] if min(b[1] - b[0], b[3] - b[2]) > 0.5 and b[5] - b[4] < 0.1),
                       key=lambda b: b[4])
        self.assertEqual(len(bands), 3)
        for (radius, z, _strands), (x0, x1, y0, y1, z0, z1) in zip(catalog.CHANDELIER_RINGS, bands):
            self.assertAlmostEqual(x1 - x0, 2 * radius + 0.02, delta=0.01)  # 2 cm thick
            self.assertAlmostEqual(y1 - y0, 2 * radius + 0.02, delta=0.02)
            self.assertAlmostEqual(z1 - z0, 0.06, places=3)  # 6 cm tall
            self.assertAlmostEqual((z0 + z1) / 2, z, places=3)

    def test_an_open_crystal_curtain_with_a_zig_zag_hem_hangs_under_every_band(self):
        curtains = sorted(self.curtains(), key=lambda c: c[4])
        self.assertEqual(len(curtains), 3)
        for (radius, z, _strands), (x0, x1, y0, y1, z0, z1) in zip(catalog.CHANDELIER_RINGS, curtains):
            self.assertAlmostEqual(_radius((x0, x1, y0, y1, z0, z1)), 0.0, places=3)
            self.assertAlmostEqual(x1 - x0, 2 * radius, delta=0.01)
            self.assertTrue(z - 0.03 <= z1 <= z, (z, z1))  # from under the band
            self.assertTrue(0.15 <= z1 - z0 <= 0.25, (z, z1 - z0))
        # every curtain is 24 upright facets, a closed ring open at the top and the bottom; the drops and the finial
        # 8 triangles each
        self.assertEqual(self.out["crystal_tris"], 8 * (len(self.drops()) + 1) + 3 * 24 * 2)

    def test_strands_of_big_crystal_drops_hang_in_front_of_every_curtain_down_to_the_bottom(self):
        drops = self.drops()
        self.assertGreaterEqual(len(drops), 160)
        self.assertAlmostEqual(min(c[4] for c in self.out["crystals"]), 0.0, places=3)
        curtains = sorted(self.curtains(), key=lambda c: c[4])
        for (radius, z, strands), curtain in zip(catalog.CHANDELIER_RINGS, curtains):
            hanging = [c for c in drops if abs(_radius(c) - radius - 0.035) < 0.02]
            self.assertGreaterEqual(len(hanging), strands * 1.5, radius)  # a long and a short strand in turn
            self.assertTrue(all(c[5] < z for c in hanging), radius)  # below their ring
            self.assertLess(min(c[4] for c in hanging), curtain[4])  # the long strands reach under the curtain's hem
        for x0, x1, y0, y1, z0, z1 in drops:
            self.assertAlmostEqual(max(x1 - x0, y1 - y0), 0.1, delta=0.011)  # 10 cm drops, not glints
            self.assertAlmostEqual(z1 - z0, 0.22, delta=0.011)  # longer than they are wide

    def test_candle_bulbs_stand_on_all_three_rings_round_a_glowing_core(self):
        flames = [b for b in self.out["bulbs"] if b[5] - b[4] < 0.3]
        cores = [b for b in self.out["bulbs"] if b[5] - b[4] >= 0.3]
        rings = catalog.CHANDELIER_RINGS
        on = {ring: 0 for ring in rings}
        for x0, x1, y0, y1, z0, z1 in flames:
            radius = _radius((x0, x1, y0, y1, z0, z1))
            ring = min(rings, key=lambda r: abs(r[0] - radius))
            self.assertLess(abs(ring[0] - radius), 0.03)
            self.assertTrue(ring[1] < z0 < ring[1] + 0.3, (z0, ring))
            self.assertAlmostEqual(max(x1 - x0, y1 - y0), 0.08, places=3)  # big glowing flames: they carry the read
            self.assertAlmostEqual(z1 - z0, 0.18, places=3)
            on[ring] += 1
        self.assertTrue(all(count >= 8 for count in on.values()), on)
        (core,) = cores
        self.assertAlmostEqual(_radius(core), 0.0, places=3)
        self.assertGreaterEqual(core[1] - core[0], 0.12)  # round the 5 cm stem
        self.assertTrue(core[4] < rings[0][1] and core[5] > rings[-1][1], core)  # from under the lowest ring up

    def test_a_cord_lengthens_the_brass_up_to_a_higher_ceiling(self):
        hung = self.out["hung"]
        self.assertAlmostEqual(hung["extent"][5], CHANDELIER_SIZE[2] + 4.0, places=3)
        self.assertAlmostEqual(hung["spans"]["M_brass"][5], CHANDELIER_SIZE[2] + 4.0, places=3)
        self.assertEqual(hung["tris"], self.piece()["tris"])  # the same cord, longer

    def test_crystal_is_an_opaque_champagne_mirror_that_glows_golden_at_night_on_a_gold_brass_frame(self):
        crystal, brass = self.out["palette"]["crystal"], self.out["palette"]["brass"]
        self.assertEqual((crystal["name"], brass["name"]), ("M_crystal", "M_brass"))
        self.assertEqual(crystal["alpha"], 1.0)  # opaque: no transparent pass to sort
        self.assertLessEqual(crystal["roughness"], 0.1)
        # all mirror: the living room's light, inside the chandelier, would burn any diffuse part white
        self.assertEqual(crystal["metallic"], 1.0)
        self.assertGreaterEqual(min(crystal["color"]), 0.85)
        red, green, blue = crystal["emission"]
        self.assertTrue(red > green > 2 * blue, crystal)  # golden, lit by the candle bulbs
        self.assertTrue(0.0 < crystal["strength"] <= 1.5, crystal)  # low enough to stay golden, not white
        self.assertGreaterEqual(brass["metallic"], 0.8)
        red, green, blue = brass["color"]
        self.assertTrue(red > green > blue and blue < 0.5 * red, brass)

    def test_a_module_with_the_chandelier_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


class TwoFlightStairTest(unittest.TestCase):
    """The stair's upper flight (the tall house's way up to the roof): it climbs on from a quarter-turn landing after
    the lower flight's top, round the same column. Pure Python and Blender."""

    def test_the_flights_climb_one_after_the_other_round_a_quarter_landing(self):
        lower = spiral.treads(4.81, 25, 1.25)
        both = spiral.flights(4.81, 25, 1.25, upper={"rise": 4.42, "treads": 23, "turns": 1.25})
        self.assertEqual(both[:25], lower)
        upper = both[25:]
        self.assertEqual(len(upper), 23)
        self.assertAlmostEqual(upper[0][0], lower[-1][1] + math.pi / 2, places=9)  # after the landing quarter
        for i, (a0, a1, top) in enumerate(upper):
            self.assertAlmostEqual(top, 4.81 + 4.42 * (i + 1) / 23, places=9)
            self.assertAlmostEqual(a1 - a0, 2.5 * math.pi / 23, places=9)
        self.assertAlmostEqual(upper[-1][2], 4.81 + 4.42, places=9)
        # it ends a turn and a quarter later, on the -X axis: one steps off it towards -Y
        self.assertAlmostEqual(math.cos(upper[-1][1]), -1.0, places=9)
        self.assertEqual(spiral.flights(4.81, 25, 1.25), lower)

    def test_treads_take_an_end_angle_and_a_base_height(self):
        treads = spiral.treads(1.0, 5, 0.5, end=math.pi, base=2.0)
        self.assertAlmostEqual(treads[-1][1], math.pi, places=9)
        self.assertAlmostEqual(treads[0][2], 2.2, places=9)
        self.assertAlmostEqual(treads[-1][2], 3.0, places=9)


AC_KINDS = {"ac_split": [0.9, 0.22, 0.3], "ac_condenser": [0.8, 0.3, 0.6], "ac_remote": [0.08, 0.02, 0.12],
            "teak_screen": [2.6, 0.06, 0.9], "stair_pavilion": [2.8, 2.8, 2.4]}


class RoofAndClimateKitPlanTest(unittest.TestCase):
    """The added kinds as catalog data. Pure Python."""

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual({kind: list(FURNITURE[kind]) for kind in AC_KINDS}, AC_KINDS)

    def test_the_split_unit_hangs_high_its_remote_at_switch_height_and_only_the_unit_glows(self):
        self.assertEqual(WALL_MOUNTED["ac_split"], 2.4)
        self.assertEqual(WALL_MOUNTED["ac_remote"], 1.15)  # beside the light switch, under the cut
        self.assertIn("ac_split", NIGHT_KINDS)  # its status LED: the website lights it only while it runs
        for kind in ("ac_condenser", "ac_remote", "teak_screen", "stair_pavilion"):
            self.assertNotIn(kind, NIGHT_KINDS, kind)
        x, y, z = catalog.AC_FLAP_PIVOT
        w, d, h = FURNITURE["ac_split"]
        self.assertTrue(abs(x) < 1e-9 and -d / 2 <= y < 0.0 and 0.0 < z < h / 2, catalog.AC_FLAP_PIVOT)  # front bottom
        self.assertTrue(-90.0 < catalog.AC_FLAP_OPEN < -30.0)  # degrees about X: it swings out and down


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class RoofAndClimateKitTest(unittest.TestCase):
    """The two-flight stair, the stair pavilion and the air conditioners as built."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(TALL_EXPR, kinds=["spiral_stair", *AC_KINDS])

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def test_every_piece_fits_its_footprint_and_stays_low_poly(self):
        eps = 1e-3
        for kind, (w, d, h) in AC_KINDS.items():
            piece = self.piece(kind)
            x0, x1, y0, y1, z0, z1 = piece["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, piece["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, piece["extent"]))
            self.assertTrue(piece["same_twice"], kind)
            self.assertLess(piece["tris"], 600, kind)
        self.assertEqual(self.out["contract"], [])

    def test_the_stairs_upper_flight_climbs_on_to_the_roof_round_the_same_column(self):
        two = self.out["two"]
        self.assertEqual(len(two["treads"]), 25 + 23)
        self.assertAlmostEqual(max(t[5] for t in two["treads"]), 4.81 + 4.42, places=3)
        self.assertAlmostEqual(two["extent"][5], 4.81 + 4.42 + SPIRAL_STAIR["rail"], places=2)  # column and rail on up
        self.assertLess(two["tris"], 2400)
        self.assertEqual(two["materials"], ["M_frame", "M_teak"])

    def test_the_split_unit_is_a_white_body_and_a_louvre_flap_that_is_its_status_light_one_material_each(self):
        body, flap = self.out["ac_body"], self.out["ac_flap"]
        self.assertEqual(body["materials"], ["M_white"])
        self.assertEqual(flap["materials"], ["M_ac_light"])  # the house lights it while the unit runs
        x0, x1, y0, y1, z0, z1 = flap["extent"]
        px, py, pz = catalog.AC_FLAP_PIVOT
        self.assertTrue(z1 <= pz + 1e-3 and z0 < pz - 0.04, flap["extent"])  # it hangs from its hinge
        self.assertTrue(y0 < py + 0.01 and x1 - x0 > 0.7, flap["extent"])  # along the front
        self.assertEqual(self.piece("ac_split")["tris"], body["tris"] + flap["tris"])
        self.assertEqual(self.out["ac_bad"], "ValueError")

    def test_the_condenser_and_its_fan_grille_are_metal_the_screen_teak_and_the_remote_black_glass(self):
        # one material each: the three condensers and their screens are one object in two, a remote one draw call
        condenser = self.piece("ac_condenser")
        self.assertEqual(condenser["materials"], ["M_metal"])
        w, d, h = AC_KINDS["ac_condenser"]
        self.assertAlmostEqual(condenser["extent"][2], -d / 2, places=3)  # the grille stands out of its front
        self.assertEqual(self.piece("teak_screen")["materials"], ["M_teak"])
        self.assertEqual(self.piece("ac_remote")["materials"], ["M_screen"])

    def test_the_pavilion_is_white_solid_behind_glass_on_its_deck_sides_under_an_overhanging_slab(self):
        pavilion = self.piece("stair_pavilion")
        self.assertEqual(pavilion["materials"], ["GLASS_clear", "M_teak", "M_white"])
        rays = self.out["pavilion_rays"]
        self.assertIsNone(rays["front_left"])  # the door opening: a ray at waist height goes straight in
        for side in ("front_right", "right"):
            self.assertEqual(rays[side], "GLASS_clear", side)
        for side in ("back", "left"):  # solid white walls, not glass behind the parapet's glass railing
            self.assertEqual(rays[side], "M_white", side)
        w, d, h = AC_KINDS["stair_pavilion"]
        overhang = catalog.STAIR_PAVILION["overhang"]
        x0, x1, y0, y1, z0, z1 = pavilion["spans"]["M_white"]
        self.assertEqual([round(v, 3) for v in (x0, x1, y0, y1, z1)], [-w / 2, w / 2, -d / 2, d / 2, h])  # the slab
        gx0, gx1, gy0, gy1, _gz0, gz1 = pavilion["spans"]["GLASS_clear"]
        self.assertLessEqual(gx1, w / 2 - overhang + 1e-3)  # the slab overhangs the glass on the right
        self.assertGreaterEqual(gy0, -d / 2 + overhang - 1e-3)  # and on the front
        self.assertLessEqual(gz1, h - 0.08)  # a thin slab, 10 cm


if __name__ == "__main__":
    unittest.main()

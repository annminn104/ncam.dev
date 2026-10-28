"""Pond kit (art/README.md, Koi pond): the catalog pieces of the koi pond and the tea corner (stone tea table and stools, tea
set, bonsai, stone lantern, lotus pads and flowers, koi, the rock peaks of the rockery), the palette they are built from
and the MeshBuilder helper that builds a piece of mesh face by face (rocks, fish, the pond's bank)."""
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)
from pond import layout_check  # noqa: E402

POND_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS, WIND_SPANS
from archkit.mesh import MeshBuilder

KINDS, WIND_KINDS, VARIANTS = {kinds!r}, {wind_kinds!r}, {variants!r}

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(float(v), 4) for v in values]

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def extent(ob):
    # [x0, x1, y0, y1, z0, z1] of the vertices (local space).
    return [round(f(v.co[axis] for v in ob.data.vertices), 3) for axis in range(3) for f in (min, max)]

def spans(ob):
    found = {{}}
    for index, mat in enumerate(ob.data.materials):
        used = {{v for poly in ob.data.polygons if poly.material_index == index for v in poly.vertices}}
        if used:
            found[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                               for axis in range(3) for f in (min, max)]
    return found

def used(ob):
    return sorted(ob.data.materials[i].name for i in {{poly.material_index for poly in ob.data.polygons}})

def tris_of(ob):
    ob.data.calc_loop_triangles()
    found = {{}}
    for tri in ob.data.loop_triangles:
        name = ob.data.materials[tri.material_index].name
        found[name] = found.get(name, 0) + 1
    return found

def tip(ob):
    # how steep a piece's top is: the height of its highest vertex over the next ring of vertices (those at the next
    # height down), over how far that ring stands round it on average
    top = max(ob.data.vertices, key=lambda v: v.co.z).co
    below = max(v.co.z for v in ob.data.vertices if v.co.z < top.z - 1e-4)
    ring = [v.co for v in ob.data.vertices if abs(v.co.z - below) < 1e-4]
    spread = sum(math.hypot(p.x - top.x, p.y - top.y) for p in ring) / len(ring)
    return round((top.z - below) / spread, 3)

def weights(ob):
    data = ob.data.color_attributes["wind"].data
    return [data[v.index].color[0] for v in ob.data.vertices]

def closed(ob):
    edges = {{}}
    for poly in ob.data.polygons:
        for key in poly.edge_keys:
            edges[key] = edges.get(key, 0) + 1
    return all(n == 2 for n in edges.values())

def error(call):
    try:
        call()
    except (TypeError, ValueError) as exc:
        return type(exc).__name__
    return None

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "hero")  # every piece and variant: over a prop's 15k
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS),
       "wind_spans": {{k: list(WIND_SPANS[k]) for k in WIND_KINDS if k in WIND_SPANS}},
       "palette": {{}}}}
for key in ("granite", "rock", "rock_light", "moss", "bark", "glaze", "lotus", "lotus_pad", "koi_orange", "koi_white",
            "koi_black", "koi_gold", "pond_bank", "pond_floor", "foam"):
    mat = mats.get(key)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    out["palette"][key] = {{"name": mat.name, "color": r(bsdf.inputs["Base Color"].default_value[:3]),
                           "strength": round(bsdf.inputs["Emission Strength"].default_value, 4),
                           "images": [n.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]}}

pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    ob = furniture.place(col, "P_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    again = furniture.place(col, "P2_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    pieces[kind] = {{"tris": tris(ob), "extent": extent(ob), "night": ob.get("night_light") is True,
                    "materials": used(ob), "spans": spans(ob), "same_twice": digest(ob) == digest(again),
                    "attrs": [a.name for a in ob.data.color_attributes]}}
out["pieces"] = pieces

# Every variant of a kind: what it is built from, where it reaches, how many triangles, and whether it differs.
variants = {{}}
for kind, count in VARIANTS.items():
    if kind not in FURNITURE:
        continue
    found = []
    for variant in range(count):
        try:
            ob = furniture.place(col, f"V_{{kind}}_{{variant}}", kind, (0.0, 0.0, 0.0), 0, mats, variant=variant)
        except TypeError:
            found.append(None)
            continue
        found.append({{"materials": used(ob), "extent": extent(ob), "tris": tris(ob), "digest": digest(ob),
                      "spans": spans(ob), "reach": round(max(v.co.xy.length for v in ob.data.vertices), 4),
                      "tris_of": tris_of(ob), "tip": tip(ob)}})
    bad = error(lambda: furniture.place(col, f"V_{{kind}}_bad", kind, (0.0, 0.0, 0.0), 0, mats, variant=count))
    variants[kind] = {{"variants": found, "bad": bad}}
out["variants"] = variants

# wind=True paints 'wind' from the still part (the bonsai's pedestal or pot, the water line) up to the tops.
STILL = {{"bonsai": ("M_granite", "M_glaze")}}
winds = {{}}
for kind in WIND_KINDS:
    if kind not in FURNITURE or kind not in WIND_SPANS:
        continue
    on = furniture.place(col, "W_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, wind=True)
    weight = weights(on)
    still = {{v for poly in on.data.polygons if on.data.materials[poly.material_index].name in STILL.get(kind, ())
             for v in poly.vertices}}
    winds[kind] = {{"attrs": [a.name for a in on.data.color_attributes], "min": round(min(weight), 4),
                   "max": round(max(weight), 4),
                   "still_max": round(max(weight[v] for v in still), 4) if still else None,
                   "high": round(weight[max(on.data.vertices, key=lambda v: v.co.z).index], 4)}}
out["winds"] = winds

# The lotus pad: a flat fan facing up with a notch cut into it; the koi: nose to the front (-Y), tail fin at the back.
helpers = {{}}
if "lotus_pad" in FURNITURE:
    pad = furniture.place(col, "Pad", "lotus_pad", (0.0, 0.0, 0.0), 0, mats)
    middle = Vector((0.0, 0.0))
    rim = [v.co.xy for v in pad.data.vertices if v.co.xy.length > 0.05]
    angles = sorted(math.atan2(p.y, p.x) for p in rim)
    widest = max(b - a for a, b in zip(angles, angles[1:] + [angles[0] + 2 * math.pi]))
    helpers["pad"] = {{"up": all(p.normal.z > 0.9 for p in pad.data.polygons if p.area > 1e-6),
                      "notch_deg": round(math.degrees(widest), 1),
                      "reach": round(max(p.length for p in rim), 3)}}
if "koi" in FURNITURE:
    fish = furniture.place(col, "Fish", "koi", (0.0, 0.0, 0.0), 0, mats)
    def width_at(y0, y1):
        xs = [v.co.x for v in fish.data.vertices if y0 <= v.co.y <= y1]
        return round(max(xs) - min(xs), 3) if xs else None
    nose = min(fish.data.vertices, key=lambda v: v.co.y).co
    d = FURNITURE["koi"][1]
    helpers["koi"] = {{"nose": r(nose), "tail_width": width_at(d / 2 - 0.05, d / 2),
                      "peduncle_width": width_at(0.25 * d, 0.3 * d), "body_width": width_at(-0.05, 0.05)}}

# MeshBuilder.faces: any piece of mesh from its points and faces (indices into them), in one material, placed like
# the other primitives (inside a placed() block it is turned and moved with the block).
if hasattr(MeshBuilder, "faces"):
    points = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]
    faces = [(0, 2, 1), (0, 1, 3), (1, 2, 3), (0, 3, 2)]
    mb = MeshBuilder("Tetra")
    mb.faces(points, faces, mats["rock"] if "rock" in mats else mats["stone"])
    with mb.placed((5.0, 0.0, 0.0), math.pi / 2):
        mb.faces(points, faces, mats["white"])
    tetra = mb.build(col)
    middle = sum((v.co for v in tetra.data.vertices if v.co.x < 2.0), Vector()) / 4
    helpers["faces"] = {{"tris": tris(tetra), "closed": closed(tetra), "spans": spans(tetra),
                        "outward": all(p.normal.dot(p.center - middle) > 0 for p in tetra.data.polygons
                                       if p.center.x < 2.0),
                        "uv": tetra.data.uv_layers.active.name if tetra.data.uv_layers else None}}
out["helpers"] = helpers
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the pond and tea pieces and the palette materials each is built from (a piece may use more).
POND_KINDS = {
    "stone_table_round": ([1.0, 1.0, 0.72], {"M_granite"}),
    "stone_stool": ([0.4, 0.4, 0.45], {"M_granite"}),
    "tea_set": ([0.42, 0.3, 0.16], {"M_teak", "M_terracotta", "M_ceramic"}),
    "bonsai": ([1.0, 0.9, 1.45], {"M_granite", "M_bark", "M_leaf", "M_leaf_dark"}),
    "stone_lantern": ([0.5, 0.5, 1.2], {"M_granite", "M_led"}),
    "lotus_pad": ([0.7, 0.7, 0.03], {"M_lotus_pad"}),
    "lotus_flower": ([0.32, 0.32, 0.5], {"M_lotus", "M_flower_yellow"}),
    "koi": ([0.18, 0.48, 0.12], {"M_koi_orange", "M_koi_white"}),
    "rock_peak": ([1.6, 1.4, 2.2], {"M_rock", "M_rock_light"}),
}
POND_NIGHT = ["stone_lantern"]
POND_WIND = ["bonsai", "lotus_pad", "lotus_flower"]
# How many variants each kind has (variant=0..n-1; variant n is refused).
VARIANTS = {"bonsai": 3, "lotus_pad": 4, "lotus_flower": 3, "koi": 4, "rock_peak": 4}
KOI = {"M_koi_orange", "M_koi_white", "M_koi_black", "M_koi_gold"}


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class PondKitTest(unittest.TestCase):
    """The stone tea table, stools and tea set, the bonsai and the stone lantern, the lotus, the koi and the rockery."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(POND_EXPR, kinds=list(POND_KINDS), wind_kinds=POND_WIND, variants=VARIANTS)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def variants(self, kind):
        found = self.out["variants"].get(kind)
        self.assertIsNotNone(found, f"{kind} is not in the catalog")
        self.assertTrue(all(found["variants"]), f"{kind} takes no variant option")
        return found["variants"]

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in POND_KINDS.items()})

    def test_palette_has_granite_rock_moss_bark_glaze_lotus_koi_pond_and_foam_colours(self):
        palette = self.out["palette"]
        self.assertEqual(sorted(entry["name"] for entry in palette.values()),
                         ["M_bark", "M_foam", "M_glaze", "M_granite", "M_koi_black", "M_koi_gold", "M_koi_orange",
                          "M_koi_white", "M_lotus", "M_lotus_pad", "M_moss", "M_pond_bank", "M_pond_floor", "M_rock",
                          "M_rock_light"])
        for entry in palette.values():
            self.assertEqual(entry["strength"], 0.0, entry["name"])  # nothing of the pond glows
            self.assertEqual(entry["images"], [], entry["name"])  # flat colours: no texture to ship (prop budget)
        red, green, blue = palette["koi_orange"]["color"]
        self.assertTrue(red > 0.8 and red > 2 * green > 2 * blue, palette["koi_orange"])  # a bright, saturated orange
        self.assertGreater(min(palette["koi_white"]["color"]), 0.85)
        self.assertLess(max(palette["koi_black"]["color"]), 0.06)
        red, green, blue = palette["koi_gold"]["color"]
        self.assertTrue(red > green > blue and green > 0.5, palette["koi_gold"])
        red, green, blue = palette["lotus"]["color"]
        self.assertTrue(red > blue > green and red > 0.8, palette["lotus"])  # lotus pink
        for key in ("lotus_pad", "moss"):
            red, green, blue = palette[key]["color"]
            self.assertTrue(green > red > blue, (key, palette[key]))
        floor, bank = palette["pond_floor"]["color"], palette["pond_bank"]["color"]
        self.assertLess(sum(floor), sum(bank))  # the floor of the pond reads deeper than its bank
        self.assertLess(max(floor), 0.1)
        self.assertGreater(sum(palette["rock_light"]["color"]), sum(palette["rock"]["color"]))
        # weathered, not bleached: its sunlit facets keep the peaks from reading as pale spires
        self.assertLess(sum(palette["rock_light"]["color"]), 1.35 * sum(palette["rock"]["color"]))
        self.assertGreater(min(palette["foam"]["color"]), 0.9)

    def test_only_the_stone_lantern_glows(self):
        self.assertEqual(self.out["night"], POND_NIGHT)
        for kind in POND_KINDS:
            self.assertEqual(self.piece(kind)["night"], kind in POND_NIGHT, kind)
        x0, x1, y0, y1, z0, z1 = self.piece("stone_lantern")["spans"]["M_led"]
        self.assertTrue(0.55 <= z0 and z1 <= 0.95, (z0, z1))  # the light box under the roof, not the base
        self.assertGreater(self.piece("stone_lantern")["spans"]["M_granite"][5], z1)  # its roof and finial on top

    def test_every_piece_fits_its_footprint_fills_most_of_it_and_stays_low_poly(self):
        eps = 1e-3
        for kind, ([w, d, h], _) in POND_KINDS.items():
            x0, x1, y0, y1, z0, z1 = self.piece(kind)["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, self.piece(kind)["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, self.piece(kind)["extent"]))
            self.assertGreater(self.piece(kind)["tris"], 0, kind)
            self.assertLess(self.piece(kind)["tris"], 600, kind)
        self.assertLessEqual(self.piece("koi")["tris"], 120)  # sixteen of them swim in the pond
        self.assertLessEqual(self.piece("lotus_pad")["tris"], 16)

    def test_every_variant_fits_the_footprint_and_differs_from_the_others(self):
        eps = 1e-3
        for kind, count in VARIANTS.items():
            w, d, h = POND_KINDS[kind][0]
            found = self.variants(kind)
            self.assertEqual(len({variant["digest"] for variant in found}), count, kind)
            for variant in found:
                x0, x1, y0, y1, z0, z1 = variant["extent"]
                self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps
                                and y1 <= d / 2 + eps and z0 >= -eps and z1 <= h + eps, (kind, variant["extent"]))
            self.assertEqual(self.out["variants"][kind]["bad"], "ValueError", kind)

    def test_pieces_use_the_materials_the_design_names(self):
        for kind, (_, materials) in POND_KINDS.items():
            self.assertLessEqual(materials, set(self.piece(kind)["materials"]), kind)

    def test_pieces_are_deterministic_and_carry_no_wind_unless_asked(self):
        for kind in POND_KINDS:
            self.assertTrue(self.piece(kind)["same_twice"], kind)
            self.assertEqual(self.piece(kind)["attrs"], [], kind)

    def test_the_bonsai_and_the_lotus_sway_their_leaves_and_flowers_a_little(self):
        self.assertEqual(sorted(self.out["wind_spans"]), sorted(POND_WIND))
        bonsai = self.out["winds"]["bonsai"]
        self.assertEqual(bonsai["attrs"], ["wind"])
        self.assertEqual(bonsai["still_max"], 0.0)  # the stone pedestal never moves
        self.assertGreater(bonsai["high"], 0.85)  # the top of the crown sways most
        for kind in ("lotus_pad", "lotus_flower"):  # afloat: they drift a few centimetres, never sway like a palm
            wind = self.out["winds"][kind]
            self.assertEqual(wind["attrs"], ["wind"], kind)
            self.assertGreater(wind["min"], 0.0, kind)
            self.assertLessEqual(wind["max"], 0.45, kind)

    def test_bonsai_stand_on_a_pedestal_or_in_a_glazed_pot_and_grow_clouds_of_leaves(self):
        found = self.variants("bonsai")
        self.assertIn("M_granite", found[0]["materials"])
        self.assertIn("M_glaze", found[1]["materials"])
        for variant in found:
            self.assertIn("M_bark", variant["materials"])
            leaves = [variant["spans"][m] for m in ("M_leaf", "M_leaf_dark") if m in variant["spans"]]
            self.assertTrue(leaves)
            self.assertGreater(max(span[5] for span in leaves), 0.9)  # the crown stands above the pedestal or pot
            self.assertLess(variant["tris"], 600)

    def test_lotus_pads_are_flat_notched_discs_in_two_greens(self):
        pad = self.out["helpers"].get("pad")
        self.assertIsNotNone(pad, "lotus_pad is not in the catalog")
        self.assertTrue(pad["up"])
        self.assertTrue(20.0 <= pad["notch_deg"] <= 70.0, pad["notch_deg"])  # a wedge cut to the middle
        self.assertTrue(0.3 <= pad["reach"] <= 0.35, pad["reach"])
        found = self.variants("lotus_pad")
        greens = {m for variant in found for m in variant["materials"]}
        self.assertEqual(greens, {"M_lotus_pad", "M_leaf"})
        self.assertEqual(len({variant["extent"][1] for variant in found}), 4)  # four sizes
        for variant in found:
            self.assertLessEqual(variant["extent"][5], 0.03)

    def test_lotus_flowers_open_in_pink_or_white_and_a_bud_stands_on_its_stem(self):
        pink, white, bud = self.variants("lotus_flower")
        self.assertIn("M_lotus", pink["materials"])
        self.assertIn("M_flower_white", white["materials"])
        self.assertNotIn("M_lotus", white["materials"])
        self.assertIn("M_flower_yellow", pink["materials"])  # the seed head in the middle of an open flower
        self.assertIn("M_lotus", bud["materials"])
        self.assertIn("M_leaf", bud["materials"])  # its stem
        self.assertGreater(bud["extent"][5], 0.4)  # held up out of the water
        self.assertLess(bud["extent"][1] - bud["extent"][0], 0.6 * (pink["extent"][1] - pink["extent"][0]))

    def test_koi_swim_nose_first_with_a_tail_fin_in_four_colourings(self):
        koi = self.out["helpers"].get("koi")
        self.assertIsNotNone(koi, "koi is not in the catalog")
        w, d, h = POND_KINDS["koi"][0]
        self.assertAlmostEqual(koi["nose"][1], -d / 2, places=2)  # the nose at the front (-Y)
        self.assertTrue(0.3 * h < koi["nose"][2] < 0.7 * h, koi["nose"])
        self.assertGreater(koi["tail_width"], 1.5 * koi["peduncle_width"])  # the fin fans out behind the narrow tail
        self.assertGreater(koi["body_width"], koi["peduncle_width"])
        colourings = [set(variant["materials"]) for variant in self.variants("koi")]
        self.assertTrue(all(colouring <= KOI for colouring in colourings), colourings)
        self.assertEqual(colourings[0], {"M_koi_orange", "M_koi_white"})  # orange, a white belly
        self.assertEqual(colourings[1], {"M_koi_orange", "M_koi_white"})  # kohaku: white, orange patches
        self.assertIn("M_koi_black", colourings[2])  # black and orange
        self.assertIn("M_koi_gold", colourings[3])
        self.assertNotEqual(self.variants("koi")[0]["digest"], self.variants("koi")[1]["digest"])

    def test_rock_peaks_rise_in_four_heights_with_lighter_facets(self):
        found = self.variants("rock_peak")
        heights = [variant["extent"][5] for variant in found]
        self.assertEqual(heights, sorted(heights, reverse=True))
        self.assertGreater(heights[0], 1.9)
        self.assertLess(heights[-1], 0.6 * heights[0])
        for variant in found:
            self.assertLessEqual({"M_rock", "M_rock_light"}, set(variant["materials"]))
            self.assertLess(variant["tris"], 300)

    def test_rock_peaks_end_in_blunt_crags_with_moss_on_their_ledges(self):
        for k, variant in enumerate(self.variants("rock_peak")):
            self.assertLess(variant["tip"], 1.0, k)  # no steeper than 45 degrees at the top: a crag, not a spire
            self.assertGreaterEqual(variant["tris_of"].get("M_moss", 0), 3 * 18, k)  # three tufts of moss at least

    def test_the_pond_checks_reach_round_every_rock_peak_and_not_much_further(self):
        # pond/layout_check.peak_reach keeps the koi, the lotus and the stones off the rockery: it covers every vertex
        for variant, found in enumerate(self.variants("rock_peak")):
            reach = layout_check.peak_reach(variant)
            self.assertGreaterEqual(reach + 1e-3, found["reach"], variant)
            self.assertLess(reach - found["reach"], 0.1, variant)  # the jitter may not reach out at its widest

    def test_the_tea_table_stools_and_set(self):
        table = self.piece("stone_table_round")["spans"]["M_granite"]
        self.assertEqual(table[5], 0.72)
        self.assertAlmostEqual(table[1] - table[0], 1.0, places=2)  # a round top a metre across
        stool = self.piece("stone_stool")["extent"]
        self.assertEqual(stool[5], 0.45)
        tea = self.piece("tea_set")["spans"]
        self.assertGreater(tea["M_terracotta"][5], tea["M_ceramic"][5])  # the clay teapot stands over its cups
        self.assertLess(tea["M_teak"][5], 0.03)  # on a low tray
        self.assertLess(self.piece("tea_set")["tris"], 400)

    def test_faces_builds_a_piece_of_mesh_from_points_and_faces(self):
        faces = self.out["helpers"].get("faces")
        self.assertIsNotNone(faces, "MeshBuilder.faces is missing")
        self.assertEqual(faces["tris"], 8)
        self.assertTrue(faces["closed"])
        self.assertTrue(faces["outward"])
        self.assertEqual(faces["uv"], "UVMap")
        # the second one turned a quarter about Z and moved to (5, 0): local +X runs along +Y
        self.assertEqual(faces["spans"]["M_white"], [4.0, 5.0, 0.0, 1.0, 0.0, 1.0])

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

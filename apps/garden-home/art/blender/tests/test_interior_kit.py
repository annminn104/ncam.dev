"""The decor pass's kit (villa v2 spec §12 "Rèm và phụ kiện"): the curtains, soft wave-fold drapes on a slim bronze
ceiling track as tall as the room they hang in (an off-white sheer behind a linen drape tied back at both ends, so the
glass stays open), the roller blind of the kitchen's and the gaming corner's ribbon windows, and the colours they are
made of; the accessories that furnish the rooms (cushions, throws, table decor, lamps, plants, art, a buffet, a console,
a bench, the dining table laid, the kitchen counter's things, bath accessories, rugs, the basement's accents) and the
surfaces of the furniture they sit on."""
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)
from archkit.catalog import FURNITURE, NIGHT_KINDS, OVERLAYS, WALL_MOUNTED  # noqa: E402

try:  # the accessory kit's table of the surfaces things stand on (catalog.SURFACES)
    from archkit.catalog import SURFACES  # noqa: E402
except ImportError:
    SURFACES = {}

CURTAIN_EXPR = """
import json, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE

CASES, PALETTE = {cases!r}, {palette!r}

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(float(v), 4) for v in values]

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def verts_of(ob, name):
    index = [i for i, mat in enumerate(ob.data.materials) if mat.name == name]
    used = {{v for poly in ob.data.polygons if poly.material_index in index for v in poly.vertices}}
    return [ob.data.vertices[v].co.copy() for v in used]

def spans(ob):
    found = {{}}
    for mat in ob.data.materials:
        co = verts_of(ob, mat.name)
        if co:
            found[mat.name] = [round(f(c[axis] for c in co), 3) for axis in range(3) for f in (min, max)]
    return found

def smooth(ob, name):
    index = [i for i, mat in enumerate(ob.data.materials) if mat.name == name]
    polys = [poly for poly in ob.data.polygons if poly.material_index in index]
    return bool(polys) and all(poly.use_smooth for poly in polys)

def row(ob, name, z, side):
    # the fabric's vertices on the row at height z, on one end (side -1: x < 0, 1: x > 0), sorted along x
    return sorted((round(c.x, 4), round(c.y, 4)) for c in verts_of(ob, name) if abs(c.z - z) < 1e-3 and c.x * side > 0)

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in ("curtain", "roller_blind") if k in FURNITURE}}, "palette": {{}}}}
for key in PALETTE:
    mat = mats.get(key)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    out["palette"][key] = {{"name": mat.name, "color": r(bsdf.inputs["Base Color"].default_value[:3]),
                           "metallic": round(bsdf.inputs["Metallic"].default_value, 4),
                           "roughness": round(bsdf.inputs["Roughness"].default_value, 4),
                           "strength": round(bsdf.inputs["Emission Strength"].default_value, 4),
                           "alpha": round(bsdf.inputs["Alpha"].default_value, 4),
                           "culled": mat.use_backface_culling,
                           "images": [n.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]}}
cases = {{}}
for name, kind, opts in CASES:
    if kind not in FURNITURE:
        continue
    try:
        ob = furniture.place(col, name, kind, (0.0, 0.0, 0.0), 0, mats, **opts)
        again = furniture.place(col, name + "_again", kind, (0.0, 0.0, 0.0), 0, mats, **opts)
    except TypeError as exc:
        cases[name] = {{"error": str(exc)}}
        continue
    entry = {{"tris": tris(ob), "spans": spans(ob), "materials": sorted(spans(ob)), "same_twice": digest(ob) == digest(again),
             "night": ob.get("night_light") is True, "attrs": [a.name for a in ob.data.color_attributes],
             "smooth": {{m: smooth(ob, m) for m in ("M_drape", "M_sheer")}}}}
    if kind == "curtain":
        w, d, h = FURNITURE[kind]
        top = opts.get("drop", h)
        width = opts.get("width", w)
        heights = sorted({{round(c.z, 4) for c in verts_of(ob, "M_drape")}})
        entry["linen_rows"] = heights
        entry["rows"] = {{m: {{str(side): {{str(z): row(ob, m, z, side) for z in sorted({{round(c.z, 4) for c in verts_of(ob, m)}})}}
                             for side in (-1, 1)}} for m in ("M_drape", "M_sheer")}}
        fabric = verts_of(ob, "M_drape") + verts_of(ob, "M_sheer")
        entry["open"] = round(min((width / 2 - abs(c.x) for c in fabric), default=0.0), 4)
        entry["inner"] = round(min((abs(c.x) for c in fabric), default=width / 2), 4)
    cases[name] = entry
    bpy.data.objects.remove(again)
out["cases"] = cases
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# The curtains of a room: a run as wide as its glazing and as tall as the room (drop: the track's top over the floor),
# its stacks at both ends or at one; the roller blind of a ribbon window, lowered a share of its length.
CASES = [
    ("C_default", "curtain", {}),
    ("C_master", "curtain", {"width": 5.68, "drop": 4.0}),
    ("C_void", "curtain", {"width": 7.8, "drop": 8.81, "stack": 0.9}),
    ("C_left", "curtain", {"width": 3.0, "drop": 4.0, "ends": "left"}),
    ("C_right", "curtain", {"width": 3.0, "drop": 4.0, "ends": "right"}),
    ("C_sheer", "curtain", {"width": 3.0, "drop": 4.0, "layers": ["sheer"]}),
    ("B_default", "roller_blind", {}),
    ("B_kitchen", "roller_blind", {"width": 5.3, "drop": 1.22, "lowered": 0.3}),
]
PALETTE = ["sheer", "bronze", "linen", "drape", "frame", "rattan", "glassware"]
TRACK = 0.035  # the ceiling track's height under the ceiling
HEM = 0.02  # the fabric stops this far over the floor
TIE = (0.85, 1.25)  # where the tie-back gathers the drape, over the floor
FOLDS_PER_METRE = (8, 12)  # catalog.CURTAIN: 8 a metre, at least, across a stack's top


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class CurtainKitTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = summary(CURTAIN_EXPR, cases=CASES, palette=PALETTE)

    def case(self, name):
        found = self.out["cases"].get(name)
        self.assertIsNotNone(found, f"{name}: its kind is not in the catalog")
        self.assertNotIn("error", found, name)
        return found

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {"curtain": [2.4, 0.22, 3.0], "roller_blind": [1.2, 0.08, 1.0]})
        self.assertNotIn("curtain", WALL_MOUNTED)  # it stands on the floor, its track at the drop
        self.assertNotIn("curtain", NIGHT_KINDS)

    def test_palette_has_an_off_white_sheer_a_sand_linen_drape_and_a_dark_bronze(self):
        palette = self.out["palette"]
        sheer, bronze, linen, drape = palette["sheer"], palette["bronze"], palette["linen"], palette["drape"]
        self.assertEqual((sheer["name"], bronze["name"], drape["name"]), ("M_sheer", "M_bronze", "M_drape"))
        # the drape: a warm sand linen, darker than M_linen (near white on screen) so it reads apart from the voile,
        # paler than the rattan; opaque, no glow
        red, green, blue = drape["color"]
        self.assertTrue(red > green > blue, drape)
        self.assertLess(sum(drape["color"]), sum(linen["color"]) - 0.3)
        self.assertGreater(sum(drape["color"]), sum(palette["rattan"]["color"]))
        self.assertEqual((drape["alpha"], drape["strength"], drape["images"]), (1.0, 0.0, []))
        # single-sided: its ribbons turn their front to the room, and from outside their moonlit backs read at night as
        # dark stripes behind the voile
        self.assertIs(drape["culled"], True)
        # the sheer: paler than the linen drape in front of it, a see-through ivory voile with no glow, drawn from both
        # sides (the interior's one transparent primitive: from outside at night it shows the warm room's light)
        self.assertGreater(min(sheer["color"]), 0.88)
        self.assertGreater(sum(sheer["color"]), sum(linen["color"]))
        red, green, blue = sheer["color"]
        self.assertTrue(red >= green > blue, sheer)  # warm, not a cold white under the moon
        self.assertTrue(0.7 <= sheer["alpha"] <= 0.8, sheer)
        self.assertEqual((sheer["strength"], sheer["metallic"], sheer["culled"]), (0.0, 0.0, False))
        # the glasses on the tables: an opaque glassware, pale and glossy, so they add no see-through draw
        glassware = palette["glassware"]
        self.assertEqual(glassware["name"], "M_glassware")
        self.assertEqual((glassware["alpha"], glassware["strength"], glassware["images"]), (1.0, 0.0, []))
        self.assertLess(glassware["roughness"], 0.15)
        self.assertGreater(min(glassware["color"]), 0.6)
        # the track: a dark warm metal, browner than the black frames
        red, green, blue = bronze["color"]
        self.assertTrue(red > green > blue and red < 0.35, bronze)
        self.assertGreater(bronze["metallic"], 0.5)
        for entry in (sheer, bronze):
            self.assertEqual(entry["images"], [], entry["name"])

    def test_a_curtain_hangs_from_its_track_at_the_drop_to_two_centimetres_over_the_floor(self):
        for name, opts in (("C_default", {}), ("C_master", {"drop": 4.0}), ("C_void", {"drop": 8.81})):
            spans = self.case(name)["spans"]
            top = opts.get("drop", FURNITURE["curtain"][2])
            self.assertAlmostEqual(spans["M_bronze"][5], top, places=3, msg=name)  # the track's top
            for fabric in ("M_drape", "M_sheer"):
                self.assertAlmostEqual(spans[fabric][4], HEM, places=3, msg=(name, fabric))
                self.assertLessEqual(spans[fabric][5], top - TRACK + 1e-3, (name, fabric))  # under the track
                self.assertGreater(spans[fabric][5], top - TRACK - 0.02, (name, fabric))

    def test_its_track_runs_the_whole_width_and_the_piece_stays_in_its_depth(self):
        d = FURNITURE["curtain"][1]
        for name, width in (("C_default", 2.4), ("C_master", 5.68), ("C_void", 7.8)):
            case = self.case(name)
            x0, x1, y0, y1, _z0, _z1 = case["spans"]["M_bronze"]
            self.assertAlmostEqual(x0, -width / 2, places=3, msg=name)
            self.assertAlmostEqual(x1, width / 2, places=3, msg=name)
            for x0, x1, y0, y1, _z0, _z1 in case["spans"].values():
                self.assertTrue(-width / 2 - 1e-3 <= x0 and x1 <= width / 2 + 1e-3, name)
                self.assertTrue(-d / 2 - 1e-3 <= y0 and y1 <= d / 2 + 1e-3, name)

    def test_the_sheer_hangs_behind_the_linen_on_the_glass_side(self):
        spans = self.case("C_master")["spans"]
        self.assertGreater(spans["M_sheer"][3], spans["M_drape"][3])  # +Y: the glass side at rot 0
        self.assertGreater((spans["M_sheer"][2] + spans["M_sheer"][3]) / 2, (spans["M_drape"][2] + spans["M_drape"][3]) / 2)

    def test_the_fabric_is_a_soft_ribbon_of_folds_not_slats(self):
        for name in ("C_master", "C_void"):
            case = self.case(name)
            self.assertEqual(case["smooth"], {"M_drape": True, "M_sheer": True}, name)
            for fabric in ("M_drape", "M_sheer"):
                rows = case["rows"][fabric]["-1"]
                top = rows[max(rows, key=float)]
                xs = [x for x, _y in top]
                ys = [y for _x, y in top]
                # rounded waves along the top of the stack, its depth in and out in turn: a peak either side of its line
                # every fold, and two vertices to every half fold (in to the peak and back out), not a zig-zag of slats
                turns = sum(1 for a, b, c in zip(ys, ys[1:], ys[2:]) if (b - a) * (c - b) < 0)
                folds = turns / 2
                self.assertGreaterEqual(len(top), 4 * folds, (name, fabric, top))
                per_metre = folds / (max(xs) - min(xs))
                self.assertTrue(FOLDS_PER_METRE[0] <= per_metre <= FOLDS_PER_METRE[1], (name, fabric, per_metre))
                self.assertGreater(max(ys) - min(ys), 0.03, (name, fabric))  # deep enough to read as folds

    def test_the_linen_is_tied_back_and_the_glass_stays_open(self):
        for name in ("C_master", "C_void"):
            case = self.case(name)
            rows = case["rows"]["M_drape"]["-1"]
            widths = {float(z): max(x for x, _ in row) - min(x for x, _ in row) for z, row in rows.items()}
            top = max(widths)
            ties = [z for z in widths if TIE[0] <= z <= TIE[1]]
            self.assertTrue(ties, (name, sorted(widths)))
            tie = min(ties, key=lambda z: widths[z])
            self.assertLess(widths[tie], 0.65 * widths[top], (name, widths))  # gathered at the tie-back
            self.assertLess(widths[tie], widths[min(widths)], (name, widths))  # and flaring under it
            # a band round the gathered linen at the tie-back, in the track's bronze
            bronze_under = self.case(name)["spans"]["M_bronze"][4]
            self.assertTrue(TIE[0] - 0.1 <= bronze_under <= TIE[1], (name, bronze_under))
        # the stacks are gathered at the ends: the middle 70 % of a 5.7 m glazing has no fabric in front of it
        master = self.case("C_master")
        self.assertGreater(master["inner"], 0.35 * 5.68, master["inner"])
        self.assertEqual(master["open"], 0.0)  # each stack starts at its end of the run

    def test_a_stack_at_one_end_only_and_the_sheer_alone(self):
        left, right = self.case("C_left"), self.case("C_right")
        self.assertLess(left["spans"]["M_drape"][1], 0.0)  # all the fabric left of the middle
        self.assertGreater(right["spans"]["M_drape"][0], 0.0)
        for case in (left, right):
            self.assertAlmostEqual(case["spans"]["M_bronze"][1] - case["spans"]["M_bronze"][0], 3.0, places=3)
        sheer = self.case("C_sheer")
        self.assertEqual(sheer["materials"], ["M_bronze", "M_sheer"])

    def test_curtains_stay_low_poly_and_regenerate_the_same(self):
        # a sine sampled four times a wave (two read as a zig-zag of slats), 8 waves a metre: a 0.5 m stack's linen is 64
        # triangles and its 0.65 m voile 48; the void's 0.9 m stacks, 220 a side
        for name, cap in (("C_default", 300), ("C_master", 300), ("C_void", 500), ("C_left", 200)):
            case = self.case(name)
            self.assertLess(case["tris"], cap, name)
            self.assertTrue(case["same_twice"], name)
            self.assertEqual(case["attrs"], [], name)  # indoors: no wind
            self.assertFalse(case["night"], name)

    def test_the_roller_blind_rolls_down_a_share_of_its_length_under_its_cassette(self):
        default, kitchen = self.case("B_default"), self.case("B_kitchen")
        w, d, h = FURNITURE["roller_blind"]
        for case, width, drop, lowered in ((default, w, h, 0.35), (kitchen, 5.3, 1.22, 0.3)):
            spans = case["spans"]
            self.assertEqual(set(spans), {"M_drape", "M_teak", "M_bronze"})
            self.assertAlmostEqual(spans["M_teak"][5], drop, places=3)  # the cassette on top
            self.assertAlmostEqual(spans["M_teak"][1] - spans["M_teak"][0], width, places=3)
            cassette = spans["M_teak"][4]
            self.assertAlmostEqual(spans["M_drape"][5], cassette, places=3)
            self.assertAlmostEqual(spans["M_drape"][4], round(cassette - lowered * cassette, 3), delta=0.002)
            self.assertLess(spans["M_bronze"][5], spans["M_drape"][4] + 1e-3)  # the weight bar at its hem
            self.assertLess(case["tris"], 60)
            self.assertTrue(-d / 2 - 1e-3 <= spans["M_teak"][2] and spans["M_teak"][3] <= d / 2 + 1e-3)

    def test_a_module_with_the_curtains_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class CurtainOptionsTest(unittest.TestCase):
    """What the curtain refuses: an end that is neither, a layer that is neither."""

    def test_a_curtain_refuses_an_end_or_a_layer_it_does_not_know(self):
        expr = CURTAIN_EXPR.replace('print("ARCHKIT " + json.dumps(out))', '''
errors = {{}}
for label, opts in (("ends", {{"ends": "middle"}}), ("layers", {{"layers": ["velvet"]}})):
    try:
        furniture.place(col, "X_" + label, "curtain", (0.0, 0.0, 0.0), 0, mats, **opts)
        errors[label] = None
    except (TypeError, ValueError) as exc:
        errors[label] = type(exc).__name__
out["errors"] = errors
print("ARCHKIT " + json.dumps(out))''')
        out = summary(expr, cases=[], palette=[])
        self.assertEqual(out["errors"], {"ends": "ValueError", "layers": "ValueError"})


ACCESSORY_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, WALL_MOUNTED
from archkit.mesh import MeshBuilder

KINDS = {kinds!r}
OUTLINES = {outlines!r}
STONE = {stone!r}

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def extent(ob):
    return [round(f(v.co[axis] for v in ob.data.vertices), 3) for axis in range(3) for f in (min, max)]

def spans(ob):
    found = {{}}
    for index, mat in enumerate(ob.data.materials):
        used = {{v for poly in ob.data.polygons if poly.material_index == index for v in poly.vertices}}
        if used:
            found[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                               for axis in range(3) for f in (min, max)]
    return found

def faces(ob):
    found = {{}}
    for poly in ob.data.polygons:
        name = ob.data.materials[poly.material_index].name
        found[name] = found.get(name, 0) + 1
    return found

def summary_of(ob):
    return {{"tris": tris(ob), "extent": extent(ob), "materials": sorted(spans(ob)), "spans": spans(ob),
            "faces": faces(ob), "night": ob.get("night_light") is True, "attrs": [a.name for a in ob.data.color_attributes],
            "digest": digest(ob)}}

def outline(ob, name):
    # the front view (x, z) of the faces in material `name`: how far its vertices reach into the corners of their box
    # (a ball's outline 0.71 of the way along a diagonal at most, a square's all the way), its depth (y) and width (x)
    co = [ob.data.vertices[v].co for poly in ob.data.polygons if ob.data.materials[poly.material_index].name == name
          for v in poly.vertices]
    lo = [min(c[axis] for c in co) for axis in range(3)]
    hi = [max(c[axis] for c in co) for axis in range(3)]
    mid = [(a + b) / 2 for a, b in zip(lo, hi)]
    half = [(b - a) / 2 for a, b in zip(lo, hi)]
    corner = max(min(abs(c.x - mid[0]) / half[0], abs(c.z - mid[2]) / half[2]) for c in co)
    return {{"corner": round(corner, 3), "deep": round(hi[1] - lo[1], 3), "wide": round(hi[0] - lo[0], 3)}}

def stone_clear(ob):
    # how far the travertine's UVs keep off the joints of its slabs (four to a UV unit), as a share of a slab: 0 when a
    # face crosses one
    index = [i for i, mat in enumerate(ob.data.materials) if mat.name == "M_stone"]
    uv = ob.data.uv_layers.active.data
    worst = 0.5
    for poly in ob.data.polygons:
        if poly.material_index not in index:
            continue
        cells = set()
        for loop in poly.loop_indices:
            u, v = uv[loop].uv
            for t in (u, v):
                share = (4 * t) % 1.0
                worst = min(worst, share, 1.0 - share)
            cells.add((math.floor(4 * u + 1e-9), math.floor(4 * v + 1e-9)))
        if len(cells) > 1:
            worst = 0.0
    return round(worst, 4)

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}}}}
pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    ob = furniture.place(col, "P_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    again = furniture.place(col, "P2_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    pieces[kind] = dict(summary_of(ob), same_twice=digest(ob) == digest(again), hangs=WALL_MOUNTED.get(kind, 0.0))
    bpy.data.objects.remove(again)
out["pieces"] = pieces
variants = {{}}
if "art_print" in FURNITURE:
    for variant in range(4):
        ob = furniture.place(col, f"V_{{variant}}", "art_print", (0.0, 0.0, 0.0), 0, mats, variant=variant)
        variants[str(variant)] = summary_of(ob)
        bpy.data.objects.remove(ob)
out["variants"] = variants
parts = {{}}
if "table_lamp" in FURNITURE:
    for part in ("base", "shade"):
        ob = furniture.place(col, "L_" + part, "table_lamp", (0.0, 0.0, 0.0), 0, mats, part=part)
        parts[part] = summary_of(ob)
        bpy.data.objects.remove(ob)
    try:
        furniture.place(col, "L_bad", "table_lamp", (0.0, 0.0, 0.0), 0, mats, part="cord")
        parts["bad"] = None
    except ValueError:
        parts["bad"] = "ValueError"
out["parts"] = parts
out["outlines"] = {{kind: outline(bpy.data.objects["P_" + kind], name) for kind, name in OUTLINES.items()
                   if "P_" + kind in bpy.data.objects}}
stone = {{}}
for kind in STONE:
    if kind not in FURNITURE:
        continue
    # where the kit stands it, and merged into a shared mesh off the origin, turned, as the interior module merges it
    mb = MeshBuilder("S_" + kind)
    furniture.place_into(mb, kind, (1.52, -2.98, 0.8), 90, mats)
    stone[kind] = [stone_clear(bpy.data.objects["P_" + kind]), stone_clear(mb.build(col))]
out["stone"] = stone
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the accessories and the palette materials each is built from (a piece may use more). The interior
# module merges them per material into a handful of objects, so they share one small palette: linen, the curtains' sand
# linen and the sheer's off-white, teak, bronze, ceramic, leaf green, terracotta, rattan and travertine (the lamps' shades
# glow, M_led).
ACCESSORY_KINDS = {
    # soft things: throw cushions leaning on a sofa's or a bed's back, a pair for a single bed or a bench, a folded throw
    "cushions": ([1.2, 0.3, 0.45], {"M_linen", "M_terracotta"}),
    "cushion_pair": ([0.8, 0.28, 0.4], {"M_linen", "M_rattan"}),
    "throw": ([0.9, 0.5, 0.08], {"M_drape", "M_terracotta"}),
    # on tables: the coffee table's tray with candles, a bowl and books; a stack of books; a vase of branches; a bowl
    "coffee_decor": ([0.9, 0.5, 0.22], {"M_teak", "M_ceramic", "M_stone", "M_terracotta"}),
    "book_stack": ([0.3, 0.22, 0.16], {"M_terracotta", "M_linen", "M_teak"}),
    "vase_branches": ([0.3, 0.3, 0.7], {"M_ceramic", "M_bronze", "M_leaf"}),
    "bowl": ([0.3, 0.3, 0.09], {"M_stone"}),
    # on the floor: a floor vase of dried pampas, a travertine drum side table, a fiddle-leaf fig, a small potted plant
    "floor_vase": ([0.45, 0.45, 1.5], {"M_terracotta", "M_rattan", "M_bronze"}),
    "drum_table": ([0.5, 0.5, 0.5], {"M_stone"}),
    "fiddle_leaf": ([0.9, 0.9, 2.1], {"M_terracotta", "M_teak", "M_leaf"}),
    "plant_pot": ([0.3, 0.3, 0.45], {"M_terracotta", "M_leaf"}),
    # on the walls: a framed abstract print, a round mirror in a teak ring, a towel bar
    "art_print": ([0.9, 0.04, 1.2], {"M_bronze", "M_linen", "M_terracotta"}),
    "mirror_round": ([0.9, 0.04, 0.9], {"M_teak", "M_bronze"}),
    "towel_bar": ([0.6, 0.1, 0.5], {"M_bronze", "M_linen"}),
    # furniture: a teak and cane buffet, a slim console, a bench with a linen pad, the table lamp
    "buffet": ([2.0, 0.45, 0.8], {"M_teak", "M_rattan", "M_bronze"}),
    "console_slim": ([1.4, 0.35, 0.8], {"M_teak", "M_bronze"}),
    "bench": ([1.4, 0.4, 0.46], {"M_teak", "M_linen"}),
    "table_lamp": ([0.35, 0.35, 0.62], {"M_ceramic", "M_bronze", "M_led"}),
    # dining and kitchen: the table laid for eight, a fruit bowl, the counter's board, crock, kettle and jars, herbs in
    # pots, a stool's pad
    "table_setting": ([2.6, 0.95, 0.3], {"M_ceramic", "M_glassware", "M_drape", "M_bronze", "M_stone", "M_leaf"}),
    "fruit_bowl": ([0.4, 0.4, 0.16], {"M_stone", "M_terracotta", "M_leaf"}),
    "counter_set": ([0.9, 0.35, 0.45], {"M_teak", "M_ceramic", "M_bronze"}),
    "herb_pots": ([0.6, 0.18, 0.3], {"M_terracotta", "M_leaf", "M_teak"}),
    "seat_pad": ([0.36, 0.36, 0.05], {"M_linen"}),
    # baths and the foyer: a toiletries tray, a bath mat, an umbrella stand; jute rugs, a runner
    "toiletry_tray": ([0.35, 0.15, 0.2], {"M_stone", "M_ceramic", "M_teak"}),
    "bath_mat": ([0.8, 0.5, 0.01], {"M_linen"}),
    "umbrella_stand": ([0.3, 0.3, 0.75], {"M_rattan", "M_bronze", "M_terracotta"}),
    "rug_jute": ([2.4, 1.6, 0.01], {"M_rattan", "M_linen"}),
    "runner_rug": ([3.0, 0.8, 0.01], {"M_rattan", "M_linen"}),
    "rug_large": ([3.6, 2.8, 0.01], {"M_rattan", "M_linen"}),
    # the basement's accents: the cellar's decanter and glasses on a tray, the spa's rolled towels, the gym's towel and
    # bottles
    "wine_set": ([0.45, 0.3, 0.32], {"M_teak", "M_wine", "M_glassware"}),
    "spa_towels": ([0.45, 0.3, 0.18], {"M_linen"}),  # the spa's own linen: no draw call more behind the light well
    "gym_kit": ([0.4, 0.25, 0.25], {"M_linen", "M_ceramic", "M_bronze"}),
}
INTERIOR_PALETTE = {"M_linen", "M_drape", "M_sheer", "M_teak", "M_bronze", "M_ceramic", "M_leaf", "M_terracotta", "M_rattan",
                    "M_stone", "M_glassware"}
BASEMENT_ACCENTS = {"wine_set": {"M_wine"}}  # the basement's own colours its accents may use as well
FLAT = {"bath_mat", "rug_jute", "runner_rug", "rug_large"}  # lie flat under others (catalog.OVERLAYS)
HUNG = {"art_print": 1.1, "mirror_round": 1.2, "towel_bar": 0.85}  # catalog.WALL_MOUNTED: the bottom over the floor
LARGE = {"table_setting": 700}  # tris; the rest stay under SMALL
SMALL = 450
# One cushion of each cushion kind, by the material it alone is made of; and their triangles before they became pillows
# (three and two squashed icospheres), which a pillow keeps to.
OUTLINES = {"cushions": "M_terracotta", "cushion_pair": "M_rattan"}
CUSHION_TRIS = {"cushions": 240, "cushion_pair": 160}
# The small travertine pieces (MeshBuilder uv_tile STONE_TILE): none shows a joint of the texture's slabs.
STONE = ["drum_table", "bowl", "fruit_bowl", "toiletry_tray", "coffee_decor", "table_setting"]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class AccessoryKitTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = summary(ACCESSORY_EXPR, kinds=list(ACCESSORY_KINDS), outlines=OUTLINES, stone=STONE)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in ACCESSORY_KINDS.items()})

    def test_every_piece_fits_its_footprint_fills_most_of_it_stands_on_its_base_and_stays_low_poly(self):
        eps = 1e-3
        total = 0
        for kind, ([w, d, h], _materials) in ACCESSORY_KINDS.items():
            piece = self.piece(kind)
            x0, x1, y0, y1, z0, z1 = piece["extent"]  # the piece's own space: a wall piece's height is its object's
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z1 <= h + eps, (kind, piece["extent"]))
            self.assertAlmostEqual(z0, 0.0, delta=eps, msg=kind)  # on its base: what sits on a host sits on its top
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, piece["extent"]))
            self.assertLess(piece["tris"], LARGE.get(kind, SMALL), kind)
            self.assertTrue(piece["same_twice"], kind)
            self.assertEqual(piece["attrs"], [], kind)  # indoors: nothing sways
            total += piece["tris"]
        self.assertLess(total, 6500)  # the interior module is a prop: 15k triangles with the curtains

    def test_pieces_use_the_materials_the_design_names_from_the_interiors_small_palette(self):
        for kind, (_size, materials) in ACCESSORY_KINDS.items():
            used = set(self.piece(kind)["materials"])
            self.assertLessEqual(materials, used, kind)
            allowed = INTERIOR_PALETTE | {"M_led"} | BASEMENT_ACCENTS.get(kind, set())
            self.assertLessEqual(used, allowed, kind)
            # the voile is the curtains' alone: the interior's one see-through primitive (glasses are opaque glassware)
            self.assertNotIn("M_sheer", used, kind)

    def test_only_the_table_lamp_glows_and_it_builds_whole_or_as_its_base_and_its_shade(self):
        night = {kind for kind in ACCESSORY_KINDS if self.piece(kind)["night"]}
        self.assertEqual(night, {"table_lamp"})
        self.assertIn("table_lamp", NIGHT_KINDS)
        parts = self.out["parts"]
        self.assertEqual(parts["shade"]["materials"], ["M_led"])  # the room's lamp object: one glowing material
        self.assertEqual(parts["base"]["materials"], ["M_bronze", "M_ceramic"])
        self.assertEqual(self.piece("table_lamp")["tris"], parts["base"]["tris"] + parts["shade"]["tris"])
        self.assertEqual(parts["bad"], "ValueError")
        shade = parts["shade"]["extent"]
        self.assertGreater(shade[4], 0.25)  # over its base
        self.assertAlmostEqual(shade[5], ACCESSORY_KINDS["table_lamp"][0][2], places=3)

    def test_rugs_and_the_bath_mat_lie_flat_and_wall_pieces_hang_at_their_height(self):
        for kind in FLAT:
            self.assertIn(kind, OVERLAYS)
        for kind, height in HUNG.items():
            self.assertEqual(WALL_MOUNTED.get(kind), height, kind)
            self.assertEqual(self.piece(kind)["hangs"], height, kind)
        # a print hangs at eye level, over a console or a bench
        self.assertGreater(HUNG["art_print"], FURNITURE["console_slim"][2])
        # the mirror's glass is in front of its ring, facing the room (-Y)
        spans = self.piece("mirror_round")["spans"]
        self.assertLess(spans["M_bronze"][2], spans["M_teak"][2] + 1e-3)

    def test_the_prints_are_four_compositions(self):
        variants = self.out["variants"]
        self.assertEqual(sorted(variants), ["0", "1", "2", "3"])
        self.assertEqual(len({v["digest"] for v in variants.values()}), 4)
        for variant in variants.values():
            self.assertIn("M_linen", variant["materials"])  # the mat round the shapes
            self.assertLess(variant["spans"]["M_linen"][2], 0.0)  # its face towards the room (-Y)

    def test_the_cushions_lean_back_and_the_pampas_and_the_fig_rise_high(self):
        cushions = self.piece("cushions")["spans"]
        self.assertGreater(cushions["M_terracotta"][3], 0.05)  # against the back (+Y), where a sofa's back is
        self.assertGreater(self.piece("floor_vase")["spans"]["M_rattan"][5], 1.3)  # the plumes over the vase
        self.assertLess(self.piece("floor_vase")["spans"]["M_terracotta"][5], 0.9)
        fig = self.piece("fiddle_leaf")["spans"]
        self.assertGreater(fig["M_leaf"][5], 1.9)
        self.assertLess(fig["M_leaf"][4], 1.2)  # leaves down to the middle of its trunk
        self.assertLess(fig["M_terracotta"][5], 0.6)  # the planter at its foot

    def test_the_table_is_laid_for_eight_round_a_linen_runner(self):
        w, d, h = ACCESSORY_KINDS["table_setting"][0]
        spans = self.piece("table_setting")["spans"]
        self.assertGreater(spans["M_ceramic"][1] - spans["M_ceramic"][0], 0.75 * w)  # the plates down both sides
        self.assertGreater(spans["M_ceramic"][3] - spans["M_ceramic"][2], 0.5 * d)
        runner = spans["M_drape"]
        self.assertLess(runner[3] - runner[2], 0.5 * d)  # a runner down the middle, not a cloth
        self.assertGreater(runner[1] - runner[0], 0.8 * w)
        self.assertLess(runner[5], 0.01)
        self.assertGreater(self.piece("table_setting")["faces"]["M_glassware"], 8 * 6)  # a glass at every place

    def test_the_cushions_are_pillows_not_balls(self):
        # from the site's camera a squashed ball reads as a ball: a pillow's front is a rounded square, thin for its width
        for kind, outline in self.out["outlines"].items():
            self.assertGreater(outline["corner"], 0.85, (kind, outline))
            self.assertLess(outline["deep"], 0.4 * outline["wide"], (kind, outline))
        self.assertEqual(set(self.out["outlines"]), set(OUTLINES))
        for kind, cap in CUSHION_TRIS.items():
            self.assertLessEqual(self.piece(kind)["tris"], cap, kind)

    def test_the_small_stone_pieces_show_no_slab_joint(self):
        # the travertine's UVs measured from the piece itself, half a slab off its joints, wherever it stands: a drum
        # table or a bowl never shows a joint's cross through its middle
        self.assertEqual(set(self.out["stone"]), set(STONE))
        for kind, clear in self.out["stone"].items():
            for where, share in zip(("at the origin", "merged off it, turned"), clear):
                self.assertGreater(share, 0.05, (kind, where))

    def test_surfaces_lie_on_their_hosts(self):
        for kind, tops in SURFACES.items():
            self.assertIn(kind, FURNITURE)
            w, d, h = FURNITURE[kind]
            for z, (x0, y0, x1, y1) in tops:
                self.assertTrue(0.0 < z <= h, (kind, z))
                self.assertTrue(-w / 2 - 1e-6 <= x0 < x1 <= w / 2 + 1e-6 and -d / 2 - 1e-6 <= y0 < y1 <= d / 2 + 1e-6,
                                (kind, (x0, y0, x1, y1)))
        # what the interior puts things on: the house's tables, sideboard, counters, beds, sofa, vanities, nightstands,
        # desk and dresser, and its own buffet, console, bench and drum table
        self.assertLessEqual({"coffee_table", "sideboard", "dining_set_8", "kitchen_island_4", "kitchen_run", "console",
                              "nightstand", "desk", "dresser_mirror", "bed_king", "bed_double", "bed_single", "sofa_l",
                              "vanity_single", "vanity_double", "buffet", "console_slim", "bench", "drum_table",
                              # the basement's accents: on the tasting table, the karaoke's sofa, a massage bed
                              "tasting_table", "karaoke_sofa", "massage_bed"},
                             set(SURFACES))

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

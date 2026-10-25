"""Kennel kit (villa v2 part 4): the Akita, sitting, built whole or as its body, its head and its tail (which the kennel
animates about the pivots of catalog.AKITA_PIVOTS), its dog house, mat, bowls and ball, a small bush, and the coat
colours they are built from."""
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)

KENNEL_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import catalog, furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS, WIND_SPANS

KINDS, PARTS, VARIANTS = {kinds!r}, {parts!r}, {variants!r}

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(float(v), 4) for v in values]

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

def used(ob):
    return sorted(ob.data.materials[i].name for i in {{poly.material_index for poly in ob.data.polygons}})

def summary_of(ob):
    return {{"tris": tris(ob), "extent": extent(ob), "materials": used(ob), "spans": spans(ob),
            "night": ob.get("night_light") is True, "attrs": [a.name for a in ob.data.color_attributes]}}

def error(call):
    try:
        call()
    except (TypeError, ValueError) as exc:
        return type(exc).__name__
    return None

def islands(ob, material):
    # the pieces of `material` in a mesh, faces joined through the vertices they share: a set of vertex indices each
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

def depth(ob, piece, into):
    # how deep the vertices of one piece reach into another, convex one (behind all of its faces' planes), 0 if not
    planes = [(p.center.copy(), p.normal.copy()) for p in ob.data.polygons if p.vertices[0] in into]
    return max(max(0.0, min((c - ob.data.vertices[v].co).dot(n) for c, n in planes)) for v in piece)

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS),
       "wind_spans": {{k: list(WIND_SPANS[k]) for k in KINDS if k in WIND_SPANS}},
       "pivots": {{k: list(v) for k, v in getattr(catalog, "AKITA_PIVOTS", {{}}).items()}},
       "palette": {{}}}}
for key in ("akita_red", "akita_cream", "dog_dark"):
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
    pieces[kind] = dict(summary_of(ob), same_twice=digest(ob) == digest(again))
out["pieces"] = pieces

parts = {{}}
if "akita" in FURNITURE:
    for part in PARTS:
        try:
            ob = furniture.place(col, "A_" + part, "akita", (0.0, 0.0, 0.0), 0, mats, part=part)
        except TypeError:
            parts[part] = None
            continue
        parts[part] = summary_of(ob)
        if part == "tail":
            parts[part]["red_pieces"] = len(islands(ob, "M_akita_red"))
        if part == "body":
            # the cream hind feet on the ground (the forepaws stand further forward), and how far each one and the
            # red of the legs over it reach into one another
            red = islands(ob, "M_akita_red")
            feet = [piece for piece in islands(ob, "M_akita_cream")
                    if min(ob.data.vertices[v].co.z for v in piece) < 0.005
                    and sum(ob.data.vertices[v].co.y for v in piece) / len(piece) > -0.12]
            parts[part]["hind_feet"] = [round(max(max(depth(ob, foot, leg), depth(ob, leg, foot)) for leg in red), 3)
                                        for foot in feet]
        if part == "head":
            top = max(ob.data.vertices, key=lambda v: v.co.z)
            names = [m.name for m in ob.data.materials]
            parts[part]["top_material"] = sorted({{names[p.material_index] for p in ob.data.polygons
                                                  if top.index in p.vertices}})
    parts["bad"] = error(lambda: furniture.place(col, "A_bad", "akita", (0.0, 0.0, 0.0), 0, mats, part="paw"))
out["parts"] = parts

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
        found.append(dict(summary_of(ob), digest=digest(ob)))
    bad = error(lambda: furniture.place(col, f"V_{{kind}}_bad", kind, (0.0, 0.0, 0.0), 0, mats, variant=count))
    variants[kind] = {{"variants": found, "bad": bad}}
out["variants"] = variants

winds = {{}}
if "bush" in WIND_SPANS:
    on = furniture.place(col, "W_bush", "bush", (0.0, 0.0, 0.0), 0, mats, wind=True)
    data = on.data.color_attributes["wind"].data
    weight = [data[v.index].color[0] for v in on.data.vertices]
    winds["bush"] = {{"attrs": [a.name for a in on.data.color_attributes], "min": round(min(weight), 4),
                     "max": round(max(weight), 4),
                     "high": round(weight[max(on.data.vertices, key=lambda v: v.co.z).index], 4)}}
out["winds"] = winds
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the kennel pieces and the palette materials each is built from (a piece may use more).
KENNEL_KINDS = {
    "akita": ([0.48, 0.8, 0.95], {"M_akita_red", "M_akita_cream", "M_dog_dark"}),
    "dog_house": ([1.1, 1.0, 1.1], {"M_teak", "M_frame", "M_metal"}),
    "dog_mat": ([1.1, 0.8, 0.03], {"M_fabric_dark"}),
    "dog_bowl": ([0.26, 0.26, 0.09], {"M_flower_red"}),
    "dog_ball": ([0.12, 0.12, 0.12], {"M_flower_red"}),
    "bush": ([0.8, 0.8, 0.7], {"M_leaf"}),
}
PARTS = ["body", "head", "tail"]
VARIANTS = {"dog_bowl": 2}
COAT = {"M_akita_red", "M_akita_cream"}


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class KennelKitTest(unittest.TestCase):
    """The Akita and its corner: a dog house, a mat, two bowls, a ball and a bush."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(KENNEL_EXPR, kinds=list(KENNEL_KINDS), parts=PARTS, variants=VARIANTS)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def part(self, part):
        found = self.out["parts"].get(part)
        self.assertIsNotNone(found, f"the akita has no part {part}")
        return found

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in KENNEL_KINDS.items()})

    def test_palette_has_the_akitas_red_fawn_coat_its_cream_urajiro_and_a_dark_for_eyes_and_nose(self):
        palette = self.out["palette"]
        self.assertEqual(sorted(entry["name"] for entry in palette.values()),
                         ["M_akita_cream", "M_akita_red", "M_dog_dark"])
        for entry in palette.values():
            self.assertEqual(entry["strength"], 0.0, entry["name"])
            self.assertEqual(entry["images"], [], entry["name"])
        red, green, blue = palette["akita_red"]["color"]
        self.assertTrue(red > 0.4 and red > 2.5 * green and green > blue, palette["akita_red"])  # warm red-fawn
        red, green, blue = palette["akita_cream"]["color"]
        self.assertTrue(blue > 0.55 and red >= green >= blue, palette["akita_cream"])  # pale warm cream
        self.assertLess(max(palette["dog_dark"]["color"]), 0.05)

    def test_nothing_glows_and_only_the_bush_sways(self):
        self.assertEqual(self.out["night"], [])
        self.assertEqual(sorted(self.out["wind_spans"]), ["bush"])
        bush = self.out["winds"]["bush"]
        self.assertEqual(bush["attrs"], ["wind"])
        self.assertEqual(bush["min"], 0.0)  # its foot on the ground stays put
        self.assertGreater(bush["high"], 0.85)

    def test_every_piece_fits_its_footprint_fills_most_of_it_and_stays_low_poly(self):
        eps = 1e-3
        for kind, ([w, d, h], materials) in KENNEL_KINDS.items():
            piece = self.piece(kind)
            x0, x1, y0, y1, z0, z1 = piece["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, piece["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, piece["extent"]))
            self.assertLessEqual(materials, set(piece["materials"]), kind)
            self.assertTrue(piece["same_twice"], kind)
            self.assertEqual(piece["attrs"], [], kind)
            self.assertLess(piece["tris"], 1200 if kind == "akita" else 400, kind)

    def test_the_akita_builds_whole_or_as_its_body_head_and_tail(self):
        whole = self.piece("akita")
        body, head, tail = (self.part(part) for part in PARTS)
        self.assertEqual(set(body["materials"]), COAT)
        self.assertEqual(set(head["materials"]), COAT | {"M_dog_dark"})  # dark eyes and nose
        self.assertEqual(set(tail["materials"]), COAT)
        self.assertEqual(whole["tris"], body["tris"] + head["tris"] + tail["tris"])
        self.assertEqual(self.out["parts"]["bad"], "ValueError")

    def test_the_head_turns_on_its_neck_and_the_tail_wags_from_its_root(self):
        pivots = self.out["pivots"]
        self.assertEqual(sorted(pivots), ["head", "tail"])
        bx0, bx1, by0, by1, bz0, bz1 = self.part("body")["extent"]
        hx0, hx1, hy0, hy1, hz0, hz1 = self.part("head")["extent"]
        x, y, z = pivots["head"]
        self.assertTrue(bx0 < x < bx1 and by0 < y < by1 and bz0 < z <= bz1 + 0.05, pivots["head"])  # on the neck
        self.assertTrue(hz0 < z < hz1 and hy0 < y < hy1, (pivots["head"], self.part("head")["extent"]))
        self.assertLess(hy0, by0)  # the muzzle out in front of the chest
        x, y, z = pivots["tail"]
        tx0, tx1, ty0, ty1, tz0, tz1 = self.part("tail")["extent"]
        self.assertTrue(bx0 < x < bx1 and by0 < y < by1 and bz0 < z < bz1, pivots["tail"])  # at the rump
        self.assertGreater(tz1, z + 0.1)  # curled up over the back
        self.assertTrue(by0 < ty0 and ty1 <= by1 + 0.05, (self.part("tail")["extent"], self.part("body")["extent"]))

    def test_the_akita_sits_nose_first_with_pricked_ears_and_cream_on_its_muzzle_chest_and_paws(self):
        w, d, h = KENNEL_KINDS["akita"][0]
        head = self.part("head")
        self.assertGreater(head["extent"][5], 0.9 * h)  # the ear tips
        self.assertEqual(head["top_material"], ["M_akita_red"])  # pricked red ears
        dark = head["spans"]["M_dog_dark"]
        self.assertAlmostEqual(dark[2], head["extent"][2], places=2)  # the nose leads
        cream, red = head["spans"]["M_akita_cream"], head["spans"]["M_akita_red"]
        self.assertLess(cream[2], red[2])  # the cream muzzle in front of the red skull
        self.assertLess(cream[5], red[5] - 0.15)  # low on the face, the red rising to the ears
        body = self.part("body")["spans"]
        self.assertAlmostEqual(body["M_akita_cream"][4], 0.0, places=3)  # cream paws on the ground
        self.assertLess(body["M_akita_cream"][2], body["M_akita_red"][2] + 0.03)  # a cream chest and forelegs
        self.assertGreater(body["M_akita_red"][3], body["M_akita_cream"][3] - 0.05)  # red haunches behind

    def test_the_hind_feet_join_the_legs_and_the_tail_is_one_smooth_tube(self):
        feet = self.part("body")["hind_feet"]
        self.assertEqual(len(feet), 2)
        for reach in feet:  # a foot sunk into its leg, not a lump lying in front of it
            self.assertGreaterEqual(reach, 0.02, feet)
        self.assertEqual(self.part("tail")["red_pieces"], 1)  # swept along its curl: no beads at the joints

    def test_the_dog_house_has_a_pitched_roof_an_arched_door_and_a_plate_over_it(self):
        w, d, h = KENNEL_KINDS["dog_house"][0]
        spans = self.piece("dog_house")["spans"]
        self.assertAlmostEqual(spans["M_frame"][5], h, places=3)  # the ridge
        tx0, tx1, ty0, ty1, tz0, tz1 = spans["M_teak"]
        self.assertLess(tz1, h - 0.05)  # under the roof
        mx0, mx1, my0, my1, mz0, mz1 = spans["M_metal"]
        self.assertLess(my0, ty0 + 0.05)  # on the front
        self.assertLess(mx1 - mx0, 0.5 * w)
        self.assertGreater(mz0, 0.5 * h)

    def test_the_mat_lies_flat_the_bowls_hold_water_or_food_and_the_ball_is_red(self):
        self.assertLessEqual(self.piece("dog_mat")["extent"][5], 0.03)
        water, food = self.out["variants"]["dog_bowl"]["variants"]
        self.assertIn("M_water", water["materials"])
        self.assertIn("M_teak", food["materials"])  # kibble
        self.assertNotEqual(water["digest"], food["digest"])
        self.assertEqual(self.out["variants"]["dog_bowl"]["bad"], "ValueError")
        self.assertEqual(self.piece("dog_ball")["materials"], ["M_flower_red"])

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

"""Garden kit (villa v2 part 2): the catalog pieces of the garden modules, and the MeshBuilder and furniture helpers
that merge many pieces into a few objects (one draw call per material and object)."""
import unittest

from helpers import blender_available
from test_archkit import summary

GARDEN_EXPR = """
import json, math, sys, types
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS, WIND_SPANS
from archkit.furniture import garden as garden_kit
from archkit.mesh import MeshBuilder
from garden import assemble
try:
    from garden import lights
except ImportError:
    lights = None

KINDS, WIND_KINDS = {kinds!r}, {wind_kinds!r}

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
        found[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                           for axis in range(3) for f in (min, max)]
    return found

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
col = scene.module_collection("kit", (20.0, 20.0), "hero")  # every piece, twice, with its variants: over a prop's 15k
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS),
       "wind_spans": {{k: list(WIND_SPANS[k]) for k in WIND_KINDS if k in WIND_SPANS}},
       "palette": {{}}}}
from archkit import catalog
out["coals_z"] = getattr(catalog, "GRILL_COALS_Z", None)
for key in ("flower_pink", "flower_yellow", "flower_red", "flower_white", "cabbage", "gravel", "ember", "pebble",
            "glow_pool"):
    mat = mats.get(key)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    out["palette"][key] = {{"name": mat.name, "color": r(bsdf.inputs["Base Color"].default_value[:3]),
                           "strength": round(bsdf.inputs["Emission Strength"].default_value, 4),
                           "emission": r(bsdf.inputs["Emission Color"].default_value[:3])}}

pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    ob = furniture.place(col, "G_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    again = furniture.place(col, "G2_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    pieces[kind] = {{"tris": tris(ob), "extent": extent(ob), "night": ob.get("night_light") is True,
                    "materials": sorted(m.name for m in ob.data.materials), "spans": spans(ob),
                    "same_twice": digest(ob) == digest(again), "attrs": [a.name for a in ob.data.color_attributes]}}
out["pieces"] = pieces

# wind=True paints 'wind' from the still part (pot, kerb, bed frame) up to the plant tops.
STILL = {{"flower_bed": "M_stone", "flower_pot": "M_terracotta", "topiary_ball": "M_terracotta",
         "topiary_cone": "M_terracotta", "raised_bed": "M_teak", "tomato_trellis": "M_teak"}}
winds = {{}}
for kind in WIND_KINDS:
    if kind not in FURNITURE or kind not in WIND_SPANS:
        continue
    on = furniture.place(col, "W_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, wind=True)
    weight = weights(on)
    still = {{v for poly in on.data.polygons if on.data.materials[poly.material_index].name == STILL[kind]
             for v in poly.vertices}}
    plants = {{v for poly in on.data.polygons
              if on.data.materials[poly.material_index].name.startswith(("M_leaf", "M_flower", "M_cabbage"))
              for v in poly.vertices}}
    winds[kind] = {{"attrs": [a.name for a in on.data.color_attributes], "min": round(min(weight), 4),
                   "still_max": round(max(weight[v] for v in still), 4) if still else None,
                   "plants_max": round(max(weight[v] for v in plants), 4) if plants else None,
                   "high": round(weight[max(on.data.vertices, key=lambda v: v.co.z).index], 4)}}
out["winds"] = winds

# Options: the colour mix of a bed and a pot, the crop of a raised bed.
options = {{}}
if "flower_bed" in FURNITURE:
    beds = [furniture.place(col, f"V_bed_{{v}}", "flower_bed", (0.0, 0.0, 0.0), 0, mats, variant=v) for v in range(4)]
    options["bed_colours"] = [sorted(m.name for m in ob.data.materials if m.name.startswith("M_flower")) for ob in beds]
    options["bed_digests"] = [digest(ob) for ob in beds]
    options["bad_variant"] = error(lambda: furniture.place(col, "V_bad", "flower_bed", (0.0, 0.0, 0.0), 0, mats,
                                                           variant=9))
if "flower_pot" in FURNITURE:
    pots = [furniture.place(col, f"V_pot_{{v}}", "flower_pot", (0.0, 0.0, 0.0), 0, mats, variant=v) for v in range(4)]
    options["pot_colours"] = [sorted(m.name for m in ob.data.materials if m.name.startswith("M_flower")) for ob in pots]
if "raised_bed" in FURNITURE:
    crops = {{}}
    for crop in ("lettuce", "cabbage", "carrot", "herbs"):
        try:
            ob = furniture.place(col, f"V_crop_{{crop}}", "raised_bed", (0.0, 0.0, 0.0), 0, mats, crop=crop)
        except TypeError:
            crops[crop] = None
            continue
        crops[crop] = {{"materials": sorted(m.name for m in ob.data.materials), "tris": tris(ob), "extent": extent(ob),
                       "digest": digest(ob)}}
    options["crops"] = crops
    options["bad_crop"] = error(lambda: furniture.place(col, "V_badcrop", "raised_bed", (0.0, 0.0, 0.0), 0, mats,
                                                        crop="durian"))
out["options"] = options

# MeshBuilder.placed: what a block builds is turned about Z and moved; wind=(z0, z1) paints only the block's vertices.
helpers = {{}}
if hasattr(MeshBuilder, "placed"):
    mb = MeshBuilder("Placed")
    mb.box((0.0, 0.0, 0.0), (1.0, 0.2, 0.1), mats["white"])  # outside any block: stays where it is, weight 0
    with mb.placed((2.0, 3.0, 0.5), math.pi / 2, wind=(0.0, 1.0)):
        mb.box((0.0, -0.1, 0.0), (1.0, 0.1, 1.0), mats["leaf"])  # a 1 m post lying along local +X
    with mb.placed((-2.0, 0.0, 0.0)):
        mb.box((-0.1, -0.1, 0.0), (0.1, 0.1, 0.3), mats["stone"])
    outer = mb.placed((0.0, 0.0, 0.0))
    outer.__enter__()
    nested = error(lambda: mb.placed((1.0, 1.0, 0.0)).__enter__())
    outer.__exit__(None, None, None)
    ob = mb.build(col)
    w = weights(ob) if "wind" in ob.data.color_attributes else []
    leaf = [v for poly in ob.data.polygons if ob.data.materials[poly.material_index].name == "M_leaf"
            for v in poly.vertices]
    white = [v for poly in ob.data.polygons if ob.data.materials[poly.material_index].name == "M_white"
             for v in poly.vertices]
    helpers["placed"] = {{
        "spans": spans(ob), "attrs": [a.name for a in ob.data.color_attributes],
        "leaf_low": round(min(w[v] for v in leaf), 4) if w else None,
        "leaf_high": round(max(w[v] for v in leaf), 4) if w else None,
        "white_max": round(max(w[v] for v in white), 4) if w else None,
        "nested": nested,
    }}
    plain = MeshBuilder("Plain").box((0, 0, 0), (1, 1, 1), mats["white"]).build(col)
    helpers["plain_attrs"] = [a.name for a in plain.data.color_attributes]
if hasattr(MeshBuilder, "slab"):
    quad = [(0.0, 0.0), (4.0, -1.0), (4.0, 3.0), (0.0, 3.0)]
    ccw = MeshBuilder("Slab").slab(quad, 0.0, 0.1, mats["stone"]).build(col)
    cw = MeshBuilder("Slab_cw").slab(list(reversed(quad)), 0.0, 0.1, mats["stone"]).build(col)
    middle = sum((v.co for v in ccw.data.vertices), Vector()) / len(ccw.data.vertices)
    helpers["slab"] = {{"tris": tris(ccw), "closed": closed(ccw), "extent": extent(ccw),
                       "outward": all(p.normal.dot(p.center - middle) > 0 for p in ccw.data.polygons),
                       "cw_outward": all(p.normal.dot(p.center - middle) > 0 for p in cw.data.polygons),
                       "uv": cw.data.uv_layers.active.name if cw.data.uv_layers else None}}
if hasattr(furniture, "place_into"):
    # A piece built into a shared builder lands where furniture.place puts it on its own, in module space.
    alone = furniture.place(col, "Alone", "palm_small", (3.0, -2.0, 0.2), 90, mats)
    world = [alone.matrix_basis @ v.co for v in alone.data.vertices]
    mb = MeshBuilder("Shared")
    furniture.place_into(mb, "side_table", (0.0, 0.0, 0.0), 0, mats)
    furniture.place_into(mb, "palm_small", (3.0, -2.0, 0.2), 90, mats, wind=True)
    shared = mb.build(col)
    w = weights(shared)
    # bmesh does not keep vertices in the order they were made: tell the pieces apart by where they stand
    table = [v.index for v in shared.data.vertices if v.co.xy.length < 0.5]
    palm = [v.index for v in shared.data.vertices if v.co.xy.length >= 0.5]
    moved = [shared.data.vertices[i].co for i in palm]
    helpers["place_into"] = {{
        "same_place": len(table) == 48 and len(palm) == len(world)
                      and all(min((a - b).length for b in moved) < 1e-4 for a in world),
        "table_max": round(max(w[i] for i in table), 4), "palm_max": round(max(w[i] for i in palm), 4),
        "palm_min": round(min(w[i] for i in palm), 4), "night": shared.get("night_light"),
        "bad_wind": error(lambda: furniture.place_into(MeshBuilder("x"), "sofa_l", (0, 0, 0), 0, mats, wind=True)),
        "bad_rot": error(lambda: furniture.place_into(MeshBuilder("y"), "sofa_l", (0, 0, 0), 45, mats)),
    }}
if hasattr(furniture, "place_into") and "topiary_ball" in FURNITURE:
    # Pieces with wind after one another, a subdivided icosphere among them (some bmesh operators leave earlier vertex
    # references dead): every piece keeps its own wind, its still pot at 0.
    mb = MeshBuilder("Clipped")
    furniture.place_into(mb, "palm_small", (0.0, 0.0, 0.0), 0, mats, wind=True)
    furniture.place_into(mb, "topiary_ball", (2.0, 0.0, 0.0), 0, mats, wind=True)
    try:
        clipped = mb.build(col)
    except ReferenceError as exc:
        helpers["clipped"] = {{"error": str(exc)}}
    else:
        w = weights(clipped)
        pots = {{v for poly in clipped.data.polygons
                if clipped.data.materials[poly.material_index].name == "M_terracotta" for v in poly.vertices}}
        ball = [v.index for v in clipped.data.vertices if v.co.x > 1.0 and v.co.z > 1.1]
        helpers["clipped"] = {{"error": None, "pot_max": round(max(w[v] for v in pots), 4),
                              "ball_top": round(min(w[v] for v in ball), 4),
                              "attrs": [a.name for a in clipped.data.color_attributes]}}
if hasattr(MeshBuilder, "disc"):
    # A light pool: a flat fan facing up, its UVs running from 0 at the centre to 1 on the rim (u), v at 0.5; a sector
    # turns from `start` through `sweep` radians.
    full = MeshBuilder("Disc").disc((1.0, 2.0, 0.025), 0.8, mats["glow_pool"], segments=12).build(col, night_light=True)
    half = MeshBuilder("Half_disc").disc((0.0, 0.0, 0.025), 1.1, mats["glow_pool"], segments=12, start=0.0,
                                         sweep=math.pi).build(col, night_light=True)
    uv = full.data.uv_layers.active.data
    at_centre = {{l.index for l in full.data.loops
                 if (full.data.vertices[l.vertex_index].co.xy - Vector((1.0, 2.0))).length < 1e-6}}
    helpers["disc"] = {{
        "tris": tris(full), "half_tris": tris(half), "z": sorted({{round(v.co.z, 4) for v in full.data.vertices}}),
        "up": all(p.normal.z > 0.99 for p in list(full.data.polygons) + list(half.data.polygons)),
        "reach": round(max((v.co.xy - Vector((1.0, 2.0))).length for v in full.data.vertices), 4),
        "centre_u": sorted({{round(uv[i].uv[0], 4) for i in at_centre}}),
        "rim_u": sorted({{round(uv[l.index].uv[0], 4) for l in full.data.loops if l.index not in at_centre}}),
        "v": sorted({{round(d.uv[1], 4) for d in uv}}),
        "half_y_min": round(min(v.co.y for v in half.data.vertices), 4),
    }}

# The painting maps the art atlas onto its own canvas only, not onto other M_art faces of a shared mesh; inside a
# placed() block (place_into) its planar projection would read turned coordinates, so it refuses.
def art_uvs(ob):
    uv = ob.data.uv_layers.active.data
    return sorted((tuple(r(ob.data.vertices[l.vertex_index].co)), tuple(r(uv[l.index].uv))) for l in ob.data.loops
                  if ob.data.vertices[l.vertex_index].co.x > 4.0)

alone = MeshBuilder("Art_alone").box((5.0, 0.0, 0.0), (6.0, 0.1, 1.0), mats["art"]).build(col)
shared = MeshBuilder("Art_shared").box((5.0, 0.0, 0.0), (6.0, 0.1, 1.0), mats["art"])
furniture.BUILDERS["painting_m"](shared, mats, *FURNITURE["painting_m"], variant=1)
helpers["painting"] = {{"kept": art_uvs(alone) == art_uvs(shared.build(col)),
                       "placed": error(lambda: furniture.place_into(MeshBuilder("P"), "painting_m", (0.0, 0.0, 0.0),
                                                                    90, mats))}}

# The wheelbarrow's handles reach the back of its footprint, however deep it is.
deep = MeshBuilder("Barrow_deep")
garden_kit.wheelbarrow(deep, mats, 0.7, 1.6, 0.7)
helpers["barrow_back"] = spans(deep.build(col))["M_teak"][3]

# A bollard: its glowing band and its triangles.
bollard = furniture.place(col, "Bollard", "garden_lamp", (0.0, 0.0, 0.0), 0, mats)
helpers["bollard"] = {{"tris": tris(bollard), "led": spans(bollard)["M_led"]}}

# assemble.pieces: one MeshBuilder per group (made when the group first shows up), the light pools of layout.POOLS
# built into their lamps' object, cast_shadow = False on the groups of layout.SHADOWLESS.
made = []

class Counting(MeshBuilder):
    def __init__(self, name):
        made.append(name)
        super().__init__(name)

real = assemble.MeshBuilder
assemble.MeshBuilder = Counting
try:
    layout = types.SimpleNamespace(PIECES=[("flower_pot", "Pots", (x, 0.0), 0) for x in (0.0, 1.0, 2.0)]
                                   + [("garden_lamp", "Lamps", (3.0, 0.0), 0)], SHADOWLESS=("Pots",))
    if lights is not None:
        layout.POOLS = [lights.pool("Lamps", "garden_lamp", (3.0, 0.0))]
    obs = assemble.pieces(col, layout, mats)
finally:
    assemble.MeshBuilder = real
helpers["assemble"] = {{"made": made, "objects": sorted(obs),
                       "lamps": sorted(m.name for m in obs["Lamps"].data.materials),
                       "lamps_night": obs["Lamps"].get("night_light"), "pots_shadow": obs["Pots"].get("cast_shadow"),
                       "lamps_shadow": obs["Lamps"].get("cast_shadow")}}
out["helpers"] = helpers
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the garden pieces and the palette materials each is built from (a piece may use more).
GARDEN_KINDS = {
    "flower_bed": ([2.0, 0.9, 0.6], {"M_stone", "M_soil", "M_leaf"}),
    "flower_pot": ([0.6, 0.6, 0.9], {"M_terracotta", "M_soil", "M_leaf"}),
    "topiary_ball": ([0.8, 0.8, 1.2], {"M_terracotta", "M_soil", "M_leaf_dark"}),
    "topiary_cone": ([0.7, 0.7, 1.7], {"M_terracotta", "M_soil", "M_leaf_dark"}),
    "raised_bed": ([2.4, 1.2, 0.85], {"M_teak", "M_soil"}),
    "tomato_trellis": ([2.4, 0.6, 1.7], {"M_teak", "M_soil", "M_leaf", "M_flower_red"}),
    "wheelbarrow": ([0.7, 1.4, 0.7], {"M_metal", "M_teak", "M_frame"}),
    "watering_can": ([0.5, 0.2, 0.35], {"M_metal"}),
    "compost_bin": ([1.0, 1.0, 0.9], {"M_teak", "M_soil"}),
    "tool_shed": ([1.8, 1.2, 2.3], {"M_teak", "M_terracotta", "M_white"}),
    "bbq_grill": ([1.3, 0.65, 1.15], {"M_frame", "M_metal", "M_teak"}),
    "bbq_coals": ([0.72, 0.44, 0.02], {"M_ember"}),
    "outdoor_kitchen": ([2.6, 0.7, 0.95], {"M_teak", "M_stone", "M_metal"}),
    "dining_set_6": ([2.9, 1.9, 0.95], {"M_teak", "M_linen"}),
    "parasol": ([2.6, 2.6, 2.5], {"M_teak", "M_linen", "M_stone"}),
    "pillar_lamp": ([0.3, 0.3, 0.45], {"M_frame", "M_led"}),
}
GARDEN_NIGHT = ["bbq_coals", "pillar_lamp"]
GARDEN_WIND = ["flower_bed", "flower_pot", "topiary_ball", "topiary_cone", "raised_bed", "tomato_trellis"]
FLOWERS = {"M_flower_pink", "M_flower_yellow", "M_flower_red", "M_flower_white"}


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class GardenKitTest(unittest.TestCase):
    """The flower beds, pots and clipped shrubs, the vegetable garden pieces and the barbecue terrace pieces."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(GARDEN_EXPR, kinds=list(GARDEN_KINDS), wind_kinds=GARDEN_WIND)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in GARDEN_KINDS.items()})

    def test_palette_has_bright_flower_colours_cabbage_gravel_pebble_and_a_glowing_ember(self):
        palette = self.out["palette"]
        self.assertEqual(sorted(entry["name"] for entry in palette.values()),
                         ["GLOW_pool", "M_cabbage", "M_ember", "M_flower_pink", "M_flower_red", "M_flower_white",
                          "M_flower_yellow", "M_gravel", "M_pebble"])
        for key in ("flower_pink", "flower_yellow", "flower_red"):
            colour = palette[key]["color"]
            self.assertGreater(max(colour) - min(colour), 0.5, key)  # bright and saturated, never a dull pastel
        self.assertGreater(min(palette["flower_white"]["color"]), 0.85)
        red, green, blue = palette["cabbage"]["color"]
        self.assertTrue(green > red > blue, palette["cabbage"])  # a pale yellow-green, lighter than M_leaf
        self.assertEqual(palette["ember"]["strength"] > 0, True)
        red, green, blue = palette["ember"]["emission"]
        self.assertTrue(red > green > blue, palette["ember"])  # charcoal glow: orange-red, never white
        for key in ("flower_pink", "cabbage", "gravel", "pebble"):
            self.assertEqual(palette[key]["strength"], 0.0, key)
        for got, want in zip(palette["gravel"]["color"], (0.42, 0.39, 0.34)):  # a warm grey, not white concrete at noon
            self.assertAlmostEqual(got, want, places=3)
        pool = palette["glow_pool"]
        self.assertEqual(pool["color"], [0.0, 0.0, 0.0])  # it only adds light (contract glow-material-invalid)
        red, green, blue = pool["emission"]
        self.assertTrue(red > green > blue and pool["strength"] > 0, pool)  # warm lamplight on the grass

    def test_only_the_grills_coals_and_the_pillar_lamp_glow(self):
        self.assertEqual(self.out["night"], GARDEN_NIGHT)
        for kind in GARDEN_KINDS:
            self.assertEqual(self.piece(kind)["night"], kind in GARDEN_NIGHT, kind)

    def test_the_grill_casts_its_shadow_by_day_and_its_coals_glow_apart_from_it(self):
        # The coals lie on the firebox top: the garden builds them into an object of their own, a night light, so the
        # grill itself is a still object that casts a shadow.
        self.assertNotIn("M_ember", self.piece("bbq_grill")["materials"])
        self.assertEqual(self.piece("bbq_coals")["materials"], ["M_ember"])
        self.assertEqual(self.out["coals_z"], 0.86)
        x0, x1, y0, y1, z0, z1 = self.piece("bbq_grill")["spans"]["M_frame"]
        self.assertTrue(z0 <= 0.0 and z1 > 0.9)  # legs, firebox, grate and lid

    def test_lamps_glow_in_tall_bands_that_read_from_the_wallpaper_at_night(self):
        led = self.out["helpers"]["bollard"]["led"]
        self.assertGreaterEqual(led[5] - led[4], 0.25)  # the bollard's band, was 0.12 m
        self.assertLessEqual(self.out["helpers"]["bollard"]["tris"], 160)  # at no cost in triangles
        x0, x1, y0, y1, z0, z1 = self.piece("pillar_lamp")["spans"]["M_led"]
        self.assertGreaterEqual(z1 - z0, 0.28)  # the lantern's glowing core, was 0.22 m
        self.assertGreaterEqual(x1 - x0, 0.2)

    def test_every_piece_fits_its_footprint_fills_most_of_it_and_stays_low_poly(self):
        eps = 1e-3
        for kind, ([w, d, h], _) in GARDEN_KINDS.items():
            x0, x1, y0, y1, z0, z1 = self.piece(kind)["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, self.piece(kind)["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, self.piece(kind)["extent"]))
            self.assertGreater(self.piece(kind)["tris"], 0, kind)
            self.assertLess(self.piece(kind)["tris"], 1000, kind)

    def test_pieces_use_the_materials_the_design_names(self):
        for kind, (_, materials) in GARDEN_KINDS.items():
            self.assertLessEqual(materials, set(self.piece(kind)["materials"]), kind)

    def test_pieces_are_deterministic_and_carry_no_wind_unless_asked(self):
        for kind in GARDEN_KINDS:
            self.assertTrue(self.piece(kind)["same_twice"], kind)
            self.assertEqual(self.piece(kind)["attrs"], [], kind)

    def test_plants_sway_from_their_still_pot_kerb_or_bed_up_to_the_tops(self):
        self.assertEqual(sorted(self.out["wind_spans"]), sorted(GARDEN_WIND))
        for kind in GARDEN_WIND:
            wind = self.out["winds"].get(kind)
            self.assertIsNotNone(wind, kind)
            self.assertEqual(wind["attrs"], ["wind"], kind)
            self.assertEqual(wind["min"], 0.0, kind)
            self.assertEqual(wind["still_max"], 0.0, kind)  # the pot, the kerb or the teak frame never moves
            self.assertGreater(wind["plants_max"], 0.5, kind)
            self.assertGreater(wind["high"], 0.85, kind)  # the highest leaf, flower or stake top sways most

    def test_a_bed_mixes_bright_flowers_and_the_variant_changes_the_mix(self):
        options = self.out["options"]
        self.assertIn("bed_colours", options, "flower_bed is not in the catalog")
        self.assertIn("pot_colours", options, "flower_pot is not in the catalog")
        for colours in options["bed_colours"] + options["pot_colours"]:
            self.assertGreaterEqual(len(colours), 2, colours)
            self.assertLessEqual(set(colours), FLOWERS)
        self.assertEqual(len(set(options["bed_digests"])), 4)  # four variants, four different beds
        self.assertGreaterEqual(len({tuple(c) for c in options["bed_colours"]}), 3)
        self.assertEqual(options["bad_variant"], "ValueError")

    def test_a_raised_bed_grows_the_crop_it_is_given(self):
        crops = self.out["options"].get("crops")
        self.assertIsNotNone(crops, "raised_bed is not in the catalog")
        self.assertTrue(all(crops.values()), crops)
        self.assertIn("M_cabbage", crops["lettuce"]["materials"])
        self.assertIn("M_cabbage", crops["cabbage"]["materials"])
        self.assertIn("M_leaf", crops["carrot"]["materials"])
        self.assertIn("M_leaf_dark", crops["herbs"]["materials"])
        self.assertEqual(len({crop["digest"] for crop in crops.values()}), 4)
        for crop in crops.values():
            self.assertLess(crop["tris"], 1000)
            self.assertLessEqual(crop["extent"][5], 0.85 + 1e-3)
        self.assertEqual(self.out["options"]["bad_crop"], "ValueError")

    def test_pieces_face_their_designed_direction(self):
        coals = self.out["coals_z"] + self.piece("bbq_coals")["spans"]["M_ember"][5]  # [x0, x1, y0, y1, z0, z1]
        self.assertTrue(0.7 < self.out["coals_z"] and coals < 1.0)  # the coals lie in the firebox at working height
        kitchen = self.piece("outdoor_kitchen")["spans"]
        self.assertEqual(kitchen["M_stone"][5], 0.95)  # the travertine worktop is the top of the counter
        parasol = self.piece("parasol")["spans"]
        self.assertGreater(parasol["M_linen"][4], 1.8)  # the canopy is overhead
        shed = self.piece("tool_shed")["spans"]
        self.assertEqual(shed["M_terracotta"][5], 2.3)  # the roof is the top of the shed
        lamp = self.piece("pillar_lamp")["spans"]
        self.assertLess(lamp["M_frame"][4], lamp["M_led"][4])  # the glowing lantern stands on a dark base

    def test_placed_blocks_turn_and_move_what_they_build_and_paint_only_their_own_wind(self):
        placed = self.out["helpers"].get("placed")
        self.assertIsNotNone(placed, "MeshBuilder has no placed() yet")
        # the post along local +X, turned a quarter about Z, runs along +Y from (2, 3), from z 0.5 up to 1.5
        self.assertEqual(placed["spans"]["M_leaf"], [1.9, 2.1, 3.0, 4.0, 0.5, 1.5])
        self.assertEqual(placed["spans"]["M_white"], [0.0, 1.0, 0.0, 0.2, 0.0, 0.1])
        self.assertEqual(placed["spans"]["M_stone"], [-2.1, -1.9, -0.1, 0.1, 0.0, 0.3])
        self.assertEqual(placed["attrs"], ["wind"])
        self.assertEqual((placed["leaf_low"], placed["leaf_high"]), (0.0, 1.0))  # wind z 0..1 above the block's 0.5
        self.assertEqual(placed["white_max"], 0.0)
        self.assertEqual(placed["nested"], "ValueError")
        self.assertEqual(self.out["helpers"]["plain_attrs"], [])

    def test_slab_is_a_closed_prism_over_a_polygon_whichever_way_it_winds(self):
        slab = self.out["helpers"].get("slab")
        self.assertIsNotNone(slab, "MeshBuilder has no slab() yet")
        self.assertEqual(slab["tris"], 12)  # a four-sided slab costs what a box does
        self.assertTrue(slab["closed"])
        self.assertTrue(slab["outward"])
        self.assertTrue(slab["cw_outward"])
        self.assertEqual(slab["extent"], [0.0, 4.0, -1.0, 3.0, 0.0, 0.1])
        self.assertEqual(slab["uv"], "UVMap")

    def test_place_into_builds_a_piece_where_place_would_into_a_shared_object(self):
        into = self.out["helpers"].get("place_into")
        self.assertIsNotNone(into, "archkit.furniture has no place_into() yet")
        self.assertTrue(into["same_place"])
        self.assertEqual(into["table_max"], 0.0)  # the side table does not sway with the palm next to it
        self.assertEqual(into["palm_min"], 0.0)  # its pot stays put
        self.assertGreater(into["palm_max"], 0.9)
        self.assertIsNone(into["night"])  # the caller decides which merged objects glow
        self.assertEqual(into["bad_wind"], "TypeError")
        self.assertEqual(into["bad_rot"], "ValueError")

    def test_pieces_built_into_one_object_one_after_another_each_keep_their_own_wind(self):
        clipped = self.out["helpers"].get("clipped")
        self.assertIsNotNone(clipped)
        self.assertIsNone(clipped["error"])
        self.assertEqual(clipped["attrs"], ["wind"])  # and no other layer reaches the mesh
        self.assertEqual(clipped["pot_max"], 0.0)
        self.assertGreater(clipped["ball_top"], 0.9)

    def test_disc_is_a_flat_fan_facing_up_whose_uvs_run_out_from_its_centre(self):
        disc = self.out["helpers"].get("disc")
        self.assertIsNotNone(disc, "MeshBuilder.disc is missing")
        self.assertEqual((disc["tris"], disc["half_tris"]), (12, 6))
        self.assertEqual(disc["z"], [0.025])
        self.assertTrue(disc["up"])
        self.assertAlmostEqual(disc["reach"], 0.8, places=4)
        self.assertEqual((disc["centre_u"], disc["rim_u"], disc["v"]), ([0.0], [1.0], [0.5]))
        self.assertGreaterEqual(disc["half_y_min"], -1e-4)  # from +X round to -X: the half towards +Y

    def test_a_painting_maps_its_art_onto_its_own_canvas_only_and_refuses_a_shared_turned_mesh(self):
        painting = self.out["helpers"]["painting"]
        self.assertTrue(painting["kept"])  # another piece's M_art faces keep their UVs
        self.assertEqual(painting["placed"], "ValueError")

    def test_the_wheelbarrows_handles_reach_the_back_of_its_footprint(self):
        self.assertTrue(0.77 <= self.out["helpers"]["barrow_back"] <= 0.8 + 1e-3, self.out["helpers"]["barrow_back"])

    def test_assemble_builds_one_mesh_per_group_its_light_pools_and_the_shadowless_groups(self):
        built = self.out["helpers"]["assemble"]
        self.assertEqual(built["made"], ["Pots", "Lamps"])  # a builder only when a group first shows up
        self.assertEqual(built["objects"], ["Lamps", "Pots"])
        self.assertEqual(built["lamps"], ["GLOW_pool", "M_frame", "M_led"])  # the pool under the bollard
        self.assertEqual(built["lamps_night"], True)
        self.assertEqual((built["pots_shadow"], built["lamps_shadow"]), (False, None))

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

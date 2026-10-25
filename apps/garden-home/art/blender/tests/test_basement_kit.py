"""Basement kit (villa v2 spec §12 "Basement"): the wine cellar's racks, barrels and tasting table, the karaoke lounge's
U-shaped velvet sofa, TV, speakers, microphones and disco ball, the spa's sauna cabin (built whole or as its cabin and
the stones of its stove, which glow), massage beds, small stone-edged hot tub, shelf of oils and candles, the gym's
treadmill, squat rack, dumbbell rack, mirror and yoga mats, the light well's palm and uplights, and the colours they are
built from."""
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)
from archkit.catalog import NIGHT_KINDS, OVERLAYS, WALL_MOUNTED, WIND_SPANS  # noqa: E402
from houses.house_parts import common  # noqa: E402

BASEMENT_EXPR = """
import json, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, WALL_MOUNTED

KINDS, PARTS, PALETTE = {kinds!r}, {parts!r}, {palette!r}

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

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}}, "palette": {{}}}}
for key in PALETTE:
    mat = mats.get(key)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    out["palette"][key] = {{"name": mat.name, "color": r(bsdf.inputs["Base Color"].default_value[:3]),
                           "emission": r(bsdf.inputs["Emission Color"].default_value[:3]),
                           "strength": round(bsdf.inputs["Emission Strength"].default_value, 4),
                           "alpha": round(bsdf.inputs["Alpha"].default_value, 4),
                           "images": [n.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]}}

pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    # placed on the floor: a wall-mounted piece's object hangs WALL_MOUNTED over it
    ob = furniture.place(col, "P_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    again = furniture.place(col, "P2_" + kind, kind, (0.0, 0.0, 0.0), 0, mats)
    pieces[kind] = dict(summary_of(ob), same_twice=digest(ob) == digest(again), hangs=WALL_MOUNTED.get(kind, 0.0))
    bpy.data.objects.remove(again)  # the contract counts the module's triangles once
out["pieces"] = pieces

parts = {{}}
if "sauna_cabin" in FURNITURE:
    for part in PARTS:
        try:
            ob = furniture.place(col, "S_" + part, "sauna_cabin", (0.0, 0.0, 0.0), 0, mats, part=part)
        except TypeError:
            parts[part] = None
            continue
        parts[part] = summary_of(ob)
    parts["bad"] = error(lambda: furniture.place(col, "S_bad", "sauna_cabin", (0.0, 0.0, 0.0), 0, mats, part="roof"))
out["parts"] = parts

winds = {{}}
if "palm_courtyard" in FURNITURE:
    try:
        on = furniture.place(col, "W_palm", "palm_courtyard", (0.0, 0.0, 0.0), 0, mats, wind=True)
        data = on.data.color_attributes["wind"].data
        weight = [data[v.index].color[0] for v in on.data.vertices]
        winds["palm_courtyard"] = {{"min": round(min(weight), 4), "max": round(max(weight), 4)}}
    except TypeError:
        winds["palm_courtyard"] = None
out["winds"] = winds

# the basement's flight of the spiral stair: its own treads and turns, its column ending at its top tread (cap=False),
# where the house stair's column goes on
flights = {{}}
for cap in (True, False):
    try:
        ob = furniture.place(col, f"F_{{cap}}", "spiral_stair", (0.0, 0.0, 0.0), 0, mats, rise=4.07, treads=21,
                             turns=1.05, cap=cap)
    except TypeError:
        flights[str(cap)] = None
        continue
    names = [mat.name for mat in ob.data.materials]
    column = [v.co.z for poly in ob.data.polygons if names[poly.material_index] == "M_frame"
              for v in (ob.data.vertices[i] for i in poly.vertices) if v.co.x ** 2 + v.co.y ** 2 < 0.09 ** 2]
    teak = [poly for poly in ob.data.polygons if names[poly.material_index] == "M_teak"]
    flights[str(cap)] = {{"column_top": round(max(column), 3), "teak_top": round(max(
        ob.data.vertices[i].co.z for poly in teak for i in poly.vertices), 3), "teak_faces": len(teak)}}
    bpy.data.objects.remove(ob)
out["flights"] = flights
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the basement pieces and the palette materials each is built from (a piece may use more).
BASEMENT_KINDS = {
    # the wine cellar
    "wine_rack": ([2.0, 0.4, 2.2], {"M_teak", "M_bottle", "M_wine"}),
    "wine_barrel": ([0.75, 1.0, 0.85], {"M_teak", "M_frame"}),
    "tasting_table": ([1.6, 1.4, 1.05], {"M_granite", "M_frame", "M_leather"}),
    # the karaoke lounge
    "karaoke_sofa": ([3.6, 2.8, 0.8], {"M_velvet", "M_teak"}),
    "karaoke_tv": ([2.4, 0.45, 1.5], {"M_screen_on", "M_frame", "M_teak"}),
    "tower_speaker": ([0.35, 0.4, 1.15], {"M_frame", "M_metal"}),
    "mic_stand": ([0.5, 0.5, 1.5], {"M_frame", "M_metal"}),
    "disco_ball": ([0.45, 0.45, 0.45], {"M_disco", "M_chrome"}),
    # the spa
    "sauna_cabin": ([2.4, 2.0, 2.2], {"M_rattan", "GLASS_clear", "M_ember", "M_metal"}),
    "massage_bed": ([0.75, 2.0, 0.75], {"M_teak", "M_linen"}),
    "hot_tub_small": ([2.2, 2.2, 0.7], {"M_granite", "M_pool_tile"}),
    "oil_shelf": ([1.2, 0.25, 0.45], {"M_teak", "M_glaze"}),
    "candle_set": ([0.35, 0.25, 0.22], {"M_ceramic", "M_led"}),
    # the gym
    "treadmill": ([0.85, 2.0, 1.4], {"M_frame", "M_rubber", "M_metal"}),
    "weight_rack": ([1.6, 2.2, 2.1], {"M_frame", "M_chrome", "M_rubber", "M_leather"}),
    "dumbbell_rack": ([1.4, 0.5, 0.85], {"M_frame", "M_rubber", "M_chrome"}),
    "mirror_wall": ([3.0, 0.03, 2.0], {"M_chrome", "M_frame"}),
    "yoga_mat": ([0.65, 1.8, 0.01], {"M_cushion"}),
    # the light well
    "palm_courtyard": ([2.6, 2.6, 5.5], {"M_leaf", "M_leaf_dark", "M_soil"}),
    "uplight": ([0.14, 0.14, 0.12], {"M_frame", "M_led"}),
}
PARTS = ["cabin", "door", "stones"]
PALETTE = ["velvet", "bottle", "wine", "carpet", "concrete", "party_led", "glow_party", "glow_room", "disco", "stone",
           "stone_shade", "stone_deep", "glass_rail"]
FLAT = PALETTE[:8]  # the basement's flat colours: no image of their own
CLEAR = 3.2  # the basement's clear height: its ceiling over its floor's finish (house_parts/common.py)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class BasementKitTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = summary(BASEMENT_EXPR, kinds=list(BASEMENT_KINDS), parts=PARTS, palette=PALETTE)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in BASEMENT_KINDS.items()})

    def test_palette_has_velvet_bottle_glass_wine_carpet_concrete_and_the_party_lights(self):
        palette = self.out["palette"]
        self.assertEqual({key: palette[key]["name"] for key in FLAT}, {
            "velvet": "M_velvet", "bottle": "M_bottle", "wine": "M_wine", "carpet": "M_carpet",
            "concrete": "M_concrete", "party_led": "M_party_led", "glow_party": "GLOW_party", "glow_room": "GLOW_room"})
        for key in FLAT:
            self.assertEqual(palette[key]["images"], [], key)
        red, green, blue = palette["velvet"]["color"]
        self.assertTrue(red > 2 * green and blue > green, palette["velvet"])  # a deep plum
        self.assertGreater(palette["bottle"]["color"][1], palette["bottle"]["color"][0])  # green glass
        self.assertGreater(palette["wine"]["color"][0], 3 * palette["wine"]["color"][1])  # a red wine
        self.assertLess(max(palette["concrete"]["color"]), 0.3)  # the dark slab edge round the pit
        # the karaoke's LED strips glow by themselves (night lights), a colour the website then cycles while the party
        # is on; the light they cast on the carpet only adds light, like the garden's pools (contract glow-*)
        self.assertGreater(palette["party_led"]["strength"], 1.0)
        self.assertEqual(palette["glow_party"]["color"], [0.0, 0.0, 0.0])
        self.assertGreater(palette["glow_party"]["strength"], 0.5)
        # the rooms' downlights pool a softer light on their pale floors than the garden's lamps on the lawn
        self.assertEqual(palette["glow_room"]["color"], [0.0, 0.0, 0.0])
        self.assertTrue(0.3 < palette["glow_room"]["strength"] < 1.5, palette["glow_room"])
        for key in ("velvet", "bottle", "wine", "carpet", "concrete"):
            self.assertEqual(palette[key]["strength"], 0.0, key)
            self.assertEqual(palette[key]["alpha"], 1.0, key)  # opaque: no extra transparent pass

    def test_palette_has_the_disco_balls_tiles_the_light_wells_shaded_travertine_and_its_railings_fainter_glass(self):
        palette = self.out["palette"]
        # the disco ball's mirror tiles: pale (grey, not black, under the night's dim light while the party is off), and
        # glowing while it is on (the kind is a night light of the party group), a colour the website cycles with the LEDs
        disco = palette["disco"]
        self.assertEqual(disco["name"], "M_disco")
        self.assertGreater(min(disco["color"]), 0.6)
        self.assertGreater(disco["strength"], 0.5)
        self.assertEqual(disco["alpha"], 1.0)
        # the light well's walls darken towards its floor: the travertine's own texture, tinted darker and darker
        stone, shade, deep = palette["stone"], palette["stone_shade"], palette["stone_deep"]
        self.assertEqual((shade["name"], deep["name"]), ("M_stone_shade", "M_stone_deep"))
        for entry in (shade, deep):
            self.assertEqual(entry["images"], stone["images"], entry["name"])  # no texture more
            self.assertEqual(entry["strength"], 0.0)
        for k in range(3):
            self.assertTrue(stone["color"][k] > shade["color"][k] > deep["color"][k], k)
        self.assertLess(max(deep["color"]), 0.45)
        # the railing round its top reflects the sky less than the house's panes (contract glass alpha 0.1 at least)
        rail = palette["glass_rail"]
        self.assertEqual(rail["name"], "GLASS_rail")
        self.assertTrue(0.1 <= rail["alpha"] < 0.2, rail)

    def test_every_piece_fits_its_footprint_fills_most_of_it_and_stays_low_poly(self):
        eps = 1e-3
        total = 0
        for kind, ([w, d, h], materials) in BASEMENT_KINDS.items():
            piece = self.piece(kind)
            x0, x1, y0, y1, z0, z1 = piece["extent"]  # in the piece's own space: a wall piece's height is its object's
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, piece["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, piece["extent"]))
            self.assertLessEqual(materials, set(piece["materials"]), kind)
            self.assertTrue(piece["same_twice"], kind)
            self.assertLess(piece["tris"], 900, kind)
            total += piece["tris"]
        self.assertLess(total, 8000)  # the basement is a prop: 15k triangles for the whole module

    def test_screens_candles_and_uplights_glow_at_night(self):
        self.assertLessEqual({"karaoke_tv", "candle_set", "uplight"}, NIGHT_KINDS)
        for kind in ("karaoke_tv", "candle_set", "uplight"):
            self.assertTrue(self.piece(kind)["night"], kind)
        # the disco ball's tiles glow while the party is on: a night light (of the party group, whose toggle drives it)
        self.assertTrue(self.piece("disco_ball")["night"])
        # the TV's lit screen faces the room (-Y) above its low unit
        w, d, h = BASEMENT_KINDS["karaoke_tv"][0]
        screen = self.piece("karaoke_tv")["spans"]["M_screen_on"]
        self.assertLess(screen[2], -d / 2 + 0.15)
        self.assertGreater(screen[4], 0.4)

    def test_what_hangs_on_a_wall_ends_under_the_cut_but_the_disco_ball_hangs_over_it(self):
        # the basement's cut runs CUT_ABOVE_FLOOR over its floor (web cutaway.ts); the shelf of oils stays whole under
        # it, the mirror rises over it like the walls, the disco ball hangs from the ceiling over the karaoke's middle
        cut = common.CUT_ABOVE_FLOOR
        self.assertLessEqual(WALL_MOUNTED["oil_shelf"] + BASEMENT_KINDS["oil_shelf"][0][2], cut)
        self.assertLess(WALL_MOUNTED["mirror_wall"], 0.5)
        ball = WALL_MOUNTED["disco_ball"]
        self.assertTrue(cut < ball and ball + BASEMENT_KINDS["disco_ball"][0][2] < CLEAR - 0.3, ball)

    def test_the_wine_racks_show_bottle_ends_on_their_front(self):
        w, d, h = BASEMENT_KINDS["wine_rack"][0]
        spans = self.piece("wine_rack")["spans"]
        for mat in ("M_bottle", "M_wine"):
            self.assertLess(spans[mat][2], -d / 2 + 0.06, mat)  # on the front face, facing the room
            self.assertLess(spans[mat][1] - spans[mat][0], w)
            self.assertGreater(spans[mat][5] - spans[mat][4], 0.6 * h)  # rows of them up the rack

    def test_the_sauna_cabin_builds_whole_or_as_its_cabin_its_glass_door_and_the_stones_of_its_stove(self):
        # the basement builds the door with its glass walls and the stones with the sauna group's glow, so its spa
        # draws opaque and the stones glow on their own
        whole = self.piece("sauna_cabin")
        cabin, door, stones = (self.out["parts"][part] for part in PARTS)
        for part in (cabin, door, stones):
            self.assertIsNotNone(part)
        self.assertEqual(cabin["materials"], ["M_rattan"])
        self.assertEqual(door["materials"], ["GLASS_clear"])
        self.assertEqual(stones["materials"], ["M_ember", "M_metal"])  # the stove and its glowing stones
        self.assertEqual(whole["tris"], cabin["tris"] + door["tris"] + stones["tris"])
        self.assertEqual(self.out["parts"]["bad"], "ValueError")
        # its glass door faces the room (-Y), the stones sit low in the cabin
        w, d, h = BASEMENT_KINDS["sauna_cabin"][0]
        self.assertLess(door["spans"]["GLASS_clear"][2], -d / 2 + 0.1)
        self.assertLess(stones["extent"][5], 0.6 * h)

    def test_the_hot_tub_is_a_stone_edged_tiled_basin(self):
        w, d, h = BASEMENT_KINDS["hot_tub_small"][0]
        spans = self.piece("hot_tub_small")["spans"]
        self.assertAlmostEqual(spans["M_granite"][5], h, places=3)  # the stone rim on top
        tile = spans["M_pool_tile"]
        self.assertTrue(tile[0] > -w / 2 and tile[1] < w / 2 and tile[2] > -d / 2 and tile[3] < d / 2, tile)

    def test_the_palm_sways_and_the_yoga_mats_lie_flat_under_nothing(self):
        self.assertIn("palm_courtyard", WIND_SPANS)
        self.assertEqual(self.out["winds"]["palm_courtyard"]["min"], 0.0)
        self.assertGreater(self.out["winds"]["palm_courtyard"]["max"], 0.9)
        self.assertIn("yoga_mat", OVERLAYS)

    def test_the_spiral_stair_builds_a_flight_of_given_treads_and_turns_whose_column_stops_at_its_top(self):
        flights = self.out["flights"]
        capped, open_top = flights["True"], flights["False"]
        self.assertIsNotNone(open_top)
        self.assertEqual(open_top["teak_top"], 4.07)  # the top tread flush with the floor it reaches
        self.assertEqual(open_top["teak_faces"], 21 * 7)  # 21 wedge treads of 7 faces
        self.assertEqual(open_top["column_top"], 4.07)
        self.assertEqual(capped["column_top"], round(4.07 + 0.95, 3))  # up to the handrail over the top tread

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

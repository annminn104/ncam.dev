"""Vehicles kit (villa v2 part 4): the two cars of the carport, a double-cab pickup and a convertible supercar, generic
designs with no badges, and the palette they are built from. Each car builds its body or its lights alone (part=), so
the carport merges the lights into a night_light object of their own that a click switches."""
import sys
import unittest

from helpers import SCRIPTS_DIR, blender_available
from test_archkit import summary

sys.path.insert(0, SCRIPTS_DIR)

VEHICLES_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS, WIND_SPANS

KINDS = {kinds!r}

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

def highest(ob, x, y0, y1, material=None):
    # the highest point of the faces over the strip |x| < x, y0 <= y <= y1 (their middles in it; of the faces of
    # `material` only, if given): what covers the middle of a cargo bed or of a cockpit, None when nothing does
    names = [mat.name for mat in ob.data.materials]
    zs = [ob.data.vertices[v].co.z for poly in ob.data.polygons
          if (material is None or names[poly.material_index] == material)
          and abs(poly.center.x) < x and y0 <= poly.center.y <= y1
          for v in poly.vertices]
    return round(max(zs), 3) if zs else None

def error(call):
    try:
        call()
    except (TypeError, ValueError) as exc:
        return type(exc).__name__
    return None

scene.reset()
col = scene.module_collection("kit", (20.0, 20.0), "prop")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS), "wind": sorted(k for k in KINDS if k in WIND_SPANS),
       "palette": {{}}}}
for key in ("paint_green", "paint_red", "glass_tinted", "chrome", "rubber", "leather", "headlight", "taillight"):
    mat = mats.get(key)
    if mat is None:
        continue
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    out["palette"][key] = {{"name": mat.name, "color": r(bsdf.inputs["Base Color"].default_value[:3]),
                           "metallic": round(bsdf.inputs["Metallic"].default_value, 3),
                           "roughness": round(bsdf.inputs["Roughness"].default_value, 3),
                           "alpha": round(bsdf.inputs["Alpha"].default_value, 3),
                           "emission": r(bsdf.inputs["Emission Color"].default_value[:3]),
                           "strength": round(bsdf.inputs["Emission Strength"].default_value, 4),
                           "images": [n.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]}}

pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    found = {{}}
    for part in (None, "body", "lights"):
        opts = {{}} if part is None else {{"part": part}}
        name = f"P_{{kind}}_{{part}}"
        try:
            ob = furniture.place(col, name, kind, (0.0, 0.0, 0.0), 0, mats, **opts)
        except TypeError:
            found[str(part)] = None
            continue
        again = furniture.place(col, name + "_again", kind, (0.0, 0.0, 0.0), 0, mats, **opts)
        found[str(part)] = {{"tris": tris(ob), "extent": extent(ob), "materials": used(ob), "spans": spans(ob),
                            "same_twice": digest(ob) == digest(again), "night": ob.get("night_light") is True,
                            "attrs": [a.name for a in ob.data.color_attributes]}}
    found["bad_part"] = error(lambda: furniture.place(col, "P_bad_" + kind, kind, (0.0, 0.0, 0.0), 0, mats,
                                                      part="roof"))
    body = bpy.data.objects.get(f"P_{{kind}}_body")
    if body is not None and kind == "pickup_truck":
        w, d, h = FURNITURE[kind]
        # the middle of the cargo bed (behind the cab, clear of its walls and the tailgate) and of the cab roof
        found["bed_middle_top"] = highest(body, 0.6, 0.25 * d, 0.42 * d)
        found["cab_roof_top"] = highest(body, 0.6, -0.15 * d, 0.0)
    if body is not None and kind == "convertible_supercar":
        w, d, h = FURNITURE[kind]
        # the top is down: over the seats nothing but the seats, the steering wheel and the cockpit's tub
        found["cockpit_paint_top"] = highest(body, 0.6, -0.1 * d, 0.05 * d, "M_paint_red")
        found["sill"] = furniture.vehicles.SUPERCAR_SILL
    pieces[kind] = found
out["pieces"] = pieces
out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""

# (w, d, h) of the two cars and the palette materials each builds its body and its lights from (a car may use more).
CARS = {
    "pickup_truck": ([1.9, 5.3, 1.85], {"M_paint_green", "GLASS_tinted", "M_chrome", "M_rubber"}),
    "convertible_supercar": ([2.0, 4.5, 1.15], {"M_paint_red", "GLASS_tinted", "M_rubber", "M_leather"}),
}
LIGHTS = {"M_headlight", "M_taillight"}


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class VehiclesKitTest(unittest.TestCase):
    """The pickup and the supercar: sizes, parts, lights at the right ends, glass, wheels and their open tops."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(VEHICLES_EXPR, kinds=list(CARS))

    def part(self, kind, part):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        found = piece[part]
        self.assertIsNotNone(found, f"{kind} takes no part option")
        return found

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in CARS.items()})

    def test_palette_has_two_car_paints_tinted_glass_chrome_rubber_leather_and_car_lights(self):
        palette = self.out["palette"]
        self.assertEqual(sorted(entry["name"] for entry in palette.values()),
                         ["GLASS_tinted", "M_chrome", "M_headlight", "M_leather", "M_paint_green", "M_paint_red",
                          "M_rubber", "M_taillight"])
        for entry in palette.values():
            self.assertEqual(entry["images"], [], entry["name"])  # flat colours: no texture to ship (prop budget)
        red, green, blue = palette["paint_red"]["color"]
        self.assertTrue(red > 0.5 and red > 8 * green and red > 8 * blue, palette["paint_red"])  # a bright red
        red, green, blue = palette["paint_green"]["color"]
        self.assertTrue(green > red and green > blue and green < 0.3, palette["paint_green"])  # deep forest green
        # light enough, and little enough of a mirror for the dark night sky, to read green and not black at night
        # under the carport's roof
        self.assertGreater(green, 0.25, palette["paint_green"])
        self.assertLessEqual(palette["paint_green"]["metallic"], 0.2)
        for key in ("paint_red", "paint_green"):
            self.assertGreater(palette[key]["metallic"], 0.1, key)  # a metallic flake
            self.assertLess(palette[key]["roughness"], 0.45, key)  # glossy
        glass = palette["glass_tinted"]
        self.assertTrue(0.1 <= glass["alpha"] <= 0.5 and glass["roughness"] <= 0.1, glass)  # the contract's GLASS_
        self.assertLess(max(glass["color"]), 0.2)  # dark: the cab reads tinted
        self.assertEqual(palette["chrome"]["metallic"], 1.0)
        self.assertGreater(min(palette["chrome"]["color"]), 0.8)
        self.assertLess(max(palette["rubber"]["color"]), 0.05)
        red, green, blue = palette["leather"]["color"]
        self.assertTrue(red > green > blue, palette["leather"])  # tan
        for key in ("paint_green", "paint_red", "glass_tinted", "chrome", "rubber", "leather"):
            self.assertEqual(palette[key]["strength"], 0.0, key)
        head, tail = palette["headlight"], palette["taillight"]
        self.assertGreater(head["strength"], 0.0)
        self.assertGreater(min(head["emission"]), 0.7)  # a warm white beam
        self.assertGreater(tail["strength"], 0.0)
        red, green, blue = tail["emission"]
        self.assertTrue(red > 0.8 and green < 0.2 and blue < 0.2, tail)  # red

    def test_cars_are_no_night_kind_and_do_not_sway(self):
        self.assertEqual(self.out["night"], [])  # the carport makes their lights' object the night light
        self.assertEqual(self.out["wind"], [])

    def test_each_car_fits_its_footprint_fills_it_and_stays_low_poly(self):
        eps = 1e-3
        for kind, ([w, d, h], _) in CARS.items():
            whole = self.part(kind, "None")
            x0, x1, y0, y1, z0, z1 = whole["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, whole["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.95 * size, (kind, whole["extent"]))
            self.assertAlmostEqual(z0, 0.0, places=3)  # its tyres on the ground
            self.assertTrue(1000 <= whole["tris"] < 2000, (kind, whole["tris"]))  # readable, and a kit piece's cap

    def test_a_car_builds_its_body_or_its_lights_alone_and_both_by_default(self):
        for kind, (_, materials) in CARS.items():
            body, lights, whole = self.part(kind, "body"), self.part(kind, "lights"), self.part(kind, "None")
            self.assertLessEqual(materials, set(body["materials"]), kind)
            self.assertEqual(set(lights["materials"]), LIGHTS, kind)
            self.assertFalse(LIGHTS & set(body["materials"]), kind)
            self.assertEqual(set(whole["materials"]), set(body["materials"]) | LIGHTS, kind)
            self.assertEqual(whole["tris"], body["tris"] + lights["tris"], kind)
            for part in (body, lights, whole):
                self.assertTrue(part["same_twice"], kind)
                self.assertFalse(part["night"], kind)
                self.assertEqual(part["attrs"], [], kind)
            self.assertEqual(self.out["pieces"][kind]["bad_part"], "ValueError", kind)

    def test_headlights_at_the_front_and_tail_lights_at_the_back_on_both_sides(self):
        for kind, ([w, d, h], _) in CARS.items():
            spans = self.part(kind, "lights")["spans"]
            hx0, hx1, hy0, hy1, hz0, hz1 = spans["M_headlight"]
            self.assertLess(hy0, -d / 2 + 0.08, kind)  # on the nose (-Y)
            self.assertLess(hy1, -0.3 * d, kind)
            tx0, tx1, ty0, ty1, tz0, tz1 = spans["M_taillight"]
            self.assertGreater(ty1, d / 2 - 0.08, kind)  # on the tail
            self.assertGreater(ty0, 0.3 * d, kind)
            for x0, x1 in ((hx0, hx1), (tx0, tx1)):  # a pair, or a bar, across the car
                self.assertTrue(x0 < -0.5 * w / 2 and x1 > 0.5 * w / 2, (kind, x0, x1))
            self.assertTrue(0.3 < hz0 < hz1 < 0.85 * h, (kind, hz0, hz1))

    def test_tyres_stand_on_the_ground_inside_the_body_and_glass_sits_above_the_waist(self):
        for kind, ([w, d, h], _) in CARS.items():
            spans = self.part(kind, "body")["spans"]
            x0, x1, y0, y1, z0, z1 = spans["M_rubber"]
            self.assertAlmostEqual(z0, 0.0, places=3, msg=kind)
            self.assertTrue(x0 >= -w / 2 - 1e-3 and x1 <= w / 2 + 1e-3, kind)
            gx0, gx1, gy0, gy1, gz0, gz1 = spans["GLASS_tinted"]
            self.assertGreater(gz0, 0.4 * h, kind)  # windows, not a glass body

    def test_the_pickup_is_a_double_cab_with_roof_bars_and_an_open_cargo_bed(self):
        w, d, h = CARS["pickup_truck"][0]
        piece = self.out["pieces"]["pickup_truck"]
        spans = self.part("pickup_truck", "body")["spans"]
        gx0, gx1, gy0, gy1, gz0, gz1 = spans["GLASS_tinted"]
        self.assertGreater(gy1 - gy0, 1.3)  # windscreen to back window over two rows of doors
        self.assertLess(gy1, 0.15 * d)  # the cab in front, the bed behind it
        self.assertGreater(piece["cab_roof_top"], 1.7)
        self.assertIsNotNone(piece["bed_middle_top"], "no bed floor in the middle of the bed")
        self.assertTrue(0.5 < piece["bed_middle_top"] < 1.0, piece["bed_middle_top"])  # open: only its floor there
        self.assertAlmostEqual(self.part("pickup_truck", "body")["extent"][5], h, places=2)  # the roof bars on top

    def test_the_supercar_is_a_low_wedge_with_its_top_down_seats_and_a_windscreen(self):
        w, d, h = CARS["convertible_supercar"][0]
        piece = self.out["pieces"]["convertible_supercar"]
        spans = self.part("convertible_supercar", "body")["spans"]
        gx0, gx1, gy0, gy1, gz0, gz1 = spans["GLASS_tinted"]
        self.assertLess(gy1, -0.05 * d)  # only the windscreen, in front of the seats
        self.assertGreater(gz1, 0.9)
        lx0, lx1, ly0, ly1, lz0, lz1 = spans["M_leather"]
        cockpit = piece["cockpit_paint_top"]
        self.assertIsNotNone(cockpit, "no painted body under the cockpit")
        self.assertGreater(lz1, cockpit + 0.1)  # the seat backs rise over the doors
        # no roof over the cockpit, and its floor (the body's top under the tub) well above the sill
        self.assertTrue(piece["sill"] + 0.4 < cockpit < 0.85, (cockpit, piece["sill"]))
        self.assertLess(self.part("convertible_supercar", "body")["extent"][5], h + 1e-3)

    def test_a_module_with_both_cars_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


if __name__ == "__main__":
    unittest.main()

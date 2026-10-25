import json
import unittest

from helpers import SCRIPTS_DIR, blender_available, run_blender_expr

# Each expression builds parts in a fresh scene and prints a JSON summary on a line starting with "ARCHKIT ".
KIT_EXPR = """
import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
from archkit import glazing, materials, scene, structure
from archkit.mesh import MeshBuilder

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(v, 4) for v in values]

scene.reset()
col = scene.module_collection("kit", (10.0, 10.0), "prop")
mats = materials.palette()
out = {{}}

box = MeshBuilder("Box").box((0, 0, 0), (1, 2, 3), mats["white"]).build(col)
out["box"] = {{"tris": tris(box), "dims": r(box.dimensions), "materials": [m.name for m in box.data.materials],
              "uv": box.data.uv_layers.active.name}}
turned = MeshBuilder("Turned").box((0, 0, 0), (2, 1, 1), mats["white"], rot_z=math.pi / 2).build(col)
sideways = MeshBuilder("Sideways").cylinder((0, 0, 0), 0.5, 2.0, mats["white"], segments=8, axis="y").build(col)
extent = lambda ob: [r((min(v.co[i] for v in ob.data.vertices), max(v.co[i] for v in ob.data.vertices)))
                     for i in range(3)]
out["turned"] = {{"extent": extent(turned), "tris": tris(turned)}}
out["sideways"] = {{"extent": extent(sideways), "tris": tris(sideways)}}
frame, panes = glazing.curtain_wall(col, "front", (-3.0, -2.0), (3.0, -2.0), 0.0, 3.0, 3, mats)
out["curtain"] = {{"frame": frame.name, "panes": [p.name for p in panes], "pane_width": round(panes[0].dimensions.x, 4),
                  "pane_materials": sorted({{m.name for p in panes for m in p.data.materials}})}}
rail, rail_panes = glazing.glass_railing(col, "edge", (2.0, -1.0), (2.0, 1.0), 3.0, 1.1, 2, mats)
out["railing"] = {{"rail": rail.name, "panes": [p.name for p in rail_panes],
                  "pane_height": round(rail_panes[0].dimensions.z, 4)}}
door = glazing.sliding_door(col, "Door", 0.0, 1.2, -2.0, 0.0, 2.4, 1.2, mats)
stair = structure.stair(col, "Stair", 0.0, 0.0, 1.0, 0.0, 10, 0.3, 0.2, mats)
pergola = structure.pergola(col, "Pergola", (-1.0, -1.0), (1.0, 1.0), 0.0, 2.5, 5, mats)
out["stair"] = {{"tris": tris(stair), "top": round(max(v.co.z for v in stair.data.vertices), 4)}}
out["pergola"] = sorted(m.name for m in pergola.data.materials)
glass = mats["glass"].node_tree.nodes["Principled BSDF"]
out["glass"] = {{"alpha": round(glass.inputs["Alpha"].default_value, 4),
                "roughness": round(glass.inputs["Roughness"].default_value, 4)}}
out["textures"] = sorted([img.name, list(img.size)] for img in bpy.data.images)

bpy.context.scene.frame_set(1)
closed = round(door.location.x, 4)
bpy.context.scene.frame_set(30)
out["door"] = {{"action": door.animation_data.action.name, "closed_x": closed, "open_x": round(door.location.x, 4),
               "materials": sorted(m.name for m in door.data.materials)}}
print("ARCHKIT " + json.dumps(out))
"""


KIT_V2_EXPR = """
import hashlib, json, os, sys, tempfile
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import contract
import facts as module_facts
from archkit import glazing, materials, partitions, scene, textures

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(v, 4) for v in values]

def hit(ob, point, direction):
    # Where a ray from `point` along the axis-aligned `direction` first meets the mesh: its coordinate along the
    # ray, or None when it passes through.
    mesh = ob.data
    tree = BVHTree.FromPolygons([v.co[:] for v in mesh.vertices], [p.vertices[:] for p in mesh.polygons])
    location = tree.ray_cast(Vector(point), Vector(direction))[0]
    return None if location is None else round(sum(location[i] * direction[i] for i in range(3)), 4)

def vertices_inside(ob, lo, hi, top, axis=0, eps=1e-4):
    # Vertices strictly inside the opening lo..hi along `axis` and below the door top.
    return sum(1 for v in ob.data.vertices if lo + eps < v.co[axis] < hi - eps and v.co.z < top - eps)

def shared_planes(ob):
    # Pairs of faces that would z-fight: both axis-aligned, in the same plane, facing the same way and overlapping.
    rects = []
    for p in ob.data.polygons:
        axis = max(range(3), key=lambda i: abs(p.normal[i]))
        pts = [ob.data.vertices[i].co for i in p.vertices]
        spans = [(min(q[i] for q in pts), max(q[i] for q in pts)) for i in range(3) if i != axis]
        rects.append((axis, 1 if p.normal[axis] > 0 else -1, round(pts[0][axis], 5), spans))
    return [[a[0], a[1], a[2]] for n, a in enumerate(rects) for b in rects[n + 1:]
            if a[:3] == b[:3] and all(min(x[1], y[1]) - max(x[0], y[0]) > 1e-5 for x, y in zip(a[3], b[3]))]

scene.reset()
col = scene.module_collection("kit", (10.0, 10.0), "prop")
mats = materials.palette()
out = {{}}

solid = partitions.partition(col, "wall_solid", (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats)
along_y = partitions.partition(col, "wall_y", (2.0, 1.0), (2.0, 5.0), 0.5, 3.0, mats)
out["solid"] = {{"name": solid.name, "tris": tris(solid), "dims": r(solid.dimensions),
                "materials": [m.name for m in solid.data.materials], "along_y": r(along_y.dimensions)}}

door = partitions.partition(col, "wall_door", (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats, doors=[(1.0, 0.9)])
ray = lambda x, z: hit(door, (x, -1.0, z), (0.0, 1.0, 0.0))
out["door"] = {{
    "name": door.name, "tris": tris(door), "materials": sorted(m.name for m in door.data.materials),
    "inside": vertices_inside(door, 1.0, 1.9, 2.2),
    "clear": [ray(x, z) for x in (1.02, 1.45, 1.88) for z in (0.05, 1.1, 2.15)],
    "wall": ray(0.5, 1.0), "header": ray(1.45, 2.6), "jamb": ray(0.97, 1.0), "head": ray(1.45, 2.22),
}}

back = partitions.partition(col, "wall_back", (4.0, 0.0), (0.0, 0.0), 0.0, 3.0, mats, doors=[(1.0, 0.9)])
ray_back = lambda x, z: hit(back, (x, -1.0, z), (0.0, 1.0, 0.0))
out["backwards"] = {{
    "clear": [ray_back(x, z) for x in (2.12, 2.55, 2.98) for z in (0.05, 1.1, 2.15)],
    "walled": [ray_back(x, 1.1) for x in (0.5, 1.45, 3.5)], "inside": vertices_inside(back, 2.1, 3.0, 2.2),
}}

up = partitions.partition(col, "wall_up", (0.0, 0.0), (0.0, 5.0), 0.0, 3.0, mats, doors=[(2.0, 1.0)])
ray_up = lambda y, z: hit(up, (-1.0, y, z), (1.0, 0.0, 0.0))
out["along_y_door"] = {{
    "clear": [ray_up(y, z) for y in (2.05, 2.5, 2.95) for z in (0.05, 1.1, 2.15)],
    "walled": [ray_up(1.0, 1.1), ray_up(4.0, 1.1), ray_up(2.5, 2.6)],
}}

def error(name="wall_bad", **kw):
    try:
        partitions.partition(col, name, (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats, **kw)
    except ValueError as exc:
        return str(exc)
    return None

out["errors"] = {{
    "past_end": error(doors=[(3.5, 0.9)]),
    "before_start": error(doors=[(-0.1, 0.9)]),
    "overlap": error(doors=[(1.0, 1.0), (1.5, 0.9)]),
    "no_room_for_frame": error(doors=[(1.0, 0.9)], door_height=2.98),
    "no_width": error(doors=[(1.0, 0.0)]),
}}
out["bad_walls_left_objects"] = sorted(ob.name for ob in col.objects if ob.name.startswith("wall_bad"))
out["touching_openings_ok"] = error("wall_touch", doors=[(0.5, 1.0), (1.5, 1.0)]) is None

# The trim and the wall must not share a face: a jamb or head lying in the plane of a wall face z-fights with it.
tight = partitions.partition(col, "wall_tight", (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats,
                             doors=[(0.0, 0.9), (3.1, 0.9)], door_height=2.95)  # doors at both ends, head to the ceiling
touching = partitions.partition(col, "wall_touching", (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats,
                                doors=[(0.5, 1.0), (1.5, 1.0)])  # no wall between the openings
near = partitions.partition(col, "wall_near", (0.0, 0.0), (4.0, 0.0), 0.0, 3.0, mats,
                            doors=[(0.5, 1.0), (1.56, 1.0)])  # 6 cm between them: the frames share it
out["z_fight"] = {{"door": shared_planes(door), "backwards": shared_planes(back), "along_y": shared_planes(up),
                  "tight": shared_planes(tight), "touching": shared_planes(touching), "near": shared_planes(near)}}
out["neighbours_clear"] = {{
    "touching": [hit(touching, (x, -1.0, z), (0.0, 1.0, 0.0)) for x in (0.55, 1.0, 1.49, 1.51, 2.0, 2.45)
                 for z in (0.05, 1.1, 2.15)],
    "near": [hit(near, (x, -1.0, z), (0.0, 1.0, 0.0)) for x in (0.55, 1.0, 1.45, 1.6, 2.0, 2.5)
             for z in (0.05, 1.1, 2.15)]}}
out["tight"] = {{"degenerate": sum(1 for p in tight.data.polygons if p.area < 1e-9),
                "clear": [hit(tight, (x, -1.0, z), (0.0, 1.0, 0.0)) for x in (0.05, 0.45, 0.85, 3.15, 3.55, 3.95)
                          for z in (0.05, 1.1, 2.9)]}}

panel = glazing.frosted_panel(col, "bath", (0.0, 3.0), (2.0, 3.0), 1.0, 2.5, mats)
bsdf = panel.data.materials[0].node_tree.nodes["Principled BSDF"]
bath_facts = module_facts.collect("kit")
out["frosted"] = {{
    "name": panel.name, "tris": tris(panel), "dims": r(panel.dimensions),
    "materials": [m.name for m in panel.data.materials],
    "alpha": round(bsdf.inputs["Alpha"].default_value, 4),
    "roughness": round(bsdf.inputs["Roughness"].default_value, 4),
    "night_light": panel.get("night_light"),
    "emission": [r(bsdf.inputs["Emission Color"].default_value[:3]), round(bsdf.inputs["Emission Strength"].default_value, 4)],
    "facts": [{{"name": f["name"], "alpha": round(f["alpha"], 4), "roughness": round(f["roughness"], 4)}}
              for f in bath_facts["frosted"]],
    "contract": [e for e in contract.validate(bath_facts) if e.startswith("frosted-material-invalid")],
}}
thick = glazing.frosted_panel(col, "thick", (0.0, 4.0), (0.0, 6.0), 0.0, 2.0, mats, thickness=0.05)
out["frosted"]["thick_dims"] = r(thick.dimensions)

def pixel_digest(img):
    return hashlib.sha1(bytes(bytearray(int(round(p * 255)) for p in img.pixels[:]))).hexdigest()

first, second = textures.art_atlas("T_a"), textures.art_atlas("T_b")
other = textures.art_atlas("T_c", seed=32)
small = textures.art_atlas("T_d", width=256, height=128)
cells = {{}}
for i in range(8):
    u0, v0, u1, v1 = textures.art_cell_uv(i)
    w, h = first.size
    x0, x1, y0, y1 = round(u0 * w), round(u1 * w), round(v0 * h), round(v1 * h)
    px = first.pixels[:]
    block = [tuple(px[(y * w + x) * 4:(y * w + x) * 4 + 4]) for y in range(y0, y1) for x in range(x0, x1)]
    cells[i] = {{"size": [x1 - x0, y1 - y0], "colours": len(set(block)), "opaque": all(p[3] == 1.0 for p in block),
                "digest": hashlib.sha1(repr(block).encode()).hexdigest()}}
out["atlas"] = {{
    "size": list(first.size), "name": first.name, "packed": first.packed_file is not None,
    "same_seed_same_pixels": pixel_digest(first) == pixel_digest(second),
    "other_seed_differs": pixel_digest(first) != pixel_digest(other),
    "small_size": list(small.size),
    "cell_sizes": sorted({{tuple(c["size"]) for c in cells.values()}}),
    "min_colours_per_cell": min(c["colours"] for c in cells.values()),
    "all_opaque": all(c["opaque"] for c in cells.values()),
    "distinct_cells": len({{c["digest"] for c in cells.values()}}),
}}
out["cell_uv"] = [list(textures.art_cell_uv(i)) for i in (0, 3, 4, 5, 7)]
out["cell_uv_custom"] = list(textures.art_cell_uv(1, cols=2, rows=2))
try:
    textures.art_cell_uv(8)
    out["cell_uv_range"] = None
except ValueError as exc:
    out["cell_uv_range"] = str(exc)

def material_row(mat):
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    image = next((n.image.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"), None)
    strength = bsdf.inputs["Emission Strength"].default_value
    emission = r(bsdf.inputs["Emission Color"].default_value[:3]) if strength else None
    return [mat.name, r(bsdf.inputs["Base Color"].default_value[:3]), round(bsdf.inputs["Roughness"].default_value, 4),
            round(bsdf.inputs["Metallic"].default_value, 4), round(bsdf.inputs["Alpha"].default_value, 4),
            round(strength, 4), emission, image]

out["palette"] = {{key: material_row(mats[key]) for key in
                  ("frosted", "grape", "tile_bath", "ceramic", "metal", "cushion", "screen_on", "rgb", "art")}}

# Nothing in this scene uses the stone, wood or art materials, so none of their images may reach the saved file.
path = os.path.join(tempfile.mkdtemp(), "kit.blend")
scene.save(path)
bpy.ops.wm.open_mainfile(filepath=path)
out["saved_images"] = sorted(img.name for img in bpy.data.images)
print("ARCHKIT " + json.dumps(out))
"""


FURNISH_EXPR = """import json, math, sys
sys.path.insert(0, {scripts!r})
import bpy
from archkit import furniture, lighting, materials, planting, scene, textures
from archkit.catalog import FURNITURE, NIGHT_KINDS, WALL_MOUNTED

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def art_uvs(ob):
    # Bounds [u0, v0, u1, v1] of every UV of the faces that use M_art.
    layer = ob.data.uv_layers.active.data
    art = [i for i, mat in enumerate(ob.data.materials) if mat.name == "M_art"]
    uvs = [layer[loop].uv[:] for poly in ob.data.polygons if poly.material_index in art for loop in poly.loop_indices]
    return [round(f(c[axis] for c in uvs), 4) for f, axis in ((min, 0), (min, 1), (max, 0), (max, 1))]

scene.reset()
col = scene.module_collection("kit", (10.0, 10.0), "prop")
mats = materials.palette()
out = {{"palette_names": sorted(mat.name for mat in mats.values()), "catalog": {{k: list(v) for k, v in FURNITURE.items()}},
       "night_kinds": sorted(NIGHT_KINDS), "wall_mounted": dict(WALL_MOUNTED)}}
pieces = {{}}
for kind, (w, d, h) in FURNITURE.items():
    ob = furniture.place(col, "F_" + kind, kind, (5.0, 0.0, 1.0), 90, mats)
    xs, ys, zs = zip(*(v.co for v in ob.data.vertices))
    eps = 1e-3
    # Per material: [x0, x1, y0, y1, z0, z1] of the vertices of its faces (local space), for orientation checks.
    spans = {{}}
    for index, mat in enumerate(ob.data.materials):
        used = {{v for poly in ob.data.polygons if poly.material_index == index for v in poly.vertices}}
        spans[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                           for axis in range(3) for f in (min, max)]
    pieces[kind] = {{"tris": tris(ob), "rot": round(math.degrees(ob.rotation_euler.z)), "z": round(ob.location.z, 4),
                    "fits": max(map(abs, xs)) <= w / 2 + eps and max(map(abs, ys)) <= d / 2 + eps
                            and min(zs) >= -eps and max(zs) <= h + eps,
                    "night": ob.get("night_light") is True, "materials": sorted(spans), "spans": spans}}
out["furniture"] = pieces
paint = {{}}
for variant in (0, 5):
    ob = furniture.place(col, f"F_paint_{{variant}}", "painting_m", (0.0, 0.0, 0.0), 0, mats, variant=variant)
    cell = [round(c, 4) for c in textures.art_cell_uv(variant)]
    u0, v0, u1, v1 = art_uvs(ob)
    # The canvas face looks towards -Y: its left edge (min x) must sit at u0, its bottom (min z) at v0.
    art = [i for i, mat in enumerate(ob.data.materials) if mat.name == "M_art"]
    layer = ob.data.uv_layers.active.data
    front = [(ob.data.vertices[ob.data.loops[loop].vertex_index].co, layer[loop].uv) for poly in ob.data.polygons
             if poly.material_index in art and poly.normal.y < -0.5 for loop in poly.loop_indices]
    left, right = min(front, key=lambda p: p[0].x), max(front, key=lambda p: p[0].x)
    bottom, top = min(front, key=lambda p: p[0].z), max(front, key=lambda p: p[0].z)
    paint[variant] = {{"cell": cell, "uv": [u0, v0, u1, v1], "materials": sorted(mat.name for mat in ob.data.materials),
                      "edges": [round(left[1].x, 4), round(bottom[1].y, 4), round(right[1].x, 4), round(top[1].y, 4)]}}
out["painting"] = paint
yaws = set()
desk = bpy.data.objects.get("F_gaming_desk")
if desk:  # the angle each monitor faces, in degrees about Z (0 = straight at -Y)
    screen = [i for i, mat in enumerate(desk.data.materials) if mat.name == "M_screen_on"]
    yaws = {{round(math.degrees(math.atan2(p.normal.x, -p.normal.y)))
            for p in desk.data.polygons if p.material_index in screen and p.normal.y < -0.5}}
out["monitor_yaw"] = sorted(yaws)
try:
    furniture.place(col, "F_paint_8", "painting_l", (0.0, 0.0, 0.0), 0, mats, variant=8)
    out["bad_variant"] = None
except ValueError:
    out["bad_variant"] = "ValueError"
try:
    furniture.place(col, "F_opts", "rug", (0.0, 0.0, 0.0), 0, mats, variant=3)
    out["unknown_option"] = None
except TypeError:
    out["unknown_option"] = "TypeError"

down = lighting.downlights(col, "LT_down", [(0.0, 0.0), (1.0, 0.0)], 3.0, mats)
strip = lighting.led_strip(col, "LT_strip", (0.0, 0.0), (2.0, 0.0), 2.9, mats)
pend = lighting.pendant(col, "LT_pendant", (0.0, 0.0), 3.0, 1.2, mats)
lamp = lighting.point_light(col, "L_test", (0.0, 0.0, 2.5), 48.0)
out["lighting"] = {{
    "night": [bool(ob.get("night_light")) for ob in (down, strip, pend, lamp)],
    "down_top": round(max(v.co.z for v in down.data.vertices), 4),
    "pendant_materials": [m.name for m in pend.data.materials],
    "lamp": [lamp.data.type, lamp.data.energy, lamp.data.use_shadow],
}}
plant = planting.planter(col, "PLANT_test", (0.0, 0.0, 0.0), (1.6, 0.6, 0.6), mats, shrubs=3)
weights = [c.color[0] for c in plant.data.color_attributes["wind"].data]
# Weights at or below the box top (z = 0.6): every such vertex must carry zero wind.
box_top = [c.color[0] for c, v in zip(plant.data.color_attributes["wind"].data, plant.data.vertices)
           if v.co.z <= 0.6 + 1e-4]
out["planter"] = {{"attrs": [a.name for a in plant.data.color_attributes], "min": round(min(weights), 4),
                  "max": round(max(weights), 4), "box_max": round(max(box_top), 4),
                  "materials": sorted(m.name for m in plant.data.materials)}}

print("ARCHKIT " + json.dumps(out))
"""


ROOFTOP_EXPR = """
import json, sys
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import contract
import facts as module_facts
from archkit import materials, rooftop, scene, vines

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(v, 4) for v in values]

def bounds(ob):
    # [min, max] along x, y and z of the vertices (the builders put every object at the origin).
    return [r((min(v.co[i] for v in ob.data.vertices), max(v.co[i] for v in ob.data.vertices))) for i in range(3)]

def names(ob):
    return sorted(m.name for m in ob.data.materials)

def islands(ob):
    # Loose parts of the mesh (every box, bubble, leaf and trunk segment is one) as (material, min corner, max corner).
    mesh = ob.data
    parent = list(range(len(mesh.vertices)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for edge in mesh.edges:
        parent[find(edge.vertices[0])] = find(edge.vertices[1])
    material, lows, highs = {{}}, {{}}, {{}}
    for poly in mesh.polygons:
        for i in poly.vertices:
            material[find(i)] = mesh.materials[poly.material_index].name
    for v in mesh.vertices:
        root = find(v.index)
        lo, hi = lows.setdefault(root, list(v.co)), highs.setdefault(root, list(v.co))
        for k in range(3):
            lo[k], hi[k] = min(lo[k], v.co[k]), max(hi[k], v.co[k])
    return [(material[root], lows[root], highs[root]) for root in lows]

def centre(lo, hi):
    return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]

def drop(ob, x, y):
    # Height where a ray dropped from far above (x, y) first meets the mesh, or None when it misses.
    mesh = ob.data
    tree = BVHTree.FromPolygons([v.co[:] for v in mesh.vertices], [p.vertices[:] for p in mesh.polygons])
    location = tree.ray_cast(Vector((x, y, 100.0)), Vector((0.0, 0.0, -1.0)))[0]
    return None if location is None else round(location.z, 4)

def faces(ob, name):
    # Triangles of the polygons that use the named material.
    mesh = ob.data
    return sum(len(p.vertices) - 2 for p in mesh.polygons if mesh.materials[p.material_index].name == name)

def wind(ob):
    # (z, wind weight, material name) of every vertex.
    mesh = ob.data
    material = {{}}
    for poly in mesh.polygons:
        for i in poly.vertices:
            material[i] = mesh.materials[poly.material_index].name
    data = mesh.color_attributes["wind"].data
    return [(v.co.z, data[v.index].color[0], material[v.index]) for v in mesh.vertices]

def curves(ob):
    # (data path, array index, [(frame, value), ...]) of every f-curve in the object's action slot.
    bag = ob.animation_data.action.layers[0].strips[0].channelbag(ob.animation_data.action_slot)
    return [[fc.data_path, fc.array_index, [(round(k.co[0], 4), round(k.co[1], 4)) for k in fc.keyframe_points]]
            for fc in bag.fcurves]

def pose(obs, frame):
    bpy.context.scene.frame_set(frame)
    return [round(ob.location.z, 4) for ob in obs]

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def slats(frame, top):
    # Slats of the two lattice layers: (upper ones along y, lower ones along x) as (centre, length) lists.
    parts = islands(frame)
    upper = [(centre(lo, hi)[0], hi[1] - lo[1]) for m, lo, hi in parts if abs(hi[2] - top) < 1e-3]
    lower = [(centre(lo, hi)[1], hi[0] - lo[0]) for m, lo, hi in parts if top - 0.07 < hi[2] < top - 0.01]
    return sorted(upper), sorted(lower)

scene.reset()
col = scene.module_collection("roof", (12.0, 12.0), "hero")
mats = materials.palette()
out = {{}}

# --- jacuzzi: the spec's corner (x -9..-5.4, y -5..-1.4) on a roof at z = 7.55
CX, CY, Z0 = -7.2, -3.2, 7.55
spa = rooftop.jacuzzi(col, "jacuzzi", (CX, CY, Z0), mats)
deck, water, led, groups = spa["deck"], spa["water"], spa["led"], spa["bubbles"]
out["jacuzzi"] = {{
    "keys": sorted(spa), "names": [deck.name, water.name, led.name], "groups": [g.name for g in groups],
    "deck": {{"bounds": bounds(deck), "materials": names(deck), "tris": tris(deck)}},
    "basin": {{"floor": drop(deck, CX, CY), "inside_wall": drop(deck, CX + 1.19, CY), "wall": drop(deck, CX + 1.22, CY),
             "rim": drop(deck, CX + 1.5, CY), "step": drop(deck, CX, CY - 1.9), "back": drop(deck, CX, CY + 1.9),
             "side": drop(deck, CX - 1.9, CY)}},
    "water": {{"bounds": bounds(water), "materials": names(water)}},
    "led": {{"bounds": bounds(led), "materials": names(led), "night": led.get("night_light") in (True, 1)}},
}}
spots = [[centre(lo, hi), max(hi[k] - lo[k] for k in range(3))] for g in groups for m, lo, hi in islands(g)]
out["bubbles"] = {{
    "counts": [len(islands(g)) for g in groups],
    "materials": sorted({{m.name for g in groups for m in g.data.materials}}),
    "centres": [r(c) for c, size in spots], "size": max(size for c, size in spots),
    "tris": sum(tris(g) for g in groups),
}}

# One clip with a slot per group; a second, smaller jacuzzi checks the parameters and the clip name.
small = rooftop.jacuzzi(col, "spa", (3.0, -8.0, Z0), mats, inner=2.0, deck=3.0, height=0.6, bubbles=8, seed=3,
                        frames=40)
out["anim"] = {{
    "actions": sorted(a.name for a in bpy.data.actions),
    "slots": len(bpy.data.actions["ambient_jacuzzi"].slots),
    "assigned": [g.animation_data.action.name for g in groups],
    "curves": [curves(g) for g in groups],
    "start": pose(groups, 0), "quarter": pose(groups, 15), "end": pose(groups, 60),
    "spa": {{"assigned": [g.animation_data.action.name for g in small["bubbles"]],
            "curves": [curves(g) for g in small["bubbles"]],
            "bounds": bounds(small["deck"]), "floor": drop(small["deck"], 3.0, -8.0),
            "water": bounds(small["water"]), "count": sum(len(islands(g)) for g in small["bubbles"])}},
}}
pose(groups, 1)

# --- grape trellis: the spec's 7 x 5 m frame, 2.6 m above the roof
MN, MX, TZ, TH = (-3.0, 1.0), (4.0, 6.0), 7.55, 2.6
ttop = TZ + TH
frame, canopy = vines.grape_trellis(col, "trellis", MN, MX, TZ, TH, mats)
facts = module_facts.collect("roof")
out["contract"] = {{"errors": contract.validate(facts), "clips": facts["actions"], "tris": facts["tris"]}}

parts = islands(frame)
upper, lower = slats(frame, ttop)
gaps = lambda found: [round(b[0] - a[0], 4) for a, b in zip(found, found[1:])]
out["frame"] = {{
    "name": frame.name, "materials": names(frame), "bounds": bounds(frame),
    "posts": sorted({{(round(centre(lo, hi)[0], 2), round(centre(lo, hi)[1], 2)) for m, lo, hi in parts
                    if lo[2] < TZ + 0.01}}),
    "beams": sum(1 for m, lo, hi in parts if max(hi[0] - lo[0], hi[1] - lo[1]) > 4.5 and hi[2] - lo[2] > 0.1),
    "upper": {{"count": len(upper), "max_gap": max(gaps(upper)), "lengths": sorted({{round(s[1], 1) for s in upper}})}},
    "lower": {{"count": len(lower), "max_gap": max(gaps(lower)), "lengths": sorted({{round(s[1], 1) for s in lower}})}},
}}
wide_frame, _ = vines.grape_trellis(col, "trellis_wide", MN, MX, TZ, TH, mats, spacing=0.8)
wide_upper, wide_lower = slats(wide_frame, ttop)
out["frame"]["wide"] = [len(wide_upper), len(wide_lower)]

rows = wind(canopy)
weights = lambda name: [w for z, w, m in rows if m == name]
vparts = islands(canopy)
grape = [(lo, hi) for m, lo, hi in vparts if m == "M_grape"]
leaf = [(lo, hi) for m, lo, hi in vparts if m == "M_leaf"]
trunks = [centre(lo, hi) for m, lo, hi in vparts if m == "M_soil" and lo[2] < TZ + 0.05]
posts = out["frame"]["posts"]
out["vines"] = {{
    "name": canopy.name, "materials": names(canopy), "attrs": [a.name for a in canopy.data.color_attributes],
    "tris": tris(canopy),
    "wind": {{"min": round(min(w for z, w, m in rows), 4), "max": round(max(w for z, w, m in rows), 4),
             "ground_max": round(max(w for z, w, m in rows if z < TZ + 0.02), 4),
             "grape_min": round(min(weights("M_grape")), 4), "leaf_min": round(min(weights("M_leaf")), 4)}},
    "trunks": {{"count": len(trunks), "reach": round(max(hi[2] for m, lo, hi in vparts if m == "M_soil"), 4),
               "gaps": [round(min(((t[0] - x) ** 2 + (t[1] - y) ** 2) ** 0.5 for t in trunks), 4) for x, y in posts]}},
    "grape": {{"min": r([min(lo[k] for lo, hi in grape) for k in range(3)]),
              "max": r([max(hi[k] for lo, hi in grape) for k in range(3)])}},
    "leaf": {{"min": r([min(lo[k] for lo, hi in leaf) for k in range(3)]),
             "max": r([max(hi[k] for lo, hi in leaf) for k in range(3)])}},
}}

# Parameters: density and bunch count scale the triangles; the seed fixes the jitter.
_, half = vines.grape_trellis(col, "trellis_half", MN, MX, TZ, TH, mats, leaf_density=0.5)
_, eight = vines.grape_trellis(col, "trellis_eight", MN, MX, TZ, TH, mats, bunches=8)
twin_frame, twin = vines.grape_trellis(col, "trellis_twin", MN, MX, TZ, TH, mats)
other_frame, other = vines.grape_trellis(col, "trellis_other", MN, MX, TZ, TH, mats, seed=14)
out["scaling"] = {{
    "tris": [tris(half), tris(canopy)], "leaf": [faces(half, "M_leaf"), faces(canopy, "M_leaf")],
    "grape": [faces(eight, "M_grape"), faces(canopy, "M_grape")],
    "same_seed": digest(twin) == digest(canopy), "other_seed": digest(other) != digest(canopy),
    "same_frame": digest(twin_frame) == digest(frame),
}}

print("ARCHKIT " + json.dumps(out))
"""


RESORT_MATERIALS_EXPR = """
import hashlib, json, os, struct, sys, tempfile
sys.path.insert(0, {scripts!r})
import bpy
import numpy as np
from archkit import materials, scene, textures
from archkit.mesh import MeshBuilder

def r(values):
    return [round(float(v), 4) for v in values]

def pixels(img):
    px = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(img.size[1], img.size[0], 4)

def digest(img):
    return hashlib.sha1(pixels(img).tobytes()).hexdigest()

def material_row(mat):
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    image = next((n.image.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"), None)
    return [mat.name, r(bsdf.inputs["Base Color"].default_value[:3]), round(bsdf.inputs["Roughness"].default_value, 4),
            round(bsdf.inputs["Metallic"].default_value, 4), round(bsdf.inputs["Alpha"].default_value, 4),
            round(bsdf.inputs["Emission Strength"].default_value, 4), image]

scene.reset()
mats = materials.palette()
out = {{"palette": {{key: material_row(mats[key]) if key in mats else None
                    for key in ("stone", "fabric", "teak", "rattan", "linen", "terracotta", "leaf_dark")}}}}

# The tint must survive the glTF export: Blender drops the base colour of a material whose texture feeds it directly.
col = scene.module_collection("kit", (4.0, 4.0), "prop")
MeshBuilder("Slab").box((0, 0, 0), (1, 1, 1), mats["stone"]).build(col)
path = os.path.join(tempfile.mkdtemp(), "stone.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")
with open(path, "rb") as f:
    blob = f.read()
(length,) = struct.unpack("<I", blob[12:16])
pbr = next(m for m in json.loads(blob[20:20 + length])["materials"] if m["name"] == "M_stone")["pbrMetallicRoughness"]
out["stone_gltf"] = {{"factor": r(pbr.get("baseColorFactor", [])[:3]), "textured": "baseColorTexture" in pbr}}

first, second = bpy.data.images["T_stone"], textures.stone_tiles("T_b")  # the palette made T_stone with the defaults
other, small = textures.stone_tiles("T_c", seed=12), textures.stone_tiles("T_d", size=256)
px = pixels(first)
lum = px[..., :3].mean(axis=2)
cell, joint = first.size[0] // 4, 4
inner = lum[cell + joint:2 * cell, cell + joint:2 * cell]  # one slab without its joints
median = float(np.median(inner))
out["stone"] = {{
    "name": first.name, "size": list(first.size), "small_size": list(small.size), "packed": first.packed_file is not None,
    "mean": r(px[..., :3].reshape(-1, 3).mean(axis=0)),
    "same_seed_same_pixels": digest(first) == digest(second), "other_seed_differs": digest(first) != digest(other),
    "opaque": bool((px[..., 3] == 1.0).all()), "in_range": bool(px.min() >= 0.0 and px.max() <= 1.0),
    # soft horizontal banding: the rows of a slab differ from each other far more than its columns do
    "row_spread": float(inner.mean(axis=1).std()), "column_spread": float(inner.mean(axis=0).std()),
    # small dark pits: a few per cent of the slab at most, clearly darker than the stone around them
    "pits": float((inner < median - 0.12).mean()),
    # the large-format slab joints stay, darker than the slab: x = 2 * cell is the first column of a joint
    "joint_drop": median - float(lum[cell + 50:cell + 150, 2 * cell:2 * cell + joint].mean()),
    "joint_row_drop": median - float(lum[2 * cell:2 * cell + joint, cell + 50:cell + 150].mean()),
}}
print("ARCHKIT " + json.dumps(out))
"""


TROPICAL_EXPR = """
import json, sys
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
import contract
import facts as module_facts
from archkit import furniture, materials, scene
from archkit.catalog import FURNITURE, NIGHT_KINDS, WALL_MOUNTED
from archkit.mesh import MeshBuilder

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
    # The same per material: of the vertices of its faces.
    found = {{}}
    for index, mat in enumerate(ob.data.materials):
        used = {{v for poly in ob.data.polygons if poly.material_index == index for v in poly.vertices}}
        found[mat.name] = [round(f(ob.data.vertices[v].co[axis] for v in used), 3)
                           for axis in range(3) for f in (min, max)]
    return found

scene.reset()
col = scene.module_collection("kit", (10.0, 10.0), "hero")
mats = materials.palette()
out = {{"catalog": {{k: list(FURNITURE[k]) for k in KINDS if k in FURNITURE}},
       "night": sorted(k for k in KINDS if k in NIGHT_KINDS),
       "mounted": {{k: WALL_MOUNTED[k] for k in KINDS if k in WALL_MOUNTED}}}}
pieces = {{}}
for kind in KINDS:
    if kind not in FURNITURE:
        continue
    ob = furniture.place(col, "T_" + kind, kind, (0.0, 0.0, 1.0), 0, mats)
    again = furniture.place(col, "T2_" + kind, kind, (0.0, 0.0, 1.0), 0, mats)
    pieces[kind] = {{"tris": tris(ob), "extent": extent(ob), "z": round(ob.location.z, 4),
                    "night": ob.get("night_light") is True, "materials": sorted(m.name for m in ob.data.materials),
                    "spans": spans(ob), "same_twice": digest(ob) == digest(again),
                    "attrs": [a.name for a in ob.data.color_attributes]}}
out["pieces"] = pieces

# wind=True paints 'wind' from the pot (or the hanging basket) up to the leaf tips (hanging ferns: down to the tips).
winds = {{}}
for kind in WIND_KINDS:
    if kind not in FURNITURE:
        continue
    off = furniture.place(col, "W0_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, wind=False)
    on = furniture.place(col, "W1_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, wind=True)
    data = on.data.color_attributes["wind"].data
    weight = [data[v.index].color[0] for v in on.data.vertices]
    pot_name = "M_rattan" if kind == "fern_hanging" else "M_terracotta"
    pot = {{v for poly in on.data.polygons if on.data.materials[poly.material_index].name == pot_name
           for v in poly.vertices}}
    winds[kind] = {{
        "attrs": [a.name for a in on.data.color_attributes], "off_attrs": [a.name for a in off.data.color_attributes],
        "min": round(min(weight), 4), "max": round(max(weight), 4), "pot_max": round(max(weight[v] for v in pot), 4),
        "high": round(weight[max(on.data.vertices, key=lambda v: v.co.z).index], 4),
        "low": round(weight[min(on.data.vertices, key=lambda v: v.co.z).index], 4),
    }}
out["winds"] = winds
rejected = {{}}
for kind in ("sofa_l", "plant_tall", "rattan_pendant"):
    if kind not in FURNITURE:
        continue
    try:
        furniture.place(col, "R_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, wind=True)
        rejected[kind] = None
    except TypeError:
        rejected[kind] = "TypeError"
out["rejected"] = rejected

# cord=: the hanging pieces reach up to a ceiling higher than their own top; the shade or the basket stays put.
hung = {{}}
for kind in ("rattan_pendant", "fern_hanging"):
    if kind not in FURNITURE:
        continue
    try:
        ob = furniture.place(col, "C_" + kind, kind, (0.0, 0.0, 0.0), 0, mats, cord=0.5)
    except TypeError:
        hung[kind] = None
        continue
    hung[kind] = {{"extent": extent(ob), "tris": tris(ob), "night": ob.get("night_light") is True}}
out["hung"] = hung

# The new MeshBuilder primitives: a flat leaf blade (a stretched octahedron) and an ellipsoid.
prims = {{}}
if hasattr(MeshBuilder, "leaf") and hasattr(MeshBuilder, "ellipsoid"):
    def solid(ob):
        mesh = ob.data
        edges = {{}}
        for poly in mesh.polygons:
            for key in poly.edge_keys:
                edges[key] = edges.get(key, 0) + 1
        middle = sum((v.co for v in mesh.vertices), Vector()) / len(mesh.vertices)
        return {{"tris": tris(ob), "verts": len(mesh.vertices), "dims": r(ob.dimensions),
                "closed": all(n == 2 for n in edges.values()),
                "outward": all(poly.normal.dot(poly.center - middle) > 0 for poly in mesh.polygons)}}
    leaf = mats["leaf"]
    upright = MeshBuilder("L_up").leaf((0, 0, 0), (0, 0, 1), 0.4, leaf, thickness=0.02, belly=0.5).build(col)
    flat = MeshBuilder("L_flat").leaf((0, 0, 0), (0, 1, 0), 0.4, leaf, thickness=0.02, belly=0.3).build(col)
    turned = MeshBuilder("L_turned").leaf((0, 0, 0), (0, 1, 0), 0.4, leaf, thickness=0.02, side=(0, 0, 1)).build(col)
    egg = MeshBuilder("E").ellipsoid((0, 0, 1), (0.2, 0.3, 0.5), leaf, subdivisions=2).build(col)
    prims = {{"upright": solid(upright), "flat": solid(flat), "turned": solid(turned), "egg": solid(egg),
             "egg_z": extent(egg)[4:], "belly_y": round(max(flat.data.vertices, key=lambda v: v.co.x).co.y, 4)}}
    if hasattr(MeshBuilder, "octahedron"):
        gem = MeshBuilder("G").octahedron((0, 0, 1), 0.5, leaf).build(col)
        prims["octahedron"] = dict(solid(gem), middle=r(sum((v.co for v in gem.data.vertices), Vector()) / 6))
    try:
        MeshBuilder("L_zero").leaf((0, 0, 0), (0, 0, 0), 0.4, leaf)
        prims["zero_length"] = None
    except ValueError:
        prims["zero_length"] = "ValueError"
out["primitives"] = prims

out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""


RESORT_WATER_EXPR = """
import json, sys
sys.path.insert(0, {scripts!r})
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import contract
import facts as module_facts
from archkit import lighting, materials, scene
try:
    from archkit import water
except ImportError:
    water = None

def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)

def r(values):
    return [round(float(v), 4) for v in values]

def bounds(ob):
    # [min, max] along x, y and z of the vertices (the builders put every object at the origin).
    return [r((min(v.co[i] for v in ob.data.vertices), max(v.co[i] for v in ob.data.vertices))) for i in range(3)]

def names(ob):
    return sorted(m.name for m in ob.data.materials)

def digest(ob):
    return round(sum(v.co.x + 3 * v.co.y + 7 * v.co.z for v in ob.data.vertices), 4)

def islands(ob):
    # Loose parts of the mesh (every bulb, wire piece and stepping stone is one) as (material, min corner, max corner).
    mesh = ob.data
    parent = list(range(len(mesh.vertices)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for edge in mesh.edges:
        parent[find(edge.vertices[0])] = find(edge.vertices[1])
    material, lows, highs = {{}}, {{}}, {{}}
    for poly in mesh.polygons:
        for i in poly.vertices:
            material[find(i)] = mesh.materials[poly.material_index].name
    for v in mesh.vertices:
        root = find(v.index)
        lo, hi = lows.setdefault(root, list(v.co)), highs.setdefault(root, list(v.co))
        for k in range(3):
            lo[k], hi[k] = min(lo[k], v.co[k]), max(hi[k], v.co[k])
    return [(material[root], lows[root], highs[root]) for root in lows]

def drop(ob, x, y):
    # Height where a ray dropped from far above (x, y) first meets the mesh, or None when it misses.
    mesh = ob.data
    tree = BVHTree.FromPolygons([v.co[:] for v in mesh.vertices], [p.vertices[:] for p in mesh.polygons])
    location = tree.ray_cast(Vector((x, y, 100.0)), Vector((0.0, 0.0, -1.0)))[0]
    return None if location is None else round(location.z, 4)

def error(call):
    try:
        call()
    except ValueError as exc:
        return str(exc)
    return None

scene.reset()
col = scene.module_collection("kit", (30.0, 30.0), "hero")
mats = materials.palette()
out = {{}}

# --- string lights
if hasattr(lighting, "string_lights"):
    def info(ob):
        parts = islands(ob)
        led = [(lo, hi) for m, lo, hi in parts if m == "M_led"]
        wire = [(lo, hi) for m, lo, hi in parts if m == "M_frame"]
        middle = [[(lo[k] + hi[k]) / 2 for k in range(3)] for lo, hi in led]
        return {{
            "name": ob.name, "bulbs": len(led), "night": ob.get("night_light") is True, "materials": names(ob),
            "tris": tris(ob), "bulb_size": round(max(hi[k] - lo[k] for lo, hi in led for k in range(3)), 4),
            "bulb_tris": sum(1 for t in ob.data.loop_triangles if ob.data.materials[t.material_index].name == "M_led")
                         // len(led),
            "wire_pieces": len(wire),
            "bulb_x": r((min(c[0] for c in middle), max(c[0] for c in middle))),
            "bulb_z": r((min(c[2] for c in middle), max(c[2] for c in middle))),
            "wire_x": r((min(lo[0] for lo, hi in wire), max(hi[0] for lo, hi in wire))),
            "wire_top": round(max(hi[2] for lo, hi in wire), 4),
        }}
    span = [(0.0, 0.0, 2.5), (4.0, 0.0, 2.5)]
    plain = lighting.string_lights(col, "LT_string", span, mats)
    long = lighting.string_lights(col, "LT_long", [(0.0, 3.0, 2.5), (8.0, 3.0, 2.5)], mats)
    bent = lighting.string_lights(col, "LT_bent", [(0.0, 6.0, 2.5), (4.0, 6.0, 2.5), (4.0, 9.0, 2.5)], mats)
    sparse = lighting.string_lights(col, "LT_sparse", [(0.0, 10.0, 2.5), (4.0, 10.0, 2.5)], mats, bulbs_per_m=2.0)
    taut = lighting.string_lights(col, "LT_taut", [(0.0, 12.0, 2.5), (4.0, 12.0, 2.5)], mats, sag=0.0)
    loose = lighting.string_lights(col, "LT_loose", [(0.0, 14.0, 2.5), (4.0, 14.0, 2.5)], mats, sag=0.3)
    twin = lighting.string_lights(col, "LT_twin", span, mats)
    try:
        globe = info(lighting.string_lights(col, "LT_globe", [(0.0, 16.0, 2.5), (4.0, 16.0, 2.5)], mats,
                                            bulb_radius=0.06))
    except TypeError:
        globe = None
    out["lights"] = {{
        "plain": info(plain), "long": info(long)["bulbs"], "bent": info(bent)["bulbs"], "sparse": info(sparse)["bulbs"],
        "taut": info(taut)["bulb_z"], "taut_pieces": info(taut)["wire_pieces"], "loose": info(loose)["bulb_z"], "same_pixels": digest(plain) == digest(twin),
        "objects": sorted(ob.name for ob in col.objects if ob.name.startswith("LT_bent")),
        "one_anchor": error(lambda: lighting.string_lights(col, "LT_bad", [(0.0, 0.0, 2.5)], mats)),
        "left_over": sorted(ob.name for ob in col.objects if ob.name.startswith("LT_bad")),
        "globe": globe and {{"size": globe["bulb_size"], "bulbs": globe["bulbs"], "tris": globe["tris"],
                             "plain_tris": info(plain)["tris"]}},
    }}

# --- water features
if water is not None:
    pool = water.reflecting_pool(col, "pool", (-3.0, -1.5), (3.0, 1.5), 0.0, mats)
    stones = [(-1.5, 7.5), (0.0, 7.5), (1.5, 7.5)]
    deep = water.reflecting_pool(col, "deep", (-3.0, 6.0), (3.0, 9.0), 0.2, mats, depth=0.3, steps=stones)
    out["pool"] = {{
        "keys": sorted(pool), "names": [pool["pool"].name, pool["water"].name],
        "bounds": bounds(pool["pool"]), "materials": names(pool["pool"]),
        "water": {{"bounds": bounds(pool["water"]), "materials": names(pool["water"])}},
        "floor": drop(pool["pool"], 0.0, 0.0), "rim": drop(pool["pool"], -2.95, 0.0), "rim_front": drop(pool["pool"], 0.0, -1.45),
        "tris": tris(pool["pool"]),
    }}
    lumps = [(lo, hi) for m, lo, hi in islands(deep["steps"])]
    out["deep"] = {{
        "keys": sorted(deep), "names": [deep["pool"].name, deep["water"].name, deep["steps"].name],
        "bounds": bounds(deep["pool"]), "water": bounds(deep["water"]), "steps": bounds(deep["steps"]),
        "step_materials": names(deep["steps"]),
        "centres": sorted(r(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2)) for lo, hi in lumps),
        "sizes": sorted({{round(hi[0] - lo[0], 3) for lo, hi in lumps}} | {{round(hi[1] - lo[1], 3) for lo, hi in lumps}}),
    }}
    out["pool_errors"] = {{
        "step_outside": error(lambda: water.reflecting_pool(col, "pool_bad", (0.0, 20.0), (4.0, 22.0), 0.0, mats,
                                                            steps=[(9.0, 21.0)])),
        "too_small": error(lambda: water.reflecting_pool(col, "pool_tiny", (0.0, 24.0), (0.2, 24.2), 0.0, mats)),
        "left_over": sorted(ob.name for ob in col.objects if "pool_bad" in ob.name or "pool_tiny" in ob.name),
    }}

    fountain = water.wall_fountain(col, "fountain", (0.0, 12.0), (3.0, 12.0), 0.0, 2.0, mats)
    sideways = water.wall_fountain(col, "fountain_y", (8.0, 10.0), (8.0, 13.0), 0.0, 2.0, mats)
    behind = water.wall_fountain(col, "fountain_b", (0.0, 16.0), (3.0, 16.0), 0.0, 2.0, mats, facing=1)

    def fountain_info(parts):
        return {{key: {{"name": ob.name, "bounds": bounds(ob), "materials": names(ob),
                       "night": ob.get("night_light") is True}} for key, ob in parts.items()}}
    out["fountain"] = fountain_info(fountain)
    out["sideways"] = fountain_info(sideways)
    out["behind"] = fountain_info(behind)
    out["fountain_errors"] = {{
        "diagonal": error(lambda: water.wall_fountain(col, "fountain_bad", (0.0, 0.0), (2.0, 2.0), 0.0, 2.0, mats)),
        "left_over": sorted(ob.name for ob in col.objects if ob.name.startswith("fountain_bad")),
    }}

out["contract"] = contract.validate(module_facts.collect("kit"))
print("ARCHKIT " + json.dumps(out))
"""


def failure_text(stderr):
    """Blender prints the Python traceback and then echoes the whole expression (`Error: script failed, expr: ...`),
    which can fill the tail of stderr on its own: report the traceback itself, else the tail."""
    start = stderr.rfind("Traceback")
    if start < 0:
        return stderr[-2000:]
    return stderr[start:].split("\nError: script failed, expr:", 1)[0].strip()[-2000:]


def summary(expr, **values):
    result = run_blender_expr(expr.format(scripts=SCRIPTS_DIR, **values))
    lines = [line for line in result.stdout.splitlines() if line.startswith("ARCHKIT ")]
    if result.returncode != 0 or not lines:
        raise AssertionError(failure_text(result.stderr))
    return json.loads(lines[-1][len("ARCHKIT "):])


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitTest(unittest.TestCase):
    """Glass villa spec §8 / §11: every builder produces the named objects and materials the contract expects."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(KIT_EXPR)

    def test_box_has_twelve_triangles_box_uvs_and_its_material(self):
        self.assertEqual(self.out["box"], {"tris": 12, "dims": [1.0, 2.0, 3.0], "materials": ["M_white"], "uv": "UVMap"})

    def test_box_turns_about_its_own_centre_and_cylinders_can_lie_along_y(self):
        # A 2 x 1 x 1 box centred on (1, 0.5) turned a quarter circle stands 1 wide and 2 deep on the same centre.
        self.assertEqual(self.out["turned"], {"extent": [[0.5, 1.5], [-0.5, 1.5], [0.0, 1.0]], "tris": 12})
        # Base centre at the origin, 2 m along +Y: the round door of a washing machine.
        self.assertEqual(self.out["sideways"], {"extent": [[-0.5, 0.5], [0.0, 2.0], [-0.5, 0.5]], "tris": 28})

    def test_curtain_wall_makes_one_glass_object_per_pane_and_a_frame(self):
        self.assertEqual(self.out["curtain"], {
            "frame": "front_frame", "panes": ["GLASS_front_01", "GLASS_front_02", "GLASS_front_03"],
            "pane_width": 1.94, "pane_materials": ["GLASS_clear"],
        })

    def test_railing_panes_stop_under_the_handrail(self):
        self.assertEqual(self.out["railing"], {"rail": "edge_rail", "panes": ["GLASS_edge_01", "GLASS_edge_02"],
                                               "pane_height": 1.05})

    def test_glass_material_satisfies_the_contract(self):
        self.assertEqual(self.out["glass"], {"alpha": 0.2, "roughness": 0.05})

    def test_stair_and_pergola(self):
        self.assertEqual(self.out["stair"], {"tris": 120, "top": 2.0})
        self.assertEqual(self.out["pergola"], ["M_frame", "M_wood"])

    def test_textures_are_art_stone_and_wood_within_the_prop_budget(self):
        self.assertEqual(self.out["textures"],
                         [["T_art", [1024, 512]], ["T_stone", [1024, 1024]], ["T_wood", [512, 512]]])

    def test_sliding_door_opens_along_x_with_act_door_open(self):
        self.assertEqual(self.out["door"], {"action": "act_door_open", "closed_x": 0.6, "open_x": 1.8,
                                            "materials": ["GLASS_clear", "M_frame"]})


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitKitV2Test(unittest.TestCase):
    """Villa v2 spec §3, §6, §8: partitions, frosted panels, the art atlas and the new palette entries."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(KIT_V2_EXPR)

    def test_partition_without_doors_is_one_white_box(self):
        self.assertEqual(self.out["solid"], {"name": "wall_solid", "tris": 12, "dims": [4.0, 0.12, 3.0],
                                             "materials": ["M_white"], "along_y": [0.12, 4.0, 2.5]})

    def test_partition_door_opening_is_clear_with_header_and_proud_frame(self):
        door = self.out["door"]
        self.assertEqual(door["name"], "wall_door")
        self.assertEqual(door["materials"], ["M_frame", "M_white"])
        self.assertEqual(door["inside"], 0)  # no vertex strictly inside the opening below the door height
        self.assertEqual(door["clear"], [None] * 9)  # rays pass through the whole 0.9 x 2.2 opening
        self.assertEqual((door["wall"], door["header"]), (-0.06, -0.06))  # solid wall and header: 0.12 thick
        self.assertEqual((door["jamb"], door["head"]), (-0.07, -0.07))  # frame stands 1 cm proud of the wall face
        self.assertEqual(door["tris"], 72)  # left wall, right wall, header, two jambs and a head: six boxes

    def test_partition_wall_and_trim_share_no_face(self):
        # Wall segments stop at the jambs and the header starts above the head, so nothing lies in a common plane.
        self.assertEqual(self.out["z_fight"], {"door": [], "backwards": [], "along_y": [], "tight": [], "touching": [],
                                               "near": []})

    def test_partition_frames_of_neighbouring_openings_never_enter_each_others_opening(self):
        # Each frame takes at most half of the wall between two openings; with touching openings it takes none.
        self.assertEqual(self.out["neighbours_clear"], {"touching": [None] * 18, "near": [None] * 18})

    def test_partition_doors_at_the_wall_ends_and_up_to_the_ceiling_leave_no_degenerate_faces(self):
        tight = self.out["tight"]
        self.assertEqual(tight["degenerate"], 0)  # the header above a head that reaches the ceiling has no height
        # jambs are trimmed to the wall, so both openings stay clear up to the head at 2.95 m
        self.assertEqual(tight["clear"], [None] * 18)

    def test_partition_door_offsets_are_measured_from_start(self):
        back = self.out["backwards"]  # drawn (4, 0) -> (0, 0): the opening is at x 2.1..3.0, not 1.0..1.9
        self.assertEqual(back["clear"], [None] * 9)
        self.assertEqual(back["walled"], [-0.06] * 3)
        self.assertEqual(back["inside"], 0)

    def test_partition_along_y_has_its_opening_in_the_right_place(self):
        up = self.out["along_y_door"]
        self.assertEqual(up["clear"], [None] * 9)
        self.assertEqual(up["walled"], [-0.06] * 3)

    def test_partition_rejects_bad_openings_naming_the_wall(self):
        for case, message in self.out["errors"].items():
            self.assertIsNotNone(message, case)
            self.assertIn("wall_bad", message, case)
        self.assertEqual(self.out["bad_walls_left_objects"], [])
        self.assertTrue(self.out["touching_openings_ok"])

    def test_frosted_panel_is_named_after_its_material_family_and_satisfies_the_contract(self):
        frosted = self.out["frosted"]
        self.assertEqual((frosted["name"], frosted["tris"], frosted["dims"]), ("FROSTED_bath", 12, [2.0, 0.02, 1.5]))
        self.assertEqual(frosted["thick_dims"], [0.05, 2.0, 2.0])
        self.assertEqual((frosted["materials"], frosted["alpha"], frosted["roughness"]), (["FROSTED_bath"], 0.6, 0.5))
        self.assertEqual(frosted["facts"], [{"name": "FROSTED_bath", "alpha": 0.6, "roughness": 0.5}])
        self.assertEqual(frosted["contract"], [])

    def test_frosted_panel_glows_warm_at_night(self):
        # The ceiling downlights of a bathroom cannot be seen through its window, so the pane itself is the glow: a soft
        # warm emission that the runtime scales by the night factor.
        frosted = self.out["frosted"]
        self.assertTrue(frosted["night_light"])
        self.assertEqual(frosted["emission"], [[1.0, 0.72, 0.42], 0.45])

    def test_art_atlas_is_1024_by_512_packed_and_seeded(self):
        atlas = self.out["atlas"]
        self.assertEqual((atlas["name"], atlas["size"], atlas["packed"]), ("T_a", [1024, 512], True))
        self.assertEqual(atlas["small_size"], [256, 128])
        self.assertTrue(atlas["same_seed_same_pixels"])
        self.assertTrue(atlas["other_seed_differs"])

    def test_art_atlas_holds_eight_distinct_opaque_paintings(self):
        atlas = self.out["atlas"]
        self.assertEqual(atlas["cell_sizes"], [[256, 256]])
        self.assertEqual(atlas["distinct_cells"], 8)
        self.assertGreaterEqual(atlas["min_colours_per_cell"], 3)  # background plus at least two shapes
        self.assertTrue(atlas["all_opaque"])

    def test_art_cell_uv_runs_left_to_right_then_top_to_bottom_with_v_up(self):
        self.assertEqual(self.out["cell_uv"], [[0.0, 0.5, 0.25, 1.0], [0.75, 0.5, 1.0, 1.0], [0.0, 0.0, 0.25, 0.5],
                                               [0.25, 0.0, 0.5, 0.5], [0.75, 0.0, 1.0, 0.5]])
        self.assertEqual(self.out["cell_uv_custom"], [0.5, 0.5, 1.0, 1.0])
        self.assertIn("8", self.out["cell_uv_range"])

    def test_textures_of_unused_materials_are_not_saved(self):
        self.assertEqual(self.out["saved_images"], [])

    def test_palette_has_the_kit_v2_materials(self):
        # [name, base colour, roughness, metallic, alpha, emission strength, emission colour, image]
        self.assertEqual(self.out["palette"], {
            "frosted": ["FROSTED_bath", [0.9, 0.93, 0.95], 0.5, 0.0, 0.6, 0.45, [1.0, 0.72, 0.42], None],
            "grape": ["M_grape", [0.28, 0.08, 0.32], 0.4, 0.0, 1.0, 0.0, None, None],
            "tile_bath": ["M_tile_bath", [0.85, 0.87, 0.88], 0.2, 0.0, 1.0, 0.0, None, None],
            "ceramic": ["M_ceramic", [0.97, 0.97, 0.96], 0.15, 0.0, 1.0, 0.0, None, None],
            "metal": ["M_metal", [0.6, 0.6, 0.62], 0.35, 0.9, 1.0, 0.0, None, None],
            "cushion": ["M_cushion", [0.55, 0.6, 0.5], 0.9, 0.0, 1.0, 0.0, None, None],
            "screen_on": ["M_screen_on", [0.02, 0.02, 0.03], 0.15, 0.0, 1.0, 3.0, [0.55, 0.75, 1.0], None],
            "rgb": ["M_rgb", [0.1, 0.02, 0.12], 0.5, 0.0, 1.0, 5.0, [0.9, 0.2, 1.0], None],
            "art": ["M_art", [1.0, 1.0, 1.0], 0.6, 0.0, 1.0, 0.0, None, "T_art"],
        })


# Villa v2 spec §5.1: (w, d, h) of the pieces added for the living, dining, kitchen, entry and decor rooms, and the
# palette materials each one is built from (a piece may use more, e.g. book colours).
LIVING_KINDS = {
    "tv_wall": ([3.2, 0.5, 2.0], {"M_wood", "M_screen_on", "M_frame"}),
    "bookshelf_wall": ([2.4, 0.4, 2.4], {"M_wood"}),
    "floor_lamp": ([0.45, 0.45, 1.7], {"M_metal", "M_led"}),
    "plant_tall": ([0.6, 0.6, 1.8], {"M_ceramic", "M_soil", "M_leaf"}),
    "plant_small": ([0.4, 0.4, 0.8], {"M_ceramic", "M_soil", "M_leaf"}),
    "painting_l": ([1.6, 0.05, 1.0], {"M_frame", "M_art"}),
    "painting_m": ([0.9, 0.05, 0.7], {"M_frame", "M_art"}),
    "curtain": ([2.4, 0.22, 3.0], {"M_drape", "M_sheer", "M_bronze"}),
    "dining_set_8": ([2.8, 2.1, 0.9], {"M_wood", "M_frame", "M_fabric"}),
    "sideboard": ([2.0, 0.5, 0.85], {"M_wood", "M_frame"}),
    "kitchen_run": ([5.6, 0.65, 2.4], {"M_white", "M_counter", "M_metal", "M_screen", "M_wood"}),
    "fridge_tower": ([1.8, 0.65, 2.3], {"M_metal", "M_white", "M_screen"}),
    "kitchen_island_4": ([2.8, 1.7, 0.95], {"M_counter", "M_wood", "M_fabric_dark"}),
    "bar_cabinet": ([2.0, 0.6, 2.2], {"M_frame", "M_grape", "M_leaf", "M_led"}),
    "shoe_cabinet": ([1.4, 0.4, 1.0], {"M_wood", "M_frame"}),
    "bench_mirror": ([1.2, 0.45, 2.0], {"M_cushion", "M_metal"}),
}
# Villa v2 spec §5.2 and §5.3: the same for the bedroom, closet, office, bath, laundry and outdoor pieces.
BEDROOM_KINDS = {
    "bed_king": ([2.0, 2.3, 1.15], {"M_cushion", "M_wood", "M_white", "M_fabric"}),
    "nightstand_lamp": ([0.5, 0.4, 0.95], {"M_wood", "M_led"}),
    "dresser_mirror": ([1.2, 0.9, 1.6], {"M_wood", "M_metal"}),
    "tv_cabinet": ([1.6, 0.45, 1.5], {"M_wood", "M_screen_on"}),
    "closet_rack": ([2.0, 0.6, 2.3], {"M_metal", "M_fabric", "M_wood"}),
    "gaming_desk": ([2.2, 1.6, 1.35], {"M_screen_on", "M_rgb", "M_frame"}),
    "gaming_chair": ([0.7, 0.7, 1.3], {"M_fabric_dark", "M_rgb"}),
    "wall_shelf": ([1.2, 0.25, 0.3], {"M_wood"}),
    "bookshelf": ([0.9, 0.35, 1.9], {"M_wood"}),
    "toilet": ([0.4, 0.7, 0.8], {"M_ceramic"}),
    "vanity_single": ([0.9, 0.5, 1.9], {"M_wood", "M_ceramic", "M_metal"}),
    "vanity_double": ([1.6, 0.55, 1.9], {"M_wood", "M_ceramic", "M_metal"}),
    "bathtub": ([1.7, 0.8, 0.6], {"M_ceramic", "M_metal"}),
    "shower": ([1.0, 1.0, 2.1], {"M_tile_bath", "GLASS_clear", "M_metal"}),
    "towel_rack": ([0.6, 0.12, 1.2], {"M_metal", "M_fabric"}),
    "washer_dryer": ([1.3, 0.65, 0.9], {"M_white", "M_screen"}),
    "laundry_shelf": ([1.3, 0.3, 0.4], {"M_wood", "M_fabric"}),
    "towel_stand": ([0.6, 0.4, 1.1], {"M_wood", "M_fabric"}),
    "outdoor_armchair": ([0.8, 0.8, 0.75], {"M_frame", "M_fabric"}),
    "garden_lamp": ([0.3, 0.3, 0.9], {"M_frame", "M_led"}),
}
# Resort deco: (w, d, h) of the tropical kit pieces, and the palette materials each one is built from.
TROPICAL_KINDS = {
    "palm_tall": ([1.6, 1.6, 3.0], {"M_terracotta", "M_soil", "M_leaf"}),
    "palm_small": ([0.8, 0.8, 1.6], {"M_terracotta", "M_soil", "M_leaf"}),
    "monstera": ([1.0, 1.0, 1.2], {"M_terracotta", "M_soil", "M_leaf_dark"}),
    "bird_of_paradise": ([0.9, 0.9, 1.8], {"M_terracotta", "M_soil", "M_leaf"}),
    "fern_hanging": ([0.6, 0.6, 0.7], {"M_rattan", "M_soil", "M_leaf"}),
    "plant_wall": ([2.4, 0.2, 2.4], {"M_teak", "M_leaf", "M_leaf_dark"}),
    "rattan_pendant": ([0.6, 0.6, 0.7], {"M_rattan", "M_led", "M_frame"}),
    "rattan_armchair": ([0.85, 0.85, 0.8], {"M_rattan", "M_linen"}),
    "egg_chair": ([1.1, 1.1, 2.0], {"M_frame", "M_rattan", "M_linen"}),
    "daybed_cabana": ([2.4, 2.0, 2.5], {"M_teak", "M_linen"}),
    "teak_lounger": ([0.75, 2.0, 0.45], {"M_teak", "M_linen"}),
    "lantern": ([0.35, 0.35, 0.6], {"M_teak", "M_frame", "M_led"}),
    "outdoor_bar": ([2.4, 1.3, 1.1], {"M_teak", "M_stone", "M_rattan"}),
}
TROPICAL_NIGHT = ["lantern", "rattan_pendant"]
TROPICAL_MOUNTED = {"fern_hanging": 2.1, "rattan_pendant": 2.3}
WIND_KINDS = ["palm_tall", "palm_small", "monstera", "bird_of_paradise", "fern_hanging"]
EXPECTED_NIGHT_KINDS = ["ac_split", "bar_cabinet", "bbq_coals", "candle_set", "crystal_chandelier", "disco_ball",
                        "floor_lamp", "gaming_chair", "gaming_desk", "garden_lamp", "karaoke_tv", "lantern",
                        "nightstand_lamp", "pillar_lamp", "rattan_pendant", "stone_lantern", "table_lamp", "tv_cabinet",
                        "tv_wall", "uplight"]
EXPECTED_WALL_MOUNTED = {"painting_l": 1.2, "painting_m": 1.4, "wall_shelf": 1.5, "laundry_shelf": 1.4,
                         "fern_hanging": 2.1, "rattan_pendant": 2.3, "light_switch": 1.15, "crystal_chandelier": 3.0,
                         "ac_split": 2.4, "ac_remote": 1.15,
                         # the basement (villa v2 spec §12 "Basement")
                         "disco_ball": 2.1, "oil_shelf": 0.95, "mirror_wall": 0.25,
                         # the decor pass (villa v2 spec §12 "Curtains and accessories")
                         "art_print": 1.1, "mirror_round": 1.2, "towel_bar": 0.85}


# Catalog pieces allowed more than the 2k triangles of the rest, and their cap.
LARGE_PIECES = {"crystal_chandelier": 3500}


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitFurnishingTest(unittest.TestCase):
    """Furniture, lighting and planting builders (glass villa spec §4.2–§4.5)."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(FURNISH_EXPR)

    def test_every_catalog_piece_fits_its_footprint_and_is_placed(self):
        for kind, piece in self.out["furniture"].items():
            self.assertTrue(piece["fits"], kind)
            wall_z = self.out["wall_mounted"].get(kind, 0.0)  # wall pieces hang above the z they are placed at
            self.assertEqual((piece["rot"], piece["z"]), (90, round(1.0 + wall_z, 4)), kind)
            self.assertGreater(piece["tris"], 0, kind)
            # low-poly: the hero budget has room for ~90 pieces; the tall house's grand chandelier, the centrepiece of
            # its double-height living room, takes more (test_tall_house_kit caps it)
            self.assertLess(piece["tris"], LARGE_PIECES.get(kind, 2000), kind)

    def test_pieces_are_built_from_palette_materials_only(self):
        palette = set(self.out["palette_names"])
        for kind, piece in self.out["furniture"].items():
            self.assertLessEqual(set(piece["materials"]), palette, kind)

    def test_living_dining_kitchen_entry_and_decor_kinds_have_the_designed_sizes(self):
        self.assertEqual({kind: self.out["catalog"].get(kind) for kind in LIVING_KINDS},
                         {kind: size for kind, (size, _) in LIVING_KINDS.items()})

    def test_living_dining_kitchen_entry_and_decor_pieces_use_the_materials_the_design_names(self):
        for kind, (_, materials) in LIVING_KINDS.items():
            self.assertLessEqual(materials, set(self.out["furniture"][kind]["materials"]), kind)
        self.assertGreaterEqual(len(self.out["furniture"]["bookshelf_wall"]["materials"]), 5)  # mixed book colours

    def test_bedroom_closet_office_bath_laundry_and_outdoor_kinds_have_the_designed_sizes(self):
        self.assertEqual({kind: self.out["catalog"].get(kind) for kind in BEDROOM_KINDS},
                         {kind: size for kind, (size, _) in BEDROOM_KINDS.items()})

    def test_bedroom_closet_office_bath_laundry_and_outdoor_pieces_use_the_materials_the_design_names(self):
        for kind, (_, materials) in BEDROOM_KINDS.items():
            self.assertLessEqual(materials, set(self.out["furniture"][kind]["materials"]), kind)
        self.assertGreaterEqual(len(self.out["furniture"]["closet_rack"]["materials"]), 5)  # fabric colours

    def test_shower_glass_toilet_and_bathtub_ceramic_and_gaming_desk_lights(self):
        furniture = self.out["furniture"]
        self.assertIn("GLASS_clear", furniture["shower"]["materials"])
        self.assertLessEqual({"M_screen_on", "M_rgb"}, set(furniture["gaming_desk"]["materials"]))
        self.assertTrue(furniture["gaming_desk"]["night"])
        for kind in ("toilet", "bathtub"):
            self.assertIn("M_ceramic", furniture[kind]["materials"], kind)

    def test_gaming_desk_monitors_curve_towards_the_player(self):
        self.assertEqual(self.out["monitor_yaw"], [-20, 0, 20])  # three screens, the outer two turned inwards

    def test_wall_mounted_pieces_hang_at_their_bottom_height(self):
        self.assertEqual(self.out["wall_mounted"], EXPECTED_WALL_MOUNTED)

    def test_only_night_kinds_carry_night_light(self):
        self.assertEqual(self.out["night_kinds"], EXPECTED_NIGHT_KINDS)
        for kind, piece in self.out["furniture"].items():
            self.assertEqual(piece["night"], kind in EXPECTED_NIGHT_KINDS, kind)

    def test_painting_variant_maps_the_canvas_onto_its_art_atlas_cell(self):
        for variant, painting in self.out["painting"].items():
            self.assertEqual(painting["uv"], painting["cell"], variant)  # every M_art UV inside the cell, all covered
            self.assertEqual(painting["edges"], painting["cell"], variant)  # left, bottom, right, top of the canvas
            self.assertEqual(painting["materials"], ["M_art", "M_frame"], variant)
        self.assertNotEqual(self.out["painting"]["0"]["cell"], self.out["painting"]["5"]["cell"])
        self.assertEqual(self.out["bad_variant"], "ValueError")

    def test_place_rejects_options_the_builder_does_not_declare(self):
        self.assertEqual(self.out["unknown_option"], "TypeError")

    def test_pieces_face_their_designed_direction(self):
        spans = {kind: piece["spans"] for kind, piece in self.out["furniture"].items()}  # [x0, x1, y0, y1, z0, z1]
        self.assertGreater(spans["tv_wall"]["M_screen_on"][2], 0.0)  # the TV panel hangs on the wall side (+Y)
        island = spans["kitchen_island_4"]
        self.assertLess(island["M_fabric_dark"][3], island["M_counter"][2])  # the stools stand in front (-Y)
        self.assertEqual(island["M_counter"][3], 0.85)  # the island leans on the +Y side
        bench = spans["bench_mirror"]
        self.assertGreater(bench["M_metal"][2], bench["M_cushion"][3])  # the mirror stands behind the bench
        self.assertGreater(spans["bed_king"]["M_cushion"][2], 0.9)  # the upholstered headboard is at the +Y end
        self.assertGreater(spans["tv_cabinet"]["M_screen_on"][2], 0.0)  # the TV stands at the back of its cabinet
        self.assertGreater(spans["toilet"]["M_metal"][2], 0.0)  # the flush plate sits on the tank at the back
        desk = spans["gaming_desk"]
        self.assertGreater(desk["M_screen_on"][2], 0.3)  # the monitors stand on the long side at the back (+Y)
        self.assertGreater(desk["M_rgb"][1], 0.6)  # the PC tower stands on the return at +X
        glass = spans["shower"]["GLASS_clear"]
        self.assertEqual((glass[1], glass[2]), (0.5, -0.5))  # glass panels on the +X and -Y sides
        door = spans["washer_dryer"]["M_screen"]
        self.assertEqual(door[2], -0.325)  # the round doors face front (-Y)

    def test_lighting_fixtures_are_night_lights(self):
        lighting = self.out["lighting"]
        self.assertEqual(lighting["night"], [True, True, True, True])
        self.assertEqual(lighting["down_top"], 3.0)
        self.assertEqual(lighting["pendant_materials"], ["M_frame", "M_led"])
        self.assertEqual(lighting["lamp"], ["POINT", 48.0, False])

    def test_planter_shrubs_carry_wind_weights_and_the_box_does_not(self):
        planter = self.out["planter"]
        self.assertEqual(planter["attrs"], ["wind"])
        self.assertEqual(planter["min"], 0.0)
        self.assertEqual(planter["box_max"], 0.0)
        self.assertGreater(planter["max"], 0.3)
        self.assertEqual(planter["materials"], ["M_leaf", "M_soil", "M_white"])


# The jacuzzi of the tests stands at (-7.2, -3.2) on a roof at z = 7.55: deck top 8.05, basin floor 7.6.
CX, CY, ROOF = -7.2, -3.2, 7.55


def rounded(*values):
    """The expected metres as the summaries report them: float32 vertices rounded to 4 decimals."""
    return [round(v, 4) for v in values]


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitRooftopTest(unittest.TestCase):
    """Villa v2 spec §5.2: the rooftop jacuzzi with its looping bubbles and the grape trellis with its wind-painted
    vines."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(ROOFTOP_EXPR)

    def test_jacuzzi_returns_its_parts_under_the_names_the_runtime_looks_for(self):
        jacuzzi = self.out["jacuzzi"]
        self.assertEqual(jacuzzi["keys"], ["bubbles", "deck", "led", "water"])
        self.assertEqual(jacuzzi["names"], ["jacuzzi", "WATER_jacuzzi", "LT_jacuzzi"])
        self.assertEqual(jacuzzi["groups"], ["jacuzzi_bubbles_a", "jacuzzi_bubbles_b", "jacuzzi_bubbles_c"])

    def test_deck_is_a_wood_square_on_the_roof_with_a_tile_lined_basin_and_a_step_at_the_front(self):
        deck = self.out["jacuzzi"]["deck"]
        (x0, x1), (y0, y1), (z0, z1) = deck["bounds"]
        self.assertEqual([x0, x1, y1, z0, z1], rounded(CX - 1.8, CX + 1.8, CY + 1.8, ROOF, ROOF + 0.5))
        self.assertLess(y0, CY - 1.8)  # the step sticks out on the -Y side
        self.assertEqual(deck["materials"], ["M_pool_tile", "M_wood"])
        self.assertLess(deck["tris"], 400)
        basin = self.out["jacuzzi"]["basin"]
        self.assertEqual(basin["floor"], round(ROOF + 0.05, 4))  # 0.45 m below the deck top
        self.assertEqual(basin["inside_wall"], round(ROOF + 0.05, 4))  # the lined basin is exactly 2.4 m wide ...
        self.assertEqual(basin["wall"], round(ROOF + 0.5, 4))  # ... and its lining rises to the deck top
        self.assertEqual(basin["rim"], round(ROOF + 0.5, 4))
        self.assertTrue(ROOF + 0.1 < basin["step"] < ROOF + 0.5)
        self.assertIsNone(basin["back"])
        self.assertIsNone(basin["side"])

    def test_water_is_a_thin_slab_filling_the_basin_just_below_the_deck_top(self):
        water = self.out["jacuzzi"]["water"]
        (x0, x1), (y0, y1), (z0, z1) = water["bounds"]
        self.assertEqual(water["materials"], ["M_water"])
        for low, high, centre in ((x0, x1, CX), (y0, y1, CY)):
            self.assertTrue(2.3 < high - low <= 2.4)
            self.assertAlmostEqual((low + high) / 2, centre, places=3)
        self.assertTrue(ROOF + 0.5 - 0.1 <= z1 <= ROOF + 0.5 - 0.02)
        self.assertLessEqual(z1 - z0, 0.05)
        self.assertGreater(z0, ROOF + 0.05)  # above the basin floor

    def test_led_ring_is_a_night_light_inside_the_rim_just_under_the_water_line(self):
        led = self.out["jacuzzi"]["led"]
        (x0, x1), (y0, y1), (z0, z1) = led["bounds"]
        water_top = self.out["jacuzzi"]["water"]["bounds"][2][1]
        self.assertTrue(led["night"])
        self.assertEqual(led["materials"], ["M_led"])
        self.assertTrue(CX - 1.201 <= x0 and x1 <= CX + 1.201 and CY - 1.201 <= y0 and y1 <= CY + 1.201)
        self.assertGreater(x1 - x0, 2.0)  # a ring along the basin wall, not a dot
        self.assertLess(z1, water_top)
        self.assertGreater(z0, ROOF + 0.05)

    def test_bubbles_are_twenty_small_spheres_in_three_groups_floating_at_the_surface(self):
        bubbles = self.out["bubbles"]
        water_top = self.out["jacuzzi"]["water"]["bounds"][2][1]
        self.assertEqual(sum(bubbles["counts"]), 20)
        self.assertTrue(all(count >= 6 for count in bubbles["counts"]))
        self.assertLess(bubbles["size"], 0.15)
        self.assertLess(bubbles["tris"], 1500)
        for x, y, z in bubbles["centres"]:
            self.assertTrue(abs(x - CX) < 1.2 and abs(y - CY) < 1.2)
            self.assertLess(abs(z - water_top), 0.1)

    def test_the_groups_share_one_looping_clip_with_a_slot_each_and_different_phases(self):
        anim = self.out["anim"]
        self.assertEqual(anim["actions"], ["ambient_jacuzzi", "ambient_spa"])
        self.assertEqual(anim["slots"], 3)
        self.assertEqual(anim["assigned"], ["ambient_jacuzzi"] * 3)
        starts = set()
        for group in anim["curves"]:
            self.assertEqual([(path, index) for path, index, keys in group], [("location", 2)])
            keys = group[0][2]
            self.assertGreaterEqual(len(keys), 4)
            self.assertEqual((keys[0][0], keys[-1][0]), (0.0, 60.0))  # 60 frames: the exporter writes frame / fps
            self.assertEqual(keys[0][1], keys[-1][1])  # seamless loop
            heights = [value for frame, value in keys]
            self.assertTrue(0.01 < max(heights) - min(heights) < 0.1)  # a gentle bob
            starts.add(keys[0][1])
        self.assertEqual(len(starts), 3)
        self.assertEqual(anim["start"], anim["end"])
        self.assertTrue(all(a != b for a, b in zip(anim["start"], anim["quarter"])))

    def test_jacuzzi_parameters_set_the_sizes_the_bubble_count_the_loop_and_the_clip_name(self):
        spa = self.out["anim"]["spa"]
        (x0, x1), (y0, y1), (z0, z1) = spa["bounds"]
        self.assertEqual([x0, x1, y1, z0, z1], rounded(1.5, 4.5, -6.5, ROOF, ROOF + 0.6))
        self.assertEqual(spa["floor"], round(ROOF + 0.05, 4))
        (wx0, wx1), _, _ = spa["water"]
        self.assertTrue(1.9 < wx1 - wx0 <= 2.0)
        self.assertEqual(spa["count"], 8)
        self.assertEqual(spa["assigned"], ["ambient_spa"] * 3)
        for group in spa["curves"]:
            keys = group[0][2]
            self.assertEqual((keys[0][0], keys[-1][0]), (0.0, 40.0))
            self.assertEqual(keys[0][1], keys[-1][1])

    def test_trellis_posts_stand_at_the_corners_and_every_three_and_a_half_metres_on_the_long_sides(self):
        frame = self.out["frame"]
        self.assertEqual(frame["name"], "trellis")
        self.assertEqual(frame["materials"], ["M_frame", "M_wood"])
        (x0, x1), (y0, y1), (z0, z1) = frame["bounds"]
        self.assertTrue(-3.3 <= x0 <= -3.0 and 4.0 <= x1 <= 4.3 and 0.7 <= y0 <= 1.0 and 6.0 <= y1 <= 6.3)
        self.assertEqual((z0, z1), tuple(rounded(ROOF, ROOF + 2.6)))
        self.assertEqual(frame["posts"], [[-3.0, 1.0], [-3.0, 6.0], [0.5, 1.0], [0.5, 6.0], [4.0, 1.0], [4.0, 6.0]])
        self.assertEqual(frame["beams"], 4)

    def test_trellis_lattice_slats_run_both_ways_every_spacing(self):
        frame = self.out["frame"]
        # Upper slats run along y and are spaced along the 7 m x side; lower ones run along x across the 5 m side.
        self.assertEqual((frame["upper"]["count"], frame["lower"]["count"]), (19, 14))
        self.assertLessEqual(frame["upper"]["max_gap"], 0.4 + 1e-3)
        self.assertLessEqual(frame["lower"]["max_gap"], 0.4 + 1e-3)
        self.assertTrue(all(length >= 5.0 for length in frame["upper"]["lengths"]))
        self.assertTrue(all(length >= 7.0 for length in frame["lower"]["lengths"]))
        self.assertLess(frame["wide"][0], frame["upper"]["count"])  # spacing=0.8 needs fewer slats
        self.assertLess(frame["wide"][1], frame["lower"]["count"])

    def test_vines_are_one_object_of_trunks_leaves_and_grapes(self):
        vines = self.out["vines"]
        self.assertEqual(vines["name"], "trellis_vines")
        self.assertEqual(vines["materials"], ["M_grape", "M_leaf", "M_soil"])
        self.assertTrue(3000 < vines["tris"] < 8000)

    def test_a_trunk_rises_from_every_post_to_the_lattice(self):
        trunks = self.out["vines"]["trunks"]
        self.assertEqual(trunks["count"], 6)
        self.assertTrue(all(gap < 0.2 for gap in trunks["gaps"]))
        self.assertGreaterEqual(trunks["reach"], ROOF + 2.6 - 0.3)

    def test_wind_is_zero_at_the_trunk_bases_and_near_one_in_the_canopy_and_bunches(self):
        vines = self.out["vines"]
        self.assertEqual(vines["attrs"], ["wind"])
        wind = vines["wind"]
        self.assertLess(wind["min"], 0.01)
        self.assertLess(wind["ground_max"], 0.05)
        self.assertGreater(wind["max"], 0.5)
        self.assertGreaterEqual(wind["leaf_min"], 0.5)
        self.assertGreaterEqual(wind["grape_min"], 0.9)

    def test_grapes_hang_under_the_canopy_and_the_leaves_cover_the_lattice(self):
        vines = self.out["vines"]
        top = ROOF + 2.6
        (gx0, gy0, gz0), (gx1, gy1, gz1) = vines["grape"]["min"], vines["grape"]["max"]
        self.assertTrue(top - 1.0 < gz0 and gz1 < top)
        self.assertTrue(-3.0 < gx0 and gx1 < 4.0 and 1.0 < gy0 and gy1 < 6.0)
        (lx0, ly0, lz0), (lx1, ly1, lz1) = vines["leaf"]["min"], vines["leaf"]["max"]
        self.assertGreater(lz1, top)
        self.assertGreater(lz0, top - 0.4)
        self.assertTrue(-3.6 < lx0 and lx1 < 4.6 and 0.4 < ly0 and ly1 < 6.6)

    def test_leaf_density_and_bunch_count_scale_the_triangles(self):
        scaling = self.out["scaling"]
        self.assertLess(scaling["tris"][0], scaling["tris"][1])
        self.assertAlmostEqual(scaling["leaf"][0] / scaling["leaf"][1], 0.5, delta=0.1)
        self.assertGreater(scaling["grape"][0], 0)
        self.assertEqual(scaling["grape"][1], 2 * scaling["grape"][0])

    def test_the_seed_fixes_the_jitter(self):
        scaling = self.out["scaling"]
        self.assertTrue(scaling["same_seed"])
        self.assertTrue(scaling["same_frame"])
        self.assertTrue(scaling["other_seed"])

    def test_a_rooftop_module_with_both_satisfies_the_contract(self):
        contract = self.out["contract"]
        self.assertEqual(contract["errors"], [])
        self.assertEqual(contract["clips"], ["ambient_jacuzzi", "ambient_spa"])
        self.assertLess(contract["tris"], 15000)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitResortMaterialsTest(unittest.TestCase):
    """Resort deco: travertine instead of grey stone, and the teak, rattan, linen, terracotta and dark-leaf materials."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(RESORT_MATERIALS_EXPR)

    def test_palette_has_the_resort_materials(self):
        # [name, base colour, roughness, metallic, alpha, emission strength, image]
        palette = self.out["palette"]
        self.assertEqual(palette["rattan"], ["M_rattan", [0.72, 0.55, 0.32], 0.85, 0.0, 1.0, 0.0, None])
        self.assertEqual(palette["linen"], ["M_linen", [0.93, 0.9, 0.84], 0.95, 0.0, 1.0, 0.0, None])
        self.assertEqual(palette["terracotta"], ["M_terracotta", [0.72, 0.38, 0.24], 0.9, 0.0, 1.0, 0.0, None])
        self.assertEqual(palette["leaf_dark"], ["M_leaf_dark", [0.1, 0.3, 0.12], 0.75, 0.0, 1.0, 0.0, None])

    def test_teak_is_a_golden_honey_wood_colour(self):
        # A flat colour, not T_wood: glTF can only multiply a texture by a factor <= 1, which darkens the walnut grain
        # of T_wood into mahogany instead of lightening it to teak (and the exporter drops the factor of a texture
        # linked straight to Base Color), and the house is at 3 of its 4 textures.
        teak = self.out["palette"]["teak"]
        self.assertIsNotNone(teak)
        name, (r, g, b), roughness, metallic, alpha, emission, image = teak
        self.assertEqual((name, image, roughness, metallic, alpha, emission), ("M_teak", None, 0.5, 0.0, 1.0, 0.0))
        self.assertGreater(r, g)
        self.assertGreater(g, b)
        self.assertGreaterEqual(r, 0.45)  # lighter than the walnut of M_wood
        self.assertTrue(0.5 <= g / r <= 0.7, (r, g, b))  # golden, not red
        self.assertLessEqual(b / r, 0.35)  # honey, not blond
        self.assertLess(r, self.out["palette"]["rattan"][1][0])  # darker than the straw of the rattan

    def test_stone_base_tint_is_warm_to_match_the_travertine(self):
        stone = self.out["palette"]["stone"]
        name, (r, g, b), roughness, _metallic, _alpha, _emission, image = stone
        self.assertEqual((name, image, roughness), ("M_stone", "T_stone", 0.8))
        self.assertGreater(r, g)
        self.assertGreater(g, b)
        self.assertGreaterEqual(r - b, 0.08)  # it was a neutral 0.5 grey
        self.assertGreaterEqual(min(r, g, b), 0.7)  # light travertine: the tint must not darken the texture again

    def test_stone_tint_reaches_gltf_next_to_the_texture(self):
        stone = self.out["stone_gltf"]
        self.assertTrue(stone["textured"])
        self.assertEqual(stone["factor"], self.out["palette"]["stone"][1])

    def test_fabric_leans_towards_sand_and_linen_without_outshining_the_linen(self):
        _name, (r, g, b), roughness, *_ = self.out["palette"]["fabric"]
        self.assertEqual(roughness, 0.95)
        self.assertGreater(r, g)
        self.assertGreater(g, b)
        self.assertGreaterEqual(r - b, 0.14)  # it was 0.10: (0.78, 0.74, 0.68)
        linen = self.out["palette"]["linen"][1]
        self.assertTrue(all(c <= l for c, l in zip((r, g, b), linen)), (r, g, b))

    def test_stone_texture_keeps_its_name_size_and_seed_and_is_packed(self):
        stone = self.out["stone"]
        self.assertEqual((stone["name"], stone["size"], stone["small_size"]), ("T_stone", [1024, 1024], [256, 256]))
        self.assertTrue(stone["packed"])
        self.assertTrue(stone["same_seed_same_pixels"])
        self.assertTrue(stone["other_seed_differs"])
        self.assertTrue(stone["opaque"])
        self.assertTrue(stone["in_range"])

    def test_stone_texture_is_warm_travertine(self):
        r, g, b = self.out["stone"]["mean"]  # the mean pixel, in the linear values the generator writes
        self.assertGreater(r, g)
        self.assertGreater(g, b)
        self.assertGreaterEqual(r - b, 0.12)

    def test_stone_texture_has_soft_horizontal_bands_dark_pits_and_slab_joints(self):
        stone = self.out["stone"]
        self.assertGreater(stone["row_spread"], 2.5 * stone["column_spread"])  # strata run along X
        self.assertGreater(stone["row_spread"], 0.01)  # ...and are visible
        self.assertGreaterEqual(stone["pits"], 0.001)  # small dark pits
        self.assertLessEqual(stone["pits"], 0.03)
        self.assertGreaterEqual(stone["joint_drop"], 0.1)  # large-format slabs: joints in both directions
        self.assertGreaterEqual(stone["joint_row_drop"], 0.1)


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitTropicalTest(unittest.TestCase):
    """Resort deco: the tropical plants and the rattan, teak and linen furniture of the kit."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(TROPICAL_EXPR, kinds=list(TROPICAL_KINDS), wind_kinds=WIND_KINDS)

    def piece(self, kind):
        piece = self.out["pieces"].get(kind)
        self.assertIsNotNone(piece, f"{kind} is not in the catalog")
        return piece

    def test_kinds_have_the_designed_sizes(self):
        self.assertEqual(self.out["catalog"], {kind: size for kind, (size, _) in TROPICAL_KINDS.items()})

    def test_the_pendant_and_the_lantern_glow_and_the_hanging_pieces_hang_at_their_bottom_height(self):
        self.assertEqual(self.out["night"], TROPICAL_NIGHT)
        self.assertEqual(self.out["mounted"], TROPICAL_MOUNTED)
        for kind in TROPICAL_KINDS:
            piece = self.piece(kind)
            self.assertEqual(piece["night"], kind in TROPICAL_NIGHT, kind)
            self.assertEqual(piece["z"], round(1.0 + TROPICAL_MOUNTED.get(kind, 0.0), 4), kind)

    def test_every_piece_fits_its_footprint_fills_most_of_it_and_stays_low_poly(self):
        eps = 1e-3
        for kind, ([w, d, h], _) in TROPICAL_KINDS.items():
            x0, x1, y0, y1, z0, z1 = self.piece(kind)["extent"]
            self.assertTrue(x0 >= -w / 2 - eps and x1 <= w / 2 + eps and y0 >= -d / 2 - eps and y1 <= d / 2 + eps
                            and z0 >= -eps and z1 <= h + eps, (kind, self.piece(kind)["extent"]))
            for used, size in ((x1 - x0, w), (y1 - y0, d), (z1 - z0, h)):
                self.assertGreaterEqual(used, 0.6 * size, (kind, self.piece(kind)["extent"]))  # not a speck in its box
            self.assertGreater(self.piece(kind)["tris"], 0, kind)
            self.assertLess(self.piece(kind)["tris"], 1000, kind)

    def test_pieces_use_the_materials_the_design_names(self):
        for kind, (_, materials) in TROPICAL_KINDS.items():
            self.assertLessEqual(materials, set(self.piece(kind)["materials"]), kind)

    def test_pieces_are_deterministic_and_carry_no_wind_unless_asked(self):
        for kind in TROPICAL_KINDS:
            self.assertTrue(self.piece(kind)["same_twice"], kind)
            self.assertEqual(self.piece(kind)["attrs"], [], kind)

    def test_pieces_face_their_designed_direction(self):
        bar = self.piece("outdoor_bar")["spans"]  # [x0, x1, y0, y1, z0, z1]
        self.assertGreater(bar["M_stone"][2], bar["M_rattan"][3])  # the travertine top at +Y, the stools in front (-Y)
        self.assertEqual(bar["M_stone"][5], 1.1)  # the counter top is the highest point of the bar
        armchair = self.piece("rattan_armchair")["spans"]
        self.assertGreater(armchair["M_rattan"][3], armchair["M_linen"][3])  # the cane back wraps behind the cushion
        lounger = self.piece("teak_lounger")["extent"]
        self.assertGreaterEqual(lounger[3] - lounger[2], 1.8)  # long along Y, narrow along X

    def test_wind_paints_the_plants_from_the_pot_to_the_leaf_tips(self):
        for kind in WIND_KINDS:
            wind = self.out["winds"].get(kind)
            self.assertIsNotNone(wind, kind)
            self.assertEqual(wind["attrs"], ["wind"], kind)  # the contract wants 'wind' to be the only colour attribute
            self.assertEqual(wind["off_attrs"], [], kind)  # wind=False is the default
            self.assertEqual(wind["min"], 0.0, kind)
            self.assertGreater(wind["max"], 0.5, kind)
            self.assertEqual(wind["pot_max"], 0.0, kind)  # the pot or the hanging basket never moves
            if kind != "fern_hanging":
                self.assertGreater(wind["high"], 0.9, kind)  # the highest leaf tip sways most
        fern = self.out["winds"]["fern_hanging"]
        self.assertGreater(fern["low"], 0.9)  # a hanging fern sways most at the tips of its fronds, hanging lowest
        self.assertEqual(fern["high"], 0.0)

    def test_hanging_pieces_take_a_longer_cord_up_to_a_higher_ceiling(self):
        for kind in ("rattan_pendant", "fern_hanging"):
            hung = self.out["hung"].get(kind)
            self.assertIsNotNone(hung, f"{kind} takes no cord option")
            plain = self.piece(kind)
            h = TROPICAL_KINDS[kind][0][2]
            self.assertEqual(hung["extent"][5], round(h + 0.5, 3), kind)  # the cord ends 0.5 m above the piece's top
            self.assertEqual(hung["extent"][:5], plain["extent"][:5], kind)  # the shade or the basket does not move
            self.assertLessEqual(hung["tris"] - plain["tris"], 24, kind)
            self.assertEqual(hung["night"], plain["night"], kind)

    def test_wind_is_rejected_by_pieces_that_do_not_sway(self):
        self.assertEqual(self.out["rejected"], {"sofa_l": "TypeError", "plant_tall": "TypeError",
                                                "rattan_pendant": "TypeError"})

    def test_leaf_is_a_closed_flat_blade_between_its_base_and_tip(self):
        prims = self.out["primitives"]
        self.assertTrue(prims, "MeshBuilder has no leaf() and ellipsoid() yet")
        for key in ("upright", "flat", "turned"):
            self.assertEqual((prims[key]["tris"], prims[key]["verts"]), (8, 6), key)
            self.assertTrue(prims[key]["closed"], key)
            self.assertTrue(prims[key]["outward"], key)
        # width across the blade, `thickness` through it, the whole length from base to tip
        self.assertEqual(prims["upright"]["dims"], [0.4, 0.02, 1.0])  # straight up: the side defaults to X
        self.assertEqual(prims["flat"]["dims"], [0.4, 1.0, 0.02])  # lying along Y: the broad face looks up
        self.assertEqual(prims["turned"]["dims"], [0.02, 1.0, 0.4])  # side=(0, 0, 1): the broad face looks along X
        self.assertEqual(prims["belly_y"], 0.3)  # widest at `belly` of the way along
        self.assertEqual(prims["zero_length"], "ValueError")

    def test_ellipsoid_stretches_an_icosphere_to_its_radii(self):
        prims = self.out["primitives"]
        self.assertTrue(prims, "MeshBuilder has no leaf() and ellipsoid() yet")
        egg = prims["egg"]
        self.assertEqual(egg["tris"], 80)
        self.assertEqual(prims["egg_z"], [0.5, 1.5])  # radius 0.5 about z = 1: the poles
        self.assertTrue(0.8 * 0.4 <= egg["dims"][0] <= 0.4, egg["dims"])
        self.assertTrue(0.8 * 0.6 <= egg["dims"][1] <= 0.6, egg["dims"])

    def test_octahedron_is_the_cheapest_closed_ball(self):
        gem = self.out["primitives"].get("octahedron")
        self.assertIsNotNone(gem, "MeshBuilder has no octahedron() yet")
        self.assertEqual((gem["tris"], gem["verts"], gem["closed"], gem["outward"]), (8, 6, True, True))
        self.assertEqual(gem["dims"], [1.0, 1.0, 1.0])  # radius 0.5: a metre across, its points on the axes
        self.assertEqual(gem["middle"], [0.0, 0.0, 1.0])

    def test_a_module_with_every_piece_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitLightSwitchTest(unittest.TestCase):
    """Interactive house (interaction spec §3.1): the wall switch of a room, the click target of its lights while the
    dollhouse cut hides the ceiling: a small dark plate with a white rocker, hung at switch height."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(TROPICAL_EXPR, kinds=["light_switch"], wind_kinds=[])
        cls.piece = cls.out["pieces"].get("light_switch")

    def test_kind_is_in_the_catalog_with_its_size_and_hangs_at_switch_height(self):
        self.assertEqual(self.out["catalog"], {"light_switch": [0.09, 0.02, 0.12]})
        self.assertEqual(self.out["mounted"], {"light_switch": 1.15})
        self.assertIsNotNone(self.piece, "light_switch is not in the catalog")
        self.assertEqual(self.piece["z"], round(1.0 + 1.15, 4))

    def test_does_not_glow_by_itself(self):
        self.assertEqual(self.out["night"], [])  # the lights it switches carry the night_light flag, not the switch
        self.assertFalse(self.piece["night"])

    def test_is_a_dark_plate_on_the_wall_with_a_white_rocker_in_front(self):
        self.assertEqual(self.piece["materials"], ["M_frame", "M_white"])
        plate, rocker = self.piece["spans"]["M_frame"], self.piece["spans"]["M_white"]  # [x0, x1, y0, y1, z0, z1]
        self.assertEqual((plate[3], plate[2]), (0.01, 0.0))  # the plate's back is the wall (+Y), 1 cm thick
        self.assertEqual(rocker[2], -0.01)  # the rocker stands 1 cm proud of it, towards -Y
        self.assertTrue(plate[0] <= rocker[0] < rocker[1] <= plate[1] and plate[4] <= rocker[4] < rocker[5] <= plate[5])
        self.assertEqual(self.piece["extent"], [-0.045, 0.045, -0.01, 0.01, 0.0, 0.12])

    def test_costs_two_boxes_and_is_deterministic(self):
        self.assertEqual(self.piece["tris"], 24)
        self.assertTrue(self.piece["same_twice"])
        self.assertEqual(self.out["contract"], [])


@unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
class ArchkitResortWaterLightTest(unittest.TestCase):
    """Resort deco: string lights, the reflecting pool and the wall fountain."""

    @classmethod
    def setUpClass(cls):
        cls.out = summary(RESORT_WATER_EXPR)

    def part(self, key):
        """The summary of one part, or a failure naming the builder that is missing."""
        missing = "lighting.string_lights does not exist" if key == "lights" else "archkit.water does not exist"
        self.assertIn(key, self.out, missing)
        return self.out[key]

    def test_string_lights_are_one_night_light_object_of_small_bulbs_on_a_dark_wire(self):
        lights = self.part("lights")
        plain = lights["plain"]
        self.assertEqual(plain["name"], "LT_string")
        self.assertTrue(plain["night"])
        self.assertEqual(plain["materials"], ["M_frame", "M_led"])
        self.assertLessEqual(plain["bulb_size"], 0.1)
        self.assertEqual(lights["objects"], ["LT_bent"])  # a polyline of two spans is still one object
        self.assertTrue(lights["same_pixels"])

    def test_string_lights_bulb_count_scales_with_length_and_density(self):
        lights = self.part("lights")
        self.assertEqual(lights["plain"]["bulbs"], 16)  # 4 bulbs a metre over a 4 m span
        self.assertEqual(lights["long"], 32)  # twice the length, twice the bulbs
        self.assertEqual(lights["bent"], 28)  # a 4 m and a 3 m span
        self.assertEqual(lights["sparse"], 8)  # bulbs_per_m=2.0

    def test_string_lights_sag_between_anchors_by_a_fraction_of_the_span(self):
        lights = self.part("lights")
        plain = lights["plain"]
        self.assertLessEqual(plain["wire_x"][0], 0.01)  # the wire runs from anchor to anchor...
        self.assertGreaterEqual(plain["wire_x"][1], 3.99)
        self.assertAlmostEqual(plain["wire_top"], 2.5, delta=0.02)  # ...and never above them
        self.assertGreater(plain["bulb_x"][0], 0.0)  # bulbs hang between the anchors
        self.assertLess(plain["bulb_x"][1], 4.0)
        low, high = plain["bulb_z"]
        self.assertTrue(1.8 <= low <= 2.0, low)  # sag=0.15 of 4 m: the middle bulbs hang ~0.6 m below the anchors
        self.assertGreater(high, 2.3)  # the bulbs next to an anchor stay up
        self.assertTrue(all(abs(z - 2.5) <= 0.02 for z in lights["taut"]), lights["taut"])  # sag=0: a straight line
        self.assertLess(lights["loose"][0], low - 0.3)  # sag=0.3 hangs deeper

    def test_string_light_bulbs_are_8_triangle_octahedra_and_a_taut_wire_is_a_single_piece(self):
        lights = self.part("lights")
        self.assertEqual(lights["plain"]["bulb_tris"], 8)  # at a few pixels across a ball is only worth its silhouette
        self.assertEqual(lights["taut_pieces"], 1)  # sag=0: a straight run needs no cuts to follow a curve
        self.assertGreaterEqual(lights["plain"]["wire_pieces"], 4)  # a sagging wire is cut up to hang in a curve

    def test_string_lights_can_carry_bigger_globes_for_the_same_triangles(self):
        globe = self.part("lights")["globe"]
        self.assertIsNotNone(globe, "string_lights takes no bulb_radius")
        self.assertEqual(globe["size"], 0.12)  # bulb_radius=0.06: a 12 cm globe, which still reads from the wallpaper
        self.assertEqual((globe["bulbs"], globe["tris"]), (16, globe["plain_tris"]))

    def test_string_lights_need_two_anchors_and_leave_nothing_behind_without_them(self):
        lights = self.part("lights")
        self.assertIn("LT_bad", lights["one_anchor"])
        self.assertEqual(lights["left_over"], [])

    def test_reflecting_pool_is_a_travertine_rim_around_a_tile_basin_with_a_water_slab(self):
        pool = self.part("pool")
        self.assertEqual(pool["keys"], ["pool", "water"])  # no steps asked for, no steps object
        self.assertEqual(pool["names"], ["pool", "WATER_pool"])
        self.assertEqual(pool["bounds"], [[-3.0, 3.0], [-1.5, 1.5], [0.0, 0.15]])  # mn..mx outside the rim, z..z + depth
        self.assertEqual(pool["materials"], ["M_pool_tile", "M_stone"])
        self.assertEqual(pool["water"]["materials"], ["M_water"])
        (wx0, wx1), (wy0, wy1), (wz0, wz1) = pool["water"]["bounds"]
        self.assertTrue(-3.0 < wx0 and wx1 < 3.0 and -1.5 < wy0 and wy1 < 1.5, pool["water"]["bounds"])  # inside the rim
        self.assertLessEqual(wz1 - wz0, 0.03)  # a thin slab...
        self.assertLessEqual(pool["floor"], wz0 + 1e-3)  # ...above the tile floor
        self.assertTrue(0.15 - 0.08 <= wz1 < 0.15, wz1)  # ...just under the rim: a reflecting pool is full to the brim
        self.assertEqual((pool["rim"], pool["rim_front"]), (0.15, 0.15))  # the rim runs all round at depth

    def test_reflecting_pool_steps_are_square_travertine_stones_just_above_the_water(self):
        deep = self.part("deep")
        self.assertEqual(deep["keys"], ["pool", "steps", "water"])
        self.assertEqual(deep["names"], ["deep", "WATER_deep", "deep_steps"])
        self.assertEqual(deep["bounds"][2], [0.2, 0.5])  # standing on z = 0.2, depth 0.3
        self.assertEqual(deep["step_materials"], ["M_stone"])
        self.assertEqual(deep["centres"], [[-1.5, 7.5], [0.0, 7.5], [1.5, 7.5]])
        self.assertEqual(len(deep["sizes"]), 1, deep["sizes"])  # square: the same size along X and Y
        top, water_top = deep["steps"][2][1], deep["water"][2][1]
        self.assertTrue(0.0 < top - water_top <= 0.06, (top, water_top))  # slightly above the water

    def test_reflecting_pool_rejects_what_does_not_fit_and_builds_nothing_then(self):
        errors = self.part("pool_errors")
        self.assertIn("pool_bad", errors["step_outside"])
        self.assertIn("pool_tiny", errors["too_small"])
        self.assertEqual(errors["left_over"], [])

    def test_wall_fountain_has_the_wall_the_sheet_the_basin_water_and_the_led(self):
        fountain = self.part("fountain")
        order = ("wall", "sheet", "water", "led")
        self.assertEqual(sorted(fountain), sorted(order))
        self.assertEqual([fountain[key]["name"] for key in order],
                         ["fountain", "WATER_fountain_sheet", "WATER_fountain", "LT_fountain"])
        self.assertEqual([fountain[key]["materials"] for key in order],
                         [["M_stone"], ["M_water"], ["M_water"], ["M_led"]])
        self.assertEqual([fountain[key]["night"] for key in order], [False, False, False, True])

    def test_wall_fountain_water_falls_down_the_front_face_into_a_low_basin_lit_by_the_led(self):
        fountain = self.part("fountain")
        (x0, x1), (y0, y1), (z0, z1) = fountain["wall"]["bounds"]  # the slab and its basin: the line is y = 12
        self.assertEqual(((x0, x1), (z0, z1)), ((0.0, 3.0), (0.0, 2.0)))
        self.assertGreaterEqual(y1, 12.0)  # the slab stands on the line
        self.assertLess(y0, 11.7)  # the basin lies in front of it, on the -Y side
        (sx0, sx1), (sy0, sy1), (sz0, sz1) = fountain["sheet"]["bounds"]
        self.assertLessEqual(sy1, 12.0)
        self.assertLessEqual(sy1 - sy0, 0.03)  # a thin vertical sheet
        self.assertTrue(0.0 <= sx0 and sx1 <= 3.0 and sx1 - sx0 >= 1.8, (sx0, sx1))
        self.assertTrue(1.5 <= sz1 <= 2.0, sz1)  # it spills from near the top of the wall
        (bx0, bx1), (by0, by1), (bz0, bz1) = fountain["water"]["bounds"]
        self.assertTrue(0.0 <= bx0 and bx1 <= 3.0 and y0 <= by0 and by1 <= 12.0, fountain["water"]["bounds"])
        self.assertLessEqual(bz1 - bz0, 0.03)
        self.assertLess(bz1, 0.6)  # a low basin
        self.assertLessEqual(sz0, bz1 + 1e-3)  # the sheet runs down into the basin water
        (lx0, lx1), (ly0, ly1), (lz0, lz1) = fountain["led"]["bounds"]
        self.assertGreaterEqual(lx1 - lx0, 1.8)  # the LED strip runs along the basin...
        self.assertTrue(by0 <= ly0 and ly1 <= by1, fountain["led"]["bounds"])
        self.assertLessEqual(lz1, bz1)  # ...under the water line

    def test_wall_fountain_basin_lies_on_the_minus_side_by_default_and_on_the_plus_side_when_facing_plus(self):
        sideways = self.part("sideways")  # along Y at x = 8: the basin lies towards -X
        (x0, x1), (y0, y1), _ = sideways["wall"]["bounds"]
        self.assertGreaterEqual(x1, 8.0)
        self.assertLess(x0, 7.7)
        self.assertEqual((y0, y1), (10.0, 13.0))
        self.assertLessEqual(sideways["sheet"]["bounds"][0][1], 8.0)
        behind = self.part("behind")  # along X at y = 16, facing=1: the basin lies towards +Y
        (_, _), (y0, y1), _ = behind["wall"]["bounds"]
        self.assertLessEqual(y0, 16.0)
        self.assertGreater(y1, 16.3)
        self.assertGreaterEqual(behind["sheet"]["bounds"][1][0], 16.0)
        self.assertGreaterEqual(behind["water"]["bounds"][1][0], 16.0)

    def test_wall_fountain_must_be_axis_aligned_and_builds_nothing_otherwise(self):
        errors = self.part("fountain_errors")
        self.assertIn("fountain_bad", errors["diagonal"])
        self.assertEqual(errors["left_over"], [])

    def test_a_module_with_lights_and_water_satisfies_the_contract(self):
        self.assertEqual(self.out["contract"], [])


class SummaryFailureTest(unittest.TestCase):
    """A failing expression must report where it failed: Blender echoes the whole expression after the traceback."""

    @unittest.skipUnless(blender_available(), "Blender not found (set BLENDER_BIN)")
    def test_a_failing_expression_reports_its_traceback_not_the_echo_of_the_expression(self):
        expr = "x = 1\n" + "# a long line that Blender echoes back after the traceback\n" * 60 + "raise ValueError('boom')\n"
        with self.assertRaises(AssertionError) as caught:
            summary(expr)
        message = str(caught.exception)
        self.assertTrue(message.startswith("Traceback"), message)
        self.assertIn("ValueError: boom", message)
        self.assertNotIn("echoes back", message)

    def test_without_a_traceback_the_tail_of_stderr_is_reported(self):
        self.assertEqual(failure_text("a" * 3000 + "end"), "a" * 1997 + "end")


if __name__ == "__main__":
    unittest.main()

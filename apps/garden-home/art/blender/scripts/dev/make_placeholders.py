"""Generate Phase 1 placeholder art that satisfies the module contract (art/README.md, Adding or replacing a module).

Writes blender/modules/yard.blend, blender/site.blend and blender/fixtures/broken_module.blend. Real art replaces the
module files later; keep the contract. site.blend links house.blend, pool.blend, the garden modules, the pond's (the
koi pond and the tea corner, which replaced the placeholder pond) and the carport's (the carport and
the kennel) and the basement under the house too, so build those first (pnpm --filter @ncam/garden-home art:models does). The yard's lawn
has a hole where the koi pond is dug into it (pond/koi_layout.py OUTLINE at its slot) and one for the basement's pit
(basement/basement_layout.py PIT: the house's plinth and the light well in front of it).
Existing files are kept unless --force is given.
The trees, lamp, module slots and cameras come from siteplan/zones.py (art/README.md, Glass villa); the yard is a floating island
(zones.ISLAND: a flat grass top at z 0 over a faceted rock underside) whose bounding size --yard-size can change. The
generator refuses to run when siteplan/zones_check.py finds the plan inconsistent (on the island that is built, too).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/dev/make_placeholders.py -- --root blender [--yard-size 54 46] [--force] [--only yard site]
"""
import argparse
import array
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit.scene import should_write  # noqa: E402  (the shared never-overwrite-without---force guard)
from siteplan import island as island_shape  # noqa: E402
from siteplan import rim as rim_dressing  # noqa: E402  (the tufts and rocks along the rim, clear of the fence)
from siteplan import zones, zones_check  # noqa: E402  (not called `site`: the standard library owns that name)
from basement import basement_layout  # noqa: E402  (the basement's pit: the yard's lawn has a hole there too)
from pond import koi_layout  # noqa: E402  (the pond's outline: the yard's lawn has a hole there)

PARTS = ("yard", "site", "broken")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--yard-size", nargs=2, type=float, default=zones.ISLAND["size"], metavar=("W", "D"),
                        help="bounding size of the floating island (the yard module's footprint)")
    parser.add_argument("--force", action="store_true", help="overwrite existing files")
    parser.add_argument("--only", nargs="+", choices=PARTS, default=list(PARTS), help="generate just these files")
    return parser.parse_args(argv)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def save(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def new_collection(name, footprint=None, role=None):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    if footprint is not None:
        col["footprint"] = footprint
    if role is not None:
        col["role"] = role
    return col


def material(name, color, emission=None, strength=0.0, image=None):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if image is not None:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def mesh_object(name, col, build, mat, location=(0.0, 0.0, 0.0), data=None):
    """New object; pass `data` to share an existing mesh (linked duplicate)."""
    if data is None:
        data = bpy.data.meshes.new(name)
        bm = bmesh.new()
        build(bm)
        bm.to_mesh(data)
        bm.free()
        data.materials.append(mat)
    ob = bpy.data.objects.new(name, data)
    ob.location = location
    col.objects.link(ob)
    return ob


def empty(name, col, location, **props):
    ob = bpy.data.objects.new(name, None)
    ob.location = location
    for key, value in props.items():
        ob[key] = value
    col.objects.link(ob)
    return ob


def cylinder(radius, depth, z, segments=16, sx=1.0, sy=1.0):
    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
        bmesh.ops.scale(bm, vec=(sx, sy, 1.0), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0.0, 0.0, z), verts=bm.verts)
    return build


def sphere(radius, z, subdivisions=2):
    def build(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
        bmesh.ops.translate(bm, vec=(0.0, 0.0, z), verts=bm.verts)
    return build


def paint_wind(ob, z0, z1):
    """Wind weight in the R channel of color attribute 'wind': 0 at z0, 1 at z1."""
    attr = ob.data.color_attributes.new(name="wind", type="FLOAT_COLOR", domain="POINT")
    for i, vert in enumerate(ob.data.vertices):
        weight = min(1.0, max(0.0, (vert.co.z - z0) / (z1 - z0)))
        attr.data[i].color = (weight, 0.0, 0.0, 1.0)


def ground_texture(size=1024):
    rnd = random.Random(7)
    img = bpy.data.images.new("T_ground", size, size)
    px = array.array("f")
    for _ in range(size * size):
        n = rnd.random() * 0.12
        px.extend((0.28 + n, 0.45 + n, 0.20 + n * 0.5, 1.0))
    img.pixels.foreach_set(px)
    img.pack()
    return img


# The floating island under the yard (zones.ISLAND, siteplan/island.py). Heights in metres below the flat top (z 0);
# scales are shares of the rim's superellipse radius in each direction.
LIP = 0.55  # the grass lip: a vertical green band under the rim
LEDGE = (0.965, 0.65)  # the soil starts a little inside and below the lip, so the grass reads as overhanging
SOIL = (0.94, 2.8)  # bottom of the soil band, where the rock begins
SOIL_WOBBLE = 0.4  # metres up or down of the soil / rock boundary
# Rock rings from the soil down to the tip: vertex counts (fewer and fewer facets towards the tip). Every other ring is
# turned half a facet so the bands zig-zag; each vertex is pushed in or out by up to ROCK_JITTER of its radius and up or
# down by up to ROCK_RISE metres. The profile rock_scale(t) keeps a full shoulder under the soil (so a low camera sees a
# tall rock wall below the rim) and then tapers to a sharp tip.
ROCK_RINGS = (44, 38, 32, 26, 20, 16, 12, 8)
ROCK_JITTER = 0.13
ROCK_RISE = 0.6
ROCK_SHOULDER = 1.5
ROCK_TAPER = 1.2
TIP_DRIFT = 3.0  # metres: the tip hangs off-centre, so the underside is not a turned cone
CHUNKS = 5  # rocks hanging from the island's shoulder
ROOTS = 10  # roots dangling out of the soil band
# Rock shades: below the earthy soil band the rock is M_rock, turning to M_rock_dark between DARK_FROM and DARK_TO of
# the way down to the tip (a face goes dark with the smoothstep's chance), with a share of lighter facets in between.
DARK_FROM, DARK_TO = 0.3, 0.7
LIGHT_SHARE = 0.12
# Material slots of Island_rock.
LIP_MAT, SOIL_MAT, ROCK_MAT, ROOT_MAT, DARK_MAT, LIGHT_MAT = range(6)


def rock_scale(t):
    """Share of the rim radius the rock reaches at `t` of the way from the soil band (0) down to the tip (1)."""
    return SOIL[0] * (1 - t ** ROCK_SHOULDER) ** ROCK_TAPER


def ring(rnd, island, scale, z, count, turn=0.0, jitter=0.0, rise=0.0, centre=(0.0, 0.0), cap=None):
    """`count` (angle, (x, y, z)) points of the island's superellipse at `scale` around `centre`, height z; `turn` is a
    share of one facet; `cap` limits the scale after the jitter (the rock never pokes out past the soil band)."""
    points = []
    for k in range(count):
        angle = 2 * math.pi * (k + turn) / count
        radius = island_shape.superellipse_radius(angle, island["size"], island["exponent"])
        s = scale * (1 + jitter * (2 * rnd.random() - 1))
        s = min(s, cap) if cap is not None else s
        points.append((angle, (centre[0] + radius * s * math.cos(angle), centre[1] + radius * s * math.sin(angle),
                               z + rise * (2 * rnd.random() - 1))))
    return points


def blob(rnd, centre, radius, z, count, jitter):
    """A small horizontal ring of `count` (angle, (x, y, z)) points around `centre` (chunks and roots)."""
    turn = rnd.random()
    points = []
    for k in range(count):
        angle = 2 * math.pi * (k + turn) / count
        r = radius * (1 + jitter * (2 * rnd.random() - 1))
        points.append((angle % (2 * math.pi), (centre[0] + r * math.cos(angle), centre[1] + r * math.sin(angle), z)))
    return sorted(points)


def stitch(bm, upper, lower, material_index):
    """Closes the band between two closed rings of (angle, vert), angles rising from about 0 (the lower ring may also be
    a single tip vertex): one triangle per step, advancing whichever ring's next vertex comes first, so rings of any
    vertex counts and turns meet without gaps. Faces wind counter-clockwise seen from outside and below."""
    def angle(ring_, k):  # unwrapped: one past the last vertex is the first one again, a turn later
        return ring_[k % len(ring_)][0] + 2 * math.pi * (k // len(ring_))

    nu, nl = len(upper), len(lower)
    i = j = 0
    while i < nu or (j < nl and nl > 1):
        if j >= nl or nl == 1 or (i < nu and angle(upper, i + 1) <= angle(lower, j + 1)):
            verts = (upper[i % nu][1], lower[j % nl][1], upper[(i + 1) % nu][1])
            i += 1
        else:
            verts = (upper[i % nu][1], lower[j % nl][1], lower[(j + 1) % nl][1])
            j += 1
        bm.faces.new(verts).material_index = material_index


def cap(bm, apex, ring_, material_index):
    """Closes a ring of (angle, vert) from above with a fan to the `apex` vert (faces wind counter-clockwise from above)."""
    for (_, a), (_, b) in zip(ring_, ring_[1:] + ring_[:1]):
        bm.faces.new((apex, a, b)).material_index = material_index


def island_rock(bm, island):
    """Grass lip, soil band and the faceted rock underside below the rim, then hanging chunks and roots. Material slots:
    LIP_MAT .. LIGHT_MAT (shade_rock picks the rock shades). Every face is a flat-shaded triangle."""
    rnd = random.Random(island["seed"] + 1)  # the rim itself uses the seed (island.outline)
    rim_count = island["rim"]

    def verts(points):
        return [(angle, bm.verts.new(co)) for angle, co in points]

    rim = island_shape.outline(island)
    angles = [2 * math.pi * k / rim_count for k in range(rim_count)]
    top = verts([(a, (x, y, 0.0)) for a, (x, y) in zip(angles, rim)])
    lip = verts([(a, (x, y, -LIP)) for a, (x, y) in zip(angles, rim)])
    ledge = verts(ring(rnd, island, LEDGE[0], -LEDGE[1], rim_count))
    soil = verts(ring(rnd, island, SOIL[0], -SOIL[1], rim_count, rise=SOIL_WOBBLE))
    stitch(bm, top, lip, LIP_MAT)
    stitch(bm, lip, ledge, SOIL_MAT)
    stitch(bm, ledge, soil, SOIL_MAT)

    depth = island["depth"]
    tip_angle = rnd.random() * 2 * math.pi
    tip = (TIP_DRIFT * math.cos(tip_angle), TIP_DRIFT * math.sin(tip_angle))
    upper = soil
    for k, count in enumerate(ROCK_RINGS):
        t = (k + 1) / (len(ROCK_RINGS) + 1)
        z = -SOIL[1] - (depth - SOIL[1]) * t
        lower = verts(ring(rnd, island, rock_scale(t), z, count, turn=0.5 * (k % 2), jitter=ROCK_JITTER, rise=ROCK_RISE,
                           centre=(tip[0] * t, tip[1] * t), cap=SOIL[0]))
        stitch(bm, upper, lower, ROCK_MAT)
        upper = lower
    stitch(bm, upper, [(0.0, bm.verts.new((tip[0], tip[1], -depth)))], ROCK_MAT)

    # Chunks: faceted rocks half sunk into the rock's shoulder, hanging free below it as the underside recedes.
    for k in range(CHUNKS):
        angle = 2 * math.pi * (k + 0.6 * rnd.random()) / CHUNKS
        z = -3.6 - 3.0 * rnd.random()
        t = (-z - SOIL[1]) / (depth - SOIL[1])
        radius = island_shape.superellipse_radius(angle, island["size"], island["exponent"])
        size, length = 1.2 + 0.5 * rnd.random(), 3.0 + 2.0 * rnd.random()
        reach = radius * rock_scale(t) - 0.5 * size  # about two thirds of it pokes out
        out = (math.cos(angle), math.sin(angle))
        centre = (reach * out[0], reach * out[1])
        top_ring = verts(blob(rnd, centre, size, z, 6, 0.25))
        cap(bm, bm.verts.new((centre[0] - out[0], centre[1] - out[1], z + 0.6)), top_ring, ROCK_MAT)
        mid = (centre[0] - 0.3 * out[0], centre[1] - 0.3 * out[1])
        mid_ring = verts(blob(rnd, mid, size * 0.6, z - length * 0.5, 5, 0.25))
        stitch(bm, top_ring, mid_ring, ROCK_MAT)
        stitch(bm, mid_ring, [(0.0, bm.verts.new((mid[0] - 0.3 * out[0], mid[1] - 0.3 * out[1], z - length)))],
               ROCK_MAT)

    # Roots: thin square tubes out of the soil band, swaying a little as they hang.
    for k in range(ROOTS):
        angle = 2 * math.pi * (k + 0.5 + 0.4 * (rnd.random() - 0.5)) / ROOTS
        radius = island_shape.superellipse_radius(angle, island["size"], island["exponent"])
        out = (math.cos(angle), math.sin(angle))
        sway = rnd.random() - 0.5
        length = 2.0 + 2.0 * rnd.random()
        path = [(0.95, -0.8, 0.0), (0.965, -0.8 - length * 0.4, sway), (0.955, -0.8 - length * 0.75, -sway)]
        rings = []
        for (s, z, side), thickness in zip(path, (0.16, 0.12, 0.07)):
            x = radius * s * out[0] - side * out[1]
            y = radius * s * out[1] + side * out[0]
            rings.append(verts(blob(rnd, (x, y), thickness, z, 4, 0.0)))
        stitch(bm, rings[0], rings[1], ROOT_MAT)
        stitch(bm, rings[1], rings[2], ROOT_MAT)
        end = (radius * 0.945 * out[0], radius * 0.945 * out[1], -0.8 - length)
        stitch(bm, rings[2], [(0.0, bm.verts.new(end))], ROOT_MAT)
    shade_rock(bm, island)


def shade_rock(bm, island):
    """Darkens the rock towards the tip and lightens a few facets: reassigns the ROCK_MAT faces by their depth."""
    rnd = random.Random(island["seed"] + 2)  # its own stream: shading never moves a vertex
    depth = island["depth"]
    for face in bm.faces:
        if face.material_index != ROCK_MAT:
            continue
        t = (-face.calc_center_median().z - SOIL[1]) / (depth - SOIL[1])
        x = min(1.0, max(0.0, (t - DARK_FROM) / (DARK_TO - DARK_FROM)))
        if rnd.random() < x * x * (3 - 2 * x):
            face.material_index = DARK_MAT
        elif rnd.random() < LIGHT_SHARE:
            face.material_index = LIGHT_MAT


def rim_tufts(bm, island):
    """Grass tufts (material slot 0) in the strip between the garden's fence and the rim and small half-buried rocks
    (slot 1) clear inside the fence, where siteplan/rim.py places them."""
    rnd = random.Random(island["seed"] + 4)  # their shapes' own stream: rim.py places them from streams of its own

    def verts(points):
        return [(angle, bm.verts.new(co)) for angle, co in points]

    for x, y, radius, height, (lean_x, lean_y) in rim_dressing.tufts(island):  # a blade: a cone of three faces
        apex = bm.verts.new((x + lean_x, y + lean_y, height))
        cap(bm, apex, verts(blob(rnd, (x, y), radius, -0.05, 3, 0.0)), 0)
    for x, y, size in rim_dressing.rocks(island):  # its base spreads to 1.15 x 1.2 = 1.38 sizes (rim.ROCK_SPREAD)
        crown = verts(blob(rnd, (x, y), size, 0.05 + 0.1 * rnd.random(), 5, 0.3))
        cap(bm, bm.verts.new((x, y, size * 0.8)), crown, 1)
        stitch(bm, crown, verts(blob(rnd, (x, y), size * 1.15, -0.2, 5, 0.2)), 1)


def ground_holes():
    """The holes in the lawn, in site space: the outline of the koi pond (pond/koi_layout.py) where its slot stands, so
    the pond dug into the lawn shows; the pond's own bank tucks under the lawn round its hole. And the basement's pit
    (basement/basement_layout.py PIT) where its slot stands: the house's plinth fills the part under the house, so the
    lawn does not hide the basement once the website cuts the house down to it, and the light well's walls line the
    rest."""
    outlines = {koi_layout.MODULE_ID: koi_layout.OUTLINE, basement_layout.MODULE_ID: basement_layout.PIT}
    holes = []
    for _, spec in sorted(zones.SLOTS.items()):
        if spec["module"] in outlines:
            (sx, sy), yaw = spec["pos"], math.radians(spec["yaw"])
            c, s = math.cos(yaw), math.sin(yaw)
            holes.append([(sx + c * x - s * y, sy + s * x + c * y) for x, y in outlines[spec["module"]]])
    return holes


def build_yard(root, island):
    """The yard: a floating island (flat grass top `Ground` at z 0, `Island_rock` below it, `Rim_tufts` along the rim),
    trees and the lamp."""
    reset()
    width, depth = island["size"]
    col = new_collection("yard", footprint=[width, depth], role="prop")
    m_ground = material("M_ground", (0.3, 0.45, 0.2), image=ground_texture())
    m_trunk = material("M_trunk", (0.35, 0.22, 0.12))
    m_leaf = material("M_leaf", (0.25, 0.55, 0.22))
    m_post = material("M_post", (0.15, 0.15, 0.17))
    m_bulb = material("M_bulb", (1.0, 0.85, 0.6), emission=(1.0, 0.75, 0.4), strength=4.0)
    # Linear colours close to the ground texture's grass (sRGB ~0.34, 0.51, 0.23) and an earthy soil, rock and root.
    m_lip = material("M_grass_lip", (0.07, 0.16, 0.03))
    m_soil = material("M_soil", (0.16, 0.075, 0.03))
    m_rock = material("M_rock", (0.26, 0.21, 0.17))
    m_rock_dark = material("M_rock_dark", (0.10, 0.085, 0.075))
    m_rock_light = material("M_rock_light", (0.45, 0.39, 0.32))
    m_root = material("M_root", (0.10, 0.047, 0.02))

    def ground(bm):
        uv = bm.loops.layers.uv.new("UVMap")
        rim = [bm.verts.new((x, y, 0.0)) for x, y in island_shape.outline(island)]
        holes = [[bm.verts.new((x, y, 0.0)) for x, y in hole] for hole in ground_holes()]
        if holes:  # the lawn round the holes, in triangles facing up
            edges = [bm.edges.new((a, b)) for ring in [rim] + holes for a, b in zip(ring, ring[1:] + ring[:1])]
            bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=(0.0, 0.0, 1.0))
        else:
            bm.faces.new(rim)
        for face in bm.faces:
            for loop in face.loops:
                co = loop.vert.co
                loop[uv].uv = (co.x / 5.0, co.y / 5.0)  # one texture repeat every 5 m

    mesh_object("Ground", col, ground, m_ground)
    rock = mesh_object("Island_rock", col, lambda bm: island_rock(bm, island), m_lip)
    for mat in (m_soil, m_rock, m_root, m_rock_dark, m_rock_light):  # LIP_MAT .. LIGHT_MAT
        rock.data.materials.append(mat)
    tufts = mesh_object("Rim_tufts", col, lambda bm: rim_tufts(bm, island), m_leaf)
    tufts.data.materials.append(m_rock)
    tufts["cast_shadow"] = False  # blades and pebbles: the website leaves them out of the shadow pass
    trunk = canopy = None
    for i, (x, y) in enumerate(zones.TREES):
        trunk = mesh_object(f"Tree_trunk_{i}", col, cylinder(0.15, 1.6, 0.8, segments=8), m_trunk,
                            (x, y, 0.0), data=trunk.data if trunk else None)
        canopy = mesh_object(f"Tree_canopy_{i}", col, sphere(1.2, 2.4), m_leaf,
                             (x, y, 0.0), data=canopy.data if canopy else None)
        if i == 0:
            paint_wind(canopy, 1.4, 3.6)
    mesh_object("Lamp_post", col, cylinder(0.06, 2.2, 1.1, segments=8), m_post, (*zones.LAMP, 0.0))
    bulb = mesh_object("Lamp_bulb", col, sphere(0.18, 2.3, subdivisions=1), m_bulb, (*zones.LAMP, 0.0))
    bulb["night_light"] = True
    save(os.path.join(root, "modules", "yard.blend"))


def place(root, module_id, name, location, yaw_deg):
    lib_path = os.path.join(root, "modules", module_id + ".blend")
    with bpy.data.libraries.load(lib_path, link=True, relative=True) as (_src, dst):
        dst.collections = [module_id]
    ob = bpy.data.objects.new(name, None)
    ob.instance_type = "COLLECTION"
    ob.instance_collection = dst.collections[0]
    ob.location = location
    ob.rotation_euler = (0.0, 0.0, math.radians(yaw_deg))
    bpy.context.scene.collection.objects.link(ob)


def camera(name, location, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_fit = "VERTICAL"
    ob = bpy.data.objects.new(name, data)
    ob.location = location
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y")
    bpy.context.scene.collection.objects.link(ob)


def build_site(root):
    reset()
    path = os.path.join(root, "site.blend")
    save(path)  # save first so "//" exists and library paths stay relative
    scene = bpy.context.scene
    scene["sunrise"] = "06:00"
    scene["sunset"] = "18:00"
    place(root, "yard", "yard_01", (0.0, 0.0, 0.0), 0.0)  # the yard needs no slot of its own: it sits at the origin
    for slot, spec in sorted(zones.SLOTS.items()):
        place(root, spec["module"], slot, (*spec["pos"], 0.0), spec["yaw"])
    for name, cam in sorted(zones.CAMERAS.items()):
        camera(name, cam["pos"], cam["target"], lens=cam["lens"])
    save(path)


def build_broken(root):
    """Violates six rules on purpose; tests assert the validator reports each one."""
    reset()
    col = new_collection("broken_module", role="giant")  # no footprint, unknown role
    mat = material("M_broken", (0.8, 0.1, 0.1))
    box = mesh_object("Box", col, cylinder(0.5, 1.0, 0.5), mat)
    box.scale = (2.0, 2.0, 2.0)
    twin = mesh_object("Twin", col, sphere(0.5, 1.0), mat, (2.0, 0.0, 0.0))
    twin.data.color_attributes.new(name="wind", type="FLOAT_COLOR", domain="POINT")
    twin.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    mover = mesh_object("Mover", col, sphere(0.2, 0.5), mat, (-2.0, 0.0, 0.0))
    mover.keyframe_insert("location", frame=1)
    mover.location.x = -1.0
    mover.keyframe_insert("location", frame=20)
    mover.animation_data.action.name = "swim"
    empty("HS_bad", col, (0.0, 0.0, 1.5), action="jump")
    save(os.path.join(root, "fixtures", "broken_module.blend"))


def main():
    args = parse_args()
    island = dict(zones.ISLAND, size=tuple(args.yard_size))
    problems = zones_check.check(zones, island=island)  # the island that is built, not just zones.ISLAND
    for problem in problems:
        print(f"ZONES: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    root = os.path.abspath(args.root)
    builders = (
        ("yard", os.path.join(root, "modules", "yard.blend"), lambda: build_yard(root, island)),
        ("site", os.path.join(root, "site.blend"), lambda: build_site(root)),
        ("broken", os.path.join(root, "fixtures", "broken_module.blend"), lambda: build_broken(root)),
    )
    for part, path, build in builders:
        if part in args.only and should_write(path, args.force):
            build()
            print(f"placeholders: wrote {os.path.relpath(path, root)}")


main()

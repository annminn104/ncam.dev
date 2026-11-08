"""blender --background --factory-startup --python export.py -- --out <file.glb>

Builds the web scene of the model CDP_MODEL names (build_player.py, build_clear.py or
build_deck.py) into the startup scene, turns curves and text into meshes, gives the tiled and
printed materials UVs, and writes a GLB. art/pipeline/build.mjs runs it.
"""
import os
import sys

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[ARGS.index("--out") + 1]

MODEL = os.environ.get("CDP_MODEL", "suitcase")
SCRIPTS = {"suitcase": ("cdkit.py", "parts.py", "build_player.py"),
           "clear": ("cdkit.py", "parts.py", "clear.py", "clear_board.py", "clear_decor.py", "build_clear.py"),
           "deck": ("cdkit.py", "parts.py", "deck.py", "deck_case.py", "build_deck.py")}
if MODEL not in SCRIPTS:
    raise SystemExit("export.py: CDP_MODEL must be suitcase, clear or deck, not %r" % MODEL)
for _file in SCRIPTS[MODEL]:
    exec(compile(open(os.path.join(HERE, _file)).read(), _file, "exec"), globals())
WEB = True  # cdkit's functions read it at call time

# Box-mapped at TILE_M per UV unit: the page tiles its grain, quilt and weave maps over these.
TILED = {"leather", "trim", "lining", "fabric", "strap", "deck", "grille"}
# Planar over the mesh's own XY bounds: the canvas the page paints covers each print exactly.
PLANAR = {"art_disc", "art_booklet", "card_print", "tag_print", "lcd_screen"}
TILE_M = 0.05


def to_mesh(ob, depsgraph):
    """Replace a curve or text object by a mesh object of the same name, parent and transform."""
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph), depsgraph=depsgraph)
    new = bpy.data.objects.new(ob.name + "__mesh", me)
    for coll in ob.users_collection:
        coll.objects.link(new)
    new.parent = ob.parent
    new.matrix_parent_inverse = ob.matrix_parent_inverse.copy()
    new.matrix_basis = ob.matrix_basis.copy()
    for child in ob.children:
        child.parent = new  # same world matrix as ob, and the child keeps its parent inverse
    name = ob.name
    bpy.data.objects.remove(ob, do_unlink=True)
    new.name = name


def box_uv(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for loop in face.loops:
            loop[uv].uv = (loop.vert.co[a] / TILE_M, loop.vert.co[b] / TILE_M)
    bm.to_mesh(me)
    bm.free()


def planar_uv(me):
    """Local XY over the mesh's bounds: the canvas the page paints covers the print exactly."""
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    x0, y0 = min(xs), min(ys)
    w, h = max(max(xs) - x0, 1e-9), max(max(ys) - y0, 1e-9)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            loop[uv].uv = ((loop.vert.co.x - x0) / w, (loop.vert.co.y - y0) / h)
    bm.to_mesh(me)
    bm.free()


def main():
    sc = use_scene(bpy.context.scene)
    count = build()
    for ob in [o for o in sc.collection.all_objects if o.type in {"CURVE", "FONT"}]:
        # A fresh evaluation each time: the previous conversion removed an object from the scene.
        to_mesh(ob, bpy.context.evaluated_depsgraph_get())
    for ob in sc.collection.all_objects:
        if ob.type != "MESH":
            continue
        names = {m.name for m in ob.data.materials if m}
        if names & PLANAR:
            planar_uv(ob.data)
        elif names & TILED:
            box_uv(ob.data)
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, export_texcoords=True,
        export_normals=True, export_materials="EXPORT", export_cameras=False, export_lights=False,
        export_animations=False, export_extras=False,
    )
    print("export.py: %d objects -> %s" % (count, OUT))


main()

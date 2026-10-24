# Builds a preset's figures and writes one raw GLB per piece type and LOD, for
# scripts/build-figures.mjs to pack. Headless, from apps/chess:
#   blender --background --factory-startup --python-exit-code 1 \
#     --python art/blender/export.py -- <preset> <outDir> [types]
#   ... -- <preset> <outDir> [types] --sheet   instead renders each piece's review sheet
# A piece is its parts joined into one mesh with three point attributes: _SLOT (its palette slot,
# an index into kit.SLOTS), _LINE (the outline width its part was dressed with; 0 for decals and
# painted lines) and _KEEP (1 on the face decals, which the pack step never simplifies). No
# materials, colours or UVs: the game colours by slot and draws the outline itself.
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))

# Per preset and piece type: the scripts run after kit.py, in order, and the function that builds
# the piece. A chain entry is a script of the preset's own folder, or '<preset>/<script>' to borrow
# another set's (read-only: that set's GLBs never change for it).
PRESETS = {
    'holy-order': {
        'k': (('patriarch',), 'build'),
        'q': (('patriarch', 'abbess'), 'build_q'),
        'b': (('patriarch', 'bishop'), 'build_b'),
        'r': (('patriarch', 'warden'), 'build_r'),
        'n': (('patriarch', 'warden', 'paladin'), 'build_n'),
        'p': (('patriarch', 'abbess', 'acolyte'), 'build_p'),
    },
    'dark-court': {
        'k': (('holy-order/patriarch', 'court', 'overlord'), 'build_k'),
        'q': (('holy-order/patriarch', 'holy-order/abbess', 'court', 'queen'), 'build_q'),
        'r': (('holy-order/patriarch', 'holy-order/warden', 'court', 'deathknight'), 'build_r'),
    },
}
# Parts the low LOD leaves out (by name, after the prefix): the painted linework, which would
# only shimmer at that size.
LINEWORK = ('Lines', 'GoldScrolls')
# Parts the simplifier must leave whole: a chibi's charm is in its face.
FACE = {'Face', 'Brows', 'HorseEyes'}
# What a part keeps: its points, its slot and what its shading normals are made from.
KEEP_ATTRIBUTES = {'position', '_SLOT', 'sharp_edge', 'sharp_face', 'custom_normal'}


def run_script(path, ns):
    with open(path, encoding='utf-8') as f:
        exec(compile(f.read(), path, 'exec'), ns)


def build_piece(preset, chain, fn):
    """Empties the file, builds one piece and returns the scripts' namespace and the piece's parts
    (the X_ helpers left out)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ns = {'__name__': 'figure'}
    run_script(os.path.join(HERE, 'kit.py'), ns)
    for name in chain:
        rel = name if '/' in name else f'{preset}/{name}'
        run_script(os.path.join(HERE, rel + '.py'), ns)
    ns['build_materials']()
    ns[fn]()
    coll = bpy.data.collections[ns['COLL']]
    return ns, [ob for ob in coll.objects if ob.type == 'MESH' and not ob.name.startswith('X_')]


def part_name(ob):
    return ob.name.split('_', 1)[-1]


def bake(ob):
    """Folds the part's outline width and face flag into attributes; strips what the game skips."""
    me = ob.data
    md = ob.modifiers.get('Outline')
    width = md.thickness if md is not None else 0.0
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    me.transform(ob.matrix_world)
    ob.matrix_world = Matrix.Identity(4)
    for name in [a.name for a in me.attributes]:
        if name not in KEEP_ATTRIBUTES and not name.startswith('.'):
            me.attributes.remove(me.attributes[name])
    for uv in list(me.uv_layers):
        me.uv_layers.remove(uv)
    me.materials.clear()
    if '_SLOT' not in me.attributes:
        raise RuntimeError(f'{ob.name} has no _SLOT')
    count = len(me.vertices)
    me.attributes.new('_LINE', 'FLOAT', 'POINT').data.foreach_set('value', [width] * count)
    face = 1.0 if part_name(ob) in FACE else 0.0
    me.attributes.new('_KEEP', 'FLOAT', 'POINT').data.foreach_set('value', [face] * count)


def join(parts, name):
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts):
        bpy.ops.object.join()
    ob = parts[0]
    ob.name = name
    ob.data.name = name
    return ob


def export(ob, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=False,
        export_attributes=True, export_normals=True, export_texcoords=False, export_tangents=False,
        export_materials='NONE', export_vertex_color='NONE', export_all_vertex_colors=False,
        export_yup=True, export_extras=False, export_animations=False, export_skins=False,
        export_morph=False, export_cameras=False, export_lights=False)


def make_sheet(ns, parts, preset, t, out_dir):
    """The piece's review sheet, as Holy Order's were made: white and black from the front (top row)
    and the back (bottom row), with a face close-up and the piece at game size. The cameras aim at
    about half the piece's top (measured as the export's size print does), so a pawn is framed as
    well as a king."""
    ns['scene_setup']()
    preview = ns.get('PREVIEW') or {'w': (ns['PAL_W'], ns['GOLD_STOPS']),
                                    'b': (ns['PAL_B'], ns['GOLD_STOPS'])}
    corners = [o.matrix_world @ Vector(c) for o in parts if part_name(o) == 'Face' for c in o.bound_box]
    face = sum(corners, Vector()) / len(corners) if corners else Vector((0, 0, 1.0))
    top = max((o.matrix_world @ v.co).z for o in parts for v in o.data.vertices)
    # The game view looks down from 42 degrees, so it aims a little lower than the others.
    aim, aim_game = (0, 0, 0.52 * top), (0, 0, 0.465 * top)
    shot = {}

    def take(key, *args, **kw):
        shot[key] = os.path.join(out_dir, f'{t}-{key}.png')
        ns['shoot'](shot[key], *args, **kw)

    for side in ('w', 'b'):
        pal, metal = preview[side]
        ns['recolor'](pal, pal['ink'])
        ns['set_metal'](metal)
        take(f'{side}-front', 24, 12, tgt=aim)
        take(f'{side}-back', 150, 14, tgt=aim)
        if side == 'w':
            take('face', 16, 6, dist=1.55, tgt=tuple(face))
            take('game', 18, 42, dist=4.6, tgt=aim_game)
    out = os.path.join(out_dir, f'{t}-sheet.png')
    ns['contact_sheet']([shot['w-front'], shot['b-front'], shot['face']],
                        [shot['w-back'], shot['b-back'], shot['game']], out)
    print(f'sheet: {preset} {t} -> {out}', flush=True)


def main():
    if bpy.app.version[:2] != (5, 2):
        raise RuntimeError(f'export.py needs Blender 5.2, not {bpy.app.version_string}')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    sheet = '--sheet' in argv
    argv = [a for a in argv if a != '--sheet']
    if len(argv) < 2 or argv[0] not in PRESETS:
        raise RuntimeError('usage: blender --background --python export.py -- <preset> <outDir> [types] [--sheet]')
    preset, out_dir = argv[0], argv[1]
    types = argv[2] if len(argv) > 2 else ''.join(PRESETS[preset])
    os.makedirs(out_dir, exist_ok=True)
    for t in types:
        chain, fn = PRESETS[preset][t]
        if sheet:
            ns, parts = build_piece(preset, chain, fn)
            make_sheet(ns, parts, preset, t, out_dir)
            continue
        for lod in ('high', 'low'):
            ns, parts = build_piece(preset, chain, fn)
            if lod == 'low':
                for ob in [o for o in parts if any(w in part_name(o) for w in LINEWORK)]:
                    parts.remove(ob)
                    bpy.data.objects.remove(ob, do_unlink=True)
            for ob in parts:
                bake(ob)
            ob = join(parts, f'{preset}-{t}')
            path = os.path.join(out_dir, f'{t}-low.glb' if lod == 'low' else f'{t}.glb')
            export(ob, path)
            tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
            top = max(v.co.z for v in ob.data.vertices)
            reach = max(math.hypot(v.co.x, v.co.y) for v in ob.data.vertices)
            print(f'export: {preset} {t} {lod}: {tris} triangles, top {top:.3f}, reach {reach:.3f} -> {path}',
                  flush=True)


main()

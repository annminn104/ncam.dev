"""Scene plumbing for the generator scripts: arguments, the overwrite guard, an empty scene, the module collection,
markers and saving."""
import argparse
import os
import sys

import bpy


def generator_args(description, default_out):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--out", default=default_out)
    parser.add_argument("--force", action="store_true", help="overwrite an existing .blend")
    return parser.parse_args(argv)


def should_write(path, force):
    """False (with a message) when `path` exists and --force was not given: a hand-tuned .blend is the source of truth."""
    if os.path.exists(path) and not force:
        print(f"skip: {path} exists (use --force to regenerate)")
        return False
    return True


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def module_collection(module_id, footprint, role):
    col = bpy.data.collections.new(module_id)
    bpy.context.scene.collection.children.link(col)
    col["footprint"] = [float(v) for v in footprint]
    col["role"] = role
    return col


def marker(col, name, location, **props):
    """Empty with custom properties (hotspots: spec §6.5)."""
    ob = bpy.data.objects.new(name, None)
    ob.location = location
    for key, value in props.items():
        ob[key] = value
    col.objects.link(ob)
    return ob


def save(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    # palette() makes every material and texture; an unused material would still keep its image alive in the file.
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.scene.frame_set(1)  # animated parts (the sliding door) rest at their first key
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(path), compress=True)

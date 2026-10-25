"""Validate one module .blend against the contract, then export <id>.raw.glb + <id>.meta.json.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 blender/modules/koi_pond.blend \
    -P blender/scripts/export_module.py -- --out-dir blender/out [--check]

Every contract line goes to stderr as "CONTRACT <id>: <rule>: <detail>" (or "CONTRACT <id>: ok").
Exit code 1 when any rule fails.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import contract  # noqa: E402
import facts as module_facts  # noqa: E402


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir")
    parser.add_argument("--check", action="store_true", help="validate only, write nothing")
    args = parser.parse_args(argv)
    if not args.check and not args.out_dir:
        parser.error("--out-dir is required unless --check")
    return args


def main():
    args = parse_args()
    module_id = os.path.splitext(os.path.basename(bpy.data.filepath))[0]
    facts = module_facts.collect(module_id)
    errors = contract.validate(facts)
    for error in errors:
        print(f"CONTRACT {module_id}: {error}", file=sys.stderr)
    if errors:
        sys.exit(1)
    print(f"CONTRACT {module_id}: ok", file=sys.stderr)
    if args.check:
        return

    os.makedirs(args.out_dir, exist_ok=True)
    view_layer = bpy.context.view_layer
    view_layer.active_layer_collection = view_layer.layer_collection.children[module_id]
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(args.out_dir, f"{module_id}.raw.glb"),
        export_format="GLB",
        use_active_collection=True,
        use_active_collection_with_nested=True,
        export_extras=True,
        export_apply=True,  # facts.collect budgets the evaluated mesh; ship exactly that
        export_animation_mode="ACTIONS",
        export_vertex_color="NAME",
        export_vertex_color_name="wind",
        export_all_vertex_colors=False,
        export_cameras=False,
        export_lights=True,
        export_import_convert_lighting_mode="RAW",  # light energy reaches three.js unchanged (villa spec §13 V2)
        # Blender 5.2 labels RAW "Raw (Deprecated)"; if a later Blender drops it, rescale the light energies in
        # houses/house_layout.py POINT_LIGHTS.
        export_yup=True,
    )
    meta = {"id": module_id, "footprint": facts["collection"]["footprint"], "role": facts["collection"]["role"]}
    with open(os.path.join(args.out_dir, f"{module_id}.meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


main()

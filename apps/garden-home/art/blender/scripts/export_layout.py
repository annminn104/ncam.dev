"""site.blend -> layout.json in glTF space: Y-up, quaternions [x, y, z, w].

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 blender/site.blend \
    -P blender/scripts/export_layout.py -- --out blender/out/layout.json
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

import layout_rules  # noqa: E402

# Blender is Z-up, glTF is Y-up: (x, y, z) -> (x, z, -y).
TO_GLTF = Matrix.Rotation(-math.pi / 2, 4, "X")
TO_GLTF_INV = TO_GLTF.inverted()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    return parser.parse_args(argv)


def rounded(values):
    return [round(float(v), 6) for v in values]


def pose(matrix):
    loc, rot, scale = matrix.decompose()
    if rot.w < 0:  # q and -q are the same rotation; keep output stable
        rot.negate()
    return {"position": rounded(loc), "rotation": rounded((rot.x, rot.y, rot.z, rot.w)), "scale": rounded(scale)}


def slot_entries():
    slots = []
    for ob in sorted(bpy.data.objects, key=lambda o: o.name):
        if ob.library is None and ob.instance_type == "COLLECTION" and ob.instance_collection is not None:
            # Module geometry is converted to Y-up by the glTF exporter too, so conjugate.
            slots.append({"id": ob.name, "module": ob.instance_collection.name,
                          **pose(TO_GLTF @ ob.matrix_world @ TO_GLTF_INV)})
    return slots


def camera_entry(ob):
    if ob.data.sensor_fit != "VERTICAL":
        sys.exit(f"layout: {ob.name} must use Sensor Fit = Vertical so fov is the vertical angle")
    # A camera looks down its local -Z in both Blender and glTF: convert the world side only.
    p = pose(TO_GLTF @ ob.matrix_world)
    return {"position": p["position"], "rotation": p["rotation"], "fov": round(math.degrees(ob.data.angle_y), 3)}


def main():
    args = parse_args()
    bpy.context.view_layer.update()
    cams = {ob.name: ob for ob in bpy.data.objects
            if ob.library is None and ob.type == "CAMERA" and ob.name.startswith("CAM_")}
    if "CAM_idle" not in cams:
        sys.exit("layout: camera CAM_idle is missing")
    try:
        stop_names = layout_rules.stop_order([name for name in cams if name.startswith(layout_rules.STOP_PREFIX)])
        sky = layout_rules.sky_config(bpy.context.scene)
    except layout_rules.LayoutError as error:
        sys.exit(f"layout: {error}")
    stops = [{"id": name, **camera_entry(cams[name])} for name in stop_names]
    layout = {
        "slots": slot_entries(),
        "camera": {"idle": camera_entry(cams["CAM_idle"]), "stops": stops},
        "sky": sky,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(layout, f, indent=2)
    print(f"LAYOUT {len(layout['slots'])} slots, {len(stops)} stops -> {args.out}", file=sys.stderr)


main()

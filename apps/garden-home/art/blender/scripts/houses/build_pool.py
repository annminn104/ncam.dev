"""Generate blender/modules/pool.blend from houses/pool_layout.py (glass villa spec §5, §8).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/houses/build_pool.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import furniture, lighting, materials, scene, structure  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from houses import layout_check  # noqa: E402
from houses import pool_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "pool.blend")


def build(col, mats):
    for group in L.STRUCTURE:
        structure.solid(col, group["name"], group["boxes"], mats, group["uv_tile"])
    MeshBuilder(L.WATER["name"]).box(L.WATER["min"], L.WATER["max"], mats["water"]).build(col)
    levels = {room["name"]: room["level"] for room in L.ROOMS}
    for kind, name, room, (x, y), rot, *opts in L.FURNITURE:
        furniture.place(col, name, kind, (x, y, L.LEVEL_Z[levels[room]]), rot, mats, **(opts[0] if opts else {}))
    for strip in L.LED_STRIPS:
        lighting.led_strip(col, strip["name"], strip["start"], strip["end"], strip["z"], mats)


def main():
    args = scene.generator_args("Generate the pool module", DEFAULT_OUT)
    problems = layout_check.check(L)
    for problem in problems:
        print(f"LAYOUT pool: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    if not scene.should_write(args.out, args.force):
        return
    scene.reset()
    build(scene.module_collection(L.MODULE_ID, L.FOOTPRINT, L.ROLE), materials.palette())
    scene.save(args.out)
    print(f"pool: wrote {args.out}")


main()

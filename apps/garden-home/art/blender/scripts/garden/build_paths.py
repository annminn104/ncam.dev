"""Generate blender/modules/garden_paths.blend from garden/paths_layout.py (art/README.md, Garden): the travertine slabs of
the walk, the driveway with its kerbs and the pebbles (one object, Paving, which casts no shadow) and the bollards along
both with the pools of light they cast (Garden_lamps, a night light of the click group lights:garden).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/garden/build_paths.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble, shapes  # noqa: E402
from garden import paths_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "garden_paths.blend")


def build(col, mats):
    mb = MeshBuilder("Paving")
    for stone in L.STONES:
        x0, y0, x1, y1 = shapes.bounds(stone)
        mb.box((x0, y0, 0.0), (x1, y1, L.STONE_TOP), mats["stone"], uv_tile=1.2)
    for slab in L.DRIVEWAY_SLABS:  # up the driveway, and its apron at the carport
        mb.slab(slab, 0.0, L.DRIVEWAY_TOP, mats["stone"], uv_tile=1.2)
    for kerb in L.KERBS:
        mb.slab(kerb, 0.0, L.KERB_TOP, mats["pebble"])
    for x, y, radius in L.PEBBLES:
        mb.blob((x, y, radius * 0.15), radius, mats["pebble"], subdivisions=1, squash=0.55)
    mb.build(col, cast_shadow=False)  # 4 to 7 cm high: its shadow is not worth the shadow pass (web prepareModule)
    assemble.pieces(col, L, mats)


assemble.generate(L, build, "Generate the garden paths module", DEFAULT_OUT)

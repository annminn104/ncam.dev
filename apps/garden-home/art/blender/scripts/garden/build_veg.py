"""Generate blender/modules/veg_garden.blend from garden/veg_layout.py (art/README.md, Garden): the raised beds and the tomato
trellis (Veg_beds, swaying, no shadow) on a teak-edged gravel plot with the compost bin, the tool shed, the wheelbarrow and the
watering can (Veg_garden).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/garden/build_veg.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble  # noqa: E402
from garden import veg_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "veg_garden.blend")


def build(col, mats):
    x0, y0, x1, y1 = L.GRAVEL
    thick, high = L.EDGING
    plot = MeshBuilder(L.STILL)
    plot.box((x0, y0, 0.0), (x1, y1, L.GRAVEL_TOP), mats["gravel"], uv_tile=2.0)
    plot.box((x0 - thick, y0 - thick, 0.0), (x1 + thick, y0, high), mats["teak"])
    plot.box((x0 - thick, y1, 0.0), (x1 + thick, y1 + thick, high), mats["teak"])
    plot.box((x0 - thick, y0, 0.0), (x0, y1, high), mats["teak"])
    plot.box((x1, y0, 0.0), (x1 + thick, y1, high), mats["teak"])
    assemble.pieces(col, L, mats, builders={L.STILL: plot})


assemble.generate(L, build, "Generate the vegetable garden module", DEFAULT_OUT)

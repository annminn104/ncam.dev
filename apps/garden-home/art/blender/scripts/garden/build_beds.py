"""Generate blender/modules/flower_beds.blend from garden/beds_layout.py (art/README.md, Garden): the flower beds, pots,
clipped shrubs and palms of the garden, merged into one swaying object (Flower_beds) that casts no shadow.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/garden/build_beds.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from garden import assemble  # noqa: E402
from garden import beds_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "flower_beds.blend")


def build(col, mats):
    assemble.pieces(col, L, mats)


assemble.generate(L, build, "Generate the flower beds module", DEFAULT_OUT)

"""Generate blender/modules/tea_garden.blend from pond/tea_layout.py (art/README.md, Koi pond): the travertine paving and
stepping stones with the granite tea table, its stools and the tea set (Tea_corner), the bonsai (Bonsai, swaying, no
shadow) and the stone lantern with the pool of light it casts (Stone_lantern, a night light of lights:garden).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/pond/build_tea.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble  # noqa: E402
from pond import layout_check  # noqa: E402
from pond import tea_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "tea_garden.blend")


def build(col, mats):
    corner = MeshBuilder(L.STILL)
    paving = L.PAVING
    (x, y), radius, sides = paving["centre"], paving["radius"], paving["sides"]
    ring = [(x + radius * math.cos(2 * math.pi * k / sides), y + radius * math.sin(2 * math.pi * k / sides))
            for k in range(sides)]
    corner.slab(ring, 0.0, paving["top"], mats["stone"], uv_tile=1.2)
    for step in L.STEPS:
        corner.slab(step, 0.0, L.STEP_TOP, mats["stone"], uv_tile=1.2)
    assemble.pieces(col, L, mats, builders={L.STILL: corner})


def problems(layout):
    return layout_check.check_tea(layout) + layout_check.check_tea_site(layout)


assemble.generate(L, build, "Generate the tea corner module", DEFAULT_OUT, check=problems)

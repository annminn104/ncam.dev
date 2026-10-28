"""Generate blender/modules/fence.blend from garden/fence_layout.py (art/README.md, Garden): the travertine posts and teak
boards round the island, the gate pillars and leaves (one object, Fence) and the lanterns on the pillars with the
pools of light they cast inside the gates (Gate_lamps, a night light of the click group lights:garden).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/garden/build_fence.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble  # noqa: E402
from garden import fence_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "fence.blend")


def _along(mb, a, b, z0, z1, depth, mat, offset=0.0):
    """A board from a to b (x, y), `depth` thick, between z0 and z1, moved `offset` metres to the left of a -> b."""
    length = math.dist(a, b)
    yaw = math.atan2(b[1] - a[1], b[0] - a[0])
    x = (a[0] + b[0]) / 2 - math.sin(yaw) * offset
    y = (a[1] + b[1]) / 2 + math.cos(yaw) * offset
    mb.box((x - length / 2, y - depth / 2, z0), (x + length / 2, y + depth / 2, z1), mat, uv_tile=2.0, rot_z=yaw)


def _post(mb, center, size, top, yaw, mats):
    """A travertine post or pillar with a cap CAP high and 2 cm wider all round."""
    x, y = center
    half = size / 2
    mb.box((x - half, y - half, 0.0), (x + half, y + half, top - L.CAP), mats["stone"], uv_tile=2.0, rot_z=yaw)
    half += 0.02
    mb.box((x - half, y - half, top - L.CAP), (x + half, y + half, top), mats["stone"], uv_tile=2.0, rot_z=yaw)


def _leaf(mb, leaf, mats):
    """A closed gate leaf: upright teak slats SLAT_PITCH apart on the gate's line, two rails behind them (inwards)."""
    a, b = leaf["start"], leaf["end"]
    length = math.dist(a, b)
    ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    count = max(2, round((length - L.SLAT) / L.SLAT_PITCH) + 1)
    pitch = (length - L.SLAT) / (count - 1)
    for i in range(count):
        s = L.SLAT / 2 + i * pitch
        start = (a[0] + ux * (s - L.SLAT / 2), a[1] + uy * (s - L.SLAT / 2))
        end = (a[0] + ux * (s + L.SLAT / 2), a[1] + uy * (s + L.SLAT / 2))
        _along(mb, start, end, 0.06, leaf["top"], L.BOARD, mats["teak"])
    for z in (0.2, leaf["top"] - 0.22):
        _along(mb, a, b, z, z + 0.1, 0.03, mats["teak"], offset=L.BOARD / 2 + 0.015)


def build(col, mats):
    mb = MeshBuilder("Fence")
    for pos, yaw in L.POSTS:
        _post(mb, pos, L.POST, L.POST_TOP, yaw, mats)
    for a, b in L.SPANS:
        for z0, z1 in L.BOARDS:
            _along(mb, a, b, z0, z1, L.BOARD, mats["teak"])
    for pillar in L.PILLARS:
        _post(mb, pillar["pos"], L.PILLAR, L.PILLAR_TOP, 0.0, mats)
    for leaf in L.LEAVES:
        _leaf(mb, leaf, mats)
    mb.build(col)
    assemble.pieces(col, L, mats)


assemble.generate(L, build, "Generate the garden fence module", DEFAULT_OUT)

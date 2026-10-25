"""Planters with wind-painted shrubs (spec §6.3: colour attribute 'wind', R channel = sway weight)."""
import random

from .mesh import MeshBuilder


def paint_wind(ob, z0, z1):
    """Wind weight 0 at height z0 rising linearly to 1 at z1 (object at the origin, so local z = module z). With z1 < z0
    it rises downwards instead: a hanging plant that sways most at the tips of its fronds."""
    attr = ob.data.color_attributes.new(name="wind", type="FLOAT_COLOR", domain="POINT")
    for i, vert in enumerate(ob.data.vertices):
        weight = min(1.0, max(0.0, (vert.co.z - z0) / (z1 - z0)))
        attr.data[i].color = (weight, 0.0, 0.0, 1.0)


def planter(col, name, base, size, mats, shrubs=3, seed=5):
    """White box planter of size (w, d, h) standing at base (x, y, z), with soil and `shrubs` bushes on top."""
    rnd = random.Random(seed)
    (cx, cy, z), (w, d, h) = base, size
    mb = MeshBuilder(name)
    mb.box((cx - w / 2, cy - d / 2, z), (cx + w / 2, cy + d / 2, z + h), mats["white"])
    mb.box((cx - w / 2 + 0.05, cy - d / 2 + 0.05, z + h), (cx + w / 2 - 0.05, cy + d / 2 - 0.05, z + h + 0.02),
           mats["soil"])
    for i in range(shrubs):
        x = cx - w / 2 + (i + 0.5) * w / shrubs + rnd.uniform(-0.04, 0.04)
        r = min(w / shrubs, d) * 0.5 + rnd.uniform(0.0, 0.06)
        mb.blob((x, cy, z + h + r * 0.7), r, mats["leaf"], subdivisions=2, squash=0.85)
    ob = mb.build(col)
    paint_wind(ob, z + h, z + h + 1.2)
    return ob

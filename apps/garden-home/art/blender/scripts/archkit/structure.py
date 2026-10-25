"""Structural parts: solid box groups (plinth, walls, slabs, columns), a straight stair and a pergola."""
from .mesh import MeshBuilder


def solid(col, name, boxes, mats, uv_tile=1.0):
    """One object from [(material_key, (x, y, z) min, (x, y, z) max), ...]."""
    mb = MeshBuilder(name)
    for key, mn, mx in boxes:
        mb.box(mn, mx, mats[key], uv_tile)
    return mb.build(col)


def stair(col, name, x0, y0, y1, z0, steps, tread, riser, mats, direction=-1):
    """Straight solid stair between y0..y1. Step i spans tread i from x0 along `direction` and rises to (i+1)*riser."""
    mb = MeshBuilder(name)
    for i in range(steps):
        xa, xb = sorted((x0 + direction * i * tread, x0 + direction * (i + 1) * tread))
        mb.box((xa, y0, z0), (xb, y1, z0 + (i + 1) * riser), mats["wood"], uv_tile=2.0)
    return mb.build(col)


def pergola(col, name, mn, mx, z0, height, slats, mats, post=0.12):
    """Four frame posts at the corners of mn..mx (x, y), two beams along X and `slats` wood slats along Y on top."""
    (x0, y0), (x1, y1) = mn, mx
    top = z0 + height
    mb = MeshBuilder(name)
    for x in (x0, x1):
        for y in (y0, y1):
            mb.box((x - post / 2, y - post / 2, z0), (x + post / 2, y + post / 2, top), mats["frame"])
    for y in (y0, y1):
        mb.box((x0 - post / 2, y - post / 2, top - 0.2), (x1 + post / 2, y + post / 2, top), mats["frame"])
    step = (x1 - x0) / (slats - 1)
    for i in range(slats):
        x = x0 + i * step
        mb.box((x - 0.03, y0 - 0.15, top), (x + 0.03, y1 + 0.15, top + 0.12), mats["wood"], uv_tile=2.0)
    return mb.build(col)

"""Water features (resort deco): a shallow reflecting pool and a wall fountain; since the interactive house, the water
falling in a shower.

Like the jacuzzi and the pool, every water surface is its own WATER_<name> object (the runtime swaps it for its water
shader) and every LED strip is an LT_<name> night light. Axis-aligned like the glazing helpers.
"""
import math

from .catalog import FOUNTAIN_BASIN, FOUNTAIN_WALL
from .mesh import MeshBuilder

RIM = 0.15  # width of the travertine coping round a reflecting pool
FLOOR = 0.03  # tile floor of the basin
WATER_DROP = 0.03  # a pool is full to the brim: its water line lies this far below the rim
WATER_THICKNESS = 0.02
STEP = 0.45  # side of a stepping stone
STEP_RISE = 0.025  # how far a stepping stone stands above the water

WALL = FOUNTAIN_WALL  # thickness of a fountain wall (catalog: layout_check keeps the floor around it clear)
BASIN = FOUNTAIN_BASIN  # how far the basin reaches in front of the wall face, lip included
BASIN_HEIGHT = 0.4  # rim of the basin above the fountain's z0
LIP = 0.1  # wall of the basin
SPOUT = 0.05  # how far the ledge the water spills from juts out of the wall
SHEET = 0.02  # thickness of the water sheet
# archkit.furniture.bath.shower in its local space: the centre (x, y) of the rain head, the head's radius and the height
# of its underside, and the top of the tile tray.
SHOWER_HEAD = (-0.3, 0.2)
SHOWER_HEAD_RADIUS = 0.12
SHOWER_HEAD_Z = 2.03
SHOWER_TRAY = 0.06


def reflecting_pool(col, name, mn, mx, z, mats, depth=0.15, steps=()):
    """Shallow pool over the rectangle mn..mx (x, y), standing on the ground at height z: a travertine rim `depth` tall
    round a tile floor, filled with a thin water slab just under the rim.

    mn and mx are the outer corners, rim included. Returns {"pool": <name>, "water": WATER_<name>} and, when `steps`
    (a list of (x, y) centres) is given, "steps": <name>_steps, square travertine stepping stones that stand slightly
    above the water. Raises ValueError, before building anything, if the basin is too small, too shallow or a stone
    does not fit inside it."""
    (x0, y0), (x1, y1) = mn, mx
    ix0, iy0, ix1, iy1 = x0 + RIM, y0 + RIM, x1 - RIM, y1 - RIM
    if ix1 - ix0 <= 0.1 or iy1 - iy0 <= 0.1:
        raise ValueError(f"{name}: a {x1 - x0:g} x {y1 - y0:g} m pool leaves no basin inside a {RIM:g} m rim")
    if depth < FLOOR + WATER_DROP + WATER_THICKNESS + 0.01:
        raise ValueError(f"{name}: a pool {depth:g} m deep cannot hold a water slab")
    half = STEP / 2
    for x, y in steps:
        if not (ix0 + half <= x <= ix1 - half and iy0 + half <= y <= iy1 - half):
            raise ValueError(f"{name}: stepping stone ({x:g}, {y:g}) does not fit inside the basin")
    top = z + depth
    stone, tile = mats["stone"], mats["tile"]

    mb = MeshBuilder(name)
    mb.box((x0, y0, z), (x1, iy0, top), stone, uv_tile=2.0)
    mb.box((x0, iy1, z), (x1, y1, top), stone, uv_tile=2.0)
    mb.box((x0, iy0, z), (ix0, iy1, top), stone, uv_tile=2.0)
    mb.box((ix1, iy0, z), (x1, iy1, top), stone, uv_tile=2.0)
    mb.box((ix0, iy0, z), (ix1, iy1, z + FLOOR), tile)
    parts = {"pool": mb.build(col)}

    water_top = top - WATER_DROP
    parts["water"] = MeshBuilder(f"WATER_{name}").box(
        (ix0 + 0.01, iy0 + 0.01, water_top - WATER_THICKNESS), (ix1 - 0.01, iy1 - 0.01, water_top),
        mats["water"]).build(col)
    if steps:
        stones = MeshBuilder(f"{name}_steps")
        for x, y in steps:
            stones.box((x - half, y - half, z + FLOOR), (x + half, y + half, water_top + STEP_RISE), stone,
                       uv_tile=2.0)
        parts["steps"] = stones.build(col)
    return parts


def _run(name, start, end):
    """(axis, a0, a1, line): the wall runs along `axis` (0 = X, 1 = Y) from a0 to a1 on `line` of the other axis."""
    (x0, y0), (x1, y1) = start, end
    if abs(y1 - y0) < 1e-6 and abs(x1 - x0) > 1e-6:
        return 0, min(x0, x1), max(x0, x1), y0
    if abs(x1 - x0) < 1e-6 and abs(y1 - y0) > 1e-6:
        return 1, min(y0, y1), max(y0, y1), x0
    raise ValueError(f"{name}: a wall fountain must be axis-aligned and have a length, got {start} -> {end}")


def wall_fountain(col, name, start, end, z0, height, mats, facing=-1):
    """Travertine wall from start to end (x, y), `height` tall from z0 on its centre line, with a thin sheet of water
    falling down its front face into a low basin of water at its foot, lit by an LED strip under the water line.

    The front is the side of the line where `facing` points along the axis across the wall: -1 (default) is -Y for a wall
    along X and -X for a wall along Y, +1 the other side. Returns {"wall": <name> (slab, basin and the ledge the water
    spills from), "sheet": WATER_<name>_sheet, "water": WATER_<name> (the water in the basin), "led": LT_<name>}."""
    axis, a0, a1, line = _run(name, start, end)
    if facing not in (-1, 1):
        raise ValueError(f"{name}: facing must be -1 or 1, got {facing!r}")
    top = z0 + height
    face = line + facing * WALL / 2  # the front face of the wall

    def box(along, across, z_range):
        """Corner pair of the box between the `along` and `across` ranges, however the wall is oriented."""
        (p0, p1), (c0, c1) = along, sorted(across)
        mn, mx = ((p0, c0), (p1, c1)) if axis == 0 else ((c0, p0), (c1, p1))
        return (*mn, z_range[0]), (*mx, z_range[1])

    stone, water = mats["stone"], mats["water"]
    outer = face + facing * BASIN  # the outside of the basin lip
    inner = outer - facing * LIP  # its inside
    rim = z0 + BASIN_HEIGHT
    mb = MeshBuilder(name)
    mb.box(*box((a0, a1), (line - WALL / 2, line + WALL / 2), (z0, top)), stone, uv_tile=2.0)
    mb.box(*box((a0, a1), (face, outer), (z0, z0 + 0.05)), stone, uv_tile=2.0)  # basin floor
    mb.box(*box((a0, a1), (inner, outer), (z0, rim)), stone, uv_tile=2.0)  # lip along the front
    mb.box(*box((a0, a0 + LIP), (face, inner), (z0, rim)), stone, uv_tile=2.0)  # the two ends
    mb.box(*box((a1 - LIP, a1), (face, inner), (z0, rim)), stone, uv_tile=2.0)
    mb.box(*box((a0 + 0.15, a1 - 0.15), (face, face + facing * SPOUT), (top - 0.08, top - 0.04)), stone, uv_tile=2.0)
    parts = {"wall": mb.build(col)}

    water_top = rim - 0.06
    gap = 0.01
    parts["sheet"] = MeshBuilder(f"WATER_{name}_sheet").box(
        *box((a0 + 0.2, a1 - 0.2), (face + facing * 0.005, face + facing * (0.005 + SHEET)),
             (water_top - WATER_THICKNESS, top - 0.08)), water).build(col)
    parts["water"] = MeshBuilder(f"WATER_{name}").box(
        *box((a0 + LIP + gap, a1 - LIP - gap), (face + facing * gap, inner - facing * gap),
             (water_top - WATER_THICKNESS, water_top)), water).build(col)
    led_top = water_top - 0.04
    parts["led"] = MeshBuilder(f"LT_{name}").box(
        *box((a0 + 0.2, a1 - 0.2), (face + facing * 0.03, face + facing * 0.06), (led_top - 0.03, led_top)),
        mats["led"]).build(col, night_light=True)
    return parts


def shower_flow(col, name, pos, rot, mats, radius=0.09, segments=10):
    """The water falling from the rain head of an archkit.furniture.bath.shower (interaction spec §3.1): one WATER_
    column `radius` wide from just under the head down to the tray, which the water shader streaks as falling water.
    It is built in the shower's local space and stands like the shower: `pos` (x, y, z) is where the shower stands and
    `rot` its turn in degrees. The runtime keeps it hidden until the shower is turned on."""
    if not 0 < radius < SHOWER_HEAD_RADIUS:
        raise ValueError(f"{name}: a {radius:g} m column does not fall from a {SHOWER_HEAD_RADIUS:g} m rain head")
    x, y = SHOWER_HEAD
    mb = MeshBuilder(name)
    mb.cylinder((x, y, SHOWER_TRAY), radius, SHOWER_HEAD_Z - 0.005 - SHOWER_TRAY, mats["water"], segments=segments)
    return mb.build(col, location=pos, rotation_z=math.radians(rot))

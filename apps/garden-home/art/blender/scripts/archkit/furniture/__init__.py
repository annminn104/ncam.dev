"""Low-poly furniture (split by room). Each builder fills a
MeshBuilder in local space: footprint (catalog.FURNITURE) centred on the origin, floor at z = 0, front facing -Y.
Every room module ends with its own BUILDERS table; this package merges them and place() positions and rotates a piece,
or place_into() builds it into a mesh shared with other pieces (the garden modules).
"""
import math

from ..catalog import FURNITURE, NIGHT_KINDS, ROTATIONS, WALL_MOUNTED, WIND_SPANS
from ..mesh import MeshBuilder
from ..planting import paint_wind
from . import (animals, basement, bath, bedroom, climate, decor, dining_kitchen, garden, interior, lights, living, office,
               outdoor, pond, stairs, tropical, vehicles)


def _merge(*tables):
    merged = {}
    for table in tables:
        twice = sorted(merged.keys() & table.keys())
        assert not twice, f"builders defined in two furniture modules: {twice}"
        merged.update(table)
    return merged


BUILDERS = _merge(living.BUILDERS, dining_kitchen.BUILDERS, bedroom.BUILDERS, decor.BUILDERS, office.BUILDERS,
                  bath.BUILDERS, outdoor.BUILDERS, tropical.BUILDERS, garden.BUILDERS, pond.BUILDERS, vehicles.BUILDERS,
                  animals.BUILDERS, stairs.BUILDERS, lights.BUILDERS, climate.BUILDERS, basement.BUILDERS,
                  interior.BUILDERS)
assert set(BUILDERS) == set(FURNITURE), "every catalog entry needs a builder"


def _sway(name, kind, rot, opts):
    """Checks the rotation and takes wind out of the builder options: whether the piece sways."""
    if rot not in ROTATIONS:
        raise ValueError(f"{name}: rotation must be one of {ROTATIONS}, got {rot}")
    if "wind" not in opts:
        return False
    if kind not in WIND_SPANS:
        raise TypeError(f"{name}: {kind} does not sway, wind is for {sorted(WIND_SPANS)}")
    return bool(opts.pop("wind"))


def place(col, name, kind, pos, rot, mats, **opts):
    """Build `kind` as object `name` standing at pos (x, y, z), rotated `rot` degrees about Z (0/90/180/270).

    Wall-mounted kinds hang WALL_MOUNTED[kind] above pos z; kinds in NIGHT_KINDS get night_light = True. `opts` go to
    the builder as keyword arguments (e.g. a painting variant); a builder that does not declare an option raises
    TypeError. The outdoor plants in catalog.WIND_SPANS take wind=True as well: the colour attribute 'wind' is then
    painted on the finished object, so the runtime sways it (planting.paint_wind); other kinds reject the option."""
    sway = _sway(name, kind, rot, opts)
    mb = MeshBuilder(name)
    BUILDERS[kind](mb, mats, *FURNITURE[kind], **opts)
    x, y, z = pos
    props = {"night_light": True} if kind in NIGHT_KINDS else {}
    ob = mb.build(col, location=(x, y, z + WALL_MOUNTED.get(kind, 0.0)), rotation_z=math.radians(rot), **props)
    if sway:
        paint_wind(ob, *WIND_SPANS[kind])
    return ob


def place_into(mb, kind, pos, rot, mats, **opts):
    """Build `kind` into the shared MeshBuilder `mb`, where place() would stand it (pos (x, y, z), `rot` degrees), but
    without an object of its own (MeshBuilder.placed): the garden modules merge their pieces into a few objects, one
    draw call per material. wind=True paints the piece's own WIND_SPANS into the shared mesh. Whether the merged object
    glows (night_light) is up to the caller, which builds it."""
    sway = _sway(mb.name, kind, rot, opts)
    x, y, z = pos
    with mb.placed((x, y, z + WALL_MOUNTED.get(kind, 0.0)), math.radians(rot), wind=WIND_SPANS[kind] if sway else None):
        BUILDERS[kind](mb, mats, *FURNITURE[kind], **opts)

"""Generate blender/modules/koi_pond.blend from pond/koi_layout.py (art/README.md, Koi pond): the pond's bank and floor
(Pond_bank) and the stones along its edge (Pond_stones), both casting no shadow; the rockery with its moss and swaying
shrubs (Rockery); the water (WATER_surface), the falling sheet of the waterfall (WATER_waterfall_sheet) and its foam
(Waterfall_foam), which a click on any of the three toggles (the group waterfall), a click on the water feeding the koi
(the group koi); the koi, one object the website swims in its vertex shader (Koi: the loops in its custom property
`koi`, where they may be fed in `koi_feed`, the fish numbered by its second UV map, "koi"); the lotus, swaying a little
(Lotus); and the hotspot HS_pond. The water and the waterfall carry water = "pond": the website draws them in its pond
style, darker, greener and calmer than the pool's.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/pond/build_koi.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

from archkit import scene  # noqa: E402
from archkit.catalog import FURNITURE, WIND_SPANS  # noqa: E402
from archkit.furniture import BUILDERS  # noqa: E402
from archkit.furniture import pond as kit  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble  # noqa: E402
from pond import basin, interact, layout_check, swim  # noqa: E402
from pond import koi_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "koi_pond.blend")
KOI_SLOTS = 16  # the fish a koi object can carry: src/systems/koi.ts KOI_MAX, the "koi" UV map's u = (i + 0.5) / 16
SHEET = 0.03  # thickness of the falling sheet of water
WATER = "pond"  # the website's water style for the pond and its waterfall (src/systems/water.ts WATER_STYLES)


def _depth(point):
    return basin.depth_at(L.OUTLINE, L.CENTRE, L.PROFILE, point)


def bank(col, mats):
    """The bank and floor: the outline scaled down the rings of PROFILE, quads facing up from ring to ring and a fan
    round the deepest middle; green down to GREEN_BAND, mud down to FLOOR, the dark floor below."""
    rings = [[(x, y, z) for x, y in basin.ring(L.OUTLINE, L.CENTRE, share)] for share, z in L.PROFILE if share > 0]
    n = len(L.OUTLINE)
    points = [p for ring in rings for p in ring] + [(*L.CENTRE, L.PROFILE[-1][1])]
    parts = {"moss": [], "pond_bank": [], "pond_floor": []}
    for r, (share, _) in enumerate(L.PROFILE[:len(rings)]):
        inner = L.PROFILE[r + 1][0]
        part = "moss" if inner >= L.GREEN_BAND else "pond_bank" if inner >= L.FLOOR else "pond_floor"
        a, b = r * n, (r + 1) * n
        for i in range(n):
            j = (i + 1) % n
            parts[part].append((a + i, a + j, b + j, b + i) if r + 1 < len(rings) else (a + i, a + j, len(points) - 1))
    mb = MeshBuilder("Pond_bank")
    for part, faces in parts.items():
        mb.faces(points, faces, mats[part])
    return mb.build(col, cast_shadow=False)  # it lies in the lawn: its shadow pass would cost and show nothing


def stones(col, mats):
    """The stones astride the pond's edge and its pebbles, each sunk 4 cm into the bank under it."""
    mb = MeshBuilder("Pond_stones")
    for x, y, size, height, seed in L.STONES:
        kit.boulder(mb, mats, (x, y, _depth((x, y)) - 0.04), size, height + 0.04, seed)
    for x, y, size, height, seed in L.PEBBLES:
        kit.boulder(mb, mats, (x, y, _depth((x, y)) - 0.03), size, height + 0.03, seed, sides=5)
    return mb.build(col, cast_shadow=False)


def _outward(points, faces):
    """The faces turned to face away from the middle of the points."""
    middle = [sum(p[axis] for p in points) / len(points) for axis in range(3)]
    turned = []
    for face in faces:
        (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = (points[i] for i in face[:3])
        nx = (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0)
        ny = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0)
        nz = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
        centre = [sum(points[i][axis] for i in face) / len(face) for axis in range(3)]
        out = nx * (centre[0] - middle[0]) + ny * (centre[1] - middle[1]) + nz * (centre[2] - middle[2])
        turned.append(face if out >= 0 else tuple(reversed(face)))
    return turned


def rockery(col, mats):
    """The peaks, each standing on the bank under its middle less its sink, turned as the layout says; the stone lip the
    waterfall spills from; the shrubs, which sway, each planted on the rock it finds a metre above its ledge's height
    and down."""
    mb = MeshBuilder("Rockery")
    w, d, h = FURNITURE["rock_peak"]
    for variant, (x, y), rot, sink in L.PEAKS:
        with mb.placed((x, y, _depth((x, y)) - sink), math.radians(rot)):
            BUILDERS["rock_peak"](mb, mats, w, d, h, variant=variant)
    fall = L.WATERFALL
    (x, y, z), facing = fall["top"], math.radians(fall["facing"])
    back = (x - math.cos(facing) * 0.12, y - math.sin(facing) * 0.12)
    kit.boulder(mb, mats, (*back, z - 0.14), fall["width"] + 0.16, 0.22, 97)  # the lip of the fall
    rock = BVHTree.FromBMesh(mb.bm)
    for x, y, z, height, seed in L.SHRUBS:
        hit, *_ = rock.ray_cast(Vector((x, y, z + 1.0)), Vector((0.0, 0.0, -1.0)), 2.0)
        ground = hit.z - 0.03 if hit is not None else z  # on the rock under its ledge, its root a little in it
        with mb.placed((x, y, ground), 0.0, wind=(0.0, height)):
            kit.shrub(mb, mats, (0.0, 0.0, 0.0), height, seed)
    return mb.build(col)


def waterfall(col, mats):
    """The falling sheet of water, a thin slab from the lip down through the water line, thrown out at its foot; and the
    foam floating where it falls."""
    fall = L.WATERFALL
    (x, y, top), facing = fall["top"], math.radians(fall["facing"])
    out, across = (math.cos(facing), math.sin(facing)), (-math.sin(facing), math.cos(facing))
    points = []
    for throw, z in ((0.0, top), (fall["throw"], L.WATER_Z - 0.03)):
        for side in (-1, 1):
            for depth in (-SHEET / 2, SHEET / 2):
                points.append((x + out[0] * (throw + depth) + across[0] * side * fall["width"] / 2,
                               y + out[1] * (throw + depth) + across[1] * side * fall["width"] / 2, z))
    faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    sheet = MeshBuilder(interact.SHEET).faces(points, _outward(points, faces), mats["water"]).build(col, water=WATER)
    foot = (x + out[0] * fall["throw"], y + out[1] * fall["throw"])
    mb = MeshBuilder(interact.FOAM)
    mb.ellipsoid((*foot, L.WATER_Z + 0.01), (0.13, 0.13, 0.04), mats["foam"], subdivisions=1)
    for k in range(6):
        a = facing + 2 * math.pi * k / 6
        reach = fall["foam"] - 0.12 * (1 + k % 2) / 2
        radius = 0.08 + 0.03 * (k % 3)
        mb.ellipsoid((foot[0] + reach * math.cos(a), foot[1] + reach * math.sin(a), L.WATER_Z + 0.005),
                     (radius, radius * 0.8, 0.03), mats["foam"], subdivisions=1)
    return sheet, mb.build(col, cast_shadow=False)


def water(col, mats):
    """The water: a fan of triangles round the middle, out to WATER_SHARE of the outline (into the bank's slope)."""
    ring = [(x, y, L.WATER_Z) for x, y in basin.ring(L.OUTLINE, L.CENTRE, L.WATER_SHARE)]
    points = [(*L.CENTRE, L.WATER_Z)] + ring
    n = len(ring)
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    return MeshBuilder(interact.WATER).faces(points, faces, mats["water"]).build(col, water=WATER)


def koi(col, mats):
    """The koi, every one where its loop starts (swim.py) heading the way it swims, all in one object: the website moves
    each along its loop (src/systems/koi.ts), which the object carries as `koi` (swim.pack), the water's height as
    `koi_water`, where they may be fed as `koi_feed` (FEEDING: x, y, radius). Its second UV map, "koi", numbers the
    fish: u = (index + 0.5) / KOI_SLOTS on every face of a fish."""
    mb = MeshBuilder("Koi")
    numbers = mb.bm.loops.layers.uv.new("koi")
    w, d, h = FURNITURE["koi"]
    for index, loop in enumerate(L.KOI):
        start = len(mb.bm.faces)
        with mb.placed(swim.position(loop, 0.0), swim.heading(loop, 0.0)):
            BUILDERS["koi"](mb, mats, w, d, h, variant=loop["variant"])
        mb.bm.faces.ensure_lookup_table()
        for face in mb.bm.faces[start:]:
            for corner in face.loops:
                corner[numbers].uv = ((index + 0.5) / KOI_SLOTS, 0.5)
    feeding = [*L.FEEDING["centre"], L.FEEDING["radius"]]
    return mb.build(col, koi=swim.pack(L.KOI), koi_water=L.WATER_Z, koi_feed=feeding, cast_shadow=False)


def lotus(col, mats):
    """The lotus pads and flowers floating on the water, each turned its own way, swaying a little (catalog
    WIND_SPANS: they drift a few centimetres)."""
    mb = MeshBuilder("Lotus")
    for x, y, variant, rot in L.PADS:
        with mb.placed((x, y, L.LOTUS_Z), math.radians(rot), wind=WIND_SPANS["lotus_pad"]):
            BUILDERS["lotus_pad"](mb, mats, *FURNITURE["lotus_pad"], variant=variant)
    for k, (x, y, variant) in enumerate(L.FLOWERS):
        with mb.placed((x, y, L.LOTUS_Z), math.radians(47 * k), wind=WIND_SPANS["lotus_flower"]):
            BUILDERS["lotus_flower"](mb, mats, *FURNITURE["lotus_flower"], variant=variant)
    return mb.build(col, cast_shadow=False)


def build(col, mats):
    bank(col, mats)
    stones(col, mats)
    rockery(col, mats)
    waterfall(col, mats)
    water(col, mats)
    koi(col, mats)
    lotus(col, mats)
    spot = L.HOTSPOT
    scene.marker(col, spot["name"], spot["pos"], action=spot["action"], label=spot["label"], radius=spot["radius"])


def problems(layout):
    return layout_check.check_koi(layout) + layout_check.check_site(layout)


assemble.generate(L, build, "Generate the koi pond module", DEFAULT_OUT, check=problems, tags=interact.tags)

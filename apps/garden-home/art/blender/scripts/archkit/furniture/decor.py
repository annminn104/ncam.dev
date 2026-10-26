"""Entry furniture and decor: shoe cabinet, mirror bench, potted plants, paintings, curtains, the roller blind and the
wall light switch."""
import math

from ..catalog import BLIND_CASSETTE, CURTAIN
from ..textures import art_cell_uv
from ._parts import _fronts, _legs


def _plant(mb, m, pot_radius, pot_height, leaves):
    """Ceramic pot with soil and stacked leaf blobs; `leaves` is a list of (dx, dy, z, radius, subdivisions)."""
    mb.cylinder((0.0, 0.0, 0.0), pot_radius, pot_height, m["ceramic"], segments=12)
    mb.cylinder((0.0, 0.0, pot_height), pot_radius - 0.02, 0.02, m["soil"], segments=8)
    for dx, dy, z, radius, subdivisions in leaves:
        mb.blob((dx, dy, z), radius, m["leaf"], subdivisions=subdivisions)


def plant_tall(mb, m, w, d, h):
    _plant(mb, m, 0.22, 0.42, [(0.04, 0.0, 0.75, 0.26, 2), (-0.06, 0.03, 1.0, 0.24, 2), (0.05, -0.04, 1.22, 0.22, 2),
                               (-0.03, 0.02, 1.44, 0.19, 1), (0.02, 0.0, 1.64, 0.15, 1)])


def plant_small(mb, m, w, d, h):
    _plant(mb, m, 0.14, 0.25, [(0.02, 0.0, 0.45, 0.17, 2), (-0.03, 0.02, 0.6, 0.14, 2), (0.0, -0.02, 0.72, 0.08, 1)])


def _painting(mb, m, w, d, h, variant, border=0.04):
    """Frame border around a canvas whose UVs cover the atlas cell of painting `variant`.

    The canvas's UVs are a planar projection of its own local coordinates: only its own faces get them (a shared mesh
    may hold other M_art faces), and a placed() block, which moves and turns what it builds, is refused."""
    if mb.matrix is not None:
        raise ValueError(f"{mb.name}: a painting maps its art in its own space, not inside a placed() block")
    u0, v0, u1, v1 = art_cell_uv(variant)
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, border), m["frame"])
    mb.box((-w / 2, -d / 2, h - border), (w / 2, d / 2, h), m["frame"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - border)))
        mb.box((x0, -d / 2, border), (x1, d / 2, h - border), m["frame"])
    cx0, cx1, cz0, cz1 = -w / 2 + border, w / 2 - border, border, h - border
    before = len(mb.bm.faces)
    mb.box((cx0, -d / 2 + 0.012, cz0), (cx1, d / 2 - 0.005, cz1), m["art"])
    mb.bm.faces.ensure_lookup_table()
    for face in list(mb.bm.faces)[before:]:  # the canvas: bmesh appends new faces at the end
        if face.material_index == mb.materials.index(m["art"]):
            for loop in face.loops:  # planar projection: u along x, v along z, clamped against float noise
                co = loop.vert.co
                u = u0 + (co.x - cx0) / (cx1 - cx0) * (u1 - u0)
                v = v0 + (co.z - cz0) / (cz1 - cz0) * (v1 - v0)
                loop[mb.uv].uv = (min(max(u, u0), u1), min(max(v, v0), v1))


def painting_l(mb, m, w, d, h, variant=0):
    _painting(mb, m, w, d, h, variant)


def painting_m(mb, m, w, d, h, variant=0):
    _painting(mb, m, w, d, h, variant)


CURTAIN_ENDS = {"both": (-1, 1), "left": (-1,), "right": (1,)}
CURTAIN_LAYERS = ("sheer", "linen")
# Where each layer folds about, across the run (+Y is the glass side at rot 0), and how deep its folds are, peak to peak:
# the sheer behind on the glass side, the linen drape in front of it on the room side.
_SHEER_Y, _SHEER_DEPTH = 0.05, 0.08
_LINEN_Y, _LINEN_DEPTH = -0.03, 0.09
# The tied-back linen, its rows from the hem up as (height as a share of the tie-back's, share of the stack's width, how
# much deeper its folds get where they bunch): flared a little at the hem, gathered at the tie-back, its full width
# under the track.
_TIED = ((0.0, 0.6, 1.25), (1.0, 0.36, 1.5))


def _folds(width):
    """How many waves a stack `width` wide gathers across its top: catalog.CURTAIN's folds a metre, at least that."""
    return max(2, math.ceil(CURTAIN["folds"] * width - 1e-9))


def _stack(mb, mat, edge, side, y, rows, folds):
    """A gathered stack of fabric hanging from the end `edge` (x) of a curtain run towards its middle (`side` +1 or -1):
    one ribbon of quads waving in and out about the line y, `folds` times across its top, a sine sampled four times a
    wave (in to a peak and back out, on either side), its rows (z, width from the edge, depth peak to peak) from the hem
    up; smooth shaded, so the waves read as soft fabric, not slats. Whichever way it runs, its faces turn their front to
    the room (-Y)."""
    count = 4 * folds + 1
    points = [(edge + side * width * i / (count - 1), y + depth / 2 * (0, 1, 0, -1)[i % 4], z)
              for z, width, depth in rows for i in range(count)]
    faces = []
    for r in range(len(rows) - 1):
        for i in range(count - 1):
            a, b = r * count + i, r * count + i + 1
            quad = (a, b, b + count, a + count)
            faces.append(quad if side > 0 else tuple(reversed(quad)))
    before = len(mb.bm.faces)
    mb.faces(points, faces, mat)
    mb.bm.faces.ensure_lookup_table()
    for face in list(mb.bm.faces)[before:]:  # bmesh appends new faces at the end
        face.smooth = True


def curtain(mb, m, w, d, h, width=None, drop=None, ends="both", layers=CURTAIN_LAYERS, stack=CURTAIN["stack"]):
    """A curtain run (art/README.md, Interior): a slim dark bronze ceiling track as wide as the glazing
    (`width`, along X) with its top at `drop` over the floor, the room's height under its ceiling; at its `ends` ("both",
    "left" for -X, "right" for +X) a gathered stack of soft wave folds (catalog.CURTAIN, folds a metre) from 2 cm over the
    floor up to the track: an off-white voile on the glass side (+Y at rot 0), hanging straight, and in front of it a
    sand linen drape (M_drape) `stack` wide tied back with a bronze band, so the glass between them stays open.
    `layers` picks either or both ("sheer", "linen")."""
    if ends not in CURTAIN_ENDS:
        raise ValueError(f"curtain ends must be one of {sorted(CURTAIN_ENDS)}, got {ends!r}")
    unknown = sorted(set(layers) - set(CURTAIN_LAYERS))
    if unknown or not layers:
        raise ValueError(f"curtain layers must be some of {CURTAIN_LAYERS}, got {list(layers)}")
    width = w if width is None else width
    top = h if drop is None else drop
    track, hem, tie = CURTAIN["track"], CURTAIN["hem"], CURTAIN["tie"]
    hang = top - track  # where the fabric hangs from, under the track
    mb.box((-width / 2, -0.075, hang), (width / 2, 0.09, top), m["bronze"])
    sheer = stack * CURTAIN["sheer"]
    for side in CURTAIN_ENDS[ends]:
        edge = side * width / 2
        inward = -side
        if "sheer" in layers:
            rows = ((hem, sheer, _SHEER_DEPTH), (hang, sheer, _SHEER_DEPTH))
            _stack(mb, m["sheer"], edge, inward, _SHEER_Y, rows, _folds(sheer))
        if "linen" in layers:
            rows = [(hem + (tie - hem) * at, stack * share, _LINEN_DEPTH * deeper) for at, share, deeper in _TIED]
            rows.append((hang, stack, _LINEN_DEPTH))
            _stack(mb, m["drape"], edge, inward, _LINEN_Y, rows, _folds(stack))
            # the tie-back: a bronze band round the gathered linen
            reach = _LINEN_DEPTH * _TIED[-1][2] / 2 + 0.012
            x0, x1 = sorted((edge, edge + inward * (stack * _TIED[-1][1] + 0.02)))
            mb.box((x0, _LINEN_Y - reach, tie - 0.03), (x1, _LINEN_Y + reach, tie + 0.03), m["bronze"])


def roller_blind(mb, m, w, d, h, width=None, drop=None, lowered=0.35):
    """A roller blind for a ribbon window: a teak cassette `width` wide whose top is `drop` over the piece's foot (the
    window's sill), the sand linen blind rolled down `lowered` of the length under it, a bronze weight bar at its hem."""
    width = w if width is None else width
    top = h if drop is None else drop
    under = top - BLIND_CASSETTE
    mb.box((-width / 2, -d / 2, under), (width / 2, d / 2, top), m["teak"])
    hem = under - lowered * under
    mb.box((-width / 2 + 0.03, -0.006, hem), (width / 2 - 0.03, 0.006, under), m["drape"])
    mb.box((-width / 2 + 0.03, -0.012, max(0.0, hem - 0.02)), (width / 2 - 0.03, 0.012, hem), m["bronze"])


def shoe_cabinet(mb, m, w, d, h):
    _legs(mb, w, d, 0.12, m["frame"], inset=0.05)
    mb.box((-w / 2, -d / 2 + 0.02, 0.12), (w / 2, d / 2, h - 0.03), m["wood"], uv_tile=2.0)
    _fronts(mb, -w / 2, w / 2, 0.12, h - 0.03, -d / 2, m["wood"], 3, uv_tile=2.0)
    mb.box((-w / 2, -d / 2, h - 0.03), (w / 2, d / 2, h), m["wood"], uv_tile=2.0)


def bench_mirror(mb, m, w, d, h):
    # Cushioned bench at the front, full-length steel mirror in a dark frame behind it.
    for sx in (-1, 1):
        for y in (-d / 2 + 0.05, 0.05):
            x = sx * (w / 2 - 0.06)
            mb.box((x - 0.02, y - 0.02, 0.0), (x + 0.02, y + 0.02, 0.38), m["frame"])
    mb.box((-w / 2, -d / 2, 0.38), (w / 2, 0.1, 0.42), m["wood"], uv_tile=2.0)
    mb.box((-w / 2 + 0.02, -d / 2 + 0.02, 0.42), (w / 2 - 0.02, 0.08, 0.5), m["cushion"])
    mb.box((-0.5, 0.17, 0.3), (0.5, d / 2, h), m["frame"])
    mb.box((-0.46, 0.15, 0.34), (0.46, 0.17, h - 0.04), m["metal"])


def light_switch(mb, m, w, d, h):
    # A dark plate against the wall (+Y) with a white rocker 1 cm proud of it: dark so it shows on white walls.
    mb.box((-w / 2, 0.0, 0.0), (w / 2, d / 2, h), m["frame"])
    mb.box((-0.02, -d / 2, 0.035), (0.02, 0.0, h - 0.035), m["white"])


BUILDERS = {
    "plant_tall": plant_tall, "plant_small": plant_small, "painting_l": painting_l, "painting_m": painting_m,
    "curtain": curtain, "shoe_cabinet": shoe_cabinet, "bench_mirror": bench_mirror, "light_switch": light_switch,
    "roller_blind": roller_blind,
}

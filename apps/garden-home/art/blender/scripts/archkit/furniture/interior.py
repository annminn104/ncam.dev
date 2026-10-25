"""The decor pass's accessories (villa v2 spec §12 "Rèm và phụ kiện"): what furnishes the rooms and makes them look
lived in. Throw cushions, throws, the coffee table's tray, books, vases, bowls, a floor vase of dried pampas, a
travertine drum table, a fiddle-leaf fig and small potted plants, framed abstract prints, a round mirror, a towel bar, a
teak and cane buffet, a slim console, a bench, the table lamp, the dining table laid for eight, the kitchen counter's
things and herbs, stool pads, a toiletries tray, a bath mat, an umbrella stand, jute rugs (a large one under the dining
table), and the basement's accents.

The interior module merges them per material into a handful of objects (furniture.place_into), so they share one small
palette: linen, the curtains' sand linen, teak, bronze, ceramic, an opaque glassware (the voile, M_sheer, is the
curtains' alone: the interior's one see-through material), leaf green, terracotta, rattan and travertine; a lamp's
shade glows (M_led), built apart into its room's light object (part="shade"). Soft things are smooth shaded.
"""
import math
import random

LAMP_PARTS = ("base", "shade")


def _smooth(mb, before):
    """Smooth shades the faces built since the mesh had `before` of them (bmesh appends new faces at the end)."""
    mb.bm.faces.ensure_lookup_table()
    for face in list(mb.bm.faces)[before:]:
        face.smooth = True


# Travertine's texture maps 1 UV unit to this many metres on the small stone pieces, its UVs measured from the piece
# itself and shifted half a slab (four to a unit), so a bowl or a side table sits inside one slab, never across a joint.
STONE_TILE = 6.0
STONE_MID = (0.125, 0.125)


def _cone(mb, z0, z1, r0, r1, mat, x=0.0, y=0.0, segments=12, uv_tile=1.0, uv_offset=None):
    """An upright capped cone (or cylinder) round (x, y) from radius r0 at z0 to r1 at z1: vases, pots, bowls, shades."""
    mb.stem((x, y, z0), (x, y, z1), r0, mat, radius_end=r1, segments=segments, uv_tile=uv_tile, uv_offset=uv_offset)


def _stone_cone(mb, m, z0, z1, r0, r1, x=0.0, y=0.0, segments=12):
    """A travertine _cone, mid-slab (STONE_TILE, STONE_MID)."""
    _cone(mb, z0, z1, r0, r1, m["stone"], x=x, y=y, segments=segments, uv_tile=STONE_TILE, uv_offset=STONE_MID)


# A pillow's front and back on a grid this many quads a side, sewn at its edge: 2 x 16 quads, 64 triangles.
_PILLOW_GRID = 4


def _cushion(mb, mat, x, y, rx, ry, rz):
    """An upright throw cushion standing on z = 0 at (x, y), its face to -Y: a pillow, `2 rx` wide and `2 rz` tall, two
    quilted sheets sewn at a seam with its corners out and its sides drawn in a little, `2 ry` thick in the middle and
    thinning to the seam (a squashed ball read as a ball from the site's camera)."""
    n = _PILLOW_GRID
    points, index = [], {}
    for side in (-1, 1):  # the front sheet (-Y), then the back; the seam's points are the front's
        for j in range(n + 1):
            for i in range(n + 1):
                u, v = 2 * i / n - 1, 2 * j / n - 1
                seam = abs(u) == 1 or abs(v) == 1
                if seam and side > 0:
                    index[side, i, j] = index[-1, i, j]
                    continue
                pull = 1.0 - 0.06 * (1.0 - abs(u * v))  # the sides drawn in towards their middles, the corners out
                puff = 0.0 if seam else math.sqrt((1 - u * u) * (1 - v * v))
                index[side, i, j] = len(points)
                points.append((x + rx * u * pull, y + side * ry * puff, rz + rz * v * pull))
    faces = []
    for j in range(n):
        for i in range(n):
            quad = (index[-1, i, j], index[-1, i + 1, j], index[-1, i + 1, j + 1], index[-1, i, j + 1])
            faces.append(quad)
            faces.append(tuple(index[1, a, b] for a, b in ((i, j + 1), (i + 1, j + 1), (i + 1, j), (i, j))))
    before = len(mb.bm.faces)
    mb.faces(points, faces, mat)
    _smooth(mb, before)


def cushions(mb, m, w, d, h):
    # Three throw cushions in a row against the back (+Y): linen either side of a terracotta one a little forward.
    _cushion(mb, m["linen"], -0.4, 0.07, 0.2, 0.065, 0.2)
    _cushion(mb, m["terracotta"], 0.0, 0.0, 0.18, 0.065, 0.19)
    _cushion(mb, m["linen"], 0.4, 0.07, 0.2, 0.065, 0.2)


def cushion_pair(mb, m, w, d, h):
    # A linen and a rattan-coloured cushion, for a single bed, an armchair or a bench.
    _cushion(mb, m["linen"], -0.2, 0.05, 0.19, 0.065, 0.18)
    _cushion(mb, m["rattan"], 0.2, 0.0, 0.18, 0.065, 0.17)


def throw(mb, m, w, d, h):
    # A folded throw: two sand linen layers, the upper one a little smaller, with two terracotta stripes across it.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.05), m["drape"])
    mb.box((-w / 2 + 0.01, -d / 2 + 0.02, 0.05), (w / 2 - 0.01, d / 2 - 0.02, h - 0.005), m["drape"])
    for y in (-d / 2 + 0.08, d / 2 - 0.08):
        mb.box((-w / 2 + 0.01, y - 0.02, h - 0.006), (w / 2 - 0.01, y + 0.02, h), m["terracotta"])


def _books(mb, m, x, y, z, sizes):
    """A stack of books at (x, y) from height z: (width, depth, thickness, palette key, turn) from the bottom up;
    returns the top's height."""
    for bw, bd, bt, key, turn in sizes:
        mb.box((x - bw / 2, y - bd / 2, z), (x + bw / 2, y + bd / 2, z + bt), m[key], rot_z=turn)
        z += bt
    return z


def coffee_decor(mb, m, w, d, h):
    # A teak tray of two ceramic pillar candles and a travertine bowl; beside it a stack of books with a ceramic stone.
    mb.box((-0.42, -0.2, 0.0), (0.02, 0.2, 0.03), m["teak"])
    _cone(mb, 0.03, 0.19, 0.04, 0.04, m["ceramic"], x=-0.32, y=0.07, segments=8)
    _cone(mb, 0.03, 0.14, 0.04, 0.04, m["ceramic"], x=-0.21, y=-0.08, segments=8)
    _stone_cone(mb, m, 0.03, 0.09, 0.06, 0.09, x=-0.1, y=0.07)
    top = _books(mb, m, 0.25, -0.02, 0.0, ((0.32, 0.24, 0.03, "terracotta", 0.0), (0.29, 0.21, 0.025, "linen", 0.1),
                                            (0.26, 0.2, 0.03, "teak", -0.05)))
    before = len(mb.bm.faces)
    mb.ellipsoid((0.27, -0.02, top + 0.03), (0.05, 0.04, 0.03), m["ceramic"], subdivisions=1)
    _smooth(mb, before)


def book_stack(mb, m, w, d, h):
    # Four books and a small ceramic pot on top.
    top = _books(mb, m, 0.0, 0.0, 0.0, ((0.28, 0.2, 0.035, "terracotta", 0.0), (0.26, 0.19, 0.03, "linen", 0.12),
                                        (0.27, 0.2, 0.035, "teak", -0.06), (0.22, 0.16, 0.025, "rattan", 0.2)))
    _cone(mb, top, h, 0.035, 0.045, m["ceramic"], x=0.04, y=0.01, segments=8)


def vase_branches(mb, m, w, d, h):
    # A white ceramic vase and three bronze branches, each with leaves along its upper half.
    _cone(mb, 0.0, 0.2, 0.07, 0.095, m["ceramic"])
    _cone(mb, 0.2, 0.3, 0.095, 0.045, m["ceramic"])
    for angle, lean, top in ((0.3, 0.08, h - 0.02), (2.4, 0.09, h - 0.1), (4.4, 0.07, h - 0.06)):
        dx, dy = math.cos(angle), math.sin(angle)
        tip = (dx * lean, dy * lean, top)
        mb.stem((0.0, 0.0, 0.25), tip, 0.006, m["bronze"], radius_end=0.003, segments=4)
        for t, side in ((0.55, 1), (0.75, -1), (0.95, 1)):
            base = (dx * lean * t, dy * lean * t, 0.25 + (top - 0.25) * t)
            out = (base[0] + 0.035 * (dx - side * dy), base[1] + 0.035 * (dy + side * dx), base[2] + 0.02)
            mb.leaf(base, out, 0.04, m["leaf"])


def bowl(mb, m, w, d, h):
    # A wide travertine bowl.
    _stone_cone(mb, m, 0.0, h, w * 0.3, w / 2)


def floor_vase(mb, m, w, d, h):
    # A terracotta floor vase, bellied and narrow-necked, of dried pampas plumes on tall stems and two bare branches.
    _cone(mb, 0.0, 0.36, 0.12, 0.2, m["terracotta"], segments=10)
    _cone(mb, 0.36, 0.7, 0.2, 0.08, m["terracotta"], segments=10)
    _cone(mb, 0.7, 0.8, 0.08, 0.1, m["terracotta"], segments=10)
    for angle, spread, top in ((0.2, 0.12, 1.2), (1.5, 0.16, 1.12), (2.7, 0.1, 1.24), (3.9, 0.15, 1.15),
                               (5.1, 0.13, 1.18)):
        dx, dy = math.cos(angle), math.sin(angle)
        stem_top = (dx * spread, dy * spread, top)
        mb.stem((0.0, 0.0, 0.75), stem_top, 0.006, m["rattan"], segments=4)
        plume = (dx * (spread + 0.05), dy * (spread + 0.05), min(h - 0.01, top + 0.27))
        mb.leaf(stem_top, plume, 0.09, m["rattan"], thickness=0.06, belly=0.45)
    for angle, lean in ((0.9, 0.2), (3.3, 0.17)):
        mb.stem((0.0, 0.0, 0.75), (math.cos(angle) * lean, math.sin(angle) * lean, h), 0.008, m["bronze"],
                radius_end=0.003, segments=4)


def drum_table(mb, m, w, d, h):
    # A sculptural travertine side table: a drum foot and top round an hourglass waist.
    r = w / 2
    _stone_cone(mb, m, 0.0, 0.12, r * 0.88, r * 0.88, segments=10)
    _stone_cone(mb, m, 0.12, 0.25, r * 0.88, r * 0.52, segments=10)
    _stone_cone(mb, m, 0.25, h - 0.12, r * 0.52, r * 0.88, segments=10)
    _stone_cone(mb, m, h - 0.12, h, r, r, segments=10)


def fiddle_leaf(mb, m, w, d, h):
    # A fiddle-leaf fig in a terracotta planter: a slim teak-brown trunk and broad leaves spiralling up its top half.
    _cone(mb, 0.0, 0.5, 0.2, 0.24, m["terracotta"], segments=10)
    _cone(mb, 0.48, 0.5, 0.22, 0.22, m["bronze"], segments=10)  # the soil, dark
    mb.stem((0.0, 0.0, 0.5), (0.03, 0.02, 1.9), 0.028, m["teak"], radius_end=0.014, segments=5)
    leaves = 20
    for i in range(leaves):
        t = i / (leaves - 1)
        z = 0.95 + 1.02 * t
        angle = math.radians(137.5 * i)
        reach = 0.36 - 0.1 * t  # smaller leaves towards the top
        base = (0.03 * t + 0.02 * math.cos(angle), 0.02 * t + 0.02 * math.sin(angle), z)
        tip = (base[0] + reach * math.cos(angle), base[1] + reach * math.sin(angle), z + 0.08 - 0.12 * (1 - t))
        mb.leaf(base, tip, 0.2 - 0.05 * t, m["leaf"], belly=0.6)


def plant_pot(mb, m, w, d, h):
    # A small terracotta pot of broad leaves, arching out and up.
    _cone(mb, 0.0, 0.16, 0.09, 0.12, m["terracotta"], segments=10)
    for i in range(7):
        angle = math.radians(51.4 * i + 10)
        reach = 0.12 if i % 2 else 0.1
        tip = (reach * math.cos(angle), reach * math.sin(angle), 0.3 + 0.02 * (i % 3))
        mb.leaf((0.0, 0.0, 0.15), tip, 0.06, m["leaf"])
    for dx in (-0.02, 0.025):
        mb.leaf((dx, 0.0, 0.15), (dx * 2, 0.01, h - 0.01), 0.05, m["leaf"])


# The prints' compositions on their linen mats, (shape, palette key, x, z, size...) in the canvas's middle: an arch is a
# box of width w up to z with a half disc on top, a disc a circle of radius r, a band a box.
_PRINTS = (
    (("arch", "terracotta", 0.0, 0.25, 0.42, 0.72), ("disc", "rattan", 0.22, 0.98, 0.1)),
    (("arch", "leaf", -0.08, 0.2, 0.28, 0.8), ("disc", "terracotta", 0.18, 0.36, 0.11), ("band", "rattan", 0.0, 0.16,
                                                                                         0.6, 0.04)),
    (("disc", "stone", 0.0, 0.36, 0.17), ("disc", "terracotta", 0.03, 0.64, 0.13), ("disc", "rattan", -0.01, 0.86, 0.09)),
    (("arch", "terracotta", -0.1, 0.22, 0.34, 0.62), ("arch", "rattan", 0.12, 0.42, 0.28, 0.82)),
)


def art_print(mb, m, w, d, h, variant=0):
    # A framed abstract print: a slim bronze frame round a linen mat and its shapes, its face towards the room (-Y).
    if not 0 <= variant < len(_PRINTS):
        raise ValueError(f"art_print variant must be 0..{len(_PRINTS) - 1}, got {variant}")
    f = 0.03
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, f), m["bronze"])
    mb.box((-w / 2, -d / 2, h - f), (w / 2, d / 2, h), m["bronze"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - f)))
        mb.box((x0, -d / 2, f), (x1, d / 2, h - f), m["bronze"])
    face = -0.01
    mb.box((-w / 2 + f, face, f), (w / 2 - f, d / 2 - 0.005, h - f), m["linen"])
    front = face - 0.003
    for shape, key, x, z, *size in _PRINTS[variant]:
        if shape == "arch":
            width, top = size
            mb.box((x - width / 2, front, z), (x + width / 2, face, top), m[key])
            mb.cylinder((x, front, top), width / 2, face - front, m[key], segments=12, axis="y")
        elif shape == "disc":
            mb.cylinder((x, front, z), size[0], face - front, m[key], segments=12, axis="y")
        else:
            width, tall = size
            mb.box((x - width / 2, front, z), (x + width / 2, face, z + tall), m[key])


def mirror_round(mb, m, w, d, h):
    # A round mirror of smoked bronze glass in a teak ring, its face towards the room (-Y).
    r = w / 2
    mb.cylinder((0.0, -d / 2 + 0.01, r), r, d - 0.01, m["teak"], segments=16, axis="y")
    mb.cylinder((0.0, -d / 2, r), r - 0.06, 0.01, m["bronze"], segments=16, axis="y")


def towel_bar(mb, m, w, d, h):
    # A bronze bar on two brackets off the wall (+Y) with a linen towel folded over it.
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.02)
        mb.box((x - 0.015, -0.03, h - 0.08), (x + 0.015, d / 2, h - 0.05), m["bronze"])
    mb.box((-w / 2, -0.03, h - 0.08), (w / 2, -0.01, h - 0.05), m["bronze"])
    mb.box((-0.2, -d / 2, 0.0), (0.2, -0.03, h - 0.04), m["linen"])
    mb.box((-0.2, -0.01, 0.12), (0.2, 0.01, h - 0.04), m["linen"])
    mb.box((-0.2, -d / 2, h - 0.04), (0.2, 0.01, h - 0.02), m["linen"])


def buffet(mb, m, w, d, h):
    # A low teak buffet on bronze legs, four woven cane doors across its front (-Y).
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - 0.06), sy * (d / 2 - 0.06)
            mb.box((x - 0.018, y - 0.018, 0.0), (x + 0.018, y + 0.018, 0.16), m["bronze"])
    mb.box((-w / 2, -d / 2 + 0.015, 0.16), (w / 2, d / 2, h - 0.03), m["teak"])
    mb.box((-w / 2, -d / 2, h - 0.03), (w / 2, d / 2, h), m["teak"])
    step = (w - 0.04) / 4
    for i in range(4):
        x0 = -w / 2 + 0.02 + i * step
        mb.box((x0 + 0.015, -d / 2, 0.2), (x0 + step - 0.015, -d / 2 + 0.015, h - 0.07), m["rattan"])


def console_slim(mb, m, w, d, h):
    # A slim console: a teak top and a low teak shelf on a bronze frame.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - 0.03), sy * (d / 2 - 0.03)
            mb.box((x - 0.012, y - 0.012, 0.0), (x + 0.012, y + 0.012, h - 0.03), m["bronze"])
    mb.box((-w / 2 + 0.04, -d / 2 + 0.04, 0.18), (w / 2 - 0.04, d / 2 - 0.04, 0.21), m["teak"])
    mb.box((-w / 2, -d / 2, h - 0.03), (w / 2, d / 2, h), m["teak"])


def bench(mb, m, w, d, h):
    # A teak bench on two slab legs with a linen pad on its seat.
    for sx in (-1, 1):
        x0, x1 = sorted((sx * (w / 2 - 0.04), sx * (w / 2 - 0.1)))
        mb.box((x0, -d / 2 + 0.03, 0.0), (x1, d / 2 - 0.03, 0.36), m["teak"])
    mb.box((-w / 2, -d / 2, 0.36), (w / 2, d / 2, 0.41), m["teak"])
    mb.box((-w / 2 + 0.02, -d / 2 + 0.02, 0.41), (w / 2 - 0.02, d / 2 - 0.02, h), m["linen"])


def table_lamp(mb, m, w, d, h, part=None):
    # A ceramic gourd base on a bronze stem under a tapered drum shade that glows (part: "base" or "shade" alone).
    if part is not None and part not in LAMP_PARTS:
        raise ValueError(f"table_lamp part must be one of {LAMP_PARTS}, got {part!r}")
    if part in (None, "base"):
        _cone(mb, 0.0, 0.1, 0.07, 0.11, m["ceramic"], segments=8)
        _cone(mb, 0.1, 0.26, 0.11, 0.06, m["ceramic"], segments=8)
        mb.stem((0.0, 0.0, 0.26), (0.0, 0.0, 0.38), 0.012, m["bronze"], segments=6)
    if part in (None, "shade"):
        _cone(mb, 0.38, h, w / 2, w / 2 - 0.045, m["led"])


def table_setting(mb, m, w, d, h):
    # The dining table laid for eight: a sand linen runner down the middle, a ceramic plate and a glass (glassware) at
    # every place, a low travertine bowl of greenery between two bronze candlesticks.
    mb.box((-w / 2 + 0.05, -0.17, 0.0), (w / 2 - 0.05, 0.17, 0.005), m["drape"])
    for x in (-1.05, -0.35, 0.35, 1.05):
        for side in (-1, 1):
            mb.cylinder((x, side * 0.33, 0.0), 0.13, 0.015, m["ceramic"], segments=10)
            mb.cylinder((x + 0.15, side * 0.2, 0.0), 0.035, 0.13, m["glassware"], segments=6)
    _stone_cone(mb, m, 0.0, 0.07, 0.12, 0.16)
    for i in range(4):
        angle = math.radians(90 * i + 20)
        mb.leaf((0.0, 0.0, 0.06), (0.2 * math.cos(angle), 0.12 * math.sin(angle), 0.12), 0.07, m["leaf"])
    for x in (-0.42, 0.42):
        mb.cylinder((x, 0.0, 0.0), 0.04, 0.015, m["bronze"], segments=8)
        mb.cylinder((x, 0.0, 0.015), 0.012, 0.2, m["bronze"], segments=6)
        mb.cylinder((x, 0.0, 0.215), 0.014, h - 0.215, m["ceramic"], segments=6)


def fruit_bowl(mb, m, w, d, h):
    # A travertine bowl heaped with oranges and a lime.
    _stone_cone(mb, m, 0.0, 0.08, 0.12, w / 2 - 0.01)
    rnd = random.Random(5)
    for i in range(6):
        angle = math.radians(60 * i)
        r = 0.09 if i else 0.0
        z = 0.105 if i else 0.112
        mat = m["leaf"] if i == 3 else m["terracotta"]
        mb.blob((r * math.cos(angle), r * math.sin(angle), z + rnd.uniform(-0.005, 0.005)), 0.04, mat, subdivisions=1)


def counter_set(mb, m, w, d, h):
    # A teak board leaning on the backsplash (+Y), a ceramic crock of teak spoons, a kettle and two jars with teak lids.
    mb.box((-0.42, 0.13, 0.0), (-0.1, 0.16, 0.42), m["teak"])
    mb.cylinder((-0.15, -0.05, 0.0), 0.06, 0.14, m["ceramic"], segments=8)
    for dx, dy, top in ((-0.03, 0.01, 0.32), (0.02, -0.02, 0.29), (0.035, 0.025, 0.3)):
        tip = (-0.15 + dx, -0.05 + dy, top)
        mb.stem((-0.15, -0.05, 0.08), tip, 0.007, m["teak"], segments=4)
        mb.blob(tip, 0.02, m["teak"], subdivisions=1, squash=0.6)
    mb.cylinder((0.08, -0.03, 0.0), 0.085, 0.15, m["ceramic"], segments=10)
    mb.cylinder((0.08, -0.03, 0.15), 0.05, 0.02, m["bronze"], segments=8)
    mb.stem((0.04, -0.09, 0.06), (0.03, -0.15, 0.14), 0.012, m["bronze"], segments=4)
    mb.box((0.155, -0.05, 0.04), (0.175, -0.01, 0.17), m["bronze"])
    for x, y, tall in ((0.3, 0.07, 0.16), (0.39, -0.06, 0.12)):
        mb.cylinder((x, y, 0.0), 0.05, tall, m["ceramic"], segments=8)
        mb.cylinder((x, y, tall), 0.052, 0.025, m["teak"], segments=8)


def herb_pots(mb, m, w, d, h):
    # Three terracotta pots of herbs on a teak tray.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.02), m["teak"])
    for k, x in enumerate((-0.19, 0.0, 0.19)):
        _cone(mb, 0.02, 0.12, 0.05, 0.065, m["terracotta"], x=x, segments=8)
        mb.blob((x, 0.0, 0.17), 0.06, m["leaf"], subdivisions=1)
        for i in range(3):
            angle = math.radians(120 * i + 40 * k)
            mb.leaf((x, 0.0, 0.14), (x + 0.04 * math.cos(angle), 0.04 * math.sin(angle), h - 0.01 * i), 0.03, m["leaf"])


def seat_pad(mb, m, w, d, h):
    # A round linen pad on a bar stool's seat.
    mb.cylinder((0.0, 0.0, 0.0), w / 2, h, m["linen"], segments=12)


def toiletry_tray(mb, m, w, d, h):
    # A travertine tray of three ceramic bottles with teak caps.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.02), m["stone"], uv_tile=STONE_TILE, uv_offset=STONE_MID)
    for x, r, tall in ((-0.11, 0.03, 0.15), (0.0, 0.028, 0.12), (0.11, 0.035, 0.09)):
        mb.cylinder((x, 0.0, 0.02), r, tall, m["ceramic"], segments=8)
        mb.cylinder((x, 0.0, 0.02 + tall), r * 0.5, min(0.03, h - 0.02 - tall), m["teak"], segments=6)


def bath_mat(mb, m, w, d, h):
    # A linen bath mat.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, h), m["linen"])


def umbrella_stand(mb, m, w, d, h):
    # A woven rattan umbrella stand with two furled umbrellas in it, terracotta canopies on bronze shafts.
    mb.cylinder((0.0, 0.0, 0.0), w / 2 - 0.02, 0.45, m["rattan"], segments=12)
    for x, y, lean in ((-0.04, 0.02, -0.04), (0.05, -0.03, 0.03)):
        top = (x + lean, y, h - 0.03)
        mb.stem((x, y, 0.05), top, 0.008, m["bronze"], segments=4)
        mb.stem((x + lean * 0.4, y, 0.42), (x + lean * 0.9, y, 0.66), 0.034, m["terracotta"], radius_end=0.01,
                segments=8)
        mb.box((top[0] - 0.035, y - 0.01, top[2]), (top[0] + 0.01, y + 0.01, h), m["bronze"])


def _rug(mb, m, w, d, h, border=0.1):
    """A jute rug: woven rattan inside a linen border, the jute a hair higher so the two never share a face."""
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, h * 0.8), m["linen"])
    mb.box((-w / 2 + border, -d / 2 + border, 0.0), (w / 2 - border, d / 2 - border, h), m["rattan"])


def rug_jute(mb, m, w, d, h):
    _rug(mb, m, w, d, h)


def runner_rug(mb, m, w, d, h):
    _rug(mb, m, w, d, h, border=0.07)


def rug_large(mb, m, w, d, h):
    _rug(mb, m, w, d, h, border=0.14)


def wine_set(mb, m, w, d, h):
    # The cellar's tasting tray: a decanter of red wine and two glasses (glassware) on teak.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.02), m["teak"])
    _cone(mb, 0.02, 0.16, 0.075, 0.03, m["wine"], x=-0.12)
    mb.cylinder((-0.12, 0.0, 0.16), 0.02, h - 0.18, m["glassware"], segments=6)
    mb.cylinder((-0.12, 0.0, h - 0.02), 0.028, 0.02, m["glassware"], segments=6)
    for x, y in ((0.05, -0.07), (0.16, 0.07)):
        mb.cylinder((x, y, 0.02), 0.025, 0.005, m["glassware"], segments=6)
        mb.cylinder((x, y, 0.025), 0.006, 0.09, m["glassware"], segments=4)
        _cone(mb, 0.115, 0.2, 0.018, 0.035, m["glassware"], x=x, y=y, segments=6)


def spa_towels(mb, m, w, d, h):
    # Rolled linen spa towels, four side by side and two on top (the spa's own linen: no draw call more).
    r = 0.045
    for x in (-0.165, -0.055, 0.055, 0.165):
        mb.cylinder((x, -d / 2 + 0.01, r), r, d - 0.02, m["linen"], segments=8, axis="y")
    for x in (-0.055, 0.055):
        mb.cylinder((x, -d / 2 + 0.01, h - r), r, d - 0.02, m["linen"], segments=8, axis="y")


def gym_kit(mb, m, w, d, h):
    # A folded linen gym towel and two white water bottles with bronze caps.
    mb.box((-w / 2, -d / 2 + 0.01, 0.0), (0.05, d / 2 - 0.01, 0.06), m["linen"])
    for x, y in ((0.12, -0.05), (0.13, 0.07)):
        mb.cylinder((x, y, 0.0), 0.035, h - 0.03, m["ceramic"], segments=8)
        mb.cylinder((x, y, h - 0.03), 0.022, 0.03, m["bronze"], segments=6)


BUILDERS = {
    "cushions": cushions, "cushion_pair": cushion_pair, "throw": throw, "coffee_decor": coffee_decor,
    "book_stack": book_stack, "vase_branches": vase_branches, "bowl": bowl, "floor_vase": floor_vase,
    "drum_table": drum_table, "fiddle_leaf": fiddle_leaf, "plant_pot": plant_pot, "art_print": art_print,
    "mirror_round": mirror_round, "towel_bar": towel_bar, "buffet": buffet, "console_slim": console_slim,
    "bench": bench, "table_lamp": table_lamp, "table_setting": table_setting, "fruit_bowl": fruit_bowl,
    "counter_set": counter_set, "herb_pots": herb_pots, "seat_pad": seat_pad, "toiletry_tray": toiletry_tray,
    "bath_mat": bath_mat, "umbrella_stand": umbrella_stand, "rug_jute": rug_jute, "runner_rug": runner_rug,
    "rug_large": rug_large,
    "wine_set": wine_set, "spa_towels": spa_towels, "gym_kit": gym_kit,
}

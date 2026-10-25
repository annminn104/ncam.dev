"""Parts shared by the furniture room modules: table legs, the dining chair, cabinet fronts and bookcases."""
import random

BOOK_COLOURS = ("grape", "leaf", "fabric_dark", "wood", "cushion", "white", "frame", "fabric")


def _legs(mb, w, d, h, mat, inset=0.06, size=0.04):
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - inset), sy * (d / 2 - inset)
            mb.box((x - size / 2, y - size / 2, 0.0), (x + size / 2, y + size / 2, h), mat)


def _chair(mb, m, x, y, facing, seat=0.44, axis="y"):
    """Dining chair centred at (x, y). axis="y": faces +Y when facing = 1, -Y when facing = -1; axis="x": the same
    along X. The back sits on the side opposite to the facing direction."""
    s = seat / 2
    mb.box((x - s, y - s, 0.42), (x + s, y + s, 0.47), m["fabric"])
    if axis == "x":
        back = x - facing * s
        x0, x1 = sorted((back, back + facing * 0.05))
        mb.box((x0, y - s, 0.47), (x1, y + s, 0.85), m["fabric"])
    else:
        back = y - facing * s
        y0, y1 = sorted((back, back + facing * 0.05))
        mb.box((x - s, y0, 0.47), (x + s, y1, 0.85), m["fabric"])
    for lx in (x - s + 0.03, x + s - 0.03):
        for ly in (y - s + 0.03, y + s - 0.03):
            mb.box((lx - 0.015, ly - 0.015, 0.0), (lx + 0.015, ly + 0.015, 0.42), m["frame"])


def _fronts(mb, x0, x1, z0, z1, y, mat, count, depth=0.02, gap=0.01, uv_tile=1.0):
    """`count` door or drawer slabs side by side over x0..x1 and z0..z1, their fronts at y (the carcass behind them
    shows through the gaps)."""
    step = (x1 - x0) / count
    for i in range(count):
        mb.box((x0 + i * step + gap / 2, y, z0), (x0 + (i + 1) * step - gap / 2, y + depth, z1), mat, uv_tile=uv_tile)


def _books(mb, m, x, z, y0, y1, tallest, rnd, count, leftwards=False):
    """`count` upright books on height z, side by side from x towards +X (or -X): mixed colours, varied heights."""
    for _ in range(count):
        thick, height = rnd.uniform(0.04, 0.08), rnd.uniform(0.65, 1.0) * tallest
        x0, x1 = (x - thick, x) if leftwards else (x, x + thick)
        mb.box((x0, y0, z), (x1, y1, z + height), m[rnd.choice(BOOK_COLOURS)], uv_tile=2.0)
        x = x0 if leftwards else x1


def _bookcase(mb, m, w, d, h, shelves, seed, run=4, side=0.04, board=0.03):
    """Wooden bookcase with a white back and `shelves` compartments, each holding a run of books at either end.
    Deterministic in `seed`, so a regenerated module is byte-identical."""
    rnd = random.Random(seed)
    inner = (-w / 2 + side, w / 2 - side)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - side)))
        mb.box((x0, -d / 2, 0.0), (x1, d / 2, h), m["wood"], uv_tile=2.0)
    mb.box((inner[0], d / 2 - 0.02, 0.0), (inner[1], d / 2, h), m["white"])
    pitch = (h - board) / shelves
    for i in range(shelves + 1):
        mb.box((inner[0], -d / 2, i * pitch), (inner[1], d / 2 - 0.02, i * pitch + board), m["wood"], uv_tile=2.0)
    for i in range(shelves):
        z, tallest = i * pitch + board, pitch - board - 0.1
        _books(mb, m, inner[0] + 0.03, z, -d / 2 + 0.08, d / 2 - 0.05, tallest, rnd, run)
        _books(mb, m, inner[1] - 0.03, z, -d / 2 + 0.08, d / 2 - 0.05, tallest, rnd, run, leftwards=True)

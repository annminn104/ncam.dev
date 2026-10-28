"""Seeded procedural textures: the same seed gives the same pixels, so regeneration is
reproducible. Images are packed into the .blend so the glTF exporter can embed them."""
import array
import math
import random

import bpy


def _image(name, width, height, pixel):
    img = bpy.data.images.new(name, width, height)
    px = array.array("f")
    for y in range(height):
        for x in range(width):
            px.extend(pixel(x, y))
    img.pixels.foreach_set(px)
    img.pack()
    return img


# Travertine (resort deco): cream stone whose strata, grain and pits shift towards a warm brown, and the slab joints.
TRAVERTINE = (0.86, 0.79, 0.66)
TRAVERTINE_DARK = (0.64, 0.52, 0.38)
TRAVERTINE_JOINT = (0.55, 0.47, 0.37)


def _strata(rnd, length):
    """Soft bands along one slab's height, 0..1: a few slow sines with random phases plus thin darker veins."""
    waves = [(rnd.uniform(0.04, 0.22), rnd.uniform(0.0, 2 * math.pi), rnd.uniform(0.4, 1.0)) for _ in range(4)]
    profile = [sum(a * math.sin(f * y + p) for f, p, a in waves) for y in range(length)]
    low, high = min(profile), max(profile)
    profile = [(v - low) / (high - low) for v in profile]
    for _ in range(rnd.randint(3, 6)):
        centre, width, strength = rnd.randrange(length), rnd.uniform(0.8, 2.5), rnd.uniform(0.4, 0.9)
        for y in range(max(0, int(centre - 4 * width)), min(length, int(centre + 4 * width) + 1)):
            profile[y] = min(1.0, profile[y] + strength * math.exp(-((y - centre) / width) ** 2))
    return profile


def _pits(rnd, size, count):
    """size x size bytes, row by row: 0 for clean stone up to 255 for the middle of a pit, small flat ellipses."""
    pits = bytearray(size * size)
    for _ in range(count):
        cx, cy = rnd.randrange(size), rnd.randrange(size)
        rx, ry, depth = rnd.uniform(1.5, 5.0), rnd.uniform(0.8, 1.8), rnd.uniform(0.6, 1.0)
        for y in range(max(0, int(cy - ry)), min(size, int(cy + ry) + 1)):
            for x in range(max(0, int(cx - rx)), min(size, int(cx + rx) + 1)):
                fall = 1.0 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2
                if fall > 0.0:
                    pits[y * size + x] = max(pits[y * size + x], int(255 * depth * min(1.0, 2.0 * fall)))
    return pits


def stone_tiles(name="T_stone", size=1024, tiles=4, seed=11):
    """Travertine: tiles x tiles large-format cream slabs with thin warm joints, a tone jitter per slab, soft strata
    running along X (each slab has its own), fine grain streaks along X and small dark pits."""
    rnd = random.Random(seed)
    tone = [[0.95 + rnd.random() * 0.08 for _ in range(tiles)] for _ in range(tiles)]
    cell = size // tiles
    joint = max(2, size // 256)
    strata = [_strata(rnd, cell) for _ in range(tiles * tiles)]
    grain = [rnd.random() for _ in range(4096)]
    pits = _pits(rnd, size, size * size // 1800)
    cream, dark = TRAVERTINE, TRAVERTINE_DARK
    spread = [d - c for c, d in zip(cream, dark)]

    def pixel(x, y):
        if x % cell < joint or y % cell < joint:
            return (*TRAVERTINE_JOINT, 1.0)
        slab = (y // cell) * tiles + x // cell
        mix = 0.3 * strata[slab][y % cell] + 0.12 * grain[(x // 24 + y * 11) % 4096] + 0.85 * pits[y * size + x] / 255
        t = tone[y // cell][x // cell]
        return (min(1.0, (cream[0] + spread[0] * mix) * t), min(1.0, (cream[1] + spread[1] * mix) * t),
                min(1.0, (cream[2] + spread[2] * mix) * t), 1.0)

    return _image(name, size, size, pixel)


def wood_planks(name="T_wood", size=512, planks=8, seed=23):
    """Warm wood: planks boards across V with a tone per board and grain streaks along U."""
    rnd = random.Random(seed)
    tone = [0.85 + rnd.random() * 0.25 for _ in range(planks)]
    grain = [rnd.random() for _ in range(size)]
    board = size // planks

    def pixel(x, y):
        b = y // board
        if y % board == 0:
            return (0.1, 0.06, 0.035, 1.0)
        t = tone[b] * (0.88 + 0.12 * grain[(x // 3 + b * 37) % size])
        return (0.5 * t, 0.31 * t, 0.17 * t, 1.0)

    return _image(name, size, size, pixel)


# Modern-art palette: warm paper and ink plus saturated accents that still read when the painting is a few pixels wide.
ART_COLOURS = (
    (0.93, 0.89, 0.80), (0.09, 0.12, 0.24), (0.80, 0.36, 0.24), (0.90, 0.69, 0.20),
    (0.22, 0.52, 0.55), (0.55, 0.64, 0.50), (0.84, 0.50, 0.55), (0.12, 0.12, 0.13),
)
ART_MAT = (0.96, 0.95, 0.92)  # passe-partout around every painting, so neighbouring cells never bleed into each other
ART_MAT_WIDTH = 0.02  # of the cell edge


def _painting(rnd, background):
    """One abstract painting in cell coordinates (u, v in 0..1, v up): (background, rects, discs). Rects are
    (colour, (u0, v0, u1, v1)) colour blocks and full-width stripes; discs are (colour, (centre u, centre v, radius)).
    Rects are drawn over the background, discs over the rects."""
    accents = [c for c in ART_COLOURS if c != background]
    rects = []
    for _ in range(rnd.randint(2, 3)):
        u, v = rnd.uniform(0.0, 0.7), rnd.uniform(0.0, 0.7)
        stripe = rnd.uniform(0.06, 0.18)
        shape = rnd.choice(((u, v, u + rnd.uniform(0.2, 0.4), v + rnd.uniform(0.2, 0.4)),  # block
                            (u, 0.0, u + stripe, 1.0), (0.0, v, 1.0, v + stripe)))  # vertical or horizontal stripe
        rects.append((rnd.choice(accents), shape))
    discs = [(rnd.choice(accents), (rnd.uniform(0.2, 0.8), rnd.uniform(0.2, 0.8), rnd.uniform(0.1, 0.25)))
             for _ in range(rnd.randint(1, 2))]
    return background, rects, discs


def art_atlas(name="T_art", width=1024, height=512, cols=4, rows=2, seed=31):
    """cols x rows abstract paintings packed into one atlas, cell 0 top-left (see art_cell_uv). Each cell is a seeded
    background tone with a few colour blocks, stripes and discs inside a pale mat."""
    rnd = random.Random(seed)
    tones = rnd.sample(ART_COLOURS, len(ART_COLOURS))  # every painting gets its own background while tones last
    paintings = [_painting(rnd, tones[i % len(tones)]) for i in range(cols * rows)]
    cell_w, cell_h = width // cols, height // rows

    def pixel(x, y):
        # Blender images start at the bottom row, so the top-left cell is the one with the highest y.
        index = (rows - 1 - y // cell_h) * cols + x // cell_w
        u, v = (x % cell_w + 0.5) / cell_w, (y % cell_h + 0.5) / cell_h
        if min(u, v, 1.0 - u, 1.0 - v) < ART_MAT_WIDTH:
            return (*ART_MAT, 1.0)
        colour, rects, discs = paintings[index]
        for rect_colour, (u0, v0, u1, v1) in rects:
            if u0 <= u <= u1 and v0 <= v <= v1:
                colour = rect_colour
        for disc_colour, (cu, cv, radius) in discs:
            if (u - cu) ** 2 + (v - cv) ** 2 <= radius * radius:
                colour = disc_colour
        return (*colour, 1.0)

    return _image(name, width, height, pixel)


def art_cell_uv(index, cols=4, rows=2):
    """(u0, v0, u1, v1) of atlas cell `index`: cells run left to right, then top to bottom, and v grows upward
    (Blender UV), so cell 0 of the default 4 x 2 atlas is (0.0, 0.5, 0.25, 1.0)."""
    if not 0 <= index < cols * rows:
        raise ValueError(f"art cell {index} is outside the {cols} x {rows} atlas")
    col, row = index % cols, index // cols
    return (col / cols, 1.0 - (row + 1) / rows, (col + 1) / cols, 1.0 - row / rows)

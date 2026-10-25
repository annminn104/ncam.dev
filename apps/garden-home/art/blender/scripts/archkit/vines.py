"""Grape trellis (villa v2 spec §5.2): a wood frame with a slat lattice, and over it one object of twisting vine
trunks, a canopy of flat leaf blobs and hanging bunches of grapes. The vines carry the colour attribute 'wind' (R =
sway weight, spec §6.3) like the planters do, so the runtime sways them.
"""
import math
import random

from . import planting
from .mesh import MeshBuilder
from .trellis_posts import trellis_posts

POST = 0.12  # post section
SHOE = (0.16, 0.12)  # width and height of the steel foot a post stands in
BEAM = (0.1, 0.16)  # width and height of the perimeter beams
SLAT = (0.04, 0.04)  # width and thickness of a lattice slat
TRUNK_SEGMENTS = 8
TRUNK_RADIUS = (0.045, 0.025)  # at the foot and at the lattice
TRUNK_TWIST = 0.1  # radius of the spiral a trunk winds round its post
LEAVES_PER_M2 = 4.0  # at leaf_density 1.0
LEAF_RADIUS = (0.3, 0.45)
LEAF_SQUASH = 0.28
LEAF_MARGIN = 0.05  # leaf centres may overhang the frame by this much
BUNCH_INSET = 0.4  # bunches hang at least this far inside the frame
BUNCH_ROWS = ((3, 0.05, 0.058), (2, 0.03, 0.05), (1, 0.0, 0.045))  # (grapes, ring radius, grape radius) per row
BUNCH_DROP = (0.14, 0.09, 0.08)  # how far each row sits below the previous one, the first below the lattice


def grape_trellis(col, name, mn, mx, z0, height, mats, spacing=0.4, leaf_density=1.0, bunches=16, seed=13):
    """Trellis over the rectangle mn..mx (x, y) from the roof at z0 up to z0 + height (the top of the lattice).

    Returns (<name>, <name>_vines): the wood structure, and the vines with trunks, leaves and bunches in one mesh.
    Posts stand at trellis_posts(mn, mx): the four corners and every ~3.5 m along the long sides; beams run round the
    top and slats cross it both ways at most `spacing` apart. `leaf_density` scales the number of leaf blobs (1.0 is
    4 per m²), `bunches` is the number of grape bunches; the seed fixes every jitter.
    """
    top = z0 + height
    posts = trellis_posts(mn, mx)
    return (_frame(col, name, mn, mx, z0, top, posts, spacing, mats),
            _vines(col, f"{name}_vines", mn, mx, z0, top, posts, mats, leaf_density, bunches, seed))


def _frame(col, name, mn, mx, z0, top, posts, spacing, mats):
    (x0, y0), (x1, y1) = mn, mx
    wood, steel = mats["wood"], mats["frame"]
    shoe_w, shoe_h = SHOE
    beam_w, beam_h = BEAM
    slat_w, slat_t = SLAT
    half = POST / 2
    beam_top = top - 2 * slat_t  # the two slat layers sit on the beams
    mb = MeshBuilder(name)
    for x, y in posts:
        mb.box((x - shoe_w / 2, y - shoe_w / 2, z0), (x + shoe_w / 2, y + shoe_w / 2, z0 + shoe_h), steel)
        mb.box((x - half, y - half, z0 + shoe_h), (x + half, y + half, beam_top - beam_h), wood, uv_tile=2.0)
    for y in (y0, y1):
        mb.box((x0 - half, y - beam_w / 2, beam_top - beam_h), (x1 + half, y + beam_w / 2, beam_top), wood, uv_tile=2.0)
    for x in (x0, x1):
        mb.box((x - beam_w / 2, y0 + beam_w / 2, beam_top - beam_h), (x + beam_w / 2, y1 - beam_w / 2, beam_top), wood,
               uv_tile=2.0)
    # Lower layer along x, upper layer along y: a slat at both ends of each side, none further apart than `spacing`.
    for y in _steps(y0, y1, spacing):
        mb.box((x0 - half, y - slat_w / 2, beam_top), (x1 + half, y + slat_w / 2, beam_top + slat_t), wood, uv_tile=2.0)
    for x in _steps(x0, x1, spacing):
        mb.box((x - slat_w / 2, y0 - half, beam_top + slat_t), (x + slat_w / 2, y1 + half, top), wood, uv_tile=2.0)
    return mb.build(col)


def _steps(a, b, spacing):
    n = math.ceil((b - a) / spacing)
    return [a + (b - a) * i / n for i in range(n + 1)]


def _vines(col, name, mn, mx, z0, top, posts, mats, leaf_density, bunches, seed):
    (x0, y0), (x1, y1) = mn, mx
    mb = MeshBuilder(name)
    rnd = random.Random(seed)
    for x, y in posts:
        _trunk(mb, rnd, (x, y), z0, top, mats["soil"])
    trunk_verts = len(mb.bm.verts)

    # Each part draws from its own stream, so changing the leaf density does not move the grapes.
    leaves = random.Random(f"{seed}:leaves")
    count = round(leaf_density * (x1 - x0) * (y1 - y0) * LEAVES_PER_M2)
    margin = LEAF_MARGIN
    for x, y in _scatter(leaves, count, (x0 - margin, y0 - margin), (x1 + margin, y1 + margin)):
        mb.blob((x, y, top + 0.06 + leaves.uniform(0.0, 0.28)), leaves.uniform(*LEAF_RADIUS), mats["leaf"],
                subdivisions=1, squash=LEAF_SQUASH)  # subdivisions=1 is the 20-face icosahedron

    grapes = random.Random(f"{seed}:grapes")
    inset = BUNCH_INSET
    for x, y in _scatter(grapes, bunches, (x0 + inset, y0 + inset), (x1 - inset, y1 - inset)):
        _bunch(mb, grapes, (x, y, top), mats["grape"])

    ob = mb.build(col)
    planting.paint_wind(ob, z0, top)  # trunks: 0 at the foot, 1 at the lattice
    wind = ob.data.color_attributes["wind"].data
    for i in range(trunk_verts, len(wind)):  # leaves and grapes sway at full weight
        wind[i].color = (1.0, 0.0, 0.0, 1.0)
    return ob


def _scatter(rnd, count, lo, hi):
    """`count` points spread evenly over the rectangle lo..hi: one jittered point in each of `count` random cells of a
    grid."""
    (x0, y0), (x1, y1) = lo, hi
    w, d = x1 - x0, y1 - y0
    nx = max(1, math.ceil(math.sqrt(count * w / d)))
    ny = max(1, math.ceil(count / nx))
    cells = rnd.sample([(i, j) for i in range(nx) for j in range(ny)], count)
    return [(x0 + (i + rnd.random()) * w / nx, y0 + (j + rnd.random()) * d / ny) for i, j in cells]


def _trunk(mb, rnd, base, z0, top, mat):
    """Chain of short thin cylinders winding up from z0 to `top` around the post at `base`, tapering and jittered."""
    x, y = base
    turns = rnd.uniform(1.5, 2.5) * rnd.choice((-1, 1))
    phase = rnd.uniform(0.0, 2 * math.pi)
    r0, r1 = TRUNK_RADIUS
    previous = (x + TRUNK_TWIST * math.cos(phase), y + TRUNK_TWIST * math.sin(phase), z0)
    for i in range(1, TRUNK_SEGMENTS + 1):
        t = i / TRUNK_SEGMENTS
        angle = phase + 2 * math.pi * turns * t
        twist = TRUNK_TWIST + rnd.uniform(-0.015, 0.015)
        z = top if i == TRUNK_SEGMENTS else z0 + (top - z0) * t + rnd.uniform(-0.03, 0.03)
        point = (x + twist * math.cos(angle), y + twist * math.sin(angle), z)
        mb.stem(previous, point, r0 + (r1 - r0) * (t - 1 / TRUNK_SEGMENTS), mat, r0 + (r1 - r0) * t)
        previous = point


def _bunch(mb, rnd, top, mat):
    """Cone of tiny icosahedra (the kit's subdivision 1 is 20 faces) hanging from the point `top`: three grapes, then
    two, then one."""
    x, y, z = top
    turn = rnd.uniform(0.0, 2 * math.pi)
    for (n, ring, radius), drop in zip(BUNCH_ROWS, BUNCH_DROP):
        z -= drop
        for k in range(n):
            angle = turn + 2 * math.pi * k / n
            mb.blob((x + ring * math.cos(angle), y + ring * math.sin(angle), z), radius, mat, subdivisions=1)
        turn += math.pi / 3  # stagger the rows

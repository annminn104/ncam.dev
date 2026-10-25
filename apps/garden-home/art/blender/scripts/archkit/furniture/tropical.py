"""Tropical resort pieces (resort deco): palms, monstera, bird of paradise, a hanging fern and a green wall in terracotta,
rattan and teak, plus the rattan, teak and linen furniture, a rattan pendant and a floor lantern that go with them.

Plants are leaf blades (MeshBuilder.leaf) on stems. The plants that sway outdoors list the heights their 'wind' weight
runs between in catalog.WIND_SPANS, which place(..., wind=True) hands to planting.paint_wind.
"""
import math
import random

from ._parts import _legs


def _pot(mb, m, radius, height, segments=10):
    """Terracotta pot at the origin: a body that widens upwards, a rim ring and a disc of soil on top. Returns the
    height where the plant starts."""
    mb.stem((0.0, 0.0, 0.0), (0.0, 0.0, height - 0.05), radius * 0.7, m["terracotta"], radius_end=radius * 0.95,
            segments=segments)
    mb.cylinder((0.0, 0.0, height - 0.05), radius, 0.05, m["terracotta"], segments=segments)
    mb.cylinder((0.0, 0.0, height), radius - 0.03, 0.02, m["soil"], segments=segments)
    return height + 0.02


def _frond(mb, mat, root, yaw, reach, rise, droop, width, parts=3):
    """Arching frond: `parts` blades chained from `root` outwards at azimuth `yaw`, rising `rise` and drooping `droop`
    over `reach` metres (z = rise * t - droop * t * t, t from 0 to 1). Each blade runs a little into the next and is
    narrower than the one before, so the chain reads as one feathery leaf."""
    x, y, z = root
    cos, sin = math.cos(yaw), math.sin(yaw)

    def at(t):
        return (x + reach * t * cos, y + reach * t * sin, z + rise * t - droop * t * t)

    for i in range(parts):
        mb.leaf(at(i / parts), at(min(1.0, (i + 1) / parts + 0.2)), width * (1.0 - 0.35 * i / parts), mat, belly=0.5)


def _palm(mb, m, pot_radius, pot_height, crown_z, lean, fronds, reach, spear, seed):
    """Palm in a pot: a trunk leaning `lean` metres along +X up to a crown at crown_z, two tiers of arching
    frond chains round the crown (a long drooping one and a shorter, more upright one, light and dark green in turn)
    and two young leaves standing up to crown_z + spear."""
    rnd = random.Random(seed)
    start = _pot(mb, m, pot_radius, pot_height)
    steps, radius = 6, pot_radius * 0.3
    rings = [(lean * (i / steps) ** 2, start + (crown_z - start) * i / steps, radius * (1.0 - 0.3 * i / steps))
             for i in range(steps + 1)]
    for (x0, z0, r0), (x1, z1, r1) in zip(rings, rings[1:]):
        mb.stem((x0, 0.0, z0), (x1, 0.0, z1), r0, m["soil"], radius_end=r1)
    crown = (lean, 0.0, crown_z)
    mb.blob(crown, radius * 1.4, m["teak"], subdivisions=1)
    count = fronds // 2 + 1  # the lower tier has one more than the upper
    for tier, (n, length, rise, droop) in enumerate(((count, 1.0, 0.45, 0.95), (fronds - count, 0.72, 0.85, 1.0))):
        for i in range(n):
            yaw = 2 * math.pi * (i + 0.5 * tier) / n + rnd.uniform(-0.12, 0.12)
            long = reach * length * rnd.uniform(0.9, 1.0)
            mat = m["leaf"] if (i + tier) % 2 else m["leaf_dark"]
            _frond(mb, mat, crown, yaw, long, rise * long, droop * long, reach * 0.5)
    mb.leaf(crown, (lean, 0.0, crown_z + spear), reach * 0.26, m["leaf"])
    mb.leaf(crown, (lean + 0.05, 0.06, crown_z + spear * 0.7), reach * 0.22, m["leaf_dark"])


def palm_tall(mb, m, w, d, h):
    _palm(mb, m, pot_radius=0.3, pot_height=0.45, crown_z=2.4, lean=0.08, fronds=11, reach=0.7, spear=0.5, seed=3)


def palm_small(mb, m, w, d, h):
    _palm(mb, m, pot_radius=0.2, pot_height=0.3, crown_z=1.1, lean=0.04, fronds=9, reach=0.36, spear=0.46, seed=5)


def monstera(mb, m, w, d, h):
    # Eight stalks fan out of the pot at different heights; each ends in a split leaf, two lobes with a gap between.
    start = _pot(mb, m, 0.27, 0.32)
    rnd = random.Random(7)
    for i in range(8):
        yaw = 2 * math.pi * i / 8 + rnd.uniform(-0.15, 0.15)
        up = 0.3 + 0.52 * ((i * 3) % 8) / 7
        reach = rnd.uniform(0.07, 0.13)
        end = (reach * math.cos(yaw), reach * math.sin(yaw), start + up)
        mb.stem((0.03 * math.cos(yaw), 0.03 * math.sin(yaw), start), end, 0.014, m["leaf"], radius_end=0.009,
                segments=4)
        mat = m["leaf"] if i % 3 == 0 else m["leaf_dark"]
        for lobe in (-1, 1):
            a = yaw + lobe * 0.42
            mb.leaf(end, (end[0] + 0.34 * math.cos(a), end[1] + 0.34 * math.sin(a), end[2] - 0.08), 0.27, mat,
                    belly=0.55)


def bird_of_paradise(mb, m, w, d, h):
    # Tall paddle leaves on long stalks: the upright ones are the tallest, the leaning ones shorter.
    start = _pot(mb, m, 0.22, 0.3)
    rnd = random.Random(9)
    for i in range(8):
        yaw = 2 * math.pi * i / 8 + rnd.uniform(-0.15, 0.15)
        lean_by = ((i * 3) % 8) / 7  # 0 for the most upright leaf, 1 for the most leaning one
        stalk, blade = 0.86 - 0.3 * lean_by, 0.62 - 0.08 * lean_by
        lean = math.radians(5 + 13 * lean_by)
        direction = (math.sin(lean) * math.cos(yaw), math.sin(lean) * math.sin(yaw), math.cos(lean))
        root = (0.03 * math.cos(yaw), 0.03 * math.sin(yaw), start)
        base = tuple(root[k] + direction[k] * stalk for k in range(3))
        lean += math.radians(6)  # the blade bends a little further out than its stalk
        tip = tuple(base[k] + blade * v for k, v in enumerate(
            (math.sin(lean) * math.cos(yaw), math.sin(lean) * math.sin(yaw), math.cos(lean))))
        mb.stem(root, base, 0.016, m["leaf"], radius_end=0.011, segments=4)
        mb.leaf(base, tip, 0.3, m["leaf"] if i % 2 else m["leaf_dark"], belly=0.55)


def fern_hanging(mb, m, w, d, h, cord=0.0):
    # Rattan basket on three cords with a soil top and fronds hanging over the rim down to the bottom of the piece.
    # A `cord` > 0 hangs the knot of the three cords from a hook that far above the piece's top: the ceiling, when it
    # is higher than WALL_MOUNTED + h.
    rnd = random.Random(11)
    mb.stem((0.0, 0.0, 0.3), (0.0, 0.0, 0.5), 0.11, m["rattan"], radius_end=0.2, segments=8)
    mb.cylinder((0.0, 0.0, 0.5), 0.22, 0.03, m["rattan"], segments=8)
    mb.cylinder((0.0, 0.0, 0.53), 0.19, 0.02, m["soil"], segments=8)
    for angle in (90, 210, 330):
        a = math.radians(angle)
        mb.stem((0.21 * math.cos(a), 0.21 * math.sin(a), 0.52), (0.0, 0.0, 0.69), 0.006, m["rattan"], segments=3)
    if cord > 0:
        mb.stem((0.0, 0.0, 0.69), (0.0, 0.0, h + cord - 0.02), 0.006, m["rattan"], segments=3)
        mb.box((-0.02, -0.02, h + cord - 0.02), (0.02, 0.02, h + cord), m["frame"])
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        _frond(mb, m["leaf"] if i % 2 else m["leaf_dark"], (0.04 * math.cos(a), 0.04 * math.sin(a), 0.55), a, 0.16,
               0.22, 0.2, 0.1, parts=2)
    for i in range(10):
        a = 2 * math.pi * i / 10 + rnd.uniform(-0.1, 0.1)
        mat = m["leaf"] if i % 2 else m["leaf_dark"]
        cos, sin = math.cos(a), math.sin(a)
        reach = rnd.uniform(0.27, 0.29)
        points = [(0.17 * cos, 0.17 * sin, 0.54), (0.25 * cos, 0.25 * sin, 0.4),
                  (reach * cos, reach * sin, 0.2), (reach * 0.97 * cos, reach * 0.97 * sin, 0.02)]
        for (p, q), width in zip(zip(points, points[1:]), (0.1, 0.09, 0.07)):
            mb.leaf(p, q, width, mat, belly=0.5)


def plant_wall(mb, m, w, d, h):
    # Teak frame round a dark backing, thickly planted with leaf blades set at random angles in five layers.
    rnd = random.Random(13)
    bar, back = 0.1, 0.05
    for sx in (-1, 1):
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - bar)))
        mb.box((x0, -d / 2, 0.0), (x1, d / 2, h), m["teak"])
    mb.box((-w / 2 + bar, -d / 2, 0.0), (w / 2 - bar, d / 2, bar), m["teak"])
    mb.box((-w / 2 + bar, -d / 2, h - bar), (w / 2 - bar, d / 2, h), m["teak"])
    mb.box((-w / 2 + bar, back, bar), (w / 2 - bar, back + 0.02, h - bar), m["leaf_dark"])
    cols, rows = 8, 8
    step_x, step_z = (w - 2 * bar) / cols, (h - 2 * bar) / rows
    half, length = 0.1, 0.25  # half the width and of the length of a blade
    for row in range(rows):
        for col in range(cols):
            angle = rnd.uniform(-1.2, 1.2) + (math.pi if rnd.random() < 0.3 else 0.0)  # mostly upright, some drooping
            dx, dz = length * math.sin(angle), length * math.cos(angle)
            reach_x, reach_z = abs(dx) + half * abs(dz) / length, abs(dz) + half * abs(dx) / length
            x = -w / 2 + bar + (col + 0.5) * step_x + rnd.uniform(-0.05, 0.05)
            z = bar + (row + 0.5) * step_z + rnd.uniform(-0.05, 0.05)
            x = min(max(x, -w / 2 + bar + reach_x), w / 2 - bar - reach_x)  # no blade pokes out of the frame
            z = min(max(z, bar + reach_z), h - bar - reach_z)
            y = -0.056 + 0.014 * ((row * cols + col) % 5)  # five layers: neighbours never share a plane
            roll = rnd.uniform(-0.5, 0.5)
            side = (-dz * math.cos(roll), math.sin(roll) * 0.2, dx * math.cos(roll))
            mb.leaf((x - dx, y, z - dz), (x + dx, y, z + dz), 2 * half, m["leaf"] if (row + col) % 3 else m["leaf_dark"],
                    belly=0.45, side=side)


def rattan_pendant(mb, m, w, d, h, cord=0.0):
    # Dome shade of rattan rings (every other one a little wider, with a slit between them where the glow shows),
    # a glowing core inside, a cord up to the ceiling and its canopy; `cord` lengthens the cord above the piece's top,
    # so the canopy meets a ceiling higher than WALL_MOUNTED + h.
    bottom, rise, radius, bands = 0.26, 0.26, 0.28, 5
    profile = [(bottom + rise * i / bands, radius * math.sqrt(1.0 - (i / bands) ** 2 * 0.92)) for i in range(bands + 1)]
    mb.stem((0.0, 0.0, bottom - 0.012), (0.0, 0.0, bottom + rise * 0.98), profile[0][1] * 0.96, m["led"],
            radius_end=profile[-1][1] * 0.96, segments=12)
    for i, ((z0, r0), (z1, r1)) in enumerate(zip(profile, profile[1:])):
        grow = 1.0 if i % 2 == 0 else 1.04
        mb.stem((0.0, 0.0, z0 + 0.008), (0.0, 0.0, z1 - 0.008), r0 * grow, m["rattan"], radius_end=r1 * grow,
                segments=12)
    mb.cylinder((0.0, 0.0, bottom + rise), 0.006, h + cord - 0.02 - (bottom + rise), m["frame"], segments=6)
    mb.cylinder((0.0, 0.0, h + cord - 0.02), 0.05, 0.02, m["frame"], segments=6)


def rattan_armchair(mb, m, w, d, h):
    # Round bucket chair: four teak legs, a rattan seat ring and a back of slats that wraps round the +Y half and
    # drops to arm height at the sides, with a linen seat cushion and a linen back cushion inside.
    _legs(mb, 0.56, 0.56, 0.2, m["teak"], inset=0.02, size=0.045)
    mb.cylinder((0.0, 0.0, 0.2), 0.36, 0.08, m["rattan"], segments=12)
    mb.cylinder((0.0, 0.0, 0.28), 0.31, 0.1, m["linen"], segments=12)
    slats, radius = 9, 0.37
    for i in range(slats):
        theta = math.radians(-10 + 200 * i / (slats - 1))
        x, y = radius * math.cos(theta), radius * math.sin(theta)
        top = 0.55 + 0.25 * math.sin(theta)
        mb.box((x - 0.075, y - 0.025, 0.28), (x + 0.075, y + 0.025, top), m["rattan"], rot_z=theta - math.pi / 2)
    mb.box((-0.2, 0.2, 0.38), (0.2, 0.29, 0.68), m["linen"])


def egg_chair(mb, m, w, d, h):
    # Hanging egg: a round base, a pole at the back that arches over the chair, a short chain, the rattan egg and,
    # in its opening at the front (-Y), a linen back cushion and seat cushion.
    mb.cylinder((0.0, 0.0, 0.0), 0.5, 0.04, m["frame"], segments=12)
    arch = [(0.42, 0.04), (0.42, 1.4), (0.4, 1.62), (0.33, 1.8), (0.2, 1.92), (0.0, 1.97)]
    for (y0, z0), (y1, z1) in zip(arch, arch[1:]):
        mb.stem((0.0, y0, z0), (0.0, y1, z1), 0.025, m["frame"])
    mb.stem((0.0, 0.0, 1.97), (0.0, 0.04, 1.52), 0.008, m["frame"], segments=3)
    mb.ellipsoid((0.0, 0.04, 1.0), (0.4, 0.38, 0.52), m["rattan"])
    mb.ellipsoid((0.0, -0.24, 1.02), (0.28, 0.14, 0.36), m["linen"])
    mb.ellipsoid((0.0, -0.15, 0.72), (0.3, 0.2, 0.08), m["linen"])


def daybed_cabana(mb, m, w, d, h):
    # Four-poster: teak posts, a top frame under a linen canopy, a platform with a mattress and three pillows at the
    # back (+Y), and a curtain tied back at every post.
    px, py = w / 2 - 0.08, d / 2 - 0.08
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box((sx * px - 0.045, sy * py - 0.045, 0.0), (sx * px + 0.045, sy * py + 0.045, h - 0.08), m["teak"])
    for sy in (-1, 1):
        y0, y1 = sorted((sy * py - 0.045, sy * py + 0.045))
        mb.box((-px - 0.045, y0, h - 0.08), (px + 0.045, y1, h), m["teak"])
    for sx in (-1, 1):
        x0, x1 = sorted((sx * px - 0.045, sx * px + 0.045))
        mb.box((x0, -py + 0.045, h - 0.08), (x1, py - 0.045, h), m["teak"])
    mb.box((-px + 0.045, -py + 0.045, h - 0.1), (px - 0.045, py - 0.045, h - 0.08), m["linen"])
    mb.box((-px - 0.03, -py - 0.03, 0.12), (px + 0.03, py + 0.03, 0.3), m["teak"])
    mb.box((-px, -py, 0.3), (px, py, 0.48), m["linen"])
    for x, width, height in ((-0.72, 0.6, 0.42), (0.0, 0.6, 0.5), (0.72, 0.6, 0.42)):
        mb.box((x - width / 2, py - 0.42, 0.48), (x + width / 2, py - 0.12, 0.48 + height), m["linen"])
    for sx in (-1, 1):
        for sy in (-1, 1):
            # hung from the top rail beside the post, tied back with a rattan cord, falling to the floor in a flare
            x, y = sx * (px - 0.2), sy * py
            mb.box((x - 0.2, y - 0.03, 1.3), (x + 0.2, y + 0.03, h - 0.1), m["linen"])
            mb.box((x - 0.07, y - 0.035, 1.24), (x + 0.07, y + 0.035, 1.3), m["rattan"])
            mb.box((x - 0.15, y - 0.03, 0.0), (x + 0.15, y + 0.03, 1.24), m["linen"])


def teak_lounger(mb, m, w, d, h):
    # Low slatted lounger: four feet, two side rails, seat slats along the length and the backrest at +Y in five
    # steps; a linen pad follows the seat and the steps.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - 0.04), sy * (d / 2 - 0.08)
            mb.box((x - 0.025, y - 0.025, 0.0), (x + 0.025, y + 0.025, 0.2), m["teak"])
        x0, x1 = sorted((sx * w / 2, sx * (w / 2 - 0.05)))
        mb.box((x0, -d / 2 + 0.03, 0.15), (x1, d / 2 - 0.03, 0.22), m["teak"])
    half = w / 2 - 0.05
    seat_y1 = 0.25
    for i in range(10):
        y0 = -d / 2 + 0.05 + i * (seat_y1 + d / 2 - 0.05) / 10
        mb.box((-half, y0, 0.22), (half, y0 + 0.1, 0.26), m["teak"])
    for i in range(5):
        y0 = seat_y1 + i * 0.14
        top = 0.27 + 0.035 * i
        mb.box((-half, y0, 0.22), (half, y0 + 0.14, top - 0.04), m["teak"])
        mb.box((-half + 0.02, y0, top - 0.04), (half - 0.02, y0 + 0.14, top), m["linen"])
    mb.box((-half + 0.02, -d / 2 + 0.1, 0.26), (half - 0.02, seat_y1, 0.31), m["linen"])


def lantern(mb, m, w, d, h):
    # Floor lantern: teak base and cap, four dark posts with two bands round a glowing core, and a handle.
    mb.box((-0.15, -0.15, 0.0), (0.15, 0.15, 0.05), m["teak"])
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.12, sy * 0.12
            mb.box((x - 0.012, y - 0.012, 0.05), (x + 0.012, y + 0.012, 0.45), m["frame"])
    mb.box((-0.07, -0.07, 0.08), (0.07, 0.07, 0.42), m["led"])
    for z in (0.2, 0.34):
        mb.box((-0.13, -0.13, z), (0.13, -0.115, z + 0.015), m["frame"])
        mb.box((-0.13, 0.115, z), (0.13, 0.13, z + 0.015), m["frame"])
        mb.box((-0.13, -0.115, z), (-0.115, 0.115, z + 0.015), m["frame"])
        mb.box((0.115, -0.115, z), (0.13, 0.115, z + 0.015), m["frame"])
    mb.box((-0.17, -0.17, 0.45), (0.17, 0.17, 0.49), m["teak"])
    mb.box((-0.1, -0.1, 0.49), (0.1, 0.1, 0.53), m["teak"])
    mb.stem((-0.08, 0.0, 0.53), (0.0, 0.0, 0.585), 0.01, m["frame"], segments=4)
    mb.stem((0.0, 0.0, 0.585), (0.08, 0.0, 0.53), 0.01, m["frame"], segments=4)


def _stool(mb, m, x, y):
    mb.cylinder((x, y, 0.66), 0.18, 0.06, m["rattan"], segments=10)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lx, ly = x + sx * 0.11, y + sy * 0.11
            mb.box((lx - 0.0175, ly - 0.0175, 0.0), (lx + 0.0175, ly + 0.0175, 0.66), m["teak"])
    mb.cylinder((x, y, 0.28), 0.14, 0.03, m["rattan"], segments=10)


def outdoor_bar(mb, m, w, d, h):
    # Teak counter with a fluted front and a travertine top, on the +Y side; three rattan stools in front of it (-Y).
    mb.box((-1.15, 0.12, 0.0), (1.15, 0.58, 0.98), m["teak"])
    slats = 14
    step = 2.3 / slats
    for i in range(slats):
        x = -1.15 + i * step
        mb.box((x + 0.02, 0.08, 0.04), (x + step - 0.02, 0.12, 0.96), m["teak"])
    mb.box((-1.2, 0.02, 0.98), (1.2, 0.65, h), m["stone"], uv_tile=2.0)
    for x in (-0.7, 0.0, 0.7):
        _stool(mb, m, x, -0.32)


BUILDERS = {
    "palm_tall": palm_tall, "palm_small": palm_small, "monstera": monstera, "bird_of_paradise": bird_of_paradise,
    "fern_hanging": fern_hanging, "plant_wall": plant_wall, "rattan_pendant": rattan_pendant,
    "rattan_armchair": rattan_armchair, "egg_chair": egg_chair, "daybed_cabana": daybed_cabana,
    "teak_lounger": teak_lounger, "lantern": lantern, "outdoor_bar": outdoor_bar,
}

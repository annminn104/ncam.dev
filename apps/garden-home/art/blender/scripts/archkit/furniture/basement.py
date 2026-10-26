"""The basement's pieces (art/README.md, Basement): the wine cellar's racks of bottles, barrels and tasting table;
the karaoke lounge's U-shaped velvet sofa, TV, tower speakers, microphones and disco ball; the spa's sauna cabin (built
whole or as its cabin and the stones of its stove, part=), massage bed, small stone-edged hot tub, shelf of oils and
candles; the gym's treadmill, squat rack, dumbbell rack, mirror and yoga mat; the light well's palm and uplights.

The basement merges them per material into a few objects (furniture.place_into), so each is drawn in flat palette
colours from boxes and low cylinders: a few hundred triangles at most, from the website's distance a rack of bottles is
a lattice of glass ends, not bottles.
"""
import math
import random

from .tropical import _palm

SAUNA_PARTS = ("cabin", "door", "stones")


def _end(mb, mat, x, y, z, r):
    """A bottle's end in a rack, seen from the front (-Y): a square of glass `r` across its middle on the plane y,
    turned 45 degrees, facing -Y (two triangles)."""
    points = [(x, y, z - r), (x + r, y, z), (x, y, z + r), (x - r, y, z)]
    mb.faces(points, [(0, 1, 2, 3)], mat)


def wine_rack(mb, m, w, d, h, variant=0):
    # A teak wall rack: two sides, a top and a plinth, shelves between rows of bottles lying neck to the wall, a dark
    # back. From the cellar one sees the bottles' ends, green glass and red wine in a seeded mix, rows of them.
    t = 0.04
    mb.box((-w / 2, -d / 2, 0.0), (-w / 2 + t, d / 2, h), m["teak"], uv_tile=2.0)
    mb.box((w / 2 - t, -d / 2, 0.0), (w / 2, d / 2, h), m["teak"], uv_tile=2.0)
    mb.box((-w / 2 + t, -d / 2, h - t), (w / 2 - t, d / 2, h), m["teak"], uv_tile=2.0)
    mb.box((-w / 2 + t, -d / 2, 0.0), (w / 2 - t, d / 2, 0.1), m["teak"], uv_tile=2.0)
    mb.box((-w / 2 + t, d / 2 - 0.02, 0.1), (w / 2 - t, d / 2, h - t), m["frame"])
    rows, cols = 7, 9
    pitch_z = (h - t - 0.1) / rows
    pitch_x = (w - 2 * t) / cols
    rnd = random.Random(31 + variant)
    for row in range(rows):
        z0 = 0.1 + row * pitch_z
        if row:
            mb.box((-w / 2 + t, -d / 2 + 0.02, z0 - 0.012), (w / 2 - t, d / 2 - 0.02, z0), m["teak"], uv_tile=2.0)
        for col in range(cols):
            x = -w / 2 + t + (col + 0.5) * pitch_x
            mat = m["wine"] if rnd.random() < 0.4 else m["bottle"]
            _end(mb, mat, x, -d / 2 + 0.03, z0 + pitch_z / 2, min(pitch_x, pitch_z) * 0.36)


def wine_barrel(mb, m, w, d, h):
    # An oak barrel lying along Y on a teak cradle: three staves' worth of cylinder, fatter in the middle, with a dark
    # iron hoop near either end.
    radius = w / 2 - 0.01
    z = h - radius
    length = d - 0.04
    for y0, y1, r in ((-length / 2, -length / 6, radius * 0.92), (-length / 6, length / 6, radius),
                      (length / 6, length / 2, radius * 0.92)):
        mb.cylinder((0.0, y0, z), r, y1 - y0, m["teak"], segments=10, axis="y")
    for y in (-length / 2 + 0.1, length / 2 - 0.14):
        mb.cylinder((0.0, y, z), radius * 0.94, 0.04, m["frame"], segments=10, axis="y")
    for y in (-length / 3, length / 3):
        mb.box((-w / 2 + 0.05, y - 0.05, 0.0), (w / 2 - 0.05, y + 0.05, z - radius * 0.7), m["teak"], uv_tile=2.0)


def _bar_stool(mb, m, x, y):
    """A bar stool for the tasting table: a round leather seat at 0.75 m on a steel stem, a foot ring and a disc base."""
    mb.cylinder((x, y, 0.0), 0.18, 0.02, m["frame"], segments=10)
    mb.cylinder((x, y, 0.02), 0.025, 0.7, m["frame"], segments=6)
    mb.cylinder((x, y, 0.3), 0.14, 0.02, m["frame"], segments=10)
    mb.cylinder((x, y, 0.72), 0.18, 0.06, m["leather"], segments=10)


def tasting_table(mb, m, w, d, h):
    # A high granite-topped tasting table on a steel pedestal and base plate, a bar stool tucked under either end.
    mb.box((-0.55, -d / 2 + 0.25, h - 0.04), (0.55, d / 2 - 0.25, h), m["granite"])
    mb.box((-0.06, -0.06, 0.03), (0.06, 0.06, h - 0.04), m["frame"])
    mb.box((-0.3, -0.25, 0.0), (0.3, 0.25, 0.03), m["frame"])
    for sx in (-1, 1):
        _bar_stool(mb, m, sx * (w / 2 - 0.2), 0.0)


def karaoke_sofa(mb, m, w, d, h):
    # A U of plum velvet round a low teak coffee table, open to the front (-Y): the back along +Y and an arm of the U
    # down either side, each a teak plinth, a deep seat and a back cushion on its outer side.
    seat, plinth, top, back = 0.85, 0.08, 0.42, 0.2
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    runs = [((x0, y1 - seat), (x1, y1)), ((x0, y0), (x0 + seat, y1 - seat)), ((x1 - seat, y0), (x1, y1 - seat))]
    for (a0, b0), (a1, b1) in runs:
        mb.box((a0, b0, 0.0), (a1, b1, plinth), m["teak"], uv_tile=2.0)
        mb.box((a0 + 0.02, b0 + 0.02, plinth), (a1 - 0.02, b1 - 0.02, top), m["velvet"])
    mb.box((x0 + 0.02, y1 - back, top), (x1 - 0.02, y1 - 0.02, h), m["velvet"])  # the back's cushion
    for x in (x0 + 0.02, x1 - back):  # the arms' cushions on their outer sides
        mb.box((x, y0 + 0.02, top), (x + back - 0.02, y1 - back, h), m["velvet"])
    mb.box((-0.6, y0 + 0.6, 0.0), (0.6, y0 + 1.3, 0.38), m["teak"], uv_tile=2.0)  # the coffee table


def karaoke_tv(mb, m, w, d, h):
    # A big TV on a stand on a long low teak unit: a black bezel and the screen standing a centimetre proud of it,
    # which glows (the piece is a night light; the party group switches it).
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.42), m["teak"], uv_tile=2.0)
    mb.box((-0.15, -0.05, 0.42), (0.15, 0.05, 0.5), m["frame"])
    mb.box((-1.0, -0.12, 0.5), (1.0, -0.06, h - 0.05), m["frame"])
    mb.box((-0.97, -0.13, 0.53), (0.97, -0.12, h - 0.08), m["screen_on"])


def tower_speaker(mb, m, w, d, h):
    # A tall black cabinet with two woofers and a tweeter on its front, steel rings standing out of it.
    mb.box((-w / 2, -d / 2 + 0.01, 0.0), (w / 2, d / 2, h), m["frame"])
    for z, r in ((0.32, 0.12), (0.62, 0.12), (0.92, 0.05)):
        mb.cylinder((0.0, -d / 2, z), r, 0.012, m["metal"], segments=12, axis="y")


def mic_stand(mb, m, w, d, h):
    # A round black base, a steel pole and a short bar across its top holding two black microphones with steel heads.
    mb.cylinder((0.0, 0.0, 0.0), w / 2 - 0.03, 0.03, m["frame"], segments=12)
    mb.cylinder((0.0, 0.0, 0.03), 0.015, 1.3, m["metal"], segments=6)
    mb.box((-0.16, -0.015, 1.31), (0.16, 0.015, 1.34), m["metal"])
    for sx in (-1, 1):
        base, top = (sx * 0.14, 0.0, 1.34), (sx * 0.17, -0.07, h - 0.05)
        mb.stem(base, top, 0.018, m["frame"], radius_end=0.022, segments=6)
        mb.blob(top, 0.035, m["metal"], subdivisions=1)


def disco_ball(mb, m, w, d, h, cord=0.0):
    # A faceted ball of mirror tiles (an icosphere's flat faces catch the light one by one as it turns,
    # ambient_disco_ball; M_disco glows with the party's LEDs, NIGHT_KINDS) on a short chrome cap, hung on a cord that
    # takes it up to the ceiling (`cord`, like a pendant's).
    radius = w / 2 - 0.02
    mb.blob((0.0, 0.0, radius), radius, m["disco"], subdivisions=2)
    mb.cylinder((0.0, 0.0, 2 * radius - 0.01), 0.03, h - 2 * radius + 0.01, m["chrome"], segments=6)
    if cord > 0:
        mb.cylinder((0.0, 0.0, h), 0.006, cord, m["frame"], segments=4)


def sauna_cabin(mb, m, w, d, h, part=None):
    # A cabin of pale wood: solid walls on its back and sides and either side of the glass door on its front (-Y), a
    # flat roof, two tiers of benches along its back; in the front left corner the stove, a steel box with a basket of
    # stones on top that glow while the sauna runs. Built whole or as its cabin, its glass door (part "door": the
    # basement builds it with its glass walls, so its spa draws opaque) and the stones (part "stones": the sauna group's
    # object).
    if part is not None and part not in SAUNA_PARTS:
        raise ValueError(f"sauna_cabin part must be one of {SAUNA_PARTS} or None, got {part!r}")
    t = 0.06
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    if part in (None, "cabin"):
        wood = m["rattan"]
        mb.box((x0, y1 - t, 0.0), (x1, y1, h - t), wood)
        mb.box((x0, y0, 0.0), (x0 + t, y1 - t, h - t), wood)
        mb.box((x1 - t, y0, 0.0), (x1, y1 - t, h - t), wood)
        door = (0.0, 0.8)  # the glass door's x range, right of the front's middle
        mb.box((x0 + t, y0, 0.0), (door[0], y0 + t, h - t), wood)
        mb.box((door[1], y0, 0.0), (x1 - t, y0 + t, h - t), wood)
        mb.box((door[0], y0, 2.0), (door[1], y0 + t, h - t), wood)
        mb.box((x0, y0, h - t), (x1, y1, h), wood)
        for z, depth in ((0.45, 1.1), (0.9, 0.55)):  # the benches: a slatted top on a riser
            mb.box((x0 + t, y1 - t - depth, z - 0.05), (x1 - t, y1 - t, z), wood)
            mb.box((x0 + t, y1 - t - depth + 0.05, 0.0 if z < 0.5 else 0.45), (x1 - t, y1 - t - depth + 0.1, z - 0.05),
                   wood)
    if part in (None, "door"):
        mb.box((0.0, y0 + 0.02, 0.0), (0.8, y0 + 0.04, 2.0), m["glass"])  # under the front's header, right of its middle
    if part in (None, "stones"):
        sx, sy = x0 + 0.42, y0 + 0.4
        mb.box((sx - 0.22, sy - 0.22, 0.0), (sx + 0.22, sy + 0.22, 0.5), m["metal"])
        rnd = random.Random(23)
        for i in range(9):
            a = 2 * math.pi * i / 9
            r = 0.05 + 0.1 * (i % 3) / 2
            mb.blob((sx + r * math.cos(a), sy + r * math.sin(a), 0.54 + 0.03 * rnd.random()), 0.06, m["ember"],
                    subdivisions=1, squash=0.7)


def massage_bed(mb, m, w, d, h):
    # A teak frame on four legs and a padded linen top with a face cradle at its head (-Y) and a rolled towel at its
    # foot.
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (w / 2 - 0.06), sy * (d / 2 - 0.12)
            mb.box((x - 0.03, y - 0.03, 0.0), (x + 0.03, y + 0.03, 0.6), m["teak"], uv_tile=2.0)
    mb.box((-w / 2 + 0.04, -d / 2 + 0.1, 0.55), (w / 2 - 0.04, d / 2 - 0.05, 0.6), m["teak"], uv_tile=2.0)
    mb.box((-w / 2 + 0.02, -d / 2 + 0.22, 0.6), (w / 2 - 0.02, d / 2, 0.68), m["linen"])
    mb.box((-0.14, -d / 2, 0.6), (0.14, -d / 2 + 0.2, 0.66), m["linen"])
    mb.stem((-w / 2 + 0.06, d / 2 - 0.16, h - 0.04), (w / 2 - 0.06, d / 2 - 0.16, h - 0.04), 0.04, m["linen"],
            segments=8)


def hot_tub_small(mb, m, w, d, h):
    # A small square soaking tub standing on the floor: granite walls round a tiled basin, its rim the stone's top; the
    # module fills it with WATER_ and its bubbles (basement/build_basement.py).
    t = 0.2
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    stone = m["granite"]
    mb.box((x0, y0, 0.0), (x1, y0 + t, h), stone)
    mb.box((x0, y1 - t, 0.0), (x1, y1, h), stone)
    mb.box((x0, y0 + t, 0.0), (x0 + t, y1 - t, h), stone)
    mb.box((x1 - t, y0 + t, 0.0), (x1, y1 - t, h), stone)
    tile, lining, floor = m["tile"], 0.02, 0.12
    mb.box((x0 + t, y0 + t, 0.0), (x1 - t, y1 - t, floor), tile)
    mb.box((x0 + t, y0 + t, floor), (x1 - t, y0 + t + lining, h - 0.02), tile)
    mb.box((x0 + t, y1 - t - lining, floor), (x1 - t, y1 - t, h - 0.02), tile)
    mb.box((x0 + t, y0 + t + lining, floor), (x0 + t + lining, y1 - t - lining, h - 0.02), tile)
    mb.box((x1 - t - lining, y0 + t + lining, floor), (x1 - t, y1 - t - lining, h - 0.02), tile)


def oil_shelf(mb, m, w, d, h):
    # Two teak wall shelves of massage oils, celadon bottles with a neck each (two materials: the spa shows through the
    # light well's glass on the wallpaper, where every material is a draw call).
    for z in (0.0, 0.22):
        mb.box((-w / 2, -d / 2, z), (w / 2, d / 2, z + 0.03), m["teak"], uv_tile=2.0)
        for k in range(5):
            x = -w / 2 + 0.15 + k * (w - 0.3) / 4
            tall = 0.1 + 0.03 * ((k + int(z * 10)) % 3)
            mb.cylinder((x, 0.0, z + 0.03), 0.035, tall, m["glaze"], segments=8)
            mb.cylinder((x, 0.0, z + 0.03 + tall), 0.012, 0.025, m["glaze"], segments=6)


def candle_set(mb, m, w, d, h):
    # Three pillar candles of different heights on a ceramic tray, each with a small flame (the piece is a night
    # light: the flames glow with the spa's lights).
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, 0.02), m["ceramic"])
    for x, tall in ((-0.11, 0.12), (0.0, 0.16), (0.11, 0.09)):
        mb.cylinder((x, 0.0, 0.02), 0.04, tall, m["ceramic"], segments=8)
        mb.octahedron((x, 0.0, 0.02 + tall + 0.02), 0.015, m["led"])


def treadmill(mb, m, w, d, h):
    # A black deck with a rubber belt between steel side rails, two uprights at its front (-Y) up to a console with a
    # steel handlebar.
    mb.box((-w / 2 + 0.05, -d / 2 + 0.2, 0.0), (w / 2 - 0.05, d / 2, 0.16), m["frame"])
    mb.box((-0.25, -d / 2 + 0.25, 0.16), (0.25, d / 2 - 0.05, 0.19), m["rubber"])
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.08)
        mb.box((x - 0.03, -d / 2 + 0.2, 0.16), (x + 0.03, d / 2 - 0.1, 0.2), m["metal"])
        mb.stem((x, -d / 2 + 0.3, 0.16), (x, -d / 2 + 0.08, h - 0.12), 0.03, m["frame"], segments=6)
    mb.box((-w / 2 + 0.05, -d / 2, h - 0.15), (w / 2 - 0.05, -d / 2 + 0.2, h), m["frame"])
    mb.box((-w / 2, -d / 2 + 0.18, h - 0.32), (w / 2, -d / 2 + 0.22, h - 0.28), m["metal"])


def weight_rack(mb, m, w, d, h):
    # A black squat rack at the back (+Y): four uprights tied at the top, a chrome bar on its hooks with black rubber
    # plates either end; in front of it a flat bench, a leather pad on a black frame.
    ys = (d / 2 - 0.85, d / 2 - 0.1)
    for sx in (-1, 1):
        for y in ys:
            x = sx * (w / 2 - 0.2)
            mb.box((x - 0.03, y - 0.03, 0.0), (x + 0.03, y + 0.03, h), m["frame"])
        mb.box((sx * (w / 2 - 0.2) - 0.03, ys[0], h - 0.06), (sx * (w / 2 - 0.2) + 0.03, ys[1], h), m["frame"])
        mb.box((sx * (w / 2 - 0.2) - 0.03, ys[0], 0.0), (sx * (w / 2 - 0.2) + 0.03, ys[1], 0.06), m["frame"])
    for y in ys:
        mb.box((-w / 2 + 0.2, y - 0.03, h - 0.06), (w / 2 - 0.2, y + 0.03, h), m["frame"])
    bar_y, bar_z = ys[0], 1.35
    mb.stem((-w / 2, bar_y, bar_z), (w / 2, bar_y, bar_z), 0.016, m["chrome"], segments=6)
    for sx in (-1, 1):
        mb.stem((sx * (w / 2 - 0.12), bar_y, bar_z), (sx * (w / 2 - 0.04), bar_y, bar_z), 0.22, m["rubber"],
                segments=10)
    mb.box((-0.15, -d / 2 + 0.05, 0.38), (0.15, ys[0] - 0.35, 0.46), m["leather"])
    for y in (-d / 2 + 0.15, ys[0] - 0.45):
        mb.box((-0.12, y - 0.03, 0.0), (0.12, y + 0.03, 0.38), m["frame"])


def dumbbell_rack(mb, m, w, d, h):
    # A black two-tier rack of hex dumbbells, rubber heads on chrome handles, lighter ones on the top tier.
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.03)
        mb.box((x - 0.03, -d / 2, 0.0), (x + 0.03, d / 2, h - 0.08), m["frame"])
    for z, y, head in ((0.38, -0.08, 0.075), (h - 0.12, 0.1, 0.055)):
        mb.box((-w / 2 + 0.06, y - 0.12, z - 0.03), (w / 2 - 0.06, y + 0.12, z), m["frame"])
        for k in range(5):
            x = -w / 2 + 0.2 + k * (w - 0.4) / 4
            mb.stem((x, y - 0.12, z + head), (x, y + 0.12, z + head), 0.014, m["chrome"], segments=4)
            for side in (-1, 1):
                cy = y + side * 0.1
                mb.box((x - head, cy - 0.03, z), (x + head, cy + 0.03, z + 2 * head), m["rubber"])


def mirror_wall(mb, m, w, d, h):
    # A full-width gym mirror on the wall in a thin black frame: a chrome panel, which reflects the room.
    mb.box((-w / 2, 0.0, 0.0), (w / 2, d / 2, h), m["frame"])
    mb.box((-w / 2 + 0.03, -d / 2, 0.03), (w / 2 - 0.03, 0.0, h - 0.03), m["chrome"])


def yoga_mat(mb, m, w, d, h):
    # A sage yoga mat lying flat.
    mb.box((-w / 2, -d / 2, 0.0), (w / 2, d / 2, h), m["cushion"])


def palm_courtyard(mb, m, w, d, h):
    # The light well's palm: a tall one in a low planter, its crown high enough to show over the lawn round the well.
    _palm(mb, m, pot_radius=0.45, pot_height=0.4, crown_z=h - 0.7, lean=0.15, fronds=15, reach=1.05, spear=0.68,
          seed=13)


def uplight(mb, m, w, d, h):
    # A ground spot: a black can with its glowing lens on top (the piece is a night light of the garden's lights).
    mb.cylinder((0.0, 0.0, 0.0), w / 2, h - 0.02, m["frame"], segments=8)
    mb.cylinder((0.0, 0.0, h - 0.02), w / 2 - 0.02, 0.02, m["led"], segments=8)


BUILDERS = {
    "wine_rack": wine_rack, "wine_barrel": wine_barrel, "tasting_table": tasting_table, "karaoke_sofa": karaoke_sofa,
    "karaoke_tv": karaoke_tv, "tower_speaker": tower_speaker, "mic_stand": mic_stand, "disco_ball": disco_ball,
    "sauna_cabin": sauna_cabin, "massage_bed": massage_bed, "hot_tub_small": hot_tub_small, "oil_shelf": oil_shelf,
    "candle_set": candle_set, "treadmill": treadmill, "weight_rack": weight_rack, "dumbbell_rack": dumbbell_rack,
    "mirror_wall": mirror_wall, "yoga_mat": yoga_mat, "palm_courtyard": palm_courtyard, "uplight": uplight,
}

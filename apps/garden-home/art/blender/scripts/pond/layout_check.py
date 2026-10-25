"""Sanity checks on the pond layouts before any geometry is built (villa v2 part 3). Pure Python.

check_koi(layout) returns human-readable problems with a koi pond layout (pond/koi_layout.py); an empty list means it is
buildable. In module space:

- the outline is star-shaped round CENTRE and stays MARGIN metres inside the footprint, its stones too;
- the peaks of the rockery stand on the pond's bank inside the outline, at least one of them in the water, and the
  waterfall falls from the tallest into the water, clear of the bank;
- every koi stays KOI_BANK_CLEAR off the bank (its nose and its tail tip that far inside the water's edge, the bank
  under them FLOOR_CLEAR below its underside) and off the rockery, under the surface (KOI_SURFACE_CLEAR over its dorsal
  fin), and no two koi swim through one another (their middles BODY_CLEAR apart whenever they are less than KOI_BODY
  and their bobs apart in depth: koi of one loop over the whole loop, which their gap repeats, koi of two loops path to
  path, so that the loops of a layer never cross whatever the timing);
- fed, wherever the food falls in the feeding disc (FEEDING), every koi keeps half a body length off the peaks that
  stand in the water and its underside FLOOR_CLEAR over the bank half a body length further out (_check_feed);
- the lotus pads float inside the water, clear of its edge, of one another, of the rockery and of the waterfall's
  foam, and every flower rises from the water among them.

check_site(layout) adds the rules in site space, where the module stands centred on its zone: what the garden's
island-wide modules build on the ground (flower beds, paths, bollards) stays SITE_CLEAR metres off the pond's outline
and its stones.

check_tea(layout) checks a tea corner layout (pond/tea_layout.py) with the garden's rules (garden/layout_check.check:
known kinds, no overlaps, all inside the footprint, the lantern's pool too) and its stepping stones: from the edge of
the paving to the garden walk (garden/paths_layout.py) in site space, no step of grass wider than the walk's MAX_GAP and
none of them on the walk's slabs; check_tea_site(layout) keeps what it builds on the ground off the garden's
island-wide pieces.
"""
import math

from archkit.catalog import FURNITURE, LOTUS_PADS, ROCK_PEAK_JITTER, ROCK_PEAKS

from . import basin, swim

EPS = 1e-6
MARGIN = 0.5  # metres between the pond's outline and the edge of its footprint
STONE_CLEAR = 0.1  # metres between a stone and the edge of the footprint
PAD_EDGE = 0.1  # metres of water between a lotus pad and the pond's edge
FOAM_CLEAR = 0.2  # metres between a lotus pad and the waterfall's foam
FLOWER_REACH = 0.45  # a flower rises this close to a pad of its cluster, at most
BODY_CLEAR = 0.3  # metres between the middles of two koi at the same depth
FLOOR_CLEAR = 0.05  # metres between a koi's underside and the bank or floor under it, at the least
PAIR_SAMPLES = 192  # moments of a loop at which two koi of it are compared
SITE_CLEAR = 0.3  # metres between the pond (its outline and stones) and the garden's island-wide pieces
FEED_SAMPLES = 24  # points of a koi's loop it may leave for the food from
FEED_RIM = 24  # points round the rim of the disc a koi's ring point may reach
FEED_BLEND = (0.25, 0.5, 0.75)  # how far a fed koi has come from its loop to its ring point (1: on its ring)


def peak_reach(variant):
    """How far a rock peak of `variant` reaches over the ground from its middle: its foot, the widest of its rings,
    strays up to ROCK_PEAK_JITTER out of its ellipse (archkit.furniture.pond.rock_peak: its spur, the boulders at its
    foot and its moss stay inside it; the kit's test measures it)."""
    _, sx, sy, _, _ = ROCK_PEAKS[variant]
    w, d, _ = FURNITURE["rock_peak"]
    return max(w / 2 * sx, d / 2 * sy) * (1 + ROCK_PEAK_JITTER)


def _water(layout):
    """The polygon of the water's edge: where the bank drops through the water line."""
    return basin.ring(layout.OUTLINE, layout.CENTRE, _waterline(layout))


def _waterline(layout):
    """The ring (share of the outline) where the bank falls through the water line."""
    for (s0, z0), (s1, z1) in zip(layout.PROFILE, layout.PROFILE[1:]):
        if z1 <= layout.WATER_Z <= z0:
            return s1 + (s0 - s1) * (layout.WATER_Z - z1) / (z0 - z1)
    raise ValueError("the water line is not on the bank's profile")


def _inside_footprint(layout, x, y, reach):
    w, d = layout.FOOTPRINT
    return abs(x) + reach <= w / 2 + EPS and abs(y) + reach <= d / 2 + EPS


def _check_outline(layout):
    problems = []
    w, d = layout.FOOTPRINT
    for k, point in enumerate(layout.OUTLINE, start=1):
        if abs(basin.share(layout.OUTLINE, layout.CENTRE, point) - 1.0) > 1e-4:
            problems.append(f"outline point {k} folds back: the outline is not star-shaped round {layout.CENTRE}")
            break
    if any(not _inside_footprint(layout, x, y, layout_margin(layout)) for x, y in layout.OUTLINE):
        problems.append(f"the outline comes closer than {layout_margin(layout):g} m to the edge of the {w:g} x {d:g} m "
                        f"footprint")
    for k, (x, y, size, _, _) in enumerate(layout.STONES, start=1):
        if not _inside_footprint(layout, x, y, size / 2 + STONE_CLEAR):
            problems.append(f"stone {k} sticks out of the {w:g} x {d:g} m footprint")
    return problems


def layout_margin(layout):
    return getattr(layout, "MARGIN", MARGIN)


def _check_rockery(layout):
    problems = []
    water = _water(layout)
    wet = False
    for k, (variant, (x, y), _, _) in enumerate(layout.PEAKS, start=1):
        if not 0 <= variant < len(ROCK_PEAKS):
            problems.append(f"peak {k}: unknown variant {variant}")
            continue
        if not basin.contains(layout.OUTLINE, (x, y)):
            problems.append(f"peak {k} stands out on the lawn, not on the pond's bank")
        if not _inside_footprint(layout, x, y, peak_reach(variant)):
            problems.append(f"peak {k} sticks out of the footprint")
        wet = wet or basin.contains(water, (x, y))
    if layout.PEAKS and not wet:
        problems.append("the rockery stands on the bank only: none of its peaks is in the water")
    fall = getattr(layout, "WATERFALL", None)
    if fall and layout.PEAKS:
        (x, y, z), facing = fall["top"], math.radians(fall["facing"])
        foot = (x + math.cos(facing) * fall["throw"], y + math.sin(facing) * fall["throw"])
        tallest = min(layout.PEAKS, key=lambda peak: peak[0])
        if math.dist((x, y), tallest[1]) > peak_reach(tallest[0]):
            problems.append("the waterfall does not fall from the tallest peak")
        height = FURNITURE["rock_peak"][2] * ROCK_PEAKS[tallest[0]][0]
        if not layout.WATER_Z < z < height:
            problems.append(f"the waterfall's top ({z:g} m) is not between the water and the peak's tip")
        if not basin.contains(water, foot) or basin.to_outline(water, foot) < fall["foam"]:
            problems.append("the waterfall's foam does not float on the water clear of its edge")
    return problems


def _check_koi(layout):
    problems = []
    water = _water(layout)
    top = layout.WATER_Z - layout.KOI_SURFACE_CLEAR
    for k, loop in enumerate(layout.KOI, start=1):
        if loop["z"] + loop.get("bob", 0.0) + layout.KOI_TOP > top + EPS:
            problems.append(f"koi {k} breaks the surface: its dorsal fin comes within {layout.KOI_SURFACE_CLEAR:g} m "
                            f"of the water line")
        closest, floor, rock = math.inf, -math.inf, math.inf
        for i in range(swim.SAMPLES):
            t = abs(loop["period"]) * i / swim.SAMPLES
            z = swim.position(loop, t)[2]
            for point in swim.body(loop, t, layout.KOI_LENGTH):
                inside = basin.contains(water, point)
                closest = min(closest, basin.to_outline(water, point) if inside else -1.0)
                floor = max(floor, basin.depth_at(layout.OUTLINE, layout.CENTRE, layout.PROFILE, point) - z)
                rock = min([rock] + [math.dist(point, pos) - peak_reach(variant) for variant, pos, _, _ in layout.PEAKS])
        if closest < layout.KOI_BANK_CLEAR - EPS:
            problems.append(f"koi {k} swims {max(closest, 0.0):.2f} m from the bank, closer than "
                            f"{layout.KOI_BANK_CLEAR:g} m")
        if floor > -FLOOR_CLEAR + EPS:
            problems.append(f"koi {k} swims into the bank: the floor comes within {max(-floor, 0.0):.2f} m of its "
                            f"underside")
        if rock < layout.KOI_BANK_CLEAR - EPS:
            problems.append(f"koi {k} swims {max(rock, 0.0):.2f} m from the rockery, closer than "
                            f"{layout.KOI_BANK_CLEAR:g} m")
    paths = [[p[:2] for p in swim.samples(loop)] for loop in layout.KOI]
    for a in range(len(layout.KOI)):
        for b in range(a + 1, len(layout.KOI)):
            one, two = layout.KOI[a], layout.KOI[b]
            if abs(one["z"] - two["z"]) >= layout.KOI_BODY + one.get("bob", 0.0) + two.get("bob", 0.0) - EPS:
                continue  # one swims over the other
            if _same_loop(one, two):  # they follow one another round it: their gap repeats every loop
                period = abs(one["period"])
                near = min(math.dist(swim.position(one, period * i / PAIR_SAMPLES)[:2],
                                     swim.position(two, period * i / PAIR_SAMPLES)[:2]) for i in range(PAIR_SAMPLES))
                if near < BODY_CLEAR - EPS:
                    problems.append(f"koi {a + 1} and koi {b + 1} swim through one another ({near:.2f} m apart)")
                continue
            near = min(min(basin.to_outline(paths[b], point) for point in paths[a]),
                       min(basin.to_outline(paths[a], point) for point in paths[b]))
            if near < BODY_CLEAR - EPS:
                problems.append(f"koi {a + 1} and koi {b + 1} swim loops that cross ({near:.2f} m apart)")
    return problems


def _same_loop(one, two):
    """Whether two koi swim one loop, one after the other (all but their phase alike)."""
    keys = ("centre", "radii", "tilt", "z", "period")
    return (all(one[key] == two[key] for key in keys) and bool(one.get("eight")) == bool(two.get("eight"))
            and one.get("bob", 0.0) == two.get("bob", 0.0))


def _to_segment(point, a, b):
    """How far `point` (x, y) is from the segment a b."""
    (px, py), (ax, ay), (bx, by) = point, a[:2], b[:2]
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1.0)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def _check_feed(layout):
    """Fed koi against the rockery and the bank. swim.fed_position puts a fed koi on the straight line from where its
    loop has it to where its ring has it, as far as its hunger says. The food falls anywhere in the feeding disc and the
    rings turn, so a koi's ring point may be anywhere within the disc's radius plus its ring's of the disc's middle: the
    check samples the lines from its loop to the rim of that wider disc (they sweep all of it) and the koi on its ring
    anywhere in it, at its ring's depth."""
    feeding = getattr(layout, "FEEDING", None)
    if not feeding or not layout.KOI:
        return []
    water = _water(layout)
    (cx, cy), radius = feeding["centre"], feeding["radius"]
    if not basin.contains(water, (cx, cy)):
        return ["the feeding disc's middle is not in the water"]
    wet = [(pos, peak_reach(variant)) for variant, pos, _, _ in layout.PEAKS if basin.contains(water, pos)]
    share = basin.share_finder(layout.OUTLINE, layout.CENTRE)
    margin = layout.KOI_LENGTH / 2
    circle = [(math.cos(2 * math.pi * i / FEED_RIM), math.sin(2 * math.pi * i / FEED_RIM)) for i in range(FEED_RIM)]

    def floor(x, y, z):
        """The bank half a body length further out from the pond's middle than (x, y), less the underside z."""
        dx, dy = x - layout.CENTRE[0], y - layout.CENTRE[1]
        out = margin / (math.hypot(dx, dy) or 1.0)
        return basin.height(layout.PROFILE, share((x + dx * out, y + dy * out))) - z

    problems = []
    for k, loop in enumerate(layout.KOI, start=1):
        ring = (k - 1) % 2
        reach, z_ring = radius + swim.FEED["rings"][ring], layout.WATER_Z - swim.FEED["depths"][ring]
        rim = [(cx + reach * u, cy + reach * v) for u, v in circle]
        held = rim + [(cx + reach * u / 2, cy + reach * v / 2) for u, v in circle[::2]] + [(cx, cy)]
        rock, under = math.inf, max(floor(x, y, z_ring) for x, y in held)
        for i in range(FEED_SAMPLES):
            p = swim.position(loop, abs(loop["period"]) * i / FEED_SAMPLES)
            for g in rim:
                rock = min([rock] + [_to_segment(pos, p, g) - r for pos, r in wet])
                for w in FEED_BLEND:
                    under = max(under, floor(p[0] + (g[0] - p[0]) * w, p[1] + (g[1] - p[1]) * w,
                                             p[2] + (z_ring - p[2]) * w))
        if rock < margin - EPS:
            problems.append(f"fed koi {k} swims {max(rock, 0.0):.2f} m from the rockery, closer than {margin:g} m")
        if under > -FLOOR_CLEAR + EPS:
            problems.append(f"fed koi {k} swims into the bank: the floor comes within {max(-under, 0.0):.2f} m of its "
                            f"underside")
    return problems


def _check_lotus(layout):
    problems = []
    water = _water(layout)
    fall = getattr(layout, "WATERFALL", None)
    foam = None
    if fall:
        (x, y, _), facing = fall["top"], math.radians(fall["facing"])
        foam = ((x + math.cos(facing) * fall["throw"], y + math.sin(facing) * fall["throw"]), fall["foam"])
    pads = []
    for k, (x, y, variant, _) in enumerate(layout.PADS, start=1):
        if not 0 <= variant < len(LOTUS_PADS):
            problems.append(f"pad {k}: unknown variant {variant}")
            continue
        radius = LOTUS_PADS[variant][0]
        if not basin.contains(water, (x, y)) or basin.to_outline(water, (x, y)) < radius + PAD_EDGE - EPS:
            problems.append(f"pad {k} does not float clear of the pond's edge")
        for j, (other, r) in enumerate(pads, start=1):
            if math.dist((x, y), other) < radius + r - EPS:
                problems.append(f"pad {j} overlaps pad {k}")
        for variant_peak, pos, _, _ in layout.PEAKS:
            if math.dist((x, y), pos) < radius + peak_reach(variant_peak) - EPS:
                problems.append(f"pad {k} floats into the rockery")
                break
        if foam and math.dist((x, y), foam[0]) < radius + foam[1] + FOAM_CLEAR - EPS:
            problems.append(f"pad {k} floats in the waterfall's foam")
        pads.append(((x, y), radius))
    for k, (x, y, _) in enumerate(layout.FLOWERS, start=1):
        if not basin.contains(water, (x, y)):
            problems.append(f"flower {k} is not in the water")
        elif not any(math.dist((x, y), pos) <= r + FLOWER_REACH for pos, r in pads):
            problems.append(f"flower {k} rises alone, away from the pads")
    return problems


def check_koi(layout):
    return (_check_outline(layout) + _check_rockery(layout) + _check_koi(layout) + _check_feed(layout)
            + _check_lotus(layout))


def site_outline(layout):
    """The pond's outline and its stones (circles as polygons) in site space, where the module stands centred on its
    zone (siteplan/zones.py)."""
    from siteplan import zones
    (x0, y0), (x1, y1) = zones.ZONES[layout.ZONE]
    ox, oy = (x0 + x1) / 2, (y0 + y1) / 2
    stones = [[(ox + x + size / 2 * math.cos(2 * math.pi * k / 8), oy + y + size / 2 * math.sin(2 * math.pi * k / 8))
               for k in range(8)] for x, y, size, _, _ in layout.STONES]
    return [(ox + x, oy + y) for x, y in layout.OUTLINE], stones


def check_site(layout, layouts=None):
    """The pond against the garden's island-wide modules (or `layouts`): their pieces and paths keep SITE_CLEAR off
    it."""
    from garden import layout_check as garden_check
    from garden import shapes
    outline, stones = site_outline(layout)
    problems = []
    for module in garden_check.island_layouts() if layouts is None else layouts:
        for label, shape in garden_check.ground(module):
            gap = min([min(basin.to_outline(outline, corner) for corner in shape)]
                      + [shapes.gap(shape, stone) for stone in stones])
            inside = any(basin.contains(outline, corner) for corner in shape)
            if inside or gap < SITE_CLEAR - EPS:
                problems.append(f"{label} ({module.MODULE_ID}) comes within {SITE_CLEAR:g} m of the pond")
    return problems


def _site_origin(layout):
    """Where a pond module's origin stands in site space: the centre of its zone."""
    from siteplan import zones
    (x0, y0), (x1, y1) = zones.ZONES[layout.ZONE]
    return (x0 + x1) / 2, (y0 + y1) / 2


def _check_steps(layout):
    from garden import paths_layout, shapes
    ox, oy = _site_origin(layout)
    steps = [[(ox + x, oy + y) for x, y in step] for step in layout.STEPS]
    centre = (ox + layout.PAVING["centre"][0], oy + layout.PAVING["centre"][1])
    radius = layout.PAVING["radius"]
    reach = paths_layout.MAX_GAP
    problems = []
    if not steps:
        return ["no stepping stones lead to the walk"]
    first = min(math.dist(corner, centre) for corner in steps[0]) - radius
    if first > reach + EPS:
        problems.append(f"stepping stones: {first:.2f} m of grass between the paving and the first stone, more than "
                        f"{reach:g} m")
    for k, (a, b) in enumerate(zip(steps, steps[1:]), start=1):
        gap = shapes.gap(a, b)
        if gap > reach + EPS:
            problems.append(f"stepping stones: {gap:.2f} m of grass between stones {k} and {k + 1}, more than "
                            f"{reach:g} m")
    walk = paths_layout.STONES
    for k, step in enumerate(steps, start=1):
        if any(shapes.overlap(step, slab) for slab in walk):
            problems.append(f"stepping stone {k} lies on the walk")
    last = min(shapes.gap(steps[-1], slab) for slab in walk)
    if last > reach + EPS:
        problems.append(f"stepping stones: {last:.2f} m of grass between the last stone and the walk, more than "
                        f"{reach:g} m")
    return problems


def check_tea(layout):
    from garden import layout_check as garden_check
    return garden_check.check(layout) + _check_steps(layout)


def check_tea_site(layout, layouts=None):
    """What the tea corner builds on the ground against the garden's island-wide modules (or `layouts`): no overlap."""
    from garden import layout_check as garden_check
    from garden import shapes
    ox, oy = _site_origin(layout)
    ours = [(label, [(ox + x, oy + y) for x, y in shape]) for label, shape in garden_check.ground(layout)]
    problems = []
    for module in garden_check.island_layouts() if layouts is None else layouts:
        for label, shape in garden_check.ground(module):
            for mine, polygon in ours:
                if shapes.overlap(shape, polygon):
                    problems.append(f"{mine} overlaps {label} ({module.MODULE_ID})")
    return problems

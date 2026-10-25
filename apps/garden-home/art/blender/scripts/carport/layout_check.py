"""Sanity checks on the carport and kennel layouts before any geometry is built (villa v2 part 4). Pure Python.

check_carport(layout) returns human-readable problems with a carport layout (carport/carport_layout.py); an empty list
means it is buildable. In module space:

- the roof, the slab, what stands on it (structure(): the pillar, the posts, the wall, the cabinet and the bicycle) and
  the pools of light stay inside the footprint, and what stands on the slab does not overlap itself;
- every car is a known kind at a catalog rotation, stands in its bay (BAYS, one per car) at least SIDE_CLEAR from
  either side of it, under the roof with ROOF_CLEAR between its top and the lowest the roof comes (heights()), and
  clear of the structure and of the other car;
- the downlights hang under a beam inside the fascia and their pools of light (POOLS) lie on the slab;
- every interact group id (carport/interact.py) matches interact.GROUP_RE.

check_carport_site(layout) adds the rules in site space, where the module stands centred on its zone: the carport (its
roof, slab and structure) keeps HOUSE_CLEAR off the house's footprint (its slot in siteplan/zones.py), the light the
cars' headlights cast ahead of them (car_pools) stays on the island and off the house and lies over the driveway's
kerbs, the driveway (garden/paths_layout.py, its APRON) ends on the slab's front edge, across the whole of it and flush
with it, and the roof keeps TREE_CLEAR off the trunks of the yard's trees (their canopies are 1.2 m round,
dev/make_placeholders.py).

check_kennel(layout) checks a kennel layout (carport/kennel_layout.py) with the garden's rules
(garden/layout_check.check: known kinds at catalog rotations, wind only for plants that sway, no overlaps, everything
inside the footprint) and the dog's: the Akita sits on its mat (its middle on it), clear of the other pieces and inside
the footprint, facing the lawn (towards -Y) and within FACING degrees of the wallpaper camera (siteplan/zones.py
CAM_idle) from where it sits in site space, and its clips are named as the contract wants (ambient_* and act_*).
"""
import math

import contract
from archkit.catalog import FURNITURE, ROTATIONS, footprint
from garden import lights, paths_layout, shapes
from siteplan import zones

from . import interact

EPS = 1e-6
SIDE_CLEAR = 0.5  # metres between a car and either side of its bay, at the least
ROOF_CLEAR = 0.3  # metres between a car's top (the pickup's roof bars) and the roof's fascia and beams
HOUSE_CLEAR = 1.0  # metres between the carport and the house's footprint
TREE_CLEAR = 1.5  # metres between the roof and a tree's trunk: its 1.2 m canopy and a little air
BIKE_WIDTH = 0.56  # across a bicycle's handlebar
FACING = 30.0  # degrees between where the dog looks and the wallpaper camera, at the most
NOSE = 0.05  # metres behind a car's nose its headlights' pool starts, under the bumper


def site_origin(layout):
    """Where a module's origin stands in site space: the centre of its zone."""
    (x0, y0), (x1, y1) = zones.ZONES[layout.ZONE]
    return (x0 + x1) / 2, (y0 + y1) / 2


def _box(corners):
    (x0, y0), (x1, y1) = corners
    return shapes.box((x0, y0, x1, y1))


def _car(car):
    return shapes.rect(car["pos"], footprint(car["kind"], car["rot"]))


def heights(layout):
    """The heights of the roof's parts over the ground: the glass sheet's underside, the louvres' bottom, the beams'
    bottom (where the downlights hang) and the lowest the roof comes, the fascia's underside or the beams'."""
    roof, louvres = layout.ROOF, layout.LOUVRES
    glass = roof["top"] - louvres["glass"]
    slats = glass - louvres["depth"]
    beams = slats - layout.BEAMS["depth"]
    return {"glass": glass, "slats": slats, "beams": beams, "lowest": min(roof["under"], beams)}


def structure(layout):
    """(label, polygon) of what stands on the slab besides the cars: the pillar, the posts, the back wall, the cabinet
    and the bicycle."""
    pillar, bike = layout.PILLAR, layout.BIKE
    return ([("pillar", shapes.rect(pillar["center"], (pillar["size"], pillar["size"])))]
            + [(f"post {k}", shapes.rect(post, (layout.POST, layout.POST))) for k, post in enumerate(layout.POSTS, 1)]
            + [("back wall", shapes.box(layout.WALL)),
               ("cabinet", _box((layout.CABINET["min"], layout.CABINET["max"]))),
               ("bicycle", shapes.rect(bike["center"], (bike["base"] + 2 * bike["wheel"], BIKE_WIDTH)))])


def car_pools(layout):
    """The pools of light the cars' headlights cast on the ground ahead of them, one per car in its lights' object: the
    half disc of HEADLIGHT_POOL towards -Y from the middle of its nose (they reach past the slab, so the footprint does
    not hold them)."""
    found = []
    for car in layout.CARS:
        _, d = footprint(car["kind"], car["rot"])
        x, y = car["pos"]
        found.append({"group": car["lights"], "center": (x, y - d / 2 + NOSE), "radius": layout.HEADLIGHT_POOL,
                      "start": -math.pi, "sweep": math.pi})  # the half facing -Y (garden/lights.py pool's halves)
    return found


def _pools(layout):
    return [(f"{pool['group']} pool {k}", lights.outline(pool)) for k, pool in enumerate(layout.POOLS, start=1)]


def _check_footprint(layout):
    w, d = layout.FOOTPRINT
    items = [("roof", _box((layout.ROOF["min"], layout.ROOF["max"]))), ("slab", shapes.box(layout.SLAB))]
    problems = []
    standing = structure(layout)
    for label, shape in items + standing + _pools(layout):
        x0, y0, x1, y1 = shapes.bounds(shape)
        if x0 < -w / 2 - EPS or y0 < -d / 2 - EPS or x1 > w / 2 + EPS or y1 > d / 2 + EPS:
            problems.append(f"{label} sticks out of the {w:g} x {d:g} m footprint")
    for i, (a, pa) in enumerate(standing):
        for b, pb in standing[i + 1:]:
            if shapes.overlap(pa, pb):
                problems.append(f"{a} overlaps {b}")
    return problems


def _check_cars(layout):
    problems = []
    if len(layout.BAYS) != len(layout.CARS):
        return [f"{len(layout.CARS)} cars for {len(layout.BAYS)} bays"]
    roof = _box((layout.ROOF["min"], layout.ROOF["max"]))
    lowest = heights(layout)["lowest"]
    parked = []
    for car, bay in zip(layout.CARS, layout.BAYS):
        name = car["name"]
        if car["kind"] not in FURNITURE:
            problems.append(f"{name}: unknown kind '{car['kind']}'")
            continue
        if car["rot"] not in ROTATIONS:
            problems.append(f"{name}: rotation must be one of {list(ROTATIONS)}, got {car['rot']}")
            continue
        shape = _car(car)
        x0, y0, x1, y1 = shapes.bounds(shape)
        (bx0, by0), (bx1, by1) = bay["min"], bay["max"]
        if x0 < bx0 - EPS or y0 < by0 - EPS or x1 > bx1 + EPS or y1 > by1 + EPS:
            problems.append(f"{name} sticks out of its bay")
        for side, gap in (("west", x0 - bx0), ("east", bx1 - x1)):
            if gap < SIDE_CLEAR - EPS:
                problems.append(f"{name} is {gap:.2f} m from the {side} side of its bay, less than {SIDE_CLEAR:g} m")
        for label, other in structure(layout) + parked:
            if shapes.overlap(shape, other):
                problems.append(f"{name} overlaps {label}")
        if not all(shapes.distance(roof, corner) == 0.0 for corner in shape):
            problems.append(f"{name} is not under the roof")
        room = lowest - layout.SLAB_TOP - FURNITURE[car["kind"]][2]
        if room < ROOF_CLEAR - EPS:
            problems.append(f"{name} has {room:.2f} m under the roof, less than {ROOF_CLEAR:g} m")
        parked.append((name, shape))
    return problems


def _check_lights(layout):
    (rx0, ry0), (rx1, ry1), fascia = layout.ROOF["min"], layout.ROOF["max"], layout.ROOF["fascia"]
    half = layout.BEAMS["width"] / 2
    problems = [f"downlight {k} at ({x:g}, {y:g}) hangs under no beam inside the fascia"
                for k, (x, y) in enumerate(layout.DOWNLIGHTS, start=1)
                if not (rx0 + fascia + EPS < x < rx1 - fascia - EPS and ry0 + fascia + EPS < y < ry1 - fascia - EPS
                        and any(abs(y - beam) <= half + EPS for beam in layout.BEAMS["ys"]))]
    slab = shapes.box(layout.SLAB)
    for label, outline in _pools(layout):
        if any(shapes.distance(slab, corner) > EPS for corner in outline):
            problems.append(f"{label} spills off the slab")
    return problems


def check_carport(layout):
    problems = _check_footprint(layout) + _check_cars(layout) + _check_lights(layout)
    for name, props in interact.tags(layout).items():
        if not interact.GROUP_RE.match(props["interact"]):
            problems.append(f"{name}: group '{props['interact']}' must match {interact.GROUP_RE.pattern}")
    return problems


def _site(layout, shape):
    ox, oy = site_origin(layout)
    return [(ox + x, oy + y) for x, y in shape]


def house_gap(layout):
    """The clear distance between the carport (its roof, slab and structure) and the house's footprint, in site
    space."""
    (house,) = [spec for spec in zones.SLOTS.values() if spec["module"] == "house"]
    (hx, hy), (hw, hd) = house["pos"], house["footprint"]
    walls = shapes.rect((hx, hy), (hw, hd))
    parts = [_box((layout.ROOF["min"], layout.ROOF["max"])), shapes.box(layout.SLAB)]
    parts += [shape for _, shape in structure(layout)]
    return min(shapes.gap(_site(layout, part), walls) for part in parts)


def check_carport_site(layout):
    problems = []
    gap = house_gap(layout)
    if gap < HOUSE_CLEAR - EPS:
        problems.append(f"the carport comes within {gap:.2f} m of the house, less than {HOUSE_CLEAR:g} m")
    ox, oy = site_origin(layout)
    x0, y0, x1, y1 = layout.SLAB
    dx0, _, dx1, end = shapes.bounds(paths_layout.APRON)  # the driveway's end, flared out to the bays
    front = oy + y0
    if front - end > EPS:
        problems.append(f"the driveway ends {front - end:.2f} m short of the carport's slab")
    elif end - front > EPS:
        problems.append(f"the driveway runs {end - front:.2f} m onto the carport's slab")
    if ox + x0 > dx0 + EPS or ox + x1 < dx1 - EPS:
        problems.append("the carport's slab does not reach across the driveway's end")
    if abs(layout.SLAB_TOP - paths_layout.DRIVEWAY_TOP) > EPS:
        problems.append(f"the carport's slab is not flush with the driveway ({layout.SLAB_TOP:g} m, the driveway "
                        f"{paths_layout.DRIVEWAY_TOP:g} m)")
    from siteplan import island
    rim = island.outline(zones.ISLAND)
    (house,) = [spec for spec in zones.SLOTS.values() if spec["module"] == "house"]
    walls = shapes.rect(house["pos"], house["footprint"])
    for pool in car_pools(layout):
        outline = _site(layout, lights.outline(pool))
        if not shapes.inside_rim(outline, rim):
            problems.append(f"{pool['group']}'s pool of light falls off the island")
        if shapes.overlap(outline, walls):
            problems.append(f"{pool['group']}'s pool of light falls on the house")
    if layout.HEADLIGHT_POOL_TOP <= paths_layout.KERB_TOP + EPS:  # the kerbs would show through it as dark stripes
        problems.append(f"the headlights' pools lie under the driveway's kerbs ({layout.HEADLIGHT_POOL_TOP:g} m, the "
                        f"kerbs {paths_layout.KERB_TOP:g} m)")
    roof = _site(layout, _box((layout.ROOF["min"], layout.ROOF["max"])))
    for x, y in zones.TREES:
        distance = shapes.distance(roof, (x, y))
        if distance < TREE_CLEAR - EPS:
            problems.append(f"the roof is {distance:.2f} m from the tree at ({x:g}, {y:g}), less than {TREE_CLEAR:g} m")
    return problems


def _turned(centre, size, yaw):
    """The w x d rectangle centred on `centre`, turned `yaw` degrees counter-clockwise."""
    (x, y), (w, d), a = centre, size, math.radians(yaw)
    cos, sin = math.cos(a), math.sin(a)
    return [(x + cos * u - sin * v, y + sin * u + cos * v)
            for u, v in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


def dog_facing(layout):
    """How many degrees the dog looks off the wallpaper camera, from where it sits in site space (it is built facing
    -Y and turned by its yaw)."""
    ox, oy = site_origin(layout)
    x, y = layout.DOG["pos"]
    cx, cy, _ = zones.CAMERAS["CAM_idle"]["pos"]
    towards = math.degrees(math.atan2(cx - ox - x, -(cy - oy - y)))  # the yaw that would face the camera
    return abs((towards - layout.DOG["yaw"] + 180.0) % 360.0 - 180.0)


def check_kennel(layout):
    from garden import layout_check as garden_check
    problems = garden_check.check(layout)
    dog = layout.DOG
    w, d, _ = FURNITURE["akita"]
    shape = _turned(dog["pos"], (w, d), dog["yaw"])
    ground = garden_check.ground(layout)
    mats = [shapes.rect(pos[:2], footprint(kind, rot)) for kind, _, pos, rot, *_ in layout.PIECES if kind == "dog_mat"]
    if not any(shapes.distance(mat, dog["pos"]) == 0.0 for mat in mats):
        problems.append("the dog is not on its mat")
    for label, other in ground:
        if not label.endswith("(dog_mat)") and shapes.overlap(shape, other):
            problems.append(f"the dog overlaps {label}")
    fw, fd = layout.FOOTPRINT
    x0, y0, x1, y1 = shapes.bounds(shape)
    if x0 < -fw / 2 - EPS or y0 < -fd / 2 - EPS or x1 > fw / 2 + EPS or y1 > fd / 2 + EPS:
        problems.append(f"the dog sticks out of the {fw:g} x {fd:g} m footprint")
    off = dog_facing(layout)
    if off > FACING + EPS:
        problems.append(f"the dog faces {off:.0f} degrees off the wallpaper camera, more than {FACING:g}")
    if math.cos(math.radians(dog["yaw"])) <= 0.0:
        problems.append("the dog faces away from the lawn")
    for clip in (layout.BREATHE, layout.WAG, layout.HAPPY):
        if not contract.CLIP_RE.match(clip["clip"]):
            problems.append(f"clip '{clip['clip']}' must match ambient_* or act_*")
    for name, props in interact.tags(layout).items():
        if not interact.GROUP_RE.match(props["interact"]):
            problems.append(f"{name}: group '{props['interact']}' must match {interact.GROUP_RE.pattern}")
    return problems

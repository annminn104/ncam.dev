"""Sanity checks on the basement's layout before any geometry is built (villa v2 spec §12 "Tầng hầm"). Pure Python.

check(layout) returns human-readable problems; an empty list means the basement is buildable. It runs the house's
checks first (houses/layout_check.py: rooms in the footprint, furniture in its rooms and clear of each other, of the
doorways and of the passages, two to four downlights a room, a wall switch per lit room under the cut of its level, the
click groups' ids), then the basement's own:

- its heights: the floor's finish 2 cm over BASEMENT_FLOOR, the ceiling the ground slab's underside, the cut
  CUT_ABOVE_FLOOR over the floor (house_parts/common.py);
- the rooms lie inside the retaining walls, do not overlap and tile the inside between them, and every room has a way
  in from the hall (links: a door of a partition, a passage);
- every piece merged "into" an object names one of OBJECTS; every floor piece stands on a room's FLOORS entry; the
  pools of light lie inside the room of their downlights;
- the light well lies in its zone (siteplan/zones.py, where the basement's slot puts it in site space), its back on the
  plinth's front face, the basement's front wall; its pieces are known kinds at catalog rotations, sway only if they
  are plants of catalog.WIND_SPANS, stand inside it, clear of one another, and go into objects of OBJECTS.
"""
from archkit.catalog import FURNITURE, OVERLAYS, ROTATIONS, WIND_SPANS, footprint
from houses import layout_check as house_check
from houses.house_parts.common import BASEMENT_CEIL, BASEMENT_FLOOR, CUT_ABOVE_FLOOR, TERRACE
from houses.interact import room_at
from siteplan import zones

EPS = 1e-6
HALL = "basement_hall"
_OWN = frozenset({"light_switch", "spiral_stair"})  # pieces that are objects of their own


def _rect(room):
    (x0, y0), (x1, y1) = room["min"], room["max"]
    return x0, y0, x1, y1


def _overlap(a, b):
    return a[0] < b[2] - EPS and b[0] < a[2] - EPS and a[1] < b[3] - EPS and b[1] < a[3] - EPS


def _across(start, end, offset, width, level, rooms):
    """The rooms either side of the opening `offset` .. `offset + width` along the line from start to end."""
    (x0, y0), (x1, y1) = start, end
    length = abs(x1 - x0) + abs(y1 - y0)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    mx, my = x0 + ux * (offset + width / 2), y0 + uy * (offset + width / 2)
    return tuple(room_at(rooms, level, (mx + side * 0.2 * uy, my - side * 0.2 * ux)) for side in (-1, 1))


def links(layout):
    """(room, room) for every way between two rooms: the doors of the partitions and the passages."""
    found = []
    for wall in getattr(layout, "PARTITIONS", []):
        for offset, width in wall.get("doors", []):
            found.append(_across(wall["start"], wall["end"], offset, width, wall["level"], layout.ROOMS))
    for passage in getattr(layout, "PASSAGES", []):
        (x0, y0), (x1, y1) = passage["start"], passage["end"]
        found.append(_across((x0, y0), (x1, y1), 0.0, abs(x1 - x0) + abs(y1 - y0), passage["level"], layout.ROOMS))
    return [(a, b) for a, b in found if a is not None and b is not None and a != b]


def _check_heights(layout):
    problems = []
    if abs(layout.FLOOR - (BASEMENT_FLOOR + 0.02)) > EPS:
        problems.append(f"the floor's finish {layout.FLOOR:g} must lie 2 cm over BASEMENT_FLOOR {BASEMENT_FLOOR:g}")
    if abs(layout.CEIL - BASEMENT_CEIL) > EPS:
        problems.append(f"the ceiling {layout.CEIL:g} must be the ground slab's underside, BASEMENT_CEIL {BASEMENT_CEIL:g}")
    cut = layout.CUT_HEIGHTS.get(layout.LEVEL)
    if cut is None or abs(cut - (BASEMENT_FLOOR + CUT_ABOVE_FLOOR)) > EPS:
        problems.append(f"the cut of level {layout.LEVEL} must run {CUT_ABOVE_FLOOR:g} m over BASEMENT_FLOOR")
    return problems


def _check_rooms(layout):
    problems = []
    (ix0, iy0), (ix1, iy1) = layout.INSIDE
    total = 0.0
    for room in layout.ROOMS:
        x0, y0, x1, y1 = _rect(room)
        total += (x1 - x0) * (y1 - y0)
        if x0 < ix0 - EPS or y0 < iy0 - EPS or x1 > ix1 + EPS or y1 > iy1 + EPS:
            problems.append(f"room '{room['name']}' reaches into the retaining walls")
    for i, a in enumerate(layout.ROOMS):
        for b in layout.ROOMS[i + 1:]:
            if _overlap(_rect(a), _rect(b)):
                names = sorted((a["name"], b["name"]))
                problems.append(f"rooms '{names[0]}' and '{names[1]}' overlap")
    inside = (ix1 - ix0) * (iy1 - iy0)
    if not problems and abs(total - inside) > 1e-4:
        problems.append(f"the rooms cover {total:.2f} of the {inside:.2f} m² inside the retaining walls")
    reached, todo, ways = {HALL}, [HALL], links(layout)
    while todo:
        here = todo.pop()
        for a, b in ways:
            there = b if a == here else a if b == here else None
            if there is not None and there not in reached:
                reached.add(there)
                todo.append(there)
    problems += [f"there is no way from the hall into room '{room['name']}'" for room in layout.ROOMS
                 if room["name"] not in reached]
    return problems


def _check_objects(layout):
    problems = []
    for kind, name, room, _pos, _rot, *opts in layout.FURNITURE:
        into = (opts[0] if opts else {}).get("into")
        if kind in _OWN:
            continue
        if into not in layout.OBJECTS:
            problems.append(f"{name} ({kind}) goes into '{into}', which is not one of the basement's OBJECTS")
    floored = {room for room, _key, _object in layout.FLOORS}
    problems += [f"room '{room['name']}' has no floor in FLOORS" for room in layout.ROOMS
                 if room["name"] not in floored]
    rooms = {room["name"]: _rect(room) for room in layout.ROOMS}
    by_group = {group["name"]: group.get("room") for group in layout.DOWNLIGHTS}
    for pool in layout.POOLS:
        room = by_group.get(pool["group"])
        if room is None:
            continue
        (x, y), r = pool["center"], pool["radius"]
        x0, y0, x1, y1 = rooms[room]
        if x - r < x0 - EPS or y - r < y0 - EPS or x + r > x1 + EPS or y + r > y1 + EPS:
            problems.append(f"the pool of light at ({x:g}, {y:g}) spills out of room '{room}'")
    return problems


def _check_well(layout):
    problems = []
    (wx0, wy0), (wx1, wy1) = layout.WELL["min"], layout.WELL["max"]
    slot = next(spec for spec in zones.SLOTS.values() if spec["module"] == layout.MODULE_ID)
    sx, sy = slot["pos"]  # the slot is the house's, unturned (zones_check: ZONE_SHARED)
    (zx0, zy0), (zx1, zy1) = zones.ZONES[layout.WELL_ZONE]
    if not (zx0 - EPS <= wx0 + sx and wx1 + sx <= zx1 + EPS and zy0 - EPS <= wy0 + sy):
        problems.append(f"the light well ({wx0 + sx:g}, {wy0 + sy:g})..({wx1 + sx:g}, {wy1 + sy:g}) in site space "
                        f"sticks out of zone '{layout.WELL_ZONE}'")
    if abs(wy1 - TERRACE) > EPS:
        problems.append(f"the light well's back must be the plinth's front face, y {TERRACE:g}, got {wy1:g}")
    (ix0, iy0), (ix1, iy1) = layout.WELL_INSIDE
    placed = []
    for kind, obj, (x, y, _z), rot, *opts in layout.WELL_PIECES:
        what = f"{kind} at ({x:g}, {y:g})"
        if kind not in FURNITURE or rot not in ROTATIONS:
            problems.append(f"{what}: unknown kind or a rotation not in {list(ROTATIONS)}")
            continue
        if opts and opts[0].get("wind") and kind not in WIND_SPANS:
            problems.append(f"{what}: {kind} does not sway, wind is for {sorted(WIND_SPANS)}")
        if obj not in layout.OBJECTS:
            problems.append(f"{what} goes into '{obj}', which is not one of the basement's OBJECTS")
        w, d = footprint(kind, rot)
        rect = (x - w / 2, y - d / 2, x + w / 2, y + d / 2)
        if rect[0] < ix0 - EPS or rect[1] < iy0 - EPS or rect[2] > ix1 + EPS or rect[3] > iy1 + EPS:
            problems.append(f"{what} stands outside the light well")
        if kind not in OVERLAYS:
            placed.append((what, rect))
    for i, (a, ra) in enumerate(placed):
        problems += [f"{a} overlaps {b} in the light well" for b, rb in placed[i + 1:] if _overlap(ra, rb)]
    return problems


def check(layout):
    return (house_check.check(layout) + _check_heights(layout) + _check_rooms(layout) + _check_objects(layout)
            + _check_well(layout))

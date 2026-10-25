"""Sanity checks on a layout module before any geometry is built (glass villa spec §10, villa v2 spec §10). Pure Python.

check(layout) returns human-readable problems; an empty list means the layout is buildable. A layout module provides
FOOTPRINT, ROOMS and FURNITURE; POINT_LIGHTS, DOWNLIGHTS, PLANTERS, PARTITIONS, PASSAGES and FROSTED are optional. A
passage is a way between two rooms that is no partition's door (the gap a partition stops short of a wall, from its
"start" to its "end" along the wall's line, on its "level"): no floor piece may stand within DOOR_CLEARANCE of it, as
for a doorway.

A furniture entry is (kind, name, room, (x, y), rot) with an optional sixth element: builder options such as
{"variant": 3}, which the checks ignore except for "wind", which only the plants in catalog.WIND_SPANS take, and "on",
the name of the piece it stands on (the decor pass, villa v2 spec §12 "Curtains and accessories"): it must lie inside one of that
host's catalog.SURFACES tops (top_under), and so stands clear of the floor's rules. A room with
"interior": True needs 2–4 downlights from the DOWNLIGHTS groups whose "level" matches its own. The resort groups are
optional too: STRING_LIGHTS anchors, REFLECTING_POOLS and WALL_FOUNTAINS must stay inside the footprint, and nothing may
stand in a pool or in a fountain's wall and basin (floor pieces on their "level", the ground for a fountain unless it
has one); a stair (STAIR_KINDS) climbs into the level above its room's, where no floor piece may stand over it. A layout
with ROOM_LABELS is interactive (interaction spec §3.1, houses/interact.py): every light with a level must be in a room
of that level, every lit room needs a label for its light:<room> group and every group id must match
interact.GROUP_RE.
"""
from archkit.catalog import (FOUNTAIN_BASIN, FOUNTAIN_WALL, FURNITURE, OVERLAYS, ROTATIONS, SURFACES, WALL_MOUNTED,
                             WIND_SPANS, footprint)

from . import interact

EPS = 1e-6
DOOR_CLEARANCE = 0.8  # metres kept free on each side of a doorway
DOWNLIGHTS_PER_ROOM = (2, 4)
SWITCH = "light_switch"
SWITCH_REACH = 0.3  # metres in front of a switch that no piece taller than the switch hangs may stand in
STAIR_KINDS = frozenset({"spiral_stair"})  # stairs that climb into the level above their room's


def _inside(inner, outer):
    return (inner[0] >= outer[0] - EPS and inner[1] >= outer[1] - EPS
            and inner[2] <= outer[2] + EPS and inner[3] <= outer[3] + EPS)


def _overlap(a, b):
    return a[0] < b[2] - EPS and b[0] < a[2] - EPS and a[1] < b[3] - EPS and b[1] < a[3] - EPS


def _rect(center, size):
    (x, y), (w, d) = center, size
    return (x - w / 2, y - d / 2, x + w / 2, y + d / 2)


def _turn(point, rot):
    """The (x, y) point of a piece's own space turned `rot` degrees about Z (0/90/180/270)."""
    x, y = point
    return {0: (x, y), 90: (-y, x), 180: (-x, -y), 270: (y, -x)}[rot]


def host_tops(host):
    """The tops of the furniture entry `host` in module space (catalog.SURFACES turned and moved with it): (height over
    its feet, (x0, y0, x1, y1))."""
    kind, _name, _room, (hx, hy), rot = host[:5]
    found = []
    for z, (x0, y0, x1, y1) in SURFACES.get(kind, []):
        (ax, ay), (bx, by) = _turn((x0, y0), rot), _turn((x1, y1), rot)
        found.append((z, (hx + min(ax, bx), hy + min(ay, by), hx + max(ax, bx), hy + max(ay, by))))
    return found


def top_under(entry, entries):
    """The height over its host's feet of the top of the host the piece `entry` is put "on" (entries: furniture entries
    by object name) that holds its whole footprint, None when it has no host or no top holds it."""
    host = entries.get((entry[5] if len(entry) > 5 else {}).get("on"))
    if host is None:
        return None
    kind, _name, _room, center, rot = entry[:5]
    rect = _rect(center, footprint(kind, rot))
    for z, top in host_tops(host):
        if _inside(rect, top):
            return z
    return None


def _segment(start, end):
    """Bounding rect of a straight run from start to end (x, y)."""
    return (min(start[0], end[0]), min(start[1], end[1]), max(start[0], end[0]), max(start[1], end[1]))


def _fountain_rect(fountain):
    """Floor a wall fountain takes: its wall, centred on the line from start to end, and the basin in front of it, on
    the side `facing` points to (-1 by default: -Y for a wall along X, -X for a wall along Y; see archkit.water)."""
    (x0, y0), (x1, y1) = fountain["start"], fountain["end"]
    facing = fountain.get("facing", -1)
    along_x = abs(y1 - y0) < EPS
    line = y0 if along_x else x0
    behind, ahead = line - facing * FOUNTAIN_WALL / 2, line + facing * (FOUNTAIN_WALL / 2 + FOUNTAIN_BASIN)
    low, high = sorted((behind, ahead))
    return (min(x0, x1), low, max(x0, x1), high) if along_x else (low, min(y0, y1), high, max(y0, y1))


def _doorways(wall):
    """(index from 1, offset, width, clearance rect) per door; offsets run from the wall's start like
    archkit.partitions.partition, the clearance is the door width by DOOR_CLEARANCE on each side of the wall line."""
    (x0, y0), (x1, y1) = wall["start"], wall["end"]
    along_x = abs(y1 - y0) < EPS
    a0, a1 = (x0, x1) if along_x else (y0, y1)
    sign = 1.0 if a1 >= a0 else -1.0
    line = y0 if along_x else x0
    doors = []
    for i, (offset, width) in enumerate(wall.get("doors", []), start=1):
        lo, hi = sorted((a0 + sign * offset, a0 + sign * (offset + width)))
        rect = ((lo, line - DOOR_CLEARANCE, hi, line + DOOR_CLEARANCE) if along_x
                else (line - DOOR_CLEARANCE, lo, line + DOOR_CLEARANCE, hi))
        doors.append((i, offset, width, rect))
    return abs(a1 - a0), doors


def _check_partitions(layout, bounds, floor_pieces):
    problems = []
    for wall in getattr(layout, "PARTITIONS", []):
        name = wall["name"]
        length, doors = _doorways(wall)
        for i, offset, width, _clearance in doors:
            if width <= EPS or offset < -EPS or offset + width > length + EPS:
                problems.append(f"{name}: door {i} ({offset:g} + {width:g} m) does not fit the {length:g} m wall")
        for k, (i, offset_i, width_i, _) in enumerate(doors):
            for j, offset_j, width_j, _ in doors[k + 1:]:
                if offset_i < offset_j + width_j - EPS and offset_j < offset_i + width_i - EPS:
                    problems.append(f"{name}: doors {i} and {j} overlap")
        for i, _offset, _width, clearance in doors:
            for piece, kind, level, rect in floor_pieces:
                if level == wall["level"] and _overlap(rect, clearance):
                    problems.append(f"{piece} ({kind}) blocks door {i} of {name}")
        if not _inside(_segment(wall["start"], wall["end"]), bounds):
            problems.append(f"partition {name} is outside the footprint")
    return problems


def _check_passages(layout, bounds, floor_pieces):
    problems = []
    for passage in getattr(layout, "PASSAGES", []):
        name, (x0, y0), (x1, y1) = passage["name"], passage["start"], passage["end"]
        x0, y0, x1, y1 = _segment((x0, y0), (x1, y1))
        if y1 - y0 < EPS:
            clearance = (x0, y0 - DOOR_CLEARANCE, x1, y0 + DOOR_CLEARANCE)
        else:
            clearance = (x0 - DOOR_CLEARANCE, y0, x0 + DOOR_CLEARANCE, y1)
        problems += [f"{piece} ({kind}) blocks the passage {name}" for piece, kind, level, rect in floor_pieces
                     if level == passage["level"] and _overlap(rect, clearance)]
        if not _inside((x0, y0, x1, y1), bounds):
            problems.append(f"passage {name} is outside the footprint")
    return problems


def _check_downlights(layout, rooms):
    low, high = DOWNLIGHTS_PER_ROOM
    groups = [group for group in getattr(layout, "DOWNLIGHTS", []) if "level" in group]
    problems = []
    for room in layout.ROOMS:
        if not room.get("interior"):
            continue
        level, rect = rooms[room["name"]]
        n = sum(1 for group in groups if group["level"] == level
                for x, y in group["points"] if _inside((x, y, x, y), rect))
        if not low <= n <= high:
            problems.append(f"room '{room['name']}' has {n} downlights, needs {low}–{high}")
    return problems


def _in_front(rect, rot, depth):
    """The strip `depth` deep in front of a wall piece's rect, on the side its `rot` faces (0: -Y, 90: +X, 180: +Y,
    270: -X, as in the furniture tables)."""
    x0, y0, x1, y1 = rect
    return {0: (x0, y0 - depth, x1, y0), 90: (x1, y0, x1 + depth, y1), 180: (x0, y1, x1, y1 + depth),
            270: (x0 - depth, y0, x0, y1)}[rot]


def _check_switches(layout, rooms, placed):
    """Every lit room has a light_switch in it; a switch lights a room that has lights, ends below the cut of its level
    when the layout names the cuts, and no tall piece stands in front of it."""
    lit = interact.lit_rooms(layout)
    switches = [(name, room, center, rot) for kind, name, room, center, rot, *_ in layout.FURNITURE if kind == SWITCH]
    problems = [f"room '{room}' has lights but no {SWITCH} for its light:{room} group" for room in lit
                if not any(room == switch[1] for switch in switches)]
    cuts = getattr(layout, "CUT_HEIGHTS", {})
    floors = getattr(layout, "FLOOR_Z", {})
    hangs = WALL_MOUNTED[SWITCH]
    for name, room, center, rot in switches:
        if room not in rooms or rot not in ROTATIONS:
            continue  # reported by the checks of every piece
        level = rooms[room][0]
        if room not in lit:
            problems.append(f"{name} ({SWITCH}) is in room '{room}', which has no lights")
        top = floors.get(room, 0.0) + hangs + FURNITURE[SWITCH][2]
        if level in cuts and top > cuts[level] + EPS:
            problems.append(f"{name} ({SWITCH}) ends at {top:.2f} m, over the {cuts[level]:g} m cut of level {level}: "
                            f"the room's light could not be switched while the cut hides its ceiling")
        reach = _in_front(_rect(center, footprint(SWITCH, rot)), rot, SWITCH_REACH)
        problems += [f"{name} ({SWITCH}) is hidden behind {piece} ({kind})" for piece, kind, piece_level, rect, on_wall
                     in placed if piece_level == level and not on_wall and FURNITURE.get(kind, (0, 0, 0))[2] > hangs
                     and _overlap(rect, reach)]
    return problems


def _check_interactions(layout, rooms, placed):
    labels = getattr(layout, "ROOM_LABELS", None)
    if labels is None:
        return []
    problems = [f"{name} at ({x:g}, {y:g}) is in no room on level {level}" for name, (x, y), level in
                interact.lights(layout) if interact.room_at(layout.ROOMS, level, (x, y)) is None]
    problems += [f"room '{room}' has lights but no label in ROOM_LABELS for its light:{room} group"
                 for room in interact.lit_rooms(layout) if not labels.get(room, "").strip()]
    problems += _check_switches(layout, rooms, placed)
    for name, props in interact.tags(layout).items():
        if not interact.GROUP_RE.match(props["interact"]):
            problems.append(f"{name}: group '{props['interact']}' must match {interact.GROUP_RE.pattern}")
    return problems


def check(layout):
    problems = []
    fw, fd = layout.FOOTPRINT
    bounds = (-fw / 2, -fd / 2, fw / 2, fd / 2)
    rooms = {}
    for room in layout.ROOMS:
        rect = (*room["min"], *room["max"])
        if not _inside(rect, bounds):
            problems.append(f"room '{room['name']}' extends outside the {fw:g} x {fd:g} m footprint")
        rooms[room["name"]] = (room["level"], rect)

    placed = []  # (name, kind, level, rect, hangs on a wall)
    entries = {entry[1]: entry for entry in layout.FURNITURE}
    for kind, name, room, center, rot, *opts in layout.FURNITURE:
        if kind not in FURNITURE:
            problems.append(f"{name}: unknown furniture kind '{kind}'")
            continue
        if opts and "wind" in opts[0] and kind not in WIND_SPANS:  # archkit.furniture.place would raise TypeError
            problems.append(f"{name}: {kind} does not sway, wind is for {sorted(WIND_SPANS)}")
        if rot not in ROTATIONS:
            problems.append(f"{name}: rotation must be one of {list(ROTATIONS)}, got {rot}")
            continue
        if room not in rooms:
            problems.append(f"{name}: unknown room '{room}'")
            continue
        level, room_rect = rooms[room]
        rect = _rect(center, footprint(kind, rot))
        if not _inside(rect, room_rect):
            problems.append(f"{name} ({kind}) sticks out of room '{room}'")
        if opts and "on" in opts[0]:  # on a host's top, clear of the floor's rules
            host = entries.get(opts[0]["on"])
            if host is None or host[1] == name:
                problems.append(f"{name} ({kind}) stands on '{opts[0]['on']}', which is no piece of the layout")
            elif host[0] not in SURFACES:
                problems.append(f"{name} ({kind}) stands on {host[1]} ({host[0]}), which has no top to stand on")
            elif top_under((kind, name, room, center, rot, opts[0]), entries) is None:
                problems.append(f"{name} ({kind}) is not on a top of {host[1]} ({host[0]})")
            continue
        if kind not in OVERLAYS:
            placed.append((name, kind, level, rect, kind in WALL_MOUNTED))
    for pool in getattr(layout, "REFLECTING_POOLS", []):
        placed.append((pool["name"], "reflecting_pool", pool["level"], (*pool["min"], *pool["max"]), False))
    for fountain in getattr(layout, "WALL_FOUNTAINS", []):
        placed.append((fountain["name"], "wall_fountain", fountain.get("level", 0), _fountain_rect(fountain), False))

    # A stair climbs into the level above: its landing and the hole beside it stay free there.
    for name_a, kind_a, level_a, rect_a, _wall in placed:
        if kind_a in STAIR_KINDS:
            problems += [f"{name_b} ({kind_b}) stands over the stair {name_a} ({kind_a})"
                         for name_b, kind_b, level_b, rect_b, wall_b in placed
                         if level_b == level_a + 1 and not wall_b and _overlap(rect_a, rect_b)]

    # Wall-mounted pieces hang above the floor pieces, so they only clash with each other.
    for i, (name_a, _kind_a, level_a, rect_a, wall_a) in enumerate(placed):
        for name_b, _kind_b, level_b, rect_b, wall_b in placed[i + 1:]:
            if level_a == level_b and wall_a == wall_b and _overlap(rect_a, rect_b):
                problems.append(f"{name_a} overlaps {name_b}")

    points = [(light["name"], light["pos"][:2]) for light in getattr(layout, "POINT_LIGHTS", [])]
    points += [(group["name"], p) for group in getattr(layout, "DOWNLIGHTS", []) for p in group["points"]]
    points += [(name, base[:2]) for name, base, _size, _shrubs in getattr(layout, "PLANTERS", [])]
    points += [(group["name"], p[:2]) for group in getattr(layout, "STRING_LIGHTS", []) for p in group["points"]]
    points += [(pool["name"], corner) for pool in getattr(layout, "REFLECTING_POOLS", [])
               for corner in (pool["min"], pool["max"])]
    points += [(fountain["name"], end) for fountain in getattr(layout, "WALL_FOUNTAINS", [])
               for end in (fountain["start"], fountain["end"])]
    for name, (x, y) in points:
        if not _inside((x, y, x, y), bounds):
            problems.append(f"{name} at ({x:g}, {y:g}) is outside the footprint")

    floor_pieces = [(name, kind, level, rect) for name, kind, level, rect, on_wall in placed if not on_wall]
    problems += _check_partitions(layout, bounds, floor_pieces)
    problems += _check_passages(layout, bounds, floor_pieces)
    problems += _check_downlights(layout, rooms)
    for panel in getattr(layout, "FROSTED", []):
        if not _inside(_segment(panel["start"], panel["end"]), bounds):
            problems.append(f"frosted panel {panel['name']} is outside the footprint")
    problems += _check_interactions(layout, rooms, placed)
    return problems

"""Sanity checks on the interior's layout before any geometry is built (art/README.md, Interior). Pure
Python.

check(layout) returns human-readable problems; an empty list means the decor is buildable. `layout` gives the data
(interior_layout's names); where a curtain, a blind or a piece stands is interior_layout's to work out (curtain_at,
blind_at, stand). The interior stands in the
house's rooms among the house's furniture (houses/house_layout.py), so its pieces are checked against the house's:

- the module: the house's footprint, a prop, its slot in siteplan/zones.py the house's (zones_check: ZONE_SHARED);
- every accessory is a catalog kind at a catalog rotation, inside its room; one put "on" a piece stands inside one of
  that host's catalog.SURFACES tops in the same room (stand() at the top's height, within a centimetre), clear of what
  else stands on that host; a floor piece is clear of the house's floor pieces, of the interior's, of the curtains'
  stacks, of the doorways and passages (DOOR_CLEARANCE), of the stair and its hole, of the walk along the gallery's
  balustrade and of the room's light switch (the house's rules); a wall piece hangs with its back on a solid wall, never
  on glass or over a doorway, clear of the house's wall pieces and of the interior's, and under the ceiling;
- a curtain runs along a glazing of its room (shell.CURTAIN_WALLS), parallel to it and just inside it, no more than
  CURTAIN_OVER past either end of the glass, its track under the ceiling over both stacks and its hem a centimetre at
  least over the floor; its stacks stand clear like a floor piece, and the whole run clear of the crystal chandelier;
- a blind hangs in front of a ribbon window of its room (shell.WINDOWS), at least as wide, under the ceiling;
- every piece goes into one of OBJECTS; every table lamp's room has a lamp object, a lit room of the house (its shade
  joins the room's light group), and every lamp object a lamp.
"""
from archkit.catalog import CURTAIN, FURNITURE, OVERLAYS, ROTATIONS, SURFACES, WALL_MOUNTED, footprint
from houses import house_layout as H
from houses import interact as house_interact
from houses import layout_check as house_check
from houses.house_parts import shell
from houses.house_parts.common import CEILING, LEVEL_Z, ceiling_over
from interior import interior_layout as place
from siteplan import zones

EPS = 1e-6
CURTAIN_OVER = 0.35  # how far a run may reach past its glass onto the wall beside it
CURTAIN_NEAR = 0.12  # its back no farther than this off the glass's line
SURFACE_TOLERANCE = 0.01  # a piece on a host stands within this of the host's top
WALL_TOLERANCE = 0.015  # a wall piece's back no farther than this off the wall's face
RAIL_WALK = 0.6  # the strip along the gallery's balustrade kept clear for walking
LAMP = "table_lamp"
_WALL_GROUPS = ("Walls_white", "Walls_stone")


def _rect(entry):
    kind, _name, _room, center, rot = entry[:5]
    return house_check._rect(center, footprint(kind, rot))


def _overlap(a, b):
    return house_check._overlap(a, b)


def _inside(inner, outer):
    return house_check._inside(inner, outer)


def _opts(entry):
    return dict(entry[5]) if len(entry) > 5 else {}


def _rooms(layout):
    return {room["name"]: (room["level"], (*room["min"], *room["max"])) for room in layout.ROOMS}


def _house_pieces():
    """(name, kind, level, rect, on a wall) of the house's furniture, like houses/layout_check's `placed`."""
    rooms = _rooms(H)
    return [(name, kind, rooms[room][0], _rect(entry), kind in WALL_MOUNTED)
            for entry in H.FURNITURE for kind, name, room in [entry[:3]] if kind not in OVERLAYS]


def _clearances():
    """(what, level, rect) a floor piece must stay out of: every doorway's and passage's clearance, the main door's,
    the stair's square on its level and the next, and the walk along the gallery's balustrade."""
    found = []
    for wall in H.PARTITIONS:
        _length, doors = house_check._doorways(wall)
        found += [(f"door {i} of {wall['name']}", wall["level"], clearance) for i, _o, _w, clearance in doors]
    for passage in H.PASSAGES:
        x0, y0, x1, y1 = house_check._segment(passage["start"], passage["end"])
        reach = house_check.DOOR_CLEARANCE
        rect = (x0, y0 - reach, x1, y0 + reach) if y1 - y0 < EPS else (x0 - reach, y0, x0 + reach, y1)
        found.append((f"the passage {passage['name']}", passage["level"], rect))
    door = H.DOOR
    found.append(("the main door", 0, (door["x0"], door["y"], door["x1"], door["y"] + house_check.DOOR_CLEARANCE)))
    for entry in H.FURNITURE:
        if entry[0] in house_check.STAIR_KINDS:
            level = _rooms(H)[entry[2]][0]
            found += [(f"the stair {entry[1]}", lvl, _rect(entry)) for lvl in (level, level + 1)]
    for rail in H.RAILINGS:
        if rail["name"] == "gallery":
            (x0, y), (x1, _y) = rail["start"], rail["end"]
            found.append(("the walk along the gallery's balustrade", 1, (min(x0, x1), y, max(x0, x1), y + RAIL_WALK)))
    return found


def _switch_reaches():
    """(name, level, rect) in front of each of the house's light switches, where no tall piece may stand."""
    rooms = _rooms(H)
    found = []
    for entry in H.FURNITURE:
        if entry[0] == house_check.SWITCH:
            rect = _rect(entry)
            found.append((entry[1], rooms[entry[2]][0], house_check._in_front(rect, entry[4], house_check.SWITCH_REACH)))
    return found


def _solid_walls(level):
    """The boxes (x0, y0, z0, x1, y1, z1) of the solid walls of `level`: the shell's white and stone walls and the
    partitions, over their doorways only the header (archkit.partitions: an opening 2.2 m high, a 5 cm frame)."""
    floor = LEVEL_Z[level]
    top = CEILING.get(level, floor)
    boxes = []
    for group in shell.STRUCTURE:
        if group["name"] in _WALL_GROUPS:
            for _key, (x0, y0, z0), (x1, y1, z1) in group["boxes"]:
                if z1 > floor + EPS and z0 < top - EPS:
                    boxes.append((x0, y0, z0, x1, y1, z1))
    half, head = 0.06, floor + 2.2 + 0.05
    for wall in H.PARTITIONS:
        if wall["level"] != level:
            continue
        (sx, sy), (ex, ey) = wall["start"], wall["end"]
        along_x = abs(sy - ey) < EPS
        a0, a1 = sorted((sx, ex) if along_x else (sy, ey))
        sign = 1.0 if (ex if along_x else ey) >= (sx if along_x else sy) else -1.0
        start = sx if along_x else sy
        cuts = sorted(sorted((start + sign * o, start + sign * (o + w))) for o, w in wall["doors"])
        spans, left = [], a0
        for o0, o1 in cuts:
            spans.append((left, o0, wall["z0"]))
            spans.append((o0, o1, head))
            left = o1
        spans.append((left, a1, wall["z0"]))
        line = sy if along_x else sx
        for b0, b1, z0 in spans:
            if b1 - b0 > EPS:
                boxes.append((b0, line - half, z0, b1, line + half, wall["z1"]) if along_x
                             else (line - half, b0, z0, line + half, b1, wall["z1"]))
    return boxes


def _on_wall(entry, floor, level):
    """Whether a wall piece's back lies on solid wall at its four corners and its middle."""
    kind, _name, _room, _center, rot = entry[:5]
    x0, y0, x1, y1 = _rect(entry)
    z0 = floor + WALL_MOUNTED[kind]
    z1 = z0 + FURNITURE[kind][2]
    # its back: the side opposite the one it faces (rot 0: -Y, 90: +X, 180: +Y, 270: -X)
    axis, back, a0, a1 = {0: (1, y1, x0, x1), 90: (0, x0, y0, y1), 180: (1, y0, x0, x1), 270: (0, x1, y0, y1)}[rot]
    away = {0: 1, 90: -1, 180: -1, 270: 1}[rot]  # which way the wall lies from its back
    walls = _solid_walls(level)
    for a, z in ((a0, z0), (a1, z0), (a0, z1), (a1, z1), ((a0 + a1) / 2, (z0 + z1) / 2)):
        held = False
        for bx0, by0, bz0, bx1, by1, bz1 in walls:
            near, far = (by0, by1) if axis == 1 else (bx0, bx1)
            face = near if away > 0 else far
            lo, hi = (bx0, bx1) if axis == 1 else (by0, by1)
            if abs(face - back) <= WALL_TOLERANCE and lo - EPS <= a <= hi + EPS and bz0 - EPS <= z <= bz1 + EPS:
                held = True
                break
        if not held:
            return False
    return True


def _check_module(layout):
    problems = []
    if tuple(layout.FOOTPRINT) != tuple(H.FOOTPRINT):
        problems.append(f"the interior's footprint {layout.FOOTPRINT} must be the house's {H.FOOTPRINT}")
    if layout.ROLE != "prop":
        problems.append(f"the interior is a prop, got role {layout.ROLE!r}")
    slots = [spec for spec in zones.SLOTS.values() if spec["module"] == layout.MODULE_ID]
    house = next(spec for spec in zones.SLOTS.values() if spec["module"] == H.MODULE_ID)
    if len(slots) != 1:
        problems.append(f"the interior needs one slot in siteplan/zones.py, found {len(slots)}")
    elif (tuple(slots[0]["pos"]) != tuple(house["pos"]) or slots[0]["yaw"] != house["yaw"]
          or slots[0]["zone"] != house["zone"]):
        problems.append("the interior's slot must be the house's: its zone, position and yaw (module space is the house's)")
    return problems


def _check_pieces(layout, stacks):
    problems = []
    rooms = _rooms(layout)
    entries = {entry[1]: entry for entry in list(H.FURNITURE) + list(layout.FURNITURE)}
    house = _house_pieces()
    clearances = _clearances()
    switches = _switch_reaches()
    floor_pieces, wall_pieces, on_top = [], [], {}
    for entry in layout.FURNITURE:
        kind, name, room, center, rot = entry[:5]
        opts = _opts(entry)
        if kind not in FURNITURE:
            problems.append(f"{name}: unknown furniture kind '{kind}'")
            continue
        if rot not in ROTATIONS:
            problems.append(f"{name}: rotation must be one of {list(ROTATIONS)}, got {rot}")
            continue
        if room not in rooms:
            problems.append(f"{name}: unknown room '{room}'")
            continue
        level, room_rect = rooms[room]
        rect = _rect(entry)
        if not _inside(rect, room_rect):
            problems.append(f"{name} ({kind}) sticks out of room '{room}'")
        into = opts.get("into", layout.DETAILS if kind in layout.DETAIL_KINDS else layout.DECOR)
        if into not in layout.OBJECTS:
            problems.append(f"{name} ({kind}) goes into '{into}', which is not one of the interior's OBJECTS")
        if "on" in opts:
            host = entries.get(opts["on"])
            if host is None or host[1] == name:
                problems.append(f"{name} ({kind}) stands on '{opts['on']}', which is no piece of the house's or the "
                                f"interior's")
                continue
            if host[2] != room:
                problems.append(f"{name} ({kind}) stands on {host[1]} in room '{host[2]}', not its own '{room}'")
            if host[0] not in SURFACES:
                problems.append(f"{name} ({kind}) stands on {host[1]} ({host[0]}), which has no top to stand on")
                continue
            top = place.top_under(entry, layout.FURNITURE)
            if top is None:
                problems.append(f"{name} ({kind}) is not on a top of {host[1]} ({host[0]})")
                continue
            z = place.stand(entry, layout.FURNITURE)[2]
            want = layout.FLOOR_Z[host[2]] + top
            if abs(z - want) > SURFACE_TOLERANCE:
                problems.append(f"{name} ({kind}) stands at {z:g} m, not on the {want:g} m top of {host[1]}")
            for other, other_rect in on_top.get(host[1], []):
                if _overlap(rect, other_rect):
                    problems.append(f"{name} overlaps {other} on {host[1]}")
            on_top.setdefault(host[1], []).append((name, rect))
            continue
        if kind in WALL_MOUNTED:
            floor = layout.FLOOR_Z[room]
            if not _on_wall(entry, floor, level):
                problems.append(f"{name} ({kind}) does not hang on a solid wall of room '{room}' (glass, a doorway or "
                                f"nothing behind it)")
            top = floor + WALL_MOUNTED[kind] + FURNITURE[kind][2]
            ceiling = min(ceiling_over(level, point) for point in ((rect[0], rect[1]), (rect[2], rect[3])))
            if top > ceiling + EPS:
                problems.append(f"{name} ({kind}) reaches {top:.2f} m, over the ceiling")
            for other, other_kind, other_level, other_rect, on_wall in house:
                if on_wall and other_level == level and _overlap(rect, other_rect):
                    problems.append(f"{name} overlaps {other} ({other_kind}) on the wall")
            for other, other_rect in wall_pieces:
                if _overlap(rect, other_rect) and other_rect[4] == level:
                    problems.append(f"{name} overlaps {other} on the wall")
            wall_pieces.append((name, (*rect, level)))
            continue
        if kind in OVERLAYS:
            continue
        for other, other_kind, other_level, other_rect, on_wall in house:
            if not on_wall and other_level == level and _overlap(rect, other_rect):
                problems.append(f"{name} ({kind}) overlaps the house's {other} ({other_kind})")
        for other, other_level, other_rect in floor_pieces:
            if other_level == level and _overlap(rect, other_rect):
                problems.append(f"{name} overlaps {other}")
        for curtain, curtain_level, stack in stacks:
            if curtain_level == level and _overlap(rect, stack):
                problems.append(f"{name} ({kind}) stands in a stack of {curtain}")
        for what, clear_level, clear in clearances:
            if clear_level == level and _overlap(rect, clear):
                problems.append(f"{name} ({kind}) blocks {what}")
        if FURNITURE[kind][2] > WALL_MOUNTED[house_check.SWITCH]:
            for switch, switch_level, reach in switches:
                if switch_level == level and _overlap(rect, reach):
                    problems.append(f"{name} ({kind}) stands in front of {switch}")
        floor_pieces.append((name, level, rect))
    return problems


def _check_curtains(layout):
    problems = []
    rooms = _rooms(layout)
    glasses = {glass["name"]: glass for glass in H.CURTAIN_WALLS}
    house = _house_pieces()
    clearances = _clearances()
    switches = _switch_reaches()
    stacks = []
    for curtain in layout.CURTAINS:
        name, room = curtain["name"], curtain["room"]
        glass = glasses.get(curtain["glass"])
        if glass is None or room not in rooms:
            problems.append(f"{name}: unknown glazing '{curtain['glass']}' or room '{room}'")
            continue
        level, room_rect = rooms[room]
        at = place.curtain_at(curtain)
        (gx0, gy0), (gx1, gy1) = glass["start"], glass["end"]
        g0, g1 = sorted((gx0, gx1) if at["axis"] == 0 else (gy0, gy1))
        a0, a1 = curtain["span"]
        if a0 < g0 - CURTAIN_OVER - EPS or a1 > g1 + CURTAIN_OVER + EPS or a1 - a0 < 2 * place.stack_width(curtain):
            problems.append(f"{name} runs {a0:g}..{a1:g}, not along its glass {curtain['glass']} ({g0:g}..{g1:g})")
        if abs(at["back"] - at["line"]) > CURTAIN_NEAR + EPS:
            problems.append(f"{name} hangs {abs(at['back'] - at['line']):.2f} m off its glass")
        run = place.run_rect(curtain)
        if not _inside(run, room_rect):
            problems.append(f"{name} sticks out of room '{room}'")
        floor = layout.FLOOR_Z[room]
        top = floor + at["drop"]
        for stack in place.stacks(curtain):
            middle = ((stack[0] + stack[2]) / 2, (stack[1] + stack[3]) / 2)
            if top > ceiling_over(level, middle) + EPS:
                problems.append(f"{name}: its track at {top:.2f} m is over the ceiling at {middle}")
            stacks.append((name, level, stack))
            for other, other_kind, other_level, other_rect, on_wall in house:
                if not on_wall and other_level == level and _overlap(stack, other_rect):
                    problems.append(f"{name}: a stack stands in the house's {other} ({other_kind})")
            for what, clear_level, clear in clearances:
                if clear_level == level and _overlap(stack, clear):
                    problems.append(f"{name}: a stack blocks {what}")
            for switch, switch_level, reach in switches:
                if switch_level == level and _overlap(stack, reach):
                    problems.append(f"{name}: a stack stands in front of {switch}")
        if CURTAIN["hem"] < 0.01 - EPS:
            problems.append(f"{name}: its hem is under a centimetre over the floor")
        for other, other_kind, other_level, other_rect, _wall in house:
            if other_kind == "crystal_chandelier" and other_level == level and _overlap(run, other_rect):
                problems.append(f"{name} runs under the chandelier {other}")
    for i, (a, level_a, ra) in enumerate(stacks):
        problems += [f"stacks of {a} and {b} overlap" for b, level_b, rb in stacks[i + 1:]
                     if a != b and level_a == level_b and _overlap(ra, rb)]
    return problems, stacks


def _check_blinds(layout):
    problems = []
    windows = {window["name"]: window for window in H.WINDOWS}
    rooms = _rooms(layout)
    for blind in layout.BLINDS:
        name, room = blind["name"], blind["room"]
        window = windows.get(blind["window"])
        if window is None or room not in rooms:
            problems.append(f"{name}: unknown window '{blind['window']}' or room '{room}'")
            continue
        level, (rx0, ry0, rx1, ry1) = rooms[room]
        at = place.blind_at(blind)
        (sx, sy), (ex, ey) = window["start"], window["end"]
        if at["width"] < abs(ex - sx) + abs(ey - sy) - EPS:
            problems.append(f"{name} is narrower than its window")
        x, y, z = at["pos"]
        if not (rx0 - EPS <= x <= rx1 + EPS and ry0 - EPS <= y <= ry1 + EPS):
            problems.append(f"{name} hangs outside room '{room}'")
        if z + at["drop"] > ceiling_over(level, (x, y)) + EPS or z > window["z0"] + EPS:
            problems.append(f"{name} does not hang from over its window's head to its sill under the ceiling")
        if not 0.0 < blind["lowered"] <= 1.0:
            problems.append(f"{name}: lowered {blind['lowered']} is no share of its length")
    return problems


def _check_lamps(layout):
    problems = []
    lit = house_interact.lit_rooms(H)
    rooms_with_lamps = {entry[2] for entry in layout.FURNITURE if entry[0] == LAMP}
    for room in sorted(rooms_with_lamps):
        if room not in layout.LAMPS:
            problems.append(f"room '{room}' has a table lamp but no lamp object in LAMPS")
        if room not in lit:
            problems.append(f"room '{room}' has a table lamp but the house gives it no light:{room} group")
    problems += [f"lamp object {name} of room '{room}' has no table lamp" for room, name in layout.LAMPS.items()
                 if room not in rooms_with_lamps]
    problems += [f"{name} is not one of OBJECTS" for name in layout.LAMPS.values() if name not in layout.OBJECTS]
    return problems


def check(layout):
    problems = _check_module(layout)
    curtain_problems, stacks = _check_curtains(layout)
    problems += curtain_problems
    problems += _check_blinds(layout)
    problems += _check_pieces(layout, stacks)
    problems += _check_lamps(layout)
    return problems

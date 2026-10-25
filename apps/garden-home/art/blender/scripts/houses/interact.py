"""What a click toggles on the website (interaction spec §3.1). Pure Python.

build_house.py tags objects with custom properties that the glTF export carries as node extras: `interact`, the group
a click on the object toggles, `label`, the name the website shows on hover, and for the door and the
jacuzzi the `clip` they play. The groups:

- light:<room>, every light of a room: its point lights and downlights (one LT_down_<room> object per room, see
  split_downlights), its pendants, floor and bedside lamps, the crystal chandelier of the tall house's double-height
  living room (labelled on its own), the frosted window of a bathroom, which glows with it, and the wall switch of the
  room (kind light_switch), which hangs at 1.15 m and so stays in reach while the dollhouse cut hides the ceiling and
  what hangs from it;
- tv:<object> and pc:<object>, a screen; shower:<object>, a shower and the water falling from its rain head
  (WATER_<object>_flow, shower_flows), which the runtime only shows while it runs;
- door:main, jacuzzi, fountain and lights:string: the main door, the roof jacuzzi, the wall fountain and the string
  lights;
- ac:<room>, a bedroom's split air conditioner (kind ac_split): the unit, its louvre flap (<unit>_flap, ac_flaps),
  which carries the act_ac_<room> clip that opens it, and its wall remote (kind ac_remote), which hangs under the cut
  like a light switch while the unit hangs over it.

uncut(layout) names what the dollhouse cut clips at the void's plane rather than at its storey's cut, with the height
of that plane under the ground floor's cut (build_house tags it `uncut` and `cut_top`): the chandelier hangs in the void
of the double-height living room, over the ground floor's cut, and would vanish from the room it lights. The website
cuts it at the upper floor's cut while that shows and at its own crown (cut_top) under the ground floor's, so it hangs
whole in the void either way and only its cord is cut.

A layout is interactive when it names its rooms in ROOM_LABELS; layout_check then checks that every lit room has a
label and every group id matches GROUP_RE. Lights find their room by position on their "level", like the downlights in
layout_check, so point lights and downlight groups need a "level" to join a room's group.
"""
import re

from archkit.catalog import FURNITURE, WALL_MOUNTED

GROUP_RE = re.compile(r"^[a-z]+(:[A-Za-z0-9_]+)?$")
EPS = 1e-6

# Catalog kinds that light the room they stand in, and the screens with the group they start.
LAMP_KINDS = frozenset({"rattan_pendant", "floor_lamp", "nightstand_lamp", "crystal_chandelier"})
# Lamps with a hover label of their own rather than their room's light ("Living room lights"), by kind.
LAMP_LABELS = {"crystal_chandelier": "Crystal chandelier"}
# Kinds the dollhouse cut clips at the void's plane rather than at their storey's cut (uncut), and how far over a
# piece's top (its crown) that plane runs under the ground floor's cut: the stub of its cord that shows.
UNCUT_KINDS = frozenset({"crystal_chandelier"})
CUT_TOP_STUB = 0.05
SCREEN_GROUPS = {"tv_wall": "tv", "tv_cabinet": "tv", "gaming_desk": "pc"}
# Hover labels per group kind; {room} is the room's ROOM_LABELS entry.
LABELS = {"light": "{room} lights", "switch": "{room} light switch", "tv": "{room} TV", "pc": "Computer", "shower": "{room} shower",
          "door": "Front door", "jacuzzi": "Hot tub", "fountain": "Water wall", "lights": "String lights", "ac": "{room} AC",
          "ac_remote": "{room} AC remote"}
DOOR_CLIP = "act_door_open"  # archkit.glazing.sliding_door's action
BUBBLE_GROUPS = "abc"  # archkit.rooftop.GROUPS: the jacuzzi's bubbles are <name>_bubbles_a, _b and _c


def room_at(rooms, level, point):
    """Name of the first room on `level` whose rectangle holds the (x, y) point, edges included; None if none does."""
    x, y = point
    for room in rooms:
        (x0, y0), (x1, y1) = room["min"], room["max"]
        if room["level"] == level and x0 - EPS <= x <= x1 + EPS and y0 - EPS <= y <= y1 + EPS:
            return room["name"]
    return None


def split_downlights(groups, rooms):
    """The downlight groups with one group LT_down_<room> per room (interaction spec §3.1), so a click can switch a
    room's discs without its neighbours'.

    Every point of a group with a "level" goes to the first room on that level that holds it; the room groups keep
    the order rooms first get a point, and take the height "z" of the group their points come from (two heights in one
    room raise ValueError). Points in no room, and groups without a level, stay in a group of their own name after
    them, so layout_check still sees them. Discs and triangles are the same, only spread over more objects."""
    by_room, rest = {}, []
    for group in groups:
        if "level" not in group:
            rest.append(dict(group))
            continue
        leftover = []
        for point in group["points"]:
            room = room_at(rooms, group["level"], point)
            if room is None:
                leftover.append(point)
                continue
            split = by_room.setdefault(room, {"name": f"LT_down_{room}", "level": group["level"], "z": group["z"],
                                              "points": [], "room": room})
            if abs(split["z"] - group["z"]) > EPS:
                raise ValueError(f"room '{room}' gets downlights at two heights ({split['z']:g} and {group['z']:g} m)")
            split["points"].append(point)
        if leftover:
            rest.append(dict(group, points=leftover))
    return list(by_room.values()) + rest


def lights(layout):
    """(object name, (x, y), level) for every light of `layout` that has a level: each downlight disc, each point
    light and each pendant of PENDANTS."""
    found = [(group["name"], point, group["level"]) for group in getattr(layout, "DOWNLIGHTS", []) if "level" in group
             for point in group["points"]]
    found += [(light["name"], tuple(light["pos"][:2]), light["level"]) for light in getattr(layout, "POINT_LIGHTS", [])
              if "level" in light]
    found += [(pend["name"], tuple(pend["pos"]), pend["level"]) for pend in getattr(layout, "PENDANTS", [])
              if "level" in pend]
    return found


def lit_rooms(layout):
    """Rooms that hold a light (lights() or a lamp of LAMP_KINDS), in ROOMS order."""
    lit = {room_at(layout.ROOMS, level, point) for _name, point, level in lights(layout)}
    lit |= {room for kind, _name, room, *_ in layout.FURNITURE if kind in LAMP_KINDS}
    return [room["name"] for room in layout.ROOMS if room["name"] in lit]


def shower_flows(layout):
    """(WATER_<shower>_flow, (x, y, z), rotation) for every shower in FURNITURE: where its falling water is built,
    standing where the shower stands (layout.FLOOR_Z gives the floor of its room)."""
    return [(f"WATER_{name}_flow", (x, y, layout.FLOOR_Z[room]), rot)
            for kind, name, room, (x, y), rot, *_ in layout.FURNITURE if kind == "shower"]


def tags(layout):
    """{object name: custom properties} for every interactive object of `layout`, in build order: "interact" and
    "label", plus "clip" for the door and the jacuzzi. A room missing from ROOM_LABELS is named by its id."""
    names = getattr(layout, "ROOM_LABELS", {})
    rooms = layout.ROOMS
    found = {}

    def tag(objects, kind, group, room=None, **extra):
        label = LABELS[kind].format(room=names.get(room, room))
        for name in objects:
            found[name] = {"interact": group, "label": label, **extra}

    held = {}  # light object -> the rooms its discs are in
    for name, point, level in lights(layout):
        held.setdefault(name, set()).add(room_at(rooms, level, point))
    for name, (room, *others) in held.items():
        if room is not None and not others:  # a downlight group joins a room when all its discs are in it
            tag([name], "light", f"light:{room}", room)
    for kind, name, room, *_ in layout.FURNITURE:
        if kind in LAMP_LABELS:
            found[name] = {"interact": f"light:{room}", "label": LAMP_LABELS[kind]}
        elif kind in LAMP_KINDS:
            tag([name], "light", f"light:{room}", room)
        elif kind == "light_switch":  # the switch of the room it stands in, with a label of its own
            tag([name], "switch", f"light:{room}", room)
        elif kind in SCREEN_GROUPS:
            tag([name], SCREEN_GROUPS[kind], f"{SCREEN_GROUPS[kind]}:{name}", room)
        elif kind == "shower":
            tag([name, f"WATER_{name}_flow"], "shower", f"shower:{name}", room)
        elif kind in ("ac_split", "ac_remote"):
            label = LABELS["ac" if kind == "ac_split" else "ac_remote"].format(room=names.get(room, room))
            for part in ([name] if kind == "ac_remote" else [name, f"{name}_flap"]):
                found[part] = {"interact": f"ac:{room}", "label": label}
            if kind == "ac_split":
                found[f"{name}_flap"]["clip"] = f"act_ac_{room}"
    room_names = {room["name"] for room in rooms}
    for panel in getattr(layout, "FROSTED", []):
        if panel["name"] in room_names:  # FROSTED_<room>: the window of a bathroom glows with its lights
            tag([f"FROSTED_{panel['name']}"], "light", f"light:{panel['name']}", panel["name"])
    door = getattr(layout, "DOOR", None)
    if door:
        tag([door["name"]], "door", "door:main", clip=DOOR_CLIP)
    jacuzzi = getattr(layout, "JACUZZI", None)
    if jacuzzi:
        name = jacuzzi["name"]
        tag([name, f"WATER_{name}", *(f"{name}_bubbles_{g}" for g in BUBBLE_GROUPS)], "jacuzzi", "jacuzzi",
            clip=f"ambient_{name.lower()}")
    for fountain in getattr(layout, "WALL_FOUNTAINS", []):
        name = fountain["name"]
        tag([name, f"WATER_{name}", f"WATER_{name}_sheet"], "fountain", "fountain")
    for string in getattr(layout, "STRING_LIGHTS", []):
        tag([string["name"]], "lights", "lights:string")
    return found


def uncut(layout):
    """{name: cut_top} for the FURNITURE pieces the dollhouse cut clips at the void's plane (UNCUT_KINDS), in layout
    order: cut_top is the height in module space (metres, layout.FLOOR_Z gives the floor of the room) of the piece's top
    plus CUT_TOP_STUB, where the plane runs under the ground floor's cut, so its cord stops at its crown."""
    return {name: round(layout.FLOOR_Z[room] + WALL_MOUNTED.get(kind, 0.0) + FURNITURE[kind][2] + CUT_TOP_STUB, 3)
            for kind, name, room, *_ in layout.FURNITURE if kind in UNCUT_KINDS}


def ac_flaps(layout):
    """(flap object name, unit name, room) for every split air conditioner (kind ac_split) in FURNITURE: build_house
    hinges each unit's louvre flap on it as an object of its own, which its act_ac_<room> clip turns."""
    return [(f"{name}_flap", name, room) for kind, name, room, *_ in layout.FURNITURE if kind == "ac_split"]

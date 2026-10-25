"""Generate blender/modules/basement.blend from basement/basement_layout.py (villa v2 spec §12 "Tầng hầm") with the
archkit builders, tagging what a click toggles (basement/interact.py) and what the website's cut does to each object.

Like the garden's modules, the pieces are merged per object (furniture.place_into, one draw call per material): the
retaining walls (Basement_walls) and the slab's edge over them with the section lines on the walls under the website's
cut (Basement_rim), the partitions, the floors, the glass
walls, the rooms' furniture (Basement_rooms; the spa's in Spa), each room's lights with the pools they cast
(LT_down_<room>), the karaoke's party pieces (Karaoke_party, LED_party), the hot tub with its water and bubbles, the
sauna's stove and the light well's walls, plants, railing and lights; the wall switches, the stair and the disco ball
(which turns about its own axis in ambient_disco_ball) are objects of their own.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/basement/build_basement.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

import bpy

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import furniture, materials, rooftop, scene  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from basement import basement_layout as L  # noqa: E402
from basement import interact, layout_check  # noqa: E402
from houses import layout_check as house_check  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "basement.blend")
PARTITION = 0.12  # interior walls, centred on their line
GLASS = 0.02  # a pane's thickness
MULLION = 0.05  # the cellar's glass wall's slim black frame
STRIP = 0.03  # an LED strip's section
WELL_STRIP = 0.07  # the light well's rim strip: a line a pixel or two across from the wallpaper camera
SPIN_FRAMES = 192  # the disco ball turns once in 8 s (24 fps)
BUBBLES = 10  # in the hot tub, one group (archkit.rooftop)
RAIL_PANE = 1.2  # the light well's railing: glass panes about this long, a centimetre apart
CAP = 0.03  # the section line on the walls under the cut
# Flat or small objects the website leaves out of the shadow pass (glTF extras cast_shadow = False)
SHADOWLESS = frozenset({L.FLOOR_OBJECT, L.ROOM_FLOORS, L.RIM})


def boxes(mb, items, mats, uv_tile=1.0):
    for key, lo, hi in items:
        mb.box(lo, hi, mats[key], uv_tile=uv_tile)


def _along(start, end):
    """(axis, a0, a1, line): a wall from start to end along X (axis 0) or Y (axis 1), from a0 to a1 on its line."""
    (x0, y0), (x1, y1) = start, end
    if abs(y1 - y0) < 1e-9:
        return 0, min(x0, x1), max(x0, x1), y0
    return 1, min(y0, y1), max(y0, y1), x0


def _slab(axis, a0, a1, line, half, z0, z1):
    """Box corners of a run a0..a1 along the axis, `half` either side of its line, from z0 to z1."""
    if axis == 0:
        return (a0, line - half, z0), (a1, line + half, z1)
    return (line - half, a0, z0), (line + half, a1, z1)


def caps(mb, mats):
    """A dark strip on every interior wall and glass wall just under the website's cut, in the slab edge's concrete:
    under the cut the walls show as a floor plan's section lines, where they would be open boxes seen from above. The
    doorways stay open (their headers are over the cut)."""
    for wall in list(L.PARTITIONS) + list(L.GLASS_WALLS[:2]):
        axis, a0, a1, line = _along(wall["start"], wall["end"])
        sign = 1.0 if (wall["end"][axis] >= wall["start"][axis]) else -1.0
        openings = sorted(sorted((wall["start"][axis] + sign * offset, wall["start"][axis] + sign * (offset + width)))
                          for offset, width in wall.get("doors", []))
        left = a0
        for o0, o1 in openings + [(a1, a1)]:
            if o0 > left:
                mb.box(*_slab(axis, left, o0, line, PARTITION / 2 + 0.005, L.CUT - CAP, L.CUT - 0.005), mats["concrete"])
            left = o1


def partitions(mb, mats):
    """The interior walls, floor to ceiling, open at their doorways under a header (archkit.partitions' shape, all one
    object)."""
    for wall in L.PARTITIONS:
        axis, a0, a1, line = _along(wall["start"], wall["end"])
        sign = 1.0 if (wall["end"][axis] >= wall["start"][axis]) else -1.0
        openings = sorted(sorted((wall["start"][axis] + sign * offset, wall["start"][axis] + sign * (offset + width)))
                          for offset, width in wall["doors"])
        left = a0
        for o0, o1 in openings:
            mb.box(*_slab(axis, left, o0, line, PARTITION / 2, wall["z0"], wall["z1"]), mats["white"])
            mb.box(*_slab(axis, o0, o1, line, PARTITION / 2, L.DOOR_HEAD, wall["z1"]), mats["white"])
            left = o1
        mb.box(*_slab(axis, left, a1, line, PARTITION / 2, wall["z0"], wall["z1"]), mats["white"])


def glass_wall(mb, wall, mats, framed):
    """A glass wall from floor to ceiling on its line: `panes` panes, between slim black mullions and rails if framed
    (the cellar's), frameless edge to edge a centimetre apart otherwise (the spa's onto the light well)."""
    axis, a0, a1, line = _along(wall["start"], wall["end"])
    z0, z1, panes = wall["z0"], wall["z1"], wall["panes"]
    step = (a1 - a0) / panes
    if framed:
        for k in range(panes + 1):
            a = a0 + k * step
            mb.box(*_slab(axis, max(a0, a - MULLION / 2), min(a1, a + MULLION / 2), line, MULLION / 2, z0, z1),
                   mats["frame"])
        for rail0, rail1 in ((z0, z0 + MULLION), (z1 - MULLION, z1)):
            mb.box(*_slab(axis, a0, a1, line, MULLION / 2, rail0, rail1), mats["frame"])
        inset, pz0, pz1 = MULLION / 2, z0 + MULLION, z1 - MULLION
    else:
        inset, pz0, pz1 = 0.005, z0, z1
    for k in range(panes):
        p0, p1 = a0 + k * step + inset, a0 + (k + 1) * step - inset
        mb.box(*_slab(axis, p0, p1, line, GLASS / 2, pz0, pz1), mats["glass"])


def strip(mb, start, end, z, mat, size=STRIP):
    """An LED strip from start to end (x, y) with its top at z, `size` square in section."""
    (x0, y0), (x1, y1) = start, end
    mb.box((min(x0, x1) - size / 2, min(y0, y1) - size / 2, z - size),
           (max(x0, x1) + size / 2, max(y0, y1) + size / 2, z), mat)


def lights(builders, mats):
    """The pools of light (POOLS) every room's downlights cast on its floor, in the room's LT_down_<room>, and the party's
    in LED_party. The downlights' discs are not built: they would hang in the ceiling, which the website's cut takes away
    and the plinth hides otherwise."""
    for pool in L.POOLS:
        x, y = pool["center"]
        mat = mats["glow_party"] if pool["group"] == L.LEDS else mats["glow_room"]
        builders[pool["group"]].disc((x, y, L.FLOOR + L.POOL_LIFT), pool["radius"], mat, start=pool["start"],
                                     sweep=pool["sweep"])


def spin(ob, name, frames):
    """Gives `ob` the clip `name` (an ambient_ loop): one full turn about its own vertical axis over `frames` frames, a
    linear key every quarter turn, so the loop has no seam and the quaternions glTF stores turn the short way."""
    action = bpy.data.actions.new(name)
    strip_ = action.layers.new("Layer").strips.new(type="KEYFRAME")
    slot = action.slots.new("OBJECT", ob.name)
    ob.animation_data_create()
    ob.animation_data.action = action
    ob.animation_data.action_slot = slot
    curve = strip_.channelbag(slot, ensure=True).fcurves.new("rotation_euler", index=2)
    for quarter in range(5):
        key = curve.keyframe_points.insert(quarter * frames / 4, quarter * math.pi / 2)
        key.interpolation = "LINEAR"
    curve.update()


def well(builders, mats):
    """The light well: its walls (darker down towards the floor) and coping, its pebble floor, its plants (which sway),
    its uplights and the light they wash its walls with, and the glass railing round its top (GLASS_rail, fainter than
    the spa's)."""
    boxes(builders[L.WELL_OBJECT], L.WELL_WALLS, mats, uv_tile=1.2)
    (ix0, iy0), (ix1, iy1) = L.WELL_INSIDE
    builders[L.WELL_OBJECT].box((ix0, iy0, L.WELL_FLOOR - 0.02), (ix1, iy1, L.WELL_FLOOR), mats["pebble"])
    for kind, obj, pos, rot, *opts in L.WELL_PIECES:
        furniture.place_into(builders[obj], kind, pos, rot, mats, **dict(opts[0] if opts else {}))
    for wash in L.WASHES:
        builders[wash["group"]].wash(wash["center"], wash["radius"], mats["glow_pool"], wash["facing"],
                                     height=wash.get("height"))
    for start, end, z in L.WELL_STRIPS:
        strip(builders[L.WELL_LIGHTS], start, end, z, mats["led"], size=WELL_STRIP)
    rail = L.WELL_RAIL
    mb = builders[rail["object"]]
    for start, end in rail["runs"]:
        axis, a0, a1, line = _along(start, end)
        panes = max(1, round((a1 - a0) / RAIL_PANE))
        step = (a1 - a0) / panes
        for k in range(panes):
            mb.box(*_slab(axis, a0 + k * step + 0.005, a0 + (k + 1) * step - 0.005, line, GLASS / 2, rail["z0"],
                          rail["z0"] + rail["height"]), mats["glass_rail"])


def build(col, mats):
    builders = {name: MeshBuilder(name) for name in L.OBJECTS if name not in (L.STAIR["name"], L.DISCO)}
    boxes(builders[L.WALLS], L.RETAINING, mats)
    boxes(builders[L.RIM], L.RIM_BOXES, mats)
    caps(builders[L.RIM], mats)  # shown with the rim, only under the basement's cut
    partitions(builders[L.PARTITIONS_OBJECT], mats)
    rooms = {room["name"]: room for room in L.ROOMS}
    for room, key, obj in L.FLOORS:
        (x0, y0), (x1, y1) = rooms[room]["min"], rooms[room]["max"]
        builders[obj].box((x0, y0, L.FLOOR - 0.02), (x1, y1, L.FLOOR), mats[key], uv_tile=4.8 if key == "stone" else 1.0)
    for wall in L.GLASS_WALLS:
        glass_wall(builders[wall["object"]], wall, mats, framed=wall["object"] == L.GLASS_CELLAR)
    boxes(builders[L.GLASS_CELLAR], [L.CELLAR_HEADER], mats)
    boxes(builders[L.ROOMS_OBJECT], L.LININGS, mats)
    own = []  # (object, kind): the pieces that are objects of their own
    entries = {entry[1]: entry for entry in L.FURNITURE}
    for entry in L.FURNITURE:
        kind, name, room, (x, y), rot, *opts = entry
        options = dict(opts[0]) if opts else {}
        into = options.pop("into", None)
        pos = (x, y, L.FLOOR_Z[room])
        if options.pop("on", None) is not None:  # an accent of the decor pass, on its host's top
            pos = (x, y, L.FLOOR_Z[room] + house_check.top_under(entry, entries))
        if into is None or into == L.DISCO:
            own.append((furniture.place(col, name, kind, pos, rot, mats, **options), kind))
            continue
        furniture.place_into(builders[into], kind, pos, rot, mats, **options)
        if kind == "sauna_cabin":  # its glass door with the spa's glass, its stove's stones in the sauna group's object
            furniture.place_into(builders[L.GLASS_SPA], kind, pos, rot, mats, part="door")
            furniture.place_into(builders[L.SAUNA], kind, pos, rot, mats, part="stones")
    (sx0, sy0), (sx1, sy1), sz = L.SAUNA_LIGHT
    strip(builders[L.SAUNA], (sx0, sy0), (sx1, sy1), sz, mats["ember"])
    for start, end, z in L.PARTY_STRIPS:
        strip(builders[L.LEDS], start, end, z, mats["party_led"])
    lights(builders, mats)
    well(builders, mats)
    tub = next((x, y) for kind, name, _room, (x, y), *_ in L.FURNITURE if name == L.TUB)
    water, half = L.TUB_WATER, L.TUB_WATER["half"]
    MeshBuilder(water["name"]).box((tub[0] - half, tub[1] - half, water["top"] - 0.02),
                                   (tub[0] + half, tub[1] + half, water["top"]), mats["water"]).build(col)
    rooftop._bubbles(col, L.TUB, tub, half - 0.15, water["top"], mats, BUBBLES, 11, 60, groups=interact.BUBBLES)
    for name, mb in builders.items():
        spec = L.OBJECTS[name]
        props = {"night_light": True} if spec.get("night") else {}
        if name in SHADOWLESS:
            props["cast_shadow"] = False
        mb.build(col, **props)
    for ob, kind in own:
        if kind == "light_switch":
            ob["cast_shadow"] = False  # a sliver on the wall: its shadow is a pixel, its draw call is not
        elif kind == "disco_ball":
            ob["cast_shadow"] = False
            spin(ob, interact.DISCO_CLIP, SPIN_FRAMES)
    # interaction spec §3.1: what a click toggles, as node extras; and what the website's cut does to each object
    for name, props in interact.tags(L).items():
        for key, value in props.items():
            col.objects[name][key] = value
    for name in interact.buried(L):
        col.objects[name]["buried"] = True
    for name, top in interact.uncut(L).items():
        col.objects[name]["uncut"] = True
        col.objects[name]["cut_top"] = top
    for name, rect in L.OPENINGS.items():  # what the website sees the rest through while the house shows
        col.objects[name]["opening"] = [float(v) for v in rect]


def main():
    args = scene.generator_args("Generate the basement module", DEFAULT_OUT)
    problems = layout_check.check(L)
    for problem in problems:
        print(f"LAYOUT basement: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    if not scene.should_write(args.out, args.force):
        return
    scene.reset()
    build(scene.module_collection(L.MODULE_ID, L.FOOTPRINT, L.ROLE), materials.palette())
    scene.save(args.out)
    print(f"basement: wrote {args.out}")


main()

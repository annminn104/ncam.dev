"""Generate blender/modules/house.blend from houses/house_layout.py with the archkit builders (glass villa spec §8,
villa v2 spec §8), tagging what the website lets a click toggle (interaction spec §3.1, houses/interact.py).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/houses/build_house.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given: once hand-tuned in Blender, the .blend is the source of truth.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import (furniture, glazing, lighting, materials, partitions, planting, rooftop, scene,  # noqa: E402
                     structure, vines, water)
from archkit.catalog import AC_FLAP_OPEN, AC_FLAP_PIVOT, FURNITURE  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from houses import house_layout as L  # noqa: E402
from houses import interact, layout_check  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "house.blend")


AC_FRAMES = 20  # the louvre flap's act_ac_<room> clip opens it over these frames, like the door's
# Small or low pieces the website leaves out of the shadow pass (glTF extras cast_shadow = False, like the garden's):
# their shadow is a few pixels, its draw calls are not.
SHADOWLESS_KINDS = frozenset({"light_switch", "ac_remote"})


def air_conditioner(col, name, room, pos, rot, mats):
    """A split unit (catalog ac_split) as its body and its louvre flap hinged on it about catalog.AC_FLAP_PIVOT as a
    child object of its own (<name>_flap), which the clip act_ac_<room> turns AC_FLAP_OPEN degrees about X to open
    (frame 1 shut). The flap is the unit's status light, so it is the night light; neither casts a shadow (the unit's
    on the wall is a sliver, its draw call is not)."""
    body = furniture.place(col, name, "ac_split", pos, rot, mats, part="body")
    body.pop("night_light", None)  # catalog.NIGHT_KINDS: the light is on the flap
    body["cast_shadow"] = False
    w, d, h = FURNITURE["ac_split"]
    mb = MeshBuilder(f"{name}_flap")
    with mb.placed(tuple(-v for v in AC_FLAP_PIVOT)):  # built about its hinge, its origin there
        furniture.BUILDERS["ac_split"](mb, mats, w, d, h, part="flap")
    flap = mb.build(col, location=AC_FLAP_PIVOT, cast_shadow=False, night_light=True)
    flap.parent = body  # its location is now in the unit's own space
    flap.keyframe_insert("rotation_euler", index=0, frame=1)
    flap.rotation_euler.x = math.radians(AC_FLAP_OPEN)
    flap.keyframe_insert("rotation_euler", index=0, frame=AC_FRAMES)
    flap.rotation_euler.x = 0.0
    flap.animation_data.action.name = f"act_ac_{room}"
    return body, flap


def build(col, mats):
    for group in L.STRUCTURE:
        structure.solid(col, group["name"], group["boxes"], mats, group["uv_tile"])
    for wall in L.CURTAIN_WALLS:
        glazing.curtain_wall(col, wall["name"], wall["start"], wall["end"], wall["z0"], wall["z1"], wall["panes"], mats)
    for rail in L.RAILINGS:
        glazing.glass_railing(col, rail["name"], rail["start"], rail["end"], rail["z0"], rail["height"],
                              rail["panes"], mats)
    for wall in L.PARTITIONS:
        partitions.partition(col, wall["name"], wall["start"], wall["end"], wall["z0"], wall["z1"], mats,
                             doors=wall["doors"])
    for panel in L.FROSTED:
        glazing.frosted_panel(col, panel["name"], panel["start"], panel["end"], panel["z0"], panel["z1"], mats)
    for pane in L.WINDOWS:
        glazing.window(col, pane["name"], pane["start"], pane["end"], pane["z0"], pane["z1"], mats)
    d = L.DOOR
    glazing.sliding_door(col, d["name"], d["x0"], d["x1"], d["y"], d["z0"], d["z1"], d["slide"], mats)
    for hs in L.HOTSPOTS:
        scene.marker(col, hs["name"], hs["location"], **hs["props"])
    merged = {}  # pieces built "into" an object they share (the roof's condensers and their screen)
    for kind, name, room, (x, y), rot, *opts in L.FURNITURE:
        options = dict(opts[0]) if opts else {}
        into = options.pop("into", None)
        if into:
            mb = merged.setdefault(into, MeshBuilder(into))
            furniture.place_into(mb, kind, (x, y, L.FLOOR_Z[room]), rot, mats, **options)
        elif kind == "ac_split":
            air_conditioner(col, name, room, (x, y, L.FLOOR_Z[room]), rot, mats)
        else:
            ob = furniture.place(col, name, kind, (x, y, L.FLOOR_Z[room]), rot, mats, **options)
            if kind in SHADOWLESS_KINDS:
                ob["cast_shadow"] = False
    for mb in merged.values():  # the condensers behind their screen: low, no shadow either
        mb.build(col, cast_shadow=False)
    j = L.JACUZZI
    rooftop.jacuzzi(col, j["name"], j["center"], {**mats, "wood": mats[j.get("deck", "wood")]})  # its deck's wood
    t = L.TRELLIS
    vines.grape_trellis(col, t["name"], t["min"], t["max"], t["z0"], t["height"], mats,
                        leaf_density=t["leaf_density"], bunches=t["bunches"])
    for name, base, size, shrubs in L.PLANTERS:
        planting.planter(col, name, base, size, mats, shrubs=shrubs)
    for group in L.DOWNLIGHTS:
        lighting.downlights(col, group["name"], group["points"], group["z"], mats)
    for strip in L.LED_STRIPS:
        lighting.led_strip(col, strip["name"], strip["start"], strip["end"], strip["z"], mats,
                           size=strip.get("size", 0.03))
    for pend in L.PENDANTS:
        lighting.pendant(col, pend["name"], pend["pos"], pend["ceiling"], pend["drop"], mats)
    for light in L.POINT_LIGHTS:
        lighting.point_light(col, light["name"], light["pos"], light["energy"])
    for pool in L.REFLECTING_POOLS:
        water.reflecting_pool(col, pool["name"], pool["min"], pool["max"], pool["z"], mats, steps=pool["steps"])
    for f in L.WALL_FOUNTAINS:
        water.wall_fountain(col, f["name"], f["start"], f["end"], f["z0"], f["height"], mats, facing=f["facing"])
    for group in L.STRING_LIGHTS:
        lighting.string_lights(col, group["name"], group["points"], mats, bulbs_per_m=group["bulbs_per_m"],
                               sag=group["sag"], bulb_radius=group["bulb_radius"])
    for name, pos, rot in interact.shower_flows(L):
        water.shower_flow(col, name, pos, rot, mats)
    # interaction spec §3.1: what a click on the website toggles, carried to glTF as node extras, and what the dollhouse
    # cut clips at the void's plane, with how high that runs under the ground floor's cut (§2)
    for name, props in interact.tags(L).items():
        ob = col.objects[name]
        for key, value in props.items():
            ob[key] = value
    for name, top in interact.uncut(L).items():
        col.objects[name]["uncut"] = True
        col.objects[name]["cut_top"] = top


def main():
    args = scene.generator_args("Generate the villa house module", DEFAULT_OUT)
    problems = layout_check.check(L)
    for problem in problems:
        print(f"LAYOUT house: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    if not scene.should_write(args.out, args.force):
        return
    scene.reset()
    build(scene.module_collection(L.MODULE_ID, L.FOOTPRINT, L.ROLE), materials.palette())
    scene.save(args.out)
    print(f"house: wrote {args.out}")


main()

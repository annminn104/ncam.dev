"""Generate blender/modules/interior.blend from interior/interior_layout.py (villa v2 spec §12 "Curtains and accessories") with
the archkit builders, tagging the lamps' shades with their rooms' light groups (interior/interact.py).

Like the basement's pieces, everything is merged per object (furniture.place_into, one draw call per material): the
curtains, the blinds and the accessories that show through the glass from afar into Interior_decor, the small things
into Interior_details (tagged detail: the website draws them only while the camera is near the house), the glowing
shades of each lit room's table lamps into its LT_lamp_<room> (a night light; their bases in the decor, drawn whenever
the shades are). Nothing casts a shadow (glTF extras cast_shadow = False): in the house the sun reaches little of it,
and the shadow pass would draw every material of it again.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/interior/build_interior.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import furniture, materials, scene  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from interior import interact, layout_check  # noqa: E402
from interior import interior_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "interior.blend")


def build(col, mats):
    builders = {name: MeshBuilder(name) for name in L.OBJECTS}
    decor = builders[L.DECOR]
    for curtain in L.CURTAINS:
        at = L.curtain_at(curtain)
        furniture.place_into(decor, "curtain", at["pos"], at["rot"], mats, width=at["width"], drop=at["drop"],
                             stack=curtain["stack"])
    for blind in L.BLINDS:
        at = L.blind_at(blind)
        furniture.place_into(decor, "roller_blind", at["pos"], at["rot"], mats, width=at["width"], drop=at["drop"],
                             lowered=at["lowered"])
    for entry in L.FURNITURE:
        kind, _name, room, _center, rot = entry[:5]
        options = L.options(entry)
        options.pop("on", None)
        options.pop("into", None)
        into = builders[L.into(entry)]
        pos = L.stand(entry)
        if kind == "table_lamp":  # its base with the decor, its shade in the room's lamp object, which glows
            furniture.place_into(into, kind, pos, rot, mats, part="base", **options)
            furniture.place_into(builders[L.LAMPS[room]], kind, pos, rot, mats, part="shade", **options)
            continue
        furniture.place_into(into, kind, pos, rot, mats, **options)
    for name, mb in builders.items():
        props = {"cast_shadow": False}
        if L.OBJECTS[name].get("night"):
            props["night_light"] = True
        if L.OBJECTS[name].get("detail"):
            props["detail"] = True  # drawn only while the website's camera is near the house
        mb.build(col, **props)
    # interaction spec §3.1: the lamps' shades join their rooms' light groups, as node extras
    for name, props in interact.tags(L).items():
        for key, value in props.items():
            col.objects[name][key] = value


def main():
    args = scene.generator_args("Generate the interior module", DEFAULT_OUT)
    problems = layout_check.check(L)
    for problem in problems:
        print(f"LAYOUT interior: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    if not scene.should_write(args.out, args.force):
        return
    scene.reset()
    build(scene.module_collection(L.MODULE_ID, L.FOOTPRINT, L.ROLE), materials.palette())
    scene.save(args.out)
    print(f"interior: wrote {args.out}")


main()

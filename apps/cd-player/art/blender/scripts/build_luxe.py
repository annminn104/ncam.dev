"""The web scene of Luxe: the names the page drives in a turntable (src/scene/contract.ts), its LED
ring (`jog_ring`) and the needle's tip (`stylus`, which the measures test reads).

Exec'd by export.py (CDP_MODEL=luxe) after cdkit.py, parts.py, ornament.py, vinyl.py, luxe.py,
luxe_arm.py, luxe_stand.py and luxe_ornament.py, into the same namespace. The arm rests on its post, the record lies on the platter
and its sleeve stands on the ledge, the five rack slots in the stand are empty (the page puts
records and sleeves in them): the page moves all of it at runtime.
"""

import bpy

PIVOTS = {
    "luxe_arm": "arm_pivot",
    "luxe_arm_head": "arm_head",
    "luxe_arm_stylus": "stylus",
    "luxe_btn_prev": "btn_prev",
    "luxe_btn_next": "btn_next",
    "luxe_btn_play": "btn_play",
    "luxe_btn_play_icon_play": "icon_play",
    "luxe_btn_play_icon_pause": "icon_pause",
    "luxe_btn_stop": "btn_stop",
    "luxe_btn_rpt": "btn_rpt",
    "luxe_btn_mode": "btn_mode",
    "luxe_platter": "platter",
    "luxe_disc": "disc",
    "luxe_sleeve": "sleeve",
    "luxe_stand_card": "card",
    "luxe_jog_ring": "jog_ring",
}
PIVOTS.update({"luxe_stand_rack_slot_%d" % i: "rack_slot_%d" % i for i in range(5)})

PRINTS = ("art_disc", "art_sleeve", "card_print")


def build():
    look, _ = luxe_look(None)
    build_luxe_materials(look)
    for name in PRINTS:
        M[name] = mat(name, (0.92, 0.9, 0.88, 1), rough=0.4)
    make_luxe_player("luxe", M["art_disc"], M["art_sleeve"], look)
    for old, new in PIVOTS.items():
        ob = bpy.data.objects.get(old)
        if ob is None:
            raise SystemExit("build_luxe: %s is missing" % old)
        ob.name = new
        if ob.name != new:
            raise SystemExit("build_luxe: %s could not be named %s" % (old, new))
    for item, seat in (("disc", "disc_seat"), ("sleeve", "sleeve_seat")):
        ob = bpy.data.objects[item]
        empty(seat, tuple(ob.location), tuple(ob.rotation_euler), parent=ob.parent)
    print("build_luxe: lead-in %.4f rad, run-out %.4f rad" % (LUXE_ARM_LEAD_IN, LUXE_ARM_RUN_OUT))
    tris = sum(
        sum(len(p.vertices) - 2 for p in ob.data.polygons)
        for ob in SC.collection.all_objects
        if ob.type == "MESH"
    )
    print("build_luxe: %d triangles before the modifiers" % tris)
    return len(SC.collection.all_objects)

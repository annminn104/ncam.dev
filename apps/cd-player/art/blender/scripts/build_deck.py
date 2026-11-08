"""The web scene of the Deck: the names the page drives (src/scene/contract.ts), its jog plate's
hinge (`door_hinge`) and its LED ring (`jog_ring`).

Exec'd by export.py (CDP_MODEL=deck) after cdkit.py, parts.py, deck.py and deck_case.py, into the
same namespace. The plate is shut, the arm at rest beside the disc, the disc on its spindle, the
five rack slots in the case empty (the page puts discs in them): the page moves all of it at
runtime.
"""

import bpy

PIVOTS = {
    "deck_flight": "lid_hinge",
    "deck_arm": "arm_pivot",
    "deck_knob": "knob",
    "deck_btn_prev": "btn_prev",
    "deck_btn_next": "btn_next",
    "deck_btn_play": "btn_play",
    "deck_btn_play_icon_play": "icon_play",
    "deck_btn_play_icon_pause": "icon_pause",
    "deck_btn_stop": "btn_stop",
    "deck_btn_rpt": "btn_rpt",
    "deck_btn_mode": "btn_mode",
    "deck_disc": "disc",
    "deck_case": "case",
    "deck_case_lid": "case_lid_hinge",
    "deck_flight_card": "card",
    "deck_flight_tag": "tag",
    "deck_door": "door_hinge",
    "deck_jog_ring": "jog_ring",
}
PIVOTS.update({"deck_flight_rack_slot_%d" % i: "rack_slot_%d" % i for i in range(5)})
PIVOTS.update({"deck_vu_seg_%d" % i: "vu_seg_%d" % i for i in range(10)})

PRINTS = ("art_disc", "art_booklet", "card_print", "tag_print")


def build():
    look, _ = deck_look(None)
    build_deck_materials(look)
    for name in PRINTS:
        M[name] = mat(name, (0.92, 0.9, 0.88, 1), rough=0.4)
    M["lcd_screen"] = mat("lcd_screen", (0.01, 0.01, 0.012, 1), rough=0.2)
    M["jog_ring"] = mat("jog_ring", (0.02, 0.02, 0.02, 1), rough=0.3)
    make_deck_player("deck", M["art_disc"], M["art_booklet"], look)
    for old, new in PIVOTS.items():
        ob = bpy.data.objects.get(old)
        if ob is None:
            raise SystemExit("build_deck: %s is missing" % old)
        ob.name = new
        if ob.name != new:
            raise SystemExit("build_deck: %s could not be named %s" % (old, new))
    disc = bpy.data.objects["disc"]
    empty("disc_seat", tuple(disc.location), tuple(disc.rotation_euler), parent=disc.parent)
    case = bpy.data.objects["case"]
    empty("case_seat", tuple(case.location), tuple(case.rotation_euler), parent=case.parent)
    tris = sum(
        sum(len(p.vertices) - 2 for p in ob.data.polygons)
        for ob in SC.collection.all_objects
        if ob.type == "MESH"
    )
    print("build_deck: %d triangles before the modifiers" % tris)
    return len(SC.collection.all_objects)

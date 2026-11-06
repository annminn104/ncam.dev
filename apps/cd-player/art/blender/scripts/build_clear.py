"""The web scene of the Clear model: the names the page drives (src/scene/contract.ts), and its
door (`door_hinge`).

Exec'd by export.py (CDP_MODEL=clear) after cdkit.py, parts.py and clear.py, into the same
namespace. The door is shut, the arm at rest off the disc's rim, the disc on its spindle, the five
rack slots on the stand empty (the page puts discs in them): the page moves all of it at runtime.
"""
import bpy

PIVOTS = {
    "clear_lid": "lid_hinge",
    "clear_arm": "arm_pivot",
    "clear_knob": "knob",
    "clear_btn_prev": "btn_prev",
    "clear_btn_next": "btn_next",
    "clear_btn_play": "btn_play",
    "clear_btn_stop": "btn_stop",
    "clear_btn_rpt": "btn_rpt",
    "clear_btn_mode": "btn_mode",
    "clear_disc": "disc",
    "clear_case": "case",
    "clear_case_lid": "case_lid_hinge",
    "clear_plate_print": "card",
    "clear_tag": "tag",
    "clear_door": "door_hinge",
}
PIVOTS.update({"clear_rack_slot_%d" % i: "rack_slot_%d" % i for i in range(5)})
PIVOTS.update({"clear_vu_seg_%d" % i: "vu_seg_%d" % i for i in range(10)})
PRINTS = ("art_disc", "art_booklet", "card_print", "tag_print")


def build():
    look, _ = clear_look(None)
    build_clear_materials(look)
    for name in PRINTS:
        M[name] = mat(name, (0.92, 0.9, 0.88, 1), rough=0.4)
    M["lcd_screen"] = mat("lcd_screen", (0.01, 0.01, 0.012, 1), rough=0.2)
    make_clear_player("clear", M["art_disc"], M["art_booklet"], look)
    for old, new in PIVOTS.items():
        ob = bpy.data.objects.get(old)
        if ob is None:
            raise SystemExit("build_clear: %s is missing" % old)
        ob.name = new
        if ob.name != new:
            raise SystemExit("build_clear: %s could not be named %s" % (old, new))
    disc = bpy.data.objects["disc"]
    empty("disc_seat", tuple(disc.location), tuple(disc.rotation_euler), parent=disc.parent)
    case = bpy.data.objects["case"]
    empty("case_seat", tuple(case.location), tuple(case.rotation_euler), parent=case.parent)
    return len(SC.collection.all_objects)

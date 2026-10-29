"""The web scene: the suitcase player with the names the page drives (src/scene/contract.ts).

Exec'd by export.py after cdkit.py and parts.py, into the same namespace. The lid is open, the
tonearm at rest, the disc on the spindle: the page moves all of it at runtime.
"""
import bpy

PIVOTS = {
    "player_lid": "lid_hinge",
    "player_arm": "arm_pivot",
    "player_knob": "knob",
    "player_btn_prev": "btn_prev",
    "player_btn_next": "btn_next",
    "player_btn_play": "btn_play",
    "player_btn_stop": "btn_stop",
    "player_btn_rpt": "btn_rpt",
    "player_btn_mode": "btn_mode",
    "player_disc": "disc",
    "player_case": "case",
    "player_case_lid": "case_lid_hinge",
    "player_pol_a": "polaroid_a",
    "player_pol_b": "polaroid_b",
    "player_card": "card",
}

PRINTS = ("art_disc", "art_booklet", "art_photo_a", "art_photo_b", "card_print")


def build():
    build_materials()
    for name in PRINTS:
        M[name] = mat(name, (0.92, 0.9, 0.88, 1), rough=0.4)
    M["lcd_screen"] = mat("lcd_screen", (0.01, 0.01, 0.012, 1), rough=0.2)
    make_player("player", M["art_disc"], M["art_booklet"], (M["art_photo_a"], M["art_photo_b"]),
                lid_open=100.0, arm_angle=0.0, web=True)
    for old, new in PIVOTS.items():
        ob = bpy.data.objects.get(old)
        if ob is None:
            raise SystemExit("build_player: %s is missing" % old)
        ob.name = new
        if ob.name != new:
            raise SystemExit("build_player: %s could not be named %s" % (old, new))
    disc = bpy.data.objects["disc"]
    case = bpy.data.objects["case"]
    empty("disc_seat", tuple(disc.location), tuple(disc.rotation_euler), parent=disc.parent)
    empty("case_seat", tuple(case.location), tuple(case.rotation_euler), parent=case.parent)
    return len(SC.collection.all_objects)

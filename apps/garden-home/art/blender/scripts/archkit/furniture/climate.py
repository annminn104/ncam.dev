"""Air conditioning (the tall house's bedrooms): the split unit on the wall, built whole or as its body and its louvre
flap (part=, the flap about catalog.AC_FLAP_PIVOT, where the house hinges it), its wall remote, the outdoor condenser
and the low teak screen that hides the condensers on the roof."""
from ..catalog import AC_FLAP_PIVOT

AC_PARTS = ("body", "flap")


def ac_split(mb, m, w, d, h, part=None):
    # A slim white wall unit: its casing, recessed at the bottom front behind the louvre flap that hangs from its hinge
    # there. The flap is the unit's status light, white like the casing but for a soft cool glow the website gives it
    # while the unit runs: one material each, so the unit is two draw calls.
    if part is not None and part not in AC_PARTS:
        raise ValueError(f"ac_split part must be one of {AC_PARTS} or None, got {part!r}")
    _, py, pz = AC_FLAP_PIVOT
    if part in (None, "body"):
        mb.box((-w / 2, -d / 2 + 0.02, pz), (w / 2, d / 2, h), m["white"])
        mb.box((-w / 2, -d / 2 + 0.04, 0.0), (w / 2, d / 2, pz), m["white"])
    if part in (None, "flap"):
        mb.box((-w / 2 + 0.05, py - 0.006, pz - 0.07), (w / 2 - 0.05, py + 0.002, pz), m["ac_light"])


def ac_remote(mb, m, w, d, h):
    # The unit's wall remote at switch height beside the room's light switch: a black glass controller, its display
    # standing a millimetre proud of its plate, dark so it shows on the white wall; one material, one draw call.
    mb.box((-w / 2, -d / 2 + 0.002, 0.0), (w / 2, d / 2, h), m["screen"])
    mb.box((-w / 2 + 0.01, -d / 2, h / 2), (w / 2 - 0.01, -d / 2 + 0.002, h - 0.015), m["screen"])


def ac_condenser(mb, m, w, d, h):
    # The outdoor unit, all grey metal: a casing on two feet with a round fan grille standing out of its front, a ring
    # round a hub.
    mb.box((-w / 2, -d / 2 + 0.03, 0.06), (w / 2, d / 2, h), m["metal"])
    for x in (-w / 2 + 0.08, w / 2 - 0.08):
        mb.box((x - 0.04, -d / 2 + 0.03, 0.0), (x + 0.04, d / 2, 0.06), m["metal"])
    middle = (-w / 2 + 0.3, 0.06 + (h - 0.06) / 2)
    mb.cylinder((middle[0], -d / 2 + 0.01, middle[1]), 0.21, 0.02, m["metal"], segments=12, axis="y")
    mb.cylinder((middle[0], -d / 2, middle[1]), 0.06, 0.01, m["metal"], segments=8, axis="y")


SCREEN_SLAT = 0.12  # slat pitch of the teak screen


def teak_screen(mb, m, w, d, h):
    # A low screen of vertical teak slats between two end posts, on two rails, that hides what stands behind it.
    for x in (-w / 2, w / 2 - d):
        mb.box((x, -d / 2, 0.0), (x + d, d / 2, h), m["teak"])
    for z in (0.12, h - 0.15):
        mb.box((-w / 2 + d, -d / 2 + 0.015, z), (w / 2 - d, d / 2 - 0.015, z + 0.05), m["teak"])
    slats = round((w - 2 * d) / SCREEN_SLAT)
    step = (w - 2 * d) / slats
    for i in range(slats):
        x = -w / 2 + d + (i + 0.5) * step
        mb.box((x - 0.025, -d / 2, 0.02), (x + 0.025, -d / 2 + 0.03, h - 0.02), m["teak"])


BUILDERS = {"ac_split": ac_split, "ac_remote": ac_remote, "ac_condenser": ac_condenser, "teak_screen": teak_screen}

"""Luxe's record stand and its ledge: make_stand and make_ledge, which luxe.py's make_luxe_player
calls.

Needs cdkit's, parts.py's, vinyl.py's and luxe.py's namespace (exec'd after luxe.py: the sleeves
are vinyl.py's make_sleeve, the colours luxe.py's materials). Blender's axes as in parts.py,
millimetres through L(x, y, z).

The stand (`<name>`, its root on the floor at LS_AT, turned LS_TURN toward the deck and the
viewer, as the Clear's stand is) is lacquered as the deck's body, its rails and bar metal. In its
own frame (its front toward -y): five steps rising backward (`<name>_step_k`, a staircase whose
step 0's front is the stand's front, nothing in front of it), a side panel either side of them
(`<name>_panel_l`, `_r`) with a metal rail along its sloping top, and the back bar
(`<name>_bar`) high at the back on two posts. The five rack slots (`<name>_rack_slot_k`, empties
in the record's frame) each hold a sleeve leaning back LS_LEAN, its bottom edge just behind step
k's front edge and over its top, the record inside it: the first shows its whole cover, the
others their top edges, LS_RISE apart; slot 4's leans on the bar. A render stands a sleeve in each
slot; the web build carries the slots empty, for the page to fill. The plaque on step 0's front
(`<name>_card`, an empty holding the page's `<name>_card_print`, 112 x 20 mm: the canvas's
1024 x 182; a render letters it) carries the collection's name.

The ledge (`<name>`, at (-150, 205) behind the deck, unturned) is a small metal easel: a bar on
the floor, a lip along its front and two legs leaning back LS_LEAN, which the playing record's
sleeve (make_luxe_player's `<player>_sleeve`) stands on, facing the viewer.
"""
import math

LS_AT = (420.0, 60.0)                 # the stand's root on the floor, right of the deck
LS_TURN = math.radians(-18.0)         # turned toward the deck and the viewer, as the Clear's stand is
LS_PITCH = 34.0                       # a step's depth: each slot 34 mm behind the one in front ...
LS_RISE = 12.0                        # ... and 12 mm higher
LS_BASE = 30.0                        # step 0's top
LS_INNER = 165.0                      # the steps span x +-165, between the side panels
LS_FRONT = -85.0                      # step 0's front: the stand's front
LS_BACK = 105.0                       # the last step's back: the stand's back
LS_LEAN = math.radians(15.0)          # every sleeve leans back 15 degrees from upright
LS_PANEL = (10.0, 90.0, 170.0)        # the side panels: thickness, height at the front, at the back
LS_BAR = (93.0, 210.0, 4.0)           # the back bar: y, z, radius
LS_SIDE = (math.radians(90), 0.0, math.radians(90))   # as deck.py's DK_SIDE: local x back, y up, z right
LS_CARD = (15.0, 118.0, 26.0)         # the plaque: its middle's height on step 0's front, its plate
LEDGE_AT = (-150.0, 205.0)            # the ledge's root on the floor, behind the deck at the platter's left
LEDGE_BAR = (200.0, 24.0, 8.0)        # its bar: width, depth, height, its front at the root
LEDGE_LIP = (3.0, 4.0)                # the lip along the bar's front: depth, height
LEDGE_LEG = (80.0, 9.0, 2.5, 248.0)   # the legs: x either side, y on the bar, radius, the top's height


def stand_slot_pose(k):
    """Rack slot k's sleeve (and its record) in the stand's frame: its centre and its turn (local Z
    the face's normal, toward the front and a little up; local +Y the cover's top, leaning back
    LS_LEAN). Its bottom edge (mid-thickness) lies 1 mm behind step k's front edge and 0.5 mm over
    its top: (0, -43.9 + 34 k, 180.2 + 12 k), turned 75 degrees about X."""
    half = SLEEVE_W / 2
    y0 = LS_FRONT + LS_PITCH * k + 1.0
    z0 = LS_BASE + LS_RISE * k + 0.5
    return ((0.0, y0 + half * math.sin(LS_LEAN), z0 + half * math.cos(LS_LEAN)),
            (math.pi / 2 - LS_LEAN, 0.0, 0.0))


def _panel_top(y):
    """The side panels' sloping top edge's height at `y` (the stand's frame)."""
    _, h0, h1 = LS_PANEL
    return h0 + (h1 - h0) * (y - LS_FRONT) / (LS_BACK - LS_FRONT)


def stand_body(name, stand):
    """The steps, the side panels with their rails, and the back bar on its two posts."""
    for k in range(5):
        y0 = LS_FRONT + LS_PITCH * k
        y1 = LS_BACK if k == 4 else y0 + LS_PITCH
        h = LS_BASE + LS_RISE * k
        rbox("%s_step_%d" % (name, k), (2 * LS_INNER, y1 - y0, h), M["luxe_body"], bevel_mm=1.0, parent=stand,
             loc=L(0.0, (y0 + y1) / 2, h / 2))
    t, h0, h1 = LS_PANEL
    outline = [(LS_FRONT, 0.0), (LS_FRONT, h0), (LS_BACK, h1), (LS_BACK, 0.0)]
    # Along the slope's outward normal, so that each rail sits on its panel's edge, 1 mm into it.
    run, rise = LS_BACK - LS_FRONT, h1 - h0
    n = math.hypot(run, rise)
    ny, nz = -rise / n * 2.0, run / n * 2.0
    bar_y, bar_z, bar_r = LS_BAR
    for side, sx in (("l", -1), ("r", 1)):
        x0, x1 = sorted((sx * LS_INNER, sx * (LS_INNER + t)))
        slab("%s_panel_%s" % (name, side), [outline], x0, x1, M["luxe_body"], bevel_mm=1.0, parent=stand, rot=LS_SIDE)
        x = sx * (LS_INNER + t / 2)
        tube("%s_rail_%s" % (name, side), [(x, LS_FRONT + ny, h0 + nz), (x, LS_BACK + ny, h1 + nz)], 3.0,
             M["luxe_metal"], parent=stand)
        # The bar's post, up from the rail into the bar.
        tube("%s_post_%s" % (name, side), [(x, bar_y, _panel_top(bar_y)), (x, bar_y, bar_z)], 3.0, M["luxe_metal"],
             parent=stand)
    end = LS_INNER + t + 1.0   # past the posts, which end in it
    tube(name + "_bar", [(-end, bar_y, bar_z), (end, bar_y, bar_z)], bar_r, M["luxe_metal"], parent=stand)


def stand_card(name, stand, playlist, web):
    """The plaque on step 0's front (`<name>_card`, its local z toward the viewer, local y up):
    the page's print (`<name>_card_print`, 112 x 20 mm) on a metal plate; a render letters it."""
    z, pw, ph = LS_CARD
    card = empty(name + "_card", L(0.0, LS_FRONT - 0.6, z), (math.pi / 2, 0.0, 0.0), parent=stand)
    rbox(name + "_card_plate", (pw, ph, 1.2), M["luxe_metal"], bevel_mm=0.0 if web else 0.4, parent=card)
    rbox(name + "_card_print", (112.0, 20.0, 0.05), M["card_print"], parent=card, loc=L(0.0, 0.0, 0.75))
    if not web:
        text(name + "_card_t1", "SETLIST", 2.6, M["ink"], font="avenir", align="LEFT", parent=card,
             loc=L(-50.0, 5.4, 0.8))
        text(name + "_card_t2", playlist, 5.0, M["ink_dark"], font="futura", parent=card, loc=L(0.0, -2.4, 0.8))
    return card


def make_stand(name, root, rack_sleeves, playlist, web):
    """The record stand under its root, the empty `name`, right of the deck and turned toward it:
    its body, the five rack slots (a render stands a sleeve printed with rack_sleeves[k] in each;
    the record inside it is hidden by it, so a render leaves it out) and the plaque."""
    stand = empty(name, L(LS_AT[0], LS_AT[1], 0.0), (0.0, 0.0, LS_TURN), parent=root)
    stand_body(name, stand)
    for k in range(5):
        centre, rot = stand_slot_pose(k)
        empty("%s_rack_slot_%d" % (name, k), L(*centre), rot, parent=stand)
        if rack_sleeves:
            make_sleeve("%s_sleeve_%d" % (name, k), rack_sleeves[k], L(*centre), rot, parent=stand)
    stand_card(name, stand, playlist, web)
    return stand


def make_ledge(name, root):
    """The ledge under its root, the empty `name`, behind the deck: the bar on the floor, the lip
    along its front and the two legs leaning back from the bar's top."""
    ledge = empty(name, L(LEDGE_AT[0], LEDGE_AT[1], 0.0), parent=root)
    w, d, h = LEDGE_BAR
    rbox(name + "_bar", (w, d, h), M["luxe_metal"], bevel_mm=0.0 if WEB else 0.5, parent=ledge,
         loc=L(0.0, d / 2, h / 2))
    ld, lh = LEDGE_LIP
    rbox(name + "_lip", (w, ld, lh), M["luxe_metal"], bevel_mm=0.0 if WEB else 0.4, parent=ledge,
         loc=L(0.0, ld / 2, h + lh / 2))
    lx, ly, lr, top = LEDGE_LEG
    lean = math.tan(LS_LEAN)
    z0 = h - 2.0   # from inside the bar, so the leg's tilted end never shows over its top
    for side, sx in (("l", -1), ("r", 1)):
        tube("%s_leg_%s" % (name, side), [(sx * lx, ly + (z0 - h) * lean, z0), (sx * lx, ly + (top - h) * lean, top)],
             lr, M["luxe_metal"], parent=ledge)
    return ledge

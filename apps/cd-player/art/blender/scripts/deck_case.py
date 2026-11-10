"""The Deck's flight case and its jewel case: make_flight_case and deck_jewel_case, which deck.py's
make_deck_player calls.

Needs cdkit's, parts.py's, deck.py's and deck_panel.py's namespace (exec'd after them: the rivets
are deck_panel.py's _dome_cluster). Blender's axes as in parts.py, millimetres through L(x, y, z).

The flight case stands right of the deck, turned toward it and the viewer: an aluminium base
(open on top) on its four ball corners, dark angle extrusions on every edge of the base and the
lid, riveted about every 30 mm, two aluminium ribs along each of the base's sides, two butterfly
latches on its front seam, a foam block in the base with five slots, a disc standing upright in
each (a render; the web build carries the slots' empties, `<name>_rack_slot_i`, for the page to
fill), each slot behind and above the one in front so every label shows. The lid, hinged on the
base's back top edge, stands open past upright, a foam pad inside it with the setlist card taped
to it (`<name>_card`, the page's card_print; a render letters it). A strap handle crosses the
base's front, a paper tag hanging from it on a string (`<name>_tag`, the page's tag_print). The
case's front and sides carry the print layer (deck_print.py), the front its stencil: the open
lid's outside faces away from every view, so it carries nothing. The jewel case (parts.py's
make_case) lies shut on the floor in front of the flight case.
"""
import math

from mathutils import Matrix, Vector

FC_AT = (280.0, 40.0)               # the case's root on the floor, right of the deck
FC_TURN = math.radians(-18.0)       # turned toward the deck and the viewer, as the Clear's stand is
FC_W, FC_D, FC_H = 170.0, 150.0, 120.0   # the base: width, depth, height
FC_WALL = 3.0
FC_BALL = 7.0                       # the ball corners' radius
FC_LIFT = FC_BALL                   # the base's underside: the case stands on its bottom ball corners
FC_LID_H = 40.0
FC_LID_OPEN = math.radians(105.0)
FC_RAIL = 16.0                      # the angle extrusions' legs
FC_CAP = FC_WALL + 1.6              # a rim extrusion's leg across the rim: over the wall and past it
FC_FOAM_TOP = 112.0
FC_SLOT_Y, FC_SLOT_DY = -40.0, 18.0   # slot k's disc: centred at y -40 + 18 k ...
FC_SLOT_Z, FC_SLOT_DZ = 112.0, 14.0   # ... and z 112 + 14 k: behind and above the one in front
FC_HANDLE_Z = 80.0
JEWEL_AT = (252.0, -150.0)          # the jewel case on the floor, in front of the flight case, clear of the deck
JEWEL_TURN = math.radians(-10.0)
# The angle extrusions along x, along y and upright: thicknesses (and the ends of the first two)
# a few hundredths apart, so that where two overlap at a corner no two faces coincide.
FC_T = {"x": 1.60, "y": 1.65, "z": 1.72}
FC_END = {"x": 1.68, "y": 1.69}
FC_RIVET = (1.5, 0.7)               # the rivets' radius and height (3 mm across)
FC_RIVETS_X = (-60.0, -30.0, 0.0, 30.0, 60.0)   # along the extrusions across the front and back, clear of the corners
FC_RIVETS_Y = (-57.0, -28.5, 0.0, 28.5, 57.0)   # along those on the sides
FC_LATCH_X = 45.0                   # the butterfly latches, either side of the front seam's middle
FC_TAG = (40.0, 60.0)               # the paper tag: 2:3, the page's 512 x 768 tag canvas


def flight_slot_pose(k):
    """Rack slot k's disc in the case's frame: its centre, and its turn (its label, local +z,
    toward the case's front, upright)."""
    return (0.0, FC_SLOT_Y + FC_SLOT_DY * k, FC_SLOT_Z + FC_SLOT_DZ * k), (math.radians(90), 0.0, 0.0)


def flight_rail(name, parent, p0, p1, n1, n2, legs, t):
    """A dark angle extrusion along a box's edge from p0 to p1 (mm, on the edge, the parent's
    frame). n1 and n2 are its two faces' outward normals (unit axis vectors); one leg lies legs[0]
    mm across the n1 face, the other legs[1] mm across the n2 face, both t thick outside the
    panels."""
    n1, n2 = Vector(n1), Vector(n2)
    e = n1.cross(n2)
    a, b = legs
    # (u, v) along (n1, n2), the edge at the origin and the box behind both faces.
    outline = [(0.0, -a), (t, -a), (t, t), (-b, t), (-b, 0.0), (0.0, 0.0)]
    run = (Vector(p1) - Vector(p0)).dot(e)
    rot = Matrix((n1, n2, e)).transposed().to_euler()
    return slab(name, [outline], min(0.0, run), max(0.0, run), M["rubber"], bevel_mm=0.0 if WEB else 0.25, res=2,
                parent=parent, loc=L(*p0), rot=rot)


def flight_box(name, parent, a, b, cy, z_closed, z_open, riveted):
    """The extrusions round a box x +-a, y cy +-b, between its closed face at z_closed and its open
    rim at z_open: on the closed face's four edges, up its four corners and round its rim (whose
    legs lie on the face and across the rim), and a ball corner on each corner of the closed face.
    The extrusions run full length and overlap at the corners, under the balls. Their legs on the
    box's sides are riveted about every 30 mm at the heights `riveted` gives the upright ones, all
    the rivets one mesh (`<name>_rivets`)."""
    up = 1.0 if z_open > z_closed else -1.0
    out = (0.0, 0.0, -up)               # the closed face's outward normal
    rim = (0.0, 0.0, up)                # the rim's
    r, h = FC_RIVET
    rivets = []
    k = 0
    for z, n2, legs in ((z_closed, out, (FC_RAIL, FC_RAIL)), (z_open, rim, (FC_RAIL, FC_CAP))):
        zr = z - n2[2] * FC_RAIL / 2    # the middle of the leg on the side
        for sy in (-1, 1):
            ex = a + FC_END["x"]
            flight_rail("%s_rail_%d" % (name, k), parent, (-ex, cy + sy * b, z), (ex, cy + sy * b, z), (0.0, sy, 0.0),
                        n2, legs, FC_T["x"])
            k += 1
            # On the front seam the latches (x +-33 to +-57) stand between these.
            rivets += [((x, cy + sy * (b + FC_T["x"]), zr), (0.0, sy, 0.0), r, h) for x in FC_RIVETS_X]
        for sx in (-1, 1):
            ey = b + FC_END["y"]
            flight_rail("%s_rail_%d" % (name, k), parent, (sx * a, cy - ey, z), (sx * a, cy + ey, z), (sx, 0.0, 0.0),
                        n2, (legs[0] - 0.1, legs[1]), FC_T["y"])
            k += 1
            rivets += [((sx * (a + FC_T["y"]), cy + y, zr), (sx, 0.0, 0.0), r, h) for y in FC_RIVETS_Y]
    for sx in (-1, 1):
        for sy in (-1, 1):
            flight_rail("%s_rail_%d" % (name, k), parent, (sx * a, cy + sy * b, z_closed), (sx * a, cy + sy * b, z_open),
                        (sx, 0.0, 0.0), (0.0, sy, 0.0), (FC_RAIL, FC_RAIL), FC_T["z"])
            k += 1
            sphere("%s_ball_%d%d" % (name, sx, sy), FC_BALL, M["hardware"], seg=16 if WEB else 32, parent=parent,
                   loc=L(sx * a, cy + sy * b, z_closed))
            for zz in riveted:
                rivets.append(((sx * (a + FC_T["z"]), cy + sy * (b - FC_RAIL / 2), zz), (sx, 0.0, 0.0), r, h))
                rivets.append(((sx * (a - FC_RAIL / 2), cy + sy * (b + FC_T["z"]), zz), (0.0, sy, 0.0), r, h))
    _dome_cluster(name + "_rivets", rivets, M["hardware"], parent, seg=8 if WEB else 12)


def flight_base(name, case):
    """The base: aluminium walls and floor, open on top, on its ball corners, its extrusions
    riveted; two aluminium ribs along each side between the upright extrusions; the two butterfly
    latches on the front seam; the foam block with the five slots."""
    z0, z1 = FC_LIFT, FC_LIFT + FC_H
    outer = rrect(FC_W, FC_D, 1.5, seg=4)
    inner = rrect(FC_W - 2 * FC_WALL, FC_D - 2 * FC_WALL, 0.6, seg=4)
    slab(name + "_floor", [outer], z0, z0 + FC_WALL, M["alu"], parent=case)
    slab(name + "_walls", [outer, inner], z0 + FC_WALL, z1, M["alu"], parent=case)
    flight_box(name + "_base", case, FC_W / 2, FC_D / 2, 0.0, z0, z1, (z0 + 30.0, z0 + 60.0, z0 + 90.0))
    for k, (sx, z) in enumerate([(sx, z) for sx in (-1, 1) for z in (z0 + 40.0, z0 + 80.0)]):
        x = sx * (FC_W / 2 + 0.6)
        tube("%s_rib_%d" % (name, k), [(x, -FC_D / 2 + FC_RAIL + 2.0, z), (x, FC_D / 2 - FC_RAIL - 2.0, z)], 2.0, M["alu"],
             parent=case)
    for k, sx in enumerate((-1, 1)):
        flight_latch("%s_latch_%d" % (name, k), case, sx * FC_LATCH_X, z1)
    slots = [rrect(124.0, 2.6, 1.2, cy=FC_SLOT_Y + FC_SLOT_DY * k) for k in range(5)]
    slab(name + "_foam", [rrect(FC_W - 2 * FC_WALL - 0.4, FC_D - 2 * FC_WALL - 0.4, 1.0)] + slots, z0 + FC_WALL,
         FC_FOAM_TOP, M["foam"], bevel_mm=0.0 if WEB else 0.8, parent=case)


def flight_latch(name, case, x, rim):
    """A butterfly latch on the base's front, just under the seam, over the rim's extrusion: its
    plate, a spacer under the plate's lower half (the panel there stands behind the extrusion), the
    butterfly lying flat on its pivot, and the bail hanging open below it (the lid is up)."""
    face = -FC_D / 2 - FC_T["x"] - 0.05          # the extrusion's outer face
    zc = rim - 11.0
    rbox(name, (24.0, 1.4, 22.0), M["hardware"], bevel_mm=0.0 if WEB else 0.5, parent=case,
         loc=L(x, face - 0.7, zc))
    rbox(name + "_spacer", (20.0, FC_T["x"] + 0.05, 7.0), M["hardware"], parent=case,
         loc=L(x, -FC_D / 2 - (FC_T["x"] + 0.05) / 2, rim - FC_RAIL - 3.6))
    wing = [(-10.0, -4.2), (-3.0, -1.6), (3.0, -1.6), (10.0, -4.2), (10.6, 0.0), (10.0, 4.2), (3.0, 1.6), (-3.0, 1.6),
            (-10.0, 4.2), (-10.6, 0.0)]
    slab(name + "_wing", [wing], 0.0, 1.2, M["hardware"], bevel_mm=0.0 if WEB else 0.3, parent=case,
         loc=L(x, face - 1.4, zc + 3.0), rot=DK_FRONT)
    _dome_cluster(name + "_pivot", [((x, face - 2.6, zc + 3.0), (0.0, -1.0, 0.0), 2.2, 1.0)], M["hardware"], case)
    tube(name + "_bail", [(x - 6.0, face - 2.4, zc - 2.0), (x - 6.0, face - 2.9, zc - 11.0), (x - 4.0, face - 3.0, zc - 14.0),
                          (x + 4.0, face - 3.0, zc - 14.0), (x + 6.0, face - 2.9, zc - 11.0), (x + 6.0, face - 2.4, zc - 2.0)],
         0.7, M["hardware"], parent=case)


def flight_rack(name, case, rack_labels):
    """The five slots: an empty per slot (`<name>_rack_slot_k`, the pose of a disc in it) under the
    case's root; a render (rack_labels) stands a disc in each."""
    for k in range(5):
        centre, rot = flight_slot_pose(k)
        empty("%s_rack_slot_%d" % (name, k), L(*centre), rot, parent=case)
        if rack_labels:
            make_disc("%s_disc_%d" % (name, k), rack_labels[k], L(*centre), rot=rot, parent=case)


def flight_lid(name, case, playlist, web):
    """The lid, hinged on the base's back top edge (its hinge 2 mm outboard of the extrusions, at
    the rims' meeting plane) and open FC_LID_OPEN: its walls, top and riveted extrusions, the
    latches' keepers on its front seam, a foam pad inside, and the setlist card taped to the pad
    (`<name>_card`, an empty holding the page's `<name>_card_print`, 112 x 20 mm: the canvas's
    1024 x 182; a render letters it)."""
    hy = FC_D / 2 + FC_T["z"] + 2.0
    hz = FC_LIFT + FC_H + FC_T["x"]
    tube(name + "_hinge_pin", [(-FC_W / 2 + 6.0, hy, hz), (FC_W / 2 - 6.0, hy, hz)], 1.8, M["hardware"], parent=case)
    lid = empty(name + "_lid", L(0.0, hy, hz), (-FC_LID_OPEN, 0.0, 0.0), parent=case)
    # In the lid's frame, shut: y from its hinge (0) toward the front, z up from the rims' meeting
    # plane; its rim at z 1.6, its top at 1.6 + FC_LID_H.
    cy = -hy
    z0, z1 = FC_T["x"], FC_T["x"] + FC_LID_H
    outer = rrect(FC_W, FC_D, 1.5, seg=4, cy=cy)
    inner = rrect(FC_W - 2 * FC_WALL, FC_D - 2 * FC_WALL, 0.6, seg=4, cy=cy)
    slab(name + "_lid_walls", [outer, inner], z0, z1 - FC_WALL, M["alu"], parent=lid)
    slab(name + "_lid_top", [outer], z1 - FC_WALL, z1, M["alu"], parent=lid)
    flight_box(name + "_lid", lid, FC_W / 2, FC_D / 2, cy, z1, z0, ((z0 + z1) / 2,))
    front = cy - FC_D / 2 - FC_T["x"] - 0.05      # the lid's front extrusion's outer face, shut
    for k, sx in enumerate((-1, 1)):
        rbox("%s_keeper_%d" % (name, k), (16.0, 1.4, 10.0), M["hardware"], bevel_mm=0.0 if web else 0.4, parent=lid,
             loc=L(sx * FC_LATCH_X, front - 0.7, z0 + 6.0))
        tube("%s_keeper_hook_%d" % (name, k), [(sx * FC_LATCH_X - 5.0, front - 1.4, z0 + 2.2),
                                                (sx * FC_LATCH_X - 5.0, front - 3.2, z0 + 1.6),
                                                (sx * FC_LATCH_X + 5.0, front - 3.2, z0 + 1.6),
                                                (sx * FC_LATCH_X + 5.0, front - 1.4, z0 + 2.2)], 0.8, M["hardware"],
             parent=lid)
    pad = z1 - FC_WALL - 12.0
    slab(name + "_lid_foam", [rrect(FC_W - 2 * FC_WALL - 0.4, FC_D - 2 * FC_WALL - 0.4, 1.0, cy=cy)], pad,
         z1 - FC_WALL, M["foam"], bevel_mm=0.0 if web else 0.8, parent=lid)
    # The card, high on the open lid (near its front edge, the top once open), facing out of the
    # pad: its local y up the open lid, its local z toward the viewer.
    card = empty(name + "_card", L(0.0, cy - 50.0, pad - 0.06), (math.pi, 0.0, 0.0), parent=lid)
    rbox(name + "_card_print", (112.0, 20.0, 0.05), M["card_print"], parent=card)
    if not web:
        text(name + "_card_t1", "SETLIST", 2.6, M["ink"], font="avenir", align="LEFT", parent=card,
             loc=L(-44.0, 5.2, 0.05))
        text(name + "_card_t2", playlist, 5.0, M["ink_dark"], font="futura", parent=card, loc=L(0.0, -2.4, 0.05))
    for k, sx in enumerate((-1, 1)):
        rbox("%s_card_tape_%d" % (name, k), (7.0, 28.0, 0.1), M["ink"], parent=card,
             loc=L(sx * 50.5, 0.0, 0.08), rot=(0.0, 0.0, math.radians(6.0 * sx)))
    return lid


def flight_handle(name, case):
    """The strap handle across the base's front at FC_HANDLE_Z: a rubber strap bowed out between two
    riveted metal brackets."""
    y = -FC_D / 2
    for k, sx in enumerate((-1, 1)):
        rbox("%s_handle_bracket_%d" % (name, k), (12.0, 4.0, 26.0), M["hardware"], bevel_mm=0.0 if WEB else 1.0,
             parent=case, loc=L(sx * 40.0, y - 2.0, FC_HANDLE_Z))
        for j, dz in enumerate((-8.5, 8.5)):
            rivet("%s_handle_rivet_%d%d" % (name, k, j), L(sx * 40.0, y - 4.0, FC_HANDLE_Z + dz), (math.pi / 2, 0, 0),
                  parent=case, r=1.6)
    xs = [-36.0 + 72.0 * i / 16 for i in range(17)]
    mid = [(x, y - 4.0 - 14.0 * (1.0 - (x / 36.0) ** 2)) for x in xs]
    outline = [(x, yy - 1.5) for x, yy in mid] + [(x, yy + 1.5) for x, yy in reversed(mid)]
    slab(name + "_handle", [outline], FC_HANDLE_Z - 6.0, FC_HANDLE_Z + 6.0, M["rubber"], bevel_mm=0.0 if WEB else 0.8,
         parent=case)


def flight_tag(name, case, playlist, web):
    """The paper tag (`<name>_tag`, FC_TAG: 40 x 60 mm, the 2:3 of the page's tag canvas, its
    tag_print; a render letters it) hanging in front of the handle's strap from a string looped
    round its middle, turned 20 degrees toward the viewer."""
    y_strap = -FC_D / 2 - 4.0 - 14.0      # the strap's middle
    face = y_strap - 1.5 - 3.0            # the tag's plane, in front of the strap
    top = FC_HANDLE_Z - 6.0 - 1.0         # just under the strap
    tw, th = FC_TAG
    turn = math.radians(-20.0)
    root = empty(name + "_tag_root", L(0.0, face, top - th / 2), (math.radians(90), 0.0, turn), parent=case)
    rbox(name + "_tag", (tw, th, 0.4), M["tag_print"], parent=root)
    hole = th / 2 - 5.0                   # the eyelet, 5 mm under the tag's top edge
    for k, z in enumerate((0.45, -0.45)):
        tube("%s_tag_eyelet_%d" % (name, k), circle(2.2, 20), 0.5, M["hardware"], cyclic=True, parent=root,
             loc=L(0.0, hole, z))
    if not web:
        text(name + "_tag_t1", "NAME", 1.8, M["ink"], font="avenir", align="LEFT", parent=root, loc=L(-15.0, 16.0, 0.22))
        text(name + "_tag_t2", playlist, 3.6, M["ink_dark"], font="futura", align="LEFT", parent=root,
             loc=L(-15.0, 8.5, 0.22))
        for k, yy in enumerate((2.0, -7.0, -16.0, -25.0)):
            rbox("%s_tag_rule_%d" % (name, k), (30.0, 0.25, 0.04), M["ink"], parent=root, loc=L(0.0, yy, 0.22))
    # The string: out of the eyelet's front, up the tag's face and over its top edge, up the strap's
    # front, over it, down its back, and behind the tag back into the eyelet.
    eye = top - th / 2 + hole
    nx, ny = math.sin(turn), -math.cos(turn)       # the tag's face toward the viewer, in the case's frame
    s_front, s_back = y_strap - 1.5 - 0.95, y_strap + 1.5 + 0.95
    path = [(nx * 1.0, face + ny * 1.0, eye), (nx * 0.9, face + ny * 0.9, top - 0.6), (nx * 0.3, face + 0.2, top + 1.0),
            (0.0, s_front, top + 1.8), (0.0, s_front, FC_HANDLE_Z + 5.4), (0.0, y_strap, FC_HANDLE_Z + 7.5),
            (0.0, s_back, FC_HANDLE_Z + 5.4), (0.0, s_back, top + 1.4), (0.0, s_back, top - 0.4),
            (-nx * 0.5, y_strap - 1.0, eye + 2.4), (-nx * 1.0, face - ny * 1.0, eye)]
    tube(name + "_tag_string", smooth_path(path, 4), 0.6, M["rubber"], parent=case)


def make_flight_case(name, root, rack_labels, playlist, web):
    """The flight case under its root, the empty `name` (`deck_flight`: build_deck.py names it
    lid_hinge, the rack's parent, which never moves), right of the deck and turned toward it."""
    case = empty(name, L(FC_AT[0], FC_AT[1], 0.0), (0.0, 0.0, FC_TURN), parent=root)
    flight_base(name, case)
    flight_rack(name, case, rack_labels)
    flight_lid(name, case, playlist, web)
    flight_handle(name, case)
    flight_tag(name, case, playlist, web)
    return case


def deck_jewel_case(name, root, booklet):
    """The jewel case (`<name>_case`, its lid `<name>_case_lid`: parts.py's make_case) lying shut on
    the floor in front of the flight case, its booklet up."""
    return make_case(name + "_case", booklet, L(JEWEL_AT[0], JEWEL_AT[1], 0.0), (0.0, 0.0, JEWEL_TURN), parent=root)

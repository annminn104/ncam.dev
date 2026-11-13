"""Luxe's tonearm: luxe_tonearm, which luxe.py's make_luxe_player calls, and its angles
(LUXE_ARM_LEAD_IN and LUXE_ARM_RUN_OUT, which build_luxe.py prints for the page's profile).

Needs cdkit's, parts.py's, vinyl.py's and luxe.py's namespace (exec'd after luxe.py: it reads
LX_SPINDLE, LX_TOP and LX_RECORD_TOP). Blender's axes as in parts.py, millimetres through L(x, y, z).

The arm stands at the deck's back right. Its fixed parts hang from the base group
(`<name>_arm_base`, on the floor under the pivot): the plinth disc on the top, the bearing tower,
the rest post at the needle's rest point with its cradle, and the cue lever. Its moving parts hang
from the pivot (`<name>_arm`, unturned at rest, which the page turns about its Z, three's Y once
exported, the same turn): the arm body (`<name>_arm_body`, turned to LUXE_ARM_REST_DIR, its +X
along the effective length, the needle at (LUXE_ARM_LEN, 0) on it) carries the gimbal, the J-shaped
tube, the counterweight on the tube's stub and the head (`<name>_arm_head`: the headshell, its
finger lift, the teal cartridge, the needle's tip `<name>_arm_stylus`, and in the web build the
hit shape `<name>_arm_hit`, which the page draws nowhere and raycasts).

The J (luxe_j): the tube runs straight from the stub through the pivot, LUXE_J_RUN to the left of
the needle's line, then bends clockwise round LUXE_J_RADIUS into the headshell's line, which
LUXE_HEAD_OFFSET turns off the needle's line (the offset that keeps the cartridge along the
groove). The head's origin is the tube's end; the needle lies ahead of it on the headshell's line,
the cartridge over it.
"""
import math

from mathutils import Vector

LUXE_PIVOT = (150.0, 110.0)
LUXE_PIVOT_Z = 118.0
LUXE_ARM_LEN = 232.0                         # pivot to needle
LUXE_ARM_REST_ALPHA = math.radians(60.0)     # the rest's angle off the line from the pivot to the spindle


def _pivot_line():
    """The direction (radians, from +X) and the distance (mm) from the pivot to the spindle."""
    dx, dy = LX_SPINDLE[0] - LUXE_PIVOT[0], LX_SPINDLE[1] - LUXE_PIVOT[1]
    return math.atan2(dy, dx), math.hypot(dx, dy)


LUXE_ARM_REST_DIR = _pivot_line()[0] + LUXE_ARM_REST_ALPHA   # the arm's direction at rest


def luxe_arm_angle(r_mm):
    """The pivot's turn about Z, from its rest, that puts the needle `r_mm` from the spindle: the
    law of cosines in the triangle pivot, spindle, needle, the needle on the rest's side of the
    pivot-to-spindle line. Negative: the arm swings clockwise seen from above onto the record."""
    _, d = _pivot_line()
    alpha = math.acos((d * d + LUXE_ARM_LEN ** 2 - r_mm ** 2) / (2.0 * d * LUXE_ARM_LEN))
    return alpha - LUXE_ARM_REST_ALPHA


LUXE_ARM_LEAD_IN = luxe_arm_angle(146.0)   # about -0.390 rad: the needle over the outer groove
LUXE_ARM_RUN_OUT = luxe_arm_angle(60.0)    # about -0.786 rad: the needle by the label

LUXE_HEAD_OFFSET = math.radians(-22.0)     # the headshell's turn off the needle's line
LUXE_J_RUN = math.radians(4.0)             # the tube's straight run, left of the needle's line
LUXE_J_RADIUS = 50.0                       # the J's bend
LUXE_HEAD_Z = -5.0                         # the head's origin, under the pivot
LUXE_TUBE_R = 3.6
LUXE_STUB = 55.0                           # the stub behind the pivot; the counterweight on it
LUXE_SHELL = (34.0, 18.0, 2.4)             # the headshell: length (along the head's x), width, thickness
LUXE_CART = (20.0, 12.0, 8.0)              # the cartridge: length, width, height
LUXE_CART_LIFT = 0.3                       # its underside over the needle's tip
LUXE_HIT = (52.0, 40.0, 26.0)              # the hit shape round the headshell: length, width, height


def luxe_j():
    """The J in the arm body's frame: the straight run's length to the bend (b) and the needle's
    distance ahead of the tube's end along the headshell's line (d). The run leaves the pivot at
    LUXE_J_RUN; the bend, clockwise round LUXE_J_RADIUS from the run's end B = b (cos t, sin t),
    ends at B + R (sin t - sin phi, cos phi - cos t), heading LUXE_HEAD_OFFSET (phi); that end lies
    on the headshell's line d behind the needle, (LUXE_ARM_LEN, 0) - d (cos phi, sin phi). Both
    are linear in b and d."""
    t, phi, r = LUXE_J_RUN, LUXE_HEAD_OFFSET, LUXE_J_RADIUS
    ux, uy = math.cos(phi), math.sin(phi)
    ex, ey = r * (math.sin(t) - math.sin(phi)), r * (math.cos(phi) - math.cos(t))
    # b cos t + d ux = L - ex, b sin t + d uy = -ey
    det = math.cos(t) * uy - ux * math.sin(t)
    b = ((LUXE_ARM_LEN - ex) * uy + ux * ey) / det
    d = (-math.cos(t) * ey - math.sin(t) * (LUXE_ARM_LEN - ex)) / det
    return b, d


def luxe_j_path(steps=6):
    """The tube's centreline in the arm body's frame (mm): the stub's end behind the pivot, the
    pivot, the run, then the bend down to the head's origin (falling to LUXE_HEAD_Z along it)."""
    t, phi, r = LUXE_J_RUN, LUXE_HEAD_OFFSET, LUXE_J_RADIUS
    b, _ = luxe_j()
    c, s = math.cos(t), math.sin(t)
    bx, by = b * c, b * s
    ox, oy = bx + r * s, by - r * c            # the bend's centre, right of the run
    pts = [(-LUXE_STUB * c, -LUXE_STUB * s, 0.0), (0.0, 0.0, 0.0), (bx / 2, by / 2, 0.0), (bx, by, 0.0)]
    for k in range(1, steps + 1):
        u = k / steps
        h = t + (phi - t) * u
        pts.append((ox - r * math.sin(h), oy + r * math.cos(h), LUXE_HEAD_Z * (3 * u * u - 2 * u * u * u)))
    return pts


# ------------------------------------------------------------------ the fixed parts
def luxe_arm_rest(name, base):
    """The rest post at the needle's rest point (LUXE_ARM_LEN along LUXE_ARM_REST_DIR from the
    pivot), and on it the cradle across the headshell's line at rest: a bar and two pins rising
    either side of the cartridge, which the arm lowers between them."""
    rx, ry = LUXE_ARM_LEN * math.cos(LUXE_ARM_REST_DIR), LUXE_ARM_LEN * math.sin(LUXE_ARM_REST_DIR)
    top = 101.0
    lathe(name + "_arm_rest_post", [(0.01, LX_TOP), (3.0, LX_TOP), (3.0, top), (0.01, top)], M["luxe_metal"], seg=32,
          parent=base, loc=L(rx, ry, 0.0))
    across = LUXE_ARM_REST_DIR + LUXE_HEAD_OFFSET + math.pi / 2    # across the headshell's line at rest
    half = LUXE_CART[1] / 2 + 0.5 + 1.5                            # the pins 0.5 mm clear of the cartridge
    rbox(name + "_arm_rest_bar", (3.0, 2 * half + 3.0, 1.0), M["luxe_metal"], parent=base,
         loc=L(rx, ry, top + 0.3), rot=(0.0, 0.0, across - math.pi / 2))
    for k, sgn in enumerate((-1, 1)):
        lathe("%s_arm_rest_pin_%d" % (name, k), [(0.01, 0.0), (1.5, 0.0), (1.5, 3.8), (1.2, 4.2), (0.01, 4.2)],
              M["luxe_metal"], seg=24, parent=base,
              loc=L(rx + sgn * half * math.cos(across), ry + sgn * half * math.sin(across), top - 0.2))


def luxe_cue(name, base):
    """The cue lever: a post right of the arm and the lever on it, its top at z 98, turned 20
    degrees (the post 1 mm into it)."""
    x, y = 178.0 - LUXE_PIVOT[0], 70.0 - LUXE_PIVOT[1]
    lathe(name + "_arm_cue_post", [(0.01, LX_TOP), (3.0, LX_TOP), (3.0, 96.0), (0.01, 96.0)], M["luxe_metal"],
          seg=32, parent=base, loc=L(x, y, 0.0))
    rbox(name + "_arm_cue", (4.0, 30.0, 3.0), M["luxe_metal"], bevel_mm=0.0 if WEB else 0.6, parent=base,
         loc=L(x, y, 96.5), rot=(0.0, 0.0, math.radians(20.0)))


# ------------------------------------------------------------------ the head
def luxe_head(name, arm):
    """The head (`<name>_arm_head`) at the tube's end, turned LUXE_HEAD_OFFSET, its +X along the
    headshell toward the needle: the needle's tip (`<name>_arm_stylus`, the body-frame point
    (LUXE_ARM_LEN, 0, LX_RECORD_TOP - LUXE_PIVOT_Z) in the head's frame), the cartridge standing
    LUXE_CART_LIFT over it, its front 3 mm ahead of it, the headshell on the cartridge, its front
    1 mm past the cartridge's and its back over the tube's end, the finger lift curving up off its
    outer side (away from the spindle), and in the web build the hit shape round it all."""
    end = luxe_j_path()[-1]
    head = empty(name + "_arm_head", L(end[0], end[1], LUXE_HEAD_Z), (0.0, 0.0, LUXE_HEAD_OFFSET), parent=arm)
    # The head's basis is its local matrix (its parent inverse is the identity), and it is current
    # before any depsgraph update, as matrix_local is not.
    tip = head.matrix_basis.inverted() @ Vector(L(LUXE_ARM_LEN, 0.0, LX_RECORD_TOP - LUXE_PIVOT_Z))
    sx, sy, sz = (c / MM for c in tip)
    empty(name + "_arm_stylus", tuple(tip), parent=head)
    cl, cw, ch = LUXE_CART
    c_bottom = sz + LUXE_CART_LIFT
    rbox(name + "_arm_cartridge", (cl, cw, ch), M["cartridge"], bevel_mm=0.8, parent=head,
         loc=L(sx + 3.0 - cl / 2, sy, c_bottom + ch / 2))
    sl, sw, st = LUXE_SHELL
    s_mid = (sx + 4.0 - sl / 2, sy, c_bottom + ch + st / 2)
    rbox(name + "_arm_headshell", (sl, sw, st), M["luxe_metal"], bevel_mm=0.6, parent=head, loc=L(*s_mid))
    zt = s_mid[2]
    lift = [(sx - 4.0, sy + sw / 2 - 1.0, zt), (sx - 2.0, sy + sw / 2 + 3.0, zt + 0.6),
            (sx, sy + sw / 2 + 7.0, zt + 2.4), (sx + 1.0, sy + sw / 2 + 10.0, zt + 5.5)]
    tube(name + "_arm_lift", smooth_path(lift, 6), 1.0, M["luxe_metal"], parent=head)
    if WEB:
        hl, hw, hh = LUXE_HIT
        rbox(name + "_arm_hit", (hl, hw, hh), M["arm_hit"], parent=head, loc=L(s_mid[0], sy + 2.0, zt))
    return head


# ------------------------------------------------------------------ the whole arm
def luxe_tonearm(name, root, playing):
    """The tonearm under `root`: the base group with the fixed parts, and the pivot with the moving
    ones, unturned at rest; a render (`playing`) turns it 30 % of the way in from the lead-in to the
    run-out, the needle on the record."""
    px, py = LUXE_PIVOT
    base = empty(name + "_arm_base", L(px, py, 0.0), parent=root)
    lathe(name + "_arm_plinth", [(0.01, LX_TOP), (28.0, LX_TOP), (28.0, 95.2), (27.2, 96.0), (0.01, 96.0)],
          M["luxe_metal"], seg=128, parent=base)
    lathe(name + "_arm_tower", [(0.01, 96.0), (11.0, 96.0), (11.0, 111.4), (10.4, 112.0), (0.01, 112.0)],
          M["luxe_metal"], seg=64, parent=base)
    luxe_arm_rest(name, base)
    luxe_cue(name, base)
    turn = LUXE_ARM_LEAD_IN + 0.3 * (LUXE_ARM_RUN_OUT - LUXE_ARM_LEAD_IN) if playing else 0.0
    pivot = empty(name + "_arm", L(px, py, LUXE_PIVOT_Z), (0.0, 0.0, turn), parent=root)
    arm = empty(name + "_arm_body", (0.0, 0.0, 0.0), (0.0, 0.0, LUXE_ARM_REST_DIR), parent=pivot)
    lathe(name + "_arm_gimbal", [(0.01, -5.0), (12.4, -5.0), (13.0, -4.4), (13.0, 4.4), (12.4, 5.0), (0.01, 5.0)],
          M["luxe_metal"], seg=64, parent=arm)
    tube(name + "_arm_tube", smooth_path(luxe_j_path(), 8), LUXE_TUBE_R, M["luxe_metal"], res=4, parent=arm)
    # Along the stub (the run's line), from 50 to 20 mm behind the pivot.
    lathe(name + "_arm_counterweight", [(0.01, -50.0), (15.4, -50.0), (16.0, -49.4), (16.0, -20.6), (15.4, -20.0),
                                        (0.01, -20.0)], M["luxe_metal"], seg=64, parent=arm,
          rot=(0.0, math.pi / 2, LUXE_J_RUN))
    luxe_head(name, arm)
    return pivot

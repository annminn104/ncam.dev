"""parts: CD, crystal jewel case, polaroid and the suitcase CD player (all mm, real scale).

Needs cdkit's namespace (exec'd first).
"""
import math
import bmesh
from mathutils import Vector


def L(x, y, z):
    return (x * MM, y * MM, z * MM)


def sphere(name, r_mm, mats, seg=24, **kw):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(seg // 2, 6), radius=r_mm * MM)
    return from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)


def smooth_path(pts, n=8):
    P = [Vector(p) for p in pts]
    out = []
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i > 0 else P[i]
        p1, p2 = P[i], P[i + 1]
        p3 = P[i + 2] if i + 2 < len(P) else P[i + 1]
        for k in range(n):
            t = k / n
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                       + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
            out.append(tuple(v))
    out.append(tuple(P[-1]))
    return out


def l_path(ox, oy, sx, sy, length, r, z, seg=8):
    """L-shaped rail with a rounded corner at (ox, oy); arms run back along -sx and -sy."""
    pts = [(ox - sx * length, oy, z), (ox - sx * r, oy, z)]
    cx, cy = ox - sx * r, oy - sy * r
    a0 = math.atan2(sy, 0.0)
    a1 = math.atan2(0.0, sx)
    d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    for i in range(1, seg):
        a = a0 + d * i / seg
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    pts += [(ox, oy - sy * r, z), (ox, oy - sy * length, z)]
    return pts


def build_materials(leather_rgb=(226, 150, 164), deck_rgb=(248, 246, 243)):
    M.clear()
    M["leather"] = add_bump(mat("leather", lin(*leather_rgb), rough=0.5, sheen=0.3, sheen_rough=0.35,
                                coat=0.12, coat_rough=0.35), "voronoi", scale=650, strength=0.35, distance=0.00035)
    M["grille"] = mat("grille", lin(*deck_rgb), rough=0.32, coat=0.2, coat_rough=0.15)
    M["lining"] = add_bump(mat("lining", lin(248, 245, 241), rough=0.85, sheen=0.5), "noise",
                           scale=2600, strength=0.18, distance=0.00015)
    M["deck"] = add_bump(mat("deck", lin(*deck_rgb), rough=0.34, coat=0.18, coat_rough=0.18), "noise",
                         scale=5000, strength=0.04, distance=0.0001)
    M["well"] = mat("well", lin(232, 230, 228), rough=0.5, coat=0.1)
    M["thread"] = mat("thread", lin(252, 250, 246), rough=0.9, sheen=0.6)
    M["gold"] = mat("gold", lin(236, 196, 118), metal=1.0, rough=0.16)
    M["chrome"] = mat("chrome", (0.96, 0.96, 0.97, 1), metal=1.0, rough=0.04)
    M["alu"] = radial_aniso(mat("alu", lin(226, 228, 232), metal=1.0, rough=0.2, aniso=0.8))
    M["alu_side"] = mat("alu_side", lin(210, 212, 218), metal=1.0, rough=0.28)
    M["hub_black"] = mat("hub_black", (0.012, 0.012, 0.014, 1), rough=0.18, coat=0.6)
    M["black_glass"] = mat("black_glass", (0.003, 0.003, 0.004, 1), rough=0.03, coat=1.0, coat_rough=0.01)
    M["lcd"] = mat("lcd", (0, 0, 0, 1), emit=lin(150, 238, 255), emit_s=7.0)
    M["lcd_ghost"] = mat("lcd_ghost", lin(22, 28, 32), rough=0.35)
    M["led"] = mat("led", lin(255, 60, 40), emit=lin(255, 50, 30), emit_s=18.0)
    M["rubber"] = mat("rubber", (0.015, 0.015, 0.015, 1), rough=0.9)
    M["fabric"] = add_bump(mat("fabric", lin(30, 27, 29), rough=1.0, sheen=0.7), "noise",
                           scale=7000, strength=0.5, distance=0.00015)
    M["btn"] = mat("btn", lin(252, 251, 249), rough=0.2, coat=0.6, coat_rough=0.04)
    M["arm"] = mat("arm", lin(252, 251, 249), rough=0.22, coat=0.5, coat_rough=0.05)
    M["ink"] = mat("ink", lin(96, 92, 98), rough=0.5)
    M["ink_dark"] = mat("ink_dark", lin(38, 36, 40), rough=0.45)
    M["crystal"] = mat("crystal", (0.985, 0.99, 1.0, 1), rough=0.0, trans=1.0, ior=1.53)
    M["pc"] = mat("polycarbonate", (0.985, 0.99, 1.0, 1), rough=0.0, trans=1.0, ior=1.58)
    M["disc_metal"] = radial_aniso(mat("disc_metal", (0.94, 0.94, 0.96, 1), metal=1.0, rough=0.09,
                                       aniso=0.9, film=520, film_ior=1.45))
    M["foil"] = radial_aniso(mat("foil", (0.96, 0.96, 0.98, 1), metal=1.0, rough=0.07, aniso=0.7,
                                 film=380, film_ior=1.6))
    M["paper"] = add_bump(mat("paper", lin(250, 249, 245), rough=0.75, sheen=0.2), "noise",
                          scale=3000, strength=0.1, distance=0.0001)
    M["floor"] = mat("floor", lin(238, 236, 233), rough=0.55)
    M["pin_blue"] = mat("pin_blue", lin(165, 205, 248), rough=0.12, coat=0.8)
    M["pin_pink"] = mat("pin_pink", lin(252, 168, 190), rough=0.12, coat=0.8)
    return M


# ------------------------------------------------------------------ the CD
def make_disc(name, label, loc, rot=(0, 0, 0), parent=None, foil=True):
    root = empty(name, loc, rot, parent)
    lathe(name + "_pc", [(7.5, -0.6), (59.55, -0.6), (60.0, -0.3), (60.0, 0.3), (59.55, 0.6), (7.5, 0.6)],
          M["pc"], seg=192, parent=root)
    lathe(name + "_stack", [(16.4, 0.58), (17.6, 0.58), (17.35, 0.8), (16.65, 0.8)], M["pc"], seg=128,
          parent=root)
    annulus(name + "_metal", 58.7, 17.6, M["disc_metal"], z_mm=0.32, parent=root)
    annulus(name + "_label", 58.5, 22.4, label, z_mm=0.62, parent=root)
    if foil:
        annulus(name + "_foil", 58.5, 56.9, M["foil"], z_mm=0.625, parent=root)
        annulus(name + "_foil_in", 23.6, 22.4, M["foil"], z_mm=0.625, parent=root)
    return root


# ------------------------------------------------------------------ crystal jewel case (142 x 125 x 10.4)
def make_case(name, booklet, loc, rot=(0, 0, 0), parent=None, open_deg=0.0, disc_label=None):
    root = empty(name, loc, rot, parent)
    C = M["crystal"]
    tx = 3.0  # tray sits off the hinge side
    slab(name + "_base", [rrect(142, 125, 3.2)], 0.0, 1.0, C, bevel_mm=0.35, parent=root)
    slab(name + "_floor", [rrect(135, 124, 2.4, cx=tx)], 1.0, 2.1, C, bevel_mm=0.4, parent=root)
    slab(name + "_rim", [rrect(135, 124, 2.4, cx=tx), rrect(131.8, 120.8, 1.6, cx=tx)], 2.1, 6.6, C,
         bevel_mm=0.45, parent=root)
    hx, hy = 131.8 / 2, 120.8 / 2
    for sx in (1, -1):
        for sy in (1, -1):
            for inset, arm in ((3.4, 24.0), (6.0, 19.0)):
                tube(f"{name}_rail_{sx}{sy}_{inset}", l_path(tx + sx * (hx - inset), sy * (hy - inset), sx, sy,
                                                            arm, 5.0, 2.75), 0.55, C, parent=root)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        arc = [(tx + 60.7 * math.cos(a + math.radians(d)), 60.7 * math.sin(a + math.radians(d)), 2.75)
               for d in range(-22, 23, 2)]
        tube(f"{name}_ring_{k}", arc, 0.5, C, parent=root)
        clip = rbox(f"{name}_clip_{k}", (3.4, 1.5, 3.2), C, bevel_mm=0.45,
                    parent=root)
        clip.location = L(tx + 60.3 * math.cos(a), 60.3 * math.sin(a), 3.7)
        clip.rotation_euler = (0, 0, a + math.pi / 2)
    hub = empty(name + "_hub", L(tx, 0, 0), parent=root)
    lathe(name + "_hub_ring", [(10.6, 2.1), (15.6, 2.1), (15.6, 2.7), (15.0, 3.25), (11.2, 3.25), (10.6, 2.7)],
          C, seg=128, parent=hub)
    lathe(name + "_hub_post", [(5.2, 2.1), (7.35, 2.1), (7.35, 5.3), (6.9, 5.9), (5.2, 5.9)], C, seg=96,
          parent=hub)
    for k in range(12):
        a = 2 * math.pi * k / 12
        t = rbox(f"{name}_tooth_{k}", (1.6, 0.9, 0.9), C, bevel_mm=0.25, parent=hub)
        t.location = L(6.3 * math.cos(a), 6.3 * math.sin(a), 6.1)
        t.rotation_euler = (0, 0, a)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        tube(f"{name}_hole_{k}", circle(1.7, 20, 12.9 * math.cos(a), 12.9 * math.sin(a)), 0.32, C,
             cyclic=True, parent=hub, loc=L(0, 0, 3.3))
    tube(name + "_tab", rrect(9.0, 40.0, 3.0, cx=-62.0), 0.6, C, cyclic=True, parent=root, loc=L(0, 0, 4.2))
    for y in (-46.0, 46.0):
        kn = lathe(f"{name}_knuckle_{y}", [(0.01, -8), (1.7, -8), (1.7, 8), (0.01, 8)], C, seg=32, parent=root)
        kn.location = L(-69.6, y, 6.2)
        kn.rotation_euler = (math.pi / 2, 0, 0)
    if disc_label is not None:
        make_disc(name + "_disc", disc_label, L(tx, 0, 6.0), parent=root)
    lid = empty(name + "_lid", L(-71, 0, 6.6), (0, -math.radians(open_deg), 0), parent=root)
    slab(name + "_lid_plate", [rrect(142, 125, 3.2, cx=71)], 2.5, 3.8, C, bevel_mm=0.4, parent=lid)
    slab(name + "_lid_wall", [rrect(142, 125, 3.2, cx=71), rrect(139.4, 122.4, 2.0, cx=71)], 0.0, 3.8, C,
         bevel_mm=0.4, parent=lid)
    for sx in (-34.0, 34.0):
        for sy in (1, -1):
            arc = [(71 + sx + 4.6 * math.cos(math.radians(a)), sy * (59.6 - 4.6 * math.sin(math.radians(a))), 2.2)
                   for a in range(0, 181, 15)]
            tube(f"{name}_tab_{sx}_{sy}", arc, 0.45, C, parent=lid)
    rbox(name + "_booklet", (120, 120, 0.5), booklet, parent=lid, loc=L(71, 0, 2.1))
    return root


def make_polaroid(name, photo, loc, rot, parent=None, pin="pin_pink"):
    root = empty(name, loc, rot, parent)
    rbox(name + "_paper", (56, 68, 0.4), M["paper"], bevel_mm=0.12, parent=root)
    rbox(name + "_photo", (48, 48, 0.06), photo, parent=root, loc=L(0, 6, 0.22))
    lathe(name + "_pin", [(0.01, 0.0), (4.2, 0.0), (4.6, 1.1), (4.4, 2.5), (3.3, 3.8), (0.01, 4.2)],
          M[pin], seg=48, parent=root, loc=L(0, 28, 0.25))
    return root


# ------------------------------------------------------------------ the suitcase player
W, D, HB, HL = 300.0, 236.0, 84.0, 40.0
WALL, RAD = 12.0, 24.0
WX, WY = -48.0, 2.0         # disc well centre
AX, AY = 44.0, 76.0         # tonearm pivot
DECK = 78.0                 # deck top
FLOOR = 72.0                # well floor
DISC_Z = 74.5               # disc centre height


def button_icon(kind):
    if kind == "prev":
        return [rrect(0.8, 3.8, 0, cx=-2.8), [(-2.1, 0), (0.4, 1.9), (0.4, -1.9)], [(0.8, 0), (3.3, 1.9), (3.3, -1.9)]]
    if kind == "next":
        return [rrect(0.8, 3.8, 0, cx=2.8), [(2.1, 0), (-0.4, 1.9), (-0.4, -1.9)], [(-0.8, 0), (-3.3, 1.9), (-3.3, -1.9)]]
    if kind == "play":
        return [[(-3.0, -2.0), (-3.0, 2.0), (0.3, 0)], rrect(0.8, 4.0, 0, cx=1.5), rrect(0.8, 4.0, 0, cx=3.0)]
    if kind == "stop":
        return [rrect(3.4, 3.4, 0.3)]
    return []


def make_player(name, disc_label, booklet, photos, lid_open=100.0, arm_angle=-30.0, playlist="Top 50 · Global",
                track=("01", "1:24"), web=False):
    root = empty(name)
    Lr = M["leather"]
    # --- base tub
    slab(name + "_frame", [rrect(W, D, RAD), rrect(W - 2 * WALL, D - 2 * WALL, RAD - 10)], 0, HB, Lr,
         bevel_mm=5.0, res=4, parent=root)
    slab(name + "_bottom", [rrect(W, D, RAD)], 0, 10, Lr, bevel_mm=5.0, res=4, parent=root)
    stitches(name + "_st_top", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14), HB - 6.5, M["thread"], parent=root)
    stitches(name + "_st_bot", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14), 7.0, M["thread"], parent=root)
    # --- deck with the disc well
    slab(name + "_deck", [rrect(W - 2 * WALL + 2, D - 2 * WALL + 2, RAD - 9), circle(64.0, 160, WX, WY)],
         DECK - 4, DECK, M["deck"], bevel_mm=0.8, parent=root)
    well = empty(name + "_well", L(WX, WY, 0), parent=root)
    cup = lathe(name + "_well_cup", [(64.0, DECK - 0.3), (64.0, FLOOR + 0.7), (63.3, FLOOR), (9.0, FLOOR)],
                M["well"], seg=160, closed=False, parent=well)
    cup.data.flip_normals()  # lathe's recalc points an open surface outward; the visitor looks into it
    annulus(name + "_well_gap", 63.4, 61.8, M["ink"], z_mm=FLOOR + 0.02, parent=well)
    lathe(name + "_spindle", [(0.01, 72.0), (13.0, 72.0), (13.0, 73.2), (12.4, 73.9), (7.3, 73.9), (7.3, 76.6),
                              (6.8, 77.2), (0.01, 77.3)], M["hub_black"], seg=96, parent=well)
    lathe(name + "_spindle_cap", [(0.01, 77.25), (3.6, 77.25), (3.2, 78.0), (0.01, 78.2)], M["chrome"], seg=48,
          parent=well)
    for k in range(3):
        a = 2 * math.pi * k / 3
        sphere(f"{name}_ball_{k}", 0.95, M["chrome"], parent=well, loc=L(7.2 * math.cos(a), 7.2 * math.sin(a), 75.8))
    make_disc(name + "_disc", disc_label, L(WX, WY, DISC_Z), (0, 0, math.radians(-25)), parent=root)
    # --- tonearm
    lathe(name + "_arm_base", [(0.01, DECK), (15.0, DECK), (15.0, DECK + 2.4), (14.2, DECK + 3.2), (9.0, DECK + 3.2),
                               (0.01, DECK + 3.2)], M["arm"], seg=96, parent=root, loc=L(AX, AY, 0))
    lathe(name + "_arm_collar", [(0.01, DECK + 3.2), (7.6, DECK + 3.2), (7.6, DECK + 11.6), (7.0, DECK + 12.3),
                                 (0.01, DECK + 12.5)], M["gold"], seg=64, parent=root, loc=L(AX, AY, 0))
    tube(name + "_arm_ring", circle(14.6, 64), 0.7, M["gold"], cyclic=True, parent=root, loc=L(AX, AY, DECK + 3.2))
    arm = empty(name + "_arm", L(AX, AY, DECK + 10.0), (0, 0, math.radians(arm_angle)), parent=root)
    path = smooth_path([(0, 0, 0), (0, -26, -0.6), (-3, -50, -2.6), (-7, -72, -5.6), (-8.5, -88, -8.2)], 10)
    tube(name + "_arm_tube", path, 3.0, M["arm"], res=5, parent=arm)
    cw = lathe(name + "_arm_cw", [(0.01, -8), (7.0, -8), (7.6, -7.3), (7.6, 7.3), (7.0, 8), (0.01, 8)], M["gold"],
               seg=64, parent=arm)
    cw.location = L(0, 17, 0)
    cw.rotation_euler = (math.pi / 2, 0, 0)
    slab(name + "_arm_head", [[(-5.0, 4.0), (5.0, 4.0), (7.2, -13.0), (6.0, -15.5), (-6.0, -15.5), (-7.2, -13.0)]],
         -2.4, 2.4, M["arm"], bevel_mm=1.1, res=4, parent=arm, loc=L(-8.6, -92, -9.6))
    rbox(name + "_arm_cart", (9.0, 9.0, 2.2), M["gold"], bevel_mm=0.5, parent=arm, loc=L(-8.6, -100, -12.4))
    tube(name + "_arm_lift", smooth_path([(-14, -101, -8.6), (-19, -103, -7.4), (-22, -104, -4.6)], 6), 0.9,
         M["gold"], parent=arm)
    lathe(name + "_arm_rest", [(0.01, DECK), (4.2, DECK), (4.2, DECK + 6.6), (3.5, DECK + 7.3), (0.01, DECK + 7.4)],
          M["arm"], seg=48, parent=root, loc=L(AX - 7.0, AY - 92.0, 0))
    # --- display
    cx, cy = 100.0, 64.0
    slab(name + "_lcd_bezel", [rrect(62, 31, 4.4, cx=cx, cy=cy), rrect(56, 25, 3.0, cx=cx, cy=cy)], DECK - 0.4,
         DECK + 1.2, M["gold"], bevel_mm=0.5, parent=root)
    slab(name + "_lcd_glass", [rrect(57, 26, 3.2, cx=cx, cy=cy)], DECK - 0.6, DECK + 0.6, M["black_glass"],
         bevel_mm=0.3, parent=root)
    z = DECK + 0.62
    if web:
        # The page paints the display (src/scene/textures): one plane, its own material.
        rbox(name + "_lcd_screen", (54, 24, 0.05), M["lcd_screen"], parent=root, loc=L(cx, cy, z))
    else:
        text(name + "_lcd_g1", "88", 13.0, M["lcd_ghost"], font="din", parent=root, loc=L(cx - 14.5, cy - 1.8, z - 0.01))
        text(name + "_lcd_t1", track[0], 13.0, M["lcd"], font="din", parent=root, loc=L(cx - 14.5, cy - 1.8, z))
        text(name + "_lcd_g2", "8:88", 9.0, M["lcd_ghost"], font="din", parent=root, loc=L(cx + 11.5, cy - 3.0, z - 0.01))
        text(name + "_lcd_t2", track[1], 9.0, M["lcd"], font="din", parent=root, loc=L(cx + 11.5, cy - 3.0, z))
        text(name + "_lcd_cd", "CD   PLAY   RPT", 2.6, M["lcd"], font="avenir", align="LEFT", parent=root,
             loc=L(cx - 24.0, cy + 8.6, z))
    sphere(name + "_led", 1.4, M["led"], parent=root, loc=L(cx + 26.0, cy + 21.0, DECK + 0.3))
    text(name + "_led_t", "POWER", 2.4, M["ink"], align="RIGHT", parent=root, loc=L(cx + 23.0, cy + 21.0, DECK + 0.02))
    # --- buttons
    grid = [("prev", 86, 32, "PREV"), ("next", 114, 32, "NEXT"), ("play", 86, 10, "PLAY/PAUSE"),
            ("stop", 114, 10, "STOP"), ("rpt", 86, -12, "REPEAT"), ("mode", 114, -12, "MODE")]
    for kind, bx, by, label in grid:
        b = empty(f"{name}_btn_{kind}", L(bx, by, DECK), parent=root)
        annulus(f"{name}_btn_gap_{kind}", 7.4, 6.5, M["ink_dark"], z_mm=0.03, parent=b)
        lathe(f"{name}_btn_cap_{kind}", [(0.01, 0.0), (6.6, 0.0), (6.6, 1.8), (6.3, 2.9), (5.3, 3.45), (4.2, 3.62),
                                         (0.01, 3.66)], M["btn"], seg=64, parent=b)
        shapes = button_icon(kind)
        if shapes:
            ic = slab(f"{name}_btn_icon_{kind}", shapes, 3.6, 3.78, M["ink_dark"], parent=b)
            ic.scale = (1.3, 1.3, 1.0)
        else:
            text(f"{name}_btn_txt_{kind}", "RPT" if kind == "rpt" else "M", 3.0, M["ink_dark"], font="avenir",
                 parent=b, loc=L(0, 0, 3.68))
        text(f"{name}_btn_lbl_{kind}", label, 2.5, M["ink"], font="avenir", parent=b, loc=L(0, -10.4, 0.02))
    # --- volume knob
    kx, ky = 100.0, -58.0
    knob = empty(name + "_knob", L(kx, ky, DECK), parent=root)
    lathe(name + "_knob_skirt", [(0.01, 0.0), (18.4, 0.0), (18.4, 1.0), (17.8, 1.6), (0.01, 1.6)], M["alu_side"],
          seg=128, parent=knob)
    lathe(name + "_knob_body", [(0.01, 1.6), (16.2, 1.6), (16.2, 16.6), (15.6, 17.8), (14.4, 18.4), (0.01, 18.5)],
          M["alu_side"], seg=200, ridge=({1, 2}, 0.42), parent=knob)
    annulus(name + "_knob_top", 14.3, 0.4, M["alu"], z_mm=18.52, seg=128, parent=knob)
    sphere(name + "_knob_dot", 1.0, M["ink_dark"], parent=knob,
           loc=L(10.5 * math.cos(math.radians(70)), 10.5 * math.sin(math.radians(70)), 18.3))
    for k in range(13):
        a = math.radians(225 - 270 * k / 12)
        t = rbox(f"{name}_tick_{k}", (3.2 if k % 3 == 0 else 2.0, 0.55, 0.06), M["ink"], parent=knob)
        rr = 23.2 if k % 3 == 0 else 22.6
        t.location = L(rr * math.cos(a), rr * math.sin(a), 0.03)
        t.rotation_euler = (0, 0, a)
    text(name + "_vol", "VOLUME", 2.8, M["ink"], font="avenir", parent=knob, loc=L(0, -27.5, 0.02))
    # --- branding on the deck
    text(name + "_brand", "ncam", 9.0, M["ink_dark"], font="futura", align="LEFT", parent=root,
         loc=L(-128.0, -88.0, DECK + 0.02))
    text(name + "_model", "CD·01   COMPACT DISC PLAYER", 2.8, M["ink"], font="avenir", align="LEFT", parent=root,
         loc=L(-128.0, -96.5, DECK + 0.02))
    # --- front: speaker grille, latch
    holes = [rrect(212, 2.5, 1.25, cy=-16.5 + 5.5 * i) for i in range(7)]
    slab(name + "_grille", [rrect(238, 48, 11)] + holes, 0.0, 2.2, M["grille"], bevel_mm=0.45, parent=root,
         loc=L(0, -D / 2, 38), rot=(math.pi / 2, 0, 0))
    rbox(name + "_fabric", (224, 0.6, 42), M["fabric"], parent=root, loc=L(0, -D / 2 + 0.2, 38))
    rbox(name + "_latch", (26, 2.2, 15), M["gold"], bevel_mm=0.8, parent=root, loc=L(0, -D / 2 - 1.0, 73.5))
    tube(name + "_latch_loop", smooth_path([(-6, -D / 2 - 2, 78), (-6, -D / 2 - 5.5, 78.5), (0, -D / 2 - 6.5, 79),
                                            (6, -D / 2 - 5.5, 78.5), (6, -D / 2 - 2, 78)], 6), 1.1, M["gold"],
         parent=root)
    for sx in (-9.5, 9.5):
        for sz in (69.0, 78.0):
            lathe(f"{name}_latch_screw_{sx}_{sz}", [(0.01, 0), (1.3, 0), (1.2, 0.6), (0.01, 0.8)], M["gold"], seg=24,
                  parent=root, loc=L(sx, -D / 2 - 2.1, sz), rot=(math.pi / 2, 0, 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe(f"{name}_foot_{sx}{sy}", [(0.01, 0), (9, 0), (9, 2.4), (8, 3.4), (0.01, 3.4)], M["gold"], seg=48,
                  parent=root, loc=L(sx * (W / 2 - 30), sy * (D / 2 - 30), -3.0))
    # --- hinges
    for hx in (-82.0, 82.0):
        kn = lathe(f"{name}_hinge_{hx}", [(0.01, -15), (3.3, -15), (3.3, 15), (0.01, 15)], M["gold"], seg=40, parent=root)
        kn.location = L(hx, D / 2 + 1.2, HB)
        kn.rotation_euler = (0, math.pi / 2, 0)
        rbox(f"{name}_hinge_leaf_{hx}", (30, 1.6, 13), M["gold"], bevel_mm=0.5, parent=root,
             loc=L(hx, D / 2 + 0.6, HB - 7.5))
    # --- lid (hinged at the back top edge)
    lid = empty(name + "_lid", L(0, D / 2, HB), (-math.radians(lid_open), 0, 0), parent=root)
    cyl = -D / 2
    slab(name + "_lid_frame", [rrect(W, D, RAD, cy=cyl), rrect(W - 2 * WALL, D - 2 * WALL, RAD - 10, cy=cyl)], 0, HL,
         Lr, bevel_mm=5.0, res=4, parent=lid)
    slab(name + "_lid_top", [rrect(W, D, RAD, cy=cyl)], HL - 10, HL, Lr, bevel_mm=5.0, res=4, parent=lid)
    stitches(name + "_lid_st_a", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14, cy=cyl), 6.5, M["thread"], parent=lid)
    stitches(name + "_lid_st_b", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14, cy=cyl), HL - 7.0, M["thread"],
             parent=lid)
    slab(name + "_lining", [rrect(W - 2 * WALL + 2, D - 2 * WALL + 2, RAD - 9, cy=cyl)], HL - 13.5, HL - 10, M["lining"],
         bevel_mm=0.8, parent=lid)
    zin = HL - 13.5
    make_case(name + "_case", booklet, L(-60.0, cyl, zin), (math.pi, 0, 0), parent=lid)
    for yy in (cyl + 64.5, cyl - 64.5):
        rbox(f"{name}_case_clip_{yy}", (22, 7, 13.5), M["crystal"], bevel_mm=1.2, parent=lid, loc=L(-60.0, yy, zin - 6.0))
    make_polaroid(name + "_pol_a", photos[0], L(68.0, cyl + 40.0, zin - 0.25), (math.pi, 0, math.radians(-5)),
                  parent=lid, pin="pin_pink")
    make_polaroid(name + "_pol_b", photos[1], L(84.0, cyl - 42.0, zin - 0.25), (math.pi, 0, math.radians(6)),
                  parent=lid, pin="pin_blue")
    card = empty(name + "_card", L(0, cyl - 92.0, zin - 0.2), (math.pi, 0, 0), parent=lid)
    rbox(name + "_card_paper", (92, 18, 0.35), M["paper"], bevel_mm=0.1, parent=card)
    if web:
        rbox(name + "_card_print", (90, 16, 0.05), M["card_print"], parent=card, loc=L(0, 0, 0.21))
    else:
        text(name + "_card_t1", "NOW SPINNING", 2.8, M["ink"], font="avenir", parent=card, loc=L(0, 4.2, 0.2))
        text(name + "_card_t2", playlist, 5.0, M["ink_dark"], font="futura", parent=card, loc=L(0, -2.6, 0.2))
    rbox(name + "_lid_hasp", (22, 2.2, 16), M["gold"], bevel_mm=0.8, parent=lid, loc=L(0, -D - 1.0, 9.0))
    for hx in (-82.0, 82.0):
        rbox(f"{name}_lid_leaf_{hx}", (30, 1.6, 13), M["gold"], bevel_mm=0.5, parent=lid, loc=L(hx, 0.6, 7.5))
    return root

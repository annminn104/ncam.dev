"""parts: the CD, the crystal jewel case and the suitcase CD player (all mm, real scale).

Needs cdkit's namespace (exec'd first). build_materials() makes every material; the seven the
skins recolour (SKIN_ROLES) take their colours from a palette of sRGB hex values, Blush by default,
so a render of another skin passes its palette and nothing else changes.

The player's frame: x across (W), y front to back (the front, with the grille, is -y), z up. The
lid is the child `<name>_lid` at the back top edge, rotated open about x: inside it, y runs from 0
at the hinge to -D at the far edge (up, once the lid is open), z from 0 at the rim to HL at the
outer shell (away from the visitor), and the lining's face is at HL - 13.5. Everything placed on
the lining is rotated (pi, 0, 0), so its local +z faces the visitor and its local +y points up.

RACK_LAYOUT picks how the lid is laid out: "cascade" keeps the crystal case on the left and
cascades the five discs up the right half; "grid" has no case and fills the lid with the discs,
two below and three above.
"""
import json
import math
import os
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


# ------------------------------------------------------------------ materials
# The skins' palettes, sRGB hex per skin role, live in src/skins.json, the file the page reads.
# Blush is the default; a render of another skin passes its palette to build_materials.
SKIN_ROLES = ("leather", "trim", "thread", "lining", "hardware", "deck", "grille")


def _scripts_dir():
    """These scripts' folder: from the exec'ing script's __file__, else its BASE or HERE."""
    g = globals()
    if g.get("__file__"):
        return os.path.dirname(os.path.abspath(g["__file__"]))
    folder = g.get("BASE") or g.get("HERE")
    if not folder:
        raise SystemExit("parts.py: cannot find src/skins.json: the script that runs parts.py "
                         "defines none of __file__, BASE and HERE")
    return folder


def skin_palette(skin_id):
    """A skin's palette (role -> sRGB hex) from src/skins.json. It stops the run, naming the skin
    and the file, unless the file reads and the palette has exactly the SKIN_ROLES: a role it lacked
    would take Blush's colour in build_materials, and one it misspelt would be ignored."""
    path = os.path.normpath(os.path.join(_scripts_dir(), "..", "..", "..", "src", "skins.json"))
    try:
        with open(path, encoding="utf-8") as f:
            skins = [s for s in json.load(f)["skins"] if isinstance(s, dict)]
    except (OSError, ValueError, KeyError, TypeError) as err:
        raise SystemExit("parts.py: cannot read the skins from %s (%s: %s)"
                         % (path, type(err).__name__, err))
    for skin in skins:
        if skin.get("id") == skin_id:
            palette = skin.get("palette")
            if not isinstance(palette, dict):
                palette = {}
            if set(palette) != set(SKIN_ROLES):
                missing = ", ".join(r for r in SKIN_ROLES if r not in palette) or "none"
                unexpected = ", ".join(sorted(set(palette) - set(SKIN_ROLES))) or "none"
                raise SystemExit("parts.py: skin %r in %s must have exactly the roles %s (missing: %s; "
                                 "unexpected: %s)" % (skin_id, path, ", ".join(SKIN_ROLES), missing, unexpected))
            return dict(palette)
    raise SystemExit("parts.py: no skin %r in %s (%s)"
                     % (skin_id, path, ", ".join(str(s.get("id")) for s in skins)))


BLUSH = skin_palette("blush")


def build_materials(palette=None):
    """Every material. `palette` maps skin roles to sRGB hex; a role it leaves out keeps Blush's."""
    pal = dict(BLUSH, **(palette or {}))
    c = {role: lin(*hexrgb(pal[role])) for role in SKIN_ROLES}
    M.clear()
    # --- the seven the skins recolour
    M["leather"] = add_bump(mat("leather", c["leather"], rough=0.5, sheen=0.3, sheen_rough=0.35,
                                coat=0.12, coat_rough=0.35), "voronoi", scale=650, strength=0.35, distance=0.00035)
    M["trim"] = add_bump(mat("trim", c["trim"], rough=0.42, sheen=0.25, sheen_rough=0.35, coat=0.2,
                             coat_rough=0.25), "voronoi", scale=900, strength=0.3, distance=0.0003)
    M["thread"] = mat("thread", c["thread"], rough=0.9, sheen=0.6)
    M["lining"] = mat("lining", c["lining"], rough=0.85, sheen=0.5)
    M["hardware"] = mat("hardware", c["hardware"], metal=1.0, rough=0.16)
    M["deck"] = add_bump(mat("deck", c["deck"], rough=0.34, coat=0.18, coat_rough=0.18), "noise",
                         scale=5000, strength=0.04, distance=0.0001)
    M["grille"] = mat("grille", c["grille"], rough=0.32, coat=0.2, coat_rough=0.15)
    # --- fixed
    M["well"] = mat("well", lin(232, 230, 228), rough=0.5, coat=0.1)
    M["chrome"] = mat("chrome", (0.96, 0.96, 0.97, 1), metal=1.0, rough=0.04)
    M["alu"] = radial_aniso(mat("alu", lin(226, 228, 232), metal=1.0, rough=0.2, aniso=0.8))
    M["alu_side"] = mat("alu_side", lin(210, 212, 218), metal=1.0, rough=0.28)
    M["hub_black"] = mat("hub_black", (0.012, 0.012, 0.014, 1), rough=0.18, coat=0.6)
    M["black_glass"] = mat("black_glass", (0.003, 0.003, 0.004, 1), rough=0.03, coat=1.0, coat_rough=0.01)
    M["lcd"] = mat("lcd", (0, 0, 0, 1), emit=lin(150, 238, 255), emit_s=7.0)
    M["lcd_ghost"] = mat("lcd_ghost", lin(22, 28, 32), rough=0.35)
    M["led"] = mat("led", lin(255, 60, 40), emit=lin(255, 50, 30), emit_s=18.0)
    M["rubber"] = mat("rubber", (0.015, 0.015, 0.015, 1), rough=0.9)
    M["fabric"] = mat("fabric", lin(30, 27, 29), rough=1.0, sheen=0.7)
    M["strap"] = mat("strap", lin(52, 46, 48), rough=0.95, sheen=0.5)
    # The VU strip: one emissive material shared by the ten segments; the page clones it per
    # segment (src/scene/vu-materials.ts). It carries 1.0 in the GLB; the render's lit segments
    # glow at 8. vu_off is the render's unlit top segments only.
    M["vu"] = mat("vu", (0.03, 0.02, 0.02, 1), rough=0.3, emit=lin(255, 150, 70), emit_s=1.0 if WEB else 8.0)
    M["vu_off"] = mat("vu_off", lin(46, 32, 30), rough=0.35)
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
    M["floor"] = mat("floor", lin(238, 236, 233), rough=0.55)
    if not WEB:
        # Cycles only: the web makes these as normal maps at runtime (src/scene/textures/grain.ts).
        add_quilt(M["lining"])
        add_weave(M["fabric"], pitch_mm=1.0)
        add_weave(M["strap"], pitch_mm=1.4)
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


# ------------------------------------------------------------------ the suitcase player
W, D, HB, HL = 300.0, 236.0, 84.0, 40.0
WALL, RAD = 12.0, 24.0
WX, WY = -48.0, 2.0         # disc well centre
AX, AY = 44.0, 76.0         # tonearm pivot
DECK = 78.0                 # deck top
FLOOR = 72.0                # well floor
DISC_Z = 76.5               # disc centre height: on the spindle's shoulder, nearly flush with the deck
RACK_X = 75.0               # the rack's discs, lid-local x (the case takes the left half)
RACK_PITCH = 20.0           # lid-local mm from one slot's bottom edge up to the next
RACK_CHEEK = 61.6           # lid-local mm from RACK_X out to each cheek of the cascade's frame
HANDLE_Z = 74.0             # the carry handle's axis on the tub's front, under the seam
# "cascade" (the case on the left, the discs up the right half) or "grid" (no case, two discs
# below and three above): the owner's choice.
RACK_LAYOUT = "cascade"
# The grid's slots, lid-local (x, centre y): slots 0 and 1 below, in front; 2 above in the middle,
# in front of 3 (left) and 4 (right). Rows 86 mm apart, neighbours 76 mm apart: every disc shows at
# least 65 % of its label, and the discs' edges stay 2 mm off the lid's inner walls (x ±138,
# y -224 and -12).
GRID_SLOTS = ((-38.0, -76.0), (38.0, -76.0), (0.0, -162.0), (-76.0, -162.0), (76.0, -162.0))


def rack_pose(i):
    """Slot i of the rack (0 = the next disc, lowest and in front): the disc's bottom edge
    (lid-local y and depth), its tilt out of the lining, and its centre. Each slot further back is
    1.6 mm closer to the lining and leans out 1.5 degrees less, so the discs fan; in the cascade
    each is also RACK_PITCH higher, in the grid GRID_SLOTS places it."""
    tilt = math.radians(4.0 + 1.5 * (4 - i))
    zb = 25.2 - 1.6 * (4 - i)
    if RACK_LAYOUT == "grid":
        x, yc = GRID_SLOTS[i]
        yb = yc + 60.0 * math.cos(tilt)
        return yb, zb, tilt, (x, yc, zb - 60.0 * math.sin(tilt))
    yb = -19.0 - RACK_PITCH * i
    return yb, zb, tilt, (RACK_X, yb - 60.0 * math.cos(tilt), zb - 60.0 * math.sin(tilt))


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


def rivet(name, loc, rot=(0, 0, 0), parent=None, r=1.4):
    """A domed rivet head of radius r, its base at loc, pointing along its local +z (set by rot)."""
    return lathe(name, [(0.01, 0.0), (r, 0.0), (r * 0.93, r * 0.36), (0.01, r * 0.54)], M["hardware"],
                 seg=24, parent=parent, loc=loc, rot=rot)


def screw(name, loc, rot=(0, 0, 0), parent=None, r=2.4, slot_deg=35.0):
    """A slotted screw head: an empty at loc with the head and its dark slot as leaf meshes."""
    root = empty(name, loc, rot, parent)
    lathe(name + "_head", [(0.01, 0.0), (r, 0.0), (r, 0.45), (r * 0.85, 0.95), (0.01, 1.1)], M["hardware"],
          seg=32, parent=root)
    slot = rbox(name + "_slot", (r * 1.5, 0.5, 0.3), M["ink_dark"], parent=root, loc=L(0, 0, 1.05))
    slot.rotation_euler = (0, 0, math.radians(slot_deg))
    return root


def corner_cap(name, parent, cx, cy, quadrant, z_edge, up):
    """A metal cap over one rounded corner (its axis at cx, cy; quadrant 0..3 = +x+y, -x+y, -x-y,
    +x-y), wrapping the edge at z_edge: 21 mm of wall, the 5 mm bevel there and 7 mm of the flat
    face beyond it (`up`: the flat face is above the wall, as on the lid). 1.4 mm thick, sitting
    0.4 mm off the leather, with two rivets on its wall."""
    s = 1.0 if up else -1.0
    prof = [(24.4, z_edge - s * 26.0), (24.4, z_edge - s * 5.0)]
    for k in range(1, 7):
        a = math.radians(15 * k)
        prof.append((19.0 + 5.4 * math.cos(a), z_edge - s * 5.0 + s * 5.4 * math.sin(a)))
    prof.append((12.0, z_edge + s * 0.4))
    a0 = 90.0 * quadrant - 8.0
    cap = lathe_arc(name, prof, a0, a0 + 106.0, M["hardware"], seg=24, parent=parent, loc=L(cx, cy, 0))
    solidify(cap, 1.4)
    a = math.radians(90.0 * quadrant + 45.0)
    for k, dz in enumerate((11.0, 21.0)):
        rivet(f"{name}_rivet_{k}", L(cx + 25.1 * math.cos(a), cy + 25.1 * math.sin(a), z_edge - s * dz),
              (0, math.pi / 2, a), parent=parent)
    return cap


def keyhole_clasp(name, tub, lid, x):
    """A side clasp at x: the lock body, its keyhole and its post on the tub's front, two rivets,
    and the hasp on the lid's front face above it."""
    y = -D / 2
    rbox(name, (24, 3.0, 15), M["hardware"], bevel_mm=0.8, parent=tub, loc=L(x, y - 1.5, 71.5))
    slab(name + "_keyhole", [keyhole(0.0, 1.0, 1.6, 1.2, 3.4)], 0.0, 0.5, M["ink_dark"], parent=tub,
         loc=L(x, y - 3.0, 71.5), rot=(math.pi / 2, 0, 0))
    lathe(name + "_post", [(0.01, 0), (1.8, 0), (1.8, 2.2), (2.6, 2.8), (2.6, 3.4), (0.01, 3.6)], M["hardware"],
          seg=24, parent=tub, loc=L(x, y - 3.0, 77.0), rot=(math.pi / 2, 0, 0))
    for k, dx in enumerate((-8.0, 8.0)):
        rivet(f"{name}_rivet_{k}", L(x + dx, y - 3.0, 66.5), (math.pi / 2, 0, 0), parent=tub)
    rbox(name + "_hasp", (20, 2.2, 14), M["hardware"], bevel_mm=0.8, parent=lid, loc=L(x, -D - 1.1, 8.0))


def handle(name, parent):
    """The carry handle on the tub's front: two riveted mounts, a D-ring standing out of each, a
    stitched leather grip arched between them, its ends sleeved over the rings."""
    y = -D / 2
    for k, x in enumerate((-58.0, 58.0)):
        rbox(f"{name}_mount_{k}", (16, 2.0, 12), M["hardware"], bevel_mm=0.5, parent=parent, loc=L(x, y - 1.0, HANDLE_Z))
        for j, dz in enumerate((-4.0, 4.0)):
            rivet(f"{name}_mount_{k}_rivet_{j}", L(x, y - 2.0, HANDLE_Z + dz), (math.pi / 2, 0, 0), parent=parent)
        tube(f"{name}_dring_{k}", circle(7.0, 24, a0=180.0, a1=360.0), 1.2, M["hardware"], cyclic=True,
             parent=parent, loc=L(x, y - 2.0, HANDLE_Z))
        rbox(f"{name}_end_{k}", (12, 9, 12), M["trim"], bevel_mm=2.0, parent=parent, loc=L(x, y - 9.5, HANDLE_Z))
    grip = smooth_path([(-58, y - 9, HANDLE_Z), (-50, y - 19, HANDLE_Z), (-30, y - 26, HANDLE_Z),
                        (0, y - 28.5, HANDLE_Z), (30, y - 26, HANDLE_Z), (50, y - 19, HANDLE_Z),
                        (58, y - 9, HANDLE_Z)], 8)
    tube(name, grip, 5.0, M["trim"], res=4, parent=parent)
    seam = [(px, py) for px, py, _ in smooth_path([(-36, y - 25.2, 0), (0, y - 28.5, 0), (36, y - 25.2, 0)], 8)]
    stitches(name + "_st_a", seam, HANDLE_Z + 5.1, M["thread"], spacing=3.6, dash=2.0, closed=False, parent=parent)
    stitches(name + "_st_b", seam, HANDLE_Z - 5.1, M["thread"], spacing=3.6, dash=2.0, closed=False, parent=parent)


def luggage_tag(name, parent, body_text, web):
    """The luggage tag on the handle's left D-ring: a leather cord looped round the ring, a leather
    tag with a metal eyelet hanging in front of the grille, its face printed (`<name>` in
    tag_print; the render writes the text instead)."""
    x, y = -58.0, -D / 2
    cord = smooth_path([(x, y - 8.0, HANDLE_Z + 2.4), (x, y - 10.6, HANDLE_Z), (x, y - 8.0, HANDLE_Z - 2.6),
                        (x, y - 6.4, HANDLE_Z - 8.0), (x, y - 6.2, 58.0), (x, y - 7.1, 55.0)], 6)
    tube(name + "_cord", cord, 1.0, M["trim"], parent=parent)
    tag = empty(name + "_root", L(x, y - 7.1, 31.0), (math.pi / 2, 0, 0), parent=parent)
    rbox(name + "_body", (36, 58, 1.8), M["trim"], bevel_mm=0.6, parent=tag)
    tube(name + "_eyelet", circle(2.2, 20), 0.6, M["hardware"], cyclic=True, parent=tag, loc=L(0, 24.0, 0))
    if web:
        rbox(name, (30, 44, 0.05), M["tag_print"], parent=tag, loc=L(0, -5.0, 0.95))
    else:
        text(name + "_t1", "NAME", 1.6, M["ink"], font="avenir", align="LEFT", parent=tag, loc=L(-13.0, 14.0, 0.92))
        text(name + "_t2", body_text, 3.0, M["ink_dark"], font="futura", align="LEFT", parent=tag,
             loc=L(-13.0, 6.0, 0.92))
        for k, yy in enumerate((2.0, -6.0, -14.0)):
            rbox(f"{name}_rule_{k}", (26, 0.25, 0.04), M["ink"], parent=tag, loc=L(0, yy, 0.92))


def rack(name, lid, labels):
    """The five slots: a metal lip under each disc and an empty per slot (`<name>_slot_i`: the
    pose of the disc in it). The cascade also has a trimmed leather frame round its column; the
    grid's lips are 70 mm wide, one under each disc, and need no frame. With `labels`, a disc
    stands in each slot (the render); the web model carries the empties only."""
    zin = HL - 13.5
    grid = RACK_LAYOUT == "grid"
    if not grid:
        cheeks = (RACK_X - RACK_CHEEK, RACK_X + RACK_CHEEK)
        rails = (-14.5, -221.5)
        for k, x in enumerate(cheeks):
            rbox(f"{name}_cheek_{k}", (1.6, 206.0, 11.0), M["trim"], bevel_mm=0.4, parent=lid, loc=L(x, -118.0, zin - 5.5))
        for k, yy in enumerate(rails):
            rbox(f"{name}_rail_{k}", (125.0, 3.0, 11.0), M["trim"], bevel_mm=0.5, parent=lid, loc=L(RACK_X, yy, zin - 5.5))
        # A rivet where each cheek meets each rail: both cheeks on the upper rail, then the lower.
        for k, (x, yy) in enumerate([(x, yy) for yy in rails for x in cheeks]):
            rivet(f"{name}_rivet_{k}", L(x, yy, zin - 11.0), (math.pi, 0, 0), parent=lid, r=1.2)
    for i in range(5):
        yb, zb, tilt, centre = rack_pose(i)
        depth = 28.9 - zb  # from the lining to 2.4 mm in front of the disc's bottom edge
        rbox(f"{name}_lip_{i}", (70.0 if grid else 122.0, 2.4, depth), M["hardware"], bevel_mm=0.3, parent=lid,
             loc=L(centre[0], yb + 1.8, zin - depth / 2))
        empty(f"{name}_slot_{i}", L(*centre), (math.pi + tilt, 0, 0), parent=lid)
        if labels:
            make_disc(f"{name}_disc_{i}", labels[i], L(*centre), (math.pi + tilt, 0, 0), parent=lid)


def deck_details(name, root, well, web):
    """The chrome ring round the well, the deck's four corner screws, the VU strip and its label."""
    lathe(name + "_well_ring", [(63.4, DECK - 0.2), (65.6, DECK - 0.2), (65.6, DECK + 0.7), (64.9, DECK + 1.3),
                                (63.6, DECK + 1.1)], M["chrome"], seg=160, parent=well)
    for sx in (-1, 1):
        for sy in (-1, 1):
            screw(f"{name}_screw_{sx}{sy}", L(sx * 125.0, sy * 93.0, DECK), parent=root, slot_deg=35.0 * sx * sy)
    rbox(name + "_vu_bezel", (62, 4.6, 0.5), M["black_glass"], bevel_mm=0.2, parent=root, loc=L(100.0, 44.2, DECK + 0.25))
    for i in range(10):
        rbox(f"{name}_vu_seg_{i}", (3.6, 1.8, 0.3), M["vu"] if (web or i < 7) else M["vu_off"], parent=root,
             loc=L(100.0 + (i - 4.5) * 5.8, 44.2, DECK + 0.6))
    text(name + "_vu_t", "LEVEL", 1.8, M["ink"], font="avenir", align="RIGHT", parent=root, loc=L(67.0, 44.2, DECK + 0.02))


def make_player(name, disc_label, booklet, rack_labels=None, lid_open=100.0, arm_angle=-30.0,
                playlist="Top 50 · Global", track=("01", "1:24"), web=False):
    root = empty(name)
    Lr, Tr = M["leather"], M["trim"]
    # --- base tub: leather, stitched, piped, capped at its four bottom corners
    slab(name + "_frame", [rrect(W, D, RAD), rrect(W - 2 * WALL, D - 2 * WALL, RAD - 10)], 0, HB, Lr,
         bevel_mm=5.0, res=4, parent=root)
    slab(name + "_bottom", [rrect(W, D, RAD)], 0, 10, Lr, bevel_mm=5.0, res=4, parent=root)
    stitches(name + "_st_top", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14), HB - 6.5, M["thread"], parent=root)
    stitches(name + "_st_bot", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14), 7.0, M["thread"], parent=root)
    piping = rrect(W + 1.0, D + 1.0, RAD + 0.5, seg=10)
    tube(name + "_pipe_top", piping, 1.5, Tr, cyclic=True, parent=root, loc=L(0, 0, HB - 2.5))
    tube(name + "_pipe_bot", piping, 1.5, Tr, cyclic=True, parent=root, loc=L(0, 0, 3.0))
    for q_, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        corner_cap(f"{name}_cap_{q_}", root, sx * (W / 2 - RAD), sy * (D / 2 - RAD), q_, 0.0, False)
    # --- deck with the disc well
    slab(name + "_deck", [rrect(W - 2 * WALL + 2, D - 2 * WALL + 2, RAD - 9), circle(64.0, 160, WX, WY)],
         DECK - 4, DECK, M["deck"], bevel_mm=0.8, parent=root)
    well = empty(name + "_well", L(WX, WY, 0), parent=root)
    cup = lathe(name + "_well_cup", [(64.0, DECK - 0.3), (64.0, FLOOR + 0.7), (63.3, FLOOR), (9.0, FLOOR)],
                M["well"], seg=160, closed=False, parent=well)
    cup.data.flip_normals()  # lathe's recalc points an open surface outward; the visitor looks into it
    annulus(name + "_well_gap", 63.4, 61.8, M["ink"], z_mm=FLOOR + 0.02, parent=well)
    lathe(name + "_spindle", [(0.01, 72.0), (13.0, 72.0), (13.0, 75.2), (12.4, 75.9), (7.3, 75.9), (7.3, 78.6),
                              (6.8, 79.2), (0.01, 79.3)], M["hub_black"], seg=96, parent=well)
    lathe(name + "_spindle_cap", [(0.01, 79.25), (3.6, 79.25), (3.2, 80.0), (0.01, 80.2)], M["chrome"], seg=48,
          parent=well)
    for k in range(3):
        a = 2 * math.pi * k / 3
        sphere(f"{name}_ball_{k}", 0.95, M["chrome"], parent=well, loc=L(7.2 * math.cos(a), 7.2 * math.sin(a), 77.8))
    make_disc(name + "_disc", disc_label, L(WX, WY, DISC_Z), (0, 0, math.radians(-25)), parent=root)
    deck_details(name, root, well, web)
    # --- tonearm: the base, collar, ring, rest, cue lever and anti-skate dial are the deck's; the
    # yoke, pin, tube, counterweight, headshell, cartridge, lift and stylus turn with `arm`
    lathe(name + "_arm_base", [(0.01, DECK), (15.0, DECK), (15.0, DECK + 2.4), (14.2, DECK + 3.2), (9.0, DECK + 3.2),
                               (0.01, DECK + 3.2)], M["arm"], seg=96, parent=root, loc=L(AX, AY, 0))
    lathe(name + "_arm_collar", [(0.01, DECK + 3.2), (7.6, DECK + 3.2), (7.6, DECK + 11.6), (7.0, DECK + 12.3),
                                 (0.01, DECK + 12.5)], M["hardware"], seg=64, parent=root, loc=L(AX, AY, 0))
    tube(name + "_arm_ring", circle(14.6, 64), 0.7, M["hardware"], cyclic=True, parent=root, loc=L(AX, AY, DECK + 3.2))
    lathe(name + "_arm_antiskate", [(0.01, 0), (3.2, 0), (3.2, 2.2), (2.6, 2.8), (0.01, 3.0)], M["hardware"], seg=32,
          ridge=({1, 2}, 0.3), parent=root, loc=L(AX + 13.0, AY + 11.0, DECK))
    lathe(name + "_arm_cue_post", [(0.01, 0), (1.6, 0), (1.6, 4.2), (0.01, 4.2)], M["hardware"], seg=16, parent=root,
          loc=L(AX - 15.0, AY - 14.0, DECK))
    rbox(name + "_arm_cue", (2.0, 9.0, 1.4), M["hardware"], bevel_mm=0.4, parent=root, loc=L(AX - 15.0, AY - 10.0, DECK + 4.8))
    arm = empty(name + "_arm", L(AX, AY, DECK + 10.0), (0, 0, math.radians(arm_angle)), parent=root)
    for side, x in (("l", -9.6), ("r", 9.6)):
        rbox(f"{name}_arm_yoke_{side}", (2.4, 6.0, 11.8), M["hardware"], bevel_mm=0.4, parent=arm, loc=L(x, 0, -0.9))
    rbox(name + "_arm_yoke_top", (21.6, 6.0, 2.4), M["hardware"], bevel_mm=0.4, parent=arm, loc=L(0, 0, 5.8))
    lathe(name + "_arm_pin", [(0.01, -11.4), (1.4, -11.4), (1.4, 11.4), (0.01, 11.4)], M["chrome"], seg=24, parent=arm,
          rot=(0, math.pi / 2, 0))
    path = smooth_path([(0, 0, 0), (0, -26, -0.4), (-3, -50, -1.4), (-7, -72, -2.4), (-8.5, -88, -3.0)], 10)
    tube(name + "_arm_tube", path, 3.0, M["arm"], res=5, parent=arm)
    cw = lathe(name + "_arm_cw", [(0.01, -8), (7.0, -8), (7.6, -7.3), (7.6, 7.3), (7.0, 8), (0.01, 8)], M["hardware"],
               seg=64, ridge=({2, 3}, 0.35), parent=arm)
    cw.location = L(0, 17, 0)
    cw.rotation_euler = (math.pi / 2, 0, 0)
    band = lathe(name + "_arm_cw_band", [(7.65, -1.2), (8.05, -1.2), (8.05, 1.2), (7.65, 1.2)], M["hub_black"], seg=64,
                 parent=arm)
    band.location = L(0, 17, 0)
    band.rotation_euler = (math.pi / 2, 0, 0)
    slab(name + "_arm_head", [[(-5.0, 4.0), (5.0, 4.0), (7.2, -13.0), (6.0, -15.5), (-6.0, -15.5), (-7.2, -13.0)]],
         -2.4, 2.4, M["arm"], bevel_mm=1.1, res=4, parent=arm, loc=L(-8.6, -92, -5.6))
    rbox(name + "_arm_cart", (9.0, 9.0, 2.2), M["hardware"], bevel_mm=0.5, parent=arm, loc=L(-8.6, -100, -7.9))
    tube(name + "_arm_lift", smooth_path([(-14, -101, -6.6), (-19, -103, -5.4), (-22, -104, -2.6)], 6), 0.9,
         M["hardware"], parent=arm)
    tube(name + "_arm_cantilever", [(-8.6, -104.4, -9.0), (-8.6, -107.0, -10.1)], 0.25, M["chrome"], parent=arm)
    sphere(name + "_arm_stylus", 0.35, M["hub_black"], seg=8, parent=arm, loc=L(-8.6, -107.0, -10.1))
    lathe(name + "_arm_rest", [(0.01, DECK), (4.2, DECK), (4.2, DECK + 3.7), (3.5, DECK + 4.2), (0.01, DECK + 4.3)],
          M["arm"], seg=48, parent=root, loc=L(AX - 7.7, AY - 80.0, 0))
    tube(name + "_arm_rest_clip", circle(3.4, 24, a0=150.0, a1=390.0), 0.6, M["hardware"], parent=root,
         loc=L(AX - 7.7, AY - 80.0, DECK + 7.3), rot=(math.pi / 2, 0, 0))
    # --- display
    cx, cy = 100.0, 64.0
    slab(name + "_lcd_bezel", [rrect(62, 31, 4.4, cx=cx, cy=cy), rrect(56, 25, 3.0, cx=cx, cy=cy)], DECK - 0.4,
         DECK + 1.2, M["hardware"], bevel_mm=0.5, parent=root)
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
    # --- buttons: each key's dark ring and label are printed on the deck, so they are the deck's
    # children, never the key's (the page moves the key alone)
    grid = [("prev", 86, 32, "PREV"), ("next", 114, 32, "NEXT"), ("play", 86, 10, "PLAY/PAUSE"),
            ("stop", 114, 10, "STOP"), ("rpt", 86, -12, "REPEAT"), ("mode", 114, -12, "MODE")]
    for kind, bx, by, label in grid:
        b = empty(f"{name}_btn_{kind}", L(bx, by, DECK), parent=root)
        annulus(f"{name}_btn_gap_{kind}", 7.4, 6.5, M["ink_dark"], z_mm=DECK + 0.03, parent=root, loc=L(bx, by, 0))
        lathe(f"{name}_btn_cap_{kind}", [(0.01, 0.0), (6.6, 0.0), (6.6, 1.8), (6.3, 2.9), (5.3, 3.45), (4.2, 3.62),
                                         (0.01, 3.66)], M["btn"], seg=64, parent=b)
        shapes = button_icon(kind)
        if shapes:
            ic = slab(f"{name}_btn_icon_{kind}", shapes, 3.6, 3.78, M["ink_dark"], parent=b)
            ic.scale = (1.3, 1.3, 1.0)
        else:
            text(f"{name}_btn_txt_{kind}", "RPT" if kind == "rpt" else "M", 3.0, M["ink_dark"], font="avenir",
                 parent=b, loc=L(0, 0, 3.68))
        text(f"{name}_btn_lbl_{kind}", label, 2.5, M["ink"], font="avenir", parent=root, loc=L(bx, by - 10.4, DECK + 0.02))
    # --- volume knob: its ticks and its name are the deck's too
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
        t = rbox(f"{name}_tick_{k}", (3.2 if k % 3 == 0 else 2.0, 0.55, 0.06), M["ink"], parent=root)
        rr = 23.2 if k % 3 == 0 else 22.6
        t.location = L(kx + rr * math.cos(a), ky + rr * math.sin(a), DECK + 0.03)
        t.rotation_euler = (0, 0, a)
    text(name + "_vol", "VOLUME", 2.8, M["ink"], font="avenir", parent=root, loc=L(kx, ky - 27.5, DECK + 0.02))
    # --- branding on the deck (moved right of the front-left corner screw)
    text(name + "_brand", "ncam", 9.0, M["ink_dark"], font="futura", align="LEFT", parent=root,
         loc=L(-112.0, -88.0, DECK + 0.02))
    text(name + "_model", "CD·01   COMPACT DISC PLAYER", 2.8, M["ink"], font="avenir", align="LEFT", parent=root,
         loc=L(-112.0, -96.5, DECK + 0.02))
    # --- front: the woven grille in a metal frame with its screws and a stitched border, the
    # engraved nameplate, the clasps, the handle and its tag
    holes = [rrect(204, 2.5, 1.25, cy=-16.5 + 5.5 * i) for i in range(7)]
    slab(name + "_grille", [rrect(230, 48, 11)] + holes, 0.0, 2.2, M["grille"], bevel_mm=0.45, parent=root,
         loc=L(0, -D / 2, 38), rot=(math.pi / 2, 0, 0))
    rbox(name + "_fabric", (216, 0.6, 42), M["fabric"], parent=root, loc=L(0, -D / 2 + 0.2, 38))
    slab(name + "_grille_frame", [rrect(236, 54, 13), rrect(230.6, 48.6, 11.3)], 2.2, 3.6, M["hardware"],
         bevel_mm=0.4, parent=root, loc=L(0, -D / 2, 38), rot=(math.pi / 2, 0, 0))
    for k, (x, zz) in enumerate(((-116.6, 56.0), (116.6, 56.0), (-116.6, 20.0), (116.6, 20.0))):
        screw(f"{name}_grille_screw_{k}", L(x, -D / 2 - 3.6, zz), (math.pi / 2, 0, 0), parent=root, r=1.6,
              slot_deg=20.0 + 50.0 * k)
    stitches(name + "_st_grille", rrect(241, 59, 14.5, seg=10), 0.4, M["thread"], parent=root, loc=L(0, -D / 2, 38),
             rot=(math.pi / 2, 0, 0))
    rbox(name + "_plate", (46, 1.2, 11), M["hardware"], bevel_mm=0.4, parent=root, loc=L(78.0, -D / 2 - 2.9, 24.0))
    text(name + "_plate_t", "ncam", 5.2, M["ink_dark"], font="futura", extrude_mm=0.1, parent=root,
         loc=L(78.0, -D / 2 - 3.62, 24.4), rot=(math.pi / 2, 0, 0))
    for k, dx in enumerate((-20.0, 20.0)):
        rivet(f"{name}_plate_rivet_{k}", L(78.0 + dx, -D / 2 - 3.5, 24.0), (math.pi / 2, 0, 0), parent=root, r=0.8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe(f"{name}_foot_{sx}{sy}", [(0.01, 0), (9, 0), (9, 2.4), (8, 3.4), (0.01, 3.4)], M["hardware"], seg=48,
                  parent=root, loc=L(sx * (W / 2 - 30), sy * (D / 2 - 30), -3.0))
    # --- hinges
    for hx in (-82.0, 82.0):
        kn = lathe(f"{name}_hinge_{hx}", [(0.01, -15), (3.3, -15), (3.3, 15), (0.01, 15)], M["hardware"], seg=40, parent=root)
        kn.location = L(hx, D / 2 + 1.2, HB)
        kn.rotation_euler = (0, math.pi / 2, 0)
        rbox(f"{name}_hinge_leaf_{hx}", (30, 1.6, 13), M["hardware"], bevel_mm=0.5, parent=root,
             loc=L(hx, D / 2 + 0.6, HB - 7.5))
    # --- lid (hinged at the back top edge): piped, capped, quilted inside. Cascade: the case on
    # the left, the rack up the right half, the strap across the top band and the plate in the
    # bottom one. Grid: no case, the discs fill the lid, the strap stands at the left edge and the
    # plate, turned like a book's spine, at the right.
    lid = empty(name + "_lid", L(0, D / 2, HB), (-math.radians(lid_open), 0, 0), parent=root)
    cyl = -D / 2
    slab(name + "_lid_frame", [rrect(W, D, RAD, cy=cyl), rrect(W - 2 * WALL, D - 2 * WALL, RAD - 10, cy=cyl)], 0, HL,
         Lr, bevel_mm=5.0, res=4, parent=lid)
    slab(name + "_lid_top", [rrect(W, D, RAD, cy=cyl)], HL - 10, HL, Lr, bevel_mm=5.0, res=4, parent=lid)
    stitches(name + "_lid_st_a", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14, cy=cyl), 6.5, M["thread"], parent=lid)
    stitches(name + "_lid_st_b", rrect(W + 0.3, D + 0.3, RAD + 0.15, seg=14, cy=cyl), HL - 7.0, M["thread"],
             parent=lid)
    lid_piping = rrect(W + 1.0, D + 1.0, RAD + 0.5, seg=10, cy=cyl)
    tube(name + "_lid_pipe_a", lid_piping, 1.5, Tr, cyclic=True, parent=lid, loc=L(0, 0, 2.5))
    tube(name + "_lid_pipe_b", lid_piping, 1.5, Tr, cyclic=True, parent=lid, loc=L(0, 0, HL - 2.5))
    for q_, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        corner_cap(f"{name}_lid_cap_{q_}", lid, sx * (W / 2 - RAD), cyl + sy * (D / 2 - RAD), q_, HL, True)
    slab(name + "_lining", [rrect(W - 2 * WALL + 2, D - 2 * WALL + 2, RAD - 9, cy=cyl)], HL - 13.5, HL - 10, M["lining"],
         bevel_mm=0.8, parent=lid)
    zin = HL - 13.5
    if RACK_LAYOUT == "grid":
        rbox(name + "_strap", (14, 90, 1.6), M["strap"], bevel_mm=0.5, parent=lid, loc=L(-118.0, cyl + 57.0, zin - 0.9))
        rbox(name + "_strap_tab", (16, 10, 2.2), M["trim"], bevel_mm=0.6, parent=lid, loc=L(-118.0, cyl + 11.0, zin - 1.3))
        rivet(name + "_strap_rivet", L(-118.0, cyl + 11.0, zin - 2.4), (math.pi, 0, 0), parent=lid, r=1.2)
        # (pi, 0, pi/2): facing the visitor, its text's top to the right, read like a book's spine.
        card = empty(name + "_card", L(121.0, cyl + 58.0, zin - 0.2), (math.pi, 0, math.pi / 2), parent=lid)
    else:
        make_case(name + "_case", booklet, L(-60.0, cyl, zin), (math.pi, 0, 0), parent=lid)
        for yy in (cyl + 64.5, cyl - 64.5):
            rbox(f"{name}_case_clip_{yy}", (22, 7, 13.5), M["crystal"], bevel_mm=1.2, parent=lid, loc=L(-60.0, yy, zin - 6.0))
        rbox(name + "_strap", (144, 14, 1.6), M["strap"], bevel_mm=0.5, parent=lid, loc=L(-67.0, cyl - 86.0, zin - 0.9))
        rbox(name + "_strap_tab", (10, 16, 2.2), M["trim"], bevel_mm=0.6, parent=lid, loc=L(2.5, cyl - 86.0, zin - 1.3))
        rivet(name + "_strap_rivet", L(2.5, cyl - 86.0, zin - 2.4), (math.pi, 0, 0), parent=lid, r=1.2)
        card = empty(name + "_card", L(-60.0, cyl + 86.0, zin - 0.2), (math.pi, 0, 0), parent=lid)
    rack(name + "_rack", lid, rack_labels)
    rbox(name + "_card_plate", (92, 18, 1.0), M["alu_side"], bevel_mm=0.3, parent=card)
    for k, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        rivet(f"{name}_card_rivet_{k}", L(sx * 42.0, sy * 5.5, 0.5), parent=card, r=0.9)
    if web:
        rbox(name + "_card_print", (90, 16, 0.05), M["card_print"], parent=card, loc=L(0, 0, 0.55))
    else:
        text(name + "_card_t1", "NOW SPINNING", 2.8, M["ink"], font="avenir", parent=card, loc=L(0, 4.2, 0.52))
        text(name + "_card_t2", playlist, 5.0, M["ink_dark"], font="futura", parent=card, loc=L(0, -2.6, 0.52))
    for hx in (-82.0, 82.0):
        rbox(f"{name}_lid_leaf_{hx}", (30, 1.6, 13), M["hardware"], bevel_mm=0.5, parent=lid, loc=L(hx, 0.6, 7.5))
    for side, sx in (("l", -1), ("r", 1)):
        keyhole_clasp(f"{name}_clasp_{side}", root, lid, sx * 95.0)
    handle(name + "_handle", root)
    luggage_tag(name + "_tag", root, playlist, web)
    return root

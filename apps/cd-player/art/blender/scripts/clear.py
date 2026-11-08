"""The Clear model: an upright, see-through CD player (art/blender/scripts/build_clear.py names
what the page drives; hero.py renders it when CDP_MODEL=clear).

Needs cdkit's and parts.py's namespace (exec'd after them), and is followed into it by its board,
clear_board.py, and its decorations, clear_decor.py, which read its dimensions, helpers and
materials: make_clear_player calls clear_board, clear_etch, clear_dongson_ring and clear_grooves,
so all three are exec'd before it runs. Blender's axes as in parts.py: x right, y away from the
viewer (the front faces -y), z up, millimetres through L(x, y, z). The player stands at the
origin, the stand with the rack's five slots on its right, the jewel case on its left.

The body is a clear polycarbonate box on a plinth of the frame's colour: a front plate with the
window's opening, a back plate, and one hollow band for the sides, the top and the bottom (never a
filled block, which would refract everything inside it). Behind the round glass door, hinged on
its left, the disc stands on its spindle, ringed by the light ring, the laser's swing arm and the
motor behind it; the board runs along the bottom with the LCD, the VU strip and the silkscreened
logo; a speaker either side; four AA cells across the back under the top; six keys, the knob
(standing upright, right of the keys) and the handle on top, the tag hanging from the handle over
the front and the nameplate on the plinth. Frosted circuit-maze lines are etched on the shell's
sides and top, a gold Đông Sơn ring runs round the door, and hatched lozenge chains stand out of
the plinth's front and the keys' deck.

Its colours come part by part from src/clear-looks.json (clear_look): build_clear_materials(look)
makes the four parts' materials (clear_shell, clear_frame, board, light) and the fixed ones. The
web build (WEB) carries the empties the page drives at rest, the prints as plain planes and no
discs in the rack; a render (not WEB) plays: the arm over the disc, discs in the rack, the LCD
and the VU lit, the tag and the plate lettered.
"""
import json
import math
import os
import re

import bmesh
from mathutils import Euler, Vector

CLEAR_PARTS = ("shell", "frame", "board", "light")
CLEAR_DEFAULT = {"shell": "clear", "frame": "silver", "board": "green", "light": "ice"}
# What this script reads of each part's swatches, beside their `id`: an sRGB hex, or a number.
SWATCH_FIELDS = {"shell": {"tint": "hex"}, "frame": {"colour": "hex", "metalness": "number", "roughness": "number"},
                 "board": {"colour": "hex"}, "light": {"glow": "hex"}}
HEX_COLOUR = re.compile(r"#[0-9a-fA-F]{6}")


def _field_ok(value, kind):
    if kind == "hex":
        return isinstance(value, str) and HEX_COLOUR.fullmatch(value) is not None
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def clear_swatches():
    """src/clear-looks.json's swatches, part -> id -> swatch. It stops the run, naming the file and
    what is wrong, unless every part is a list of swatches, each with an id and the fields this
    script reads (SWATCH_FIELDS): a part or a field it lacked would otherwise fail later, as a
    traceback."""
    path = os.path.normpath(os.path.join(_scripts_dir(), "..", "..", "..", "src", "clear-looks.json"))
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise SystemExit("clear.py: cannot read %s (%s: %s)" % (path, type(err).__name__, err))
    if not isinstance(data, dict):
        raise SystemExit("clear.py: %s must be an object with the parts %s" % (path, ", ".join(CLEAR_PARTS)))
    swatches = {}
    for part in CLEAR_PARTS:
        listed = data.get(part)
        if not isinstance(listed, list) or not listed:
            raise SystemExit("clear.py: %s has no %s swatches (a non-empty list)" % (path, part))
        swatches[part] = {}
        for i, swatch in enumerate(listed):
            if not isinstance(swatch, dict):
                raise SystemExit("clear.py: %s: %s swatch %d is not an object (%r)" % (path, part, i, swatch))
            sid = swatch.get("id")
            if not isinstance(sid, str) or not sid:
                raise SystemExit("clear.py: %s: %s swatch %d has no id" % (path, part, i))
            for field, kind in SWATCH_FIELDS[part].items():
                if not _field_ok(swatch.get(field), kind):
                    raise SystemExit("clear.py: %s: %s %r has no %s %s (%r)" % (
                        path, part, sid, "#rrggbb" if kind == "hex" else "numeric", field, swatch.get(field)))
            swatches[part][sid] = swatch
    return swatches


def clear_look(spec=None):
    """A look from "shell,frame,board,light" (hero.py's CDP_CLEAR_LOOK); None is the default."""
    swatches = clear_swatches()
    if spec is None:
        ids = dict(CLEAR_DEFAULT)
    else:
        parts = spec.split(",")
        if len(parts) != 4:
            raise SystemExit("clear.py: CDP_CLEAR_LOOK needs shell,frame,board,light: %r" % spec)
        ids = dict(zip(CLEAR_PARTS, parts))
    for part, sid in ids.items():
        if sid not in swatches[part]:
            raise SystemExit("clear.py: no %s %r (%s)" % (part, sid, ", ".join(swatches[part])))
    return {part: swatches[part][ids[part]] for part in CLEAR_PARTS}, ids


# ------------------------------------------------------------------ materials
def _hex(h):
    """'#rrggbb' -> linear RGBA, as parts.py turns its palettes (lin(*hexrgb(h)))."""
    return lin(*hexrgb(h))


def _luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def _shadow_colour(m, rgb):
    """mat() lets Cycles' shadow rays through glass, faintly grey: tint them as the glass is."""
    for node in m.node_tree.nodes:
        if node.type == "BSDF_TRANSPARENT":
            node.inputs["Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)


def _windings(m, pitch_mm=0.32):
    """Copper wire wound round a coil (Cycles only): fine bands across the coil's local x."""
    nt = m.node_tree
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = 0.31416 / (pitch_mm * MM)
    nt.links.new(obj_coords(m, 1.0), wave.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.00008
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf(m).inputs["Normal"])
    return m


def _mix_hex(h, target, amount):
    """'#rrggbb' mixed toward target (0 or 255) by amount, each sRGB channel linearly, rounded half
    up: src/scene/decor-colours.ts's mixHex. Returns 0..255 channels."""
    return tuple(int((c + (target - c) * amount) + 0.5) for c in hexrgb(h))


def trace_rgb(board_hex):
    """The copper traces' colour: the board's, lifted toward white by 0.22 when its linear luma is
    under 0.5, else darkened by 0.12 (decor-colours.ts's traceColour). 0..255 channels."""
    if _luma(_hex(board_hex)) < 0.5:
        return _mix_hex(board_hex, 255, 0.22)
    return _mix_hex(board_hex, 0, 0.12)


def build_clear_materials(look):
    """The Clear model's materials on top of build_materials() (the disc's and the case's): the four
    a look colours, from its swatches, and the fixed ones of the parts inside."""
    build_materials()
    shell, frame, board, light = (look[p] for p in CLEAR_PARTS)
    tint = _hex(shell["tint"])
    glow = _hex(light["glow"])
    # Cycles tints a transmissive surface at each crossing, in and out: a wall's two faces give the
    # swatch's tint once, as the page's shell (its front faces only) tints once per wall.
    wall = tint if WEB else tuple(math.sqrt(c) for c in tint[:3]) + (1.0,)
    M["clear_shell"] = mat("clear_shell", wall, rough=0.05, trans=1.0, ior=1.49)
    M["door_glass"] = mat("door_glass", (0.98, 0.99, 1.0, 1), rough=0.02, trans=1.0, ior=1.52)
    M["clear_frame"] = mat("clear_frame", _hex(frame["colour"]), metal=float(frame["metalness"]),
                           rough=float(frame["roughness"]))
    board_rgb = _hex(board["colour"])
    M["board"] = mat("board", board_rgb, rough=0.28, coat=0.6, coat_rough=0.12)
    # Decoration materials (the page's trace, etch and gold roles, src/scene/decor-colours.ts): the
    # copper traces take the board's colour shifted toward its contrast, the frosted etching the
    # shell's tint lifted toward white, and the Đông Sơn gold is fixed.
    M["trace"] = mat("trace", lin(*trace_rgb(board["colour"])), rough=0.28, coat=0.6, coat_rough=0.12)
    M["etch"] = mat("etch", lin(*_mix_hex(shell["tint"], 255, 0.55)), rough=0.85, alpha=0.5)
    M["gold"] = mat("gold", lin(*hexrgb("#d6ae5a")), metal=1.0, rough=0.3)
    # The light's glow: bright enough to read as lit, not so bright that AgX bleaches it to white.
    M["light"] = mat("light", (0, 0, 0, 1), emit=glow, emit_s=3.2)
    # One emissive material for the ten VU segments: the page clones it per segment and lights
    # them (src/scene/vu-materials.ts), so the GLB carries 1.0; a render's lit segments glow at 3.
    M["vu"] = mat("vu", (0.02, 0.02, 0.022, 1), rough=0.3, emit=glow, emit_s=1.0 if WEB else 3.0)
    M["chip"] = mat("chip", (0.02, 0.02, 0.022, 1), rough=0.35)
    M["copper"] = mat("copper", lin(184, 115, 51), metal=1.0, rough=0.25)
    M["flex"] = mat("flex", lin(196, 110, 28), rough=0.4, coat=0.4)
    # The silkscreen is white, and black on a white board, as a real board is printed.
    silk = (0.92, 0.92, 0.9, 1) if _luma(board_rgb) < 0.45 else (0.025, 0.025, 0.03, 1)
    M["silk"] = mat("silk", silk, rough=0.7)
    M["solder"] = mat("solder", (0.8, 0.8, 0.82, 1), metal=1.0, rough=0.2)
    M["cell"] = mat("cell", lin(30, 30, 34), rough=0.45, coat=0.3)
    M["magnet"] = mat("magnet", (0.32, 0.32, 0.34, 1), metal=1.0, rough=0.4)
    M["surround"] = mat("surround", (0.03, 0.03, 0.035, 1), rough=0.85)
    M["wire_red"] = mat("wire_red", lin(176, 30, 28), rough=0.45, coat=0.2)
    if not WEB:
        _shadow_colour(M["clear_shell"], [0.97 * c for c in wall[:3]])
        add_bump(M["clear_frame"], "noise", scale=6000, strength=0.05, distance=0.00008)  # bead-blasted
        _windings(M["copper"])
        # Render-only: the LCD's lit and unlit segments, the VU's top three segments unlit.
        M["lcd_glow"] = mat("lcd_glow", (0, 0, 0, 1), emit=glow, emit_s=2.4)
        M["vu_dim"] = mat("vu_dim", (0.02, 0.02, 0.022, 1), rough=0.3, emit=glow, emit_s=0.12)
    return M


# ------------------------------------------------------------------ dimensions (mm)
BODY_W, BODY_H, BODY_D, BODY_R = 300.0, 214.0, 76.0, 20.0
SHELL_WALL = 3.0                    # the shell's walls (parts.py's WALL, the suitcase's, shares these globals)
PLINTH_W, PLINTH_D, PLINTH_H, PLINTH_Y = 318.0, 112.0, 30.0, -8.0
FOOT_H = 1.5                        # the plinth's rubber feet
Z0 = PLINTH_H + 0.1                 # the body's underside, on the plinth
Z1 = Z0 + BODY_H                    # its top
ZC = (Z0 + Z1) / 2
FRONT_Y, BACK_Y = -BODY_D / 2, BODY_D / 2
IN_F, IN_B = FRONT_Y + SHELL_WALL, BACK_Y - SHELL_WALL   # the plates' inner faces
DOOR_R = 75.0                       # the door: 150 across its bezel
BEZEL_IN = 68.5                     # the bezel's inner edge
GLASS_R = 69.0                      # the glass, its edge held in the bezel
DOOR_T = 5.0                        # the bezel's thickness
HOLE_R = 64.0                       # the opening in the front plate: the disc passes through it
DOOR_Z = ZC + 13.0                  # the window's centre: the disc's
HINGE_X = -(DOOR_R + 4.0)           # the hinge's axis, left of the door
HINGE_Y = FRONT_Y - DOOR_T / 2
DISC_Y = FRONT_Y + 14.0             # the disc's mid-plane, 14 mm behind the front
SPK_X, SPK_R = 114.0, 29.5          # the speakers' centres and their baskets' rim
GRILLE_R = 22.5                     # the perforated insert in front of each cone
ARM_X, ARM_Z = 66.0, DOOR_Z - 56.0  # the swing arm's pivot, lower right of the disc
ARM_Y = DISC_Y + 8.0                # the arm's mid-plane, behind the disc
ARM_LEN = 56.0                      # pivot to lens: off the rim at rest, over the music playing
ARM_PLAY = math.radians(-30.0)      # a render's arm, over the disc (Blender's y rotation)
CHASSIS_Y = DISC_Y + 15.9           # the mechanism's plate, behind the motor and the arm
BOARD_Z0, BOARD_Z1 = Z0 + 4.0, Z0 + 54.0      # its parts are laid out at these heights (mm)
BOARD_W = BODY_W - 2 * SHELL_WALL - 10.0
FACE_Y = 7.0                        # the board's front face (its parts stand toward the viewer)
SCREWS = [(sx * (BODY_W / 2 - 14.0), z) for sx in (-1, 1) for z in (Z0 + 14.0, Z1 - 14.0)]
KEYS = ("prev", "play", "next", "stop", "rpt", "mode")
WORDS = {"rpt": "RPT", "mode": "MODE"}  # button_icon draws the other four
KEY_Y, KEY_PITCH = -14.0, 25.0
DECK_W, DECK_D, DECK_R = 170.0, 24.0, 6.0   # the keys' deck: its width, its depth round KEY_Y, its corners
KEY_HOLE_W, KEY_HOLE_D, KEY_HOLE_R = 19.4, 15.4, 3.0   # a key's hole in it
DECK_RIM_Y = (DECK_D / 2 + KEY_HOLE_D / 2) / 2  # off KEY_Y, the middle of the flat between a hole and the deck's edge
DECK_GROOVE_X = DECK_W / 2 - DECK_R - 1.0   # the grooves' ends, clear of the deck's rounded corners
HANDLE_X, HANDLE_Y, HANDLE_H = 104.0, 14.0, 30.0
HANDLE_MOUNT = (17.0, 15.0, 7.0)             # each upright's mount: width, depth, height
KNOB_X, KNOB_Y, KNOB_RING = 107.0, KEY_Y, 15.2   # the knob on top, in the keys' row; its ring's rim
STAND_X, STAND_Y, STAND_TURN = 252.0, 12.0, math.radians(-18.0)
SLOT_DY, SLOT_DZ, TREAD0 = 18.0, 20.0, 12.0   # each slot further back and higher than the last
SLOT_TILT = math.radians(15.0)                # the rack's discs lean back
CASE_X, CASE_Y = -238.0, 34.0
CASE_LEAN, CASE_TURN = math.radians(8.0), math.radians(-5.0)
EASEL_T = 3.0

FRONT = (math.radians(90), 0.0, 0.0)                # local z toward the viewer (-y), local y up
BACK = (math.radians(-90), 0.0, 0.0)                # local z away from the viewer (+y)
SIDE = (math.radians(90), 0.0, math.radians(90))    # local x back (+y), y up, z right (+x)


# ------------------------------------------------------------------ helpers
def fslab(name, outlines, y0, y1, mats, bevel_mm=0.0, res=3, x=0.0, z=0.0, parent=None):
    """A flat shape standing up, facing the viewer: `outlines` in (x, z) mm round (x, z), filled
    from y0 to y1 (mm, in its parent's frame)."""
    return slab(name, outlines, -y1, -y0, mats, bevel_mm=bevel_mm, res=res, parent=parent,
                loc=L(x, 0.0, z), rot=FRONT)


def sslab(name, outlines, x0, x1, mats, bevel_mm=0.0, res=3, parent=None):
    """A side profile: `outlines` in (y, z) mm, filled across from x0 to x1."""
    return slab(name, outlines, x0, x1, mats, bevel_mm=bevel_mm, res=res, parent=parent, rot=SIDE)


def ylathe(name, prof, mats, x, y, z, toward=-1, seg=96, **kw):
    """A lathe whose axis runs along y through (x, z): its profile's (r, d), d mm from y toward the
    viewer (toward=-1) or away from it (toward=+1)."""
    return lathe(name, prof, mats, seg=seg, loc=L(x, y, z), rot=FRONT if toward < 0 else BACK, **kw)


def xlathe(name, prof, mats, x, y, z, toward=1, seg=64, **kw):
    """A lathe along x: its profile's (r, d), d mm from x toward +x (toward=1) or -x."""
    return lathe(name, prof, mats, seg=seg, loc=L(x, y, z),
                 rot=(0.0, math.radians(90 if toward > 0 else -90), 0.0), **kw)


def strip_mesh(name, rows, mats, thick=0.16, **kw):
    """A flat strip through `rows`, each a pair of points (mm) across it, given `thick` mm by
    solidify: what band() and flex_strip() build once each has found its points' side vectors."""
    bm = bmesh.new()
    verts = [(bm.verts.new(a * MM), bm.verts.new(b * MM)) for a, b in rows]
    for (a0, b0), (a1, b1) in zip(verts, verts[1:]):
        bm.faces.new((a0, b0, b1, a1))
    ob = from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)
    solidify(ob, thick)
    return ob


def band(name, pts, width, mats, up=(0.0, 1.0, 0.0), side=None, thick=0.16, **kw):
    """A flat strip `width` mm wide along the points (mm): a flex cable. Its width runs along `side`
    when given, else across the path and `up`, so its face turns toward `up` (the viewer's axis by
    default)."""
    P = [Vector(p) for p in pts]
    U = Vector(up)
    rows = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        s = Vector(side) if side else t.cross(U)
        s = s.normalized() if s.length > 1e-6 else Vector((1.0, 0.0, 0.0))
        rows.append((p - s * (width / 2), p + s * (width / 2)))
    return strip_mesh(name, rows, mats, thick, **kw)


def flex_strip(name, keys, width, mats, n=6, thick=0.16, **kw):
    """A flex cable through `keys` [((x, y, z), face normal), ...] (mm): a smooth path whose face
    turns from each key's normal to the next, so it can fold and twist as a real one does."""
    pts = smooth_path([k[0] for k in keys], n)
    normals = []
    for i in range(len(keys) - 1):
        a, b = Vector(keys[i][1]).normalized(), Vector(keys[i + 1][1]).normalized()
        normals += [(a.lerp(b, j / n)).normalized() for j in range(n)]
    normals.append(Vector(keys[-1][1]).normalized())
    P = [Vector(p) for p in pts]
    rows = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        s = normals[i].cross(t)
        s = s.normalized() if s.length > 1e-6 else Vector((0.0, 0.0, 1.0))
        rows.append((p - s * (width / 2), p + s * (width / 2)))
    return strip_mesh(name, rows, mats, thick, **kw)


def resample(pts, step):
    """Points every `step` mm along a polyline (mm)."""
    P = [Vector(p) for p in pts]
    out = [P[0]]
    left = step
    for a, b in zip(P, P[1:]):
        seg = (b - a).length
        pos = 0.0
        while seg - pos >= left:
            pos += left
            out.append(a + (b - a) * (pos / seg))
            left = step
        left -= seg - pos
    if (out[-1] - P[-1]).length > 1e-6:
        out.append(P[-1])
    return out


def wire_pair(name, pts, mats, r=0.55, pitch=7.0, **kw):
    """Two insulated wires twisted round each other along the (mm) points: mats[0] and mats[1]."""
    path = resample(smooth_path(pts, 8), 2.2 if WEB else 1.0)
    t0 = (path[1] - path[0]).normalized()
    n = t0.cross(Vector((0.0, 0.0, 1.0)))
    if n.length < 1e-6:
        n = t0.cross(Vector((1.0, 0.0, 0.0)))
    n.normalize()
    frames = []
    s = 0.0
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        n = (n - t * n.dot(t)).normalized()  # parallel transport: the twist never flips
        if i:
            s += (p - path[i - 1]).length
        frames.append((p, n, t.cross(n), s))
    for k, m in enumerate(mats):
        line = []
        for p, nn, bb, ss in frames:
            a = 2 * math.pi * ss / pitch + math.pi * k
            line.append(tuple(p + (nn * math.cos(a) + bb * math.sin(a)) * (r * 1.02)))
        tube("%s_%d" % (name, k), line, r, m, res=1, **kw)


def capsule(c1, r1, c2, r2, seg=24):
    """The outline round two circles (mm): their convex hull."""
    a, b = Vector(c1), Vector(c2)
    d = b - a
    th = math.atan2(d.y, d.x)
    ph = math.acos(max(-1.0, min(1.0, (r1 - r2) / d.length)))
    pts = []
    for i in range(seg + 1):  # round the far side of the first circle
        ang = th + ph + (2 * math.pi - 2 * ph) * i / seg
        pts.append((a.x + r1 * math.cos(ang), a.y + r1 * math.sin(ang)))
    for i in range(seg + 1):  # and the near side of the second
        ang = th - ph + 2 * ph * i / seg
        pts.append((b.x + r2 * math.cos(ang), b.y + r2 * math.sin(ang)))
    return pts


def sector(r0, r1, a0, a1, seg=16, cx=0.0, cy=0.0):
    """An annular sector (mm, degrees), as one outline."""
    outer = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / seg)),
              cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / seg))) for i in range(seg + 1)]
    inner = [(cx + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / seg)),
              cy + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / seg))) for i in range(seg + 1)]
    return outer + inner


def world_of(parent_loc_mm, rot, local_mm):
    """A point (mm) of a frame at parent_loc_mm turned by rot (Euler)."""
    v = Euler(rot).to_matrix() @ Vector(local_mm)
    return tuple(Vector(parent_loc_mm) + v)


def screw_head(name, x, y, z, root, r=2.6, toward=-1, slot=35.0):
    """A pan head with a cross recess, its underside at y, facing the viewer (toward=-1)."""
    ylathe(name, [(0.01, 0), (r, 0), (r, 0.35), (r * 0.86, 0.9), (0.01, 1.05)], M["chrome"], x, y, z,
           toward=toward, seg=32, parent=root)
    for k in range(2):
        cross = rbox("%s_x%d" % (name, k), (r * 1.15, r * 0.24, 0.3), M["ink_dark"], parent=root,
                     loc=L(x, y + toward * 0.95, z))
        cross.rotation_euler = (math.radians(90), math.radians(slot + 90 * k), 0.0)


# Paths on a face, (x, z) mm: the board's traces (clear_board.py) and the decorations' lines
# (clear_decor.py) are drawn with these.
def offset_path(pts, d, closed=False):
    """The polyline (x, z) moved d mm to its left (to its right when negative), its corners
    mitred, so a bus's lines stay parallel through every bend (in doubles: mathutils' floats
    would bend a 45-degree run off by a micron)."""
    n = len(pts)
    out = []
    for i in range(n):
        normals = []
        for a, b in ((i - 1, i), (i, i + 1)):
            if (a >= 0 and b < n) or closed:
                (ax, az), (bx, bz) = pts[a % n], pts[b % n]
                length = math.hypot(bx - ax, bz - az)
                normals.append((-(bz - az) / length, (bx - ax) / length))
        mx, mz = normals[0][0] + normals[-1][0], normals[0][1] + normals[-1][1]
        ml = math.hypot(mx, mz)
        s = d / ((mx * normals[0][0] + mz * normals[0][1]) / ml)
        out.append((pts[i][0] + mx / ml * s, pts[i][1] + mz / ml * s))
    return out


def clip_segment(a, b, poly):
    """The segment ab (x, z) clipped to a convex counter-clockwise polygon, or None."""
    t0, t1 = 0.0, 1.0
    dx, dz = b[0] - a[0], b[1] - a[1]
    for (px, pz), (qx, qz) in zip(poly, poly[1:] + poly[:1]):
        nx, nz = pz - qz, qx - px                        # the edge's inward normal
        num = nx * (a[0] - px) + nz * (a[1] - pz)
        den = nx * dx + nz * dz
        if abs(den) < 1e-12:
            if num < 0:
                return None
            continue
        t = -num / den
        if den > 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 >= t1:
            return None
    return (a[0] + dx * t0, a[1] + dz * t0), (a[0] + dx * t1, a[1] + dz * t1)


def _ccw(outline):
    """An outline (x, z) wound counter-clockwise as the viewer sees the board, so its face faces
    the viewer."""
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(outline, outline[1:] + outline[:1]))
    return outline if area > 0 else outline[::-1]


def _point_segment(p, a, b):
    """The distance (mm) from p to the segment ab, (x, z) each."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    span = dx * dx + dz * dz
    t = 0.0 if span < 1e-12 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / span))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)


# ------------------------------------------------------------------ the body and the plinth
def grille_holes(r_max=19.0, pitch=4.4, hole=0.95):
    holes = [circle(hole, 12)]
    ring = 1
    while ring * pitch <= r_max:
        rr = ring * pitch
        n = int(round(2 * math.pi * rr / pitch))
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (ring % 2)) / n
            holes.append(circle(hole, 12, cx=rr * math.cos(a), cy=rr * math.sin(a)))
        ring += 1
    return holes


def clear_body(name, root):
    S = M["clear_shell"]
    outer = rrect(BODY_W, BODY_H, BODY_R, seg=12, cy=ZC)
    speakers = [circle(GRILLE_R, 96, cx=sx * SPK_X, cy=DOOR_Z) for sx in (-1, 1)]
    fslab(name + "_shell_front", [outer, circle(HOLE_R, 192, cy=DOOR_Z)] + speakers, FRONT_Y, IN_F, S,
          bevel_mm=1.2, parent=root)
    fslab(name + "_shell_back", [outer], IN_B, BACK_Y, S, bevel_mm=1.2, parent=root)
    # The sides, the top and the bottom: one hollow band between the plates.
    inner = rrect(BODY_W - 2 * SHELL_WALL, BODY_H - 2 * SHELL_WALL, BODY_R - SHELL_WALL, seg=12, cy=ZC)
    fslab(name + "_shell_band", [outer, inner], IN_F, IN_B, S, bevel_mm=0.5, parent=root)
    # The speakers' perforated inserts, set in the front plate's openings.
    for side, sx in (("l", -1), ("r", 1)):
        fslab("%s_grille_%s" % (name, side), [circle(GRILLE_R - 0.06, 96)] + grille_holes(), FRONT_Y + 0.35,
              IN_F - 0.35, S, bevel_mm=0.0 if WEB else 0.25, x=sx * SPK_X, z=DOOR_Z, parent=root)
    # The corner bosses and the screws that close the shell.
    for k, (x, z) in enumerate(SCREWS):
        ylathe("%s_boss_%d" % (name, k), [(1.7, 0), (4.4, 0), (4.4, IN_B - IN_F), (1.7, IN_B - IN_F)], S, x,
               IN_B, z, toward=-1, seg=32, parent=root)
        ylathe("%s_boss_screw_%d" % (name, k), [(0.01, 0), (1.45, 0), (1.45, 24.0), (0.01, 24.0)],
               M["chrome"], x, IN_F, z, toward=1, seg=16, parent=root)
        screw_head("%s_screw_%d" % (name, k), x, FRONT_Y - 0.02, z, root, slot=20.0 + 25.0 * k)
    # The plinth, in the frame's colour, on four rubber feet.
    plinth = slab(name + "_plinth", [rrect(PLINTH_W, PLINTH_D, 12.0, seg=10, cy=PLINTH_Y)], FOOT_H, PLINTH_H,
                  M["clear_frame"], bevel_mm=2.5, res=4, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe("%s_foot_%d%d" % (name, sx, sy), [(0.01, 0), (9.0, 0), (9.0, FOOT_H + 0.4), (0.01, FOOT_H + 0.4)],
                  M["rubber"], seg=32, parent=root,
                  loc=L(sx * (PLINTH_W / 2 - 24.0), PLINTH_Y + sy * (PLINTH_D / 2 - 20.0), 0.0))
    return plinth


def clear_plate(name, root, playlist):
    """The clear acrylic nameplate on the plinth's front, on two standoffs: the ncam logo engraved
    at its left, the print (`<name>_plate_print`, the page's card_print) or, in a render, NOW
    SPINNING and the collection on a brushed strip."""
    y_face = PLINTH_Y - PLINTH_D / 2
    zc = (FOOT_H + PLINTH_H) / 2
    front = y_face - 3.6
    fslab(name + "_plate", [rrect(164.0, 20.0, 2.5)], front, y_face - 0.6, M["door_glass"], bevel_mm=0.6,
          z=zc, parent=root)
    for k, x in enumerate((-75.0, 75.0)):
        ylathe("%s_plate_post_%d" % (name, k), [(0.01, 0), (2.4, 0), (2.4, 0.62), (0.01, 0.62)], M["chrome"],
               x, y_face, zc, toward=-1, seg=24, parent=root)
        ylathe("%s_plate_cap_%d" % (name, k), [(0.01, 0), (2.3, 0), (2.2, 0.5), (1.6, 0.95), (0.01, 1.1)],
               M["alu_side"], x, front - 0.02, zc, toward=-1, seg=24, parent=root)
    text(name + "_plate_logo", "ncam", 7.0, M["ink"], font="futura", parent=root,
         loc=L(-54.0, front - 0.03, zc - 0.5), rot=FRONT)
    # The print: 106 x 18.8 mm, the aspect of the page's 1024 x 182 canvas (paintCard).
    px = 15.0
    if WEB:
        rbox(name + "_plate_print", (106.0, 18.8, 0.05), M["card_print"], parent=root,
             loc=L(px, front - 0.04, zc), rot=FRONT)
    else:
        rbox(name + "_plate_field", (106.0, 15.4, 0.3), M["alu_side"], bevel_mm=0.1, parent=root,
             loc=L(px, front - 0.16, zc), rot=FRONT)
        text(name + "_plate_t1", "NOW SPINNING", 2.3, M["ink"], font="avenir", parent=root,
             loc=L(px, front - 0.33, zc + 4.1), rot=FRONT)
        text(name + "_plate_t2", playlist, 4.8, M["ink_dark"], font="futura", parent=root,
             loc=L(px, front - 0.33, zc - 2.0), rot=FRONT)


# ------------------------------------------------------------------ the door
def clear_door(name, root):
    """The round door, hinged on its left: its hinge empty's local Z is Blender's up, which the
    glTF export turns into three's Y, the axis the page turns it about (a negative turn swings it
    out toward the viewer). It holds the bezel, the glass, the pull and the door's knuckle."""
    F = M["clear_frame"]
    hinge = empty(name + "_door", L(HINGE_X, HINGE_Y, DOOR_Z), parent=root)
    cx = -HINGE_X                     # the door's centre, from its hinge
    back = FRONT_Y - HINGE_Y - 0.02   # the bezel's back face, just off the front plate
    ylathe(name + "_door_bezel", [(BEZEL_IN, 0), (DOOR_R, 0), (DOOR_R, DOOR_T - 1.1), (DOOR_R - 1.1, DOOR_T),
                                  (BEZEL_IN + 0.8, DOOR_T), (BEZEL_IN, DOOR_T - 0.8)], F, cx, back, 0.0,
           toward=-1, seg=192, parent=hinge)
    fslab(name + "_door_glass", [circle(GLASS_R, 192)], back - DOOR_T + 1.1, back - 1.0, M["door_glass"],
          bevel_mm=0.5, x=cx, parent=hinge)
    face = back - DOOR_T - 0.02
    text(name + "_bezel_logo", "ncam", 3.4, M["ink"], font="futura", parent=hinge,
         loc=L(cx, face, -(BEZEL_IN + 0.8 + DOOR_R - 1.1) / 2), rot=FRONT)
    rbox(name + "_door_pull", (6.0, DOOR_T - 1.2, 15.0), F, bevel_mm=1.4, parent=hinge,
         loc=L(cx + DOOR_R + 1.8, back - DOOR_T / 2, 0.0))
    # The hinge: the door's knuckle between two on the front plate, one pin through all three.
    lathe(name + "_door_knuckle", [(0.01, -6.4), (3.0, -6.4), (3.0, 6.4), (0.01, 6.4)], F, seg=32, parent=hinge)
    rbox(name + "_door_lug", (6.5, 4.0, 11.0), F, bevel_mm=0.8, parent=hinge, loc=L(3.6, 0.0, 0.0))
    for k, s in enumerate((-1, 1)):
        lathe("%s_hinge_knuckle_%d" % (name, k), [(0.01, 7.0), (3.0, 7.0), (3.0, 19.0), (0.01, 19.0)], F, seg=32,
              parent=root, loc=L(HINGE_X, HINGE_Y, DOOR_Z), rot=(0.0, 0.0, 0.0) if s > 0 else (math.pi, 0.0, 0.0))
        rbox("%s_hinge_leaf_%d" % (name, k), (7.0, FRONT_Y - HINGE_Y - 0.04, 12.0), F, bevel_mm=0.5, parent=root,
             loc=L(HINGE_X + 0.8, (HINGE_Y + FRONT_Y) / 2 - 0.02, DOOR_Z + s * 13.0))
    lathe(name + "_hinge_pin", [(0.01, -20.0), (1.2, -20.0), (1.6, -19.6), (1.6, 19.6), (1.2, 20.0), (0.01, 20.0)],
          M["chrome"], seg=24, parent=root, loc=L(HINGE_X, HINGE_Y, DOOR_Z))
    return hinge


def clear_light_ring(name, root):
    """The light ring round the disc, just behind the front plate's opening (the light's colour)."""
    ylathe(name + "_light_ring", [(61.3, 0), (65.4, 0), (65.4, 2.2), (64.8, 2.8), (61.9, 2.8), (61.3, 2.2)],
           M["light"], 0.0, IN_F + 0.03, DOOR_Z, toward=1, seg=192, parent=root)


# ------------------------------------------------------------------ the disc, the spindle and the motor
def clear_disc(name, root, disc_label):
    """The disc stands behind the door, its label to the viewer, on the spindle: the turntable
    behind it, the post through its hole with three balls in front, the motor further back."""
    disc = make_disc(name + "_disc", disc_label, L(0, DISC_Y, DOOR_Z), rot=FRONT, parent=root)
    back = DISC_Y + 0.6
    ylathe(name + "_turntable", [(0.01, 0.5), (12.4, 0.5), (12.4, 2.4), (11.6, 3.0), (0.01, 3.0)],
           M["hub_black"], 0.0, back, DOOR_Z, toward=1, seg=96, parent=root)
    ylathe(name + "_turntable_pad", [(8.6, 0.0), (12.0, 0.0), (12.0, 0.5), (8.6, 0.5)], M["rubber"], 0.0,
           back + 0.02, DOOR_Z, toward=1, seg=96, parent=root)
    ylathe(name + "_spindle", [(0.01, 0.0), (7.3, 0.0), (7.3, 4.2), (6.6, 4.9), (2.4, 5.1), (0.01, 5.15)],
           M["chrome"], 0.0, DISC_Y + 2.0, DOOR_Z, toward=-1, seg=64, parent=root)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.4
        sphere("%s_ball_%d" % (name, k), 0.9, M["chrome"], seg=12 if WEB else 24, parent=root,
               loc=L(7.15 * math.cos(a), DISC_Y - 0.6 - 1.0, DOOR_Z + 7.15 * math.sin(a)))
    return disc


def clear_motor(name, root):
    """The spindle motor behind the turntable: the rotor's bell, nine copper coils round the stator
    (they show through the disc's clear middle), its small board."""
    y = DISC_Y + 0.6 + 3.0
    ylathe(name + "_motor_bell", [(0.01, 0), (8.8, 0), (8.8, 3.0), (8.2, 3.6), (0.01, 3.6)], M["chrome"], 0.0,
           y, DOOR_Z, toward=1, seg=64, parent=root)
    yc = y + 3.6 + 3.0
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.17
        rbox("%s_coil_%d" % (name, k), (6.6, 5.4, 4.4), M["copper"], bevel_mm=1.2, parent=root,
             loc=L(12.7 * math.cos(a), yc, DOOR_Z + 12.7 * math.sin(a)), rot=(0.0, -a, 0.0))
    ylathe(name + "_stator", [(0.01, -2.7), (9.6, -2.7), (9.6, 2.7), (0.01, 2.7)], M["magnet"], 0.0, yc, DOOR_Z,
           toward=1, seg=36, parent=root)
    ylathe(name + "_motor_board", [(0.01, 0), (19.0, 0), (19.0, 1.2), (0.01, 1.2)], M["board"], 0.0, yc + 2.8,
           DOOR_Z, toward=1, seg=48, parent=root)


def clear_chassis(name, root):
    """The mechanism's plate behind the motor and the arm, standing off the back plate."""
    c1, c2 = (0.0, DOOR_Z), (ARM_X, ARM_Z)
    holes = [circle(3.2, 20, cx=c1[0], cy=c1[1])]
    for t, r in ((0.42, 4.6), (0.66, 3.6)):
        holes.append(circle(r, 24, cx=c1[0] + (c2[0] - c1[0]) * t, cy=c1[1] + (c2[1] - c1[1]) * t))
    fslab(name + "_chassis", [capsule(c1, 25.0, c2, 15.0)] + holes, CHASSIS_Y, CHASSIS_Y + 1.5, M["magnet"],
          bevel_mm=0.4, parent=root)
    posts = ((17.0, DOOR_Z + 15.0), (-19.0, DOOR_Z - 9.0), (ARM_X + 9.0, ARM_Z + 8.0))
    for k, (x, z) in enumerate(posts):
        ylathe("%s_chassis_post_%d" % (name, k), [(0.01, 0), (2.8, 0), (2.8, IN_B - CHASSIS_Y - 1.5),
                                                   (0.01, IN_B - CHASSIS_Y - 1.5)], M["clear_shell"], x,
               CHASSIS_Y + 1.5, z, toward=1, seg=24, parent=root)
        screw_head("%s_chassis_screw_%d" % (name, k), x, CHASSIS_Y - 0.02, z, root, r=2.0, slot=10.0 + 40 * k)


# ------------------------------------------------------------------ the swing arm
def clear_arm(name, root, playing=False):
    """The laser on its swing arm, behind the disc: the pivot's local Z runs along the disc's
    normal toward the viewer (three's Y after export), so the page turns it about its own Y. At
    rest the lens stands 6 mm off the disc's rim; turned +0.52 rad about three's Y (ARM_PLAY,
    -30 degrees about Blender's world Y) it is 38 mm from the centre, over the music."""
    pivot = empty(name + "_arm", L(ARM_X, ARM_Y, ARM_Z), rot=(math.radians(90), ARM_PLAY if playing else 0.0, 0.0),
                  parent=root)
    A = M["alu_side"]
    arm = [(7.0 * math.cos(math.radians(a)), 7.0 * math.sin(math.radians(a))) for a in range(180, 361, 15)]
    arm += [(4.6, ARM_LEN)] + [(4.6 * math.cos(math.radians(a)), ARM_LEN + 4.6 * math.sin(math.radians(a)))
                               for a in range(15, 180, 15)] + [(-4.6, ARM_LEN)]
    slot = rrect(3.6, 22.0, 1.8, cy=ARM_LEN * 0.5)
    slab(name + "_arm_beam", [arm, slot, circle(1.75, 20)], -1.2, 1.2, A, bevel_mm=0.45, parent=pivot)
    # The other end: a slim spoke out to the voice coil, which swings in the magnet's gap.
    tail = [(-1.7, -6.4), (-1.7, -18.8), (-5.8, -18.8), (-5.8, -26.4), (5.8, -26.4), (5.8, -18.8), (1.7, -18.8),
            (1.7, -6.4)]
    slab(name + "_arm_tail", [tail], -1.0, 1.0, A, bevel_mm=0.4, parent=pivot)
    rbox(name + "_arm_coil", (8.4, 5.6, 5.2), M["copper"], bevel_mm=1.3, parent=pivot, loc=L(0, -22.6, 0))
    # The optical block at the tip, its lens toward the disc.
    rbox(name + "_arm_sled", (12.0, 12.5, 6.0), M["chip"], bevel_mm=0.8, parent=pivot, loc=L(0, ARM_LEN + 0.8, 1.2))
    lathe(name + "_arm_lens_ring", [(2.5, 0), (3.7, 0), (3.7, 0.5), (2.5, 0.5)], M["chrome"], seg=32,
          parent=pivot, loc=L(0, ARM_LEN + 1.6, 4.2))
    lathe(name + "_arm_lens", [(0.01, 0), (2.5, 0), (2.4, 0.6), (1.7, 1.1), (0.01, 1.3)], M["black_glass"],
          seg=32, parent=pivot, loc=L(0, ARM_LEN + 1.6, 4.2))
    for k, x in enumerate((-4.9, 4.9)):
        rbox("%s_arm_focus_%d" % (name, k), (1.8, 4.2, 1.4), M["copper"], bevel_mm=0.3, parent=pivot,
             loc=L(x, ARM_LEN + 1.6, 4.9))
    rbox(name + "_arm_flex", (6.0, ARM_LEN - 10.0, 0.16), M["flex"], parent=pivot,
         loc=L(0, (ARM_LEN - 10.0) / 2 + 3.0, -1.36))
    # Fixed to the chassis: the pivot's bearing, its cap, the magnet's two plates round the coil.
    depth = CHASSIS_Y - (ARM_Y + 1.6) + 0.05
    ylathe(name + "_arm_bearing", [(0.01, 0), (6.0, 0), (6.0, depth - 0.6), (6.6, depth), (0.01, depth)],
           M["hub_black"], ARM_X, ARM_Y + 1.6, ARM_Z, toward=1, seg=40, parent=root)
    ylathe(name + "_arm_cap", [(0.01, -4.0), (1.6, -4.0), (1.6, 0.0), (2.6, 0.0), (2.6, 0.6), (2.0, 1.2),
                               (0.01, 1.3)], M["chrome"], ARM_X, ARM_Y - 1.22, ARM_Z, toward=-1, seg=32, parent=root)
    # The coil swings from 270 degrees (at rest, straight down) to 300 (playing): the posts that
    # join the plates stand clear of it at either end.
    for k, (y0, y1) in enumerate(((ARM_Y - 5.2, ARM_Y - 3.9), (ARM_Y + 3.9, ARM_Y + 5.2))):
        fslab("%s_arm_yoke_%d" % (name, k), [sector(18.4, 27.0, 240.0, 326.0, seg=14)], y0, y1, M["magnet"],
              bevel_mm=0.3, x=ARM_X, z=ARM_Z, parent=root)
        fslab("%s_arm_magnet_%d" % (name, k), [sector(19.4, 26.0, 254.0, 312.0, seg=12)],
              y1 if k == 0 else y0 - 1.0, y1 + 1.0 if k == 0 else y0, M["chrome"], bevel_mm=0.2, x=ARM_X, z=ARM_Z,
              parent=root)
    for k, a in enumerate((247.0, 318.5)):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        lathe("%s_arm_yoke_post_%d" % (name, k), [(0.01, -3.9), (2.2, -3.9), (2.2, 3.9), (0.01, 3.9)], M["magnet"],
              seg=20, parent=root, loc=L(ARM_X + 22.5 * ca, ARM_Y, ARM_Z + 22.5 * sa), rot=FRONT)
        screw_head("%s_arm_yoke_screw_%d" % (name, k), ARM_X + 22.5 * ca, ARM_Y - 5.22, ARM_Z + 22.5 * sa, root,
                   r=1.5, slot=20.0 + 50 * k)
    rbox(name + "_arm_stop", (4.0, 3.0, 4.0), M["rubber"], bevel_mm=1.0, parent=root,
         loc=L(ARM_X + 8.5, ARM_Y + 2.4, ARM_Z + 6.0))
    return pivot


# ------------------------------------------------------------------ the mechanism, the cells, the wires
def clear_mechanism(name, root, playing=False):
    """The motor, the mechanism's plate, the flex from the laser to the board, the four AA cells
    across the back under the top, the twisted wires to the board."""
    clear_motor(name, root)
    clear_chassis(name, root)
    # The flex from the arm's pivot: out to the right in front of its bearing, folded back past the
    # mechanism's plate, twisted and down into its connector on the board.
    start = world_of((ARM_X, ARM_Y, ARM_Z), (math.radians(90), ARM_PLAY if playing else 0.0, 0.0), (0.0, 3.0, -1.36))
    y = start[1]
    viewer, left = (0.0, -1.0, 0.0), (-1.0, 0.0, 0.0)
    flex_strip(name + "_flex", [(start, viewer), ((ARM_X + 8.0, y - 0.05, ARM_Z + 3.4), viewer),
                                ((ARM_X + 16.5, y + 0.9, ARM_Z + 3.6), (-0.7, -0.7, 0.0)),
                                ((ARM_X + 19.2, y + 4.6, ARM_Z + 2.6), left),
                                ((ARM_X + 19.8, CHASSIS_Y + 4.0, ARM_Z - 0.6), left),
                                ((87.0, FACE_Y - 6.5, BOARD_Z1 + 3.0), (-0.5, -0.86, 0.0)),
                                ((88.0, FACE_Y - 2.2, BOARD_Z1 - 2.6), viewer)], 6.6, M["flex"], parent=root)
    clear_cells(name, root)
    red, black = M["wire_red"], M["rubber"]
    # The cells' pair down the left, between the disc and the left speaker, into J1.
    wire_pair(name + "_wire_cells", [(-58.5, 9.0, CELL_Z - 2.0), (-66.0, 12.0, CELL_Z - 12.0), (-76.0, 14.0, 190.0),
                                     (-80.0, 13.0, 130.0), (-90.0, 9.0, 96.0), (-102.0, FACE_Y - 3.6, BOARD_Z1 + 1.0),
                                     (-102.0, FACE_Y - 4.0, 82.6)], [red, black])
    # Each speaker's pair, from its terminals down into J2 and J4.
    for side, sx, jx in (("l", -1, -126.0), ("r", 1, 112.0)):
        x = sx * SPK_X
        wire_pair("%s_wire_%s" % (name, side), [(x, IN_F + 5.0, DOOR_Z - SPK_R - 3.5),
                                                 (x + sx * 4.0, -16.0, DOOR_Z - SPK_R - 14.0),
                                                 ((x + jx) / 2 + sx * 3.0, -4.0, BOARD_Z1 + 6.0),
                                                 (jx, FACE_Y - 3.8, BOARD_Z1 + 0.6), (jx, FACE_Y - 4.0, 82.8)],
                  [red, black])


CELL_R, CELL_L = 7.25, 50.5
CELL_Z = Z1 - SHELL_WALL - CELL_R - 1.0
CELL_ROWS = (4.8, 20.6)


def clear_cells(name, root):
    """Four AA cells in a clear tray across the back, under the top: two rows of two, end to end."""
    T = M["door_glass"]
    y0, y1 = CELL_ROWS[0] - CELL_R - 1.2, CELL_ROWS[1] + CELL_R + 1.2
    yc = (y0 + y1) / 2
    zb = CELL_Z - CELL_R - 0.25
    slab(name + "_cells_tray", [rrect(118.0, y1 - y0, 3.0, cy=yc)], zb - 1.6, zb, T, bevel_mm=0.5, parent=root)
    for k, x in enumerate((-57.8, 0.0, 57.8)):
        rbox("%s_cells_wall_%d" % (name, k), (2.0, y1 - y0, 13.0), T, bevel_mm=0.5, parent=root,
             loc=L(x, yc, zb + 6.5))
    for row, y in enumerate(CELL_ROWS):
        for k, (x, toward) in enumerate(((-56.2, 1), (56.2, -1))):
            # Each cell from its flat (negative) end against a spring, its nub at the middle wall.
            tag = "%s_cell_%d%d" % (name, row, k)
            xlathe(tag, [(0.01, 0.0), (6.7, 0.0), (7.25, 0.55), (7.25, CELL_L - 0.55), (6.7, CELL_L), (0.01, CELL_L)],
                   M["cell"], x + toward * 2.6, y, CELL_Z, toward=toward, seg=40, parent=root)
            xlathe(tag + "_end", [(0.01, 0.0), (6.4, 0.0), (6.4, 0.08), (0.01, 0.08)], M["solder"],
                   x + toward * 2.58, y, CELL_Z, toward=-toward, seg=32, parent=root)
            xlathe(tag + "_top", [(6.9, 0.0), (7.3, 0.0), (7.3, 15.0), (6.9, 15.0)], M["solder"],
                   x + toward * (2.6 + CELL_L - 15.4), y, CELL_Z, toward=toward, seg=40, parent=root)
            xlathe(tag + "_nub", [(0.01, 0.0), (2.7, 0.0), (2.7, 1.3), (2.3, 1.6), (0.01, 1.6)], M["solder"],
                   x + toward * (2.6 + CELL_L), y, CELL_Z, toward=toward, seg=24, parent=root)
            # The spring at the flat end: a coil from the wall to the cell.
            turns = 3 if WEB else 5
            pts = []
            for i in range(turns * (8 if WEB else 14) + 1):
                a = 2 * math.pi * i / (8 if WEB else 14)
                pts.append((x + toward * (0.2 + 2.2 * i / (turns * (8 if WEB else 14))),
                            y + 3.2 * math.cos(a), CELL_Z + 3.2 * math.sin(a)))
            tube(tag + "_spring", pts, 0.38, M["solder"], res=1, parent=root)
            rbox(tag + "_plate", (0.3, 8.0, 8.0), M["solder"], parent=root,
                 loc=L(x + toward * (2.6 + CELL_L + 1.6 + 0.4), y, CELL_Z))


# ------------------------------------------------------------------ the speakers
def clear_speakers(name, root):
    """A speaker either side of the door, behind the front plate's perforated inserts: the
    basket's rim screwed to the plate, the rubber surround, the frame-coloured cone and its dust
    cap, the spokes, the magnet behind showing through the shell, two terminals."""
    for side, sx in (("l", -1), ("r", 1)):
        x = sx * SPK_X
        tag = "%s_spk_%s" % (name, side)
        ylathe(tag + "_rim", [(26.1, 0), (SPK_R, 0), (SPK_R, 1.0), (26.1, 1.0)], M["magnet"], x, IN_F + 0.05, DOOR_Z,
               toward=1, seg=96, parent=root)
        y = IN_F + 2.6   # the surround's foot
        ylathe(tag + "_surround", [(25.8, 0), (25.6, 0.8), (25.0, 1.45), (24.0, 1.75), (23.0, 1.45), (22.4, 0.8),
                                   (22.2, 0), (22.2, -0.4), (25.8, -0.4)], M["surround"], x, y, DOOR_Z, toward=-1,
               seg=96, parent=root)
        ylathe(tag + "_cone", [(22.3, 0.0), (15.5, -2.4), (8.6, -6.0), (8.6, -6.6), (15.5, -2.95), (22.3, -0.5)],
               M["clear_frame"], x, y, DOOR_Z, toward=-1, seg=96, parent=root)
        ylathe(tag + "_cap", [(0.01, -6.0 + 2.6), (3.4, -6.0 + 2.4), (6.1, -6.0 + 1.6), (8.4, -6.0 + 0.35),
                              (8.7, -6.0), (8.7, -6.4), (0.01, -6.4)], M["hub_black"], x, y, DOOR_Z, toward=-1,
               seg=64, parent=root)
        # The magnet: front plate, ring, back plate, pole.
        ylathe(tag + "_pole_plate", [(5.4, 0), (14.0, 0), (14.0, 1.2), (5.4, 1.2)], M["chrome"], x, y + 7.2, DOOR_Z,
               toward=1, seg=64, parent=root)
        ylathe(tag + "_magnet", [(6.2, 0), (15.5, 0), (15.5, 6.0), (6.2, 6.0)], M["magnet"], x, y + 8.4, DOOR_Z,
               toward=1, seg=64, parent=root)
        ylathe(tag + "_back_plate", [(0.01, 0), (15.0, 0), (15.0, 1.4), (14.4, 2.0), (0.01, 2.0)], M["chrome"], x,
               y + 14.4, DOOR_Z, toward=1, seg=64, parent=root)
        ylathe(tag + "_pole", [(0.01, 0), (5.0, 0), (5.0, 7.0), (0.01, 7.0)], M["chrome"], x, y + 14.4, DOOR_Z,
               toward=-1, seg=32, parent=root)
        for k in range(4):
            a = math.radians(45 + 90 * k)
            ca, sa = math.cos(a), math.sin(a)
            tube("%s_spoke_%d" % (tag, k), [(x + 27.4 * ca, IN_F + 1.0, DOOR_Z + 27.4 * sa),
                                            (x + 24.0 * ca, IN_F + 3.6, DOOR_Z + 24.0 * sa),
                                            (x + 14.6 * ca, y + 7.4, DOOR_Z + 14.6 * sa)], 0.9, M["magnet"], res=1,
                 parent=root)
            screw_head("%s_screw_%d" % (tag, k), x + 27.6 * ca, FRONT_Y - 0.02, DOOR_Z + 27.6 * sa, root, r=1.6,
                       slot=30.0 * k)
        for k, dx in enumerate((-4.0, 4.0)):
            rbox("%s_tab_%d" % (tag, k), (2.4, 0.4, 5.0), M["solder"], parent=root,
                 loc=L(x + dx, IN_F + 5.0, DOOR_Z - SPK_R - 1.8))


# ------------------------------------------------------------------ the top: keys, handle, tag
def clear_keys(name, root, playing=False):
    """Six keys in a frame-coloured deck on top: each key an empty (the page sinks it 1.2 mm), a
    clear stem under a frame-coloured cap, its icon lit in the light's colour. The play key's cap
    carries ▶ and ‖ in the web build (the page shows one at a time); a render prints the one its
    state shows, ‖ while it plays."""
    top = Z1
    F = M["clear_frame"]
    holes = [rrect(KEY_HOLE_W, KEY_HOLE_D, KEY_HOLE_R, cx=(i - 2.5) * KEY_PITCH, cy=KEY_Y) for i in range(len(KEYS))]
    slab(name + "_key_deck", [rrect(DECK_W, DECK_D, DECK_R, cy=KEY_Y)] + holes, top + 0.05, top + 2.05, F, bevel_mm=0.6,
         parent=root)

    def scaled(shapes):
        """button_icon's outlines, mm round the cap's centre, at these caps' size."""
        return [[(px * 1.25, py * 1.25) for px, py in shape] for shape in shapes]
    for i, kind in enumerate(KEYS):
        key = empty("%s_btn_%s" % (name, kind), L((i - 2.5) * KEY_PITCH, KEY_Y, top), parent=root)
        rbox("%s_btn_%s_stem" % (name, kind), (12.0, 8.4, 3.35), M["door_glass"], bevel_mm=0.6, parent=key,
             loc=L(0, 0, 0.15 + 3.35 / 2))
        rbox("%s_btn_%s_cap" % (name, kind), (18.0, 14.0, 5.0), F, bevel_mm=1.5, parent=key, loc=L(0, 0, 3.45 + 2.5))
        icon = button_icon(kind)
        if icon:  # printed on the cap's top
            if kind == "play":
                if WEB or not playing:
                    slab("%s_btn_play_icon_play" % name, scaled(icon), 8.47, 8.57, M["light"], parent=key)
                if WEB or playing:
                    slab("%s_btn_play_icon_pause" % name, scaled(button_icon("pause")), 8.47, 8.57, M["light"],
                         parent=key)
            else:
                slab("%s_btn_%s_icon" % (name, kind), scaled(icon), 8.47, 8.57, M["light"], parent=key)
        else:
            text("%s_btn_%s_word" % (name, kind), WORDS[kind], 3.6 if kind == "rpt" else 3.1, M["light"], font="din",
                 parent=key, loc=L(0, 0, 8.48))
    clear_key_board(name, root)


def clear_key_board(name, root):
    """Under the top, seen through it: the keys' own board, a tactile switch under each key, its
    ribbon folded off its right end and down behind the right speaker into J6 on the main board."""
    zb = Z1 - SHELL_WALL - 5.6
    slab(name + "_key_board", [rrect(172.0, 17.0, 2.0, cy=KEY_Y)], zb, zb + 1.6, M["board"], bevel_mm=0.2,
         parent=root)
    for i in range(len(KEYS)):
        x = (i - 2.5) * KEY_PITCH
        rbox("%s_key_switch_%d" % (name, i), (6.2, 6.2, 2.4), M["chip"], bevel_mm=0.3, parent=root,
             loc=L(x, KEY_Y, zb + 1.6 + 1.2))
        lathe("%s_key_plunger_%d" % (name, i), [(0.01, 0), (1.8, 0), (1.8, 0.8), (1.5, 0.95), (0.01, 0.95)],
              M["chrome"], seg=20, parent=root, loc=L(x, KEY_Y, zb + 1.6 + 2.4))
        for j, (dx, dy) in enumerate(((-3.6, -2.2), (3.6, -2.2), (-3.6, 2.2), (3.6, 2.2))):
            rbox("%s_key_switch_%d_leg_%d" % (name, i, j), (1.2, 0.7, 0.3), M["solder"], parent=root,
                 loc=L(x + dx, KEY_Y + dy, zb + 1.75))
    rbox(name + "_key_board_jack", (9.0, 4.0, 2.2), M["chip"], bevel_mm=0.3, parent=root,
         loc=L(80.0, KEY_Y, zb + 1.6 + 1.1))
    # Along under the top to the right, then down behind the right speaker (clear of the corner
    # boss), facing in, and twisted into J6.
    up, viewer, inward = (0.0, 0.0, 1.0), (0.0, -1.0, 0.0), (-1.0, 0.0, 0.0)
    flex_strip(name + "_key_ribbon", [((84.0, KEY_Y, zb + 1.75), up), ((100.0, KEY_Y + 1.0, zb + 0.9), up),
                                       ((121.0, KEY_Y + 4.0, zb - 1.0), (-0.5, 0.0, 0.86)),
                                       ((128.0, -4.0, zb - 9.0), inward), ((128.5, -2.0, 120.0), inward),
                                       ((128.0, 1.5, 92.0), (-0.6, -0.8, 0.0)),
                                       ((128.0, FACE_Y - 2.2, BOARD_Z1 - 2.8), viewer)], 9.0, M["flex"], parent=root)


def clear_handle(name, root):
    """The carry handle across the top, behind the keys, on two mounts."""
    top = Z1
    F = M["clear_frame"]
    r = 12.0
    h = top + HANDLE_H
    pts = [(-HANDLE_X, HANDLE_Y, top + 3.0)]
    for i in range(9):
        a = math.radians(180 - 90 * i / 8)
        pts.append((-HANDLE_X + r + r * math.cos(a), HANDLE_Y, h - r + r * math.sin(a)))
    for i in range(9):
        a = math.radians(90 - 90 * i / 8)
        pts.append((HANDLE_X - r + r * math.cos(a), HANDLE_Y, h - r + r * math.sin(a)))
    pts.append((HANDLE_X, HANDLE_Y, top + 3.0))
    tube(name + "_handle", pts, 4.6, F, res=4, parent=root)
    for k, sx in enumerate((-1, 1)):
        x = sx * HANDLE_X
        rbox("%s_handle_mount_%d" % (name, k), HANDLE_MOUNT, F, bevel_mm=2.4, parent=root,
             loc=L(x, HANDLE_Y, top + 3.55))
        lathe("%s_handle_collar_%d" % (name, k), [(4.4, 0), (6.0, 0), (6.0, 1.6), (5.4, 2.2), (4.4, 2.2)],
              M["chrome"], seg=32, parent=root, loc=L(x, HANDLE_Y, top + 7.0))


TAG_X, TAG_Z = 112.0, Z1 - 32.5   # between the right speaker's rim and the top
TAG_ROT = (math.radians(90), math.radians(4.0), 0.0)
TAG_CORD_X = KNOB_X + KNOB_RING + 4.3   # the cord's run along the top, clear of the knob's ring
# The cord's two waypoints on the top in (x, y), behind the knob and toward the handle's right upright,
# which clear_etch keeps its lines off, and the y at which it passes that upright's front.
CORD_ON_TOP = ((TAG_CORD_X, KNOB_Y + 8.0), (TAG_CORD_X - 2.0, HANDLE_Y - 11.8))
CORD_UPRIGHT_Y = HANDLE_Y - 10.4


def clear_tag(name, root, playlist):
    """The luggage tag hanging against the front plate above the right speaker, its cord over the
    top's front edge right of the knob, back along the top's right edge, behind the knob and once
    round the handle's right upright; its face is the page's tag_print (`<name>`), in a render a
    cream card lettered NAME and the collection."""
    loc = (TAG_X, FRONT_Y - 0.6 - 0.9, TAG_Z)
    tag = empty(name + "_root", L(*loc), TAG_ROT, parent=root)
    rbox(name + "_body", (36, 58, 1.8), M["door_glass"], bevel_mm=0.6, parent=tag)
    tube(name + "_eyelet", circle(2.2, 20), 0.6, M["solder"], cyclic=True, parent=tag, loc=L(0, 24.0, 0.95))
    if WEB:
        rbox(name, (30, 44, 0.05), M["tag_print"], parent=tag, loc=L(0, -5.0, 0.95))
    else:
        rbox(name + "_card", (30, 44, 0.3), M["tag_print"], parent=tag, loc=L(0, -5.0, 0.8))
        text(name + "_t1", "NAME", 1.6, M["ink"], font="avenir", align="LEFT", parent=tag, loc=L(-12.0, 12.6, 0.97))
        text(name + "_t2", playlist, 3.0, M["ink_dark"], font="futura", align="LEFT", parent=tag,
             loc=L(-12.0, 5.0, 0.97))
        for k, yy in enumerate((1.0, -7.0, -15.0)):
            rbox("%s_rule_%d" % (name, k), (24, 0.25, 0.04), M["ink"], parent=tag, loc=L(0, yy, 0.97))
    eye = Vector(world_of(loc, TAG_ROT, (0.0, 24.0, 0.0)))
    top = Z1
    side = TAG_CORD_X
    # Up from the eyelet in front of the tag and rightward, over the top's front edge, back along the
    # top's right edge, then left behind the knob (in front of the handle's mount) and once round its
    # upright, above the mount's collar.
    cord = smooth_path([tuple(eye), (eye.x + 1.4, FRONT_Y - 3.7, eye.z + 3.0), (eye.x + 7.0, FRONT_Y - 3.9, top - 3.8),
                        (side - 1.3, FRONT_Y - 3.0, top - 1.2), (side - 0.3, FRONT_Y - 0.7, top + 1.5),
                        (side, FRONT_Y + 5.0, top + 1.05), (*CORD_ON_TOP[0], top + 1.05),
                        (*CORD_ON_TOP[1], top + 1.05), (HANDLE_X + 13.0, CORD_UPRIGHT_Y, top + 1.05),
                        (HANDLE_X + 7.2, CORD_UPRIGHT_Y, top + 3.5),
                        (HANDLE_X + 6.5, HANDLE_Y - 10.0, top + 9.4), (HANDLE_X + 6.4, HANDLE_Y - 2.5, top + 11.4),
                        (HANDLE_X + 2.5, HANDLE_Y + 6.2, top + 12.2), (HANDLE_X - 5.6, HANDLE_Y + 2.4, top + 12.8),
                        (HANDLE_X - 4.4, HANDLE_Y - 5.6, top + 12.4), (HANDLE_X + 3.4, HANDLE_Y - 6.8, top + 11.6)], 6)
    tube(name + "_cord", cord, 0.9, M["strap"], parent=root)
    return tag


def clear_knob(name, root):
    """The knurled knob standing on the top, in the keys' row right of their deck (the page turns it
    to scrub): its pivot, at its base, has its local Z up (three's +Y), as the suitcase's knob, so
    the page turns it about its vertical and finds its top (Box3.max.y) above the pivot. A
    frame-coloured ring, the top's, seats it (only the knob turns); the ring clears the keys' deck
    by 6.8 mm, the handle's mount by 5.3, and the top's front and right edges by 7.6 and 7.8."""
    lathe(name + "_knob_ring", [(KNOB_RING - 1.8, 0.0), (KNOB_RING, 0.0), (KNOB_RING, 0.6), (KNOB_RING - 0.4, 1.0),
                                (KNOB_RING - 1.8, 1.0)], M["clear_frame"], seg=96, parent=root,
          loc=L(KNOB_X, KNOB_Y, Z1 + 0.02))
    knob = empty(name + "_knob", L(KNOB_X, KNOB_Y, Z1 + 0.05), parent=root)
    lathe(name + "_knob_skirt", [(0.01, 0.0), (12.6, 0.0), (12.6, 1.2), (12.0, 1.8), (0.01, 1.8)], M["alu_side"],
          seg=96, parent=knob)
    lathe(name + "_knob_body", [(0.01, 1.8), (10.8, 1.8), (10.8, 13.0), (10.2, 14.0), (9.0, 14.6), (0.01, 14.7)],
          M["alu_side"], seg=160, ridge=({1, 2}, 0.38), parent=knob)
    annulus(name + "_knob_top", 8.9, 0.4, M["alu"], z_mm=14.72, seg=96, parent=knob)
    rbox(name + "_knob_mark", (1.0, 4.6, 0.12), M["ink_dark"], parent=knob, loc=L(0.0, 4.6, 14.74))
    return knob


# ------------------------------------------------------------------ the stand and the case
def slot_pose(i):
    """Slot i of the rack (0 the frontmost and lowest, nearest the player): the disc's centre in the
    stand's frame, and its rotation (its face, the local Z, out toward the viewer, leaning back)."""
    y_front = -42.0 + SLOT_DY * i
    floor = Vector((y_front + 7.0, TREAD0 + SLOT_DZ * i - 4.6))   # (y, z): the slot's floor
    u = Vector((math.sin(SLOT_TILT), math.cos(SLOT_TILT)))
    c = floor + u * 60.15
    return (0.0, c.x, c.y), (math.radians(90) - SLOT_TILT, 0.0, 0.0)


def stand_profile(notches=True):
    """The stand's side: five treads stepping back and up, each with a slot leaning back."""
    u = Vector((math.sin(SLOT_TILT), math.cos(SLOT_TILT)))
    n = Vector((math.cos(SLOT_TILT), -math.sin(SLOT_TILT)))
    w = 1.2
    y_front = -42.0
    pts = [(y_front, 0.0)]
    for i in range(5):
        y = y_front + SLOT_DY * i
        z = TREAD0 + SLOT_DZ * i
        pts.append((y, z))
        if notches:
            floor = Vector((y + 7.0, z - 4.6))
            pf, pb = floor - n * w, floor + n * w
            mf = pf + u * ((z - pf.y) / u.y)
            mb = pb + u * ((z - pb.y) / u.y)
            pts += [tuple(mf), tuple(pf), tuple(pb), tuple(mb)]
        pts.append((y + SLOT_DY + (12.0 if i == 4 else 0.0), z))
    pts.append((y_front + SLOT_DY * 5 + 12.0, 0.0))
    return pts


def clear_stand(name, root, rack_labels=None):
    """The clear stand on the right and its five slots: an empty per slot (the pose of a disc in
    it) under `<name>_lid`, the contract's lid_hinge, which never moves; a render (rack_labels)
    puts a disc in each, the web build leaves them empty for the page."""
    lid = empty(name + "_lid", L(STAND_X, STAND_Y, 0.0), (0.0, 0.0, STAND_TURN), parent=root)
    sslab(name + "_stand", [stand_profile()], -62.0, 62.0, M["door_glass"], bevel_mm=0.6, parent=lid)
    cheek = [(y, z + 5.0) if z > 0 else (y, z) for y, z in stand_profile(notches=False)]
    for k, (x0, x1) in enumerate(((-65.5, -62.3), (62.3, 65.5))):
        sslab("%s_stand_cheek_%d" % (name, k), [cheek], x0, x1, M["clear_frame"], bevel_mm=0.8, parent=lid)
    for k, (x, y) in enumerate(((-56.0, -36.0), (56.0, -36.0), (-56.0, 50.0), (56.0, 50.0))):
        lathe("%s_stand_foot_%d" % (name, k), [(0.01, 0.0), (5.0, 0.0), (5.0, 0.8), (0.01, 0.8)], M["rubber"], seg=24,
              parent=lid, loc=L(x, y, -0.4))
    for i in range(5):
        c, rot = slot_pose(i)
        empty("%s_rack_slot_%d" % (name, i), L(*c), rot, parent=lid)
        if rack_labels:
            make_disc("%s_rack_disc_%d" % (name, i), rack_labels[i], L(*c), rot=rot, parent=lid)
    return lid


def clear_case(name, root, booklet):
    """The jewel case standing on the left, leaning back on a clear easel, its booklet to the
    viewer through the crystal (make_case's local z, its lid, turned toward -y)."""
    z = 62.5 * math.cos(CASE_LEAN) + EASEL_T + 0.12
    rot = (math.radians(90) - CASE_LEAN, 0.0, CASE_TURN)
    case = make_case(name + "_case", booklet, L(CASE_X, CASE_Y, z), rot=rot, parent=root)
    easel = empty(name + "_easel", L(CASE_X, CASE_Y, z), rot, parent=root)
    rbox(name + "_easel_back", (104.0, 74.0, 3.0), M["door_glass"], bevel_mm=0.8, parent=easel,
         loc=L(0.0, -62.5 + 37.0, -1.56))
    foot = Vector(world_of((CASE_X, CASE_Y, z), rot, (0.0, -62.5, -1.56)))
    turn = (0.0, 0.0, CASE_TURN)
    rbox(name + "_easel_base", (150.0, 46.0, EASEL_T), M["door_glass"], bevel_mm=0.8, parent=root,
         loc=L(foot.x, foot.y - 9.0, EASEL_T / 2), rot=turn)
    for k, sx in enumerate((-1, 1)):
        # A gusset behind the back rest at each end, clear of its slant.
        at = Vector(world_of((foot.x, foot.y, 0.0), turn, (sx * 46.0, 19.0, EASEL_T + 6.0)))
        rbox("%s_easel_rib_%d" % (name, k), (3.0, 30.0, 12.0), M["door_glass"], bevel_mm=0.6, parent=root,
             loc=L(*at), rot=turn)
    return case


def make_clear_player(name, disc_label, booklet, look, rack_labels=None, playlist="Top 50 · Global"):
    """The whole Clear model under the empty `name`. `look` is the swatches (clear_look): the
    materials take their colours from it (build_clear_materials); the geometry is the same for every
    look. A render (not WEB) plays: the arm over the disc, the LCD and seven VU segments lit."""
    playing = not WEB
    root = empty(name, L(0, 0, 0))
    clear_body(name, root)
    clear_plate(name, root, playlist)
    clear_door(name, root)
    clear_light_ring(name, root)
    clear_disc(name, root, disc_label)
    clear_arm(name, root, playing)
    clear_board(name, root, playing)
    clear_mechanism(name, root, playing)
    clear_speakers(name, root)
    clear_keys(name, root, playing)
    clear_handle(name, root)
    clear_tag(name + "_tag", root, playlist)
    clear_knob(name, root)
    clear_etch(name, root)
    clear_dongson_ring(name, root)
    clear_grooves(name, root)
    clear_stand(name, root, rack_labels)
    clear_case(name, root, booklet)
    return root

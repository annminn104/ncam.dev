"""The Clear model: an upright, see-through CD player (art/blender/scripts/build_clear.py names
what the page drives; hero.py renders it when CDP_MODEL=clear).

Needs cdkit's and parts.py's namespace (exec'd after them). Blender's axes as in parts.py: x
right, y away from the viewer (the front faces -y), z up, millimetres through L(x, y, z). The
player stands at the origin, the stand with the rack's five slots on its right, the jewel case on
its left.

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
import random
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


# ------------------------------------------------------------------ the board and what is on it
# Where the board's main parts sit, (x, z) mm on its face. The LCD (0, 51), the VU strip (64, 51),
# the logo (-58, 53) and the connectors J1-J6 stay where their cables and flexes land.
SOC = (-108.0, 55.0)                     # U1, a BGA under its heat spreader
RAMS = ((-87.0, 70.0), (-72.0, 70.0))   # U6, U7: the LPDDR packages, above the logo
PMIC = (-136.5, 64.0)                    # U8, a QFN; its three inductors in a column on its right
COILS = ((-127.0, 72.0), (-127.0, 64.0), (-127.0, 56.0))   # L2, L3, L4
USB_X = -118.0                           # J7, its mouth on the lower edge, under the SoC
SUN = (-75.0, 47.0)                      # the Đông Sơn sun, left of the logo
WIFI = (106.0, 63.5)                     # U9's shield can
ANT_ZONE = (116.5, 51.0, 141.0, 76.0)    # the antenna's keep-out
POUR_ZONE = (-61.0, 62.0, -32.0, 78.0)   # the hexagon ground pour
LED_X, LED_Z = (44.0, 52.0, 60.0, 68.0, 76.0, 84.0), 41.4   # the six LEDs, under the VU strip
LED_LABELS = ("PWR", "BT", "WIFI", "PLAY", "SYNC", "CHG")
PASSIVES = {"0402": (1.0, 0.5, 0.35), "0603": (1.6, 0.8, 0.45), "0805": (2.0, 1.25, 0.55)}
TRACE_PROUD, SILK_PROUD = 0.04, 0.05     # mm: the copper under the soldermask, the silkscreen over it
HEADINGS = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0), "NE": (1, 1), "NW": (-1, 1), "SE": (1, -1),
            "SW": (-1, -1)}


def walk(start, moves):
    """A route over the board's face from (x, z) mm: each move a compass heading and how far it
    goes along x and along z ("E4 NE1.5 N3": 4 right, 1.5 up and right, 3 up), so every run is
    straight or diagonal (Board.trace holds every bend to 45 degrees)."""
    pts = [tuple(start)]
    for move in moves.split():
        heading = move.rstrip("0123456789.")
        dx, dz = HEADINGS[heading]
        n = float(move[len(heading):])
        x, z = pts[-1]
        pts.append((x + dx * n, z + dz * n))
    return pts


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


def trombone(start, u, v, meanders, amp, pitch, cut=0.25):
    """A serpentine's points from `start`: along the heading u, `meanders` times out toward v by
    amp mm and back, pitch mm between its legs, each corner cut at 45 degrees by `cut` mm: the
    length a matched trace adds. The trace comes in along u and goes on along u."""
    (sx, sz), (ux, uz), (vx, vz) = start, u, v
    pts = []
    for k in range(meanders):
        bx, bz = sx + ux * 2 * pitch * k, sz + uz * 2 * pitch * k
        for a, c in ((-cut, 0.0), (0.0, cut), (0.0, amp - cut), (cut, amp), (pitch - cut, amp), (pitch, amp - cut),
                     (pitch, cut), (pitch + cut, 0.0)):     # along u, out toward v
            pts.append((bx + ux * a + vx * c, bz + uz * a + vz * c))
    return pts


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


def silk(name, root, body, x, z, size=1.7, font="avenir", align="CENTER"):
    """Silkscreened lettering; the web build leaves out what the page could never read (under 3 mm)."""
    if WEB and size < 3.0:
        return None
    return text(name, body, size, M["silk"], font=font, align=align, parent=root,
                loc=L(x, FACE_Y - SILK_PROUD, z), rot=FRONT)


class Board:
    """The board's layout: each part's footprint (what the traces, the vias and the labels keep
    off), the copper traces and the vias, and the small repeated geometry (legs, pads, passives,
    vias, test pads, the LEDs, the shield's dimples, the silk outlines) merged into one mesh per
    material, as each Blender object becomes a node of the GLB."""

    def __init__(self, name, root):
        self.name, self.root = name, root
        self.sheets = {}
        self.parts = []    # (designator, x0, z0, x1, z1)
        self.traces = []   # (points, width, net)
        self.vias = []     # (x, z, outer radius)
        self.zones = []    # (what, x0, z0, x1, z1): nothing inside but their own copper
        self.words = []    # (x0, z0, x1, z1): the silkscreen's lettering, roughly

    def sheet(self, key, material, smooth=False):
        if key not in self.sheets:
            self.sheets[key] = (bmesh.new(), material, smooth)
        return self.sheets[key][0]

    def keep(self, ref, x, z, w, h):
        """A part's footprint: w x h mm round (x, z)."""
        self.parts.append((ref, x - w / 2, z - h / 2, x + w / 2, z + h / 2))

    def box(self, key, material, x, z, w, h, t, y=FACE_Y, rot=0.0):
        """A block w x h (x, z) mm, t mm proud of y toward the viewer, turned rot degrees about the
        board's normal; no back face, as it lies on something."""
        bm = self.sheet(key, material)
        a = math.radians(rot)
        ca, sa = math.cos(a), math.sin(a)
        ring = [(x + px * ca - pz * sa, z + px * sa + pz * ca)
                for px, pz in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
        back = [bm.verts.new((px * MM, y * MM, pz * MM)) for px, pz in ring]
        front = [bm.verts.new((px * MM, (y - t) * MM, pz * MM)) for px, pz in ring]
        bm.faces.new(front)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((back[i], back[j], front[j], front[i]))

    def flat(self, key, material, outline, y):
        """A flat outline (x, z) at y, facing the viewer."""
        bm = self.sheet(key, material)
        bm.faces.new([bm.verts.new((px * MM, y * MM, pz * MM)) for px, pz in _ccw(list(outline))])

    def disc(self, key, material, x, z, r, y, seg=16):
        self.flat(key, material, circle(r, seg, cx=x, cy=z), y)

    def ring(self, key, material, x, z, ro, ri, y, seg=16):
        bm = self.sheet(key, material)
        ang = [2 * math.pi * i / seg for i in range(seg)]
        outer = [bm.verts.new(((x + ro * math.cos(a)) * MM, y * MM, (z + ro * math.sin(a)) * MM)) for a in ang]
        inner = [bm.verts.new(((x + ri * math.cos(a)) * MM, y * MM, (z + ri * math.sin(a)) * MM)) for a in ang]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((inner[i], outer[i], outer[j], inner[j]))

    def dome(self, key, material, x, z, r, h, y, seg=8):
        """A low dome h mm proud of y, as a stamped dimple stands (a smooth-shaded sheet)."""
        bm = self.sheet(key, material, smooth=True)
        ang = [2 * math.pi * i / seg for i in range(seg)]
        top = bm.verts.new((x * MM, (y - h) * MM, z * MM))
        mid = [bm.verts.new(((x + 0.55 * r * math.cos(a)) * MM, (y - 0.7 * h) * MM, (z + 0.55 * r * math.sin(a)) * MM))
               for a in ang]
        base = [bm.verts.new(((x + r * math.cos(a)) * MM, y * MM, (z + r * math.sin(a)) * MM)) for a in ang]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((top, mid[i], mid[j]))
            bm.faces.new((mid[i], base[i], base[j], mid[j]))

    def strip(self, pts, width, closed=False):
        """Copper under the soldermask, `width` mm along the points and 0.04 mm proud of the face:
        the traces' one mesh, in `trace`."""
        left, right = offset_path(pts, width / 2, closed), offset_path(pts, -width / 2, closed)
        bm = self.sheet("trace", M["trace"])
        y = (FACE_Y - TRACE_PROUD) * MM
        lv = [bm.verts.new((x * MM, y, z * MM)) for x, z in left]
        rv = [bm.verts.new((x * MM, y, z * MM)) for x, z in right]
        n = len(pts)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            bm.faces.new((rv[i], rv[j], lv[j], lv[i]))

    def trace(self, pts, width, net):
        """A copper trace on the net `net`: its runs straight or diagonal and every bend 45
        degrees (a right angle is cut by a 45-degree chamfer), or the run stops."""
        pts = [p for i, p in enumerate(pts) if i == 0 or math.dist(p, pts[i - 1]) > 1e-6]
        runs = []
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            dx, dz = x1 - x0, z1 - z0
            if min(abs(dx), abs(dz)) > 1e-6 and abs(abs(dx) - abs(dz)) > 1e-6:
                raise SystemExit("clear.py: the %s trace runs off 45 degrees to %r" % (net, (x1, z1)))
            runs.append((dx / math.hypot(dx, dz), dz / math.hypot(dx, dz)))
        for (ax, az), (bx, bz), p in zip(runs, runs[1:], pts[1:]):
            turn = ax * bx + az * bz
            if turn < 1.0 - 1e-6 and abs(turn - math.sqrt(0.5)) > 1e-6:
                raise SystemExit("clear.py: the %s trace bends other than 45 degrees at %r" % (net, p))
        self.traces.append((pts, width, net))
        self.strip(pts, width)

    def via(self, x, z, ro=0.45):
        """A via: its tinned ring over the copper, its dark drill."""
        seg = 8 if WEB else 12
        self.vias.append((x, z, ro))
        self.ring("solder", M["solder"], x, z, ro, 0.2, FACE_Y - 0.06, seg)
        self.disc("drill", M["hub_black"], x, z, 0.2, FACE_Y - 0.05, seg)

    def label(self, body, x, z, size=1.2, align="CENTER", font="avenir"):
        """A designator or a word silkscreened beside its part (a render's alone: under 3 mm)."""
        slug = re.sub(r"[^0-9a-z]+", "_", body.lower()).strip("_") or "mark"
        w = 0.36 * len(body) * size                     # the lettering's measured run, about
        x0 = x if align == "LEFT" else x - w / 2
        self.words.append((x0, z - 0.25 * size, x0 + w, z + 0.25 * size))
        return silk("%s_silk_%s" % (self.name, slug), self.root, body, x, z, size=size, font=font, align=align)

    def silk_rect(self, x0, z0, x1, z1):
        self.flat("silk", M["silk"], [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], FACE_Y - SILK_PROUD)

    def frame(self, x, z, w, h, lw=0.15):
        """A silkscreened outline round a part, w x h mm along its line."""
        x0, x1, z0, z1, k = x - w / 2, x + w / 2, z - h / 2, z + h / 2, lw / 2
        self.silk_rect(x0 - k, z1 - k, x1 + k, z1 + k)
        self.silk_rect(x0 - k, z0 - k, x1 + k, z0 + k)
        self.silk_rect(x0 - k, z0 + k, x0 + k, z1 - k)
        self.silk_rect(x1 - k, z0 + k, x1 + k, z1 - k)

    def corners(self, x, z, w, h, arm=1.5, lw=0.15):
        """Silkscreened corner marks round a large package, w x h mm along their lines."""
        k = lw / 2
        for sx in (-1, 1):
            for sz in (-1, 1):
                cx, cz = x + sx * w / 2, z + sz * h / 2
                self.flat("silk", M["silk"], [(cx + sx * k, cz + sz * k), (cx - sx * arm, cz + sz * k),
                                              (cx - sx * arm, cz - sz * k), (cx - sx * k, cz - sz * k),
                                              (cx - sx * k, cz - sz * arm), (cx + sx * k, cz - sz * arm)],
                          FACE_Y - SILK_PROUD)

    def dashes(self, x0, z0, x1, z1, dash=1.2, gap=0.8, lw=0.15):
        """A dashed silkscreened rectangle round a keep-out, a dash at each end of every side."""
        k = lw / 2
        for (ax, az), (bx, bz) in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x0, z1), (x1, z1)),
                                   ((x0, z0), (x0, z1))):
            length = math.hypot(bx - ax, bz - az)
            n = max(2, int(round((length + gap) / (dash + gap))))
            step = (length - dash) / (n - 1)
            for i in range(n):
                s0, s1 = i * step, i * step + dash
                if az == bz:
                    self.silk_rect(ax + s0, az - k, ax + s1, az + k)
                else:
                    self.silk_rect(ax - k, az + s0, ax + k, az + s1)

    def done(self):
        """The merged sheets, one object each."""
        for key, (bm, material, smooth) in self.sheets.items():
            from_bm("%s_board_%s" % (self.name, key), bm, [material], smooth=smooth, parent=self.root)
        self.sheets = {}


# ------------------------------------------------------------------ the board's parts
def passive(B, x, z, size="0402", rot=0.0, cap=False):
    """A chip resistor (black) or capacitor (tan-grey) and its two tinned ends, along x (rot 90:
    along z)."""
    l, w, t = PASSIVES[size]
    e = 0.25 * l
    a = math.radians(rot)
    ux, uz = math.cos(a), math.sin(a)
    B.box("caps" if cap else "chip", M["magnet"] if cap else M["chip"], x, z, l - 2 * e, w, t, rot=rot)
    for s in (-1, 1):
        B.box("solder", M["solder"], x + s * ux * (l - e) / 2, z + s * uz * (l - e) / 2, e, w, t + 0.02, rot=rot)
    B.keep("%s@%g,%g" % ("C" if cap else "R", x, z), x, z, *((l, w) if abs(uz) < 0.5 else (w, l)))


def soic(B, ref, x, z, pins=4, size=(4.9, 3.9), pitch=1.27, t=1.4, turn=False, mark=None):
    """A gull-wing package: its black body (bevelled in a render), `pins` legs along each long side
    (above and below it; `turn` puts them left and right), its pin-1 dot."""
    w, h = (size[1], size[0]) if turn else size
    rbox("%s_%s" % (B.name, ref.lower()), (w, t, h), M["chip"], bevel_mm=0.0 if WEB else 0.25, parent=B.root,
         loc=L(x, FACE_Y - t / 2, z))
    for side in (-1, 1):
        for i in range(pins):
            o = (i - (pins - 1) / 2) * pitch
            if turn:
                B.box("solder", M["solder"], x + side * (w / 2 + 0.5), z + o, 1.0, 0.4, 0.3)
            else:
                B.box("solder", M["solder"], x + o, z + side * (h / 2 + 0.5), 0.4, 1.0, 0.3)
    B.disc("ink", M["ink"], x - w / 2 + 0.7, z + h / 2 - 0.7, 0.3, FACE_Y - t - 0.01, 12)
    if mark and not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), mark, 0.9, M["ink"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.02, z - 0.3), rot=FRONT)
    B.keep(ref, x, z, w + (2.0 if turn else 0.0), h + (0.0 if turn else 2.0))


def qfn(B, ref, x, z, s=5.0, pins=8, pitch=0.5, t=0.85, mark=None):
    """A QFN: its black body, `pins` lands a side showing at its edges, its pin-1 dot (its exposed
    pad's copper is the caller's)."""
    rbox("%s_%s" % (B.name, ref.lower()), (s, t, s), M["chip"], bevel_mm=0.0 if WEB else 0.08, parent=B.root,
         loc=L(x, FACE_Y - t / 2, z))
    for i in range(pins):
        o = (i - (pins - 1) / 2) * pitch
        for side in (-1, 1):
            B.box("solder", M["solder"], x + side * (s / 2 + 0.1), z + o, 0.45, 0.25, 0.15)
            B.box("solder", M["solder"], x + o, z + side * (s / 2 + 0.1), 0.25, 0.45, 0.15)
    B.disc("ink", M["ink"], x - s / 2 + 0.6, z + s / 2 - 0.6, 0.25, FACE_Y - t - 0.01, 12)
    if mark and not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), mark, 0.9, M["ink"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.02, z - 0.4), rot=FRONT)
    B.keep(ref, x, z, s + 0.65, s + 0.65)


def soc(B, x, z):
    """U1, the SoC: a BGA's dark substrate under a stepped metal heat spreader marked ncam N1, the
    capacitors on the substrate's rim, the A1 corner's gold triangle."""
    n = B.name + "_u1"
    rbox(n, (16.0, 1.0, 16.0), M["chip"], bevel_mm=0.0 if WEB else 0.15, parent=B.root, loc=L(x, FACE_Y - 0.5, z))
    y = FACE_Y - 1.0
    fslab(n + "_lid", [rrect(13.6, 13.6, 1.0, seg=4)], y - 0.45, y, M["chrome"], bevel_mm=0.1, x=x, z=z,
          parent=B.root)
    fslab(n + "_lid_top", [rrect(11.4, 11.4, 0.8, seg=4)], y - 1.2, y - 0.43, M["chrome"], bevel_mm=0.25, x=x, z=z,
          parent=B.root)
    B.flat("gold", M["gold"], [(x - 7.6, z + 7.6), (x - 6.4, z + 7.6), (x - 7.6, z + 6.4)], y - 0.01)
    if not WEB:
        top = y - 1.21
        text(n + "_mark", "ncam N1", 2.2, M["ink_dark"], font="futura", parent=B.root, loc=L(x - 1.4, top, z + 1.0),
             rot=FRONT)
        text(n + "_code", "2611  A2", 1.0, M["ink_dark"], font="din", parent=B.root, loc=L(x - 1.4, top, z - 1.4),
             rot=FRONT)
        # A laser-marked Data Matrix beside the mark: its solid L on two sides, its clock track on the others.
        rng = random.Random(1)
        cell, cells = 0.22, 10
        ox, oz = x + 3.7 - cells * cell / 2, z - 0.2 - cells * cell / 2
        for i in range(cells):
            for j in range(cells):
                edge = i == 0 or j == 0 or (j == cells - 1 and i % 2 == 0) or (i == cells - 1 and j % 2 == 1)
                inner = 0 < i < cells - 1 and 0 < j < cells - 1
                if edge or (inner and rng.random() < 0.5):
                    px, pz = ox + i * cell, oz + j * cell
                    square = [(px, pz), (px + cell, pz), (px + cell, pz + cell), (px, pz + cell)]
                    B.flat("ink_dark", M["ink_dark"], square, top)
        for k in range(5):
            o = (k - 2) * 2.4
            B.box("caps", M["magnet"], x - 7.4, z + o, 0.3, 0.6, 0.3, y=y)
            B.box("caps", M["magnet"], x + o, z - 7.4, 0.6, 0.3, 0.3, y=y)
    B.keep("U1", x, z, 16.0, 16.0)


def lpddr(B, ref, x, z):
    """An LPDDR package: its black BGA body, its pin-1 dot, its mark."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (12.0, 0.95, 9.0), M["chip"], bevel_mm=0.0 if WEB else 0.12, parent=B.root, loc=L(x, FACE_Y - 0.475, z))
    B.disc("ink", M["ink"], x - 5.1, z + 3.6, 0.35, FACE_Y - 0.96, 12)
    if not WEB:
        text(n + "_mark", "LPDDR4X", 1.3, M["ink"], font="din", parent=B.root, loc=L(x, FACE_Y - 0.97, z + 0.7),
             rot=FRONT)
        text(n + "_code", "8Gb  2611", 0.9, M["ink"], font="din", parent=B.root, loc=L(x, FACE_Y - 0.97, z - 1.3),
             rot=FRONT)
    B.keep(ref, x, z, 12.0, 9.0)


def coil(B, ref, x, z, mark):
    """A shielded power inductor: its dark body, its metal top marked with its value, its two
    terminals' solder at its sides."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (5.0, 2.2, 5.0), M["magnet"], bevel_mm=0.5, parent=B.root, loc=L(x, FACE_Y - 1.1, z))
    fslab(n + "_top", [rrect(4.0, 4.0, 0.5, seg=3)], FACE_Y - 2.34, FACE_Y - 2.19, M["alu_side"], x=x, z=z,
          parent=B.root)
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 2.6, z, 0.6, 3.0, 0.8)
    if not WEB:
        text(n + "_mark", mark, 1.3, M["ink_dark"], font="din", parent=B.root, loc=L(x, FACE_Y - 2.35, z), rot=FRONT)
    B.keep(ref, x, z, 5.8, 5.0)


def shield_can(B, ref, x, z, s=12.0, t=1.8):
    """The Wi-Fi/BT module: a stamped metal shield can, rows of small dimples above and below its
    mark, its frame's solder round its foot."""
    fslab("%s_%s" % (B.name, ref.lower()), [rrect(s, s, 0.8, seg=4)], FACE_Y - t, FACE_Y, M["chrome"], bevel_mm=0.25,
          x=x, z=z, parent=B.root)
    for i in range(6):
        for j in (0, 1, 4, 5):
            B.dome("dimples", M["chrome"], x + (i - 2.5) * 1.7, z + (j - 2.5) * 1.7, 0.34, 0.08, FACE_Y - t,
                   6 if WEB else 8)
    for side in (-1, 1):
        B.box("solder", M["solder"], x, z + side * (s / 2 + 0.12), s + 0.48, 0.24, 0.12)
        B.box("solder", M["solder"], x + side * (s / 2 + 0.12), z, 0.24, s, 0.12)
    if not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), "WIFI/BT", 1.6, M["ink_dark"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.01, z), rot=FRONT)
    B.keep(ref, x, z, s + 0.5, s + 0.5)


def usb_c(B, x):
    """J7: a USB-C receptacle on the board's lower edge, its mouth down past the edge: the
    stainless shell round the dark tongue, the shell's legs at its sides, its pins at its back."""
    n = B.name + "_j7"
    z0 = BOARD_Z0 - 0.6            # the mouth
    z1 = z0 + 7.35                 # the back
    yc = FACE_Y - 1.63
    outer = capsule((x - 2.84, yc), 1.63, (x + 2.84, yc), 1.63, seg=12)
    inner = capsule((x - 2.84, yc), 1.38, (x + 2.84, yc), 1.38, seg=12)
    slab(n, [outer, inner], z0, z1 - 0.75, M["alu_side"], bevel_mm=0.06, parent=B.root)
    slab(n + "_back", [outer], z1 - 0.75, z1, M["alu_side"], bevel_mm=0.15, parent=B.root)
    rbox(n + "_tongue", (6.6, 0.7, 4.6), M["chip"], parent=B.root, loc=L(x, yc, z1 - 0.75 - 2.3))
    for side in (-1, 1):
        for zz in (z0 + 1.8, z0 + 5.6):
            B.box("solder", M["solder"], x + side * 4.75, zz, 0.7, 1.4, 0.5)
    for i in range(10):
        B.box("solder", M["solder"], x + (i - 4.5) * 0.7, z1 + 0.45, 0.3, 0.9, 0.12)
    B.keep("J7", x, (z0 + z1 + 0.9) / 2, 10.2, z1 + 0.9 - z0)
    return z1 + 0.45


def zif(B, ref, x, z):
    """J8: the LCD flex's ZIF connector, the flex entering its front over the dark latch, its
    hold-down tabs at either end."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (22.0, 3.0, 4.2), M["well"], bevel_mm=0.0 if WEB else 0.2, parent=B.root, loc=L(x, FACE_Y - 1.5, z))
    rbox(n + "_latch", (20.0, 0.6, 1.3), M["chip"], bevel_mm=0.0 if WEB else 0.1, parent=B.root,
         loc=L(x, FACE_Y - 3.3, z - 1.05))
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 11.6, z, 1.2, 2.2, 0.5)
    B.keep(ref, x, z, 24.4, 4.2)


def connector(B, ref, x, z, pins=2):
    """A JST-style header: its white housing (bevelled in a render), its pins' dark slots."""
    w = 2.5 * pins + 2.4
    rbox("%s_%s" % (B.name, ref.lower()), (w, 5.8, 5.6), M["well"], bevel_mm=0.0 if WEB else 0.35, parent=B.root,
         loc=L(x, FACE_Y - 2.9, z))
    for k in range(pins):
        B.box("chip", M["chip"], x + (k - (pins - 1) / 2) * 2.5, z + 0.4, 1.5, 2.4, 5.84)
    B.keep(ref, x, z, w, 5.6)


def flex_header(B, ref, x, z, w):
    """A flex cable's connector: its black body (bevelled in a render), its white latch along the
    top, where the flex comes down into it."""
    rbox("%s_%s" % (B.name, ref.lower()), (w, 2.6, 4.4), M["chip"], bevel_mm=0.0 if WEB else 0.3, parent=B.root,
         loc=L(x, FACE_Y - 1.3, z))
    B.box("well", M["well"], x, z + 1.6, w - 1.0, 1.0, 2.9)
    B.keep(ref, x, z + 0.2, w, 4.8)


def electrolytic(B, ref, x, z, r, h):
    """An aluminium electrolytic: its can, its scored top, its silkscreened ring."""
    n = "%s_%s" % (B.name, ref.lower())
    ylathe(n, [(0.01, 0), (r, 0), (r, h - 0.5), (r - 0.45, h), (0.01, h)], M["cell"], x, FACE_Y, z, toward=-1,
           seg=32, parent=B.root)
    B.disc("solder", M["solder"], x, z, r - 0.55, FACE_Y - h - 0.01, 16 if WEB else 24)
    for k in range(2):
        B.box("ink_dark", M["ink_dark"], x, z, r * 1.1, 0.25, 0.05, y=FACE_Y - h - 0.01, rot=45 + 90 * k)
    B.ring("silk", M["silk"], x, z, r + 0.45, r + 0.3, FACE_Y - SILK_PROUD, 20 if WEB else 32)
    B.keep(ref, x, z, 2 * r, 2 * r)


def crystal(B, ref, x, z):
    """A 3.2 x 2.5 mm crystal: its ceramic base, its metal lid."""
    B.box("well", M["well"], x, z, 3.2, 2.5, 0.3)
    B.box("solder", M["solder"], x, z, 2.7, 2.0, 0.5, y=FACE_Y - 0.3)
    B.keep(ref, x, z, 3.2, 2.5)


def sot23(B, ref, x, z):
    """A SOT-23 transistor: its body, its three legs."""
    B.box("chip", M["chip"], x, z, 2.9, 1.6, 1.1)
    for dx, dz in ((-0.95, -1.15), (0.95, -1.15), (0.0, 1.15)):
        B.box("solder", M["solder"], x + dx, z + dz, 0.4, 0.8, 0.2)
    B.keep(ref, x, z, 2.9, 3.1)


def tantalum(B, ref, x, z, rot=0.0):
    """A tantalum capacitor: its amber body, its polarity band."""
    a = math.radians(rot)
    B.box("flex", M["flex"], x, z, 3.5, 2.8, 1.9, rot=rot)
    B.box("well", M["well"], x - 1.2 * math.cos(a), z - 1.2 * math.sin(a), 0.6, 2.9, 1.95, rot=rot)
    B.keep(ref, x, z, *((3.5, 2.8) if abs(math.sin(a)) < 0.5 else (2.8, 3.5)))


def test_pad(B, ref, x, z, lx, lz):
    """A gold test pad, its label at (lx, lz)."""
    B.disc("gold", M["gold"], x, z, 0.75, FACE_Y - 0.05, 12 if WEB else 24)
    B.keep(ref, x, z, 1.5, 1.5)
    B.label(ref, lx, lz, 1.1)


def led(B, x, z, word):
    """An 0805 LED: its white housing, its lens lit in the light's colour, its tinned ends; its
    word above it."""
    B.box("well", M["well"], x, z, 1.3, 1.25, 0.55)
    B.box("light", M["light"], x, z, 0.9, 0.8, 0.6)
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 0.82, z, 0.36, 1.25, 0.57)
    B.keep("D " + word, x, z, 2.0, 1.25)
    B.label(word, x, z + 2.2, 1.1)


def dongson_sun(B, x, z):
    """The Đông Sơn drum's 14-ray star inside its ring, in gold, 12 mm across: a feather's
    chevron between each pair of rays."""
    y = FACE_Y - 0.05

    def at(r, a):
        return x + r * math.cos(a), z + r * math.sin(a)
    B.flat("gold", M["gold"], [at(4.5 if k % 2 == 0 else 1.55, math.pi / 2 + math.pi * k / 14) for k in range(28)], y)
    B.ring("gold", M["gold"], x, z, 6.0, 5.35, y, 40 if WEB else 72)
    apex, tip, spread, w = 3.05, 4.45, math.radians(6.5), 0.2
    for k in range(14):
        g = math.pi / 2 + math.pi * (2 * k + 1) / 14     # between two rays
        B.flat("gold", M["gold"], [at(apex, g), at(tip, g - spread), at(tip + w, g - spread + w / tip),
                                   at(apex + w * 1.4, g), at(tip + w, g + spread - w / tip), at(tip, g + spread)], y)
    B.keep("SUN", x, z, 12.0, 12.0)


def hex_pour(B, zone, cell=4.0, line=0.3, rim=0.4, cut=1.5):
    """A hatched ground pour: outline hexagons `cell` mm across their flats in `line` mm copper,
    inside a rim whose corners are cut at 45 degrees; nothing else inside it."""
    x0, z0, x1, z1 = zone
    B.zones.append(("pour", x0, z0, x1, z1))
    outline = [(x0 + cut, z0), (x1 - cut, z0), (x1, z0 + cut), (x1, z1 - cut), (x1 - cut, z1), (x0 + cut, z1),
               (x0, z1 - cut), (x0, z0 + cut)]
    B.strip(outline, rim, closed=True)
    R = cell / math.sqrt(3)
    edges = {}
    cols = int((x1 - x0) / (1.5 * R)) + 3
    rows = int((z1 - z0) / cell) + 3
    for i in range(-1, cols):
        for j in range(-1, rows):
            cx = x0 + 0.6 * R + i * 1.5 * R
            cz = z0 + 0.5 * cell + j * cell + (cell / 2 if i % 2 else 0.0)
            ring = [(cx + R * math.cos(math.pi * k / 3), cz + R * math.sin(math.pi * k / 3)) for k in range(6)]
            for a, b in zip(ring, ring[1:] + ring[:1]):
                key = (round((a[0] + b[0]) * 50), round((a[1] + b[1]) * 50))
                edges[key] = (a, b)
    for a, b in edges.values():
        seg = clip_segment(a, b, outline)
        if seg and math.dist(*seg) > 0.25:
            B.strip(list(seg), line)


def board_compute(B):
    """The SoC and its two LPDDR packages, the buses between them (a differential clock pair, four
    lines to U6, five to U7, the inner of those, the shortest, tuned by a serpentine), the
    crystal, the decoupling, the debug header J5 and its vias, the test pads TP3-TP6."""
    sx, sz = SOC
    soc(B, sx, sz)
    B.corners(sx, sz, 16.8, 16.8, arm=1.2)
    B.label("U1", -98.8, 64.6)
    for i in range(5):
        passive(B, sx - 3.0 + 2.0 * i, sz + 9.4, cap=True)     # along its top edge
        passive(B, sx - 3.0 + 2.0 * i, sz - 9.7, cap=True)     # and its bottom edge
    for ref, (x, z) in zip(("U6", "U7"), RAMS):
        lpddr(B, ref, x, z)
        B.corners(x, z, 12.8, 9.8, arm=1.2)
        B.label(ref, x - 4.5, z + 6.2)
    right = sx + 7.0                       # the buses start under the package's right edge
    ck = walk((right, 62.3), "E6.6 NE2.8 N2.4")
    for d, net in ((0.35, "CK_T"), (-0.35, "CK_C")):
        B.trace(offset_path(ck, d), 0.35, net)
    bus_a = walk((right, 59.0), "E7.8 NE4.2 N4.3")
    for k in range(4):
        B.trace(offset_path(bus_a, (k - 1.5) * 0.6), 0.25, "DQA%d" % k)
    bus_b = walk((right, 51.3), "E13 NE6 E3 NE4 N6.2")
    for k in range(5):
        line = offset_path(bus_b, (k - 2) * 0.6)
        if k == 4:     # the inner line of every bend, the shortest: its serpentine matches it
            x0, z0 = line[0]
            line = [line[0]] + trombone((x0 + 1.8, z0), (1, 0), (0, 1), 5, 2.3, 0.9) + line[1:]
        B.trace(line, 0.25, "DQB%d" % k)
    crystal(B, "Y1", -95.5, 47.4)
    B.label("Y1", -91.6, 47.4)
    for zz, net in ((48.3, "XIN"), (47.5, "XOUT")):
        B.trace(walk((right, zz), "E4.3"), 0.25, net)
    jx, jz = -94.0, 38.6
    rbox(B.name + "_j5", (12.9, 2.6, 5.2), M["chip"], bevel_mm=0.0 if WEB else 0.3, parent=B.root,
         loc=L(jx, FACE_Y - 1.3, jz))
    for i in range(10):
        B.box("solder", M["solder"], jx + (i // 2 - 2) * 2.54, jz + (i % 2 - 0.5) * 2.54, 0.64, 0.64, 8.4)
    B.keep("J5", jx, jz, 12.9, 5.2)
    B.label("J5", jx - 7.9, jz)
    for i in range(4):
        x = jx + (i - 2) * 2.54
        B.trace(walk((x, jz + 1.8), "N3.2"), 0.25, "SWD%d" % i)
        B.via(x, jz + 5.0)
    for i in range(4):
        x = -90.0 + 5.0 * i
        test_pad(B, "TP%d" % (i + 3), x, 79.0, x, 81.2)
        B.trace(walk((x, 79.0), "SE1.4"), 0.3, "TP%d" % (i + 3))
        B.via(x + 1.4, 77.6)


def board_power(B):
    """The PMIC (U8) and its three inductors in a column, their rails into the SoC's left edge;
    USB-C (J7) on the lower edge, its differential pair to the SoC, VBUS round to the PMIC and to
    TP1; the cells' connector J1 and its switch Q1; C1."""
    px, pz = PMIC
    qfn(B, "U8", px, pz, mark="NC80")
    B.corners(px, pz, 6.4, 6.4, arm=1.0)
    B.label("U8", -139.6, 58.5)
    # The exposed pad's copper out past the package's top, its thermal vias.
    B.flat("trace", M["trace"], [(px - 1.6, pz + 1.6), (px + 1.0, pz + 1.6), (px + 1.0, pz + 6.0),
                                 (px - 1.6, pz + 6.0)], FACE_Y - TRACE_PROUD)
    for dx in (-0.9, 0.3):
        B.via(px + dx, pz + 4.7, ro=0.4)
    electrolytic(B, "C1", -137.0, 77.0, 4.0, 9.0)
    B.label("C1", -137.0, 71.6)
    for ref, (x, z), mark in zip(("L2", "L3", "L4"), COILS, ("2R2", "1R0", "4R7")):
        coil(B, ref, x, z, mark)
        B.label(ref, x + 5.4, z + 1.9)
    # Each switch node from the PMIC's right side into its inductor, each rail on into the SoC.
    switch = (walk((px + 1.9, pz + 1.9), "E0.8 NE1.6 N3.7 NE0.8 E1.8"), walk((px + 1.9, pz), "E5.0"),
              walk((px + 1.9, pz - 1.9), "E0.8 SE1.6 S3.7 SE0.8 E1.8"))
    rails = (walk((-124.4, 72.0), "E4.0 SE6.9 S3.1"), walk((-124.4, 64.0), "E2.4 SE4.0 E3.0"),
             walk((-124.4, 56.0), "E9.4"))
    for k in range(3):
        B.trace(switch[k], 0.9, "SW%d" % (k + 1))
        B.trace(rails[k], 0.9, ("VDD_IO", "VDD_DDR", "VDD_CORE")[k])
    pins = usb_c(B, USB_X)
    B.label("J7", USB_X + 6.6, 36.6)
    pair = walk((USB_X, pins), "N1.0 NE6.0 N2.6")
    for d, net in ((0.35, "USB_DP"), (-0.35, "USB_DN")):
        B.trace(offset_path(pair, d), 0.35, net)
    B.trace(walk((USB_X - 3.15, pins), "N6.2 NW4.0 W9.35 NW2.0 N8.5"), 1.0, "VBUS")
    B.trace(walk((USB_X + 3.15, pins), "N0.5 NE1.2 E3.65"), 0.5, "VBUS")
    test_pad(B, "TP1", -110.0, 43.0, -110.0, 41.2)
    test_pad(B, "TP2", -106.4, 43.0, -106.4, 41.2)
    B.trace(walk((-106.4, 43.0), "E1.8"), 0.4, "GND")
    B.via(-104.6, 43.0)
    connector(B, "J1", -102.0, 80.0)
    B.label("J1", -107.4, 80.0)
    for dx, net in ((-1.25, "VBAT"), (1.25, "GND")):
        B.trace(walk((-102.0 + dx, 78.6), "S2.8"), 0.8, net)
        B.via(-102.0 + dx, 75.8, ro=0.55)
    sot23(B, "Q1", -95.5, 79.6)
    B.label("Q1", -95.5, 82.6)


def board_display(B, playing):
    """The LCD on its standoffs and its flex's ZIF (J8), the VU strip, the six LEDs under it and
    the bus from their driver U4, the DAC U5, the LCD's two tantalums C4 and C5."""
    clear_lcd(B.name, B.root, playing)
    B.keep("LCD", 0.0, 51.45, 58.0, 23.1)
    zif(B, "J8", 0.0, 37.3)
    B.label("J8", 13.6, 37.3)
    clear_vu(B.name, B.root, playing)
    B.keep("VU", 64.0, 51.0, 58.0, 11.0)
    B.label("LEVEL", 35.0, 58.6, 1.9, align="LEFT")
    for x, word in zip(LED_X, LED_LABELS):
        led(B, x, LED_Z, word)
    soic(B, "U4", 96.0, 37.6, pins=8, size=(5.0, 4.4), pitch=0.65, t=1.1, turn=True)
    B.label("U4", 96.0, 41.6)
    for k, x in enumerate(LED_X):      # the nearest LED on the top line: no line crosses another
        zk = 37.6 + (k - 2.5) * 0.65
        B.trace([(93.0, zk), (x - 0.42, zk), (x - 0.82, zk + 0.4), (x - 0.82, LED_Z - 0.2)], 0.25, "LED%d" % k)
    ux, uz = -39.0, 50.5           # the DAC between the logo and the LCD, its legs fanned out to vias
    soic(B, "U5", ux, uz, mark="DAC")
    B.label("U5", ux + 5.0, uz)
    for i in range(4):
        x = ux + (i - 1.5) * 1.27
        for s, heading in ((-1, "S"), (1, "N")):
            reach = 2.35 + 1.1 * (i % 2)
            B.trace(walk((x, uz + s * 2.6), "%s%.2f" % (heading, reach)), 0.25, "U5_%s%d" % (heading, i))
            B.via(x, uz + s * (2.6 + reach))
    for ref, x in (("C4", -18.0), ("C5", 18.0)):
        tantalum(B, ref, x, 67.0)
        B.label(ref, x, 69.6)
        for s, heading in ((-1, "W"), (1, "E")):
            B.trace(walk((x + s * 1.4, 67.0), "%s2.0" % heading), 0.5, "%s_%s" % (ref, heading))
            B.via(x + s * 3.4, 67.0)


def board_radio(B):
    """The Wi-Fi/BT module under its shield can (U9) and its via fence, the SDIO bus to it from
    vias by the pour, and the meander antenna fed from it in a keep-out at the board's upper
    right."""
    wx, wz = WIFI
    shield_can(B, "U9", wx, wz)
    B.label("U9", 113.6, 70.6)
    for i in range(6):
        for zz in (wz + 7.7, wz - 7.7):
            B.via(wx - 5.5 + 2.2 * i, zz)
    sdio = walk((-27.0, 74.2), "E121 SE3 S4.2 SE2 E2")
    for k in range(5):
        line = offset_path(sdio, (k - 2) * 0.9)
        line[0] = (-27.0 + 0.9 * k, line[0][1])
        B.trace(line, 0.25, "SDIO%d" % k)
        B.via(*line[0])
    x0, z0, x1, z1 = ANT_ZONE
    B.zones.append(("antenna", x0, z0, x1, z1))
    B.dashes(x0, z0, x1, z1)
    B.label("ANT", (x0 + x1) / 2, z0 + 3.0, 1.7)
    # An inverted-F: the feed from the module's RF pad up to the arm, the arm shorted to the ground
    # plane by a via outside the keep-out, its meander along the top, its tip open.
    B.trace(walk((wx + 5.0, 66.0), "E7.8 NE0.8 N5.2"), 0.6, "ANT")
    arm = [(114.4, 72.0)] + trombone((122.0, 72.0), (1, 0), (0, -1), 4, 7.0, 2.2, cut=0.6) + \
        [(139.0, 72.0), (139.6, 71.4), (139.6, 66.0)]
    B.trace(arm, 0.5, "ANT")
    B.via(114.4, 72.0)
    for x in (113.4, 115.4):
        for zz in (64.6, 67.4):
            B.via(x, zz)


def board_audio(B):
    """The connectors the cables land in (J2 and J4 the speakers', J3 the laser's flex, J6 the
    keys' ribbon), an amplifier by each speaker's connector with its output pair into it, the
    electrolytics C2 and C3 on the right."""
    connector(B, "J2", -126.0, 80.5)
    B.label("J2", -131.6, 80.5)
    connector(B, "J4", 112.0, 80.5)
    B.label("J4", 117.4, 80.5)
    flex_header(B, "J3", 88.0, 80.0, 16.0)
    B.label("J3", 78.6, 80.0)
    flex_header(B, "J6", 128.0, 80.4, 12.0)
    B.label("J6", 136.6, 80.4)
    for ref, x, s, jx in (("U2", -114.0, -1, -126.0), ("U3", 102.0, 1, 112.0)):
        soic(B, ref, x, 80.5, turn=True, mark="AMP")
        B.label(ref, x, 76.6)
        leg = x + s * 2.8
        h, d, u = ("W", "SW", "NW") if s < 0 else ("E", "SE", "NE")
        far, near = jx + s * 1.25, jx - s * 1.25
        # The output pair: the lower leg to the connector's far pin, round the upper one's.
        lower = abs(far - leg - s * 4.9) - 0.6
        upper = abs(near - leg - s * 4.97) - 0.3
        B.trace(walk((leg, 78.595), "%s2.7 %s2.2 %s%.3f %s0.6 N1.2" % (h, d, h, lower, u)), 0.5, ref + "_OUTN")
        B.trace(walk((leg, 79.865), "%s2.7 %s2.27 %s%.3f %s0.3 N0.3" % (h, d, h, upper, u)), 0.5, ref + "_OUTP")
        for i in range(4):         # its inputs, from the other side's legs down vias
            zz = 80.5 + (i - 1.5) * 1.27
            B.trace(walk((x - s * 2.8, zz), ("E" if s < 0 else "W") + "1.6"), 0.25, "%s_IN%d" % (ref, i))
            B.via(x - s * 4.4, zz)
    electrolytic(B, "C2", 107.0, 44.0, 5.0, 11.0)
    B.label("C2", 107.0, 50.6)
    electrolytic(B, "C3", 118.5, 41.5, 3.15, 7.0)
    B.label("C3", 118.5, 46.2)


def _point_segment(p, a, b):
    """The distance (mm) from p to the segment ab, (x, z) each."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    span = dx * dx + dz * dz
    t = 0.0 if span < 1e-12 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / span))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)


def board_stitching(B, pitch):
    """Ground-stitching vias on a regular grid wherever the board is open: clear of every part,
    trace, word, zone, screw hole and via, and of the board's edge."""
    holes = [(x, z) for x, z in SCREWS if z < ZC]

    def gap(x, z, x0, z0, x1, z1):
        return math.hypot(max(x0 - x, 0.0, x - x1), max(z0 - z, 0.0, z - z1))

    def open_at(x, z):
        if any(gap(x, z, *r[1:]) < 1.7 for r in B.parts) or any(gap(x, z, *r[1:]) < 1.6 for r in B.zones):
            return False
        if any(gap(x, z, *r) < 1.2 for r in B.words):
            return False
        if any(_point_segment((x, z), a, b) < w / 2 + 1.1 for pts, w, _ in B.traces for a, b in zip(pts, pts[1:])):
            return False
        if any(math.hypot(vx - x, vz - z) < ro + 1.6 for vx, vz, ro in B.vias):
            return False
        return all(math.hypot(hx - x, hz - z) > 7.5 for hx, hz in holes)
    n = int((BOARD_W / 2 - 2.0) // pitch)
    z = BOARD_Z0 + 2.2
    while z < BOARD_Z1 - 2.0:
        for x in [i * pitch for i in range(-n, n + 1)]:
            if open_at(x, z):
                B.via(x, z, ro=0.4)
        z += pitch


def board_marks(B):
    """The silkscreened ncam logo and its lines, the Đông Sơn sun beside them, the hexagon pour."""
    silk(B.name + "_silk_logo", B.root, "ncam", -58.0, 53.0, size=10.0, font="futura")
    silk(B.name + "_silk_model", B.root, "CD-02  SEE-THROUGH PLAYER", -58.0, 44.0, size=1.9)
    silk(B.name + "_silk_rev", B.root, "REV A  2026", -58.0, 40.6, size=1.6)
    B.words.append((-66.6, 40.2, -49.4, 53.8))     # the logo and its two lines, as Futura and Avenir set them
    dongson_sun(B, *SUN)
    hex_pour(B, POUR_ZONE)


def clear_board(name, root, playing=False):
    """The board across the lower part of the body, its parts facing the viewer: on the left the
    SoC under its heat spreader with its two LPDDR packages, the PMIC and its three inductors,
    USB-C on the lower edge; the Đông Sơn sun beside the ncam logo, a hexagon ground pour; the LCD
    (its flex in J8) and the VU strip with six LEDs under it; on the right the Wi-Fi module's
    shield can and its meander antenna in a keep-out; an amplifier by each speaker's connector,
    the connectors the cables land in, test pads, vias, and the copper traces between them."""
    cz = (BOARD_Z0 + BOARD_Z1) / 2
    holes = [circle(4.8, 24, cx=x, cy=z) for x, z in SCREWS if z < ZC]
    board = fslab(name + "_board", [rrect(BOARD_W, BOARD_Z1 - BOARD_Z0, 3.0, cy=cz)] + holes, FACE_Y,
                  FACE_Y + 1.6, M["board"], bevel_mm=0.3, parent=root)
    B = Board(name, root)
    board_compute(B)
    board_power(B)
    board_display(B, playing)
    board_radio(B)
    board_audio(B)
    board_marks(B)
    board_stitching(B, 10.0 if WEB else 6.0)
    B.done()
    return board


def clear_lcd(name, root, playing):
    """The LCD module on four standoffs, its screen the page's lcd_screen print (54 x 24 mm's
    aspect, as the suitcase's: the page paints 256 x 112)."""
    x, z = 0.0, 51.0
    face = FACE_Y - 7.5
    for k, (dx, dz) in enumerate(((-26.0, -9.5), (26.0, -9.5), (-26.0, 9.5), (26.0, 9.5))):
        ylathe("%s_lcd_post_%d" % (name, k), [(0.01, 0), (1.3, 0), (1.3, 4.5), (0.01, 4.5)], M["solder"],
               x + dx, FACE_Y, z + dz, toward=-1, seg=16, parent=root)
    fslab(name + "_lcd_frame", [rrect(58.0, 24.0, 1.2), rrect(49.6, 22.0, 0.6)], face, face + 3.0, M["chip"],
          bevel_mm=0.3, x=x, z=z, parent=root)
    rbox(name + "_lcd_back", (57.0, 23.0, 0.6), M["chip"], parent=root, loc=L(x, face + 2.7, z), rot=FRONT)
    band(name + "_lcd_tail", [(x, face + 3.0, z - 11.5), (x, face + 3.6, z - 13.5), (x, FACE_Y - 0.4, z - 14.2)],
         18.0, M["flex"], side=(1.0, 0.0, 0.0), parent=root)
    rbox(name + "_lcd_screen", (48.0, 21.0, 0.05), M["lcd_screen"], parent=root, loc=L(x, face + 0.6, z), rot=FRONT)
    if WEB:
        return
    # A render lights the track and the time over the unlit segments.
    y = face + 0.56
    on = M["lcd_glow"] if playing else M["lcd_ghost"]
    text(name + "_lcd_g1", "88", 11.0, M["lcd_ghost"], font="din", parent=root, loc=L(x - 12.5, y + 0.01, z - 1.6),
         rot=FRONT)
    text(name + "_lcd_t1", "01", 11.0, on, font="din", parent=root, loc=L(x - 12.5, y, z - 1.6), rot=FRONT)
    text(name + "_lcd_g2", "8:88", 7.6, M["lcd_ghost"], font="din", parent=root, loc=L(x + 10.5, y + 0.01, z - 2.6),
         rot=FRONT)
    text(name + "_lcd_t2", "1:24", 7.6, on, font="din", parent=root, loc=L(x + 10.5, y, z - 2.6), rot=FRONT)
    text(name + "_lcd_cd", "CD   PLAY   RPT", 2.2, on, font="avenir", align="LEFT", parent=root,
         loc=L(x - 21.5, y, z + 7.4), rot=FRONT)


def clear_vu(name, root, playing):
    """The ten VU segments on a black bar module, one `vu` material for all ten (the page clones it
    per segment); a render lights the first seven."""
    x0, z = 64.0, 51.0
    face = FACE_Y - 4.0
    rbox(name + "_vu_body", (58.0, 4.0, 11.0), M["chip"], bevel_mm=0.4, parent=root, loc=L(x0, FACE_Y - 2.0, z))
    for k in range(10):
        lit = WEB or (playing and k < 7)
        rbox("%s_vu_seg_%d" % (name, k), (3.8, 6.6, 0.3), M["vu"] if lit else M["vu_dim"], parent=root,
             loc=L(x0 + (k - 4.5) * 5.2, face - 0.12, z), rot=FRONT)


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


# ------------------------------------------------------------------ the decorations
ETCH_PROUD = 0.05                    # mm: the frosted etching off the shell's outer face
ETCH_LINE, ETCH_PAD = 0.45, 0.65     # mm: its lines' width, its pads' radius
ETCH_CLEAR = 2.0                     # mm it keeps off the deck, the handle's mounts, the knob and every bevel
RING_PROUD = 0.25                    # mm: the Đông Sơn ring's gold off the front plate
# Its edges: 0.3 mm off the bezel's rim, and inside the right speaker's basket rim, which the hero
# camera sees from r 82.78 on (over the plate, just right of the door's pull).
RING_IN, RING_OUT = 75.3, 82.6
# Where the ring opens, degrees counter-clockwise from the door's right as the viewer sees it: round
# the hinge, and under the door, where the hero and the inside cameras see the LCD's frame.
RING_OPEN = ((162.0, 198.0), (235.0, 287.0))
# Its bands from the inside out, radii in mm: a line along its inner edge (RING_LINES), a chain of
# tangent circles (CHAINS: its centre line, its circles' radius, their line's width), the ladder
# (LADDER: its inner rail's edges, its outer rail's; its rungs RUNG_W wide every RUNG_PITCH), the
# birds round BIRD_R, a second chain a little smaller, a line along its outer edge.
RING_LINES = ((RING_IN, RING_IN + 0.4), (RING_OUT - 0.4, RING_OUT))
CHAINS = ((76.47, 0.65, 0.3), (81.48, 0.6, 0.28))
CHAIN_PITCH = 2.0                    # a chain's circles two diameters apart: its links slant 30 degrees
LADDER = (77.24, 77.64, 78.04, 78.44)
RUNG_W, RUNG_PITCH = 0.5, 0.8
BIRD_R = 79.64                       # the birds' band runs 78.44 to 80.84
GROOVE_PROUD = 0.25                  # mm: the frame's lozenge relief


class Relief:
    """Decoration on one face (the shell's, the plinth's, the deck's), merged into one mesh: shapes
    in the face's own frame (a, b) mm, as one sees the face from outside (a to the right, b up),
    standing `h` mm proud of it; with `walls` their sides run down to the face, else each is its top
    alone. `at(a, b, h)` places a point of the frame h mm off the face, in (x, y, z) mm; a `warp`
    maps a shape drawn in other coordinates (the ring's, along its bands) onto the frame. Every
    face is turned to face out, as the page draws these materials' front faces only."""

    def __init__(self, at, h, walls=True):
        self.at, self.h, self.walls = at, h, walls
        self.bm = bmesh.new()

    def _row(self, pts, h):
        return [self.bm.verts.new(mmv(self.at(a, b, h))) for a, b in pts]

    def _sides(self, edges):
        """The walls down from the top's edges (p, q), each with the top on its left."""
        if not self.walls:
            return
        for p, q in edges:
            (tp, tq), (bp, bq) = self._row((p, q), self.h), self._row((p, q), 0.0)
            self.bm.faces.new((bp, bq, tq, tp))

    def _loop(self, loop, hole=False):
        loop = _ccw(list(loop))
        if hole:
            loop = loop[::-1]
        self._sides(zip(loop, loop[1:] + loop[:1]))

    def poly(self, outline, warp=None):
        """A filled outline, no holes, either winding."""
        pts = _ccw([warp(p) for p in outline] if warp else list(outline))
        self.bm.faces.new(self._row(pts, self.h))
        self._loop(pts)

    def disc(self, c, r, seg):
        self.poly(circle(r, seg, cx=c[0], cy=c[1]))

    def ring(self, c, ro, ri, seg):
        outer, inner = circle(ro, seg, cx=c[0], cy=c[1]), circle(ri, seg, cx=c[0], cy=c[1])
        ov, iv = self._row(outer, self.h), self._row(inner, self.h)
        for i in range(seg):
            j = (i + 1) % seg
            self.bm.faces.new((iv[i], ov[i], ov[j], iv[j]))
        self._loop(outer)
        self._loop(inner, hole=True)

    def strip(self, pts, width, closed=False, warp=None, caps=True):
        """A line `width` mm wide along the points, mitred at its bends (closed: round an outline);
        `caps` False leaves its ends' walls out, where it runs into another shape."""
        left, right = offset_path(pts, width / 2, closed), offset_path(pts, -width / 2, closed)
        if warp:
            left, right = [warp(p) for p in left], [warp(p) for p in right]
        if _area([right[0], right[1], left[1], left[0]]) < 0:    # a warp that mirrors it
            left, right = right, left
        lv, rv = self._row(left, self.h), self._row(right, self.h)
        n = len(pts)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            self.bm.faces.new((rv[i], rv[j], lv[j], lv[i]))
        if closed:
            outer, inner = (left, right) if abs(_area(left)) > abs(_area(right)) else (right, left)
            self._loop(outer)
            self._loop(inner, hole=True)
            return
        edges = list(zip(right, right[1:])) + list(zip(left[::-1], left[-2::-1]))
        if caps:
            edges += [(right[-1], left[-1]), (left[0], right[0])]
        self._sides(edges)

    def done(self, name, material, root):
        return from_bm(name, self.bm, [material], smooth=False, parent=root)


def _area(pts):
    """Twice an outline's signed area: positive when it runs counter-clockwise."""
    return sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1]))


# The etching: circuit-maze lines on the shell's sides and top.
STEPS = ((1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1))   # 45 degrees apart


def etch_maze(R, region, blocked, seed, pitch=1.0, fill=0.3):
    """Circuit-maze lines over a face's frame: walks over a `pitch` mm grid inside `region` (a0, b0,
    a1, b1), each from a random cell, going on straight and turning 45 degrees at a time, a cell
    clear of every other line, a pad at either end; `blocked(a, b)` is what they keep off. They
    stop once `fill` of the open cells are taken."""
    a0, b0, a1, b1 = (region[0] + ETCH_PAD, region[1] + ETCH_PAD, region[2] - ETCH_PAD, region[3] - ETCH_PAD)
    cells = [(i, j) for i in range(int((a1 - a0) / pitch) + 1) for j in range(int((b1 - b0) / pitch) + 1)
             if not blocked(a0 + i * pitch, b0 + j * pitch)]
    open_cells = set(cells)
    owner = {}
    rng = random.Random(seed)
    rng.shuffle(cells)

    def clear(c, head):
        """c is open, and nothing taken stands in or round it but the walk's own head."""
        if c not in open_cells:
            return False
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                n = (c[0] + di, c[1] + dj)
                if n in owner and n != head:
                    return False
        return True

    lines, taken = [], 0
    for start in cells:
        if taken >= fill * len(open_cells):
            break
        if not clear(start, None):
            continue
        k = rng.choice((0, 2, 4, 6)) if rng.random() < 0.75 else rng.choice((1, 3, 5, 7))
        path, run, want = [start], 0, rng.randint(8, 40)
        owner[start] = len(lines)
        while len(path) < want:
            turns = [(k + 1) % 8, (k + 7) % 8]
            rng.shuffle(turns)
            order = turns + [k] if run >= 3 and rng.random() < 0.2 else [k] + turns
            for d in order:
                c = (path[-1][0] + STEPS[d][0], path[-1][1] + STEPS[d][1])
                if clear(c, path[-1]):
                    break
            else:
                break                           # boxed in
            run, k = (run + 1 if d == k else 0), d
            path.append(c)
            owner[c] = len(lines)
        if len(path) < 6:
            for c in path:
                del owner[c]
            continue
        lines.append(path)
        taken += len(path)
    seg = 6 if WEB else 16
    for path in lines:
        corners = [c for i, c in enumerate(path) if i in (0, len(path) - 1) or
                   (c[0] - path[i - 1][0], c[1] - path[i - 1][1]) != (path[i + 1][0] - c[0], path[i + 1][1] - c[1])]
        pts = [(a0 + i * pitch, b0 + j * pitch) for i, j in corners]
        ends = (pts[0], pts[-1])
        # Each end stops at its pad's rim: the frosted lines are half clear, and a line drawn over
        # its pad would show through it.
        for at, nxt in ((0, 1), (-1, -2)):
            (px, pz), (qx, qz) = pts[at], pts[nxt]
            t = (ETCH_PAD - 0.04) / math.hypot(qx - px, qz - pz)
            pts[at] = (px + (qx - px) * t, pz + (qz - pz) * t)
        R.strip(pts, ETCH_LINE)
        for c in ends:
            R.disc(c, ETCH_PAD, seg)


def clear_etch(name, root):
    """Frosted circuit-maze lines (`etch`) on the shell's two side faces and its top, 0.05 mm proud
    of the band, never on the front plate, where the inside must stay readable: on the flat of each
    face, ETCH_CLEAR off its bevels, and on the top off the keys' deck, the handle's mounts, the knob
    and the tag's cord. One mesh per face, `<name>_etch_left`, `_right` and `_top`."""
    flat_y = IN_B - 0.5 - ETCH_CLEAR                       # the band's bevel at either plate
    flat_z = (Z0 + BODY_R + ETCH_CLEAR, Z1 - BODY_R - ETCH_CLEAR)
    for side, sx, seed in (("left", -1, 11), ("right", 1, 12)):
        # The frame as one sees the face from outside: a toward the viewer's right, b up.
        R = Relief(lambda a, b, h, sx=sx: (sx * (BODY_W / 2 + h), sx * a, b), ETCH_PROUD, walls=False)
        etch_maze(R, (-flat_y, flat_z[0], flat_y, flat_z[1]), lambda a, b: False, seed)
        R.done("%s_etch_%s" % (name, side), M["etch"], root)
    m = ETCH_CLEAR + ETCH_PAD                              # off each part, from a pad's middle
    cord = ((TAG_CORD_X, FRONT_Y), *CORD_ON_TOP,
            (HANDLE_X + 6.0, CORD_UPRIGHT_Y))              # clear_tag's cord where it lies on the top

    def blocked(x, y):
        if abs(x) <= DECK_W / 2 + m and abs(y - KEY_Y) <= DECK_D / 2 + m:         # the keys' deck
            return True
        if abs(abs(x) - HANDLE_X) <= HANDLE_MOUNT[0] / 2 + m and abs(y - HANDLE_Y) <= HANDLE_MOUNT[1] / 2 + m:   # the handle's mounts
            return True
        if math.hypot(x - KNOB_X, y - KNOB_Y) <= KNOB_RING + m:
            return True
        return any(_point_segment((x, y), p, q) <= 0.9 + m for p, q in zip(cord, cord[1:]))
    R = Relief(lambda a, b, h: (a, b, Z1 + h), ETCH_PROUD, walls=False)
    x1 = BODY_W / 2 - BODY_R - ETCH_CLEAR
    etch_maze(R, (-x1, -flat_y, x1, flat_y), blocked, 13)
    R.done(name + "_etch_top", M["etch"], root)


# The Đông Sơn ring round the door.
def _on_ring(r, deg):
    """The point r mm from the door's centre, deg degrees counter-clockwise from its right: (x, z)."""
    a = math.radians(deg)
    return (r * math.cos(a), DOOR_Z + r * math.sin(a))


def _polar(r_ref):
    """(u, v) mm along a band of the ring -> the front plate's (x, z): u clockwise round the circle of
    radius r_ref from the door's right, v out from it (a shape keeps its winding)."""
    def warp(p):
        a, r = -p[0] / r_ref, r_ref + p[1]
        return (r * math.cos(a), DOOR_Z + r * math.sin(a))
    return warp


# A Lạc bird, 16.2 mm long and 2.24 across its wings, in (u, v) mm along its band: flying toward -u
# (counter-clockwise round the ring), its back outward. The long beak, the crest's two plumes, the
# neck, the wings spread out and in with three feathers at each trailing edge, the tail's three
# long feathers; once round, counter-clockwise, from the beak's tip along its belly.
BIRD = ((-8.0, 0.0), (-4.95, -0.16), (-4.6, -0.3), (-3.8, -0.3), (-2.9, -0.3), (-2.0, -0.42), (-1.5, -0.45),
        (-1.0, -0.76), (-0.3, -0.99), (0.5, -1.1), (1.3, -1.12), (1.0, -0.9), (1.65, -0.88), (1.3, -0.66),
        (1.95, -0.62), (1.6, -0.45), (2.2, -0.41), (2.9, -0.36), (3.5, -0.28), (8.2, -0.74), (5.8, -0.14),
        (7.6, 0.0), (5.8, 0.14), (8.2, 0.74), (3.5, 0.28), (2.9, 0.36), (2.2, 0.41), (1.6, 0.45), (1.95, 0.62),
        (1.3, 0.66), (1.65, 0.88), (1.0, 0.9), (1.3, 1.12), (0.5, 1.1), (-0.3, 0.99), (-1.0, 0.76),
        (-1.5, 0.45), (-2.0, 0.42), (-2.9, 0.3), (-3.6, 0.33), (-2.6, 0.78), (-3.9, 0.54), (-2.3, 1.1),
        (-4.45, 0.5), (-4.8, 0.36), (-4.95, 0.16))


def _spread(spans, n, start):
    """n angles (degrees) evenly along the spans taken end to end, the first `start` degrees in."""
    total = sum(b - a for a, b in spans)
    out = []
    for k in range(n):
        s = start + total * k / n
        for a, b in spans:
            if s < b - a:
                out.append(a + s)
                break
            s -= b - a
    return out


def ring_chain(R, spans, rc, rad, line, seg):
    """A chain of tangent circles round the ring on the circle rc, after the drum's: rings of
    radius `rad` mm in a `line` mm line, each round its centre dot, CHAIN_PITCH diameters apart (as
    many to a full turn as fit), each linked to the next by the line tangent to both rims, from
    one's outer side to the other's inner side, slanting 30 degrees; at a bar the chain ends in the
    link to the circle that would stand beyond it."""
    pitch = 360.0 / round(2 * math.pi * rc / (CHAIN_PITCH * 2 * rad))
    warp = _polar(rc)

    def u(deg):
        return -math.radians(deg) * rc
    for b0, b1 in spans:
        margin = math.degrees((rad + 0.3) / rc)
        degs = [pitch * k for k in range(int(math.ceil((b0 + margin) / pitch)), int((b1 - margin) // pitch) + 1)]
        for deg in degs:
            R.ring(_on_ring(rc, deg), rad, rad - line, seg)
            R.disc(_on_ring(rc, deg), rad * 0.3, max(6, seg // 2))
        for d0, d1 in zip([degs[0] - pitch] + degs, degs + [degs[-1] + pitch]):
            u1, u2 = u(d1), u(d0)           # u runs clockwise: d1's circle comes first
            cb = 2 * rad / (u2 - u1)
            sb = math.sqrt(1.0 - cb * cb)
            t1, t2 = (u1 + rad * cb, rad * sb), (u2 - rad * cb, -rad * sb)
            lo, hi = max(t1[0], u(b1)), min(t2[0], u(b0))       # within the bars
            if hi - lo < 0.1:
                continue
            n = max(1, int(math.ceil((hi - lo) / (4.0 if WEB else 2.0))))
            pts = []
            for i in range(n + 1):
                uu = lo + (hi - lo) * i / n
                pts.append((uu, t1[1] + (t2[1] - t1[1]) * (uu - t1[0]) / (t2[0] - t1[0])))
            R.strip(pts, line, warp=warp)


def clear_dongson_ring(name, root):
    """A Đông Sơn ring round the door, after the Ngọc Lũ drum's face: gold relief 0.25 mm proud of
    the front plate from RING_IN to RING_OUT, bold enough to read as a band from the page's camera.
    From the inside out a line, a chain of tangent circles, a ladder whose rungs leave slots between
    them, eight Lạc birds flying counter-clockwise, a smaller chain and a line. It opens round the
    hinge and over the LCD (RING_OPEN), each band ending at a bar across the ring, and runs under the
    door's pull; the door swings clear of it. One mesh, `<name>_dongson_ring`; the web build leaves
    out its walls and draws its circles with fewer sides."""
    R = Relief(lambda a, b, h: (a, FRONT_Y - h, b), RING_PROUD, walls=not WEB)
    step = 2.0 if WEB else 1.0             # degrees per segment along a band
    bar = 0.45
    (h0, h1), (l0, l1) = RING_OPEN
    pad = math.degrees(bar / 2 / RING_IN)
    spans = [(a0 + pad, a1 - pad) for a0, a1 in ((h1, l0), (l1, h0 + 360.0))]   # between the bars' middles
    rail_in, rail_out = (LADDER[0] + LADDER[1]) / 2, (LADDER[2] + LADDER[3]) / 2
    for b0, b1 in spans:
        for deg in (b0, b1):
            R.strip([_on_ring(RING_IN, deg), _on_ring(RING_OUT, deg)], bar)
        for r0, r1 in RING_LINES + (LADDER[:2], LADDER[2:]):
            rc = (r0 + r1) / 2
            n = max(2, int(math.ceil((b1 - b0) / step)))
            R.strip([(-math.radians(b0 + (b1 - b0) * i / n) * rc, 0.0) for i in range(n + 1)], r1 - r0,
                    warp=_polar(rc), caps=False)
        # The ladder's rungs, about RUNG_PITCH apart, from one rail's middle to the other's.
        n = int(math.radians(b1 - b0) * (rail_in + rail_out) / 2 / RUNG_PITCH)
        for k in range(1, n):
            deg = b0 + (b1 - b0) * k / n
            R.strip([_on_ring(rail_in, deg), _on_ring(rail_out, deg)], RUNG_W, caps=False)
    for rc, rad, line in CHAINS:
        ring_chain(R, spans, rc, rad, line, 10 if WEB else 24)
    # The birds every 34 degrees along the two spans taken end to end, the first 23 degrees in: none
    # cut by an opening, none under the door's pull (at 0 degrees, 5.4 to either side).
    # The bird spans BIRD's own extent in u (beak at the least, tail at the greatest), and u grows
    # clockwise: in degrees it covers `behind` below its position and `ahead` above it.
    behind = math.degrees(max(u for u, _ in BIRD) / BIRD_R)
    ahead = math.degrees(-min(u for u, _ in BIRD) / BIRD_R)
    warp = _polar(BIRD_R)
    for deg in _spread(spans, 8, 23.0):
        at = (deg + 180.0) % 360.0 - 180.0
        clear_of_pull = at - behind > 5.4 or at + ahead < -5.4
        if not clear_of_pull or not any(b0 + 1.0 <= deg - behind and deg + ahead <= b1 - 1.0 for b0, b1 in spans):
            raise SystemExit("clear.py: the Lạc bird at %.1f degrees is cut by an opening or under the pull" % deg)
        uc = -math.radians(deg) * BIRD_R
        R.poly([(uc + u, v) for u, v in BIRD], warp=warp)
    return R.done(name + "_dongson_ring", M["gold"], root)


# The frame's grooves.
def lozenges(R, x0, x1, yc, h, n, line, hatch, gap):
    """A chain of n lozenges tip to tip from x0 to x1 along b = yc, h mm tall: each outlined in `line`
    mm and hatched with `hatch` mm lines about `gap` mm apart, parallel to the side up from its left
    tip, the next one's to the side down from it."""
    w = (x1 - x0) / n
    for k in range(n):
        cx = x0 + w * (k + 0.5)
        quad = [(cx - w / 2, yc), (cx, yc - h / 2), (cx + w / 2, yc), (cx, yc + h / 2)]
        R.strip(quad, line, closed=True)
        inner = offset_path(quad, line / 2 - 0.02, closed=True)   # just under the outline's inner edge
        left = Vector(quad[0])
        d = Vector((w / 2, (h / 2) * (1 if k % 2 == 0 else -1))).normalized()
        across = Vector((d.y, -d.x)) if k % 2 == 0 else Vector((-d.y, d.x))   # into the lozenge
        span = (w * h / 2) / math.hypot(w / 2, h / 2)                  # from that side to the opposite one
        lines = max(1, int(round((span - line) / gap)))
        for i in range(lines):
            o = left + across * (line / 2 + (span - line) * (i + 0.5) / lines)
            seg = clip_segment(tuple(o - d * w), tuple(o + d * w), inner)
            if seg and math.dist(*seg) > 2 * hatch:
                R.strip(list(seg), hatch, caps=False)


def clear_grooves(name, root):
    """Lozenge chains with diagonal hatching, a Đông Sơn motif, in relief (GROOVE_PROUD) of the
    frame's own material: on the plinth's front either side of the nameplate, between two rails,
    and along the keys' deck's top in front of the keys and behind them, between the holes and the
    deck's edges. `<name>_grooves_plinth` and `<name>_grooves_deck`."""
    F = M["clear_frame"]
    face = PLINTH_Y - PLINTH_D / 2
    R = Relief(lambda a, b, h: (a, face - h, b), GROOVE_PROUD)
    zc = (FOOT_H + PLINTH_H) / 2              # the nameplate's middle
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 86.0, sx * 145.0))   # off the plate (82) and the plinth's rounded corner (147)
        for s in (-1, 1):
            R.strip([(x0, zc + s * 6.0), (x1, zc + s * 6.0)], 0.6)
        lozenges(R, x0, x1, zc, 9.0, 4, 0.5, 0.35, 1.1)
    R.done(name + "_grooves_plinth", F, root)
    # The deck (clear_keys) is DECK_D deep round KEY_Y, its holes KEY_HOLE_D, every edge bevelled 0.6: each
    # rim runs 7.7 to 12 mm off KEY_Y, its flat's middle DECK_RIM_Y (9.85) mm off it; its straight ends
    # at x = +-79.
    R = Relief(lambda a, b, h: (a, b, Z1 + 2.05 + h), GROOVE_PROUD)
    for s in (-1, 1):
        lozenges(R, -DECK_GROOVE_X, DECK_GROOVE_X, KEY_Y + s * DECK_RIM_Y, 2.2, 43, 0.28, 0.2, 0.62)
    R.done(name + "_grooves_deck", F, root)


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

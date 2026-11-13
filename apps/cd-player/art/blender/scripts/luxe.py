"""Luxe: a lacquer and metal turntable, its record stand beside it and the playing record's sleeve
on a ledge behind it (art/blender/scripts/build_luxe.py names what the page drives; hero.py renders
it when CDP_MODEL=luxe).

Needs cdkit's, parts.py's and vinyl.py's namespace (exec'd after them), and is followed into it by
luxe_arm.py (the tonearm) and luxe_stand.py (the record stand and the ledge), which
make_luxe_player calls, so all three are exec'd before it runs. Blender's axes as in parts.py: x
right, y away from the viewer (the front faces -y), z up, millimetres through L(x, y, z). The
deck's footprint is centred on the origin, standing on the floor on its four feet; the stand stands
on its right, square to it, the ledge behind it, behind the platter.

The plinth is two lacquered tiers with rounded corners, a thin metal band proud round the top edge
of each, a metal frame along the top's outline, on four metal feet ringed in rubber (luxe_plinth).
Left of centre the platter (`<name>_platter`, its local Z up, which the page turns) stands on its
bearing: a dark body, a metal rim with a band of strobe dots round its side, the mat and the
spindle; the record lies on the mat. Round the platter's foot the LED ring (vinyl.py's led_ring)
lies flat on the top. At the front left the square start key, beside it a row of five small round
metal keys with engraved icons; a knurled metal knob at the back left is decor; the ncam logo
stands at the front right. The tonearm (luxe_arm.py) stands at the back right.

Every part of the deck hangs from the body group (`<name>_deck_body`, the keys and the LED ring
included) but the platter, the record and the tonearm, which hang from the player's root, as the
stand, the ledge and the sleeve do.

Its colours come from src/luxe-looks.json (luxe_look): build_luxe_materials(look) makes the body's,
the metal's and the light's materials and the fixed ones. The web build (WEB) carries what the page
drives at rest: the arm on its rest, the record on the platter, the sleeve on the ledge, the five
rack slots empty, one ring mesh whose UVs the page paints, both of the play key's icons, the arm's
hit shape; a render (not WEB) plays: the arm down 30 % of the way in, 30 of the ring's 48 lit, ‖
alone on the play key, five sleeves in the stand.
"""
import json
import math
import os
import re

import bmesh
from mathutils import Matrix

LUXE_PARTS = ("body", "metal", "light")
LUXE_DEFAULT = {"body": "pink", "metal": "gold", "light": "pink"}
# What this script reads of each part's swatches, beside their `id`: an sRGB hex, or a number.
LUXE_FIELDS = {"body": {"colour": "hex", "metalness": "number", "roughness": "number", "coat": "number"},
               "metal": {"colour": "hex", "metalness": "number", "roughness": "number"},
               "light": {"glow": "hex"}}
LUXE_HEX = re.compile(r"#[0-9a-fA-F]{6}")


def _luxe_field_ok(value, kind):
    if kind == "hex":
        return isinstance(value, str) and LUXE_HEX.fullmatch(value) is not None
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def luxe_swatches():
    """src/luxe-looks.json's swatches, part -> id -> swatch. It stops the run, naming the file and
    what is wrong, unless every part is a list of swatches, each with an id and the fields this
    script reads (LUXE_FIELDS): a part or a field it lacked would otherwise fail later, as a
    traceback."""
    path = os.path.normpath(os.path.join(_scripts_dir(), "..", "..", "..", "src", "luxe-looks.json"))
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise SystemExit("luxe.py: cannot read %s (%s: %s)" % (path, type(err).__name__, err))
    if not isinstance(data, dict):
        raise SystemExit("luxe.py: %s must be an object with the parts %s" % (path, ", ".join(LUXE_PARTS)))
    swatches = {}
    for part in LUXE_PARTS:
        listed = data.get(part)
        if not isinstance(listed, list) or not listed:
            raise SystemExit("luxe.py: %s has no %s swatches (a non-empty list)" % (path, part))
        swatches[part] = {}
        for i, swatch in enumerate(listed):
            if not isinstance(swatch, dict):
                raise SystemExit("luxe.py: %s: %s swatch %d is not an object (%r)" % (path, part, i, swatch))
            sid = swatch.get("id")
            if not isinstance(sid, str) or not sid:
                raise SystemExit("luxe.py: %s: %s swatch %d has no id" % (path, part, i))
            for field, kind in LUXE_FIELDS[part].items():
                if not _luxe_field_ok(swatch.get(field), kind):
                    raise SystemExit("luxe.py: %s: %s %r has no %s %s (%r)" % (
                        path, part, sid, "#rrggbb" if kind == "hex" else "numeric", field, swatch.get(field)))
            swatches[part][sid] = swatch
    return swatches


def luxe_look(spec=None):
    """A look from "body,metal,light" (hero.py's CDP_LUXE_LOOK); None is the default. Returns the
    swatches by part and their ids."""
    swatches = luxe_swatches()
    if spec is None:
        ids = dict(LUXE_DEFAULT)
    else:
        parts = spec.split(",")
        if len(parts) != len(LUXE_PARTS):
            raise SystemExit("luxe.py: CDP_LUXE_LOOK needs body,metal,light: %r" % spec)
        ids = dict(zip(LUXE_PARTS, parts))
    for part, sid in ids.items():
        if sid not in swatches[part]:
            raise SystemExit("luxe.py: CDP_LUXE_LOOK: no %s %r (%s)" % (part, sid, ", ".join(swatches[part])))
    return {part: swatches[part][ids[part]] for part in LUXE_PARTS}, ids


# ------------------------------------------------------------------ materials
def _luxe_hex(h):
    """'#rrggbb' -> linear RGBA, as parts.py turns its palettes (lin(*hexrgb(h)))."""
    return lin(*hexrgb(h))


def build_luxe_materials(look):
    """Luxe's materials on top of build_materials() (its rubber, ink and black glass): the body's
    lacquer, the metal and the light from the look's swatches, and the fixed ones (the vinyl, the
    mat, the strobe's dark, the teal cartridge, the sleeve's paper, the arm's hit shape, the ring
    the page paints)."""
    build_materials()
    body, metal, light = (look[p] for p in LUXE_PARTS)
    glow = _luxe_hex(light["glow"])
    M["luxe_body"] = mat("luxe_body", _luxe_hex(body["colour"]), metal=float(body["metalness"]),
                         rough=float(body["roughness"]), coat=float(body["coat"]), coat_rough=0.05)
    M["luxe_metal"] = mat("luxe_metal", _luxe_hex(metal["colour"]), metal=float(metal["metalness"]),
                          rough=float(metal["roughness"]))
    # The play key's icons: lit in the light's glow. The page reads a light's colour from its
    # emissive (an `emissive` role), and the web build's base colour is the glow too.
    M["luxe_light"] = mat("luxe_light", glow if WEB else (0, 0, 0, 1), emit=glow, emit_s=1.0 if WEB else 4.0)
    M["vinyl"] = mat("vinyl", lin(8, 8, 9), rough=0.18, coat=1.0, coat_rough=0.08)
    M["platter_mat"] = mat("platter_mat", lin(28, 26, 28), rough=0.95)
    M["strobe"] = mat("strobe", lin(20, 20, 22), rough=0.45)
    M["cartridge"] = mat("cartridge", lin(24, 128, 126), rough=0.35)
    M["sleeve_paper"] = mat("sleeve_paper", lin(236, 232, 226), rough=0.7)
    M["arm_hit"] = mat("arm_hit", (1.0, 0.0, 1.0, 1.0), rough=1.0)   # the page draws it nowhere (role hit)
    M["jog_ring"] = mat("jog_ring", (0.02, 0.02, 0.02, 1), rough=0.3)   # plain: the page paints it
    if not WEB:
        # Render-only: the ring's lit and dim segments, as the Deck's (a dim one at 12 % of the glow
        # over black, which reads as unlit under AgX).
        M["ring_on"] = mat("ring_on", (0, 0, 0, 1), emit=glow, emit_s=6.0)
        M["ring_dim"] = mat("ring_dim", (0, 0, 0, 1), emit=glow, emit_s=0.12)
    return M


# ------------------------------------------------------------------ dimensions (mm)
LX_W = 450                          # the lower tier's width and depth
LX_D = 380
LX_FOOT = 18                        # the feet: the lower tier's underside stands this high
LX_TIER = 58                        # the lower tier's top, the upper tier's underside
LX_TOP = 80                         # the upper tier's top: the deck's top panel
LX_SPINDLE = (-45.0, 10.0)          # the platter's axis, left of centre
LX_PLATTER_Z = 84                   # the platter's underside, on its bearing
LX_PLATTER_R = 155                  # the platter: about 310 mm across
LX_MAT_TOP = 100.8                  # the mat's top: the record's underside
LX_RECORD_Z = 101.7                 # the record's mid-plane
LX_RECORD_TOP = 102.6               # the record's top: where the needle rides
LX_RING = (159.0, 165.0)            # the LED ring round the platter's foot
LX_RING_Z = 80.05
LX_UPPER = (LX_W - 16, LX_D - 16)   # the upper tier, 8 mm in from the lower all round
LX_CORNER = (24.0, 18.0)            # the tiers' corners' radii in plan
LX_FRAME = 6.0                      # the metal frame along the top's outline
LX_BAND = (3.0, 0.8)                # the bands round each tier's top edge: height, how far proud
LX_FEET = (180.0, 150.0)            # the feet's centres, x and y either side of the middle
LX_STROBE = (180, 155.7, 8.0)       # the strobe dots: how many, their radius, their height on the platter
LX_PLAY_KEY = (-185.0, -160.0)      # the square start key
# The round keys, left to right beside it.
LX_KEYS = (("prev", -146.0, -168.0), ("next", -124.0, -168.0), ("stop", -102.0, -168.0),
           ("rpt", -80.0, -168.0), ("mode", -58.0, -168.0))
LX_KNOB = (-195.0, 160.0)           # the decor knob, back left
LX_LOGO = (150.0, -172.0, 81.25)    # the ncam logo, front right: its letters' face


# ------------------------------------------------------------------ the plinth
def luxe_plinth(name, body):
    """The plinth under the body group: four metal feet ringed in rubber, the lower and the upper
    lacquered tiers, a metal band proud round the top edge of each, the metal frame along the top's
    outline, and the bearing the platter turns on."""
    seg = 8 if WEB else 12
    fx, fy = LX_FEET
    for sx in (-1, 1):
        for sy in (-1, 1):
            at = L(sx * fx, sy * fy, 0.0)
            lathe("%s_foot_%d%d" % (name, sx, sy), [(0.01, 0.0), (14.4, 0.0), (15.0, 0.6), (15.0, LX_FOOT),
                                                    (0.01, LX_FOOT)], M["luxe_metal"], seg=64, parent=body, loc=at)
            lathe("%s_foot_ring_%d%d" % (name, sx, sy), [(14.9, 6.0), (15.5, 6.0), (15.5, 8.0), (14.9, 8.0)],
                  M["rubber"], seg=64, parent=body, loc=at)
    uw, ud = LX_UPPER
    rl, ru = LX_CORNER
    slab(name + "_tier_lower", [rrect(LX_W, LX_D, rl, seg=seg)], LX_FOOT, LX_TIER, M["luxe_body"], bevel_mm=1.2,
         parent=body)
    slab(name + "_tier_upper", [rrect(uw, ud, ru, seg=seg)], LX_TIER, LX_TOP, M["luxe_body"], bevel_mm=1.2,
         parent=body)
    bh, bp = LX_BAND
    for tier, w, d, r, z1 in (("lower", LX_W, LX_D, rl, LX_TIER - 1.0), ("upper", uw, ud, ru, LX_TOP - 1.0)):
        slab("%s_band_%s" % (name, tier), [rrect(w + 2 * bp, d + 2 * bp, r + bp, seg=seg), rrect(w, d, r, seg=seg)],
             z1 - bh, z1, M["luxe_metal"], bevel_mm=0.0 if WEB else 0.2, parent=body)
    f = LX_FRAME
    slab(name + "_frame", [rrect(uw, ud, ru, seg=seg), rrect(uw - 2 * f, ud - 2 * f, ru - f, seg=seg)], LX_TOP,
         LX_TOP + 1.2, M["luxe_metal"], bevel_mm=0.0 if WEB else 0.3, parent=body)
    cx, cy = LX_SPINDLE
    lathe(name + "_bearing", [(0.01, LX_TOP), (40.0, LX_TOP), (40.0, LX_PLATTER_Z - 0.6), (39.4, LX_PLATTER_Z),
                              (0.01, LX_PLATTER_Z)], M["luxe_metal"], seg=128, parent=body, loc=L(cx, cy, 0.0))


# ------------------------------------------------------------------ the platter and the record
def _strobe_dots(name, parent):
    """The strobe dots round the platter's side, one mesh: LX_STROBE's count of small blocks
    (1.6 mm along the side, 0.3 mm deep, 1.6 mm high), evenly round at its radius and height."""
    count, r, z = LX_STROBE
    bm = bmesh.new()
    for k in range(count):
        a = 2.0 * math.pi * k / count
        vs = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.scale(bm, vec=(0.3 * MM, 1.6 * MM, 1.6 * MM), verts=vs)   # radial, along the side, up
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Z"), verts=vs)
        bmesh.ops.translate(bm, vec=(r * math.cos(a) * MM, r * math.sin(a) * MM, z * MM), verts=vs)
    return from_bm(name, bm, [M["luxe_metal"]], smooth=False, parent=parent)


def luxe_platter(name, root):
    """The platter (`<name>_platter`, an empty on the bearing, its local Z up, which the page turns)
    under the root: its dark body, the metal rim, the strobe band and its dots round the rim's
    side, the mat (`<name>_platter_mat`) and the spindle's pin through the record's hole."""
    cx, cy = LX_SPINDLE
    platter = empty(name + "_platter", L(cx, cy, LX_PLATTER_Z), parent=root)
    lathe(name + "_platter_body", [(0.01, 0.0), (151.0, 0.0), (151.0, 16.0), (0.01, 16.0)], M["strobe"], seg=192,
          parent=platter)
    lathe(name + "_platter_rim", [(151.0, 0.0), (155.5, 0.0), (155.5, 15.4), (154.9, 16.0), (151.0, 16.0)],
          M["luxe_metal"], seg=192, parent=platter)
    lathe(name + "_platter_band", [(155.5, 3.0), (155.6, 3.0), (155.6, 13.0), (155.5, 13.0)], M["strobe"], seg=192,
          parent=platter)
    _strobe_dots(name + "_platter_strobe", platter)
    lathe(name + "_platter_mat", [(0.01, 16.0), (150.0, 16.0), (150.0, 16.8), (0.01, 16.8)], M["platter_mat"],
          seg=192, parent=platter)
    lathe(name + "_platter_spindle", [(0.01, 16.0), (3.6, 16.0), (3.6, 27.2), (3.0, 28.0), (0.01, 28.0)],
          M["luxe_metal"], seg=32, parent=platter)
    return platter


# ------------------------------------------------------------------ the keys
def _luxe_scaled(shapes, s):
    """Icon outlines (mm round the cap's centre), scaled by s."""
    return [[(px * s, py * s) for px, py in shape] for shape in shapes]


def _arc(r0, r1, a0, a1, steps=16):
    """An annulus sector r0..r1 from a0 to a1 degrees (counter-clockwise from +X) as one outline:
    its outer edge a0 -> a1, then its inner edge back."""
    angles = [math.radians(a0 + (a1 - a0) * i / steps) for i in range(steps + 1)]
    return ([(r1 * math.cos(a), r1 * math.sin(a)) for a in angles]
            + [(r0 * math.cos(a), r0 * math.sin(a)) for a in reversed(angles)])


def luxe_key_icon(kind):
    """Repeat and shuffle, drawn, not lettered: a loop arrow, and two crossing arrows. Each
    outline is its own slab (the shuffle's bars cross: one curve would cut their crossing out)."""
    if kind == "rpt":
        return [_arc(1.8, 2.6, 60.0, 330.0), [(0.7, 1.21), (1.5, 2.6), (1.99, 0.93)]]
    if kind == "mode":
        return [[(-2.6, -1.9), (-2.6, -1.1), (1.2, 1.5), (1.2, 0.7)], [(1.0, 2.2), (2.8, 1.1), (1.0, 0.0)],
                [(-2.6, 1.9), (-2.6, 1.1), (1.2, -1.5), (1.2, -0.7)], [(1.0, -2.2), (2.8, -1.1), (1.0, 0.0)]]
    return button_icon(kind)


def luxe_keys(name, body, playing):
    """The keys, each an empty on the top (the page sinks it) holding its metal cap and its icon:
    the square start key at the front left (`<name>_btn_play`, ▶ and ‖ lit in the light; a render
    prints ‖ alone, as it plays) in its rubber surround, and beside it the row of round keys (prev,
    next, stop, repeat, shuffle), each in its rubber gap, its icon engraved on the cap in ink."""
    x, y = LX_PLAY_KEY
    key = empty(name + "_btn_play", L(x, y, LX_TOP), parent=body)
    h = 7.0
    rbox(name + "_btn_play_cap", (30.0, 30.0, h), M["luxe_metal"], bevel_mm=2.0, parent=key, loc=L(0.0, 0.0, h / 2))
    slab(name + "_btn_play_gap", [rrect(34.0, 34.0, 5.0, cx=x, cy=y), rrect(31.0, 31.0, 4.0, cx=x, cy=y)], LX_TOP,
         LX_TOP + 0.04, M["rubber"], parent=body)
    if WEB or not playing:
        slab(name + "_btn_play_icon_play", _luxe_scaled(button_icon("play"), 2.6), h + 0.02, h + 0.12,
             M["luxe_light"], parent=key)
    if WEB or playing:
        slab(name + "_btn_play_icon_pause", _luxe_scaled(button_icon("pause"), 2.6), h + 0.02, h + 0.12,
             M["luxe_light"], parent=key)
    h = 5.0
    for kind, x, y in LX_KEYS:
        key = empty("%s_btn_%s" % (name, kind), L(x, y, LX_TOP), parent=body)
        lathe("%s_btn_%s_cap" % (name, kind), [(0.01, 0.0), (7.0, 0.0), (7.0, h - 0.5), (6.5, h), (0.01, h)],
              M["luxe_metal"], seg=64, parent=key)
        annulus("%s_btn_%s_gap" % (name, kind), 9.2, 7.6, M["rubber"], z_mm=LX_TOP + 0.03, seg=64, parent=body,
                loc=L(x, y, 0.0))
        shapes = _luxe_scaled(luxe_key_icon(kind), 1.5)
        if kind in ("rpt", "mode"):
            for i, shape in enumerate(shapes):
                slab("%s_btn_%s_icon_%d" % (name, kind, i), [shape], h + 0.02, h + 0.1, M["ink"], parent=key)
        else:
            slab("%s_btn_%s_icon" % (name, kind), shapes, h + 0.02, h + 0.1, M["ink"], parent=key)


# ------------------------------------------------------------------ the decor
def luxe_decor(name, body):
    """The knurled metal knob at the back left (decor: a plain mesh the page drives nothing of) and
    the ncam logo at the front right, its metal letters standing on the top, their face at
    LX_LOGO's height."""
    kx, ky = LX_KNOB
    # 48 ridges: lathe ridges every other segment, and the web build halves the segments.
    lathe(name + "_knob_decor", [(0.01, LX_TOP), (13.0, LX_TOP), (13.0, LX_TOP + 13.2), (12.2, LX_TOP + 14.0),
                                 (0.01, LX_TOP + 14.0)], M["luxe_metal"], seg=192 if WEB else 96, ridge=({1, 2}, 0.3),
          parent=body, loc=L(kx, ky, 0.0))
    lx, ly, lz = LX_LOGO
    depth = lz - (LX_TOP - 0.1)   # down to just under the top, so no face lies on it
    text(name + "_logo", "ncam", 6.0, M["luxe_metal"], font="futura", extrude_mm=depth / 2, parent=body,
         loc=L(lx, ly, lz - depth / 2))


# ------------------------------------------------------------------ the whole Luxe
def make_luxe(name, root, look, playing, disc_label=None):
    """The deck under `root`: the body group (`<name>_deck_body`: the plinth, the LED ring, the keys,
    the knob and the logo), the platter and the record on it (`<name>_disc`, its label in
    `disc_label`, the web build's art_disc unless given). `look` is the swatches (luxe_look):
    build_luxe_materials made the materials from it; the geometry is the same for every look."""
    body = empty(name + "_deck_body", L(0, 0, 0), parent=root)
    luxe_plinth(name, body)
    led_ring(name, body, LX_SPINDLE, LX_RING[0], LX_RING[1], LX_RING_Z, playing)
    luxe_keys(name, body, playing)
    luxe_decor(name, body)
    luxe_platter(name, root)
    cx, cy = LX_SPINDLE
    make_record(name + "_disc", disc_label if disc_label is not None else M["art_disc"], L(cx, cy, LX_RECORD_Z),
                parent=root)
    return body


def make_luxe_player(name, disc_label, sleeve_art, look, rack_sleeves=None, playlist="Top 50 · Global"):
    """The whole Luxe under the empty `name`: the deck, its tonearm (luxe_arm.py), the record stand
    beside it and the ledge behind it (luxe_stand.py), and the playing record's sleeve on the ledge
    (`<name>_sleeve`, printed in `sleeve_art`). A render (not WEB) plays: the arm down 30 % of the
    way in, 30 of the ring's 48 lit, ‖ alone on the play key, five sleeves in the stand
    (`rack_sleeves`)."""
    playing = not WEB
    root = empty(name, L(0, 0, 0))
    make_luxe(name, root, look, playing, disc_label)
    luxe_tonearm(name, root, playing)
    make_stand(name + "_stand", root, rack_sleeves, playlist, WEB)
    make_ledge(name + "_ledge", root)
    # Leaning back 15 degrees on the ledge: its front face's bottom edge just behind the lip (its
    # mid-thickness 1.6 mm behind it), 0.5 mm over the bar, its back 0.4 mm off the legs; its
    # middle over the ledge's.
    make_sleeve(name + "_sleeve", sleeve_art, L(LEDGE_AT[0], LEDGE_AT[1] + 44.7, 158.2), (math.radians(75), 0, 0),
                parent=root)
    return root

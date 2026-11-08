"""The Deck: a top-loading DJ CD deck whose clear acrylic jog plate lies over the spinning disc
(art/blender/scripts/build_deck.py names what the page drives; hero.py renders it when
CDP_MODEL=deck).

Needs cdkit's and parts.py's namespace (exec'd after them), and is followed into it by
deck_case.py (the flight case and the jewel case), which make_deck_player calls, so both are
exec'd before it runs. Blender's axes as in parts.py: x right, y away from the viewer (the front
faces -y), z up, millimetres through L(x, y, z). The deck's footprint is centred on the origin,
standing on the floor on its four feet; the flight case stands on its right, the jewel case lies
in front of the case.

The body is one rounded box with the jog's well cut into its top (deck_chassis). Along its back
a raised display bay tilts its glass face 12 degrees toward the viewer: the LCD, the VU strip and
the ncam logo. Right of centre the well holds the disc on its spindle and the laser's arm; over
it the acrylic plate (the contract's knob, its ridged side ring and its centre cap) hangs from
its hinge at the well's back edge (door_hinge), the hinge's local X along the world's X, so the
plate lifts about it. Round the well the LED ring (jog_ring) lies flat on the top. The keys stand
in a column on the left, the tempo fader (decor) at the front right.

Its colours come from src/deck-looks.json (deck_look): build_deck_materials(look) makes the
body's and the light's materials and the fixed ones. The web build (WEB) carries what the page
drives at rest: the plate shut, the arm beside the disc, the prints as plain planes, one ring
mesh whose UVs the page paints; a render (not WEB) plays: the arm over the disc, the LCD lit,
seven VU segments and 30 of the ring's 48 lit, ‖ alone on the play key.
"""
import json
import math
import os
import re

import bmesh

DECK_PARTS = ("body", "light")
DECK_DEFAULT = {"body": "black", "light": "ice"}
# What this script reads of each part's swatches, beside their `id`: an sRGB hex, or a number.
DECK_FIELDS = {"body": {"colour": "hex", "metalness": "number", "roughness": "number"},
               "light": {"glow": "hex"}}
DECK_HEX = re.compile(r"#[0-9a-fA-F]{6}")


def _deck_field_ok(value, kind):
    if kind == "hex":
        return isinstance(value, str) and DECK_HEX.fullmatch(value) is not None
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def deck_swatches():
    """src/deck-looks.json's swatches, part -> id -> swatch. It stops the run, naming the file and
    what is wrong, unless every part is a list of swatches, each with an id and the fields this
    script reads (DECK_FIELDS): a part or a field it lacked would otherwise fail later, as a
    traceback."""
    path = os.path.normpath(os.path.join(_scripts_dir(), "..", "..", "..", "src", "deck-looks.json"))
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as err:
        raise SystemExit("deck.py: cannot read %s (%s: %s)" % (path, type(err).__name__, err))
    if not isinstance(data, dict):
        raise SystemExit("deck.py: %s must be an object with the parts %s" % (path, ", ".join(DECK_PARTS)))
    swatches = {}
    for part in DECK_PARTS:
        listed = data.get(part)
        if not isinstance(listed, list) or not listed:
            raise SystemExit("deck.py: %s has no %s swatches (a non-empty list)" % (path, part))
        swatches[part] = {}
        for i, swatch in enumerate(listed):
            if not isinstance(swatch, dict):
                raise SystemExit("deck.py: %s: %s swatch %d is not an object (%r)" % (path, part, i, swatch))
            sid = swatch.get("id")
            if not isinstance(sid, str) or not sid:
                raise SystemExit("deck.py: %s: %s swatch %d has no id" % (path, part, i))
            for field, kind in DECK_FIELDS[part].items():
                if not _deck_field_ok(swatch.get(field), kind):
                    raise SystemExit("deck.py: %s: %s %r has no %s %s (%r)" % (
                        path, part, sid, "#rrggbb" if kind == "hex" else "numeric", field, swatch.get(field)))
            swatches[part][sid] = swatch
    return swatches


def deck_look(spec=None):
    """A look from "body,light" (hero.py's CDP_DECK_LOOK); None is the default. Returns the
    swatches by part and their ids."""
    swatches = deck_swatches()
    if spec is None:
        ids = dict(DECK_DEFAULT)
    else:
        parts = spec.split(",")
        if len(parts) != len(DECK_PARTS):
            raise SystemExit("deck.py: CDP_DECK_LOOK needs body,light: %r" % spec)
        ids = dict(zip(DECK_PARTS, parts))
    for part, sid in ids.items():
        if sid not in swatches[part]:
            raise SystemExit("deck.py: no %s %r (%s)" % (part, sid, ", ".join(swatches[part])))
    return {part: swatches[part][ids[part]] for part in DECK_PARTS}, ids


# ------------------------------------------------------------------ materials
def _deck_hex(h):
    """'#rrggbb' -> linear RGBA, as parts.py turns its palettes (lin(*hexrgb(h)))."""
    return lin(*hexrgb(h))


def build_deck_materials(look):
    """The Deck's materials on top of build_materials() (the disc's and the jewel case's): the
    body's and the light's from the look's swatches, and the fixed ones (the acrylic, the dark
    keys and well, the flight case's aluminium, foam and metal)."""
    build_materials()
    body, light = (look[p] for p in DECK_PARTS)
    glow = _deck_hex(light["glow"])
    M["deck_body"] = mat("deck_body", _deck_hex(body["colour"]), metal=float(body["metalness"]),
                         rough=float(body["roughness"]))
    # The keys' icons and the logo: lit in the light's glow. The page reads a light's colour from
    # its emissive (an `emissive` role), and the web build's base colour is the glow too.
    M["deck_light"] = mat("deck_light", glow if WEB else (0, 0, 0, 1), emit=glow, emit_s=1.0 if WEB else 4.0)
    M["jog_acrylic"] = mat("jog_acrylic", (0.98, 0.99, 1.0, 1), rough=0.05, trans=1.0, ior=1.49)
    M["jog_ring"] = mat("jog_ring", (0.02, 0.02, 0.02, 1), rough=0.3)   # plain: the page paints it
    # Matte darks: the keys' caps and the well (rubber and ink are build_materials').
    M["btn"] = mat("btn", lin(38, 38, 42), rough=0.55)
    M["well"] = mat("well", lin(17, 17, 19), rough=0.7)
    M["hardware"] = mat("hardware", lin(200, 202, 207), metal=1.0, rough=0.22)
    M["alu"] = mat("alu", lin(178, 181, 187), metal=1.0, rough=0.4)
    M["foam"] = mat("foam", lin(30, 30, 33), rough=1.0, sheen=0.3)
    # One emissive material for the ten VU segments: the page clones it per segment and lights
    # them (src/scene/vu-materials.ts), so the GLB carries 1.0; a render's lit segments glow at 3.
    M["vu"] = mat("vu", (0.02, 0.02, 0.022, 1), rough=0.3, emit=glow, emit_s=1.0 if WEB else 3.0)
    M["lcd_screen"] = mat("lcd_screen", (0.01, 0.01, 0.012, 1), rough=0.2)
    if not WEB:
        add_bump(M["deck_body"], "noise", scale=6000, strength=0.05, distance=0.00008)   # bead-blasted
        add_bump(M["alu"], "noise", scale=2200, strength=0.04, distance=0.0001)          # satin
        add_bump(M["foam"], "noise", scale=900, strength=0.6, distance=0.0004, detail=4.0)
        # Render-only: the VU's top three segments and the ring's dim segments unlit, the ring's
        # lit ones, the LCD's lit digits. The page paints a dim segment at 12 % of the glow over
        # black in sRGB, about 1 % of a lit one's light; 12 % of the lit strength (0.72) reads as
        # lit under AgX, so a dim segment glows at 0.12, as the Clear's dim VU segments do.
        M["vu_dim"] = mat("vu_dim", (0.02, 0.02, 0.022, 1), rough=0.3, emit=glow, emit_s=0.12)
        M["ring_on"] = mat("ring_on", (0, 0, 0, 1), emit=glow, emit_s=6.0)
        M["ring_dim"] = mat("ring_dim", (0, 0, 0, 1), emit=glow, emit_s=0.12)
        M["lcd_glow"] = mat("lcd_glow", (0, 0, 0, 1), emit=glow, emit_s=2.4)
    return M


# ------------------------------------------------------------------ dimensions (mm)
DK_W, DK_D = 320.0, 360.0           # the body's width and depth
DK_CORNER = 8.0                     # its corners' radius in plan
DK_EDGE = 6.0                       # its top and bottom edges' round-over
DK_FOOT = 4.0                       # the feet: the body's underside stands this high
DK_TOP = 75.0                       # the top panel
DK_WELL = (30.0, -10.0)             # the jog's well: its centre, right of the middle
DK_WELL_R = 107.0
DK_FLOOR = DK_TOP - 14.0            # the well's floor
DK_DISC_Z = 65.6                    # the disc's centre: its top face at 66.2, on the hub's shoulder
DK_HINGE = (30.0, 97.0, 76.0)       # the plate's hinge, along X at the well's back edge
DK_PLATE_Z = 76.0                   # the plate's underside: it lies 1 mm over the top
DK_PLATE_R, DK_PLATE_T = 103.0, 12.0
DK_RING_IN, DK_RING_OUT = 110.0, 116.0   # the LED ring round the well
DK_RING_Z = DK_TOP + 0.05
DK_RING_QUADS = 192                 # the web ring's quads round
DK_RING_SEGMENTS, DK_RING_LIT = 48, 30   # a render's segments, and how many of them it lights
DK_ARM = (110.0, 55.0, 66.5)        # the laser arm's pivot, inside the well's back right
DK_ARM_LEN = 62.0                   # pivot to head
# The arm's turn about its pivot's Z (three's Y once exported, the same sign) from its rest, the
# head parked beside the disc 79 mm from its centre, to over the disc 41 mm from it: the page's
# profile `arm.play`. The pivot itself is unturned at rest.
DECK_ARM_PLAY = math.radians(50.0)
# The display bay along the back: its front, behind the LED ring (r 116, so y 106 at x 30) and
# clear of the plate's back edge as the plate lifts past 70 degrees (it sweeps to y 109), and its
# back; its top face rises 12 degrees toward the back, 18 mm high at its middle.
DK_BAY_Y = (111.0, 175.0)
DK_BAY_W = 300.0
DK_BAY_TILT = math.radians(12.0)
DK_BAY_MID = 18.0
# The keys: kind -> (x, y, cap). A round cap is its radius; a square one its width and depth.
DK_KEYS = (("play", -120.0, -150.0, 17.0), ("stop", -120.0, -105.0, 17.0),
           ("prev", -137.0, -55.0, (30.0, 18.0)), ("next", -103.0, -55.0, (30.0, 18.0)),
           ("rpt", -137.0, 60.0, 7.0), ("mode", -107.0, 60.0, 7.0))
DK_KEY_WORDS = {"rpt": "RPT", "mode": "SHFL"}   # button_icon draws the other four
# The tempo fader (decor): its slot's x, its ends, its cap's y. At the front right, where the slot
# stays 8 mm off the LED ring and the cap off the body's right edge.
DK_FADER_X = 144.0
DK_FADER_Y = (-162.0, -66.0)
DK_FADER_CAP = -114.0

DK_FRONT = (math.radians(90), 0.0, 0.0)            # local z toward the viewer (-y), local y up
DK_SIDE = (math.radians(90), 0.0, math.radians(90))  # local x back (+y), y up, z right (+x)


# ------------------------------------------------------------------ the body
def deck_chassis(name, root):
    """The body: a box DK_W x DK_D (its corners DK_CORNER round in plan, its top and bottom edges
    rounded by DK_EDGE) from DK_FOOT up to DK_TOP, the jog's well (DK_WELL_R, down to DK_FLOOR)
    cut into its top. One mesh: the body's faces in deck_body, the well's wall and floor in well.
    The top and the bottom are flat-shaded and the well's wall stands on vertices of its own, so
    no normal smooths across the well's rim."""
    b, z0, z1 = DK_EDGE, DK_FOOT, DK_TOP
    outline = rrect(DK_W, DK_D, DK_CORNER, seg=6 if WEB else 12)   # counter-clockwise from above
    nb = 2 if WEB else 6
    prof = [(b - b * math.sin(math.pi / 2 * k / nb), z0 + b - b * math.cos(math.pi / 2 * k / nb))
            for k in range(nb + 1)]
    prof += [(b - b * math.cos(math.pi / 2 * k / nb), z1 - b + b * math.sin(math.pi / 2 * k / nb))
             for k in range(nb + 1)]
    bm = bmesh.new()
    rings = []
    for s, z in prof:
        pts = outline if s < 1e-9 else _offset(outline, -s)
        rings.append([bm.verts.new((x * MM, y * MM, z * MM)) for x, y in pts])
    n = len(outline)
    for j in range(len(rings) - 1):
        lo, hi = rings[j], rings[j + 1]
        for i in range(n):
            k = (i + 1) % n
            f = bm.faces.new((lo[i], lo[k], hi[k], hi[i]))   # outward: counter-clockwise seen from outside
            f.smooth = True
    bottom = bm.faces.new(list(reversed(rings[0])))
    bottom.smooth = False
    cx, cy = DK_WELL
    seg = q(192)
    rim = [(cx + DK_WELL_R * math.cos(2 * math.pi * i / seg), cy + DK_WELL_R * math.sin(2 * math.pi * i / seg))
           for i in range(seg)]
    hole = [bm.verts.new((x * MM, y * MM, z1 * MM)) for x, y in rim]
    top_edges = [bm.edges.get((rings[-1][i], rings[-1][(i + 1) % n])) for i in range(n)]
    top_edges += [bm.edges.new((hole[i], hole[(i + 1) % seg])) for i in range(seg)]
    filled = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=top_edges, normal=(0, 0, 1))
    for f in filled["geom"]:
        if isinstance(f, bmesh.types.BMFace):
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
            f.smooth = False
    # The well: its wall on vertices of its own (facing in), its floor (facing up).
    upper = [bm.verts.new((x * MM, y * MM, z1 * MM)) for x, y in rim]
    lower = [bm.verts.new((x * MM, y * MM, DK_FLOOR * MM)) for x, y in rim]
    for i in range(seg):
        k = (i + 1) % seg
        f = bm.faces.new((lower[i], upper[i], upper[k], lower[k]))
        f.smooth = True
        f.material_index = 1
    floor = bm.faces.new(lower)
    floor.smooth = False
    floor.material_index = 1
    return from_bm(name + "_chassis", bm, [M["deck_body"], M["well"]], smooth=False, parent=root)


def deck_feet(name, root):
    """Four rubber feet under the corners, 25 mm in from each side."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe("%s_foot_%d%d" % (name, sx, sy), [(0.01, 0.0), (9.0, 0.0), (9.0, DK_FOOT - 0.8),
                                                    (8.2, DK_FOOT), (0.01, DK_FOOT)], M["rubber"], seg=32,
                  parent=root, loc=L(sx * (DK_W / 2 - 25.0), sy * (DK_D / 2 - 25.0), 0.0))


def deck_prints(name, root):
    """The model line printed on the body's front."""
    text(name + "_front_print", "ncam   DK·01   COMPACT DISC DECK", 3.2, M["ink"], font="avenir", align="LEFT",
         parent=root, loc=L(-146.0, -DK_D / 2 - 0.02, 38.0), rot=DK_FRONT)


# ------------------------------------------------------------------ the display bay
def deck_bay(name, root, playing):
    """The raised bay along the back, its top face tilted DK_BAY_TILT toward the viewer, under a
    black glass 0.6 mm proud of it: the LCD (`<name>_lcd_screen`, the page's print; a render
    lights the track and the time over the unlit segments), the ten VU segments (`<name>_vu_seg_i`,
    one `vu` material; a render lights the first seven) and the ncam logo in the light."""
    y0, y1 = DK_BAY_Y
    depth = y1 - y0
    rise = depth * math.tan(DK_BAY_TILT)
    zf = DK_TOP + DK_BAY_MID - rise / 2      # the face's front edge
    zb = DK_TOP + DK_BAY_MID + rise / 2      # its back edge
    sunk = DK_TOP - 1.5                       # its bottom, below the top: its rounded edge stays inside
    slab(name + "_bay", [[(y0, sunk), (y1, sunk), (y1, zb), (y0, zf)]], -DK_BAY_W / 2, DK_BAY_W / 2,
         M["deck_body"], bevel_mm=1.5, res=3, parent=root, rot=DK_SIDE)
    # The face's frame: local x along X, local y up the slope, local z its normal.
    face = empty(name + "_bay_face", L(0.0, (y0 + y1) / 2, DK_TOP + DK_BAY_MID), (DK_BAY_TILT, 0.0, 0.0), parent=root)
    span = depth / math.cos(DK_BAY_TILT)
    slab(name + "_bay_glass", [rrect(DK_BAY_W - 6.0, span - 7.0, 3.0)], 0.0, 0.6, M["black_glass"],
         bevel_mm=0.0 if WEB else 0.2, parent=face)
    gz = 0.6
    lx = -60.0
    rbox(name + "_lcd_screen", (80.0, 30.0, 0.05), M["lcd_screen"], parent=face, loc=L(lx, 0.0, gz + 0.025))
    if not WEB:
        on = M["lcd_glow"] if playing else M["lcd_ghost"]
        z = gz + 0.07
        text(name + "_lcd_g1", "88", 15.0, M["lcd_ghost"], font="din", parent=face, loc=L(lx - 22.0, -2.6, z - 0.01))
        text(name + "_lcd_t1", "01", 15.0, on, font="din", parent=face, loc=L(lx - 22.0, -2.6, z))
        text(name + "_lcd_g2", "8:88", 11.0, M["lcd_ghost"], font="din", parent=face, loc=L(lx + 14.0, -3.6, z - 0.01))
        text(name + "_lcd_t2", "1:24", 11.0, on, font="din", parent=face, loc=L(lx + 14.0, -3.6, z))
        text(name + "_lcd_cd", "CD   PLAY   RPT", 2.6, on, font="avenir", align="LEFT", parent=face,
             loc=L(lx - 35.0, 10.4, z))
    for k in range(10):
        lit = WEB or (playing and k < 7)
        rbox("%s_vu_seg_%d" % (name, k), (3.8, 6.6, 0.3), M["vu"] if lit else M["vu_dim"], parent=face,
             loc=L(10.0 + 1.9 + 5.2 * k, 0.0, gz + 0.15))
    text(name + "_logo", "ncam", 7.0, M["deck_light"], font="futura", parent=face, loc=L(100.0, 0.0, gz + 0.02))


# ------------------------------------------------------------------ the well: the spindle and the disc
def deck_spindle(name, root, disc_label):
    """The hub on the well's floor (30 mm across, its shoulder under the disc), the post through
    the disc's hole, and the disc on it, its label up (`<name>_disc`)."""
    cx, cy = DK_WELL
    seat = DK_DISC_Z - 0.6 - 0.05            # the disc's underside, a hair over the shoulder
    lathe(name + "_hub", [(0.01, DK_FLOOR), (15.0, DK_FLOOR), (15.0, seat - 0.6), (14.4, seat), (0.01, seat)],
          M["hub_black"], seg=96, parent=root, loc=L(cx, cy, 0.0))
    lathe(name + "_hub_post", [(0.01, seat), (7.2, seat), (7.2, DK_FLOOR + 5.4), (6.6, DK_FLOOR + 6.0),
                               (0.01, DK_FLOOR + 6.0)], M["hub_black"], seg=48, parent=root, loc=L(cx, cy, 0.0))
    return make_disc(name + "_disc", disc_label, L(cx, cy, DK_DISC_Z), parent=root)


# ------------------------------------------------------------------ the LED ring
def _ring_sector(bm, uv, r0, r1, a0, a1, steps, u0=None, u1=None):
    """Quads of an annulus r0..r1 from a0 to a1 degrees clockwise from twelve o'clock (seen from
    above), facing up; with `uv`, the GLB's u runs u0..u1 along it and its v 0 (inner) to 1
    (outer). The glTF exporter turns Blender's v into 1 - v (glTF's origin is the image's top
    left), so Blender's layer holds 1 - v."""
    inner, outer = [], []
    for i in range(steps + 1):
        th = math.radians(90.0 - (a0 + (a1 - a0) * i / steps))
        inner.append(bm.verts.new((r0 * math.cos(th) * MM, r0 * math.sin(th) * MM, 0.0)))
        outer.append(bm.verts.new((r1 * math.cos(th) * MM, r1 * math.sin(th) * MM, 0.0)))
    for i in range(steps):
        f = bm.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
        if uv is not None:
            ua = u0 + (u1 - u0) * i / steps
            ub = u0 + (u1 - u0) * (i + 1) / steps
            for loop, coords in zip(f.loops, ((ua, 1.0), (ub, 1.0), (ub, 0.0), (ua, 0.0))):
                loop[uv].uv = coords


def deck_ring(name, root, playing):
    """The LED ring, flat on the top round the well. The web build: one mesh (`<name>_jog_ring`) in
    jog_ring, DK_RING_QUADS quads round on two rings of vertices, vertex i at 90 - 360 i / n degrees
    from +X (i = 0 at twelve o'clock, growing clockwise seen from above), its UV in the GLB
    (TEXCOORD_0) (i / n, 0) inside and (i / n, 1) outside, the seam's vertices doubled so that u
    runs 0 to 1 unwrapped: the page paints a strip whose u runs round it. A render:
    DK_RING_SEGMENTS segments, each 360 / n degrees less a 1.5 degree gap, the first DK_RING_LIT
    lit, on a black ring."""
    cx, cy = DK_WELL
    if WEB:
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        _ring_sector(bm, uv, DK_RING_IN, DK_RING_OUT, 0.0, 360.0, DK_RING_QUADS, 0.0, 1.0)
        return from_bm(name + "_jog_ring", bm, [M["jog_ring"]], smooth=False, parent=root, loc=L(cx, cy, DK_RING_Z))
    annulus(name + "_ring_base", DK_RING_OUT + 0.6, DK_RING_IN - 0.6, M["black_glass"], z_mm=DK_RING_Z - 0.03,
            seg=192, parent=root, loc=L(cx, cy, 0.0))
    pitch = 360.0 / DK_RING_SEGMENTS
    for k in range(DK_RING_SEGMENTS):
        bm = bmesh.new()
        _ring_sector(bm, None, DK_RING_IN, DK_RING_OUT, pitch * k + 0.75, pitch * (k + 1) - 0.75, 4)
        lit = playing and k < DK_RING_LIT
        from_bm("%s_ring_seg_%d" % (name, k), bm, [M["ring_on"] if lit else M["ring_dim"]], smooth=False,
                parent=root, loc=L(cx, cy, DK_RING_Z))


# ------------------------------------------------------------------ the jog
def deck_jog(name, root):
    """The jog: its hinge (`<name>_door`, unturned: its local X is the world's, the axis the page
    lifts the plate about) at the well's back edge, and under it the jog itself (`<name>_knob`, at
    the well's centre, its local Z up, which the page turns it about): the clear acrylic plate, its
    dark side ring with 64 shallow ridges, the centre cap with the ncam logo and an index dot in the
    light at twelve o'clock."""
    door = empty(name + "_door", L(*DK_HINGE), parent=root)
    cx, cy = DK_WELL
    knob = empty(name + "_knob", L(cx - DK_HINGE[0], cy - DK_HINGE[1], DK_PLATE_Z - DK_HINGE[2]), parent=door)
    t = DK_PLATE_T
    r = DK_PLATE_R - 0.05
    lathe(name + "_jog_plate", [(0.01, 0.0), (r, 0.0), (r, t - 0.8), (r - 0.8, t), (0.01, t)], M["jog_acrylic"],
          seg=192, parent=knob)
    # 64 ridges: lathe ridges every other segment, and the web build halves the segments.
    lathe(name + "_jog_side", [(DK_PLATE_R + 0.05, 0.0), (105.5, 0.0), (105.5, t), (DK_PLATE_R + 0.05, t)],
          M["rubber"], seg=256 if WEB else 128, ridge=({1, 2}, 0.5), parent=knob)
    top = t + 0.02
    lathe(name + "_jog_cap", [(0.01, top), (25.0, top), (25.0, top + 2.6), (24.2, top + 3.6), (22.6, top + 4.0),
                              (0.01, top + 4.0)], M["hub_black"], seg=128, parent=knob)
    text(name + "_jog_logo", "ncam", 6.0, M["ink"], font="futura", parent=knob, loc=L(0.0, -1.2, top + 4.03))
    lathe(name + "_jog_dot", [(0.01, top + 4.0), (2.0, top + 4.0), (2.0, top + 4.2), (1.6, top + 4.3),
                              (0.01, top + 4.3)], M["deck_light"], seg=24, parent=knob, loc=L(0.0, 18.0, 0.0))
    return door


# ------------------------------------------------------------------ the laser arm
def deck_arm(name, root, playing=False):
    """The laser arm, inside the well's back right, under the plate: its pivot (`<name>_arm`) is
    unturned at rest, the head parked beside the disc; turned DECK_ARM_PLAY about its Z (a render
    plays) the arm points at the disc's centre and the head lies over the music, below z 74. The
    post it turns on stands on the well's floor."""
    px, py, pz = DK_ARM
    cx, cy = DK_WELL
    toward = math.atan2(cy - py, cx - px)                 # the disc's centre, from the pivot
    lathe(name + "_arm_post", [(0.01, DK_FLOOR), (3.4, DK_FLOOR), (3.4, pz + 1.5), (0.01, pz + 1.5)],
          M["hardware"], seg=32, parent=root, loc=L(px, py, 0.0))
    pivot = empty(name + "_arm", L(px, py, pz), (0.0, 0.0, DECK_ARM_PLAY if playing else 0.0), parent=root)
    # The arm along its own +x, turned to its rest: clockwise of the centre by the play turn.
    body = empty(name + "_arm_body", (0.0, 0.0, 0.0), (0.0, 0.0, toward - DECK_ARM_PLAY), parent=pivot)
    n = DK_ARM_LEN
    slab(name + "_arm_beam", [rrect(n + 6.0, 6.0, 3.0, cx=n / 2)], 1.5, 4.5, M["hardware"],
         bevel_mm=0.0 if WEB else 0.5, parent=body)
    rbox(name + "_arm_head", (10.0, 8.0, 4.0), M["black_glass"], bevel_mm=0.0 if WEB else 0.8, parent=body,
         loc=L(n, 0.0, 3.0))
    tube(name + "_arm_lens_ring", circle(1.9, 20), 0.35, M["hardware"], cyclic=True, parent=body,
         loc=L(n + 1.6, 0.0, 5.05))
    lathe(name + "_arm_lens", [(0.01, 0.0), (1.6, 0.0), (1.4, 0.45), (0.8, 0.75), (0.01, 0.8)], M["black_glass"],
          seg=24, parent=body, loc=L(n + 1.6, 0.0, 5.0))
    lathe(name + "_arm_cap", [(0.01, 4.5), (3.6, 4.5), (3.6, 5.6), (3.0, 6.0), (0.01, 6.0)], M["hardware"], seg=32,
          parent=pivot)
    return pivot


# ------------------------------------------------------------------ the keys
def _scaled(shapes, s):
    """button_icon's outlines (mm round the cap's centre), scaled by s."""
    return [[(px * s, py * s) for px, py in shape] for shape in shapes]


def deck_keys(name, root, playing=False):
    """The keys, a column on the left: play and stop (34 mm round) at the front, prev and next
    (30 x 18) above them, repeat and shuffle (14 mm round) by the display. Each key is an empty on
    the top (the page sinks it) holding its dark cap and its icon lit in the light (`deck_light`);
    its dark surround and its printed label are the body's. The play key's cap carries ▶ and ‖ in
    the web build (the page shows one at a time); a render prints ‖ alone, as it plays."""
    for kind, x, y, cap in DK_KEYS:
        key = empty("%s_btn_%s" % (name, kind), L(x, y, DK_TOP), parent=root)
        if isinstance(cap, tuple):
            w, d = cap
            h = 5.0
            rbox("%s_btn_%s_cap" % (name, kind), (w, d, h), M["btn"], bevel_mm=1.6, parent=key, loc=L(0.0, 0.0, h / 2))
            slab("%s_btn_%s_gap" % (name, kind), [rrect(w + 3.6, d + 3.6, 3.4, cx=x, cy=y),
                                                   rrect(w + 1.0, d + 1.0, 2.2, cx=x, cy=y)],
                 DK_TOP, DK_TOP + 0.04, M["rubber"], parent=root)
            scale = 1.7
        else:
            h = 6.0 if cap > 10 else 4.0
            lathe("%s_btn_%s_cap" % (name, kind), [(0.01, 0.0), (cap, 0.0), (cap, h - 1.2), (cap - 0.5, h - 0.4),
                                                   (cap - 1.4, h), (0.01, h)], M["btn"], seg=96 if cap > 10 else 48,
                  parent=key)
            annulus("%s_btn_%s_gap" % (name, kind), cap + 2.2, cap + 0.6, M["rubber"], z_mm=DK_TOP + 0.03,
                    seg=96 if cap > 10 else 48, parent=root, loc=L(x, y, 0.0))
            scale = 2.4
        shapes = button_icon(kind)
        if kind == "play":
            if WEB or not playing:
                slab("%s_btn_play_icon_play" % name, _scaled(shapes, scale), h + 0.02, h + 0.12, M["deck_light"],
                     parent=key)
            if WEB or playing:
                slab("%s_btn_play_icon_pause" % name, _scaled(button_icon("pause"), scale), h + 0.02, h + 0.12,
                     M["deck_light"], parent=key)
        elif shapes:
            slab("%s_btn_%s_icon" % (name, kind), _scaled(shapes, scale), h + 0.02, h + 0.12, M["deck_light"],
                 parent=key)
        else:
            text("%s_btn_%s_word" % (name, kind), DK_KEY_WORDS[kind], 2.3, M["deck_light"], font="din", parent=key,
                 loc=L(0.0, 0.0, h + 0.03))
    # The body's printed labels by the keys.
    text(name + "_lbl_track", "TRACK", 2.4, M["ink"], font="avenir", parent=root, loc=L(-120.0, -41.0, DK_TOP + 0.02))
    text(name + "_lbl_rpt", "REPEAT", 2.2, M["ink"], font="avenir", parent=root, loc=L(-137.0, 47.5, DK_TOP + 0.02))
    text(name + "_lbl_mode", "SHUFFLE", 2.2, M["ink"], font="avenir", parent=root, loc=L(-107.0, 47.5, DK_TOP + 0.02))


# ------------------------------------------------------------------ the tempo fader (decor)
def deck_fader(name, root):
    """The tempo fader at the front right: decor (no name the page drives). A dark slot with its
    opening, the cap at its middle with a line across it, ticks to its right and -8 / +8 at its
    ends (+ toward the player, as a DJ deck's)."""
    x = DK_FADER_X
    y0, y1 = DK_FADER_Y
    yc = (y0 + y1) / 2
    slab(name + "_fader_slot", [rrect(8.0, y1 - y0, 4.0, cx=x, cy=yc)], DK_TOP, DK_TOP + 0.03, M["well"], parent=root)
    slab(name + "_fader_gap", [rrect(2.4, y1 - y0 - 6.0, 1.2, cx=x, cy=yc)], DK_TOP, DK_TOP + 0.05, M["rubber"],
         parent=root)
    rbox(name + "_fader_cap", (18.0, 10.0, 8.0), M["rubber"], bevel_mm=0.0 if WEB else 1.4, parent=root,
         loc=L(x, DK_FADER_CAP, DK_TOP + 4.0))
    rbox(name + "_fader_line", (16.0, 1.0, 0.08), M["ink"], parent=root, loc=L(x, DK_FADER_CAP, DK_TOP + 8.04))
    for k in range(9):
        yy = y0 + 4.0 + (y1 - y0 - 8.0) * k / 8
        rbox("%s_fader_tick_%d" % (name, k), (4.4 if k == 4 else 2.6, 0.5, 0.04), M["ink"], parent=root,
             loc=L(x + 6.4 + (0.9 if k == 4 else 0.0), yy, DK_TOP + 0.02))
    text(name + "_fader_minus", "-8", 2.6, M["ink"], font="din", parent=root, loc=L(x, y1 + 5.0, DK_TOP + 0.02))
    text(name + "_fader_plus", "+8", 2.6, M["ink"], font="din", parent=root, loc=L(x, y0 - 5.0, DK_TOP + 0.02))


# ------------------------------------------------------------------ the whole Deck
def make_deck(name, root, look, playing, disc_label=None):
    """The deck under `root`. `look` is the swatches (deck_look): build_deck_materials made the
    materials from it; the geometry is the same for every look. `disc_label` prints the disc on the
    spindle (the web build's art_disc unless given)."""
    deck_chassis(name, root)
    deck_feet(name, root)
    deck_bay(name, root, playing)
    deck_spindle(name, root, disc_label if disc_label is not None else M["art_disc"])
    deck_ring(name, root, playing)
    deck_jog(name, root)
    deck_arm(name, root, playing)
    deck_keys(name, root, playing)
    deck_fader(name, root)
    deck_prints(name, root)
    return root


def make_deck_player(name, disc_label, booklet, look, rack_labels=None, playlist="Top 50 · Global"):
    """The whole Deck under the empty `name`: the deck, and the flight case beside it
    (deck_case.py). A render (not WEB) plays: the arm over the disc, the LCD, seven VU segments
    and 30 of the ring's 48 lit, the play key printing ‖ alone."""
    playing = not WEB
    root = empty(name, L(0, 0, 0))
    make_deck(name, root, look, playing, disc_label)
    make_flight_case(name + "_flight", root, rack_labels, playlist, WEB)
    deck_jewel_case(name, root, booklet)
    return root

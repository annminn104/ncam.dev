"""The Deck's panel and body detail: the big screen module (the contract's lcd_screen and the ten
VU segments), the decor controls on the top (eight performance pads edged in the light, two FX
knobs, the BROWSE encoder with BACK and TAG, SYNC and MASTER, KEY LOCK and TEMPO RANGE, the tempo
fader), the labels printed round the controls, and the body's screws, ports and vents.

Needs cdkit's, parts.py's and deck.py's namespace: export.py and hero.py exec it after deck.py,
whose dimensions, helpers and materials it reads, and before deck_case.py, which builds its rivets
with _dome_cluster; deck.py's make_deck calls deck_screen, deck_controls and deck_body_detail.
Blender's axes and millimetres as in deck.py.

Every control here is decor: parented to the deck's root, never to a key or the knob, none named
btn_*, and the page drives none of them. The screen stands at the back, leaning back
DK_SCREEN_LEAN from upright so that it faces a viewer above the deck. Laid back 20 degrees from flat,
its 115.6 mm face would need 110 mm of depth, and only the 44 mm behind the pads stay clear of the
plate lifted 90 degrees (it then stands at y 97 to 113).
"""
import math
import random

import bmesh
from mathutils import Vector

# ------------------------------------------------------------------ dimensions (mm)
DK_GLASS = (170.0, 170.0 * 9.0 / 16.0)     # exactly 16:9: the page paints a 768 x 432 canvas on it
DK_BEZEL, DK_LIP = 6.0, 4.0                # the black glass round the screen, the housing round that
DK_SCREEN_W = 200.0                        # the housing: the bezel, and the VU strip at its left
DK_SCREEN_LEAN = math.radians(16.0)        # back from upright
DK_SCREEN_Y = 136.0                        # the housing's front on the top, behind the pads
DK_SCREEN_Z = 80.0                         # its face's lower edge
DK_SCREEN_T = 12.0                         # its thickness behind the face, at the top
DK_BEZEL_X = 5.0                           # the bezel's centre across the face
# The VU strip, on the housing left of the bezel: from the hero camera a lit column right of it
# stands behind the jog and mirrors in the acrylic as a beam; at the left it mirrors in the matte top.
DK_VU_X = -93.0
# The pads' row, between the jog and the screen: behind the plate lifted 90 degrees (its top face,
# grooves included, then stands at y 109.3) and in front of the screen's housing.
DK_PADS_Y = 121.0
DK_PAD = (26.0, 16.0, 4.0)                 # width, depth, height
DK_PAD_PITCH = 36.0
DK_FX = (-136.0, -116.0)                   # the FX knobs' x, at the top-left corner, left of the screen
DK_KNOBS_Y = 152.0                         # the FX knobs', BROWSE's, BACK's and TAG's row
DK_BROWSE_X = 126.0
DK_BACK_TAG = ((108.0, "BACK"), (144.0, "TAG"))
DK_FADER_X = 144.0                         # the tempo fader (decor): its slot's x, its ends, its cap's y
DK_FADER_Y = (-164.0, -96.0)
DK_FADER_CAP = -130.0
DK_SYNC = ((114.0, -155.0, "SYNC"), (114.0, -141.0, "MASTER"))   # left of the fader
DK_LOCK = ((136.0, -84.0, "KEY LOCK"), (149.0, -84.0, "RANGE"))  # above it, off the LED ring
DK_SCREWS = [(sx * 150.0, sy * 170.0) for sx in (-1, 1) for sy in (-1, 1)]
DK_BACK_FACE = (math.radians(90), 0.0, math.radians(180))   # local z toward the back (+y), y up, x toward -x


# ------------------------------------------------------------------ clusters: many small parts, one node each
def _box_cluster(name, boxes, mats, parent):
    """One mesh of boxes [(centre, size), ...] (mm, the parent's frame)."""
    bm = bmesh.new()
    for centre, size in boxes:
        verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.scale(bm, vec=mmv(size), verts=verts)
        bmesh.ops.translate(bm, vec=mmv(centre), verts=verts)
    return from_bm(name, bm, [mats], smooth=False, parent=parent)


def _dome_cluster(name, domes, mats, parent, seg=None):
    """One mesh of low domes [(base centre, axis, radius, height), ...] (mm, the parent's frame),
    each standing out of its surface along its axis: rivet and screw heads. Open underneath, where
    the surface hides them."""
    seg = seg or (10 if WEB else 16)
    bm = bmesh.new()
    for centre, axis, r, h in domes:
        turn = Vector((0.0, 0.0, 1.0)).rotation_difference(Vector(axis)).to_matrix()
        base = Vector(centre)

        def at(x, y, z):
            return bm.verts.new(mmv(base + turn @ Vector((x, y, z))))
        rings = [[at(r * fr * math.cos(2 * math.pi * i / seg), r * fr * math.sin(2 * math.pi * i / seg), h * fz)
                  for i in range(seg)] for fr, fz in ((1.0, 0.0), (0.86, 0.5), (0.5, 0.88))]
        apex = at(0.0, 0.0, h)
        for lo, hi in zip(rings, rings[1:]):
            for i in range(seg):
                k = (i + 1) % seg
                bm.faces.new((lo[i], lo[k], hi[k], hi[i]))
        for i in range(seg):
            bm.faces.new((rings[-1][i], rings[-1][(i + 1) % seg], apex))
    return from_bm(name, bm, [mats], parent=parent)


def _quads(name, rects, mats, parent, z):
    """One mesh of flat rectangles [(x0, y0, x1, y1), ...] (mm, the parent's frame) at height z,
    facing +z: a render's screen graphics."""
    bm = bmesh.new()
    for x0, y0, x1, y1 in rects:
        bm.faces.new([bm.verts.new(mmv((x, y, z))) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
    return from_bm(name, bm, [mats], smooth=False, parent=parent)


# ------------------------------------------------------------------ the screen module
def deck_screen_frame():
    """The screen face's centre (mm), its turn (local x along X, local y up the face, local z its
    normal, toward the viewer and up) and its height (the bezel and the housing's lips included)."""
    h = DK_GLASS[1] + 2.0 * (DK_BEZEL + DK_LIP)
    a = DK_SCREEN_LEAN
    centre = (0.0, DK_SCREEN_Y + h / 2 * math.sin(a), DK_SCREEN_Z + h / 2 * math.cos(a))
    return centre, (math.radians(90) - a, 0.0, 0.0), h


def deck_screen(name, root, playing):
    """The screen module at the back: a housing in the body's finish whose face leans back
    DK_SCREEN_LEAN, its back flush with the body's; on its face the black glass bezel (`black_glass`,
    6 mm round the screen, ncam small on it in the light), the screen's glass (`<name>_lcd_screen`,
    16:9, the page's print, its UV over the whole glass the right way up), and left of the bezel
    the ten VU segments in a black window, bottom to top (`<name>_vu_seg_i`, one `vu` material; a
    render lights the first seven). A render (not WEB) draws a playing screen on the glass."""
    centre, rot, h = deck_screen_frame()
    a = DK_SCREEN_LEAN
    top = (DK_SCREEN_Y + h * math.sin(a), DK_SCREEN_Z + h * math.cos(a))
    back = DK_D / 2
    # The housing's side: from its foot inside the body, along under to the body's back face (below
    # its rounded edge), up the back, over the top and down the face to the short front strip.
    side = [(DK_SCREEN_Y, DK_TOP - 1.5), (back, DK_TOP - DK_EDGE), (back, top[1] - DK_SCREEN_T * math.sin(a)), top,
            (DK_SCREEN_Y, DK_SCREEN_Z)]
    slab(name + "_screen_housing", [side], -DK_SCREEN_W / 2, DK_SCREEN_W / 2, M["deck_body"], bevel_mm=2.5, res=3,
         parent=root, rot=DK_SIDE)
    face = empty(name + "_screen_face", L(*centre), rot, parent=root)
    gw, gh = DK_GLASS
    slab(name + "_bezel", [rrect(gw + 2 * DK_BEZEL, gh + 2 * DK_BEZEL, 4.0, cx=DK_BEZEL_X)], 0.0, 0.8, M["black_glass"],
         bevel_mm=0.0 if WEB else 0.3, parent=face)
    rbox(name + "_lcd_screen", (gw, gh, 0.05), M["lcd_screen"], parent=face, loc=L(DK_BEZEL_X, 0.0, 0.825))
    text(name + "_logo", "ncam", 3.2, M["deck_light"], font="futura", parent=face,
         loc=L(DK_BEZEL_X, -(gh / 2 + DK_BEZEL / 2), 0.82))
    slab(name + "_vu_window", [rrect(9.0, 58.0, 2.0, cx=DK_VU_X)], 0.0, 0.5, M["black_glass"], parent=face)
    for k in range(10):
        lit = WEB or (playing and k < 7)
        rbox("%s_vu_seg_%d" % (name, k), (6.6, 3.8, 0.3), M["vu"] if lit else M["vu_dim"], parent=face,
             loc=L(DK_VU_X, -23.4 + 5.2 * k, 0.65))
    if not WEB:
        deck_screen_ui(name, face, playing)
    return face


def deck_screen_ui(name, face, playing):
    """A render's screen (on the web build's glass the page paints its own): a top bar with the
    track, ‖ while it plays (▶ otherwise), the collection and the time with what is left; the title
    and the artists; a 120-bar waveform played to 45 % in the light's glow, the rest dim, a white
    playhead at 45 %; a progress bar, the tempo and the key, and ncam small."""
    gw, gh = DK_GLASS
    x0, x1 = DK_BEZEL_X - gw / 2 + 6.0, DK_BEZEL_X + gw / 2 - 6.0
    top, z = gh / 2, 0.86
    white, grey, dim, glow = M["screen_white"], M["screen_grey"], M["screen_dim"], M["lcd_glow"]
    bar = top - 6.0
    text(name + "_ui_track", "01", 4.6, glow, font="din", align="LEFT", parent=face, loc=L(x0, bar, z))
    if playing:
        _quads(name + "_ui_state", [(x0 + 11.0, bar - 2.0, x0 + 12.2, bar + 2.0),
                                    (x0 + 13.6, bar - 2.0, x0 + 14.8, bar + 2.0)], white, face, z)
    else:
        slab(name + "_ui_state", [[(x0 + 11.0, bar - 2.0), (x0 + 11.0, bar + 2.0), (x0 + 14.6, bar)]], z, z + 0.01,
             white, parent=face)
    text(name + "_ui_list", "TOP 50 · GLOBAL", 2.4, grey, font="avenir", parent=face, loc=L(DK_BEZEL_X, bar, z))
    text(name + "_ui_time", "1:24 / -1:36", 4.0, white, font="din", align="RIGHT", parent=face, loc=L(x1, bar, z))
    _quads(name + "_ui_rule", [(x0, top - 10.7, x1, top - 10.4)], grey, face, z)
    text(name + "_ui_title", "Night Drive", 8.4, white, font="futura", align="LEFT", parent=face,
         loc=L(x0, top - 18.5, z))
    text(name + "_ui_artist", "Various Artists", 4.4, grey, font="avenir", align="LEFT", parent=face,
         loc=L(x0, top - 27.0, z))
    n, played = 120, 54
    pitch = (x1 - x0) / n
    rng = random.Random(1208)
    yc = -8.0
    bars = []
    for k in range(n):
        env = 0.45 + 0.55 * math.sin(math.pi * (k + 0.5) / n)
        hk = 2.5 + 25.0 * env * (0.3 + 0.7 * rng.random())
        xa = x0 + k * pitch + pitch * 0.18
        bars.append((xa, yc - hk / 2, xa + pitch * 0.64, yc + hk / 2))
    _quads(name + "_ui_wave_played", bars[:played], glow, face, z)
    _quads(name + "_ui_wave_rest", bars[played:], dim, face, z)
    xp = x0 + played * pitch
    _quads(name + "_ui_playhead", [(xp - 0.3, yc - 16.0, xp + 0.3, yc + 16.0)], white, face, z + 0.01)
    yb = -top + 9.5
    _quads(name + "_ui_progress", [(x0, yb - 0.5, x1, yb + 0.5)], dim, face, z)
    _quads(name + "_ui_progress_done", [(x0, yb - 0.5, xp, yb + 0.5)], glow, face, z + 0.005)
    text(name + "_ui_tempo", "124.0 BPM    8A    0.0 %", 2.6, grey, font="din", align="LEFT", parent=face,
         loc=L(x0, -top + 4.5, z))
    text(name + "_ui_ncam", "ncam", 2.8, grey, font="futura", align="RIGHT", parent=face, loc=L(x1, -top + 4.5, z))


# ------------------------------------------------------------------ the decor controls
def _knob(name, root, x, y, r, h, ridges, collar):
    """A ridged rubber knob on a metal collar standing on the top (decor)."""
    lathe(name + "_collar", [(0.01, DK_TOP), (collar, DK_TOP), (collar, DK_TOP + 1.1), (collar - 0.5, DK_TOP + 1.6),
                             (0.01, DK_TOP + 1.6)], M["hardware"], seg=48, parent=root, loc=L(x, y, 0.0))
    b = DK_TOP + 1.6
    lathe(name, [(0.01, b), (r, b), (r, b + h - 1.0), (r - 0.8, b + h), (0.01, b + h)], M["rubber"],
          seg=4 * ridges if WEB else 2 * ridges, ridge=({1, 2}, 0.3), parent=root, loc=L(x, y, 0.0))
    return b + h


def _round_key(name, root, x, y, r, h):
    """A small round key standing on the top (decor), its dark surround printed round it."""
    lathe(name, [(0.01, DK_TOP), (r, DK_TOP), (r, DK_TOP + h - 0.8), (r - 0.6, DK_TOP + h), (0.01, DK_TOP + h)],
          M["btn"], seg=32, parent=root, loc=L(x, y, 0.0))
    annulus(name + "_gap", r + 1.4, r + 0.4, M["rubber"], z_mm=DK_TOP + 0.03, seg=32, parent=root, loc=L(x, y, 0.0))


def deck_pads(name, root):
    """Eight performance pads in a row between the jog and the screen: rubber, each on a 2 mm edge
    ring in the light, lettered A to H beside them, HOT CUE over the row."""
    w, d, h = DK_PAD
    y = DK_PADS_Y
    for k in range(8):
        x = (k - 3.5) * DK_PAD_PITCH
        slab("%s_pad_ring_%d" % (name, k), [rrect(w + 4.0, d + 4.0, 3.0, cx=x, cy=y),
                                             rrect(w + 0.4, d + 0.4, 1.6, cx=x, cy=y)],
             DK_TOP, DK_TOP + 0.6, M["deck_light"], parent=root)
        rbox("%s_pad_%d" % (name, k), (w, d, h), M["rubber"], bevel_mm=1.0 if WEB else 1.3, seg=1 if WEB else 3,
             parent=root, loc=L(x, y, DK_TOP + h / 2))
        text("%s_pad_letter_%d" % (name, k), "ABCDEFGH"[k], 2.4, M["ink"], font="din", parent=root,
             loc=L(x - DK_PAD_PITCH / 2, y, DK_TOP + 0.02))
    text(name + "_lbl_hot_cue", "HOT CUE", 2.2, M["ink"], font="avenir", align="LEFT", parent=root,
         loc=L(-141.0, y + d / 2 + 5.6, DK_TOP + 0.02))


def deck_browse(name, root):
    """Left of the screen two FX knobs; right of it the BROWSE push-encoder (a ridged rubber knob on
    a metal collar, a metal disc on its top) between BACK and TAG. Each labelled behind it."""
    y = DK_KNOBS_Y
    for k, x in enumerate(DK_FX):
        cap = _knob("%s_fx_%d" % (name, k), root, x, y, 6.0, 9.0, 18, 7.5)
        rbox("%s_fx_%d_mark" % (name, k), (0.8, 4.0, 0.06), M["ink"], parent=root, loc=L(x, y + 2.6, cap + 0.03))
        text("%s_lbl_fx_%d" % (name, k), "FX %d" % (k + 1), 2.0, M["ink"], font="avenir", parent=root,
             loc=L(x, y + 11.5, DK_TOP + 0.02))
    x = DK_BROWSE_X
    cap = _knob(name + "_browse", root, x, y, 8.0, 11.0, 24, 10.5)
    lathe(name + "_browse_top", [(0.01, cap), (5.4, cap), (5.4, cap + 0.3), (5.0, cap + 0.5), (0.01, cap + 0.5)],
          M["hardware"], seg=48, parent=root, loc=L(x, y, 0.0))
    text(name + "_lbl_browse", "BROWSE", 2.0, M["ink"], font="avenir", parent=root, loc=L(x, y + 13.5, DK_TOP + 0.02))
    for k, (bx, word) in enumerate(DK_BACK_TAG):
        _round_key("%s_%s_key" % (name, word.lower()), root, bx, y, 4.5, 3.2)
        text("%s_lbl_%s" % (name, word.lower()), word, 1.8, M["ink"], font="avenir", parent=root,
             loc=L(bx, y + 8.5, DK_TOP + 0.02))


def deck_tempo(name, root):
    """The tempo fader at the front right (a dark slot, its cap at the middle with a line across it,
    ticks right of it, +8 at its near end and -8 at its far end as a DJ deck's, TEMPO over it), SYNC
    and MASTER left of it (rounded keys, each lettered), KEY LOCK and TEMPO RANGE above it."""
    x = DK_FADER_X
    y0, y1 = DK_FADER_Y
    yc = (y0 + y1) / 2
    slab(name + "_fader_slot", [rrect(8.0, y1 - y0, 4.0, cx=x, cy=yc)], DK_TOP, DK_TOP + 0.03, M["well"], parent=root)
    slab(name + "_fader_gap", [rrect(2.4, y1 - y0 - 6.0, 1.2, cx=x, cy=yc)], DK_TOP, DK_TOP + 0.05, M["rubber"],
         parent=root)
    rbox(name + "_fader_cap", (18.0, 10.0, 8.0), M["rubber"], bevel_mm=1.0 if WEB else 1.4, seg=1 if WEB else 3,
         parent=root, loc=L(x, DK_FADER_CAP, DK_TOP + 4.0))
    rbox(name + "_fader_line", (16.0, 1.0, 0.08), M["ink"], parent=root, loc=L(x, DK_FADER_CAP, DK_TOP + 8.04))
    ticks = [((x + 7.0 + (0.9 if k == 4 else 0.0), y0 + 4.0 + (y1 - y0 - 8.0) * k / 8, DK_TOP + 0.02),
              (4.4 if k == 4 else 2.6, 0.5, 0.04)) for k in range(9)]
    _box_cluster(name + "_fader_ticks", ticks, M["ink"], root)
    for word, yy in (("+8", y0 + 4.0), ("-8", y1 - 4.0), ("TEMPO", y1 + 4.0)):
        text("%s_lbl_tempo_%s" % (name, "plus" if word == "+8" else "minus" if word == "-8" else "name"), word, 2.4,
             M["ink"], font="din" if word != "TEMPO" else "avenir", parent=root, loc=L(x - 13.0, yy, DK_TOP + 0.02))
    for kx, ky, word in DK_SYNC:
        key = word.lower()
        rbox("%s_%s_key" % (name, key), (18.0, 10.0, 3.5), M["btn"], bevel_mm=1.0 if WEB else 1.6, seg=1 if WEB else 3,
             parent=root, loc=L(kx, ky, DK_TOP + 1.75))
        text("%s_lbl_%s" % (name, key), word, 2.0, M["ink"], font="avenir", parent=root, loc=L(kx, ky, DK_TOP + 3.53))
    for kx, ky, word in DK_LOCK:
        key = word.lower().replace(" ", "_")
        _round_key("%s_%s_key" % (name, key), root, kx, ky, 4.5, 3.0)
        text("%s_lbl_%s" % (name, key), word, 1.7, M["ink"], font="avenir", parent=root,
             loc=L(kx, ky + 7.5, DK_TOP + 0.02))


def deck_labels(name, root):
    """The labels printed round the keys (the keys keep their icons): TRACK SEARCH over prev and
    next, CUE and PLAY under the two big keys, REPEAT and SHUFFLE under the small ones."""
    z = DK_TOP + 0.02
    for word, x, y, size in (("TRACK SEARCH", -120.0, -41.0, 2.4), ("CUE", -120.0, -127.5, 2.4),
                             ("PLAY", -120.0, -171.0, 2.4), ("REPEAT", -137.0, 47.5, 2.2),
                             ("SHUFFLE", -107.0, 47.5, 2.2)):
        text("%s_lbl_%s" % (name, word.lower().replace(" ", "_")), word, size, M["ink"], font="avenir", parent=root,
             loc=L(x, y, z))


def deck_controls(name, root):
    """Every decor control on the top, and the labels round the keys."""
    deck_pads(name, root)
    deck_browse(name, root)
    deck_tempo(name, root)
    deck_labels(name, root)


# ------------------------------------------------------------------ the body's detail
def deck_front(name, root):
    """The front: the model line on the left, a USB-A port (a metal shell round its dark opening and
    tongue) and an SD slot beside it, each named under it; ncam engraved on the right half."""
    y = -DK_D / 2
    text(name + "_front_print", "ncam   DK·01   COMPACT DISC DECK", 3.2, M["ink"], font="avenir", align="LEFT",
         parent=root, loc=L(-146.0, y - 0.02, 38.0), rot=DK_FRONT)
    ux, uz = -50.0, 42.0
    slab(name + "_usb_shell", [rrect(14.8, 6.8, 0.9), rrect(13.0, 5.0, 0.4)], 0.0, 0.6, M["hardware"], parent=root,
         loc=L(ux, y, uz), rot=DK_FRONT)
    rbox(name + "_usb_port", (13.0, 5.0, 0.1), M["black_glass"], parent=root, loc=L(ux, y - 0.05, uz), rot=DK_FRONT)
    rbox(name + "_usb_tongue", (10.6, 1.7, 0.2), M["btn"], parent=root, loc=L(ux, y - 0.16, uz + 1.0), rot=DK_FRONT)
    sx, sz = -14.0, 42.0
    slab(name + "_sd_frame", [rrect(28.6, 5.6, 1.2), rrect(26.0, 3.0, 0.6)], 0.0, 0.4, M["hardware"], parent=root,
         loc=L(sx, y, sz), rot=DK_FRONT)
    rbox(name + "_sd_slot", (26.0, 3.0, 0.1), M["black_glass"], parent=root, loc=L(sx, y - 0.05, sz), rot=DK_FRONT)
    for word, x in (("USB", ux), ("SD", sx)):
        text("%s_lbl_%s" % (name, word.lower()), word, 1.8, M["ink"], font="avenir", parent=root,
             loc=L(x, y - 0.02, uz - 6.5), rot=DK_FRONT)
    text(name + "_front_logo", "ncam", 6.0, M["ink"], font="futura", parent=root, loc=L(95.0, y - 0.02, 40.0),
         rot=DK_FRONT)


def deck_back(name, root):
    """The back, seldom seen: the AC inlet with its three pins, the LINK port, and the RCA outputs L
    (white ring) and R (red ring), each named over it."""
    y = DK_D / 2
    ix, iz = -96.0, 38.0
    slab(name + "_ac_inlet", [[(-12.0, -6.0), (-7.0, -9.0), (7.0, -9.0), (12.0, -6.0), (12.0, 9.0), (-12.0, 9.0)]],
         0.0, 1.2, M["rubber"], bevel_mm=0.0 if WEB else 0.3, parent=root, loc=L(ix, y, iz), rot=DK_BACK_FACE)
    rbox(name + "_ac_recess", (19.0, 12.0, 0.1), M["black_glass"], parent=root, loc=L(ix, y + 1.25, iz),
         rot=DK_BACK_FACE)
    _box_cluster(name + "_ac_pins", [((ix + dx, y + 2.6, iz + dz), (1.4, 2.8, 3.4))
                                     for dx, dz in ((-5.0, -1.5), (5.0, -1.5), (0.0, 3.0))], M["hardware"], root)
    lx, lz = -40.0, 38.0
    slab(name + "_link_shell", [rrect(14.6, 13.0, 0.8), rrect(12.6, 11.0, 0.4)], 0.0, 0.6, M["hardware"],
         parent=root, loc=L(lx, y, lz), rot=DK_BACK_FACE)
    rbox(name + "_link_port", (12.6, 11.0, 0.1), M["black_glass"], parent=root, loc=L(lx, y + 0.05, lz),
         rot=DK_BACK_FACE)
    for k, (x, ring, word) in enumerate(((58.0, M["rca_white"], "L"), (76.0, M["rca_red"], "R"))):
        lathe("%s_rca_%d" % (name, k), [(0.01, 0.0), (4.2, 0.0), (4.2, 1.6), (3.6, 2.0), (3.6, 9.0), (3.2, 9.4),
                                        (1.9, 9.4), (1.9, 8.6), (0.01, 8.6)], M["hardware"], seg=32, parent=root,
              loc=L(x, y, 36.0), rot=DK_BACK_FACE)
        lathe("%s_rca_ring_%d" % (name, k), [(4.3, 0.0), (5.4, 0.0), (5.4, 2.2), (4.3, 2.2)], ring, seg=32,
              parent=root, loc=L(x, y, 36.0), rot=DK_BACK_FACE)
        text("%s_lbl_rca_%d" % (name, k), word, 2.2, M["ink"], font="avenir", parent=root, loc=L(x, y + 0.02, 45.0),
             rot=DK_BACK_FACE)
    for word, x in (("AC IN", ix), ("LINK", lx)):
        text("%s_lbl_%s" % (name, word.lower().replace(" ", "_")), word, 2.2, M["ink"], font="avenir", parent=root,
             loc=L(x, y + 0.02, 51.0), rot=DK_BACK_FACE)


def deck_body_detail(name, root):
    """The top plate's four countersunk screws, the front, the back, and a row of twelve vents in
    each side (dark slots, 2.5 x 30 mm)."""
    _dome_cluster(name + "_screws", [((x, y, DK_TOP), (0.0, 0.0, 1.0), 2.0, 0.3) for x, y in DK_SCREWS],
                  M["hardware"], root)
    crosses = []
    for x, y in DK_SCREWS:
        crosses += [((x, y, DK_TOP + 0.3), (2.2, 0.45, 0.06)), ((x, y, DK_TOP + 0.3), (0.45, 2.2, 0.06))]
    _box_cluster(name + "_screw_slots", crosses, M["ink_dark"], root)
    deck_front(name, root)
    deck_back(name, root)
    _box_cluster(name + "_vents", [((sx * (DK_W / 2 - 0.3), (k - 5.5) * 5.5, 37.0), (0.7, 2.5, 30.0))
                                   for sx in (-1, 1) for k in range(12)], M["well"], root)

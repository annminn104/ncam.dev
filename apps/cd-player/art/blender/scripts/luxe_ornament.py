"""Luxe's ornament: cloisonné enamel from ornament.py's kit, its wire in luxe_metal (so the outlines
follow the look's metal) and its enamel from the fixed palette, on the deck's plinth and top, the
record stand and the ledge. luxe.py's make_luxe calls luxe_deck_ornament, make_luxe_player
luxe_stand_ornament and luxe_ledge_ornament; each part hangs from the group it decorates (the deck's
body group, the stand, the ledge), so that it moves with it.

Exec'd after luxe_stand.py, into the same namespace: it reads luxe.py's dimensions (the tiers, their
corners, the keys, the logo, the LED ring round the platter's axis), luxe_stand.py's (the side
panels, the back bar, the slots' lean, the ledge's legs) and ornament.py's kit. Blender's axes as in
parts.py, millimetres.

- The lower tier (faces z 18 to 58), between z 24 and 50 (ORN_BAND): on the front a cartouche at the
  middle (a rocaille shell over a camellia, between two C-scrolls), and out to both corners,
  symmetric, acanthus leaves, S- and C-scrolls, camellias, daisies and leaf sprays; on each side a
  smaller medallion (a camellia in a ring of four C-scrolls) with a leaf spray either side, toward
  the front of the side (ORN_SIDE_Y), where the stand beside the right one hides none of it. The
  back is bare (unseen).
- The upper tier (z 58 to 80): a pearl row round its whole outline at z 67 (ORN_PEARL) and an
  enamel rose every 60 mm on the front and the sides, a leaf either side of it (ORN_ROSE).
- The top, inside the frame: a spray round the ncam logo at the front right (a stem arching over
  the letters from a daisy to a camellia, a rose and a vine up the right edge), and a small one at
  the front left behind the keys. Both keep clear of the keys and their gaps, the logo, the LED ring
  (ORN_RING_CLEAR), and the arm: in front of its rest (in front of the head at rest) and right of
  it (the arm sweeps left onto the record). The back left corner, where the decor knob stands, is
  bare.
- The stand: each side panel's outer face carries the plinth sides' medallion and its sprays,
  which follow the panel's sloping top, and a vine under the rail; the back bar a vine along its
  back. Slot 4's sleeve leans on the bar's front, so the vine keeps within BAR_WINDOW of its back.
- The ledge: a vine up the back of each leg and a rose on a boss near its top. The playing record's
  sleeve leans 0.4 mm off the legs' fronts, so the vine keeps within LEG_WINDOW of each leg's back
  line and the boss stands behind it.
Every part keeps 5 mm or more clear of a record or a sleeve, resting or flying.
"""
import math

from mathutils import Vector

ORN_BAND = (24.0, 50.0)          # the lower tier's ornament lies between these heights
ORN_SIDE_Y = -95.0               # the side medallions' middles along the sides (y)
ORN_PEARL = (67.0, 1.4, 6.0)     # the upper tier's pearl row: its height, its beads' radius, their pitch
ORN_ROSE = (60.0, 4.6, 11.5)     # its roses: their pitch, their radius, how far each keeps the pearls off
ORN_RING_CLEAR = 170.0           # the top's sprays keep this far off the platter's axis (the ring's 165.4)
BAR_WINDOW = 1.0                 # the stand bar's vine weaves this many mm either side of its back line
LEG_WINDOW = 0.25                # the ledge legs' vines, likewise


def _shifted(items, da, db=0.0):
    """A layout moved da along a and db along b."""
    return [(motif, (at[0] + da, at[1] + db), size, *rest) for motif, at, size, *rest in items]


def _scaled(items, k):
    """A layout grown k times about (0, 0)."""
    return [(motif, (at[0] * k, at[1] * k), size * k, *rest) for motif, at, size, *rest in items]


def _hold(orn, since, lo, hi, what):
    """Stops the run, naming `what` and where it reaches, unless every vertex laid since `since`
    lies in the box lo .. hi ((x, y, z) mm in the group's frame; None leaves that side free)."""
    least, most = orn.extent(since)
    for axis in range(3):
        if (lo[axis] is not None and least[axis] < lo[axis] - 1e-6) or (hi[axis] is not None and most[axis] > hi[axis] + 1e-6):
            raise SystemExit("luxe_ornament.py: %s reaches %s .. %s, outside %s .. %s"
                             % (what, tuple(round(c, 2) for c in least), tuple(round(c, 2) for c in most), lo, hi))


def side_name(sx):
    return "left" if sx < 0 else "right"


def _medallion(colours):
    """The sides' medallion round (0, 0): a camellia in a ring of four C-scrolls, each opening toward
    it, and a leaf spray running out either side, a daisy at its end (the right one, and its
    mirror)."""
    ring = [("camellia", (0.0, 0.0), 5.8, {"colours": colours}),
            ("c_scroll", (-10.2, 0.0), 13.0, {}),
            ("c_scroll", (10.2, 0.0), 13.0, {"flip": True}),
            ("c_scroll", (0.0, 9.4), 12.0, {"turn": -math.pi / 2}),
            ("c_scroll", (0.0, -9.4), 12.0, {"turn": math.pi / 2})]
    return ring + mirrored([("spray", (16.5, -3.0), 30.0, {"turn": -math.radians(100.0), "flip": True, "bend": 0.22}),
                            ("daisy", (51.0, 0.5), 4.2, {})])


# ------------------------------------------------------------------ the deck
def luxe_front(orn, wire):
    """The lower tier's front (y = -LX_D / 2, a along x, b up): the cartouche, and the scrollwork out
    to both corners (flat to |x| 201), between ORN_BAND's heights."""
    face = Plane((0.0, -LX_D / 2, 0.0), (0.0, -1.0, 0.0), (0.0, 0.0, 1.0))
    mid = sum(ORN_BAND) / 2
    centre = [("rocaille", (0.0, mid + 4.6), 7.6, {"spread": 1.05}),
              ("camellia", (0.0, mid - 3.0), 7.6, {}),
              ("c_scroll", (-14.5, mid), 24.0, {}),
              ("c_scroll", (14.5, mid), 24.0, {"flip": True})]
    half = [("acanthus", (17.5, mid - 9.5), 21.0, {"turn": -math.radians(78.0), "flip": True}),
            ("s_scroll", (56.0, mid), 33.0, {}),
            ("daisy", (45.5, mid + 8.2), 4.0, {}),
            ("daisy", (66.5, mid - 8.2), 4.0, {"colour": "sky"}),
            ("leaf", (80.0, mid - 6.0), 9.0, {"turn": math.radians(140.0)}),
            ("leaf", (90.0, mid - 6.0), 9.0, {"turn": -math.radians(140.0), "flip": True}),
            ("camellia", (85.0, mid), 8.6, {"colours": ("coral", "butter"), "heart": "rose"}),
            ("spray", (96.0, mid - 2.0), 30.0, {"turn": -math.radians(96.0), "flip": True, "bend": 0.22}),
            ("c_scroll", (134.0, mid), 22.0, {}),
            ("daisy", (142.0, mid), 4.6, {}),
            ("acanthus", (151.0, mid - 9.0), 22.0, {"turn": -math.radians(72.0), "flip": True}),
            ("camellia", (184.0, mid), 7.0, {}),
            ("leaf", (190.0, mid - 5.0), 6.5, {"turn": -math.radians(140.0), "flip": True})]
    since = len(orn.placed)
    lay(orn, face, centre + mirrored(half), wire)
    flat = LX_W / 2 - LX_CORNER[0]
    _hold(orn, since, (-flat, -LX_D / 2 - LX_BAND[1], ORN_BAND[0]), (flat, -LX_D / 2, ORN_BAND[1]), "the front")


def luxe_sides(orn, wire):
    """The lower tier's two sides (x = +-LX_W / 2): a medallion each at ORN_SIDE_Y, its sprays
    either side."""
    mid = sum(ORN_BAND) / 2
    flat = LX_D / 2 - LX_CORNER[0]
    for sx, colours in ((-1, ("rose", "coral")), (1, ("coral", "butter"))):
        # Seen from outside, a runs toward the front on the left side (-y) and toward the back on
        # the right (+y).
        face = Plane((sx * LX_W / 2, 0.0, 0.0), (sx, 0.0, 0.0), (0.0, 0.0, 1.0))
        since = len(orn.placed)
        lay(orn, face, _shifted(_medallion(colours), sx * ORN_SIDE_Y, mid), wire)
        x0, x1 = sorted((sx * LX_W / 2, sx * (LX_W / 2 + LX_BAND[1])))
        _hold(orn, since, (x0, -flat, ORN_BAND[0]), (x1, flat, ORN_BAND[1]), "the %s side" % side_name(sx))


def luxe_upper(orn, wire):
    """The upper tier's pearl row round its whole outline and the roses on its front and sides, a
    leaf either side of each, the pearls kept off them."""
    uw, ud = LX_UPPER
    wall = Wall(rrect(uw, ud, LX_CORNER[1], seg=8 if WEB else 12), zero=(0.0, -ud / 2))
    z, radius, pitch = ORN_PEARL
    every, r, keep = ORN_ROSE
    flat_x, flat_y = uw / 2 - LX_CORNER[1], ud / 2 - LX_CORNER[1]
    stations = [wall.a_of((every * k, -ud / 2)) for k in range(-int(flat_x // every), int(flat_x // every) + 1)]
    for sx in (-1, 1):
        stations += [wall.a_of((sx * uw / 2, every * k)) for k in range(-int(flat_y // every), int(flat_y // every) + 1)]

    def near_rose(a, b):
        return any(min((a - c) % wall.length, (c - a) % wall.length) < keep for c in stations)
    since = len(orn.placed)
    pearl_row(orn, wall, [(0.0, z), (wall.length, z)], wire, radius, pitch, loop=True, skip=near_rose)
    palettes = (("rose", "coral"), ("coral", "butter"), ("sky", "ivory"))
    for k, c in enumerate(stations):
        rose(orn, wall, (c, z), r, wire, colours=palettes[k % len(palettes)])
        for side in (-1, 1):
            leaf(orn, wall, (c + side * 3.8, z), 6.2, wire, turn=-side * math.pi / 2, flip=side < 0)
    # Between the lower tier's band (to z 57) and the upper's (from 76), inside the lower tier.
    _hold(orn, since, (-LX_W / 2, -LX_D / 2, LX_TIER + 2.0), (LX_W / 2, LX_D / 2, LX_TOP - LX_BAND[0] - 2.0), "the upper tier")


def _top_clear(orn, since):
    """Stops the run unless every vertex the top's sprays laid since `since` keeps 3 mm off the keys'
    gaps and the logo, 5 mm off the arm at rest (what is drawn of it: x 122 to 185, from y -131.5
    back) and out of its sweep (within 248 mm of the pivot, which the drawn head reaches to 242,
    from 205 to 280 degrees), ORN_RING_CLEAR off the platter's axis, inside the frame, and out of
    the back left corner (the decor knob's)."""
    uw, ud = LX_UPPER
    px, py = LUXE_PIVOT
    for p in orn.placed[since:]:
        x, y = p.x, p.y
        ang = math.degrees(math.atan2(y - py, x - px)) % 360.0
        why = None
        if abs(x) > uw / 2 - LX_FRAME - 2.0 or abs(y) > ud / 2 - LX_FRAME - 2.0:
            why = "the frame"
        elif math.hypot(x - LX_SPINDLE[0], y - LX_SPINDLE[1]) < ORN_RING_CLEAR:
            why = "the LED ring"
        elif abs(x - LX_PLAY_KEY[0]) < 20.0 and abs(y - LX_PLAY_KEY[1]) < 20.0:
            why = "the play key"
        elif any(math.hypot(x - kx, y - ky) < 12.2 for _, kx, ky in LX_KEYS):
            why = "a round key"
        elif LX_LOGO[0] - 12.0 < x < LX_LOGO[0] + 12.0 and LX_LOGO[1] - 5.5 < y < LX_LOGO[1] + 5.5:
            why = "the logo"
        elif (117.0 < x < 190.0 and y > -136.5) or (math.hypot(x - px, y - py) < 248.0 and 205.0 < ang < 280.0):
            why = "the arm"
        elif x < -150.0 and y > 100.0:
            why = "the back left corner"
        if why:
            raise SystemExit("luxe_ornament.py: the top's ornament at (%.1f, %.1f) runs into %s" % (x, y, why))


def luxe_top(orn, wire):
    """The top's two sprays (z = LX_TOP, a along x, b along y): round the logo at the front right,
    and behind the keys at the front left."""
    top = Plane((0.0, 0.0, LX_TOP), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0))
    since = len(orn.placed)
    # Round the logo (its letters about x 142 to 158, y -173.5 to -170.5): a stem arching 14 mm over
    # them from a daisy on their left to a camellia on their right, a spray running on left past a
    # second daisy, a rose in the corner and a vine up the right edge (x 196 to 208), right of the
    # arm's rest. Each stem starts and ends inside a flower's petals, under its heart: never over it.
    vine(orn, top, [(123.5, -162.5), (135.0, -157.5), (150.0, -155.5), (165.0, -157.0), (177.0, -159.5)], wire,
         every=7.5, leaf_len=6.0)
    vine(orn, top, [(199.5, -136.5), (202.0, -122.0), (200.5, -100.0), (202.0, -78.0), (201.0, -58.0)], wire,
         every=8.0, leaf_len=5.6, leaf_angle=40.0, flowers=[(21.0, "daisy", 4.4), (64.0, "rose", 4.2)])
    vine(orn, top, [(116.0, -167.5), (104.0, -164.0), (92.0, -168.0), (80.0, -166.0)], wire, every=7.0,
         leaf_len=5.6, flowers=[(24.5, "daisy", 4.2, {"colour": "sky"})])
    lay(orn, top, [("daisy", (120.0, -165.0), 4.8, {}),
                   ("leaf", (178.0, -152.0), 7.0, {"turn": math.radians(40.0)}),
                   ("leaf", (191.5, -154.0), 7.0, {"turn": -math.radians(35.0), "flip": True}),
                   ("camellia", (184.0, -161.0), 8.4, {}),
                   ("rose", (200.5, -141.0), 5.6, {"colours": ("coral", "butter")})], wire)
    # Behind the keys (the play key's gap reaches y -143, the round keys' -158.8), in front of the
    # LED ring, off the frame (x -211).
    vine(orn, top, [(-203.0, -78.0), (-200.0, -100.0), (-191.0, -120.0), (-176.0, -131.5), (-158.0, -135.5),
                    (-140.0, -141.0)], wire, every=6.5, leaf_len=6.6,
         flowers=[(8.0, "rose", 4.2, {"colours": ("coral", "butter")}), (31.0, "daisy", 5.4), (60.0, "camellia", 5.6),
                  (88.0, "daisy", 4.2, {"colour": "sky"})])
    _top_clear(orn, since)
    _hold(orn, since, (None, None, LX_TOP), (None, None, LX_TOP + LX_BAND[1]), "the top")


def luxe_deck_ornament(name, body):
    """The deck's ornament (`<name>_deck_orn_<material>`), hanging from its body group: the lower
    tier's front and sides, the upper tier's pearl row and roses, the top's two sprays."""
    orn = Ornament(name + "_deck_orn", body)
    wire = M["luxe_metal"]
    luxe_front(orn, wire)
    luxe_sides(orn, wire)
    luxe_upper(orn, wire)
    luxe_top(orn, wire)
    return orn.done()


# ------------------------------------------------------------------ the stand and the ledge
def luxe_stand_ornament(name, stand):
    """The stand's ornament (`<name>_orn_<material>`), hanging from it: on each side panel's outer
    face (x = +-175 in its frame) the medallion, its sprays tilted to the panel's sloping top and a
    vine 11 mm under the rail, and along the back bar's back a vine."""
    orn = Ornament(name + "_orn", stand)
    wire = M["luxe_metal"]
    t, h0, h1 = LS_PANEL
    slope = math.atan2(h1 - h0, LS_BACK - LS_FRONT)
    centre = (8.0, 38.0)
    medallion = _scaled(_medallion(("rose", "coral")), 1.3)          # the panel is taller than the tier's band
    # The sprays (and their daisies) turned about the medallion's middle to the slope.
    tilted = []
    for motif, at, size, opts in medallion:
        if motif in ("spray", "daisy"):
            c, s = math.cos(slope), math.sin(slope)
            at = (at[0] * c - at[1] * s, at[0] * s + at[1] * c)
            opts = dict(opts, turn=opts.get("turn", 0.0) + slope)
        tilted.append((motif, at, size, opts))
    under = [(y, _panel_top(y) - 11.0) for y in (LS_FRONT + 8.0, 0.0, LS_BACK - 8.0)]
    for sx in (-1, 1):
        # Seen from outside, a runs toward the back on the right panel (+y), toward the front on the left.
        face = Plane((sx * (LS_INNER + t), 0.0, 0.0), (sx, 0.0, 0.0), (0.0, 0.0, 1.0))
        since = len(orn.placed)
        items = _shifted(tilted, *centre)
        lay(orn, face, items if sx > 0 else mirror(items), wire)
        path = [(sx * y, z) for y, z in under]
        vine(orn, face, path, wire, every=11.0, leaf_len=5.0, smooth=False,
             flowers=[(k * 45.0 + 18.0, "daisy" if k % 2 else "rose", 3.6) for k in range(4)])
        # On the panel's flat, 4 mm inside its edges and 6 under its rail, and under the band's 0.8 mm.
        x0, x1 = sorted((sx * (LS_INNER + t), sx * (LS_INNER + t + LX_BAND[1])))
        _hold(orn, since, (x0, LS_FRONT + 4.0, 4.0), (x1, LS_BACK - 4.0, None), "the stand's %s panel" % side_name(sx))
        for p in orn.placed[since:]:
            if p.z > _panel_top(p.y) - 6.0:
                raise SystemExit("luxe_ornament.py: the stand's %s panel's ornament at (%.1f, %.1f) runs into its rail"
                                 % (side_name(sx), p.y, p.z))
    # Slot 4's sleeve leans on the bar's front: a Tube whose a = 0 is the bar's back line, square to
    # the sleeve's face.
    bar_y, bar_z, bar_r = LS_BAR
    end = LS_INNER + t + 1.0
    back = (0.0, math.cos(LS_LEAN), -math.sin(LS_LEAN))
    bar = Tube((-end, bar_y, bar_z), (end, bar_y, bar_z), bar_r, ref=back)
    # Between the posts (x +-170), 10 mm inside them.
    vine_round(orn, bar, wire, end - 160.0, end + 160.0, turns=8.0, window=(-BAR_WINDOW, BAR_WINDOW), every=13.0,
               leaf_len=6.0, leaf_width=0.38, leaf_angle=22.0, tendrils=False)
    return orn.done()


def luxe_ledge_ornament(name, ledge):
    """The ledge's ornament (`<name>_orn_<material>`), hanging from it: a vine up the back of each
    leg, weaving within LEG_WINDOW of its back line three times, a leaf every 25 mm, and near its top
    a metal boss behind it with a rose on it, all 5 mm or more behind the face of the sleeve that
    leans 0.4 mm off the legs."""
    orn = Ornament(name + "_orn", ledge)
    wire = M["luxe_metal"]
    lx, ly, lr, top = LEDGE_LEG
    _, _, h = LEDGE_BAR
    back = Vector((0.0, math.cos(LS_LEAN), -math.sin(LS_LEAN)))
    up = Vector((0.0, math.sin(LS_LEAN), math.cos(LS_LEAN)))
    for side, sx in (("l", -1), ("r", 1)):
        p0 = Vector((sx * lx, ly, h))
        leg = Tube(p0, p0 + up * ((top - h) / math.cos(LS_LEAN)), lr, ref=tuple(back))
        boss_at = leg.length - 6.0
        vine_round(orn, leg, wire, 4.0, boss_at - 5.5, turns=3.0, window=(-LEG_WINDOW, LEG_WINDOW), every=25.0,
                   leaf_len=4.2, leaf_width=0.25, leaf_angle=7.0, tendrils=False, width=0.6)
        # The boss: a metal disc square to `back`, 2.3 to 3.5 mm behind the leg's axis (0.2 mm into
        # the leg at its back line, 5.2 behind the sleeve); the rose on its back face.
        axis = p0 + up * boss_at
        lathe("%s_orn_boss_%s" % (name, side), [(0.01, 0.0), (3.6, 0.0), (3.6, 1.2), (0.01, 1.2)], M["luxe_metal"],
              seg=32, parent=ledge, loc=mmv(tuple(axis + back * 2.3)), rot=(-math.radians(90.0) - LS_LEAN, 0.0, 0.0))
        face = Plane(tuple(axis + back * 3.5), tuple(back), tuple(up))
        rose(orn, face, (0.0, 0.0), 3.3, wire, colours=("rose", "coral"))
    return orn.done()

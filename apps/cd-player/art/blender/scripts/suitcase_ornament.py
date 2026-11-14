"""The suitcase's ornament: cloisonné enamel from ornament.py's kit, its wire in hardware (so the
outlines follow the skin's metal) and its enamel from the fixed palette, on the tub's leather, the
deck top and the lid's lining. parts.py's make_player calls suitcase_ornament; the tub's and the
deck's ornament hang from the player's root, the lining's from the lid, so that it opens with it.

Exec'd after parts.py and ornament.py, for the suitcase alone (the Clear and the Deck exec parts.py
but never call make_player), into the same namespace: it reads parts.py's dimensions (the tub, the
deck, the well, the lid and its lining, the rack's frame) and ornament.py's kit. Blender's axes as
in parts.py, millimetres; the lid's ornament in the lid's own frame (its lining's face at HL - 13.5,
facing the visitor along -z, its far edge, up once the lid is open, toward -y).

- The tub, under the seam (between the grille's stitched border and the top stitches, SEAM): either
  side of the handle a camellia with tucked leaves between the handle's mount and the clasp, and
  from the clasp a vine that winds round the front corner and along the side to its back, with
  daisies, camellias and roses. The middle, behind the grip, is bare.
- The tub's two sides: a bouquet medallion each (MEDALLION), a pearl-set oval holding a camellia,
  roses and daisies on stems tied with a bow, C-scrolls and leaf sprays either side and acanthus
  under it.
- The deck top: a small daisy spray in each corner, clear of the well, the keys and their labels,
  the knob and its ticks, the display, the tonearm and its sweep, the screws and the lettering.
- The lid's lining: a thin vine border round its free edge (along the bottom, up the left side and
  above the strap), a floral spray in its two free corners (the bottom left, and the top left under
  the strap), a camellia between the plate and the rack and a vine with flowers between the strap
  and the case. The rack's frame takes the lining's whole right half, both corners there included,
  so they are bare; nothing lies under the case, its clips, the strap, the plate or the rack.
Each region stops the run if its ornament strays from where it may lie.
"""
import math

SEAM = (68.9, 76.7)              # the tub's band under the seam: over the grille's border, under the stitches
SEAM_B = 72.8                    # where the vine runs along the front
SEAM_LOW = 66.0                  # on the corners and the sides, with no grille under it, the band reaches here
HANDLE_KEEP = 67.5               # |x| inside which the front's band is the handle's (its mounts, with 1.5 mm)
CLASP_KEEP = (81.5, 108.5)       # |x| the clasps take on the front's band, with 1.5 mm
MEDALLION = (40.0, 50.0, 23.0)   # the sides' medallion: its middle's height, its oval's half width and height
SIDE_KEEP = (8.5, 88.0)          # the medallion keeps over the bottom stitches and |y| inside the corner caps


def _hold(orn, since, lo, hi, what):
    """Stops the run, naming `what` and where it reaches, unless every vertex laid since `since`
    lies in the box lo .. hi ((x, y, z) mm in the group's frame; None leaves that side free)."""
    least, most = orn.extent(since)
    for axis in range(3):
        low = lo[axis] is not None and least[axis] < lo[axis] - 1e-6
        high = hi[axis] is not None and most[axis] > hi[axis] + 1e-6
        if low or high:
            raise SystemExit("suitcase_ornament.py: %s reaches %s .. %s, outside %s .. %s"
                             % (what, tuple(round(c, 2) for c in least), tuple(round(c, 2) for c in most), lo, hi))


def _clear(orn, since, what, boxes=(), rounds=(), inside=None):
    """Stops the run, naming `what`, the vertex and the part, if a vertex laid since `since` (its x
    and y, mm in the group's frame) falls in one of `boxes` ((name, x0, x1, y0, y1)) or `rounds`
    ((name, x, y, r)), or outside `inside` (a rounded rectangle (x, y, half width, half height,
    corner radius))."""
    for p in orn.placed[since:]:
        why = None
        for name, x0, x1, y0, y1 in boxes:
            if x0 < p.x < x1 and y0 < p.y < y1:
                why = name
        for name, x, y, r in rounds:
            if math.hypot(p.x - x, p.y - y) < r:
                why = name
        if inside is not None:
            x, y, hx, hy, r = inside
            dx, dy = max(abs(p.x - x) - (hx - r), 0.0), max(abs(p.y - y) - (hy - r), 0.0)
            if math.hypot(dx, dy) > r + 1e-6:
                why = "the edge"
        if why:
            raise SystemExit("suitcase_ornament.py: %s at (%.1f, %.1f, %.1f) runs into %s"
                             % (what, p.x, p.y, p.z, why))


def _shifted(items, da, db=0.0):
    """A layout moved da along a and db along b."""
    return [(motif, (at[0] + da, at[1] + db), size, *rest) for motif, at, size, *rest in items]


def _end(path):
    """How long a vine's stem along `path` is (vine() smooths the path first): where a flower at its
    end goes."""
    return _OrnPath(smooth_path(path, 6) if len(path) > 2 else list(path)).length


def _spray(orn, face, path, wire, flowers=(), **kw):
    """A vine along `path` (vine()'s keywords), a flower's `along` None for one at the vine's end."""
    end = _end(path)
    vine(orn, face, path, wire, flowers=[(end if at is None else at, *rest) for at, *rest in flowers], **kw)


def _wave(a0, a1, b, depth, pitch, step=6.0):
    """A vine's path from a0 to a1 along b, rising and falling `depth` mm every `pitch` mm."""
    n = max(2, int(math.ceil(abs(a1 - a0) / step)))
    return [(a0 + (a1 - a0) * i / n, b + depth * math.sin(2.0 * math.pi * (a1 - a0) * i / n / pitch))
            for i in range(n + 1)]


def _vine_and_mirror(orn, face, path, wire, **kw):
    """A vine along `path` (vine()'s keywords, each flower with its keywords) and its mirror image
    across a = 0, its flowers drawn the other way round."""
    vine(orn, face, path, wire, **kw)
    flowers = [(along, motif, size, dict(opts, turn=-opts.get("turn", 0.0), flip=not opts.get("flip", False)))
               for along, motif, size, opts in kw.get("flowers", ())]
    vine(orn, face, [(-a, b) for a, b in path], wire, **dict(kw, flowers=flowers))


# ------------------------------------------------------------------ the tub
def _daisy(orn, face, at, r, wire, petals=None, **kw):
    """ornament.py's daisy with as many petals as its size carries: seven up to 4 mm, eight past
    it, so that each petal's enamel reads inside its wire."""
    daisy(orn, face, at, r, wire, petals=petals or (7 if r <= 4.0 else 8), **kw)


def _tucked(at, r, flower, length, angles, opts=None, leaf_width=0.5):
    """A flower `r` mm in radius at `at` with leaves rooted under it, one toward each of `angles`
    (degrees counter-clockwise from +a as one sees the face), `length` mm long."""
    items = [("leaf", at, length, {"turn": math.radians(d) - math.pi / 2, "width": leaf_width,
                                   "flip": math.cos(math.radians(d)) < 0}) for d in angles]
    return items + [(flower, at, r, dict(opts or {}))]


def _bouquet():
    """The sides' medallion's bouquet round (0, 0) (its oval's middle): a camellia, two roses, two
    sky daisies, two butter ones and two small ivory ones, on stems tied in a butter bow under them,
    leaves round the camellia and between the flowers. Returns the layout, the stems (paths of wire
    under the flowers and the leaves) and the knot."""
    knot = (0.0, -10.8)
    blooms = [("camellia", (0.0, 1.0), 8.4, {"colours": ("rose", "coral")}),
              ("rose", (15.2, -2.6), 5.6, {"colours": ("rose", "butter")}),
              ("rose", (-15.2, -2.6), 5.6, {"colours": ("rose", "butter"), "flip": True}),
              (_daisy, (26.4, 3.8), 4.5, {"colour": "sky"}),
              (_daisy, (-26.4, 3.8), 4.5, {"colour": "sky"}),
              (_daisy, (8.2, 11.0), 3.6, {"colour": "butter", "heart": "rose"}),
              (_daisy, (-8.2, 11.0), 3.6, {"colour": "butter", "heart": "rose"}),
              (_daisy, (36.0, -3.4), 3.2, {"heart": "rose"}),
              (_daisy, (-36.0, -3.4), 3.2, {"heart": "rose"})]
    leaves = []
    for u, v, d, length in ((6.0, 6.5, 40.0, 9.5), (8.5, -4.0, -25.0, 9.0), (20.0, 4.5, 30.0, 8.5),
                            (21.0, -7.5, -40.0, 8.0), (30.5, 1.0, 10.0, 7.0), (13.0, 9.5, 55.0, 6.0)):
        leaves.append(("leaf", (u, v), length, {"turn": math.radians(d) - math.pi / 2, "width": 0.42}))
        leaves.append(("leaf", (-u, v), length, {"turn": math.pi / 2 - math.radians(d), "width": 0.42,
                                                 "flip": True}))
    bow = [("leaf", knot, 5.4, {"turn": math.radians(55.0), "width": 0.62, "colour": "butter", "layer": BLOOM}),
           ("leaf", knot, 5.4, {"turn": -math.radians(55.0), "width": 0.62, "colour": "butter", "layer": BLOOM,
                                "flip": True}),
           ("leaf", knot, 4.6, {"turn": math.radians(160.0), "width": 0.3, "colour": "butter", "layer": BLOOM}),
           ("leaf", knot, 4.6, {"turn": -math.radians(160.0), "width": 0.3, "colour": "butter", "layer": BLOOM,
                                "flip": True})]
    stems = [[at, ((at[0] + knot[0]) / 2 * 0.8, (at[1] + knot[1]) / 2), knot] for _, at, _, _ in blooms]
    return leaves + blooms + bow, stems, knot


def _medallion(orn, face, centre, wire):
    """The bouquet medallion with its middle at `centre` (a, b) on `face`: the oval's wires and its
    pearls, the bouquet in it, a C-scroll and a leaf spray either side and two acanthus leaves
    under it."""
    ca, cb = centre
    _, half_w, half_h = MEDALLION

    def oval(ka, kb, n):
        return [(ca + ka * math.cos(2.0 * math.pi * i / n), cb + kb * math.sin(2.0 * math.pi * i / n))
                for i in range(n)]
    n = _orn_n(160, 72)
    orn.strip(face, oval(half_w, half_h, n), STEM_W, wire, STEM, closed=True)
    orn.strip(face, oval(half_w - 6.2, half_h - 6.2, n), STEM_W, wire, STEM, closed=True)
    pearl_row(orn, face, oval(half_w - 3.1, half_h - 3.1, n) + [(ca + half_w - 3.1, cb)], wire, radius=1.0,
              pitch=4.6, loop=True)
    flowers, stems, knot = _bouquet()
    for path in stems:
        Pen(orn, face, (ca, cb)).wire(smooth_path(path, 6), wire, 0.6, up=0)
    lay(orn, face, _shifted(flowers, ca, cb), wire)
    Pen(orn, face, (ca + knot[0], cb + knot[1]), layer=BLOOM).cell(_orn_circle(1.2, _orn_n(12, 8)), "butter", wire,
                                                                   up=1)
    outside = [("c_scroll", (half_w + 4.6, 0.0), 15.0, {"flip": True}),
               ("spray", (half_w + 9.0, -1.5), 22.0, {"turn": -math.radians(92.0), "bend": 0.2, "flip": True}),
               (_daisy, (half_w + 33.0, 0.0), 3.6, {"colour": "coral"}),
               ("acanthus", (3.0, -half_h + 0.6), 12.5, {"turn": -math.radians(98.0), "curl": 0.22, "flip": True})]
    lay(orn, face, _shifted(mirrored(outside), ca, cb), wire)


def suitcase_tub(orn, wire):
    """The tub's band under the seam and its sides' medallions, on the wall of its outline (a from
    the front's middle, counter-clockwise seen from above; b the height): the right half, and its
    mirror image on the left."""
    wall = Wall(rrect(W, D, RAD), zero=(0.0, -1e6))
    side = wall.a_of((W / 2, 0.0))
    # Between the handle's mount and the clasp: a camellia with a leaf tucked under it either side.
    since = len(orn.placed)
    mid = (HANDLE_KEEP + CLASP_KEEP[0]) / 2
    lay(orn, wall, mirrored(_tucked((mid, SEAM_B), 3.6, "camellia", 6.4, (8.0, 172.0))), wire)
    _hold(orn, since, (-CLASP_KEEP[0], -D / 2 - PROUD, SEAM[0]), (CLASP_KEEP[0], -D / 2, SEAM[1]),
          "the band by the handle")
    _clear(orn, since, "the band by the handle", boxes=[("the handle", -HANDLE_KEEP, HANDLE_KEEP, -1e3, 1e3)])
    # From the clasp round the corner and along the side to its back: a vine with flowers.
    since = len(orn.placed)
    start, corner = CLASP_KEEP[1] + 1.5, wall.a_of((W / 2 - RAD, -D / 2))
    end = side + D / 2 - RAD - 4.0
    path = [(start, SEAM_B)] + _wave(start + 8.0, end, SEAM_B - 1.15, 0.4, 26.0)[1:]
    blooms = [(7.0, _daisy, 3.3, {}),
              ((corner + side - D / 2 + RAD) / 2 - start, "camellia", 4.4, {}),
              (side - 62.0 - start, "rose", 4.0, {"colours": ("rose", "coral")}),
              (side - 30.0 - start, _daisy, 3.8, {"colour": "sky"}),
              (side - start, "camellia", 4.4, {"colours": ("coral", "butter"), "heart": "rose"}),
              (side + 30.0 - start, _daisy, 3.8, {}),
              (side + 62.0 - start, "rose", 4.0, {"colours": ("rose", "butter")})]
    _vine_and_mirror(orn, wall, path, wire, every=9.0, leaf_len=4.0, leaf_angle=42.0, flowers=blooms)
    _hold(orn, since, (-W / 2 - PROUD, -D / 2 - PROUD, SEAM_LOW), (W / 2 + PROUD, D / 2 - RAD, SEAM[1]), "the band")
    for p in orn.placed[since:]:
        on_front = p.y < -D / 2 + 1.0 and abs(p.x) < 122.5
        if on_front and (p.z < SEAM[0] or abs(p.x) < CLASP_KEEP[1]):
            raise SystemExit("suitcase_ornament.py: the band at (%.1f, %.1f, %.1f) runs into the grille's border or a "
                             "clasp" % (p.x, p.y, p.z))
    # The sides' medallions.
    for sx in (1, -1):
        since = len(orn.placed)
        _medallion(orn, wall, (sx * side, MEDALLION[0]), wire)
        # The pearls' caps go on BEAD_FOOT under the leather, out of sight.
        x0, x1 = sorted((sx * (W / 2 - BEAD_FOOT), sx * (W / 2 + PROUD)))
        _hold(orn, since, (x0, -SIDE_KEEP[1], SIDE_KEEP[0]), (x1, SIDE_KEEP[1], SEAM_LOW),
              "the %s side's medallion" % ("right" if sx > 0 else "left"))


# ------------------------------------------------------------------ the deck
# What the deck's sprays keep off (x, y mm): the well and its ring, the screws, the knob and its
# ticks, the tonearm's base (its counterweight swings within 30 mm of the pivot), and the boxes of
# the lettering, the keys and their labels, the display and its LED, the VU strip, with 2 to 3 mm.
DECK_ROUNDS = (("the well", WX, WY, 68.6), ("a screw", 125.0, 93.0, 4.4), ("a screw", -125.0, 93.0, 4.4),
               ("a screw", 125.0, -93.0, 4.4), ("a screw", -125.0, -93.0, 4.4), ("the knob", 100.0, -58.0, 26.8),
               ("the tonearm", AX, AY, 30.0))
DECK_BOXES = (("the brand", -113.5, -94.3, -92.7, -85.3), ("the model's name", -113.9, -84.2, -99.1, -93.8),
              ("the keys", 75.6, 124.4, -25.9, 42.4), ("the display", 61.0, 134.0, 38.9, 82.5),
              ("the LED", 115.8, 129.4, 81.6, 88.4), ("VOLUME", 94.4, 105.5, -88.1, -82.8))


def _deck_clear(orn, since):
    """Stops the run unless the deck's sprays laid since `since` keep off DECK_ROUNDS, DECK_BOXES and
    the tonearm's sweep (the arm turns 30 degrees clockwise from its rest, 265 degrees round the
    pivot, onto the disc: it keeps out of 222 to 280 degrees within 120 mm), 2.5 mm inside the tub's
    inner walls, and under PROUD."""
    _clear(orn, since, "the deck's ornament", DECK_BOXES, DECK_ROUNDS,
           inside=(0.0, 0.0, W / 2 - WALL - 2.5, D / 2 - WALL - 2.5, RAD - 10.0 - 2.5))
    for p in orn.placed[since:]:
        ang = math.degrees(math.atan2(p.y - AY, p.x - AX)) % 360.0
        if math.hypot(p.x - AX, p.y - AY) < 120.0 and 222.0 < ang < 280.0:
            raise SystemExit("suitcase_ornament.py: the deck's ornament at (%.1f, %.1f) runs into the tonearm's sweep"
                             % (p.x, p.y))
    _hold(orn, since, (None, None, DECK), (None, None, DECK + PROUD), "the deck's ornament")


def suitcase_deck(orn, wire):
    """The deck top's daisy sprays (z = DECK, a along x, b along y), one round each corner screw:
    along the back edge and down the left edge at the back left, arching over the brand and up the
    left edge at the front left, along the back edge right of the tonearm, and along the front edge
    and up the right edge at the front right."""
    top = Plane((0.0, 0.0, DECK), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0))
    since = len(orn.placed)
    kw = {"every": 7.0, "leaf_len": 4.2, "leaf_angle": 44.0}

    def spray_on(path, flowers, **more):
        _spray(orn, top, path, wire, flowers, **dict(kw, **more))
    # The back left.
    spray_on([(-116.0, 98.6), (-102.0, 99.2), (-88.0, 98.4), (-74.0, 99.0), (-62.0, 98.4)],
             [(0.0, _daisy, 4.2, {"colour": "coral"}), (27.0, _daisy, 4.0, {"colour": "sky"}),
              (None, "camellia", 4.8, {})])
    spray_on([(-130.0, 84.0), (-129.6, 70.0), (-130.2, 56.0), (-129.6, 42.0), (-129.8, 30.0)],
             [(0.0, _daisy, 4.0, {"colour": "rose"}), (27.0, "rose", 4.0, {"colours": ("coral", "butter")}),
              (None, _daisy, 3.6, {"colour": "sky"})])
    # The front left: over the brand, and up the left edge.
    spray_on([(-117.5, -83.5), (-108.0, -80.5), (-97.0, -79.8), (-86.0, -81.6)],
             [(0.0, _daisy, 3.6, {"colour": "coral"}), (None, "camellia", 4.8, {})])
    spray_on([(-130.0, -80.0), (-129.6, -64.0), (-130.2, -48.0), (-129.8, -36.0)],
             [(22.0, "rose", 4.0, {"colours": ("rose", "coral")}), (None, _daisy, 3.8, {"colour": "sky"})])
    # The back right, right of the tonearm and over the display's LED.
    spray_on([(80.0, 97.8), (92.0, 98.8), (104.0, 97.6), (116.0, 98.4)],
             [(0.0, _daisy, 4.0, {"colour": "rose"}), (18.5, "camellia", 4.6, {"colours": ("coral", "butter")}),
              (None, _daisy, 3.8, {"colour": "sky"})])
    # The front right: under VOLUME, and up the right edge outside the knob's ticks.
    spray_on([(70.0, -98.6), (82.0, -99.4), (94.0, -98.4), (106.0, -99.2), (117.0, -98.4)],
             [(0.0, _daisy, 4.0, {"colour": "coral"}), (24.0, _daisy, 3.8, {"colour": "sky"}),
              (None, "camellia", 4.4, {})])
    spray_on([(131.0, -84.0), (131.6, -66.0), (130.8, -48.0)], [(None, _daisy, 3.4, {"colour": "rose"})],
             leaf_len=3.6)
    _deck_clear(orn, since)


# ------------------------------------------------------------------ the lid's lining
# What the lining's ornament keeps off (the lid's frame, x and y mm, with 1.5 mm): the case and its
# clips, the strap and its tab, the plate, and the rack's frame (the lining's right half).
LINING_BOXES = (("the case", -132.8, 12.5, -182.0, -54.0), ("a case clip", -72.5, -47.5, -58.5, -48.5),
                ("a case clip", -72.5, -47.5, -187.5, -177.5), ("the strap", -141.0, 6.5, -212.5, -195.5),
                ("the strap's tab", -4.0, 9.0, -213.5, -194.5), ("the plate", -107.5, -12.5, -42.5, -21.5),
                ("the rack", 11.0, 141.0, -230.0, 0.0))


def suitcase_lining(orn, wire):
    """The lining's ornament (its face, z = HL - 13.5 in the lid's frame, facing the visitor: a
    along x, b up the open lid, -y): the edge vine along the bottom, up the left side and above the
    strap; the corner sprays at the bottom left and, under the strap, the top left; a camellia
    between the plate and the rack; a vine between the strap and the case."""
    face = Plane((0.0, 0.0, HL - 13.5), (0.0, 0.0, -1.0), (0.0, -1.0, 0.0))
    since = len(orn.placed)
    # Along the bottom, under the plate, into the bottom left corner's camellia.
    _spray(orn, face, _wave(7.5, -108.0, 17.8, 0.2, 30.0) + [(-116.0, 21.0), (-121.5, 31.5)], wire,
           [(0.0, _daisy, 3.0, {"colour": "sky"}), (47.0, _daisy, 3.0, {"colour": "coral"}),
            (87.0, _daisy, 3.0, {"colour": "rose"}), (None, "camellia", 5.6, {})],
           every=8.0, leaf_len=3.4, leaf_angle=44.0, tendrils=False)
    # The bottom left corner's spray round its camellia: a rose, a sky daisy and leaves.
    lay(orn, face, [("leaf", (-121.5, 31.5), 10.0, {"turn": math.radians(-20.0) - math.pi / 2, "width": 0.45}),
                    ("leaf", (-121.5, 31.5), 9.0, {"turn": math.radians(105.0) - math.pi / 2, "width": 0.45,
                                                   "flip": True}),
                    ("leaf", (-113.5, 44.0), 7.5, {"turn": math.radians(60.0) - math.pi / 2, "width": 0.42}),
                    ("rose", (-113.5, 44.0), 4.0, {"colours": ("coral", "butter")})], wire)
    # Between the plate and the rack: a camellia and a rose over it.
    lay(orn, face, [("leaf", (-0.6, 31.0), 9.0, {"turn": math.radians(130.0) - math.pi / 2, "width": 0.45,
                                                 "flip": True}),
                    ("leaf", (-0.6, 31.0), 8.0, {"turn": math.radians(40.0) - math.pi / 2, "width": 0.45}),
                    ("camellia", (-0.6, 31.0), 5.4, {"colours": ("coral", "butter"), "heart": "rose"}),
                    ("leaf", (-1.0, 45.5), 6.5, {"turn": math.radians(160.0) - math.pi / 2, "width": 0.42,
                                                 "flip": True}),
                    ("rose", (-1.0, 45.5), 3.8, {"colours": ("rose", "coral")})], wire)
    # Up the left side, thin, past the case, into the top left corner's rose under the strap.
    _spray(orn, face, [(-129.5, 47.0), (-133.6, 52.0), (-134.4, 58.0), (-134.4, 110.0), (-134.4, 150.0),
                       (-134.4, 176.0), (-134.0, 183.0), (-131.2, 187.6), (-127.5, 188.5)], wire,
           [(0.0, _daisy, 3.4, {"colour": "sky"}), (None, "rose", 4.8, {})],
           every=8.0, leaf_len=2.4, leaf_angle=18.0, leaf_width=0.34, tendrils=False)
    # Under the strap: on from the rose to a daisy short of the case's clip, and past the clip a
    # vine with a camellia between two daisies.
    _spray(orn, face, [(-127.5, 188.5), (-112.0, 189.2), (-96.0, 188.3), (-80.0, 189.0)], wire,
           [(None, _daisy, 3.6, {"colour": "coral"})], every=8.0, leaf_len=4.0, leaf_angle=44.0)
    _spray(orn, face, [(-43.4, 188.5), (-31.0, 189.3), (-18.0, 188.3), (-6.0, 189.1), (6.0, 188.5)], wire,
           [(0.0, _daisy, 3.4, {"colour": "sky"}), (26.0, "camellia", 4.4, {}),
            (None, _daisy, 3.2, {"colour": "rose"})], every=8.0, leaf_len=4.0, leaf_angle=44.0)
    # Above the strap, along the top edge.
    _spray(orn, face, _wave(-122.0, 8.0, 217.8, 0.4, 28.0), wire,
           [(22.0, _daisy, 3.0, {"colour": "coral"}), (82.0, _daisy, 3.0, {"colour": "sky"})],
           every=8.0, leaf_len=3.4, leaf_angle=40.0)
    _clear(orn, since, "the lining's ornament", LINING_BOXES,
           inside=(0.0, -D / 2, W / 2 - WALL - 2.0, D / 2 - WALL - 2.0, RAD - 10.0 - 2.0))
    _hold(orn, since, (None, None, HL - 13.5 - PROUD), (None, None, HL - 13.5), "the lining's ornament")


def suitcase_ornament(name, root, lid):
    """The suitcase's ornament: the tub's (`<name>_tub_orn_<material>`) and the deck's
    (`<name>_deck_orn_<material>`) hanging from `root`, the lining's (`<name>_lid_orn_<material>`)
    from `lid`, its wire in hardware and its enamel the fixed palette (made here)."""
    build_enamel_materials()
    wire = M["hardware"]
    made = []
    for group, parent, lay_out in (("tub", root, suitcase_tub), ("deck", root, suitcase_deck),
                                   ("lid", lid, suitcase_lining)):
        orn = Ornament("%s_%s_orn" % (name, group), parent)
        lay_out(orn, wire)
        made += orn.done()
    return made

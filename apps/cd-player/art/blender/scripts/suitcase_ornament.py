"""The suitcase's ornament: cloisonné enamel from ornament.py's kit, its wire in hardware (so the
outlines follow the skin's metal) and its enamel from the fixed palette, on the tub's leather, the
deck top and the lid's lining. parts.py's make_player calls suitcase_ornament; the tub's and the
deck's ornament hang from the player's root, the lining's from the lid, so that it opens with it.

Exec'd after parts.py and ornament.py, for the suitcase alone (the Clear and the Deck exec parts.py
but never call make_player), into the same namespace: it reads parts.py's dimensions (the tub, the
deck, the well, the lid and its lining, the rack's frame) and ornament.py's kit. Blender's axes as
in parts.py, millimetres; the lid's ornament in the lid's own frame (its lining's face at HL - 13.5,
facing the visitor along -z, its far edge, up once the lid is open, toward -y). Where parts.py
places a part at a literal position, the part is named here (GRILLE, CLASP, SCREW, CASE ...) and
the keep-outs are worked out from those names and parts.py's own constants.

- The tub, under the seam (between the grille's stitched border and the top stitches, SEAM): either
  side of the handle a short vine between the handle's mount and the clasp, a daisy and a camellia
  on it and two leaves between them, and from the clasp a vine that winds round the front corner and
  along the side to its back, with daisies, camellias and roses. The middle, behind the grip, is
  bare.
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

# ------------------------------------------------------------------ what the ornament keeps off
# parts.py's parts at literal positions, named (mm, the player's frame).
GRILLE = (38.0, 241.0, 59.0)     # the grille's middle height, and its stitched border's width and height
STITCH = (0.75, 0.55)            # cdkit's stitches: a dash's width (across its path) and its height
TOP_STITCH = HB - 6.5            # the tub's top stitches' height (st_top)
BOTTOM_STITCH = 7.0              # the tub's bottom stitches' height (st_bot)
HANDLE_MOUNT = (58.0, 16.0)      # the handle's riveted mounts: |x| of their middles, their width
CLASP = (95.0, 24.0)             # the clasps' lock bodies: |x| of their middles, their width
CAP_REACH = 3.4                  # how far a corner cap wraps past its corner onto a flat face (8 degrees at 24.4)
INNER_CORNER = RAD - 10.0        # the radius of the tub's and the lid's inner corners (their frames' inner outline)

# The tub's band under the seam: over the grille's stitched border with 1 mm, under the top stitches
# with 0.5 mm; on the corners and the sides, with no grille under it, it reaches down to SEAM_LOW.
SEAM = (GRILLE[0] + GRILLE[2] / 2 + STITCH[0] / 2 + 1.0, TOP_STITCH - STITCH[1] / 2 - 0.5)
SEAM_B = 72.8                    # where the vine runs along the front, about the band's middle
SEAM_LOW = 66.0                  # the band's lowest on the corners and the sides
GRILLE_EDGE = GRILLE[1] / 2 + 2.0                           # |x| the band runs over the grille's border to
HANDLE_KEEP = HANDLE_MOUNT[0] + HANDLE_MOUNT[1] / 2 + 1.5   # |x| inside which the band is the handle's
CLASP_KEEP = (CLASP[0] - CLASP[1] / 2 - 1.5, CLASP[0] + CLASP[1] / 2 + 1.5)   # |x| the clasps take
MEDALLION = (40.0, 50.0, 23.0)   # the sides' medallion: its middle's height, its oval's half width and height
# The medallion keeps 1.2 mm over the bottom stitches, and |y| 2.5 mm inside the corner caps.
SIDE_KEEP = (BOTTOM_STITCH + STITCH[1] / 2 + 1.2, D / 2 - RAD - CAP_REACH - 2.5)

# On the deck (x, y mm): parts at literal positions, and the lettering's boxes (x0, x1, y0, y1) as
# built (Avenir Next and Futura, which use_scene loads).
SCREW = (125.0, 93.0, 2.4)                 # deck_details' corner screws: |x|, |y|, their heads' radius
WELL_RING = 65.6                           # deck_details' chrome ring round the well: its outer radius
KNOB = (100.0, -58.0, 24.8)                # make_player's knob (kx, ky) and its ticks' reach (23.2 + 1.6)
ARM_BASE = 30.0                            # the tonearm's base, ring and counterweight lie within this of AX, AY
ARM_SWEEP = (222.0, 280.0, 120.0)          # degrees round the pivot the arm sweeps (rest 265, play 235, a
                                           # margin each way), and how far its head reaches (108)
BRAND = (-111.5, -96.3, -90.7, -87.3)      # "ncam" (make_player: at (-112, -88), 9 mm)
MODEL_NAME = (-111.9, -86.2, -97.1, -95.8)  # "CD·01   COMPACT DISC PLAYER" (at (-112, -96.5), 2.8 mm)
KEYS = (78.6, 121.4, -22.9, 39.4)          # the six keys' printed rings (r 7.4 round x 86 and 114, y 32 to
                                           # -12) and their labels under them
DISPLAY = (64.0, 131.0, 41.9, 79.5)        # the LCD's bezel (62 x 31 round (100, 64)), the VU strip's (62 x
                                           # 4.6 round (100, 44.2)) and LEVEL left of it
LED = (117.8, 127.4, 83.6, 86.4)           # the power LED (r 1.4 round (126, 85)) and POWER left of it
VOLUME = (96.4, 103.5, -86.1, -84.8)       # VOLUME under the knob (at (100, -85.5), 2.8 mm)

# On the lining (the lid's frame, x, and y from the lining's middle at -D / 2): parts at literal
# positions.
CASE = (-60.0, 142.0, 125.0, 0.3)   # the case: its middle's x, its base's size (make_case), and how far
                                    # its lid's knuckles stand past its left side
CASE_CLIP = (64.5, 22.0, 7.0)       # the case's clips: their middles' y either side of its own, their size
STRAP = (-67.0, -86.0, 144.0, 14.0)  # the strap: its middle (x, y), its size
STRAP_TAB = (2.5, -86.0, 10.0, 16.0)  # the strap's tab, likewise
PLATE = (-60.0, 86.0, 92.0, 18.0)   # the plate (make_player's card), likewise
RACK_RAIL = 125.0                   # the cascade's rails round RACK_X: the rack's frame at its widest
LINING_Z = HL - 13.5                # the lining's face (parts.py's zin)


def _box(name, x, y, w, h, margin):
    """A keep-out (name, x0, x1, y0, y1): the w x h mm box round (x, y), grown `margin` mm."""
    return (name, x - w / 2 - margin, x + w / 2 + margin, y - h / 2 - margin, y + h / 2 + margin)


def _grown(name, box, margin):
    """A keep-out (name, x0, x1, y0, y1): `box` (x0, x1, y0, y1) grown `margin` mm."""
    x0, x1, y0, y1 = box
    return (name, x0 - margin, x1 + margin, y0 - margin, y1 + margin)


# What the deck's sprays keep off: the well's ring, the screws, the knob's ticks and the tonearm's
# base, the lettering, the keys and their labels, the display, the LED and the VU strip, with 2 or 3
# mm; and the arm's sweep (_deck_clear).
DECK_ROUNDS = ((("the well", WX, WY, WELL_RING + 3.0), ("the knob", KNOB[0], KNOB[1], KNOB[2] + 2.0),
                ("the tonearm", AX, AY, ARM_BASE))
               + tuple(("a screw", sx * SCREW[0], sy * SCREW[1], SCREW[2] + 2.0) for sx in (1, -1) for sy in (1, -1)))
DECK_BOXES = (_grown("the brand", BRAND, 2.0), _grown("the model's name", MODEL_NAME, 2.0),
              _grown("the keys", KEYS, 3.0), _grown("the display", DISPLAY, 3.0), _grown("the LED", LED, 2.0),
              _grown("VOLUME", VOLUME, 2.0))
# What the lining's ornament keeps off, with 1.5 mm: the case and its clips, the strap and its tab,
# the plate, and the rack's frame (the lining's right half).
LINING_BOXES = (("the case", CASE[0] - CASE[1] / 2 - CASE[3] - 1.5, CASE[0] + CASE[1] / 2 + 1.5,
                 -D / 2 - CASE[2] / 2 - 1.5, -D / 2 + CASE[2] / 2 + 1.5),
                _box("a case clip", CASE[0], -D / 2 + CASE_CLIP[0], CASE_CLIP[1], CASE_CLIP[2], 1.5),
                _box("a case clip", CASE[0], -D / 2 - CASE_CLIP[0], CASE_CLIP[1], CASE_CLIP[2], 1.5),
                _box("the strap", STRAP[0], -D / 2 + STRAP[1], STRAP[2], STRAP[3], 1.5),
                _box("the strap's tab", STRAP_TAB[0], -D / 2 + STRAP_TAB[1], STRAP_TAB[2], STRAP_TAB[3], 1.5),
                _box("the plate", PLATE[0], -D / 2 + PLATE[1], PLATE[2], PLATE[3], 1.5),
                ("the rack", RACK_X - RACK_RAIL / 2 - 1.5, W / 2, -D, 0.0))


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


def _leaf_toward(at, length, degrees, width=0.42):
    """A leaf item rooted at `at`, `length` mm long, pointing `degrees` counter-clockwise from +a as
    one sees the face (bending away from +b when it points left, as its mirror would)."""
    return ("leaf", at, length, {"turn": math.radians(degrees) - math.pi / 2, "width": width,
                                 "flip": math.cos(math.radians(degrees)) < 0})


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
    n = 72 if WEB else 160
    orn.strip(face, oval(half_w, half_h, n), STEM_W, wire, STEM, closed=True)
    orn.strip(face, oval(half_w - 6.2, half_h - 6.2, n), STEM_W, wire, STEM, closed=True)
    pearl_row(orn, face, oval(half_w - 3.1, half_h - 3.1, n) + [(ca + half_w - 3.1, cb)], wire, radius=1.0,
              pitch=4.6, loop=True)
    flowers, stems, knot = _bouquet()
    for path in stems:
        Pen(orn, face, (ca, cb)).wire(smooth_path(path, 6), wire, 0.6, up=0)
    lay(orn, face, shifted(flowers, ca, cb), wire)
    Pen(orn, face, (ca + knot[0], cb + knot[1]), layer=BLOOM).cell(circle(1.2, 8 if WEB else 12), "butter", wire,
                                                                   up=1)
    outside = [("c_scroll", (half_w + 4.6, 0.0), 15.0, {"flip": True}),
               ("spray", (half_w + 9.0, -1.5), 22.0, {"turn": -math.radians(92.0), "bend": 0.2, "flip": True}),
               (_daisy, (half_w + 33.0, 0.0), 3.6, {"colour": "coral"}),
               ("acanthus", (3.0, -half_h + 0.6), 12.5, {"turn": -math.radians(98.0), "curl": 0.22, "flip": True})]
    lay(orn, face, shifted(mirrored(outside), ca, cb), wire)


def suitcase_tub(orn, wire):
    """The tub's band under the seam and its sides' medallions, on the wall of its outline (a from
    the front's middle, counter-clockwise seen from above; b the height): the right half, and its
    mirror image on the left."""
    wall = Wall(rrect(W, D, RAD), zero=(0.0, -1e6))
    side = wall.a_of((W / 2, 0.0))
    # Between the handle's mount and the clasp (14 mm): a short vine from a sky daisy to a camellia,
    # each as large as the band and the gap allow, and two small leaves off the stem between them.
    since = len(orn.placed)
    daisy_r, camellia_r = 2.9, 3.4
    a0, a1 = HANDLE_KEEP + WIRE_W / 2 + daisy_r, CLASP_KEEP[0] - WIRE_W / 2 - camellia_r
    mid = (a0 + daisy_r + a1 - camellia_r) / 2
    _vine_and_mirror(orn, wall, [(a0, SEAM_B), (mid, SEAM_B - 0.2), (a1, SEAM_B)], wire, every=100.0,
                     tendrils=False,
                     flowers=[(0.0, _daisy, daisy_r, {"colour": "sky", "petals": 6}),
                              (None, "camellia", camellia_r, {})])
    lay(orn, wall, mirrored([_leaf_toward((mid, SEAM_B - 0.2), 3.3, 60.0, 0.5),
                             _leaf_toward((mid, SEAM_B - 0.2), 3.3, 240.0, 0.5)]), wire)
    hold(orn, since, (-CLASP_KEEP[0], -D / 2 - PROUD, SEAM[0]), (CLASP_KEEP[0], -D / 2, SEAM[1]),
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
    hold(orn, since, (-W / 2 - PROUD, -D / 2 - PROUD, SEAM_LOW), (W / 2 + PROUD, D / 2 - RAD, SEAM[1]), "the band")
    for p in orn.placed[since:]:
        over_grille = p.y < -D / 2 + 1.0 and abs(p.x) < GRILLE_EDGE
        if over_grille and (p.z < SEAM[0] or abs(p.x) < CLASP_KEEP[1]):
            raise SystemExit("suitcase_ornament.py: the band at (%.1f, %.1f, %.1f) runs into the grille's border or a "
                             "clasp" % (p.x, p.y, p.z))
    # The sides' medallions.
    for sx in (1, -1):
        since = len(orn.placed)
        _medallion(orn, wall, (sx * side, MEDALLION[0]), wire)
        # The pearls' caps go on BEAD_FOOT under the leather, out of sight.
        x0, x1 = sorted((sx * (W / 2 - BEAD_FOOT), sx * (W / 2 + PROUD)))
        hold(orn, since, (x0, -SIDE_KEEP[1], SIDE_KEEP[0]), (x1, SIDE_KEEP[1], SEAM_LOW),
             "the %s side's medallion" % ("right" if sx > 0 else "left"))


# ------------------------------------------------------------------ the deck
def _deck_clear(orn, since):
    """Stops the run unless the deck's sprays laid since `since` keep off DECK_ROUNDS, DECK_BOXES and
    the tonearm's sweep (ARM_SWEEP: the arm turns 30 degrees clockwise from its rest onto the disc),
    2.5 mm inside the tub's inner walls, and under PROUD."""
    _clear(orn, since, "the deck's ornament", DECK_BOXES, DECK_ROUNDS,
           inside=(0.0, 0.0, W / 2 - WALL - 2.5, D / 2 - WALL - 2.5, INNER_CORNER - 2.5))
    lo, hi, reach = ARM_SWEEP
    for p in orn.placed[since:]:
        ang = math.degrees(math.atan2(p.y - AY, p.x - AX)) % 360.0
        if math.hypot(p.x - AX, p.y - AY) < reach and lo < ang < hi:
            raise SystemExit("suitcase_ornament.py: the deck's ornament at (%.1f, %.1f) runs into the tonearm's sweep"
                             % (p.x, p.y))
    hold(orn, since, (None, None, DECK), (None, None, DECK + PROUD), "the deck's ornament")


def suitcase_deck(orn, wire):
    """The deck top's daisy sprays (z = DECK, a along x, b along y), one round each corner screw:
    along the back edge and down the left edge at the back left, arching over the brand and up the
    left edge at the front left, along the back edge right of the tonearm, and along the front edge
    and up the right edge at the front right."""
    top = Plane((0.0, 0.0, DECK), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0))
    since = len(orn.placed)
    kw = {"every": 7.0, "leaf_len": 4.2, "leaf_angle": 44.0}
    # The back left.
    vine(orn, top, [(-116.0, 98.6), (-102.0, 99.2), (-88.0, 98.4), (-74.0, 99.0), (-62.0, 98.4)], wire,
         flowers=[(0.0, _daisy, 4.2, {"colour": "coral"}), (27.0, _daisy, 4.0, {"colour": "sky"}),
                  (None, "camellia", 4.8, {})], **kw)
    vine(orn, top, [(-130.0, 84.0), (-129.6, 70.0), (-130.2, 56.0), (-129.6, 42.0), (-129.8, 30.0)], wire,
         flowers=[(0.0, _daisy, 4.0, {"colour": "rose"}), (27.0, "rose", 4.0, {"colours": ("coral", "butter")}),
                  (None, _daisy, 3.6, {"colour": "sky"})], **kw)
    # The front left: over the brand, and up the left edge.
    vine(orn, top, [(-117.5, -83.5), (-108.0, -80.5), (-97.0, -79.8), (-86.0, -81.6)], wire,
         flowers=[(0.0, _daisy, 3.6, {"colour": "coral"}), (None, "camellia", 4.8, {})], **kw)
    vine(orn, top, [(-130.0, -80.0), (-129.6, -64.0), (-130.2, -48.0), (-129.8, -36.0)], wire,
         flowers=[(22.0, "rose", 4.0, {"colours": ("rose", "coral")}), (None, _daisy, 3.8, {"colour": "sky"})],
         **kw)
    # The back right, right of the tonearm and over the display's LED.
    vine(orn, top, [(80.0, 97.8), (92.0, 98.8), (104.0, 97.6), (116.0, 98.4)], wire,
         flowers=[(0.0, _daisy, 4.0, {"colour": "rose"}), (18.5, "camellia", 4.6, {"colours": ("coral", "butter")}),
                  (None, _daisy, 3.8, {"colour": "sky"})], **kw)
    # The front right: under VOLUME, and up the right edge outside the knob's ticks.
    vine(orn, top, [(70.0, -98.6), (82.0, -99.4), (94.0, -98.4), (106.0, -99.2), (117.0, -98.4)], wire,
         flowers=[(0.0, _daisy, 4.0, {"colour": "coral"}), (24.0, _daisy, 3.8, {"colour": "sky"}),
                  (None, "camellia", 4.4, {})], **kw)
    vine(orn, top, [(131.0, -84.0), (131.6, -66.0), (130.8, -48.0)], wire,
         flowers=[(None, _daisy, 3.4, {"colour": "rose"})], **dict(kw, leaf_len=3.6))
    _deck_clear(orn, since)


# ------------------------------------------------------------------ the lid's lining
def suitcase_lining(orn, wire):
    """The lining's ornament (its face, z = LINING_Z in the lid's frame, facing the visitor: a along
    x, b up the open lid, -y): the edge vine along the bottom, up the left side and above the strap;
    the corner sprays at the bottom left and, under the strap, the top left; a camellia between the
    plate and the rack; a vine between the strap and the case."""
    face = Plane((0.0, 0.0, LINING_Z), (0.0, 0.0, -1.0), (0.0, -1.0, 0.0))
    since = len(orn.placed)
    # Along the bottom, under the plate, into the bottom left corner's camellia.
    vine(orn, face, _wave(7.5, -108.0, 17.8, 0.2, 30.0) + [(-116.0, 21.0), (-121.5, 31.5)], wire,
         flowers=[(0.0, _daisy, 3.0, {"colour": "sky"}), (47.0, _daisy, 3.0, {"colour": "coral"}),
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
    vine(orn, face, [(-129.5, 47.0), (-133.6, 52.0), (-134.4, 58.0), (-134.4, 110.0), (-134.4, 150.0),
                     (-134.4, 176.0), (-134.0, 183.0), (-131.2, 187.6), (-127.5, 188.5)], wire,
         flowers=[(0.0, _daisy, 3.4, {"colour": "sky"}), (None, "rose", 4.8, {})],
         every=8.0, leaf_len=2.4, leaf_angle=18.0, leaf_width=0.34, tendrils=False)
    # Under the strap: on from the rose to a daisy short of the case's clip, and past the clip a
    # vine with a camellia between two daisies.
    vine(orn, face, [(-127.5, 188.5), (-112.0, 189.2), (-96.0, 188.3), (-80.0, 189.0)], wire,
         flowers=[(None, _daisy, 3.6, {"colour": "coral"})], every=8.0, leaf_len=4.0, leaf_angle=44.0)
    vine(orn, face, [(-43.4, 188.5), (-31.0, 189.3), (-18.0, 188.3), (-6.0, 189.1), (6.0, 188.5)], wire,
         flowers=[(0.0, _daisy, 3.4, {"colour": "sky"}), (26.0, "camellia", 4.4, {}),
                  (None, _daisy, 3.2, {"colour": "rose"})], every=8.0, leaf_len=4.0, leaf_angle=44.0)
    # Above the strap, along the top edge.
    vine(orn, face, _wave(-122.0, 8.0, 217.8, 0.4, 28.0), wire,
         flowers=[(22.0, _daisy, 3.0, {"colour": "coral"}), (82.0, _daisy, 3.0, {"colour": "sky"})],
         every=8.0, leaf_len=3.4, leaf_angle=40.0)
    _clear(orn, since, "the lining's ornament", LINING_BOXES,
           inside=(0.0, -D / 2, W / 2 - WALL - 2.0, D / 2 - WALL - 2.0, INNER_CORNER - 2.0))
    hold(orn, since, (None, None, LINING_Z - PROUD), (None, None, LINING_Z), "the lining's ornament")


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

"""The vinyl base every turntable shares: the 12-inch record, its sleeve and the LED ring round a
platter. Needs cdkit's namespace.

Exec'd after cdkit.py and parts.py, before the turntable's own script (luxe.py), into the same
namespace. The materials it names are the turntable's build's (luxe.py's build_luxe_materials):
`vinyl`, `sleeve_paper` and `jog_ring`, and in a render `ring_on`, `ring_dim` and parts.py's
`black_glass`; the record's label and the sleeve's cover take the material they are given (the
web build's `art_disc` and `art_sleeve`, which the page prints). Millimetres, in each part's own
frame:

- a record (make_record) is an empty whose local Z is its normal and whose origin is its
  mid-plane at the spindle: the vinyl (`<name>_vinyl`, VINYL_R round, VINYL_T thick, its rim
  rounded over, the top's lead-in edge falling toward the rim, five track gaps on its top) and the
  label printed on it (`<name>_label`, LABEL_LIFT clear of the vinyl, so the two never fight for
  the same depth);
- a sleeve (make_sleeve) is an empty in the record's frame: local Z the face's normal, its origin
  the middle of its thickness, local +Y the cover's top; its card (`<name>_card`) and the cover
  printed on its front (`<name>_cover`, export.py maps it planar over its bounds);
- the LED ring (led_ring) lies flat round a platter: in the web build one mesh whose UVs the page
  paints, in a render RING_SEGMENTS segments, RING_LIT of them lit.
"""
import math

import bmesh

VINYL_R = 150.0                      # the record: 300 mm across
VINYL_HOLE = 3.6                     # its spindle hole's radius
VINYL_T = 1.8                        # its thickness: z -0.9 ... 0.9 about its mid-plane
VINYL_ROLL = 1.0                     # the rim's round-over, radially
VINYL_LEAD = (4.0, 0.15)             # the top's lead-in edge falls 0.15 mm over its outer 4 mm
VINYL_GAPS = (136.0, 122.0, 106.0, 90.0, 74.0)   # the track gaps on the top, outside in
VINYL_GAP = (0.6, 0.05)              # each gap's width and depth
LABEL_R, LABEL_HOLE = 50.0, 3.8      # the label: 100 mm across, its hole clear of the spindle
LABEL_LIFT = 0.1                     # the label stands this clear of the vinyl's top
SLEEVE_W, SLEEVE_T = 310.0, 3.0      # the sleeve: 310 mm square, 3 thick
SLEEVE_COVER = 309.0                 # its printed cover, 0.1 mm clear of the card's front
RING_QUADS = 192                     # the web ring's quads round
RING_SEGMENTS, RING_LIT = 48, 30     # a render's segments, and how many of them it lights


# ------------------------------------------------------------------ the record
def vinyl_profile():
    """The vinyl's (r, z) profile, closed (lathe joins its ends): along the underside from the hole
    to the rim, round the rim (an elliptical round-over VINYL_ROLL wide), along the top falling at
    the lead-in edge, then inward over the five track gaps to the hole."""
    h = VINYL_T / 2
    lead_w, lead_d = VINYL_LEAD
    r_roll = VINYL_R - VINYL_ROLL
    top_roll = h - lead_d * (r_roll - (VINYL_R - lead_w)) / lead_w   # the top, where the rim begins
    zc, b = (top_roll - h) / 2, (top_roll + h) / 2
    prof = [(VINYL_HOLE, -h), (r_roll, -h)]
    n = 6
    for k in range(1, n):
        a = -math.pi / 2 + math.pi * k / n
        prof.append((r_roll + VINYL_ROLL * math.cos(a), zc + b * math.sin(a)))
    prof += [(r_roll, top_roll), (VINYL_R - lead_w, h)]
    w, d = VINYL_GAP
    for g in VINYL_GAPS:   # outside in
        prof += [(g + w / 2, h), (g + w / 2, h - d), (g - w / 2, h - d), (g - w / 2, h)]
    prof.append((VINYL_HOLE, h))
    return prof


def make_record(name, label, loc, rot=(0, 0, 0), parent=None):
    """A record under the empty `name` (at `loc`, turned `rot`, its local Z its normal, its origin
    its mid-plane at the spindle): the vinyl in `vinyl`, the label printed in `label` on its top."""
    root = empty(name, loc, rot, parent)
    lathe(name + "_vinyl", vinyl_profile(), M["vinyl"], seg=192, parent=root)
    annulus(name + "_label", LABEL_R, LABEL_HOLE, label, z_mm=VINYL_T / 2 + LABEL_LIFT, seg=96, parent=root)
    return root


# ------------------------------------------------------------------ the sleeve
def make_sleeve(name, art, loc, rot=(0, 0, 0), parent=None):
    """A sleeve under the empty `name`, in the record's frame (local Z the face's normal, its origin
    the middle of its thickness, local +Y the cover's top): the card in `sleeve_paper`, and the
    cover printed in `art` on its front, 0.1 mm clear of it."""
    root = empty(name, loc, rot, parent)
    rbox(name + "_card", (SLEEVE_W, SLEEVE_W, SLEEVE_T), M["sleeve_paper"], bevel_mm=0.6, parent=root)
    rbox(name + "_cover", (SLEEVE_COVER, SLEEVE_COVER, 0.05), art, parent=root,
         loc=mmv((0.0, 0.0, SLEEVE_T / 2 + 0.1)))
    return root


# ------------------------------------------------------------------ the LED ring
def ring_sector(bm, uv, r0, r1, a0, a1, steps, u0=None, u1=None):
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


def led_ring(name, parent, centre, r_in, r_out, z, playing):
    """The LED ring, flat at height `z` round `centre` (x, y), r_in to r_out, under `parent`. The web
    build: one mesh (`<name>_jog_ring`) in jog_ring, RING_QUADS quads round on two rings of
    vertices, vertex i at 90 - 360 i / n degrees from +X (i = 0 at twelve o'clock, growing clockwise
    seen from above), its UV in the GLB (TEXCOORD_0) (i / n, 0) inside and (i / n, 1) outside, the
    seam's vertices doubled so that u runs 0 to 1 unwrapped: the page paints a strip whose u runs
    round it. A render: RING_SEGMENTS segments, each 360 / n degrees less a 1.5 degree gap, the
    first RING_LIT lit when `playing`, on a black ring."""
    cx, cy = centre
    if WEB:
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        ring_sector(bm, uv, r_in, r_out, 0.0, 360.0, RING_QUADS, 0.0, 1.0)
        return from_bm(name + "_jog_ring", bm, [M["jog_ring"]], smooth=False, parent=parent, loc=mmv((cx, cy, z)))
    annulus(name + "_ring_base", r_out + 0.4, r_in - 0.6, M["black_glass"], z_mm=z - 0.03, seg=192, parent=parent,
            loc=mmv((cx, cy, 0.0)))
    pitch = 360.0 / RING_SEGMENTS
    for k in range(RING_SEGMENTS):
        bm = bmesh.new()
        ring_sector(bm, None, r_in, r_out, pitch * k + 0.75, pitch * (k + 1) - 0.75, 4)
        lit = playing and k < RING_LIT
        from_bm("%s_ring_seg_%d" % (name, k), bm, [M["ring_on"] if lit else M["ring_dim"]], smooth=False,
                parent=parent, loc=mmv((cx, cy, z)))
    return None

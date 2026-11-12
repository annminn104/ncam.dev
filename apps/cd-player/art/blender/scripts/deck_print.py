"""The Deck's print layer: thin meshes in one material, deck_pattern, over the zones on which the page
paints the visitor's patterns and name at runtime (src/scene/textures), each mapped into its region
of one 2048 x 1024 atlas. write_deck_atlas writes that layout to src/scene/textures/deck-atlas.json
for the page's painter and the GLB's contract test.

Needs cdkit's, parts.py's, deck.py's, deck_panel.py's and deck_case.py's namespace: export.py and
hero.py exec it after them. It reads their dimensions and hangs each print from the part it lies
on, so make_deck_player calls deck_prints once the deck and the case stand. Blender's axes and
millimetres as in deck.py.

Each print sits PRINT_OFF off the face it covers, follows it, and leaves holes where the face has
openings: none covers a control, a vent, a port or an edge extrusion. The rim's hangs from the knob,
the plate that turns: it is the one print under it, the plate's own rim. None hangs from a key.
Nothing on the page drives them by name (`<name>_print_<zone>`): the page finds them by their
material.

UVs, as the page reads them (glTF, the canvas's rows down, flipY false): u = x / 2048,
v = y / 1024. Blender's UV holds 1 - v.
- A plate's, a panel's and the nameplate's x runs across the face left to right as one sees it
  from outside, and y runs down it; the top plate's y runs from its back edge.
- The rim's x runs clockwise from twelve seen from above (the LED ring's way), its y from its inner
  edge out.
- The bezel's x runs clockwise round the frame from its top-left corner, its y from its inner edge
  out.
Each region's pixels per mm are the same across and down: deck_atlas_regions checks it, with the
regions' gutters and densities, and stops the run on a layout that breaks them.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Vector

ATLAS = (2048, 1024)
PRINT_OFF = 0.15                     # mm off the face a print covers
GUTTER = 8                           # px between regions, and to the canvas's edges
RIM = (63.0, 101.0)                  # the rim's print: 3 mm outside the disc, 2 mm inside the knurled ring
TOP_HALF = (DK_W / 2 - DK_EDGE - 0.3, DK_D / 2 - DK_EDGE - 0.3)   # the top plate's print: inside its rounded edge
FRONT_Z = (DK_FOOT + DK_EDGE + 0.3, DK_TOP - DK_EDGE - 0.3)       # the body's sides and front, between the round-overs
SIDE_HALF = DK_D / 2 - DK_CORNER - 0.3                            # a side's flat run, inside the plan corners
FRONT_HALF = DK_W / 2 - DK_CORNER - 0.3
CASE_IN = (FC_W / 2 - FC_RAIL - 0.2, FC_D / 2 - FC_RAIL - 0.2)    # a case panel's print: inside the extrusions' legs
CASE_Z = (FC_LIFT + FC_RAIL + 0.2, FC_LIFT + FC_H - FC_RAIL - 0.2)

# The regions, in deck-atlas.json's order: id, kind, ground, its corner (px), its size (mm) and its
# density (px/mm; at least 2 on the top and the case's front, 1.5 elsewhere, about 4 on the nameplate).
_BEZEL_MM = (2.0 * (DK_GLASS[0] + 2 * DK_BEZEL) + 2.0 * DK_GLASS[1], DK_BEZEL)
_REGIONS = (
    ("top", "plate", "body", (8, 8), (2 * TOP_HALF[0], 2 * TOP_HALF[1]), 2.85),
    ("rim", "ring", "acrylic", (892, 8), (2 * math.pi * (RIM[0] + RIM[1]) / 2, RIM[1] - RIM[0]), 2.2),
    ("case_front", "panel", "case", (892, 495), (2 * CASE_IN[0], CASE_Z[1] - CASE_Z[0]), 2.5),
    ("case_left", "panel", "case", (1587, 184), (2 * CASE_IN[1], CASE_Z[1] - CASE_Z[0]), 2.0),
    ("case_right", "panel", "case", (1587, 367), (2 * CASE_IN[1], CASE_Z[1] - CASE_Z[0]), 2.0),
    ("side_left", "panel", "body", (892, 120), (2 * SIDE_HALF, FRONT_Z[1] - FRONT_Z[0]), 2.0),
    ("side_right", "panel", "body", (892, 245), (2 * SIDE_HALF, FRONT_Z[1] - FRONT_Z[0]), 2.0),
    ("front", "panel", "body", (892, 370), (2 * FRONT_HALF, FRONT_Z[1] - FRONT_Z[0]), 2.0),
    ("bezel", "band", "glass", (892, 100), _BEZEL_MM, 2.0),
    ("nameplate", "nameplate", "metal", (1587, 120), (DK_NAMEPLATE[2], DK_NAMEPLATE[3]), 4.0),
)
_MINIMUM = {"top": 2.0, "case_front": 2.0}   # px/mm; every other region 1.5


def _px(v):
    return int(math.floor(v + 0.5))


def _mm(v):
    """A size to 0.1 mm, a whole one as an integer."""
    v = round(v, 1)
    return int(v) if v == int(v) else v


def deck_atlas_regions():
    """The atlas's regions as deck-atlas.json lists them, each with its exact mm size beside (`_mm`).
    It stops the run, naming the region, unless every region lies inside the canvas with GUTTER px
    round it, its pixels per mm agree across and down within 1 %, and it is at its density's
    minimum."""
    regions = []
    for rid, kind, ground, (x, y), (mw, mh), d in _REGIONS:
        region = {"id": rid, "kind": kind, "ground": ground, "x": x, "y": y, "w": _px(mw * d), "h": _px(mh * d),
                  "mmW": _mm(mw), "mmH": _mm(mh)}
        if rid == "top":
            # The jog's centre, from the region's corner: across from the left edge, down from the back.
            region["centre"] = [_px((DK_WELL[0] + TOP_HALF[0]) / mw * region["w"]),
                                _px((TOP_HALF[1] - DK_WELL[1]) / mh * region["h"])]
        if rid == "case_front":
            region["stencil"] = True
        region["_mm"] = (mw, mh)
        regions.append(region)
    W, H = ATLAS
    for r in regions:
        across, down = r["w"] / r["mmW"], r["h"] / r["mmH"]
        if abs(across - down) > 0.01 * max(across, down):
            raise SystemExit("deck_print: %s stretches: %.3f px/mm across, %.3f down" % (r["id"], across, down))
        if min(across, down) < _MINIMUM.get(r["id"], 1.5):
            raise SystemExit("deck_print: %s has %.2f px/mm, under its %.1f" % (r["id"], min(across, down),
                                                                              _MINIMUM.get(r["id"], 1.5)))
        if r["x"] < GUTTER or r["y"] < GUTTER or r["x"] + r["w"] > W - GUTTER or r["y"] + r["h"] > H - GUTTER:
            raise SystemExit("deck_print: %s leaves the canvas or its gutter" % r["id"])
        for o in regions:
            if o is r:
                continue
            apart = max(o["x"] - (r["x"] + r["w"]), r["x"] - (o["x"] + o["w"]),
                        o["y"] - (r["y"] + r["h"]), r["y"] - (o["y"] + o["h"]))
            if apart < GUTTER:
                raise SystemExit("deck_print: %s and %s stand %d px apart, under %d" % (r["id"], o["id"], apart, GUTTER))
    return regions


def write_deck_atlas(path):
    """src/scene/textures/deck-atlas.json: the canvas's size and its regions, keys in their order
    (art/pipeline/build.mjs formats it with Prettier once Blender is done)."""
    regions = [{k: v for k, v in r.items() if not k.startswith("_")} for r in deck_atlas_regions()]
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"width": ATLAS[0], "height": ATLAS[1], "regions": regions}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def deck_atlas_path():
    return os.path.normpath(os.path.join(_scripts_dir(), "..", "..", "..", "src", "scene", "textures",
                                         "deck-atlas.json"))


# ------------------------------------------------------------------ the meshes
def _atlas_uv(region, s, t):
    """A point s across and t down a region (0..1) as Blender's UV (its v is 1 - the canvas's row)."""
    return ((region["x"] + s * region["w"]) / ATLAS[0], 1.0 - (region["y"] + t * region["h"]) / ATLAS[1])


def _print_mesh(name, parent, region, pieces, to3d, normal):
    """A flat print: each piece (loops, st) is its outline and its holes (mm, the face's own 2D
    coordinates), filled on its own, facing `normal`; to3d(a, b) places a point in the parent's
    frame (mm) and st(a, b) gives its (s across, t down) in the region."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    want = Vector(normal)
    for loops, st in pieces:
        flat = {}
        edges = []
        for pts in loops:
            verts = []
            for a, b in pts:
                v = bm.verts.new(mmv(to3d(a, b)))
                flat[v] = (a, b)
                verts.append(v)
            edges += [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]
        faces = [g for g in bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges,
                                                    normal=want)["geom"] if isinstance(g, bmesh.types.BMFace)]
        if not faces:
            raise SystemExit("deck_print: %s would not fill" % name)
        for f in faces:
            f.normal_update()
            if f.normal.dot(want) < 0:
                f.normal_flip()
            for loop in f.loops:
                loop[uv].uv = _atlas_uv(region, *st(*flat[loop.vert]))
    return from_bm(name, bm, [M["deck_pattern"]], smooth=False, parent=parent)


def _rect(cx, cy, w, h, r=0.0):
    return rrect(w, h, r, seg=4, cx=cx, cy=cy)


def _top_outline():
    """The top plate's print round its edge, notched where the screen's housing stands."""
    hx, hy = TOP_HALF
    pts = rrect(2 * hx, 2 * hy, DK_CORNER - DK_EDGE - 0.3, seg=4)
    # rrect runs counter-clockwise from its +x+y corner: its back edge comes first, right to left.
    # The housing's rounded foot stands up to 0.8 mm proud of its front (slab's offset bevel).
    notch_x, notch_y = DK_SCREEN_W / 2 + 1.0, DK_SCREEN_Y - 1.6
    corner = 4 + 1   # the first corner's points
    return pts[:corner] + [(notch_x, hy), (notch_x, notch_y), (-notch_x, notch_y), (-notch_x, hy)] + pts[corner:]


def _top_holes():
    """Every opening in the top plate's print: the jog (its well, the LED ring and the signature
    ring), the pads, every key, knob and fader, and the screws."""
    holes = [circle(DK_SIG_RING[1] + 0.5, q(96), DK_WELL[0], DK_WELL[1])]
    w, d, _ = DK_PAD
    holes += [_rect((k - 3.5) * DK_PAD_PITCH, DK_PADS_Y, w + 5.0, d + 5.0) for k in range(8)]
    for kind, x, y, cap in DK_KEYS:
        if isinstance(cap, tuple):   # its frame, 3.6 round the cap, and a little more (inside the top's edge)
            x0 = max(x - (cap[0] + 4.6) / 2, -TOP_HALF[0] + 0.3)
            holes.append([(x0, y - (cap[1] + 4.6) / 2), (x + (cap[0] + 4.6) / 2, y - (cap[1] + 4.6) / 2),
                          (x + (cap[0] + 4.6) / 2, y + (cap[1] + 4.6) / 2), (x0, y + (cap[1] + 4.6) / 2)])
        else:                        # its gap ring, 2.2 round the cap
            holes.append(circle(cap + 2.7, q(64), x, y))
    holes += [circle(8.0, q(48), x, DK_KNOBS_Y) for x in DK_FX]
    holes.append(circle(11.0, q(64), DK_BROWSE_X, DK_KNOBS_Y))
    holes += [circle(6.1, q(48), x, DK_KNOBS_Y) for x, _ in DK_BACK_TAG]
    holes += [circle(6.1, q(48), x, y) for x, y, _ in DK_LOCK]
    holes += [_rect(x, y, 19.2, 11.2) for x, y, _ in DK_SYNC]
    # The fader: its slot and, across it, its cap's foot, one opening.
    x, (y0, y1), yc = DK_FADER_X, DK_FADER_Y, DK_FADER_CAP
    sx, cx_, cy_ = 4.3, 9.5, 5.5
    holes.append([(x - sx, y0 - 0.3), (x + sx, y0 - 0.3), (x + sx, yc - cy_), (x + cx_, yc - cy_), (x + cx_, yc + cy_),
                  (x + sx, yc + cy_), (x + sx, y1 + 0.3), (x - sx, y1 + 0.3), (x - sx, yc + cy_), (x - cx_, yc + cy_),
                  (x - cx_, yc - cy_), (x - sx, yc - cy_)])
    holes += [circle(2.4, 16, x, y) for x, y in DK_SCREWS]
    return holes


def _bezel_pieces():
    """The bezel's frame as four strips (the top and the bottom take the rounded corners), each with
    its st: s along the band, clockwise from the top-left corner, t from the glass's edge out."""
    gw, gh = DK_GLASS[0] / 2, DK_GLASS[1] / 2
    ow, oh, b, r = gw + DK_BEZEL, gh + DK_BEZEL, DK_BEZEL, 4.0
    cx = DK_BEZEL_X
    top_len, side_len = 2 * ow, 2 * gh
    total = 2 * top_len + 2 * side_len

    def arc(x0, y0, a0, a1):
        return [(x0 + r * math.cos(math.radians(a0 + (a1 - a0) * i / 4)),
                 y0 + r * math.sin(math.radians(a0 + (a1 - a0) * i / 4))) for i in range(5)]
    top = ([(cx - ow, gh), (cx + ow, gh)] + arc(cx + ow - r, oh - r, 0, 90)
           + arc(cx - ow + r, oh - r, 90, 180))
    bottom = ([(cx + ow, -gh), (cx - ow, -gh)] + arc(cx - ow + r, -oh + r, 180, 270)
              + arc(cx + ow - r, -oh + r, 270, 360))
    right = [(cx + gw, gh), (cx + gw, -gh), (cx + ow, -gh), (cx + ow, gh)]
    left = [(cx - gw, -gh), (cx - gw, gh), (cx - ow, gh), (cx - ow, -gh)]
    return [([top], lambda a, c: ((a - (cx - ow)) / total, (c - gh) / b)),
            ([right], lambda a, c: ((top_len + (gh - c)) / total, (a - (cx + gw)) / b)),
            ([bottom], lambda a, c: ((top_len + side_len + (cx + ow - a)) / total, (-gh - c) / b)),
            ([left], lambda a, c: ((2 * top_len + side_len + (c + gh)) / total, ((cx - gw) - a) / b))]


def _front_holes():
    """The front's openings: the USB and SD ports with their names under them, the nameplate and
    the model line on the left (its lettering spans 34 mm from x -146, 1.4 mm round z 38)."""
    px, pz, pw, ph, _ = DK_NAMEPLATE
    return [_rect(-50.0, 40.2, 16.8, 12.4), _rect(-14.0, 39.9, 30.6, 11.8), _rect(px, pz, pw + 1.2, ph + 1.2),
            [(-146.6, 36.8), (-111.5, 36.8), (-111.5, 39.4), (-146.6, 39.4)]]


def deck_prints(name, root):
    """Every zone of the print layer, each a child of the part it lies on: the top plate, the
    body's sides and front, the nameplate (the deck's root); the rim (the knob); the bezel (the
    screen's face); the case's front, with the stencil, and its sides (the case's root)."""
    regions = {r["id"]: r for r in deck_atlas_regions()}
    knob = bpy.data.objects[name + "_knob"]
    case = bpy.data.objects[name + "_flight"]
    face = bpy.data.objects[name + "_screen_face"]
    hx, hy = TOP_HALF
    z = DK_TOP + PRINT_OFF
    _print_mesh(name + "_print_top", root, regions["top"], [([_top_outline()] + _top_holes(),
                                                             lambda a, b: ((a + hx) / (2 * hx), (hy - b) / (2 * hy)))],
                lambda a, b: (a, b, z), (0.0, 0.0, 1.0))
    # The rim, under the plate, facing up through it.
    region = regions["rim"]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    n = q(192)
    r0, r1 = RIM
    rows = []
    for rr in (r0, r1):
        rows.append([bm.verts.new(mmv((rr * math.cos(math.radians(90.0 - 360.0 * i / n)),
                                       rr * math.sin(math.radians(90.0 - 360.0 * i / n)), -PRINT_OFF)))
                     for i in range(n + 1)])
    for i in range(n):
        f = bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        for loop, (s, t) in zip(f.loops, ((i / n, 0.0), ((i + 1) / n, 0.0), ((i + 1) / n, 1.0), (i / n, 1.0))):
            loop[uv].uv = _atlas_uv(region, s, t)
    from_bm(name + "_print_rim", bm, [M["deck_pattern"]], smooth=False, parent=knob)
    # The case: its front (round the handle's brackets and under the latches) and its sides (round the ribs).
    cx, cy = CASE_IN
    z0, z1 = CASE_Z
    lx, lw, lz = FC_LATCH_X, 10.6, FC_LIFT + FC_H - FC_RAIL - 7.7
    front = [(-cx, z0), (cx, z0), (cx, z1), (lx + lw, z1), (lx + lw, lz), (lx - lw, lz), (lx - lw, z1), (-lx + lw, z1),
             (-lx + lw, lz), (-lx - lw, lz), (-lx - lw, z1), (-cx, z1)]
    brackets = [_rect(sx * 40.0, FC_HANDLE_Z, 13.2, 27.2) for sx in (-1, 1)]
    _print_mesh(name + "_print_case_front", case, regions["case_front"],
                [([front] + brackets, lambda a, b: ((a + cx) / (2 * cx), (z1 - b) / (z1 - z0)))],
                lambda a, b: (a, -FC_D / 2 - PRINT_OFF, b), (0.0, -1.0, 0.0))
    # Seen from outside, a left panel's left is the case's back (+y), a right panel's its front.
    ribs = [_rect(0.0, FC_LIFT + zz, 115.0, 4.9) for zz in (40.0, 80.0)]
    panel = [_rect(0.0, (z0 + z1) / 2, 2 * cy, z1 - z0)] + ribs
    for side, sx in (("left", -1), ("right", 1)):
        _print_mesh("%s_print_case_%s" % (name, side), case, regions["case_" + side],
                    [(panel, (lambda a, b, s=sx: ((cy - a) / (2 * cy) if s < 0 else (a + cy) / (2 * cy),
                                                  (z1 - b) / (z1 - z0))))],
                    (lambda a, b, s=sx: (s * (FC_W / 2 + PRINT_OFF), a, b)), (sx, 0.0, 0.0))
    # The body's sides (round the vents), its front (round the ports, the nameplate and the model line).
    f0, f1 = FRONT_Z
    vents = _rect(0.0, 37.0, 66.0, 32.0, 1.5)
    for side, sx in (("left", -1), ("right", 1)):
        _print_mesh("%s_print_side_%s" % (name, side), root, regions["side_" + side],
                    [([_rect(0.0, (f0 + f1) / 2, 2 * SIDE_HALF, f1 - f0), vents],
                      (lambda a, b, s=sx: ((SIDE_HALF - a) / (2 * SIDE_HALF) if s < 0 else (a + SIDE_HALF) / (2 * SIDE_HALF),
                                           (f1 - b) / (f1 - f0))))],
                    (lambda a, b, s=sx: (s * (DK_W / 2 + PRINT_OFF), a, b)), (sx, 0.0, 0.0))
    _print_mesh(name + "_print_front", root, regions["front"],
                [([_rect(0.0, (f0 + f1) / 2, 2 * FRONT_HALF, f1 - f0)] + _front_holes(),
                  lambda a, b: ((a + FRONT_HALF) / (2 * FRONT_HALF), (f1 - b) / (f1 - f0)))],
                lambda a, b: (a, -DK_D / 2 - PRINT_OFF, b), (0.0, -1.0, 0.0))
    px, pz, pw, ph, proud = DK_NAMEPLATE
    _print_mesh(name + "_print_nameplate", root, regions["nameplate"],
                [([rrect(pw, ph, 1.0, seg=4, cx=px, cy=pz)],
                  lambda a, b: ((a - (px - pw / 2)) / pw, ((pz + ph / 2) - b) / ph))],
                lambda a, b: (a, -DK_D / 2 - proud - PRINT_OFF, b), (0.0, -1.0, 0.0))
    _print_mesh(name + "_print_bezel", face, regions["bezel"], _bezel_pieces(),
                lambda a, b: (a, b, 0.8 + PRINT_OFF), (0.0, 0.0, 1.0))

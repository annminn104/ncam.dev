"""Luxe's dancer: a porcelain music-box ballerina on a fluted metal pedestal at the deck top's back
left corner (LX_DANCER), who turns with the platter. luxe.py's make_luxe calls luxe_pedestal and
luxe_dancer.

Exec'd after luxe_ornament.py, into the same namespace: it reads cdkit's and parts.py's helpers,
luxe.py's dimensions (the top, the frame, the platter's axis, the LED ring) and ornament.py's kit.
Blender's axes as in parts.py, millimetres.

- The pedestal (luxe_pedestal), in the body group: a metal drum DANCER_DRUM[0] mm in radius, from
  the top (LX_TOP) DANCER_DRUM[1] mm up. A moulding at its foot and one at its top, each ringed by a
  pearl row; between them DANCER_FLUTES flutes, and over them a smooth frieze, which carries an
  enamel garland of camellias, daisies and roses with their leaves. Its ornament is
  `<name>_deck_orn_pedestal_<material>`, so that it hangs and is checked as the deck's.
- The turning top (`<name>_dancer`): an empty at the drum's top centre, its local Z up, under the
  player's root as the platter is (the web build names it `dancer`, and the page turns it). It holds
  a metal disc (DANCER_DISC: its radius, its thickness) and the figure standing on it, her pointe at
  the disc's top centre, on the axis the page turns her about.
- The figure, DANCER_HEIGHT (105 mm) from her pointe to her fingertips, facing the hero camera at
  rest (DANCER_YAW). She is en pointe on her left leg, her right leg in retiré (its toe at her left
  knee) and her arms en haut (an oval over her head). Her head is a little inclined, her hair in a
  bun with a metal tiara before it, and she has no face (a figurine's smoothness). Her body is a
  skin modifier's hull round a skeleton (DANCER_JOINTS, DANCER_BONES, a smooth curve run through
  each chain of it) under two levels of subdivision, applied (the web build decimates it to
  DANCER_WEB_BODY triangles), then sized, so that her height is exact. It is porcelain, its bodice
  and pointe shoes porcelain_blush, with a metal trim along the bodice's neckline and a blush ribbon
  round each ankle. Her classical plate tutu, at her hips, has three layers: a flat plate with small
  enamel roses round its scalloped edge (`<name>_dancer_roses_<material>`), and two ruffled frills
  under it stepping out to DANCER_TUTU (64 mm across), the outer one's edge in metal.

Each piece is checked as it is built, and the run stops if one strays: the drum inside the frame's
inner outline and clear of the LED ring, the garland on its frieze, the figure's height and her
reach (20 mm or more clear of the record's edge).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

DANCER_DRUM = (19.0, 20.0)       # the pedestal's drum: its radius (its mouldings'), its height
DANCER_FLUTES = 24               # the flutes round the drum
DANCER_DISC = (17.0, 2.0)        # the turning disc: its radius, its thickness
DANCER_HEIGHT = 105.0            # the figure, from her pointe to her fingertips
DANCER_TUTU = 32.0               # the tutu's reach from her axis (the outer frill's metal edge)
DANCER_YAW = math.radians(-13.3)  # she faces the hero camera at rest (her front is -y before it)
DANCER_WEB_BODY = 6000           # the body's triangles in the web build
# The drum's profile, heights over its foot (mm): the foot moulding, the flutes, the frieze, the top
# moulding (each moulding's straight face between its chamfers).
PED_FOOT = (0.3, 3.0)
PED_FLUTED = (3.3, 9.0)
PED_FRIEZE = (9.0, 16.7)
PED_CAP = (17.0, 19.7)
PED_SHAFT = 18.4                 # the frieze's and the flutes' fillets' radius
PED_FLUTE = (0.55, 0.7)          # a flute's depth, and the share of the pitch its groove takes
PED_PEARL = (1.4, 4.4)           # the pearl rows: a bead's radius, their pitch

# The figure's skeleton, in her own frame before she is sized (mm: her pointe at the origin, her
# front toward -y, so her left is +x): each joint's place and the skin's radii there (across, front
# to back). Her left leg stands; her right is in retiré. _smooth_skeleton runs a smooth curve through
# each chain of joints before the skin is made.
DANCER_JOINTS = {
    "l_tip": ((0.0, 0.0, 0.7), (1.1, 1.0)),
    "l_box": ((0.0, -0.3, 3.0), (1.8, 1.6)),
    "l_arch": ((0.1, -1.1, 7.0), (1.8, 2.0)),
    "l_ankle": ((0.3, -0.3, 10.8), (1.6, 1.7)),
    "l_calf": ((0.8, 0.5, 20.5), (2.4, 2.8)),
    "l_knee": ((1.6, -0.2, 29.5), (2.4, 2.5)),
    "l_thigh": ((2.7, -0.1, 38.5), (3.3, 3.5)),
    "l_hip": ((3.9, 0.0, 47.0), (3.9, 4.1)),
    "r_hip": ((-3.3, 0.0, 47.0), (3.9, 4.1)),
    # Her right thigh slopes 27 degrees down to the knee, out to her side and forward, low enough
    # that the tutu hides none of the bent leg from the hero camera; its toe touches her left knee's
    # front.
    "r_thigh": ((-10.4, -3.9, 43.6), (3.2, 3.2)),
    "r_knee": ((-17.0, -7.5, 39.0), (2.4, 2.4)),
    "r_calf": ((-8.4, -7.2, 37.9), (2.5, 2.3)),
    "r_ankle": ((0.3, -6.0, 37.5), (1.5, 1.6)),
    "r_arch": ((1.2, -5.6, 34.0), (1.7, 1.8)),
    "r_box": ((1.6, -4.5, 31.0), (1.6, 1.4)),
    "r_tip": ((1.8, -3.6, 29.3), (1.0, 0.9)),
    "waist": ((0.3, 0.0, 57.0), (3.7, 2.9)),
    "ribs": ((0.3, -0.1, 62.0), (4.6, 3.4)),
    "chest": ((0.3, -0.4, 66.5), (5.0, 3.9)),
    "yoke": ((0.3, 0.2, 72.2), (3.6, 2.8)),
    "neck": ((0.3, 0.4, 75.6), (1.95, 2.05)),
    "nape": ((0.3, 0.5, 78.5), (1.85, 1.95)),
    # The arms, evenly along one curve each (a cubic from the shoulder, up and out, round to the
    # fingertips over her head), so that the oval they make has no corner.
    "r_shoulder": ((-7.9, 0.3, 72.0), (2.2, 2.2)),
    "r_upper": ((-11.6, -0.6, 77.1), (2.05, 2.05)),
    "r_elbow": ((-14.0, -1.8, 83.8), (1.75, 1.75)),
    "r_fore": ((-14.2, -3.0, 90.4), (1.5, 1.5)),
    "r_wrist": ((-12.6, -4.1, 96.5), (1.3, 1.35)),
    "r_hand": ((-8.7, -5.0, 101.4), (0.95, 1.25)),
    "r_finger": ((-3.0, -5.3, 103.9), (0.5, 0.8)),
    "l_shoulder": ((8.5, 0.3, 72.0), (2.2, 2.2)),
    "l_upper": ((12.2, -0.6, 77.1), (2.05, 2.05)),
    "l_elbow": ((14.6, -1.8, 83.8), (1.75, 1.75)),
    "l_fore": ((14.8, -3.0, 90.4), (1.5, 1.5)),
    "l_wrist": ((13.2, -4.1, 96.5), (1.3, 1.35)),
    "l_hand": ((9.3, -5.0, 101.4), (0.95, 1.25)),
    "l_finger": ((3.6, -5.3, 103.9), (0.5, 0.8)),
}
DANCER_ROOT = "waist"            # the skin's root
# The bones: each pair of joints and what it dresses (a shoe is blush; the trunk's bodice is blush
# between the tutu and the neckline; the rest porcelain).
DANCER_BONES = (
    ("l_tip", "l_box", "shoe"), ("l_box", "l_arch", "shoe"), ("l_arch", "l_ankle", "shoe"),
    ("l_ankle", "l_calf", "leg"), ("l_calf", "l_knee", "leg"), ("l_knee", "l_thigh", "leg"),
    ("l_thigh", "l_hip", "leg"), ("l_hip", "waist", "trunk"),
    ("r_tip", "r_box", "shoe"), ("r_box", "r_arch", "shoe"), ("r_arch", "r_ankle", "shoe"),
    ("r_ankle", "r_calf", "leg"), ("r_calf", "r_knee", "leg"), ("r_knee", "r_thigh", "leg"),
    ("r_thigh", "r_hip", "leg"), ("r_hip", "waist", "trunk"),
    ("waist", "ribs", "trunk"), ("ribs", "chest", "trunk"), ("chest", "yoke", "trunk"),
    ("yoke", "neck", "neck"), ("neck", "nape", "neck"),
    ("yoke", "r_shoulder", "arm"), ("r_shoulder", "r_upper", "arm"), ("r_upper", "r_elbow", "arm"),
    ("r_elbow", "r_fore", "arm"), ("r_fore", "r_wrist", "arm"), ("r_wrist", "r_hand", "arm"),
    ("r_hand", "r_finger", "arm"),
    ("yoke", "l_shoulder", "arm"), ("l_shoulder", "l_upper", "arm"), ("l_upper", "l_elbow", "arm"),
    ("l_elbow", "l_fore", "arm"), ("l_fore", "l_wrist", "arm"), ("l_wrist", "l_hand", "arm"),
    ("l_hand", "l_finger", "arm"),
)
DANCER_SMOOTH = 3                # the skin's bones along each span of a chain, on its smooth curve
DANCER_NECKLINE = 67.0           # the bodice's top (design mm): its trim lies along it
# The head (design mm): its centre, its half-width, half-depth and half-height, how much its lower
# half narrows toward the chin, and its tilt about the nape (toward her left, then forward).
DANCER_HEAD = ((0.3, 0.0, 83.6), (4.2, 5.0, 5.8), 0.2, (math.radians(11.0), math.radians(7.0)))
DANCER_BUN = ((0.0, 4.1, 3.8), (2.7, 2.5, 2.3))   # the bun round the head's centre, and its radii
# The tutu: the plate's top over her pointe (design mm, sized with her), and each layer's reach (the
# plate, the middle frill, the outer frill, inside its metal edge), how far its top lies under the
# plate's and its thickness (mm).
DANCER_PLATE_Z = 55.0
TUTU_LAYERS = ((26.6, 0.0, 0.6), (29.4, 0.75, 0.55), (DANCER_TUTU - 0.4, 1.45, 0.55))
TUTU_FRILL = (21.0, 32.0, 1.0, 1.8, 16)  # the frills' ruffle: from, to, its amplitude, droop, waves
TUTU_RINGS = (3.4, 22.0, 24.2)   # the layers' inner edge (in her hips), the plate's ring, the frills'
TUTU_SCALLOPS = (10, 0.8)        # the plate's scallops: how many, how deep
TUTU_ROSES = (23.4, 2.7)         # a rose on each scallop: how far out, its radius


# ------------------------------------------------------------------ the pedestal
def _flutes(name, cx, cy, z0, z1, parent):
    """A fluted sleeve round (cx, cy) from z0 to z1 (mm): DANCER_FLUTES grooves PED_FLUTE[0] deep
    into a PED_SHAFT drum, each a smooth hollow over PED_FLUTE[1] of its pitch between flat fillets.
    Its ends are open: the moulding under it and the frieze over it close the grooves."""
    depth, share = PED_FLUTE
    per = 6 if WEB else 12
    n = DANCER_FLUTES * per
    bm = bmesh.new()
    rows = []
    for z in (z0, z1):
        row = []
        for i in range(n):
            a = 2.0 * math.pi * i / n
            t = (i % per) / per                                  # across the pitch, 0 to 1
            u = (t - (1.0 - share) / 2.0) / share                # across the groove, 0 to 1
            r = PED_SHAFT - (depth * math.sin(math.pi * u) if 0.0 < u < 1.0 else 0.0)
            row.append(bm.verts.new(mmv((cx + r * math.cos(a), cy + r * math.sin(a), z))))
        rows.append(row)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((rows[0][i], rows[0][j], rows[1][j], rows[1][i]))
    ob = from_bm(name, bm, [M["luxe_metal"]], parent=parent)
    edge_split(ob, 30)
    return ob


def _hold_pedestal(orn, since, cx, cy, z0, z1, r1, what):
    """Stops the run unless every vertex the pedestal's ornament laid since `since` lies between z0
    and z1 and within r1 of the drum's axis (mm, to a thousandth: mathutils works in single
    precision)."""
    for p in orn.placed[since:]:
        if not z0 - 1e-3 <= p.z <= z1 + 1e-3 or math.hypot(p.x - cx, p.y - cy) > r1 + 1e-3:
            raise SystemExit("luxe_dancer.py: the pedestal's %s strays to (%.2f, %.2f, %.2f)"
                             % (what, p.x, p.y, p.z))


def luxe_pedestal(name, body):
    """The dancer's pedestal under the body group, at LX_DANCER on the top: the drum (its mouldings
    and its frieze, `<name>_pedestal`, and its flutes, `<name>_pedestal_flutes`) and its ornament, a
    pearl row round each moulding and a garland round the frieze."""
    cx, cy = LX_DANCER
    r, h = DANCER_DRUM
    uw, ud = LX_UPPER
    # 2 mm or more inside the frame's inner outline (a rounded rectangle: its signed distance,
    # negative inside) and 15 mm clear of the LED ring, the pearls' 0.9 mm included.
    reach = r + PROUD
    corner = LX_CORNER[1] - LX_FRAME
    qx, qy = abs(cx) - (uw / 2 - LX_FRAME - corner), abs(cy) - (ud / 2 - LX_FRAME - corner)
    inside = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - corner
    if inside + reach > -2.0:
        raise SystemExit("luxe_dancer.py: the pedestal at (%.1f, %.1f) comes within 2 mm of the frame" % (cx, cy))
    if math.hypot(cx - LX_SPINDLE[0], cy - LX_SPINDLE[1]) - reach - LX_RING[1] < 15.0:
        raise SystemExit("luxe_dancer.py: the pedestal at (%.1f, %.1f) comes within 15 mm of the LED ring"
                         % (cx, cy))
    z = LX_TOP
    shaft_in = PED_SHAFT - PED_FLUTE[0] - 0.1    # under the flutes' floor, where they meet the drum
    lathe(name + "_pedestal", [
        (0.01, 0.0), (r - 0.3, 0.0), (r, PED_FOOT[0]), (r, PED_FOOT[1]), (r - 0.3, PED_FOOT[1] + 0.3),
        (shaft_in, PED_FLUTED[0]), (shaft_in, PED_FLUTED[1]), (PED_SHAFT, PED_FRIEZE[0]),
        (PED_SHAFT, PED_FRIEZE[1]), (r - 0.3, PED_CAP[0] - 0.3), (r, PED_CAP[0]), (r, PED_CAP[1]),
        (r - 0.3, h), (0.01, h)],
        M["luxe_metal"], seg=96, parent=body, loc=L(cx, cy, z))
    _flutes(name + "_pedestal_flutes", cx, cy, z + PED_FLUTED[0], z + PED_FLUTED[1], body)

    orn = Ornament(name + "_deck_orn_pedestal", body)
    wire = M["luxe_metal"]
    bead, pitch = PED_PEARL
    # The pearl rows, centred on each moulding's straight face, from the back (+y), the side least
    # seen, where the row's loop closes.
    since = len(orn.placed)
    face = Tube((cx, cy, z), (cx, cy, z + h), r, ref=(0.0, 1.0, 0.0))
    for (z0, z1), (lo, hi) in ((PED_FOOT, (0.0, PED_FOOT[1] + 0.3)), (PED_CAP, (PED_CAP[0] - 0.3, h))):
        b = (z0 + z1) / 2
        pearl_row(orn, face, [(0.0, b), (face.round, b)], wire, radius=bead, pitch=pitch, loop=True)
        _hold_pedestal(orn, since, cx, cy, z + lo, z + hi, r + PROUD, "pearl row")
        since = len(orn.placed)
    # The garland round the frieze's middle: camellias, daisies and roses, a leaf either side of
    # each.
    frieze = Tube((cx, cy, z), (cx, cy, z + h), PED_SHAFT, ref=(0.0, 1.0, 0.0))
    garland(orn, frieze, sum(PED_FRIEZE) / 2, wire, flowers=("camellia", "daisy", "rose"), count=6, size=2.8,
            wave=0.5, leaf_len=2.8)
    _hold_pedestal(orn, since, cx, cy, z + PED_FRIEZE[0], z + PED_FRIEZE[1], PED_SHAFT + PROUD, "garland")
    return orn.done()


# ------------------------------------------------------------------ the figure's parts
def _smooth_skeleton():
    """DANCER_JOINTS and DANCER_BONES with a smooth curve through each chain (the joints between two
    branches or ends: a leg from its pointe to the waist, an arm from the yoke to its fingertips):
    DANCER_SMOOTH bones along each span, on a Catmull-Rom curve through the chain's joints, the
    radii blended along it, each bone keeping its span's tag. Returns the joints and the bones, the
    given joints among them under their own names."""
    links = {}
    for a, b, tag in DANCER_BONES:
        links.setdefault(a, []).append((b, tag))
        links.setdefault(b, []).append((a, tag))
    joints, bones, walked = dict(DANCER_JOINTS), [], set()
    for start in (n for n in DANCER_JOINTS if len(links[n]) != 2):
        for first, tag in links[start]:
            if (start, first) in walked:
                continue
            chain, tags = [start, first], [tag]
            while len(links[chain[-1]]) == 2:
                nxt, tag = next(link for link in links[chain[-1]] if link[0] != chain[-2])
                chain.append(nxt)
                tags.append(tag)
            walked.add((chain[-1], chain[-2]))
            pts = smooth_path([DANCER_JOINTS[n][0] for n in chain], DANCER_SMOOTH)
            names = []
            for i, p in enumerate(pts):
                span, k = min(i // DANCER_SMOOTH, len(chain) - 2), i % DANCER_SMOOTH
                if k == 0 or i == len(pts) - 1:
                    names.append(chain[span + (1 if i == len(pts) - 1 else 0)])
                    continue
                t = k / DANCER_SMOOTH
                (ra, rb), (sa, sb) = DANCER_JOINTS[chain[span]][1], DANCER_JOINTS[chain[span + 1]][1]
                names.append("%s~%s~%d" % (chain[span], chain[span + 1], k))
                joints[names[-1]] = (tuple(p), (ra + (sa - ra) * t, rb + (sb - rb) * t))
            for i in range(len(names) - 1):
                bones.append((names[i], names[i + 1], tags[min(i // DANCER_SMOOTH, len(tags) - 1)]))
    return joints, bones


def _skin_body(joints, bones, levels, ratio):
    """The body's hull: a skin modifier round the skeleton (`joints`, `bones`) under `levels` of
    subdivision and, when `ratio` < 1, decimated to that share of its faces, evaluated into a bmesh
    (mm are metres / MM, in the design frame)."""
    names = list(joints)
    index = {n: i for i, n in enumerate(names)}
    me = bpy.data.meshes.new("dancer_probe")
    me.from_pydata([mmv(joints[n][0]) for n in names], [(index[a], index[b]) for a, b, _ in bones], [])
    probe = new_obj("dancer_probe", me)
    probe.modifiers.new("Skin", "SKIN")
    for n, v in zip(names, me.skin_vertices[0].data):
        rx, ry = joints[n][1]
        v.radius = (rx * MM, ry * MM)
        v.use_root = n == DANCER_ROOT
    sub = probe.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = sub.render_levels = levels
    if ratio < 1.0:
        probe.modifiers.new("Decimate", "DECIMATE").ratio = ratio
    dg = SC.view_layers[0].depsgraph
    dg.update()
    out = bpy.data.meshes.new_from_object(probe.evaluated_get(dg), depsgraph=dg)
    bpy.data.objects.remove(probe, do_unlink=True)
    bpy.data.meshes.remove(me)
    bm = bmesh.new()
    bm.from_mesh(out)
    bpy.data.meshes.remove(out)
    return bm


def _dress(bm, joints, bones):
    """Gives each face of the body its material by the bone nearest it: 1 (porcelain_blush) for the
    pointe shoes and for the bodice (the trunk from inside the tutu's layers, where its lower edge
    is hidden, up to the neckline), else 0 (porcelain)."""
    low = DANCER_PLATE_Z - 1.2
    segs = [(Vector(joints[a][0]), Vector(joints[b][0]), tag) for a, b, tag in bones]
    for f in bm.faces:
        c = f.calc_center_median() / MM
        best = None
        for pa, pb, tag in segs:
            ab = pb - pa
            t = min(max((c - pa).dot(ab) / ab.length_squared, 0.0), 1.0)
            d = (pa + ab * t - c).length_squared
            if best is None or d < best[0]:
                best = (d, tag)
        tag = best[1]
        f.material_index = 1 if tag == "shoe" or (tag == "trunk" and low < c.z < DANCER_NECKLINE) else 0


def _merge(dst, src, material=0):
    """Copies src's vertices and faces into dst (its faces given `material`'s index), and frees
    src."""
    made = [dst.verts.new(v.co) for v in src.verts]
    src.verts.index_update()
    for f in src.faces:
        dst.faces.new([made[v.index] for v in f.verts]).material_index = material
    src.free()


def _band(bm_out, bvh, centre, axis, half, lift, n):
    """A band round the body at `centre` (mm), square to `axis`: n rays from the axis out to the
    body's surface, the band's face `lift` mm off it and `half` mm either side of the ring, its
    top and bottom carried 0.3 mm into the body."""
    axis = axis.normalized()
    e1 = axis.orthogonal().normalized()
    e2 = axis.cross(e1)
    outer_top, outer_bot, inner_top, inner_bot = [], [], [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        d = e1 * math.cos(a) + e2 * math.sin(a)
        hit = bvh.ray_cast(centre, d, 12.0)[0]
        if hit is None:
            raise SystemExit("luxe_dancer.py: no body round %s for a band" % (tuple(round(c, 1) for c in centre),))
        out = d * lift
        inn = -d * 0.3
        outer_top.append(bm_out.verts.new((hit + out + axis * half) * MM))
        outer_bot.append(bm_out.verts.new((hit + out - axis * half) * MM))
        inner_top.append(bm_out.verts.new((hit + inn + axis * half) * MM))
        inner_bot.append(bm_out.verts.new((hit + inn - axis * half) * MM))
    for i in range(n):
        j = (i + 1) % n
        bm_out.faces.new((outer_bot[i], outer_bot[j], outer_top[j], outer_top[i]))
        bm_out.faces.new((outer_top[i], outer_top[j], inner_top[j], inner_top[i]))
        bm_out.faces.new((inner_bot[i], inner_bot[j], outer_bot[j], outer_bot[i]))


def _ovoid(bm, centre, radii, taper, seg):
    """An egg into bm: a sphere of `radii` (mm) round `centre`, its lower half narrowing toward the
    bottom by `taper`. Returns its vertices."""
    made = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(seg * 5 // 8, 6), radius=1.0)["verts"]
    rx, ry, rz = radii
    for v in made:
        x, y, z = v.co
        k = 1.0 - taper * max(0.0, -z)
        v.co = Vector((centre[0] + x * rx * k, centre[1] + y * ry * k, centre[2] + z * rz))
    return made


def _pipe(bm, pts, r, sides):
    """A tube r mm round the polyline `pts` (mm) into bm, its ends capped."""
    pts = [Vector(p) for p in pts]
    rings = []
    normal = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        normal = (t.orthogonal() if normal is None else normal - t * normal.dot(t)).normalized()
        side = t.cross(normal)
        rings.append([bm.verts.new(p + (normal * math.cos(a) + side * math.sin(a)) * r)
                      for a in (2.0 * math.pi * k / sides for k in range(sides))])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(sides):
            m = (k + 1) % sides
            bm.faces.new((ra[k], ra[m], rb[m], rb[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])


def _cone(bm, base, direction, r, h, sides):
    """A small cone into bm, its base round `base` (mm), r in radius, pointing h mm along
    `direction`."""
    made = bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=0.0, depth=h)["verts"]
    turn = Vector((0.0, 0.0, 1.0)).rotation_difference(direction.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(base) + direction.normalized() * (h / 2)) @ turn,
                        verts=made)


def _head_point(radii, d):
    """Where the direction d from the head's centre meets its upper half (mm, from the centre)."""
    rx, ry, rz = radii
    return d * (1.0 / math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2 + (d.z / rz) ** 2))


def _head(bm_head, bm_tiara, seg):
    """The head (an egg, no face), the bun behind its crown and the tiara before the bun (a band
    over the crown from side to side, five points on it), in the head's tilted pose (design mm)."""
    centre, radii, taper, (side, fwd) = DANCER_HEAD
    nape = Vector(DANCER_JOINTS["nape"][0])
    tilt = (Matrix.Translation(nape) @ Matrix.Rotation(fwd, 4, "X") @ Matrix.Rotation(side, 4, "Y")
            @ Matrix.Translation(-nape))
    made = _ovoid(bm_head, centre, radii, taper, seg)
    offset, bun = DANCER_BUN
    made += _ovoid(bm_head, Vector(centre) + Vector(offset), bun, 0.0, max(10, seg * 3 // 4))
    bmesh.ops.transform(bm_head, matrix=tilt, verts=made)
    # The tiara's band, in a plane through the head's centre across it, leaning 22 degrees forward
    # from upright, just over the head's surface.
    up = Vector((0.0, -math.sin(math.radians(22.0)), math.cos(math.radians(22.0))))
    across = Vector((1.0, 0.0, 0.0))
    c = Vector(centre)
    steps = 14 if WEB else 32
    band = []
    for k in range(steps + 1):
        phi = math.radians(28.0 + 124.0 * k / steps)
        d = across * math.cos(phi) + up * math.sin(phi)
        band.append(c + _head_point(radii, d) + d * 0.25)
    before = len(bm_tiara.verts)
    _pipe(bm_tiara, band, 0.32, 6 if WEB else 10)
    for phi, h in ((60.0, 1.0), (75.0, 1.3), (90.0, 1.7), (105.0, 1.3), (120.0, 1.0)):
        d = across * math.cos(math.radians(phi)) + up * math.sin(math.radians(phi))
        _cone(bm_tiara, c + _head_point(radii, d) + d * 0.3, d, 0.42, h, 6 if WEB else 10)
    bmesh.ops.transform(bm_tiara, matrix=tilt, verts=bm_tiara.verts[before:])


def _frill(r, theta):
    """A frill's top over its flat inner part (mm) at radius r, angle theta: its droop and its
    ruffle, the same for every frill, so that they nest."""
    r0, r1, amp, droop, waves = TUTU_FRILL
    u = min(max((r - r0) / (r1 - r0), 0.0), 1.0)
    return -droop * u * u + amp * u ** 1.5 * math.sin(waves * theta)


def _tutu_edge(layer, theta):
    """Layer `layer`'s outline (mm from her axis) at angle theta: the plate's scalloped
    (TUTU_SCALLOPS), a frill's swelling and shrinking a little with its folds."""
    reach = TUTU_LAYERS[layer][0]
    if layer == 0:
        count, depth = TUTU_SCALLOPS
        return reach - depth * (1.0 - abs(math.cos(count * theta / 2.0)))
    return reach - 0.25 + 0.25 * math.sin(TUTU_FRILL[4] * theta)


def _tutu_layer(bm, layer, z_plate):
    """Layer `layer` of TUTU_LAYERS into bm, round her axis: a closed disc from inside her hips
    (TUTU_RINGS[0]) out to its outline (_tutu_edge), its top under the plate's (z_plate) by the
    layer's own depth, thinning toward its edge. The plate is flat; a frill droops and ruffles
    (_frill). The frills share their rings (TUTU_RINGS[2], the middle frill's outline), so that
    the outer one nests under the middle one. Returns the outer frill's rim (its middle all round,
    mm), else None."""
    reach, under, thick = TUTU_LAYERS[layer]
    r_in, plate_ring, frill_ring = TUTU_RINGS
    waves = TUTU_FRILL[4]
    n = TUTU_SCALLOPS[0] * (6 if WEB else 12) if layer == 0 else waves * (4 if WEB else 10)
    top, bot = [], []
    for i in range(n):
        th = 2.0 * math.pi * i / n
        if layer == 0:
            rings = (r_in, plate_ring, _tutu_edge(0, th))
        else:
            rings = (r_in, frill_ring) + tuple(_tutu_edge(k, th) for k in range(1, layer + 1))
        ct, st = math.cos(th), math.sin(th)
        trow, brow = [], []
        for rr in rings:
            zt = z_plate - under + (0.0 if layer == 0 else _frill(rr, th))
            zb = zt - thick * (1.0 - 0.35 * (rr - r_in) / (reach - r_in))
            trow.append(bm.verts.new(mmv((rr * ct, rr * st, zt))))
            brow.append(bm.verts.new(mmv((rr * ct, rr * st, zb))))
        top.append(trow)
        bot.append(brow)
    last = len(top[0]) - 1
    for i in range(n):
        j = (i + 1) % n
        for k in range(last):
            bm.faces.new((top[i][k], top[i][k + 1], top[j][k + 1], top[j][k]))
            bm.faces.new((bot[i][k], bot[j][k], bot[j][k + 1], bot[i][k + 1]))
        bm.faces.new((top[i][last], bot[i][last], bot[j][last], top[j][last]))
        bm.faces.new((top[i][0], top[j][0], bot[j][0], bot[i][0]))
    if layer == len(TUTU_LAYERS) - 1:
        return [((Vector(top[i][last].co) + Vector(bot[i][last].co)) / 2) / MM for i in range(n)]
    return None


# ------------------------------------------------------------------ the dancer
def luxe_dancer(name, root):
    """The turning top (`<name>_dancer`, an empty at the drum's top centre under the root): its
    metal disc (`<name>_dancer_disc`) and the figure on it, sized to DANCER_HEIGHT, her pointe at
    the disc's top centre. Her porcelain (`<name>_dancer_figure`: the body, the head and bun and
    the ankles' ribbons, in porcelain and porcelain_blush), her metal (`<name>_dancer_metal`: the
    tiara, the bodice's trim and the tutu's edge), the tutu (`<name>_dancer_tutu`) and the roses on
    its plate (`<name>_dancer_roses_<material>`), each one mesh in the dancer's frame."""
    cx, cy = LX_DANCER
    dancer = empty(name + "_dancer", L(cx, cy, LX_TOP + DANCER_DRUM[1]), parent=root)
    rd, td = DANCER_DISC
    lathe(name + "_dancer_disc", [(0.01, 0.0), (rd, 0.0), (rd, td - 0.4), (rd - 0.4, td), (0.01, td)],
          M["luxe_metal"], seg=64, parent=dancer)

    # The body (decimated in the web build), measured at its design size, then sized: her pointe on
    # the disc's top centre, her fingertips DANCER_HEIGHT over it, turned to face the hero camera.
    joints, bones = _smooth_skeleton()
    figure = _skin_body(joints, bones, 2, 1.0)
    if WEB:
        tris = sum(len(f.verts) - 2 for f in figure.faces)
        figure.free()
        figure = _skin_body(joints, bones, 2, min(1.0, DANCER_WEB_BODY / tris))
    zs = [v.co.z / MM for v in figure.verts]
    low, high = min(zs), max(zs)
    s = DANCER_HEIGHT / (high - low)
    _dress(figure, joints, bones)
    size = (Matrix.Translation((0.0, 0.0, td * MM)) @ Matrix.Rotation(DANCER_YAW, 4, "Z") @ Matrix.Scale(s, 4)
            @ Matrix.Translation((0.0, 0.0, -low * MM)))
    bmesh.ops.transform(figure, matrix=size, verts=figure.verts)
    turn = Matrix.Rotation(DANCER_YAW, 4, "Z")

    def at(p):
        """A design point (mm) where the sized figure has it (mm, the dancer's frame)."""
        return (size @ (Vector(p) * MM)) / MM

    # Bands round the sized body: the bodice's trim along its neckline, a ribbon round each ankle.
    figure.verts.index_update()
    bvh = BVHTree.FromPolygons([v.co / MM for v in figure.verts], [[v.index for v in f.verts] for f in figure.faces])
    lean = size.to_3x3()
    metal = bmesh.new()
    chest = DANCER_JOINTS["chest"][0]
    _band(metal, bvh, at((chest[0], chest[1], DANCER_NECKLINE)), lean @ Vector((0.0, 0.0, 1.0)), 0.35 * s, 0.22,
          32 if WEB else 72)
    ribbons = bmesh.new()
    for leg in ("l", "r"):
        ankle, calf = Vector(DANCER_JOINTS[leg + "_ankle"][0]), Vector(DANCER_JOINTS[leg + "_calf"][0])
        _band(ribbons, bvh, at(ankle + (calf - ankle) * 0.08), lean @ (calf - ankle), 0.45 * s, 0.15,
              16 if WEB else 40)
    _merge(figure, ribbons, 1)

    # The head, its bun and the tiara, sized as the body.
    head, tiara = bmesh.new(), bmesh.new()
    _head(head, tiara, 16 if WEB else 32)
    to_figure = size @ Matrix.Scale(MM, 4)
    bmesh.ops.transform(head, matrix=to_figure, verts=head.verts)
    bmesh.ops.transform(tiara, matrix=to_figure, verts=tiara.verts)
    _merge(figure, head, 0)
    _merge(metal, tiara)

    # The tutu at her hips: the plate and the two frills, the outer one's metal edge, the roses.
    z_plate = at((0.0, 0.0, DANCER_PLATE_Z)).z
    tutu = bmesh.new()
    rim = None
    for layer in range(len(TUTU_LAYERS)):
        rim = _tutu_layer(tutu, layer, z_plate) or rim
    bmesh.ops.transform(tutu, matrix=turn, verts=tutu.verts)
    bmesh.ops.recalc_face_normals(tutu, faces=tutu.faces)
    edge = bmesh.new()
    _pipe(edge, [turn @ p for p in rim + rim[:1]], 0.38, 5 if WEB else 10)
    bmesh.ops.transform(edge, matrix=Matrix.Scale(MM, 4), verts=edge.verts)
    _merge(metal, edge)
    from_bm(name + "_dancer_figure", figure, [M["porcelain"], M["porcelain_blush"]], parent=dancer)
    from_bm(name + "_dancer_metal", metal, [M["luxe_metal"]], parent=dancer)
    edge_split(from_bm(name + "_dancer_tutu", tutu, [M["porcelain"]], parent=dancer), 40)

    orn = Ornament(name + "_dancer_roses", dancer)
    plate = Plane((0.0, 0.0, z_plate), (0.0, 0.0, 1.0), turn @ Vector((0.0, 1.0, 0.0)))
    count = TUTU_SCALLOPS[0]
    out, r_rose = TUTU_ROSES
    colours = (("rose", "coral"), ("coral", "butter"), ("sky", "ivory"))
    for k in range(count):
        th = 2.0 * math.pi * k / count
        rose(orn, plate, (out * math.cos(th), out * math.sin(th)), r_rose, M["luxe_metal"], turn=th - math.pi / 2,
             colours=colours[k % len(colours)])
    orn.done()

    # Her height, her pointe on the disc, and her reach, 20 mm or more clear of the record's edge.
    parts = [ob for ob in dancer.children if ob.name != name + "_dancer_disc"]
    pts = [Vector(v.co) / MM for ob in parts for v in ob.data.vertices]
    reach = max(math.hypot(p.x, p.y) for p in pts)
    foot, top = min(p.z for p in pts), max(p.z for p in pts)
    if abs(top - foot - DANCER_HEIGHT) > 0.05 or abs(foot - td) > 0.05:
        raise SystemExit("luxe_dancer.py: the figure stands from %.2f to %.2f mm, not %.0f mm tall on the disc's "
                         "top (%.0f)" % (foot, top, DANCER_HEIGHT, td))
    if reach > DANCER_TUTU + 1e-3:
        raise SystemExit("luxe_dancer.py: the figure reaches %.2f mm from her axis, past %.0f" % (reach, DANCER_TUTU))
    clear = math.hypot(cx - LX_SPINDLE[0], cy - LX_SPINDLE[1]) - VINYL_R - reach
    if clear < 20.0:
        raise SystemExit("luxe_dancer.py: the figure comes %.1f mm from the record's edge" % clear)
    print("luxe_dancer: %d triangles in the figure, %.2f mm reach, %.1f mm clear of the record"
          % (sum(len(f.vertices) - 2 for ob in parts for f in ob.data.polygons), reach, clear))
    return dancer

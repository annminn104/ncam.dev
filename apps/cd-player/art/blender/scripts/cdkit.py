"""cdkit: geometry helpers and physical materials for the CD player scenes.

Units: metres in Blender, but every helper takes millimetres (`mm` suffix or
documented) because product dimensions are specified in mm.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001
SC = None  # current scene, set by new_scene()
M = {}     # material table
FONTS = {}
WEB = False  # export.py sets it: lighter tessellation for the GLB, no Cycles-only shader tricks


def q(seg):
    """Segment count for the current quality."""
    return max(16, seg // 2) if WEB else seg


HDRI_ROT = 140.0
BG_STRENGTH = 1.45
HDRI = "/Applications/Blender.app/Contents/Resources/5.2/datafiles/studiolights/world/studio.exr"


def lin(r, g, b, a=1.0):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)


def hexrgb(h):
    """'#rrggbb' -> (r, g, b) in 0..255, for lin()."""
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ------------------------------------------------------------------ materials
_KEYS = {
    "metal": "Metallic", "rough": "Roughness", "trans": "Transmission Weight", "ior": "IOR",
    "coat": "Coat Weight", "coat_rough": "Coat Roughness", "sheen": "Sheen Weight",
    "sheen_rough": "Sheen Roughness", "aniso": "Anisotropic", "film": "Thin Film Thickness",
    "film_ior": "Thin Film IOR", "emit": "Emission Color", "emit_s": "Emission Strength",
    "spec": "Specular IOR Level", "alpha": "Alpha", "sss": "Subsurface Weight",
}


def mat(name, base=(0.8, 0.8, 0.8, 1.0), **kw):
    """(Re)build a Principled material from scratch, so reruns never stack nodes."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    p.inputs["Base Color"].default_value = base
    for k, v in kw.items():
        p.inputs[_KEYS[k]].default_value = v
    if kw.get("trans", 0) > 0 or kw.get("alpha", 1) < 1:
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            pass
    if kw.get("trans", 0) > 0 and not WEB:
        # Cycles blocks shadow rays at glass (caustics are off), which leaves anything inside a
        # crystal case unlit. Let shadow rays through, faintly tinted.
        lp = nt.nodes.new("ShaderNodeLightPath")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        tr.inputs["Color"].default_value = (0.9, 0.91, 0.93, 1)
        mx = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"])
        nt.links.new(p.outputs[0], mx.inputs[1])
        nt.links.new(tr.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m


def bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def obj_coords(m, scale=1.0):
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def add_bump(m, kind="voronoi", scale=900.0, strength=0.25, distance=0.0003, detail=2.0):
    """Micro surface: leather grain (voronoi), fabric/plastic grain (noise)."""
    nt = m.node_tree
    p = bsdf(m)
    vec = obj_coords(m, scale)
    if kind == "voronoi":
        tex = nt.nodes.new("ShaderNodeTexVoronoi")
        tex.feature = "SMOOTH_F1"
        out = tex.outputs["Distance"]
    else:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Detail"].default_value = detail
        out = tex.outputs["Fac"]
    nt.links.new(vec, tex.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(out, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def radial_aniso(m, rotation=0.0):
    """Radially brushed metal (knob tops, disc data layer)."""
    nt = m.node_tree
    p = bsdf(m)
    t = nt.nodes.new("ShaderNodeTangent")
    t.direction_type = "RADIAL"
    t.axis = "Z"
    nt.links.new(t.outputs["Tangent"], p.inputs["Tangent"])
    p.inputs["Anisotropic Rotation"].default_value = rotation
    return m


def add_quilt(m, cell_mm=25.0, strength=1.0, distance=0.004):
    """Diamond quilting (Cycles only; the web paints it as a normal map): two bands of sine waves
    at +45 and -45 degrees, multiplied into pillows whose diagonals are cell_mm long."""
    nt = m.node_tree
    p = bsdf(m)
    vec = obj_coords(m, 1.0)
    prod = None
    for ang in (45.0, -45.0):
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(ang))
        nt.links.new(vec, mp.inputs["Vector"])
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "X"
        wave.wave_profile = "SIN"
        # Blender's bands repeat every 2*pi/20 object units at scale 1: a period of cell/sqrt(2).
        wave.inputs["Scale"].default_value = 0.31416 * math.sqrt(2.0) / (cell_mm * MM)
        nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
        if prod is None:
            prod = wave.outputs["Fac"]
        else:
            mul = nt.nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            nt.links.new(prod, mul.inputs[0])
            nt.links.new(wave.outputs["Fac"], mul.inputs[1])
            prod = mul.outputs["Value"]
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(prod, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def add_weave(m, pitch_mm=1.0, strength=0.5, distance=0.00012):
    """Plain weave (Cycles only; the web paints it as a normal map): threads along X and along Y,
    pitch_mm apart, the higher of the two bands making the surface."""
    nt = m.node_tree
    p = bsdf(m)
    vec = obj_coords(m, 1.0)
    prod = None
    for direction in ("X", "Y"):
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = direction
        wave.wave_profile = "SIN"
        wave.inputs["Scale"].default_value = 0.31416 / (pitch_mm * MM)
        nt.links.new(vec, wave.inputs["Vector"])
        if prod is None:
            prod = wave.outputs["Fac"]
        else:
            mx = nt.nodes.new("ShaderNodeMath")
            mx.operation = "MAXIMUM"
            nt.links.new(prod, mx.inputs[0])
            nt.links.new(wave.outputs["Fac"], mx.inputs[1])
            prod = mx.outputs["Value"]
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(prod, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def image_mat(name, path, w_mm, h_mm, coat=0.35, rough=0.4, cx_mm=0.0, cy_mm=0.0):
    """Print `path` onto an object's local XY rectangle (w x h mm, centred at cx, cy), cover-fit."""
    m = mat(name, rough=rough, coat=coat, coat_rough=0.12)
    nt = m.node_tree
    img = bpy.data.images.load(path, check_existing=True)
    iw, ih = img.size
    a, t = iw / max(ih, 1), w_mm / h_mm
    su, sv = (t / a, 1.0) if a > t else (1.0, a / t)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (su / (w_mm * MM), sv / (h_mm * MM), 1.0)
    mp.inputs["Location"].default_value = (0.5 - su * cx_mm / w_mm, 0.5 - sv * cy_mm / h_mm, 0.0)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "EXTEND"
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf(m).inputs["Base Color"])
    return m


# ------------------------------------------------------------------ objects
def new_obj(name, data, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, data)
    SC.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = new_obj(name, None, loc, rot, parent)
    ob.empty_display_size = 0.02
    return ob


def mmv(v):
    return tuple(c * MM for c in v)


def from_bm(name, bm, mats, smooth=True, **kw):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    return new_obj(name, me, **kw)


def bevel(ob, width_mm, seg=3, angle=30.0, harden=True):
    md = ob.modifiers.new("Bevel", "BEVEL")
    md.width = width_mm * MM
    md.segments = seg
    md.limit_method = "ANGLE"
    md.angle_limit = math.radians(angle)
    try:
        md.harden_normals = harden
    except Exception:
        pass
    return ob


def edge_split(ob, angle=35.0):
    md = ob.modifiers.new("EdgeSplit", "EDGE_SPLIT")
    md.split_angle = math.radians(angle)
    return ob


def rbox(name, size_mm, mats, bevel_mm=0.0, center_mm=(0, 0, 0), seg=3, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=mmv(size_mm), verts=bm.verts)
    bmesh.ops.translate(bm, vec=mmv(center_mm), verts=bm.verts)
    ob = from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)
    if bevel_mm:
        bevel(ob, bevel_mm, seg)
    return ob


def lathe(name, prof_mm, mats, seg=96, closed=True, ridge=None, **kw):
    """Revolve (r, z) mm profile around Z. `ridge=(index_set, depth_mm)` knurls those rows."""
    seg = q(seg)
    pts = list(prof_mm) + ([prof_mm[0]] if closed else [])
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        row = []
        for k, (r, z) in enumerate(pts):
            rr = max(r, 1e-4)
            if ridge and k in ridge[0] and i % 2:
                rr += ridge[1]
            row.append(bm.verts.new((rr * ca * MM, rr * sa * MM, z * MM)))
        rings.append(row)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for k in range(len(pts) - 1):
            try:
                bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)
    edge_split(ob, 40)
    return ob


def annulus(name, ro_mm, ri_mm, mats, z_mm=0.0, seg=160, **kw):
    seg = q(seg)
    bm = bmesh.new()
    outer = [bm.verts.new((ro_mm * math.cos(2 * math.pi * i / seg) * MM,
                           ro_mm * math.sin(2 * math.pi * i / seg) * MM, z_mm * MM)) for i in range(seg)]
    inner = [bm.verts.new((ri_mm * math.cos(2 * math.pi * i / seg) * MM,
                           ri_mm * math.sin(2 * math.pi * i / seg) * MM, z_mm * MM)) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
    return from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)


def lathe_arc(name, prof_mm, a0, a1, mats, seg=24, **kw):
    """Revolve an (r, z) mm profile around Z from a0 to a1 degrees: an open shell, no end caps
    (a corner cap; solidify() gives it thickness)."""
    seg = q(seg)
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * i / seg)
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((max(r, 1e-4) * ca * MM, max(r, 1e-4) * sa * MM, z * MM))
                      for r, z in prof_mm])
    for i in range(seg):
        a, b = rings[i], rings[i + 1]
        for k in range(len(prof_mm) - 1):
            bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)


def solidify(ob, thickness_mm, offset=0.0):
    """Gives an open surface a thickness (mm); offset 0 grows it half each way, so the surface's
    normal direction never matters."""
    md = ob.modifiers.new("Solidify", "SOLIDIFY")
    md.thickness = thickness_mm * MM
    md.offset = offset
    md.use_even_offset = True
    return ob


# ------------------------------------------------------------------ 2D outlines (mm)
def rrect(w, h, r, seg=10, cx=0.0, cy=0.0):
    r = max(min(r, w / 2 - 1e-3, h / 2 - 1e-3), 0.0)
    pts = []
    for sx, sy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox, oy = cx + sx * (w / 2 - r), cy + sy * (h / 2 - r)
        if r == 0:
            pts.append((ox, oy))
            continue
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def circle(r, seg=64, cx=0.0, cy=0.0, a0=0.0, a1=360.0, cw=False):
    n = seg if (a1 - a0) >= 360 else seg + 1
    span = a1 - a0
    out = []
    for i in range(n):
        a = math.radians(a0 + span * i / (seg if span >= 360 else seg))
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out[::-1] if cw else out


def keyhole(cx, cy, r=1.6, slot_w=1.2, slot_h=3.4, seg=16):
    """A keyhole outline (mm): a circle of radius r over a slot slot_w wide that reaches slot_h
    below the circle's centre. Goes from the slot's bottom left, up the left side, over the top of
    the circle and down the right side."""
    half = slot_w / 2
    drop = math.sqrt(r * r - half * half)
    left = math.degrees(math.atan2(-drop, -half))
    right = math.degrees(math.atan2(-drop, half))
    span = 360.0 - (right - left)
    pts = [(cx - half, cy - slot_h)]
    for i in range(seg + 1):
        a = math.radians(left - span * i / seg)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    pts.append((cx + half, cy - slot_h))
    return pts


def _poly(cu, pts, cyclic, z=0.0):
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, xy in zip(sp.points, pts):
        zz = xy[2] if len(xy) > 2 else z
        p.co = (xy[0] * MM, xy[1] * MM, zz * MM, 1.0)
    sp.use_cyclic_u = cyclic
    sp.use_smooth = True
    return sp


def slab(name, outlines, z0, z1, mats, bevel_mm=0.0, res=3, **kw):
    """Filled 2D shape (outer + hole outlines, mm) extruded between z0..z1 mm, edges rounded.

    The bevel grows the solid outward by bevel_mm, so outlines are shrunk to keep the
    requested footprint; holes grow by the same amount.
    """
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    t = (z1 - z0) / 2
    b = min(bevel_mm, t * 0.98)
    cu.extrude = max(t - b, 1e-4) * MM
    cu.bevel_depth = b * MM
    cu.bevel_resolution = min(res, 2) if WEB else res
    for k, o in enumerate(outlines):
        if b > 0:
            o = _offset(o, -b if k == 0 else b)
        _poly(cu, o, True)
    for m in (mats if isinstance(mats, list) else [mats]):
        cu.materials.append(m)
    loc = kw.pop("loc", (0, 0, 0))
    from mathutils import Euler
    off = Euler(kw.get("rot", (0, 0, 0))).to_matrix() @ Vector((0, 0, (z0 + t) * MM))
    ob = new_obj(name, cu, loc=(loc[0] + off.x, loc[1] + off.y, loc[2] + off.z), **kw)
    return ob


def _offset(pts, d):
    """Offset a closed CCW-or-CW polygon by d mm along its outward normal (approx, for bevels)."""
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sgn = 1.0 if area > 0 else -1.0  # CCW -> outward normal is (dy, -dx)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        t0 = (p1 - p0).normalized() if (p1 - p0).length > 1e-9 else Vector((1, 0))
        t1 = (p2 - p1).normalized() if (p2 - p1).length > 1e-9 else t0
        n0 = Vector((t0.y, -t0.x)) * sgn
        n1 = Vector((t1.y, -t1.x)) * sgn
        nn = (n0 + n1)
        nn = nn.normalized() if nn.length > 1e-9 else n0
        out.append((p1.x + nn.x * d, p1.y + nn.y * d))
    return out


def tube(name, pts_mm, radius_mm, mats, cyclic=False, res=3, caps=True, **kw):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_mode = "ROUND"
    cu.bevel_depth = radius_mm * MM
    cu.bevel_resolution = min(res, 2) if WEB else res
    cu.use_fill_caps = caps
    cu.twist_mode = "MINIMUM"
    _poly(cu, pts_mm, cyclic)
    for m in (mats if isinstance(mats, list) else [mats]):
        cu.materials.append(m)
    return new_obj(name, cu, **kw)


def ribbon(name, pts_mm, width_mm, mats, **kw):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.extrude = width_mm / 2 * MM
    cu.twist_mode = "MINIMUM"
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts_mm) - 1)
    for bp, co in zip(sp.bezier_points, pts_mm):
        bp.co = mmv(co)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    for m in (mats if isinstance(mats, list) else [mats]):
        cu.materials.append(m)
    return new_obj(name, cu, **kw)


def text(name, body, size_mm, mats, font="avenir", align="CENTER", extrude_mm=0.0, **kw):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size_mm * MM
    if font in FONTS:
        cu.font = FONTS[font]
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = extrude_mm * MM
    for m in (mats if isinstance(mats, list) else [mats]):
        cu.materials.append(m)
    return new_obj(name, cu, **kw)


def stitches(name, path_mm, z_mm, mats, spacing=4.2, dash=2.6, width=0.75, height=0.55, closed=True, **kw):
    """Leather stitching: short capsules along an XY path at height z, oriented on its tangent.
    The path is closed unless closed=False (a seam along a handle)."""
    n = len(path_mm)
    segs = n if closed else n - 1
    seglen = [((Vector(path_mm[(i + 1) % n]) - Vector(path_mm[i])).length) for i in range(segs)]
    total = sum(seglen)
    bm = bmesh.new()
    count = int(total // spacing)
    for k in range(count):
        s = k * spacing
        i = 0
        while s > seglen[i]:
            s -= seglen[i]
            i = (i + 1) % segs
        p0, p1 = Vector(path_mm[i]), Vector(path_mm[(i + 1) % n])
        tdir = (p1 - p0).normalized()
        p = p0 + tdir * s
        ang = math.atan2(tdir.y, tdir.x)
        geom = bmesh.ops.create_cube(bm, size=1.0)
        vs = geom["verts"]
        bmesh.ops.scale(bm, vec=(dash * MM, width * MM, height * MM), verts=vs)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, "Z"), verts=vs)
        bmesh.ops.translate(bm, vec=(p.x * MM, p.y * MM, z_mm * MM), verts=vs)
    ob = from_bm(name, bm, mats if isinstance(mats, list) else [mats], **kw)
    if not WEB:
        bevel(ob, 0.22, seg=2, angle=60, harden=False)
    return ob


# ------------------------------------------------------------------ scene plumbing
def enable_gpu():
    """Cycles on the Apple GPU. --factory-startup leaves the compute device at NONE, which renders
    on the CPU without a word; returns the names of the devices in use ([] means the CPU)."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        devices = prefs.get_devices_for_type("METAL")
        for dev in devices:
            dev.use = dev.type != "CPU"
        return [dev.name for dev in devices if dev.use]
    except Exception as exc:
        print("cdkit: no Metal device (%s); Cycles renders on the CPU" % exc)
        return []


def new_scene(name, res=(1600, 1200), samples=128, floor_rgb=(236, 234, 232)):
    global SC
    sc = bpy.data.scenes.get(name)
    if sc:
        for o in list(sc.collection.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        sc = bpy.data.scenes.new(name)
    SC = sc
    try:
        bpy.data.orphans_purge(do_recursive=True)
    except Exception:
        pass
    r = sc.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"
    r.film_transparent = False
    c = sc.cycles
    c.device = "GPU"
    print("cdkit: cycles on %s" % (enable_gpu() or "the CPU"))
    c.samples = samples
    c.use_denoising = True
    try:
        c.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    c.max_bounces = 16
    c.transmission_bounces = 16
    c.transparent_max_bounces = 24
    c.glossy_bounces = 8
    c.diffuse_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 6.0
    c.blur_glossy = 0.6
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except Exception:
            pass
    # World: studio HDRI lights and reflects; the camera sees a clean flat backdrop.
    w = bpy.data.worlds.get(name + "_world") or bpy.data.worlds.new(name + "_world")
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI, check_existing=True)
    etc = nt.nodes.new("ShaderNodeTexCoord")
    emp = nt.nodes.new("ShaderNodeMapping")
    emp.inputs["Rotation"].default_value = (0, 0, math.radians(HDRI_ROT))
    nt.links.new(etc.outputs["Generated"], emp.inputs["Vector"])
    nt.links.new(emp.outputs["Vector"], env.inputs["Vector"])
    bg_env = nt.nodes.new("ShaderNodeBackground")
    bg_env.inputs["Strength"].default_value = 0.45
    bg_flat = nt.nodes.new("ShaderNodeBackground")
    bg_flat.inputs["Color"].default_value = lin(*floor_rgb)
    bg_flat.inputs["Strength"].default_value = BG_STRENGTH
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(env.outputs["Color"], bg_env.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg_env.outputs[0], mix.inputs[1])
    nt.links.new(bg_flat.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    sc.world = w
    for key, path in (("avenir", "/System/Library/Fonts/Avenir Next.ttc"),
                      ("din", "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"),
                      ("futura", "/System/Library/Fonts/Supplemental/Futura.ttc")):
        try:
            FONTS[key] = bpy.data.fonts.load(path, check_existing=True)
        except Exception:
            pass
    return sc


def area_light(name, loc, target, size, energy, color=(1, 1, 1), shape="RECTANGLE", size_y=None):
    l = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
    l.shape = shape
    l.size = size
    if size_y:
        l.size_y = size_y
    l.energy = energy
    l.color = color
    ob = new_obj(name, l, loc=loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def camera(name, loc, target, lens=50.0, fstop=5.6, focus=None):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    ob = new_obj(name, cam, loc=loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam.dof.focus_distance = (Vector(focus or target) - Vector(loc)).length
    SC.camera = ob
    return ob


def render(path, res=None, samples=None):
    if res:
        SC.render.resolution_x, SC.render.resolution_y = res
    if samples:
        SC.cycles.samples = samples
    SC.render.filepath = path
    if bpy.app.background:
        # --background has no window to override: render the scene by name.
        bpy.ops.render.render(write_still=True, scene=SC.name)
        return
    win = bpy.context.window_manager.windows[0]
    win.scene = SC
    with bpy.context.temp_override(window=win):
        bpy.ops.render.render(write_still=True)


def use_scene(sc):
    """Build into an existing scene (export.py runs in background mode): clear it, load the fonts."""
    global SC
    SC = sc
    for o in list(sc.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for key, path in (("avenir", "/System/Library/Fonts/Avenir Next.ttc"),
                      ("din", "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"),
                      ("futura", "/System/Library/Fonts/Supplemental/Futura.ttc")):
        try:
            FONTS[key] = bpy.data.fonts.load(path, check_existing=True)
        except Exception:
            pass
    return sc

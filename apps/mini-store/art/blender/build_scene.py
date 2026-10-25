# Dựng lại diorama "Góc phố Circle K · Đêm mưa" trong Blender từ scene.json + atlas.png
# (geometry xuất từ cùng code procedural của bản WebGL2). Chạy trong Blender: Text Editor > Run Script.
import bpy, json, math, os, random
from mathutils import Vector

D = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() and __file__ and not __file__.startswith("<") else globals().get("SCENE_DIR", "")
data = json.load(open(os.path.join(D, "scene.json")))
VS = data["vs"]


def gl2b(x, y, z):  # WebGL y-up -> Blender z-up
    return (x, -z, y)


# ---------- clean scene ----------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
    for b in list(coll):
        if b.users == 0:
            coll.remove(b)
scene = bpy.context.scene
col = bpy.data.collections.get("CircleK") or bpy.data.collections.new("CircleK")
if col.name not in scene.collection.children:
    scene.collection.children.link(col)

img_path = os.path.join(D, "atlas.png")
atlas = bpy.data.images.load(img_path, check_existing=True)
atlas.reload()
atlas.colorspace_settings.name = "sRGB"


# ---------- materials ----------
def node_mat(name, key):
    rough, metal, emis, kk = key
    wet = kk >= 16
    kind = int(kk - 16) if wet else int(kk)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, Lk = nt.nodes, nt.links
    bsdf = N.get("Principled BSDF")
    out = N.get("Material Output")
    tex = N.new("ShaderNodeTexImage"); tex.image = atlas; tex.interpolation = "Linear"; tex.location = (-700, 300)
    vc = N.new("ShaderNodeVertexColor"); vc.layer_name = "Col"; vc.location = (-700, 0)
    mul = N.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1; mul.location = (-400, 200)
    Lk.new(tex.outputs["Color"], mul.inputs[6]); Lk.new(vc.outputs["Color"], mul.inputs[7])
    base = mul.outputs[2]
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough * (0.6 if wet else 1.0)
    if kind in (2, 3, 6):  # wet ground: noise puddles -> mirror-like roughness
        tc = N.new("ShaderNodeTexCoord"); tc.location = (-1100, -300)
        nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.35; nz.inputs["Detail"].default_value = 4; nz.location = (-900, -300)
        Lk.new(tc.outputs["Object"], nz.inputs["Vector"])
        cr = N.new("ShaderNodeValToRGB"); cr.location = (-650, -300)
        cr.color_ramp.elements[0].position = 0.5; cr.color_ramp.elements[0].color = (0, 0, 0, 1)
        cr.color_ramp.elements[1].position = 0.56; cr.color_ramp.elements[1].color = (1, 1, 1, 1)
        Lk.new(nz.outputs["Fac"], cr.inputs["Fac"])
        mr = N.new("ShaderNodeMapRange"); mr.inputs[3].default_value = 0.16; mr.inputs[4].default_value = 0.02; mr.location = (-380, -300)
        Lk.new(cr.outputs["Color"], mr.inputs[0]); Lk.new(mr.outputs[0], bsdf.inputs["Roughness"])
        dk = N.new("ShaderNodeMix"); dk.data_type = "RGBA"; dk.blend_type = "MULTIPLY"; dk.inputs[0].default_value = 1; dk.location = (-200, 200)
        dk.inputs[7].default_value = (0.55, 0.55, 0.55, 1)
        Lk.new(base, dk.inputs[6]); base = dk.outputs[2]
        bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08; bump.location = (-200, -500)
        vn = N.new("ShaderNodeTexVoronoi"); vn.inputs["Scale"].default_value = 18; vn.location = (-450, -550)
        Lk.new(tc.outputs["Object"], vn.inputs["Vector"]); Lk.new(vn.outputs["Distance"], bump.inputs["Height"]); Lk.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if kind == 8:
        bsdf.inputs["Subsurface Weight"].default_value = 0.25
    if kind == 12:  # car / scooter paint: clear-coat over metallic base
        bsdf.inputs["Coat Weight"].default_value = 1.0
        bsdf.inputs["Coat Roughness"].default_value = 0.03
    Lk.new(base, bsdf.inputs["Base Color"])
    if emis > 0:
        Lk.new(base, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emis
    return m


def glass_mat():
    # Eevee: transparent + glossy (fresnel) is far more readable than full transmission for a lit shop interior
    m = bpy.data.materials.new("Kinh_uot_giot_nuoc")
    m.use_nodes = True
    nt = m.node_tree; N, Lk = nt.nodes, nt.links
    N.remove(N.get("Principled BSDF"))
    b = N.new("ShaderNodeBsdfGlossy"); b.inputs["Roughness"].default_value = 0.03; b.location = (0, -100)
    tr = N.new("ShaderNodeBsdfTransparent"); tr.inputs["Color"].default_value = (.9, .95, .94, 1); tr.location = (0, 100)
    lw = N.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.25; lw.location = (0, 300)
    mx = N.new("ShaderNodeMixShader"); mx.location = (250, 0)
    Lk.new(lw.outputs["Fresnel"], mx.inputs[0]); Lk.new(tr.outputs[0], mx.inputs[1]); Lk.new(b.outputs[0], mx.inputs[2])
    Lk.new(mx.outputs[0], N.get("Material Output").inputs["Surface"])
    tc = N.new("ShaderNodeTexCoord"); tc.location = (-900, -200)
    vn = N.new("ShaderNodeTexVoronoi"); vn.inputs["Scale"].default_value = 90; vn.inputs["Randomness"].default_value = 1; vn.location = (-700, -200)
    vn.feature = "SMOOTH_F1" if hasattr(vn, "feature") else vn.feature
    Lk.new(tc.outputs["Object"], vn.inputs["Vector"])
    cr = N.new("ShaderNodeValToRGB"); cr.location = (-480, -200)
    cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[0].color = (1, 1, 1, 1)
    cr.color_ramp.elements[1].position = 0.32; cr.color_ramp.elements[1].color = (0, 0, 0, 1)
    Lk.new(vn.outputs["Distance"], cr.inputs["Fac"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.location = (-220, -200)
    Lk.new(cr.outputs["Color"], bump.inputs["Height"]); Lk.new(bump.outputs["Normal"], b.inputs["Normal"]); Lk.new(bump.outputs["Normal"], lw.inputs["Normal"])
    return m


def build_mesh(name, part, mats_cache, glass=False):
    v, idx = part["v"], part["i"]
    nv = len(v) // VS
    verts = [gl2b(v[k * VS], v[k * VS + 1], v[k * VS + 2]) for k in range(nv)]
    norms = [gl2b(v[k * VS + 3], v[k * VS + 4], v[k * VS + 5]) for k in range(nv)]
    faces = [(idx[t], idx[t + 1], idx[t + 2]) for t in range(0, len(idx), 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    uvl = me.uv_layers.new(name="UV")
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    cols = []
    for k in range(nv):
        cols += [v[k * VS + 8], v[k * VS + 9], v[k * VS + 10], 1.0]
    ca.data.foreach_set("color", cols)
    luv = []
    for lp in me.loops:
        k = lp.vertex_index
        luv += [v[k * VS + 6], 1.0 - v[k * VS + 7]]
    uvl.data.foreach_set("uv", luv)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.normals_split_custom_set_from_vertices(norms)
    if glass:
        me.materials.append(mats_cache.setdefault("__glass", glass_mat()))
    else:
        keys = []
        for t in range(0, len(idx), 3):
            k = idx[t] * VS
            keys.append((round(v[k + 11], 2), round(v[k + 12], 2), round(v[k + 13], 2), round(v[k + 14])))
        order = {}
        for key in keys:
            if key not in order:
                order[key] = len(order)
                mk = "CK_r%.2f_m%.1f_e%.1f_k%d" % key
                me.materials.append(mats_cache.setdefault(key, node_mat(mk, key)))
        me.polygons.foreach_set("material_index", [order[k] for k in keys])
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


mats = {}
build_mesh("Diorama_CircleK", data["op"], mats)
build_mesh("Kinh_cua_hang", data["gl"], mats, glass=True)
# animated parts of the web version (sliding door leaves, moving rides) placed as instances
from mathutils import Matrix
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
NAMES = {"doorF": "Cua_truot_khung", "doorG": "Cua_truot_kinh", "car": "Taxi_XanhSM_VinFast", "carG": "Taxi_XanhSM_kinh",
         "grabAB": "Grab_AirBlade_xam", "xsmBike": "XanhSM_xe_dien", "grabScooter": "Grab_AirBlade_do",
         "wCar": "Banh_oto", "wBikeF": "Banh_xe_may_truoc", "wBikeR": "Banh_xe_may_sau", "wWaveF": "Banh_Wave_truoc", "wWaveR": "Banh_Wave_sau"}
proto, rides = {}, []
for inst in data.get("inst", []):
    n, m = inst["mesh"], inst["m"]
    W = C @ Matrix([[m[c * 4 + r] for c in range(4)] for r in range(4)]) @ C.inverted()
    if n not in proto:
        ob = proto[n] = build_mesh(NAMES.get(n, n), data["dyn"][n], mats, glass=n in data.get("glass", []))
    else:
        ob = proto[n].copy(); col.objects.link(ob)
    ob.matrix_world = W
    if n in ("car", "grabAB", "xsmBike", "grabScooter"):
        rides.append((W, 2.05 if n == "car" else 0.7))

# ---------- lights ----------
for i, (x, y, z, rad, r, g, b, fl) in enumerate(data["lights"]):
    mx = max(r, g, b, 1e-4)
    ld = bpy.data.lights.new("Den_%02d" % i, "POINT")
    ld.color = (r / mx, g / mx, b / mx)
    ld.energy = 4 * math.pi * mx * 0.9
    ld.shadow_soft_size = 0.12
    try:
        ld.use_custom_distance = True; ld.cutoff_distance = rad * 1.3
    except Exception:
        pass
    lo = bpy.data.objects.new("Den_%02d" % i, ld); lo.location = gl2b(x, y, z); col.objects.link(lo)
for i, s in enumerate(data.get("spots", [])):  # shadow-casting street lamps + shop-window spill
    c = s["col"]; mx = max(c)
    ld = bpy.data.lights.new("Spot_%d" % i, "SPOT"); ld.color = tuple(v / mx for v in c)
    ld.energy = 4 * math.pi * s["k"] * mx * 0.9; ld.spot_size = math.radians(2 * s["outer"]); ld.spot_blend = max(0.05, 1 - s["inner"] / s["outer"])
    ld.shadow_soft_size = 0.15
    so = bpy.data.objects.new("Spot_%d" % i, ld); col.objects.link(so); so.location = gl2b(*s["p"])
    so.rotation_euler = Vector(gl2b(*s["d"])).normalized().to_track_quat("-Z", "Y").to_euler()
for W, front in rides:
    fwd = (W.to_3x3() @ Vector((1, 0, 0))).normalized()
    sd = bpy.data.lights.new("Pha_xe", "SPOT"); sd.energy = 180; sd.spot_size = math.radians(60); sd.color = (1, .95, .85)
    so = bpy.data.objects.new("Pha_xe", sd); col.objects.link(so)
    so.location = W @ Vector((front, 0, 0.9))
    so.rotation_euler = (fwd + Vector((0, 0, -0.18))).to_track_quat("-Z", "Y").to_euler()

# ---------- rain streaks (static, camera-facing) ----------
cam = data["cam"]
yaw, pitch, dist, tgt = cam["yaw"], cam["pitch"], cam["dist"] * 1.12, cam["target"]
tgt = [tgt[0], tgt[1] - 0.6, tgt[2]]
eye_gl = (tgt[0] + dist * math.cos(pitch) * math.sin(yaw), tgt[1] + dist * math.sin(pitch), tgt[2] + dist * math.cos(pitch) * math.cos(yaw))
eye = Vector(gl2b(*eye_gl))
random.seed(3)
rv, rf = [], []
def roofed(x, y, z):
    return (-5 < x < 2.05 and z < .85 and y < 10.2) or (x < -4.95 and z < .45 and y < 13.3) or (-5.05 < x < 2.3 and z < 1.3 and y < 3.7)
for n in range(4500):
    x, y, z = random.uniform(-8, 8), random.uniform(0.2, 16), random.uniform(-8, 8)
    if roofed(x, y, z):
        continue
    p = Vector(gl2b(x, y, z)); ln = random.uniform(.25, .5)
    dirv = Vector((0.05, -0.02, -1)).normalized()
    side = dirv.cross((eye - p).normalized()).normalized() * 0.006
    b0 = len(rv)
    rv += [p - side, p + side, p + side + dirv * -ln * -1, p - side + dirv * -ln * -1]
    rf.append((b0, b0 + 1, b0 + 2, b0 + 3))
rme = bpy.data.meshes.new("Mua"); rme.from_pydata([tuple(q) for q in rv], [], rf); rme.update()
rm = bpy.data.materials.new("Hat_mua"); rm.use_nodes = True
nt = rm.node_tree; N = nt.nodes
for nd in list(N):
    if nd.type != "OUTPUT_MATERIAL":
        N.remove(nd)
em = N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (.6, .65, .75, 1); em.inputs["Strength"].default_value = 0.35
tr = N.new("ShaderNodeBsdfTransparent"); mx_ = N.new("ShaderNodeMixShader"); mx_.inputs[0].default_value = 0.35
nt.links.new(tr.outputs[0], mx_.inputs[1]); nt.links.new(em.outputs[0], mx_.inputs[2]); nt.links.new(mx_.outputs[0], N.get("Material Output").inputs["Surface"])
rme.materials.append(rm)
ro = bpy.data.objects.new("Mua", rme); col.objects.link(ro)

# ---------- camera / world / render ----------
cd = bpy.data.cameras.new("Camera_Diorama"); cd.sensor_fit = "VERTICAL"; cd.angle_y = data["fov"]; cd.clip_end = 200
co = bpy.data.objects.new("Camera_Diorama", cd); col.objects.link(co)
co.location = eye
co.rotation_euler = (Vector(gl2b(*tgt)) - eye).to_track_quat("-Z", "Y").to_euler()
scene.camera = co
w = scene.world or bpy.data.worlds.new("World"); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes.get("Background"); bg.inputs[0].default_value = (0.004, 0.005, 0.009, 1); bg.inputs[1].default_value = 1.0
# rainy haze: thin world volume so lamps throw visible, shadowed shafts
wn = w.node_tree.nodes; vol = wn.get("CK_Haze") or wn.new("ShaderNodeVolumePrincipled"); vol.name = "CK_Haze"
vol.inputs["Density"].default_value = 0.005; vol.inputs["Anisotropy"].default_value = 0.35
w.node_tree.links.new(vol.outputs[0], wn.get("World Output").inputs["Volume"])
for attr, val in (("volumetric_end", 70.0), ("volumetric_tile_size", "4"), ("use_volumetric_shadows", True)):
    try:
        setattr(scene.eevee, attr, val)
    except Exception:
        pass
scene.render.engine = "BLENDER_EEVEE"
ee = scene.eevee
for attr, val in (("use_raytracing", True), ("taa_render_samples", 48), ("use_shadows", True)):
    try:
        setattr(ee, attr, val)
    except Exception:
        pass
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
vs = scene.view_settings
for vt in ("ACES 2.0", "ACES 1.3", "ACES", "AgX"):
    try:
        vs.view_transform = vt
        break
    except Exception:
        continue
vs.exposure = 1.5
# bloom via compositor Glare (Blender 5 node-group compositor; older API as fallback)
try:
    ng = bpy.data.node_groups.get("CK_Bloom") or bpy.data.node_groups.new("CK_Bloom", "CompositorNodeTree")
    ng.nodes.clear()
    if not any(s_.in_out == "OUTPUT" for s_ in ng.interface.items_tree):
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers"); gn = ng.nodes.new("CompositorNodeGlare"); go = ng.nodes.new("NodeGroupOutput")
    for v_ in ("Bloom", "BLOOM"):
        try:
            gn.inputs["Type"].default_value = v_; break
        except Exception:
            pass
    gn.inputs["Threshold"].default_value = 1.0; gn.inputs["Strength"].default_value = 0.7; gn.inputs["Size"].default_value = 0.8
    ng.links.new(rl.outputs["Image"], gn.inputs["Image"]); ng.links.new(gn.outputs[0], go.inputs[0])
    scene.compositing_node_group = ng
except Exception as ex:
    print("bloom compositor skipped:", ex)
print("materials:", len(mats), "view:", vs.view_transform, "objects:", len(col.objects))

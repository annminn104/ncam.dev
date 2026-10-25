"""Collect plain-data facts about the open module .blend for contract.validate (bpy lives only here)."""
import bpy


def collect(module_id):
    layer_col = bpy.context.view_layer.layer_collection.children.get(module_id)
    facts = {
        "id": module_id,
        "collection": {"exists": layer_col is not None},
        "tris": 0,
        "textures": [],
        "objects": [],
        "actions": sorted(a.name for a in bpy.data.actions),
        "hotspots": [],
        "color_attrs": [],
        "lights": [],
        "glass": [],
        "frosted": [],
        "glow": [],
    }
    if layer_col is None:
        return facts
    col = layer_col.collection
    facts["collection"]["footprint"] = _plain(col.get("footprint"))
    facts["collection"]["role"] = col.get("role")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    images = {}
    glass = {}
    frosted = {}
    glow = {}
    for ob in col.all_objects:
        animated = bool(ob.animation_data and ob.animation_data.action)
        facts["objects"].append({"name": ob.name, "scale": list(ob.scale), "animated": animated})
        if ob.type == "EMPTY" and ob.name.startswith("HS_"):
            facts["hotspots"].append({"name": ob.name, "action": ob.get("action"), "clip": ob.get("clip")})
        if ob.type == "LIGHT":
            facts["lights"].append({"name": ob.name, "type": ob.data.type,
                                    "night_light": ob.get("night_light") in (True, 1)})
        if ob.type != "MESH":
            continue
        evaluated = ob.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        facts["tris"] += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
        facts["color_attrs"].append({"mesh": ob.name, "names": [a.name for a in ob.data.color_attributes]})
        for slot in ob.material_slots:
            if slot.material is None or slot.material.node_tree is None:
                continue
            if slot.material.name.startswith("GLASS_"):
                glass[slot.material.name] = _alpha_roughness(slot.material)
            elif slot.material.name.startswith("FROSTED_"):
                frosted[slot.material.name] = _alpha_roughness(slot.material)
            elif slot.material.name.startswith("GLOW_"):
                entry = glow.setdefault(slot.material.name, dict(_glow(slot.material), objects=[]))
                if all(seen["name"] != ob.name for seen in entry["objects"]):
                    entry["objects"].append({"name": ob.name, "night_light": ob.get("night_light") in (True, 1)})
            for node in slot.material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image is not None:
                    images[node.image.name] = list(node.image.size)
    facts["textures"] = [{"name": name, "size": size} for name, size in sorted(images.items())]
    facts["glass"] = [glass[name] for name in sorted(glass)]
    facts["frosted"] = [frosted[name] for name in sorted(frosted)]
    facts["glow"] = [glow[name] for name in sorted(glow)]
    return facts


def _alpha_roughness(mat):
    """Alpha and roughness of a GLASS_* or FROSTED_* material's Principled BSDF (None when it has none)."""
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return {"name": mat.name, "alpha": None, "roughness": None}
    return {"name": mat.name, "alpha": bsdf.inputs["Alpha"].default_value,
            "roughness": bsdf.inputs["Roughness"].default_value}


def _glow(mat):
    """Base colour, emission colour and strength of a GLOW_* material's Principled BSDF (None when it has none)."""
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return {"name": mat.name, "base_color": None, "emission": None, "strength": None}
    return {"name": mat.name, "base_color": list(bsdf.inputs["Base Color"].default_value[:3]),
            "emission": list(bsdf.inputs["Emission Color"].default_value[:3]),
            "strength": bsdf.inputs["Emission Strength"].default_value}


def _plain(value):
    """IDPropertyArray -> list; everything else unchanged (strings stay strings)."""
    return value.to_list() if hasattr(value, "to_list") else value

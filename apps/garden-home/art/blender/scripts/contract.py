"""Module contract rules (spec §6). Pure Python: no bpy, runs on Python 3.9+ and inside Blender.

validate(facts) returns ["<rule>: <detail>", ...]; an empty list means the module is valid.
`facts` is the plain dict produced by facts.collect().
"""
import re

BUDGETS = {
    "hero": {"tris": 50000, "texture": 2048},  # the tall house (villa v2 spec §12): 40k for the glass villa
    "prop": {"tris": 15000, "texture": 1024},
}
CLIP_RE = re.compile(r"^(ambient|act)_[a-z0-9_]+$")
HOTSPOT_ACTIONS = ("toggle", "play", "focus")
SCALE_EPS = 1e-4
# Glass villa spec §6: lights, glass and texture count.
LIGHT_BUDGET = {"hero": 4, "prop": 2}
LIGHT_TYPES = ("POINT", "SPOT")
TEXTURE_COUNT_MAX = 4
GLASS_ALPHA = (0.1, 0.5)
GLASS_ROUGHNESS_MAX = 0.1
# Villa v2 spec §6: frosted panels (FROSTED_*) are translucent but diffuse.
FROSTED_ALPHA = (0.4, 0.85)
FROSTED_ROUGHNESS = (0.3, 0.8)
GLASS_EPS = 1e-6  # Blender stores material inputs as float32: 0.1 reads back as 0.10000000149
# Villa v2 part 2: GLOW_* materials (the light pools under the garden lamps) only add light: the website draws them
# additively and fades them with the night, like the other night_light emissives. Their base colour is black, so
# daylight on them adds nothing either.
GLOW_BASE_MAX = 0.02


def validate(facts):
    col = facts["collection"]
    if not col["exists"]:
        return [f"collection-missing: no top-level collection named '{facts['id']}'"]
    errors = _check_collection(col)
    budget = BUDGETS.get(col.get("role"))
    if budget is not None:
        errors += _check_budget(facts, budget, col["role"])
    errors += _check_scale(facts["objects"])
    errors += _check_clips(facts["actions"])
    errors += _check_hotspots(facts["hotspots"], facts["actions"])
    errors += _check_wind(facts["color_attrs"])
    errors += _check_glass(facts["glass"])
    errors += _check_frosted(facts["frosted"])
    errors += _check_glow(facts["glow"])
    errors += _check_light_kinds(facts["lights"])
    return errors


def _is_positive_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def _check_collection(col):
    errors = []
    fp = col.get("footprint")
    if not (isinstance(fp, (list, tuple)) and len(fp) == 2 and all(_is_positive_number(v) for v in fp)):
        errors.append(f"footprint-invalid: expected [w, d] with w, d > 0, got {fp!r}")
    if col.get("role") not in BUDGETS:
        errors.append(f"role-invalid: expected 'hero' or 'prop', got {col.get('role')!r}")
    return errors


def _check_budget(facts, budget, role):
    errors = []
    if facts["tris"] > budget["tris"]:
        errors.append(f"tris-over-budget: {facts['tris']} > {budget['tris']} ({role})")
    for tex in facts["textures"]:
        w, h = tex["size"]
        if max(w, h) > budget["texture"]:
            errors.append(f"texture-too-large: {tex['name']} is {w}x{h}, max {budget['texture']} ({role})")
    if len(facts["textures"]) > TEXTURE_COUNT_MAX:
        names = [tex["name"] for tex in facts["textures"]]
        errors.append(f"texture-count-over-budget: {len(names)} textures {names}, max {TEXTURE_COUNT_MAX}")
    if len(facts["lights"]) > LIGHT_BUDGET[role]:
        names = [light["name"] for light in facts["lights"]]
        errors.append(f"lights-over-budget: {len(names)} lights {names}, max {LIGHT_BUDGET[role]} ({role})")
    return errors


def _check_scale(objects):
    return [
        f"scale-not-applied: {ob['name']} has scale {_fmt(ob['scale'])}"
        for ob in objects
        if not ob["animated"] and any(abs(s - 1.0) > SCALE_EPS for s in ob["scale"])
    ]


def _check_clips(actions):
    return [
        f"clip-name-invalid: '{name}' must match ambient_* or act_*"
        for name in actions
        if not CLIP_RE.match(name)
    ]


def _check_hotspots(hotspots, actions):
    errors = []
    for hs in hotspots:
        action = hs.get("action")
        if action not in HOTSPOT_ACTIONS:
            errors.append(f"hotspot-action-invalid: {hs['name']} action {action!r} not in {list(HOTSPOT_ACTIONS)}")
        elif action in ("toggle", "play") and hs.get("clip") not in actions:
            errors.append(f"hotspot-clip-missing: {hs['name']} ({action}) needs a clip from {actions}, got {hs.get('clip')!r}")
    return errors


def _check_wind(color_attrs):
    return [
        f"wind-not-exclusive: {ca['mesh']} has color attributes {ca['names']}, 'wind' must be the only one"
        for ca in color_attrs
        if "wind" in ca["names"] and len(ca["names"]) != 1
    ]


def _in_range(value, bounds):
    """Inclusive bounds, with GLASS_EPS slack for float32 round-trips."""
    low, high = bounds
    return low - GLASS_EPS <= value <= high + GLASS_EPS


def _check_glass(glass):
    errors = []
    for mat in glass:
        alpha, roughness = mat.get("alpha"), mat.get("roughness")
        if alpha is None or roughness is None:
            errors.append(f"glass-material-invalid: {mat['name']} has no Principled BSDF")
        elif not _in_range(alpha, GLASS_ALPHA):
            low, high = GLASS_ALPHA
            errors.append(f"glass-material-invalid: {mat['name']} alpha {alpha:g} not in [{low:g}, {high:g}]")
        elif roughness > GLASS_ROUGHNESS_MAX + GLASS_EPS:
            errors.append(f"glass-material-invalid: {mat['name']} roughness {roughness:g} > {GLASS_ROUGHNESS_MAX:g}")
    return errors


def _check_frosted(frosted):
    errors = []
    for mat in frosted:
        alpha, roughness = mat.get("alpha"), mat.get("roughness")
        if alpha is None or roughness is None:
            errors.append(f"frosted-material-invalid: {mat['name']} has no Principled BSDF")
        elif not _in_range(alpha, FROSTED_ALPHA):
            low, high = FROSTED_ALPHA
            errors.append(f"frosted-material-invalid: {mat['name']} alpha {alpha:g} not in [{low:g}, {high:g}]")
        elif not _in_range(roughness, FROSTED_ROUGHNESS):
            low, high = FROSTED_ROUGHNESS
            errors.append(f"frosted-material-invalid: {mat['name']} roughness {roughness:g} not in [{low:g}, {high:g}]")
    return errors


def _check_glow(glow):
    errors = []
    for mat in glow:
        name, base, emission, strength = mat["name"], mat.get("base_color"), mat.get("emission"), mat.get("strength")
        if base is None or emission is None or strength is None:
            errors.append(f"glow-material-invalid: {name} has no Principled BSDF")
            continue
        if strength <= 0 or max(emission) <= 0:
            errors.append(f"glow-material-invalid: {name} does not glow (emission {_fmt(emission)} x {strength:g})")
        if max(base) > GLOW_BASE_MAX + GLASS_EPS:
            errors.append(f"glow-material-invalid: {name} base colour {_fmt(base)} must be black (max "
                          f"{GLOW_BASE_MAX:g}): a glow only adds light")
        errors += [f"glow-not-night: {name} on {ob['name']} needs custom property night_light = True"
                   for ob in mat.get("objects", []) if not ob["night_light"]]
    return errors


def _check_light_kinds(lights):
    errors = []
    for light in lights:
        if light["type"] not in LIGHT_TYPES:
            errors.append(f"light-type-invalid: {light['name']} is {light['type']}, only {list(LIGHT_TYPES)} allowed")
        if not light["night_light"]:
            errors.append(f"light-not-night: {light['name']} needs custom property night_light = True")
    return errors


def _fmt(values):
    return "(" + ", ".join(f"{v:g}" for v in values) + ")"

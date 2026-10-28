"""What the garden generators (garden/build_*.py, and the pond's, pond/build_*.py) share: checking a layout, building
its PIECES merged by group and tagging what a click toggles, and writing the module (bpy).

Every group of a layout's PIECES becomes one object of that name, its pieces built into one mesh with
furniture.place_into (one draw call per material, however many pieces): the garden has hundreds of pieces and the scene
was at ~640 draw calls already. A group that holds a night kind (a lamp, the grill's coals) is a night_light object; the
light pools of the layout's POOLS (garden/lights.py) go into the object of their group; a group of SHADOWLESS gets
cast_shadow = False, which the website honours (low beds and the like: their shadow pass cost frame time).
"""
import sys

from archkit import furniture, materials, scene
from archkit.catalog import NIGHT_KINDS
from archkit.mesh import MeshBuilder

from . import interact, layout_check, lights


def pieces(col, layout, mats, builders=None):
    """One object per group of layout.PIECES, in the order the groups first appear, with the light pools of
    layout.POOLS: {group: object}. `builders` hands in MeshBuilders some groups already hold (the gravel of the
    vegetable plot under its tools), keyed by group name."""
    builders = dict(builders or {})
    for kind, group, pos, rot, *opts in layout.PIECES:
        if group not in builders:  # a builder (and its bmesh) only for a group that has none yet
            builders[group] = MeshBuilder(group)
        furniture.place_into(builders[group], kind, (tuple(pos) + (0.0,))[:3], rot, mats, **(opts[0] if opts else {}))
    for pool in getattr(layout, "POOLS", []):
        x, y = pool["center"]
        builders[pool["group"]].disc((x, y, lights.POOL_Z), pool["radius"], mats["glow_pool"],
                                     segments=lights.POOL_SEGMENTS, start=pool["start"], sweep=pool["sweep"])
    night = {group for kind, group, *_ in layout.PIECES if kind in NIGHT_KINDS}
    shadowless = set(getattr(layout, "SHADOWLESS", ()))
    return {group: mb.build(col, **({"night_light": True} if group in night else {}),
                            **({"cast_shadow": False} if group in shadowless else {}))
            for group, mb in builders.items()}


def tag(col, layout, tags=interact.tags):
    """What a click toggles (AGENTS.md, Art pipeline), as custom properties the glTF export carries as node extras; `tags`
    reads them off the layout (the pond has its own, pond/interact.py)."""
    for name, props in tags(layout).items():
        ob = col.objects[name]
        for key, value in props.items():
            ob[key] = value


def problems(layout):
    """The layout's own problems, and for an island-wide one those between the island-wide modules too."""
    found = layout_check.check(layout)
    if getattr(layout, "ISLAND_WIDE", False):
        found += layout_check.check_island(layout_check.island_layouts())
    return found


def generate(layout, build, description, default_out, check=problems, tags=interact.tags):
    """The generator's main: refuse a layout with problems (LAYOUT <module>: ... on stderr, exit 1), keep an existing
    file unless --force, else build(col, mats) into a fresh module collection, tag it and save it. `check` and `tags`
    read the problems and the click groups off the layout: the garden's by default, the pond's for the pond."""
    args = scene.generator_args(description, default_out)
    found = check(layout)
    for problem in found:
        print(f"LAYOUT {layout.MODULE_ID}: {problem}", file=sys.stderr)
    if found:
        sys.exit(1)
    if not scene.should_write(args.out, args.force):
        return
    scene.reset()
    col = scene.module_collection(layout.MODULE_ID, layout.FOOTPRINT, layout.ROLE)
    build(col, materials.palette())
    tag(col, layout, tags)
    scene.save(args.out)
    print(f"{layout.MODULE_ID}: wrote {args.out}")

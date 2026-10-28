"""The pools of warm light the garden's lamps cast on the ground at night (art/README.md, Garden), as plain data. Pure Python.

From the wallpaper camera a bollard's glowing head is a pixel or two across; what reads at 21:00 is the lawn it lights.
A pool is a flat disc of GLOW_pool POOL_Z above the ground under a lamp (MeshBuilder.disc), in the lamp's own object: a
layout lists them in POOLS and garden/assemble.py builds each into the object of its group, so the pools cost no draw
call by day and one per module at night. The website draws GLOW_* additively, faded out from the centre of the disc and
by the night factor like the lamp itself (web prepareModule, interact/effects: lights:garden switches them too). A
lantern on a gate pillar lights only the half of its disc inside the fence: the other half would hang over the rim,
glowing in the air.
"""
import math

# 1.6 m across under a bollard, 2.2 m under a gate lantern, 2 m round the stone lantern of the tea corner (part 3)
POOL_RADIUS = {"garden_lamp": 0.8, "pillar_lamp": 1.1, "stone_lantern": 1.0}
POOL_Z = 0.025  # just above the grass: the paving (4-7 cm) hides a pool where it reaches under the slabs
POOL_SEGMENTS = 12  # the triangles of a whole disc


def pool(group, kind, center, facing=None):
    """The pool of light under a lamp of `kind` standing at `center` (x, y) whose pieces are merged into `group`: the
    whole disc, or with `facing` (radians, counter-clockwise from +X) the half of it facing that way."""
    half = facing is not None
    return {"group": group, "kind": kind, "center": tuple(center[:2]), "radius": POOL_RADIUS[kind],
            "start": facing - math.pi / 2 if half else 0.0, "sweep": math.pi if half else 2 * math.pi}


def outline(pool):
    """What the pool lights of the ground, as the convex polygon (x, y) MeshBuilder.disc builds: the rim of its fan, and
    for a half disc its centre too."""
    steps = max(1, round(POOL_SEGMENTS * pool["sweep"] / (2 * math.pi)))
    whole = math.isclose(pool["sweep"], 2 * math.pi)
    (x, y), radius = pool["center"], pool["radius"]
    rim = [(x + radius * math.cos(pool["start"] + pool["sweep"] * k / steps),
            y + radius * math.sin(pool["start"] + pool["sweep"] * k / steps))
           for k in range(steps + (0 if whole else 1))]
    return rim if whole else [(x, y)] + rim

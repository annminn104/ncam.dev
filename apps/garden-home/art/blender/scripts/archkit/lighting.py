"""Night lighting (glass villa spec §4.5). Every fixture carries night_light=True: emissive meshes are dimmed by the
runtime during the day, point lights are scaled by the night factor and hidden while it is 0."""
import math

import bpy

from .mesh import MeshBuilder


def downlights(col, name, points, z, mats, radius=0.09):
    """One emissive object with a 2 cm disc hanging under a ceiling at height z for each (x, y)."""
    mb = MeshBuilder(name)
    for x, y in points:
        mb.cylinder((x, y, z - 0.02), radius, 0.02, mats["led"], segments=10)
    return mb.build(col, night_light=True)


def led_strip(col, name, start, end, z, mats, size=0.03):
    """Thin emissive bar from start to end (x, y) with its top at height z."""
    (x0, y0), (x1, y1) = start, end
    mn = (min(x0, x1) - size / 2, min(y0, y1) - size / 2, z - size)
    mx = (max(x0, x1) + size / 2, max(y0, y1) + size / 2, z)
    return MeshBuilder(name).box(mn, mx, mats["led"]).build(col, night_light=True)


def pendant(col, name, pos, ceiling_z, drop, mats):
    """Cord from the ceiling and a glowing drum shade whose bottom hangs `drop` metres below it."""
    x, y = pos
    mb = MeshBuilder(name)
    mb.cylinder((x, y, ceiling_z - drop + 0.25), 0.006, drop - 0.25, mats["frame"], segments=6)
    mb.cylinder((x, y, ceiling_z - drop), 0.22, 0.25, mats["led"], segments=16)
    return mb.build(col, night_light=True)


BULB_RADIUS = 0.03
WIRE_RADIUS = 0.004
WIRE_PIECE = 1.0  # a sagging wire is cut into pieces about this long, so it can hang in a curve


def string_lights(col, name, points, mats, bulbs_per_m=4.0, sag=0.15, bulb_radius=BULB_RADIUS):
    """One emissive object: a thin dark wire through the anchor points (x, y, z) with small bulbs (8-triangle octahedra)
    along it, for pergolas, trees and poles.

    Each span between two anchors hangs in a parabola, `sag` times the span's length lower at its middle than the
    straight line (0.15: a 4 m span droops 0.6 m; 0 pulls it taut, one straight piece of wire), and carries
    length * bulbs_per_m bulbs rounded half up, at least one, spread evenly along it and never on the anchors. A span's
    length is the straight distance between its anchors. `bulb_radius` sizes the bulbs at no cost in triangles: festoon
    bulbs by default, bigger globes read from further away (a house seen from the wallpaper camera)."""
    if len(points) < 2:
        raise ValueError(f"{name}: string lights need at least two anchor points, got {len(points)}")
    spans = list(zip(points, points[1:]))
    if any(math.dist(a, b) < 1e-6 for a, b in spans):
        raise ValueError(f"{name}: two neighbouring anchor points coincide")
    mb = MeshBuilder(name)
    for a, b in spans:
        length = math.dist(a, b)

        def at(t):
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                    a[2] + (b[2] - a[2]) * t - sag * length * 4 * t * (1 - t))

        pieces = 1 if sag == 0 else max(4, math.ceil(length / WIRE_PIECE))
        for i in range(pieces):
            mb.stem(at(i / pieces), at((i + 1) / pieces), WIRE_RADIUS, mats["frame"], segments=3)
        bulbs = max(1, int(length * bulbs_per_m + 0.5))
        for i in range(bulbs):
            mb.octahedron(at((i + 0.5) / bulbs), bulb_radius, mats["led"])
    return mb.build(col, night_light=True)


def point_light(col, name, pos, energy, color=(1.0, 0.58, 0.3), radius=0.3):
    """Warm point light (~3000 K in linear RGB, so rooms read amber against the blue night). export_module.py exports lights in RAW mode, so `energy` reaches three.js unchanged as the
    PointLight intensity (spec §13 V2: the default SPEC mode turns 60 W into 3261 cd, far too bright)."""
    data = bpy.data.lights.new(name, "POINT")
    data.energy = energy
    data.color = color
    data.shadow_soft_size = radius
    data.use_shadow = False
    ob = bpy.data.objects.new(name, data)
    ob.location = pos
    ob["night_light"] = True
    col.objects.link(ob)
    return ob

"""The floating island the yard stands on: the rim of its flat grass top as plain data. Pure Python.

`island` is a dict like zones.ISLAND: "size" (w, d) bounds the top, "exponent" shapes the superellipse
|x / (w/2)|^n + |y / (d/2)|^n = 1 (2 is an ellipse, higher is squarer), "rim" is the number of rim vertices, "jitter"
the largest share of the radius a rim vertex is pulled in by, "seed" seeds that jitter and "depth" is how far below the
top the rock tip hangs (only the Blender generator reads it). The jitter only ever pulls vertices in, so the rim stays
inside the w x d box: the yard module's footprint. make_placeholders builds this very rim and zones_check tests the
zones, trees and lamp against it, so the check sees the island that is built.
"""
import math
import random

EPS = 1e-9
# The zone of a slot that takes the whole island (siteplan/zones.py): a garden module that stands at the island's
# centre and spreads its content over it (the fence round the rim, the paths, the flower beds), checked by its own
# layout check.
ISLAND_WIDE = "island"


def superellipse_radius(angle, size, exponent):
    """Distance from the centre to the w x d superellipse of `exponent` in direction `angle` (radians)."""
    c = abs(math.cos(angle)) / (size[0] / 2)
    s = abs(math.sin(angle)) / (size[1] / 2)
    return (c ** exponent + s ** exponent) ** (-1.0 / exponent)


def outline(island):
    """Rim of the top: `rim` (x, y) points, counter-clockwise from +X, equally spaced in angle, seeded jitter."""
    rnd = random.Random(island["seed"])
    count = island["rim"]
    points = []
    for k in range(count):
        angle = 2 * math.pi * k / count
        radius = superellipse_radius(angle, island["size"], island["exponent"]) * (1 - island["jitter"] * rnd.random())
        points.append((radius * math.cos(angle), radius * math.sin(angle)))
    return points


def contains(polygon, point):
    """Even-odd test: True when `point` lies inside the closed `polygon` (a list of (x, y))."""
    x, y = point
    inside = False
    for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


def _side(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _cross(p, q, r, s):
    """True when segments pq and rs properly cross (touching ends do not count)."""
    return (_side(r, s, p) * _side(r, s, q) < -EPS) and (_side(p, q, r) * _side(p, q, s) < -EPS)


def contains_rect(polygon, rect):
    """True when the rect (x0, y0, x1, y1) lies inside `polygon`: its corners are inside and no rim edge cuts it (a
    rim that is not convex can bite into a rect between two corners)."""
    x0, y0, x1, y1 = rect
    corners = ((x0, y0), (x1, y0), (x1, y1), (x0, y1))
    if not all(contains(polygon, corner) for corner in corners):
        return False
    edges = list(zip(corners, corners[1:] + corners[:1]))
    rim = list(zip(polygon, polygon[1:] + polygon[:1]))
    return not any(_cross(p, q, r, s) for p, q in edges for r, s in rim)

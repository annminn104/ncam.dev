"""What the garden's pieces take of the ground, as convex polygons (lists of (x, y), either winding), and the tests on
them: a rectangle, a turned square (a fence post), a band along a line (a fence board, a gate leaf), overlap by
separating axes (interiors only: shapes that touch do not overlap), distances and lying inside the island's rim. Pure
Python.
"""
import math

from siteplan.island import contains

EPS = 1e-6


def rect(center, size):
    """The w x d rectangle centred on `center`."""
    (x, y), (w, d) = center, size
    return [(x - w / 2, y - d / 2), (x + w / 2, y - d / 2), (x + w / 2, y + d / 2), (x - w / 2, y + d / 2)]


def box(bounds):
    """The rectangle (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = bounds
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def square(center, size, yaw):
    """A size x size square centred on `center`, turned `yaw` radians."""
    (x, y), half = center, size / 2
    cos, sin = math.cos(yaw), math.sin(yaw)
    return [(x + half * (cos * u - sin * v), y + half * (sin * u + cos * v))
            for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


def band(a, b, half):
    """The rectangle `half` metres either side of the line from a to b."""
    length = math.dist(a, b)
    nx, ny = -(b[1] - a[1]) / length * half, (b[0] - a[0]) / length * half
    return [(a[0] - nx, a[1] - ny), (b[0] - nx, b[1] - ny), (b[0] + nx, b[1] + ny), (a[0] + nx, a[1] + ny)]


def bounds(shape):
    xs, ys = zip(*shape)
    return (min(xs), min(ys), max(xs), max(ys))


def _axes(shape):
    for (x0, y0), (x1, y1) in zip(shape, shape[1:] + shape[:1]):
        yield (y0 - y1, x1 - x0)


def overlap(p, q):
    """True when the interiors of the convex polygons p and q overlap: no edge normal of either separates them."""
    for ax, ay in list(_axes(p)) + list(_axes(q)):
        length = math.hypot(ax, ay)
        if length < EPS:
            continue
        pa = [(x * ax + y * ay) / length for x, y in p]
        qa = [(x * ax + y * ay) / length for x, y in q]
        if max(pa) <= min(qa) + EPS or max(qa) <= min(pa) + EPS:
            return False
    return True


def distance(shape, point):
    """How far `point` is from the convex polygon (0 inside it)."""
    if overlap(shape, square(point, 2 * EPS, 0.0)):
        return 0.0
    px, py = point
    best = math.inf
    for (x0, y0), (x1, y1) in zip(shape, shape[1:] + shape[:1]):
        dx, dy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy or 1.0)))
        best = min(best, math.hypot(px - x0 - t * dx, py - y0 - t * dy))
    return best


def gap(p, q):
    """The clear distance between two convex polygons (0 when they touch or overlap)."""
    if overlap(p, q):
        return 0.0
    return min(min(distance(p, corner) for corner in q), min(distance(q, corner) for corner in p))


def _cross(p, q, r, s):
    def side(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    return side(r, s, p) * side(r, s, q) < -EPS and side(p, q, r) * side(p, q, s) < -EPS


def inside_rim(shape, rim):
    """True when the polygon lies inside the rim: its corners are inside and no rim edge cuts one of its edges."""
    if not all(contains(rim, corner) for corner in shape):
        return False
    edges = list(zip(shape, shape[1:] + shape[:1]))
    return not any(_cross(p, q, r, s) for p, q in edges for r, s in zip(rim, rim[1:] + rim[:1]))

"""The shape of the koi pond (villa v2 part 3) and the tests on it. Pure Python.

The pond is dug into the lawn. Its outline, where the grass ends, is a smooth irregular blob: round a centre, its radius
in each direction is an ellipse bent by a few harmonics (blob), sampled into a polygon. The radius never folds back, so
the outline is star-shaped round its centre and every point of the basin lies on one ring, the outline scaled towards
the centre by its share (share, ring): the bank and the floor follow a profile of (share, height) down to the deepest
middle, which depth_at reads back for any point. Distances are to the outline as a closed polyline.
"""
import bisect
import math

from siteplan.island import contains  # noqa: F401  (even-odd: True when a point lies inside a polygon)

EPS = 1e-9


def blob(centre, radii, harmonics, count):
    """`count` points (x, y) counter-clockwise from +X round `centre`: in direction a the radius of the ellipse of
    `radii` times 1 + the sum of amplitude * cos(k * a + phase) over the harmonics (k, amplitude, phase)."""
    (cx, cy), (rx, ry) = centre, radii
    points = []
    for i in range(count):
        a = 2 * math.pi * i / count
        ellipse = 1.0 / math.sqrt((math.cos(a) / rx) ** 2 + (math.sin(a) / ry) ** 2)
        bend = 1.0 + sum(amplitude * math.cos(k * a + phase) for k, amplitude, phase in harmonics)
        points.append((cx + ellipse * bend * math.cos(a), cy + ellipse * bend * math.sin(a)))
    return points


def ring(outline, centre, share):
    """The outline scaled by `share` towards `centre`."""
    cx, cy = centre
    return [(cx + (x - cx) * share, cy + (y - cy) * share) for x, y in outline]


def share(outline, centre, point):
    """The ring `point` lies on: its distance from `centre` over the outline's radius in its direction (0 at the
    centre, 1 on the outline, more outside it)."""
    cx, cy = centre
    px, py = point[0] - cx, point[1] - cy
    reach = math.hypot(px, py)
    if reach < EPS:
        return 0.0
    ux, uy = px / reach, py / reach
    for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]):
        ax, ay, bx, by = x0 - cx, y0 - cy, x1 - cx, y1 - cy
        # the ray t * (ux, uy) meets the edge a + s * (b - a), 0 <= s <= 1, at t > 0
        dx, dy = bx - ax, by - ay
        det = dx * uy - dy * ux
        if abs(det) < EPS:
            continue
        s = (ax * uy - ay * ux) / -det
        t = (ax * dy - ay * dx) / -det
        if -EPS <= s <= 1 + EPS and t > EPS:
            return reach / t
    raise ValueError(f"no edge of the outline lies in the direction of {point}: is it round {centre}?")


def share_finder(outline, centre):
    """share() for many points of one outline, quicker: its corners sorted by their direction from `centre` once, the
    edge in a point's direction found by bisection. The outline must be star-shaped round `centre`."""
    cx, cy = centre
    corners = sorted((math.atan2(y - cy, x - cx), x - cx, y - cy) for x, y in outline)
    angles = [a for a, _, _ in corners]

    def find(point):
        px, py = point[0] - cx, point[1] - cy
        reach = math.hypot(px, py)
        if reach < EPS:
            return 0.0
        k = bisect.bisect_right(angles, math.atan2(py, px))
        (_, ax, ay), (_, bx, by) = corners[k - 1], corners[k % len(corners)]
        ux, uy, dx, dy = px / reach, py / reach, bx - ax, by - ay
        return reach * (dx * uy - dy * ux) / (ay * dx - ax * dy)  # reach / t, t as in share()

    return find


def height(profile, s):
    """The height of the bank or floor on the ring of share `s`, read off `profile` [(share, z), ...] (shares falling);
    the last height holds in the middle, the first beyond the outermost ring."""
    if s >= profile[0][0]:
        return profile[0][1]
    for (s0, z0), (s1, z1) in zip(profile, profile[1:]):
        if s1 <= s <= s0:
            return z1 + (z0 - z1) * (s - s1) / (s0 - s1)
    return profile[-1][1]


def depth_at(outline, centre, profile, point):
    """The height of the bank or floor at `point`, read off `profile` by the ring it lies on (height)."""
    return height(profile, share(outline, centre, point))


def to_outline(outline, point):
    """How far `point` is from the outline (a closed polyline), inside or out."""
    best = math.inf
    px, py = point
    for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]):
        dx, dy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(px - x0 - t * dx, py - y0 - t * dy))
    return best


def perimeter(outline):
    return sum(math.dist(a, b) for a, b in zip(outline, outline[1:] + outline[:1]))


def along(outline, at):
    """The point `at` metres along the closed counter-clockwise outline from its first point, and the outward normal
    of the edge it lies on."""
    at %= perimeter(outline)
    for a, b in zip(outline, outline[1:] + outline[:1]):
        length = math.dist(a, b)
        if at <= length:
            ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
            return (a[0] + ux * at, a[1] + uy * at), (uy, -ux)  # the right of a counter-clockwise edge: outwards
        at -= length
    raise AssertionError("unreachable: `at` is reduced modulo the perimeter")

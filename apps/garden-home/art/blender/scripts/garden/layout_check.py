"""Sanity checks on a garden layout before any geometry is built (villa v2 part 2). Pure Python.

check(layout) returns human-readable problems; an empty list means the module is buildable. A garden layout provides
MODULE_ID, FOOTPRINT and PIECES, entries (kind, group, pos, rot[, options]) whose pos is (x, y) on the ground or
(x, y, z) with the height it stands at: a floor under it (a terrace's paving) below RAISED, or the top of what it stands
on above (a lantern on a gate pillar), which takes no ground of its own; the pieces of a group are merged into one
object of that name (garden/assemble.py). SHAPES, (label, convex polygon) of what else it builds on the ground, is
optional; SHAPES_MEET says they join one another (a fence board runs into its posts), so they are not checked against
each other. The rules:

- every piece is a known kind at a catalog rotation, and takes wind only if it is a plant of catalog.WIND_SPANS;
- a group that glows (a night kind) holds nothing that does not, and a group a click toggles (garden/interact.py) holds
  only pieces of that one interact group, whose id matches interact.GROUP_RE;
- the pieces on the ground and the SHAPES do not overlap one another (a parasol, OVERHEAD, shades what stands under it);
- an island-wide layout (ISLAND_WIDE: site space) keeps everything inside the island's rim (siteplan/island.outline),
  out of every zone but its ZONES_USED (the zones reserved for parts 3-4 included), and CLEAR metres off the yard's
  trees and lamp; any other layout (module space) keeps everything inside its footprint, its STRING_LIGHTS' anchors too;
- the light pools of POOLS (garden/lights.py), flat on the ground under what they light, stay on the island (inside the
  footprint for a layout in module space);
- a walk (WALK, STONES, GATE_LINES, WALK_GATE, DOOR): neighbouring slabs at most MAX_GAP apart, the first one within
  GATE_REACH of its gate's line, the last one at the door; a driveway (DRIVEWAY, DRIVE_GATE): its front within
  GATE_REACH of its gate's line, reaching back to the carport zone, through its apron (APRON, if it has one) which
  starts on its back edge.

check_island(layouts) adds the rules between the island-wide modules: nothing one builds on the ground overlaps what
another does, and, with the fence among them, every gate of the fence (GATES) leads to the walk or to the driveway, the
walk coming in through a walk gate and the driveway through a car gate.
"""
import math

from archkit.catalog import FURNITURE, NIGHT_KINDS, ROTATIONS, WIND_SPANS, footprint
from siteplan import island, zones

from . import interact, lights, shapes

EPS = 1e-6
CLEAR = 0.35  # metres kept free round the trunks of the yard's trees and its lamp post
# A parasol's canopy spreads over what it shades: its footprint only has to stay on the island, in the footprint and
# out of the zones; it does not clash with the pieces under it.
OVERHEAD = frozenset({"parasol"})
RAISED = 0.3  # a piece standing this high or higher stands on another piece, not on the ground
GATE_REACH = 0.5  # the walk's first slab and the driveway's front start this close to their gate's line, at most


def pieces(layout):
    """(label, kind, group, (x, y, z), rot, options) of every piece; a label numbers the pieces of its group from 1."""
    counts = {}
    found = []
    for kind, group, pos, rot, *opts in layout.PIECES:
        counts[group] = counts.get(group, 0) + 1
        place = (tuple(pos) + (0.0,))[:3]
        found.append((f"{group} #{counts[group]}", kind, group, place, rot, opts[0] if opts else {}))
    return found


def ground(layout):
    """(label, polygon) of what the layout builds on the ground: its pieces below RAISED (catalog footprints), then
    SHAPES."""
    found = [(f"{label} ({kind})", shapes.rect((x, y), footprint(kind, rot)))
             for label, kind, _, (x, y, z), rot, _ in pieces(layout)
             if kind in FURNITURE and rot in ROTATIONS and z < RAISED]
    return found + list(getattr(layout, "SHAPES", []))


def _check_pieces(layout):
    problems = []
    kinds = {}
    for label, kind, group, _, rot, opts in pieces(layout):
        kinds.setdefault(group, []).append(kind)
        if kind not in FURNITURE:
            problems.append(f"{label}: unknown kind '{kind}'")
            continue
        if rot not in ROTATIONS:
            problems.append(f"{label} ({kind}): rotation must be one of {list(ROTATIONS)}, got {rot}")
        if "wind" in opts and kind not in WIND_SPANS:
            problems.append(f"{label}: {kind} does not sway, wind is for {sorted(WIND_SPANS)}")
    for group, members in kinds.items():
        glowing = sorted({kind for kind in members if kind in NIGHT_KINDS})
        still = sorted({kind for kind in members if kind not in NIGHT_KINDS})
        if glowing and still:
            problems.append(f"group {group} mixes lights ({', '.join(glowing)}) with pieces that do not glow "
                            f"({', '.join(still)})")
        toggled = {interact.GROUPS.get(kind) for kind in members}
        if len(toggled) > 1 and toggled - {None}:
            problems.append(f"group {group} mixes what a click toggles ({', '.join(sorted(toggled - {None}))}) with "
                            f"other pieces")
    for name, props in interact.tags(layout).items():
        if not interact.GROUP_RE.match(props["interact"]):
            problems.append(f"{name}: group '{props['interact']}' must match {interact.GROUP_RE.pattern}")
    return problems


def _check_overlaps(layout, items):
    meet = getattr(layout, "SHAPES_MEET", False)
    shaped = {label for label, _ in getattr(layout, "SHAPES", [])}
    overhead = {f"{label} ({kind})" for label, kind, *_ in pieces(layout) if kind in OVERHEAD}
    problems = []
    for i, (a, pa) in enumerate(items):
        for b, pb in items[i + 1:]:
            if (meet and a in shaped and b in shaped) or a in overhead or b in overhead:
                continue
            if shapes.overlap(pa, pb):
                problems.append(f"{a} overlaps {b}")
    return problems


def _check_site(layout, items):
    """An island-wide layout: on the island, out of the zones it does not use, clear of the yard's trees and lamp."""
    rim = island.outline(zones.ISLAND)
    used = set(getattr(layout, "ZONES_USED", ()))
    problems = []
    for label, shape in items:
        if not shapes.inside_rim(shape, rim):
            problems.append(f"{label} is outside the island")
        for zone, ((x0, y0), (x1, y1)) in sorted(zones.ZONES.items()):
            if zone not in used and shapes.overlap(shape, shapes.box((x0, y0, x1, y1))):
                problems.append(f"{label} is in zone '{zone}'")
        for what, (x, y) in [("tree", tree) for tree in zones.TREES] + [("lamp", zones.LAMP)]:
            if shapes.distance(shape, (x, y)) < CLEAR - EPS:
                problems.append(f"{label} is closer than {CLEAR:g} m to the {what} at ({x:g}, {y:g})")
    return problems


def _check_footprint(layout, items):
    w, d = layout.FOOTPRINT
    problems = []
    for label, shape in items:
        x0, y0, x1, y1 = shapes.bounds(shape)
        if x0 < -w / 2 - EPS or y0 < -d / 2 - EPS or x1 > w / 2 + EPS or y1 > d / 2 + EPS:
            problems.append(f"{label} sticks out of the {w:g} x {d:g} m footprint")
    return problems


def _to_line(point, line):
    """Distance from `point` to the segment `line` (a, b)."""
    return shapes.distance(shapes.band(line[0], line[1], EPS), point)


def _check_walk(layout):
    stones = layout.STONES
    problems = []
    for k, (a, b) in enumerate(zip(stones, stones[1:]), start=1):
        gap = shapes.gap(a, b)
        if gap > layout.MAX_GAP + EPS:
            problems.append(f"walk: {gap:.2f} m of grass between stones {k} and {k + 1}, "
                            f"more than {layout.MAX_GAP:g} m")
    gate = layout.GATE_LINES[layout.WALK_GATE]
    reach = min(_to_line(corner, gate) for corner in stones[0])
    if reach > GATE_REACH + EPS:
        problems.append(f"walk: the first stone is {reach:.2f} m from {layout.WALK_GATE}, more than {GATE_REACH:g} m")
    if _to_line(layout.WALK[0], gate) > EPS:
        problems.append(f"walk: it does not start on the line of {layout.WALK_GATE}")
    if shapes.distance(stones[-1], layout.DOOR) > 0.01:
        x, y = layout.DOOR
        problems.append(f"walk: the last stone does not reach the door at ({x:g}, {y:g})")
    return problems


def _check_driveway(layout):
    gate = layout.GATE_LINES[layout.DRIVE_GATE]
    problems = []
    reach = max(_to_line(corner, gate) for corner in layout.DRIVEWAY[:2])
    if reach > GATE_REACH + EPS:
        problems.append(f"driveway: its front is {reach:.2f} m from {layout.DRIVE_GATE}, more than {GATE_REACH:g} m")
    apron = getattr(layout, "APRON", None)
    if apron is not None:
        _, _, _, end = shapes.bounds(layout.DRIVEWAY)
        back = sorted(corner for corner in layout.DRIVEWAY if abs(corner[1] - end) < EPS)
        if sorted(apron[:2]) != back:
            problems.append("driveway: its apron does not start at its end")
    carport = zones.ZONES["carport"][0][1]
    if shapes.bounds(layout.DRIVEWAY if apron is None else apron)[3] < carport - EPS:
        problems.append(f"driveway: it stops short of the carport zone (y {carport:g})")
    return problems


def _check_pools(layout):
    """The pools of light lie flat under everything: they need only stay on the island, or in the footprint."""
    counts = {}
    found = []
    for pool in getattr(layout, "POOLS", []):
        counts[pool["group"]] = counts.get(pool["group"], 0) + 1
        found.append((f"{pool['group']} pool {counts[pool['group']]}", lights.outline(pool)))
    if not getattr(layout, "ISLAND_WIDE", False):
        return _check_footprint(layout, found)
    rim = island.outline(zones.ISLAND)
    return [f"{label} is outside the island" for label, shape in found if not shapes.inside_rim(shape, rim)]


def check(layout):
    items = ground(layout)
    problems = _check_pieces(layout) + _check_overlaps(layout, items)
    anchors = [(f"{string['name']} anchor {k}", shapes.square(point[:2], 2 * EPS, 0.0))
               for string in getattr(layout, "STRING_LIGHTS", []) for k, point in enumerate(string["points"], start=1)]
    if getattr(layout, "ISLAND_WIDE", False):
        problems += _check_site(layout, items)
    else:
        raised = [(f"{label} ({kind})", shapes.rect((x, y), footprint(kind, rot)))
                  for label, kind, _, (x, y, z), rot, _ in pieces(layout)
                  if kind in FURNITURE and rot in ROTATIONS and z >= RAISED]
        problems += _check_footprint(layout, items + raised + anchors)
    problems += _check_pools(layout)
    if hasattr(layout, "WALK"):
        problems += _check_walk(layout)
    if hasattr(layout, "DRIVEWAY"):
        problems += _check_driveway(layout)
    return problems


def check_island(layouts):
    """The rules between the island-wide modules (see the module docstring)."""
    items = [(layout.MODULE_ID, label, shape) for layout in layouts for label, shape in ground(layout)]
    problems = []
    for i, (module_a, a, pa) in enumerate(items):
        for module_b, b, pb in items[i + 1:]:
            if module_a != module_b and shapes.overlap(pa, pb):
                problems.append(f"{a} ({module_a}) overlaps {b} ({module_b})")
    gates = {gate["name"]: gate["kind"] for layout in layouts for gate in getattr(layout, "GATES", ())}
    if not gates:  # no fence among them
        return problems
    entries = [(name, kind) for layout in layouts
               for name, kind in ((getattr(layout, "WALK_GATE", None), "walk"),
                                  (getattr(layout, "DRIVE_GATE", None), "car"))
               if name is not None]
    for name, kind in entries:
        if gates.get(name) != kind:
            problems.append(f"the {'walk' if kind == 'walk' else 'driveway'} comes in through {name}, which is not a "
                            f"{kind} gate of the fence")
    for name in sorted(set(gates) - {name for name, _ in entries}):
        problems.append(f"gate {name} leads to no path")
    return problems


def island_layouts():
    """The island-wide garden layouts, which check_island checks together."""
    from . import beds_layout, fence_layout, paths_layout
    return [fence_layout, paths_layout, beds_layout]

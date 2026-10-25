"""Sanity checks on the yard zones before the placeholder yard is built (villa v2 spec §4). Pure Python.

check(zones) returns human-readable problems; an empty list means the plan is consistent. `zones` is a module (or any
object) providing YARD, ISLAND, ZONES, SLOTS, TREES and LAMP. `island` replaces zones.ISLAND when the island that is
actually built has another size (make_placeholders --yard-size): zones, trees and the lamp must stand on its rim. A slot
in zone island.ISLAND_WIDE spreads a garden module over the whole island in site space: it stands at the centre (0, 0),
unturned, with the planned island's size (zones.ISLAND, whatever island is built) as its footprint, and the module's own
layout check places its content. A zone holds one slot, but for a slot of ZONE_SHARED (optional), which stands in the
place of the slot it names, in its zone: the basement under the house (villa v2 spec §12 "Basement").
"""
import math

from siteplan.island import ISLAND_WIDE, contains, contains_rect, outline

EPS = 1e-6


def _rect(zone):
    (x0, y0), (x1, y1) = zone
    return (x0, y0, x1, y1)


def _inside(inner, outer):
    return (inner[0] >= outer[0] - EPS and inner[1] >= outer[1] - EPS
            and inner[2] <= outer[2] + EPS and inner[3] <= outer[3] + EPS)


def _overlap(a, b):
    """Interiors only: zones that share an edge do not overlap."""
    return a[0] < b[2] - EPS and b[0] < a[2] - EPS and a[1] < b[3] - EPS and b[1] < a[3] - EPS


def _turned(pos, footprint, yaw):
    """Axis-aligned bounds of a w x d footprint centred on pos after turning it by yaw degrees."""
    (x, y), (w, d), angle = pos, footprint, math.radians(yaw)
    cos, sin = abs(math.cos(angle)), abs(math.sin(angle))
    half_w, half_d = (w * cos + d * sin) / 2, (w * sin + d * cos) / 2
    return (x - half_w, y - half_d, x + half_w, y + half_d)


def _check_spread(slot, spec, size):
    """An island-wide slot: its module is laid out in site space on the planned island (zones.ISLAND), so the slot
    stands at the island's centre, unturned, with the island's size as its footprint."""
    problems = []
    what = f"slot '{slot}' ({spec['module']}) spreads over the island:"
    x, y = spec["pos"]
    if abs(x) > EPS or abs(y) > EPS:
        problems.append(f"{what} it must stand at (0, 0), got ({x:g}, {y:g})")
    if abs(spec["yaw"]) > EPS:
        problems.append(f"{what} its yaw must be 0, got {spec['yaw']:g}")
    (w, d), (island_w, island_d) = spec["footprint"], size
    if abs(w - island_w) > EPS or abs(d - island_d) > EPS:
        problems.append(f"{what} its footprint must be the {island_w:g} x {island_d:g} m island, got {w:g} x {d:g}")
    return problems


def _check_shared(zones):
    """Every zone holds one slot (the island-wide ones aside), but for the slots of ZONE_SHARED, each of which stands
    where the slot it names does: in its zone, at its position and yaw, with its footprint."""
    shared = getattr(zones, "ZONE_SHARED", {})
    problems = []
    for slot, partner in sorted(shared.items()):
        if slot not in zones.SLOTS or partner not in zones.SLOTS:
            problems.append(f"ZONE_SHARED: slot '{slot}' or '{partner}' is not in SLOTS")
            continue
        spec, other = zones.SLOTS[slot], zones.SLOTS[partner]
        what = f"slot '{slot}' ({spec['module']}) shares the place of '{partner}':"
        if spec["zone"] != other["zone"]:
            problems.append(f"{what} it must be in zone '{other['zone']}'")
        elif (tuple(spec["pos"]) != tuple(other["pos"]) or abs(spec["yaw"] - other["yaw"]) > EPS
              or tuple(spec["footprint"]) != tuple(other["footprint"])):
            (x, y), (w, d) = other["pos"], other["footprint"]
            problems.append(f"{what} it must stand at ({x:g}, {y:g}), yaw {other['yaw']:g}, with its {w:g} x {d:g} m "
                            f"footprint")
    by_zone = {}
    for slot in sorted(zones.SLOTS):
        zone = zones.SLOTS[slot]["zone"]
        if zone != ISLAND_WIDE and slot not in shared:
            by_zone.setdefault(zone, []).append(slot)
    for zone, slots in sorted(by_zone.items()):
        if len(slots) > 1:
            names = " and ".join(f"'{slot}'" for slot in slots)
            problems.append(f"zone '{zone}' holds slots {names}: only ZONE_SHARED slots share a zone")
    return problems


def check(zones, island=None):
    problems = []
    yard_w, yard_d = zones.YARD
    bounds = (-yard_w / 2, -yard_d / 2, yard_w / 2, yard_d / 2)
    island = zones.ISLAND if island is None else island
    rim = outline(island)  # the jittered rim make_placeholders builds, not the smooth squircle
    island_w, island_d = island["size"]
    rects = {name: _rect(zone) for name, zone in zones.ZONES.items()}
    names = sorted(rects)
    for name in names:
        if not _inside(rects[name], bounds):
            problems.append(f"zone '{name}' extends outside the {yard_w:g} x {yard_d:g} m yard")
        if not contains_rect(rim, rects[name]):
            problems.append(f"zone '{name}' extends outside the {island_w:g} x {island_d:g} m island")
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if _overlap(rects[a], rects[b]):
                problems.append(f"zones '{a}' and '{b}' overlap")

    for slot in sorted(zones.SLOTS):
        spec = zones.SLOTS[slot]
        if spec["zone"] == ISLAND_WIDE:  # a garden module spread over the island: its layout check places its content
            problems += _check_spread(slot, spec, zones.ISLAND["size"])
        elif spec["zone"] not in rects:
            problems.append(f"slot '{slot}': unknown zone '{spec['zone']}'")
        elif not _inside(_turned(spec["pos"], spec["footprint"], spec["yaw"]), rects[spec["zone"]]):
            problems.append(f"slot '{slot}' ({spec['module']}) sticks out of zone '{spec['zone']}'")
    problems += _check_shared(zones)

    props = [("tree", p) for p in zones.TREES] + [("lamp", zones.LAMP)]
    for what, (x, y) in props:
        if not _inside((x, y, x, y), bounds):
            problems.append(f"{what} at ({x:g}, {y:g}) is outside the yard")
        if not contains(rim, (x, y)):
            problems.append(f"{what} at ({x:g}, {y:g}) is outside the island")
        for name in names:
            if _inside((x, y, x, y), rects[name]):
                problems.append(f"{what} at ({x:g}, {y:g}) is inside zone '{name}'")
    return problems

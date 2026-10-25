"""Where the treads of a spiral stair go (the tall house's open stair, catalog.SPIRAL_STAIR). Pure Python:
furniture/stairs.py builds the stair from this list and the house layout (system Python) checks the headroom under the
gallery's landing and the roof's with it, so both read the same function.

Angles are radians counter-clockwise from +X about the column, in the stair's own space (front facing -Y). One climbs
counter-clockwise: the top tread ends on the +X axis, so its leading edge runs along +X and one steps off it towards
+Y, onto the landing behind the stair; a turn and a quarter below, the first tread starts on the -Y side, the front.
An upper flight (flights) climbs on round the same column from a quarter-turn landing after that top tread.
"""
import math


def treads(rise, count, turns, end=0.0, base=0.0):
    """(start angle, end angle, top) of each of `count` wedge treads from the bottom: they share the `turns` full turns
    of the flight evenly, edge to edge, the last ending at angle `end`; tread i's top is base + (i + 1) * rise / count,
    so the top tread is flush with the floor `rise` above `base`. ValueError unless rise, count and turns are
    positive."""
    if rise <= 0 or count <= 0 or turns <= 0:
        raise ValueError(f"a spiral stair needs a positive rise, tread count and turns, got {rise}, {count}, {turns}")
    sweep = 2 * math.pi * turns / count
    start = end - count * sweep
    return [(start + i * sweep, start + (i + 1) * sweep, base + rise * (i + 1) / count) for i in range(count)]


def flights(rise, count, turns, upper=None):
    """The treads of the stair: its flight (treads), then, with `upper` ({"rise", "treads", "turns"}), the upper flight,
    which starts a quarter turn after the top tread (the landing it leaves from) at the top tread's height."""
    lower = treads(rise, count, turns)
    if upper is None:
        return lower
    start = lower[-1][1] + math.pi / 2
    end = start + 2 * math.pi * upper["turns"]
    return lower + treads(upper["rise"], upper["treads"], upper["turns"], end=end, base=rise)

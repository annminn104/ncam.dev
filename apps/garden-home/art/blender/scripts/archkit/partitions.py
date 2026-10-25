"""Interior partition walls with door openings (villa v2 spec §3, §8).

One partition is one object. A door opening is left clear from the floor up to the door height and trimmed with a
frame outside it, so the clear opening is exactly width x door_height. The wall stops at the frame and a header
closes it above the frame's head: the trim and the wall never share a face (they would z-fight).
"""
from .glazing import _panel, _run
from .mesh import MeshBuilder

EPS = 1e-6
FRAME_PROUD = 0.01  # how far the door frame stands off each wall face


def _openings(name, doors, length, height, door_height, frame):
    """Door openings as (offset, width) sorted along the wall; ValueError naming the wall when one does not fit."""
    spans = sorted((float(offset), float(width)) for offset, width in doors)
    if spans and door_height + frame > height + EPS:
        raise ValueError(f"{name}: door height {door_height:g} plus a {frame:g} frame does not fit a {height:g} wall")
    reach = 0.0
    for offset, width in spans:
        if width <= 0 or offset < -EPS or offset + width > length + EPS:
            raise ValueError(f"{name}: door opening ({offset:g}, {width:g}) falls outside the wall "
                             f"(length {length:g})")
        if offset < reach - EPS:
            raise ValueError(f"{name}: door openings overlap at offset {offset:g}")
        reach = offset + width
    return spans


def _trims(spans, frame):
    """(left, right) width of the frame beside each opening: `frame`, but never more than half of the wall that
    separates it from the next opening, so neighbouring frames meet instead of running into each other's opening."""
    trims = []
    for i, (offset, width) in enumerate(spans):
        left = frame if i == 0 else min(frame, (offset - sum(spans[i - 1])) / 2)
        right = frame if i == len(spans) - 1 else min(frame, (spans[i + 1][0] - offset - width) / 2)
        trims.append((left, right))
    return trims


def partition(col, name, start, end, z0, z1, mats, doors=(), thickness=0.12, door_height=2.2, frame=0.05):
    """Axis-aligned interior wall (M_white) from start to end (x, y) between heights z0..z1.

    `doors` is [(offset, width), ...], measured from `start` along the wall. Each opening is clear from z0 to
    z0 + door_height with an M_frame frame (two jambs and a head, `frame` wide, standing FRAME_PROUD off both wall
    faces) around it. The wall segments stop at the jambs and a header closes the wall above the head, so no two
    faces share a plane; a jamb that would stick out past the wall's end is trimmed to it.
    ValueError (naming the wall) when an opening falls outside the wall or openings overlap."""
    axis, a_lo, a_hi, line = _run(start, end)
    spans = _openings(name, doors, a_hi - a_lo, z1 - z0, door_height, frame)
    sign = 1.0 if end[axis] >= start[axis] else -1.0
    length = a_hi - a_lo
    mb = MeshBuilder(name)

    def add(t0, t1, bottom, top, mat, depth):
        """Box over wall coordinates t0..t1 (metres from `start`, clamped to the wall) between two heights."""
        t0, t1 = max(t0, 0.0), min(t1, length)
        if t1 - t0 > EPS and top - bottom > EPS:
            a, b = start[axis] + sign * t0, start[axis] + sign * t1
            mb.box(*_panel(axis, min(a, b), max(a, b), line, bottom, top, depth), mat)

    door_top = z0 + door_height
    head_top = door_top + frame
    trims = _trims(spans, frame)
    reach = 0.0
    for (offset, width), (left, right) in zip(spans, trims):
        add(reach, offset - left, z0, z1, mats["white"], thickness)
        add(offset - left, offset + width + right, head_top, z1, mats["white"], thickness)  # the header
        reach = offset + width + right
    add(reach, length, z0, z1, mats["white"], thickness)
    trim = thickness + 2 * FRAME_PROUD
    for (offset, width), (left, right) in zip(spans, trims):
        add(offset - left, offset, z0, door_top, mats["frame"], trim)
        add(offset + width, offset + width + right, z0, door_top, mats["frame"], trim)
        add(offset - left, offset + width + right, door_top, head_top, mats["frame"], trim)
    return mb.build(col)

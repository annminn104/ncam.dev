"""Glazing: curtain walls, frameless glass railings, a sliding glass door, window panes and frosted bathroom panels.

Every pane is its own GLASS_<name>_NN object so the runtime can sort transparent panes;
a frosted panel is its own FROSTED_<name> object for the same reason.
"""
from .mesh import MeshBuilder

GLASS_THICKNESS = 0.02


def _axis(start, end):
    (x0, y0), (x1, y1) = start, end
    if abs(y1 - y0) < 1e-6:
        return 0
    if abs(x1 - x0) < 1e-6:
        return 1
    raise ValueError(f"glazing must be axis-aligned, got {start} -> {end}")


def _panel(axis, a0, a1, line, z0, z1, thickness):
    """(min, max) corners of a vertical panel from a0 to a1 along `axis`, centred on `line` across it."""
    h = thickness / 2
    if axis == 0:
        return (a0, line - h, z0), (a1, line + h, z1)
    return (line - h, a0, z0), (line + h, a1, z1)


def _run(start, end):
    axis = _axis(start, end)
    a_start, a_end = sorted((start[axis], end[axis]))
    line = start[1 - axis]
    return axis, a_start, a_end, line


def curtain_wall(col, name, start, end, z0, z1, panes, mats, frame=0.06):
    """Floor-to-ceiling glazing: `panes` GLASS_<name>_NN objects plus <name>_frame (mullions, head and sill)."""
    axis, a_start, a_end, line = _run(start, end)
    step = (a_end - a_start) / panes
    frame_mb = MeshBuilder(f"{name}_frame")
    for p in range(panes + 1):
        a = a_start + p * step
        frame_mb.box(*_panel(axis, a - frame / 2, a + frame / 2, line, z0, z1, frame), mats["frame"])
    frame_mb.box(*_panel(axis, a_start, a_end, line, z0, z0 + frame, frame), mats["frame"])
    frame_mb.box(*_panel(axis, a_start, a_end, line, z1 - frame, z1, frame), mats["frame"])
    glass = []
    for p in range(panes):
        pane = MeshBuilder(f"GLASS_{name}_{p + 1:02d}")
        a0, a1 = a_start + p * step + frame / 2, a_start + (p + 1) * step - frame / 2
        pane.box(*_panel(axis, a0, a1, line, z0 + frame, z1 - frame, GLASS_THICKNESS), mats["glass"])
        glass.append(pane.build(col))
    return frame_mb.build(col), glass


def glass_railing(col, name, start, end, z0, height, panes, mats, gap=0.03, rail=0.05):
    """Frameless glass balustrade with a slim frame-coloured handrail on top."""
    axis, a_start, a_end, line = _run(start, end)
    step = (a_end - a_start) / panes
    handrail = MeshBuilder(f"{name}_rail")
    handrail.box(*_panel(axis, a_start, a_end, line, z0 + height - rail, z0 + height, rail), mats["frame"])
    glass = []
    for p in range(panes):
        pane = MeshBuilder(f"GLASS_{name}_{p + 1:02d}")
        a0, a1 = a_start + p * step + gap / 2, a_start + (p + 1) * step - gap / 2
        pane.box(*_panel(axis, a0, a1, line, z0, z0 + height - rail, GLASS_THICKNESS), mats["glass"])
        glass.append(pane.build(col))
    return handrail.build(col), glass


def sliding_door(col, name, x0, x1, y, z0, z1, slide, mats, frames=30, frame=0.05):
    """Framed glass door filling the X-aligned opening x0..x1 at y. Action act_door_open slides it +X by `slide`
    metres over `frames` frames; frame 1 is the closed pose."""
    w, h = x1 - x0, z1 - z0
    mb = MeshBuilder(name)
    mb.box((-w / 2, -0.03, 0.0), (w / 2, 0.03, frame), mats["frame"])
    mb.box((-w / 2, -0.03, h - frame), (w / 2, 0.03, h), mats["frame"])
    mb.box((-w / 2, -0.03, frame), (-w / 2 + frame, 0.03, h - frame), mats["frame"])
    mb.box((w / 2 - frame, -0.03, frame), (w / 2, 0.03, h - frame), mats["frame"])
    mb.box((-w / 2 + frame, -0.01, frame), (w / 2 - frame, 0.01, h - frame), mats["glass"])
    ob = mb.build(col, location=((x0 + x1) / 2, y, z0))
    ob.keyframe_insert("location", frame=1)
    ob.location.x += slide
    ob.keyframe_insert("location", frame=frames)
    ob.location.x -= slide
    ob.animation_data.action.name = "act_door_open"
    return ob


def window(col, name, start, end, z0, z1, mats):
    """One clear pane GLASS_window_<name> filling a wall's window opening from start to end (x, y) between heights
    z0..z1, on the wall's centre line. Its frame is the wall's to build: the house merges it into an object it draws
    anyway."""
    axis, a_start, a_end, line = _run(start, end)
    mb = MeshBuilder(f"GLASS_window_{name}")
    mb.box(*_panel(axis, a_start, a_end, line, z0, z1, GLASS_THICKNESS), mats["glass"])
    return mb.build(col)


def frosted_panel(col, name, start, end, z0, z1, mats, thickness=GLASS_THICKNESS):
    """One axis-aligned FROSTED_<name> panel from start to end (x, y) between heights z0..z1: the translucent strip
    that lets a bathroom or WC glow softly. The panel is a night_light: its material emits a warm
    glow that the runtime dims during the day (the ceiling downlights inside cannot be seen through a window)."""
    axis, a_start, a_end, line = _run(start, end)
    mb = MeshBuilder(f"FROSTED_{name}")
    mb.box(*_panel(axis, a_start, a_end, line, z0, z1, thickness), mats["frosted"])
    return mb.build(col, night_light=True)

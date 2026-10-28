"""What a click toggles in the interior (art/README.md, Interior). Pure Python.

The decor is not interactive: a click on a cushion or a curtain does nothing, like one on a wall. Only the table lamps
glow, and their shades (one LT_lamp_<room> object per lit room, interior_layout.LAMPS) join the room's light:<room>
group of the house (houses/interact.py), so the room's switch, its downlights and its lamps go on and off together; the
store keeps a group's state by its id, across modules, as it does for the garden's lights.
"""
from houses.interact import LABELS


def tags(layout):
    """{object name: custom properties} for every interactive object of the interior: "interact" and "label"."""
    return {name: {"interact": f"light:{room}", "label": LABELS["light"].format(room=layout.ROOM_LABELS[room])}
            for room, name in layout.LAMPS.items()}

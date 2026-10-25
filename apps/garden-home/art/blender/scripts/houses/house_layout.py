"""Villa v2 house layout as plain data (villa v2 spec §5, §8). Pure Python: build_house.py turns it into geometry,
layout_check.py sanity-checks it.

The single entry point for the house: the data lives in houses/house_parts (common numbers, the shell, one file per
level) and this module gathers it under the names the generator, the checker and the tests read.
"""
from .house_parts import ground, roof, shell, upper
from .house_parts.common import (CUT_ABOVE_FLOOR, FOOTPRINT, LEVEL_Z, MODULE_ID, PLINTH, ROLE,  # noqa: F401
                                 UPPER_FLOOR, VOID)
from .interact import split_downlights

STRUCTURE = shell.STRUCTURE
CURTAIN_WALLS = shell.CURTAIN_WALLS
RAILINGS = shell.RAILINGS
PARTITIONS = shell.PARTITIONS
FROSTED = shell.FROSTED
WINDOWS = shell.WINDOWS
PASSAGES = shell.PASSAGES
DOOR = shell.DOOR
HOTSPOTS = shell.HOTSPOTS
STAIR = shell.STAIR  # where the spiral stair (a FURNITURE piece of the living room) climbs to the gallery
STAIR_HOLE = shell.STAIR_HOLE
JACUZZI = roof.JACUZZI
TRELLIS = roof.TRELLIS

_LEVELS = (ground, upper, roof)


def _gather(name, parts=_LEVELS):
    """One list from the parts that define `name`, in level order."""
    return [item for part in parts for item in getattr(part, name, [])]


# Rooms bound the furniture (layout_check); level 0 = ground, 1 = upper, 2 = roof.
ROOMS = _gather("ROOMS")
# Where a piece's feet go, per room: the top of its level's floor unless the room has a floor of its own (the terrace
# is the plinth top, 2 cm under the interior floor).
FLOOR_Z = {room["name"]: room.get("floor", LEVEL_Z[room["level"]]) for room in ROOMS}
# What the website calls each room (interaction spec §3.1): it makes the house interactive (houses/interact.py).
ROOM_LABELS = {name: label for part in _LEVELS for name, label in getattr(part, "ROOM_LABELS", {}).items()}
# Height of the dollhouse cut per level (interaction spec §2): the ground floor shows under the first, the upper floor
# under the second; layout_check keeps each room's light switch below the cut of its level.
CUT_HEIGHTS = {0: round(PLINTH + CUT_ABOVE_FLOOR, 3), 1: round(UPPER_FLOOR + CUT_ABOVE_FLOOR, 3)}
FURNITURE = _gather("FURNITURE")
PLANTERS = _gather("PLANTERS")
# one LT_down_<room> object per room, so a click switches a room's downlights alone (interaction spec §3.1)
DOWNLIGHTS = split_downlights(_gather("DOWNLIGHTS"), ROOMS)
PENDANTS = _gather("PENDANTS")
POINT_LIGHTS = _gather("POINT_LIGHTS")
LED_STRIPS = _gather("LED_STRIPS", (shell, *_LEVELS))
# resort deco: the reflecting pool along the terrace, the fountain beside the door, the string lights on the roof
REFLECTING_POOLS = _gather("REFLECTING_POOLS")
WALL_FOUNTAINS = _gather("WALL_FOUNTAINS")
STRING_LIGHTS = _gather("STRING_LIGHTS")

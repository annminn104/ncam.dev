"""Identity, heights and plan lines shared by every part of the villa v2 house. Pure Python.

Module space in metres with Blender axes: X right, Y back, Z up. The front faces -Y and the origin is the centre of
the 23 x 15 m footprint at ground level (the tall house: both storeys 3 m wider to the left and 2 m
deeper at the back than the glass villa's 20 x 13 m, which keeps its front line, its east wall and its door in site space).
"""
from archkit.catalog import FURNITURE, WALL_MOUNTED

MODULE_ID = "house"
ROLE = "hero"
FOOTPRINT = (23.0, 15.0)

# Heights. The tall house (art/README.md, Glass villa) keeps the glass villa's plinth and raises every storey over it by
# HEIGHT_SCALE: each height is PLINTH + (its glass villa value - PLINTH) * 1.3, rounded to the centimetre (ground
# ceiling 3.85, upper floor 4.15, upper ceiling 7.25, roof 7.55, door head 2.85), so the storeys are 4.81 m floor to
# floor and the glass walls, their mullions and the door grow with them. The numbers stay literal: cutaway.test.ts
# reads them from this file.
HEIGHT_SCALE = 1.3
PLINTH = 0.45
GROUND_CEIL = 4.87
UPPER_FLOOR = 5.26
UPPER_CEIL = 9.29
ROOF_TOP = 9.68
DOOR_TOP = 3.57
# The basement (art/README.md, Basement) lies under the ground slab: the plinth grows down into a slab GROUND_SLAB
# thick, whose underside is the basement's ceiling (BASEMENT_CEIL = PLINTH - GROUND_SLAB), 3.2 m over the finish of its
# floor, which lies 2 cm over BASEMENT_FLOOR as a storey's over its slab. Literal, like the heights above: cutaway.test.ts
# reads them.
GROUND_SLAB = 0.85
BASEMENT_CEIL = -0.4
BASEMENT_FLOOR = -3.62
# The dollhouse cut on the website runs this far above the floor of the storey on show (src/scene/cutaway.ts, which
# cutaway.test.ts checks against this): the walls stop at chest height. Everything a click must reach (a room's light
# switch) has to end below it.
CUT_ABOVE_FLOOR = 1.6

# Plan lines
LEFT, RIGHT = -11.5, 11.5
BACK = 7.5
FRONT = -5.5          # ground and upper glazing line, 2 m behind the footprint's front edge
EDGE = -7.0           # slab and balcony edge: the upper box cantilevers 1.5 m over the front terrace
TERRACE = -6.8        # front edge of the plinth terrace; three steps run down to the footprint edge at the door
UPPER_RIGHT = 8.5     # the white upper box stops above the stone block
STONE_LEFT = 5.5      # stone-clad block on the right of the ground floor, one storey high, 6 m wide
WALL = 0.2            # exterior walls; rooms are measured to their inner faces
# The double-height living room's void, ((x0, y0), (x1, y1)): the front left of the house, from the west wall's inner
# face and the glazing line to the edges of the upper floor round it (the gallery along its back, bedroom 2 east of it).
# No upper floor spans it, nor the cantilever in front of it: its ceiling is the upper floor's, under the roof.
VOID = ((LEFT + WALL, FRONT), (-3.46, 1.5))

# Top of the floor on each level (0 = ground, 1 = upper, 2 = roof) and the ceiling a partition rises to.
LEVEL_Z = {0: round(PLINTH + 0.02, 3), 1: round(UPPER_FLOOR + 0.02, 3), 2: round(ROOF_TOP + 0.02, 3)}
CEILING = {0: GROUND_CEIL, 1: UPPER_CEIL}


def ceiling_over(level, point):
    """Height of the ceiling over the (x, y) point of `level`: the level's own, but in the void of the double-height
    living room (VOID, level 0) the upper floor's."""
    (x0, y0), (x1, y1) = VOID
    x, y = point
    if level == 0 and x0 < x < x1 and y0 < y < y1:
        return CEILING[1]
    return CEILING[level]


def hang(kind, level, point=None):
    """Builder options for a piece hung from the ceiling of `level` (rattan_pendant, fern_hanging, crystal_chandelier):
    the extra cord that takes it from the top of its WALL_MOUNTED height up to the ceiling, which is higher than the kit
    assumes; over `point` (x, y) that ceiling is ceiling_over's, so a piece in the void hangs from the upper floor's."""
    ceiling = CEILING[level] if point is None else ceiling_over(level, point)
    return {"cord": round(ceiling - LEVEL_Z[level] - WALL_MOUNTED[kind] - FURNITURE[kind][2], 3)}

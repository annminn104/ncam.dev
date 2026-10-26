"""The vegetable garden (art/README.md, Garden) as plain data: a module of its own in the `vegetables` zone. Pure Python.

Module space: the origin is the centre of the 8 x 8 m footprint (the zone), front to -Y like every module. A gravel
plot edged with teak; on it six raised teak beds in two columns (lettuce, cabbage, carrots, herbs) with a gravel path
down the middle and between the rows; along the back a tomato trellis, the compost bin and the tool shed; a wheelbarrow
at the front and a watering can on the path. The zone's front-left corner is 0.6 m from the island's rim, with the fence
just outside it: nothing but gravel there.

build_veg.py builds the plot (GRAVEL, EDGING) into the still object Veg_garden; the beds and the trellis sway
(Veg_beds).
"""
MODULE_ID = "veg_garden"
ROLE = "prop"
FOOTPRINT = (8.0, 8.0)

GRAVEL = (-3.7, -3.7, 3.7, 3.7)  # x0, y0, x1, y1 of the gravel plot
GRAVEL_TOP = 0.02
EDGING = (0.06, 0.1)  # the teak boards round the plot: thick, high

BEDS, STILL = "Veg_beds", "Veg_garden"
SHADOWLESS = (BEDS,)  # low raised beds, out of the website's shadow pass; the shed and the bin cast theirs
WIND = {"wind": True}
_CROPS = ((-1.6, -2.4, "lettuce"), (1.6, -2.4, "cabbage"), (-1.6, -0.6, "carrot"), (1.6, -0.6, "herbs"),
          (-1.6, 1.2, "cabbage"), (1.6, 1.2, "lettuce"))
# everything stands on the gravel
PIECES = ([("raised_bed", BEDS, (x, y, GRAVEL_TOP), 0, {"crop": crop, **WIND}) for x, y, crop in _CROPS]
          + [("tomato_trellis", BEDS, (-1.6, 2.75, GRAVEL_TOP), 0, WIND),
             ("compost_bin", STILL, (0.65, 3.0, GRAVEL_TOP), 0),
             ("tool_shed", STILL, (2.6, 2.9, GRAVEL_TOP), 0),
             ("wheelbarrow", STILL, (3.35, -3.0, GRAVEL_TOP), 0),
             ("watering_can", STILL, (0.0, 0.3, GRAVEL_TOP), 90)])

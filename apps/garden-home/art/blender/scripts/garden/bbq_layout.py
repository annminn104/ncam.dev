"""The barbecue terrace (villa v2 part 2) as plain data: a module of its own in the `bbq` zone. Pure Python.

Module space: the origin is the centre of the 8 x 6 m footprint (the zone), front to -Y. A travertine terrace; on its
west half a teak pergola (archkit.structure.pergola) over a table for six, with string lights zig-zagging under the
slats (lights:garden); on its east half the outdoor kitchen along the east edge, the charcoal grill in front of it (the
click group bbq: the grill casts its shadow by day, its coals glow, an object of their own; it stands well back from
the terrace's front, which the pool deck hides from the wallpaper camera at the front-right, and nothing tall stands
between them) and two rattan armchairs under a parasol at the back; planters at the corners.

build_bbq.py builds the terrace (PAVING) into the still object BBQ_terrace and the pergola (PERGOLA) as Pergola.
"""
from archkit.catalog import GRILL_COALS_Z

from . import shapes

MODULE_ID = "bbq_area"
ROLE = "prop"
FOOTPRINT = (8.0, 6.0)

PAVING = (-3.8, -2.8, 3.8, 2.8)  # x0, y0, x1, y1 of the travertine terrace
PAVING_TOP = 0.05
PERGOLA = {"name": "Pergola", "min": (-3.4, -1.7), "max": (0.4, 1.7), "height": 2.5, "slats": 9, "post": 0.12}

STILL, GRILL, COALS, PLANTS = "BBQ_terrace", "BBQ_grill", "BBQ_coals", "BBQ_plants"
GRILL_AT = (2.9, -0.3)  # just clear of the kitchen behind it
WIND = {"wind": True}
# (kind, group, (x, y), rot[, options]) on the terrace: they stand on its paving
_ON_TERRACE = [
    ("dining_set_6", STILL, (-1.5, 0.0), 0),
    ("outdoor_kitchen", STILL, (3.45, 1.5), 270),
    ("bbq_grill", GRILL, GRILL_AT, 0),
    ("parasol", STILL, (1.8, 1.7), 0),
    ("rattan_armchair", STILL, (1.1, 1.9), 90),
    ("side_table", STILL, (1.8, 1.9), 0),
    ("rattan_armchair", STILL, (2.5, 1.9), 270),
    ("palm_small", PLANTS, (-3.4, -2.4), 0, WIND),
    ("monstera", PLANTS, (-3.4, 2.4), 0, WIND),
    ("flower_pot", PLANTS, (0.9, -2.45), 0, {"variant": 1, **WIND}),  # red and yellow, like the coals
    ("flower_pot", PLANTS, (3.45, -2.45), 0, {"variant": 1, **WIND}),  # low: the grill behind it stays in view
]
PIECES = ([(kind, group, (*pos, PAVING_TOP), *rest) for kind, group, pos, *rest in _ON_TERRACE]
          + [("bbq_coals", COALS, (*GRILL_AT, PAVING_TOP + GRILL_COALS_Z), 0)])  # in the grill's firebox

# Under the pergola's slats, zig-zagging from post to post across it (archkit.lighting.string_lights).
_TOP = PERGOLA["height"] - 0.2
_X0, _X1 = PERGOLA["min"][0], PERGOLA["max"][0]
# Globes of 9 cm: festoon bulbs of 5 cm were a pixel from the wallpaper camera at night.
STRING_LIGHTS = [{"name": "String_lights_bbq", "bulbs_per_m": 3.0, "sag": 0.08, "bulb_radius": 0.09,
                  "points": [(_X0 + (_X1 - _X0) * k / 4, PERGOLA["max"][1] if k % 2 else PERGOLA["min"][1], _TOP)
                             for k in range(5)]}]

# The pergola's posts are what stands on the terrace besides the pieces (the paving is under everything).
_POST = PERGOLA["post"]
SHAPES = [(f"pergola post {k}", shapes.rect((x, y), (_POST, _POST))) for k, (x, y) in enumerate(
    [(x, y) for x in (_X0, _X1) for y in (PERGOLA["min"][1], PERGOLA["max"][1])], start=1)]

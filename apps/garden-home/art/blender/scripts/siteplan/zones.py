"""Yard zones, module slots and placeholder props as plain data (art/README.md, Glass villa). Pure Python.

Blender coordinates in metres: X to the right, Y towards the back, module fronts face -Y. The yard is centred on the
origin; a zone is ((x0, y0), (x1, y1)). The yard module itself needs no slot: it sits at the origin.
"""
from basement.basement_layout import FOOTPRINT as BASEMENT_FOOTPRINT
from carport.carport_layout import FOOTPRINT as CARPORT_FOOTPRINT
from carport.kennel_layout import FOOTPRINT as KENNEL_FOOTPRINT
from garden.bbq_layout import FOOTPRINT as BBQ_FOOTPRINT
from garden.veg_layout import FOOTPRINT as VEG_FOOTPRINT
from houses.house_parts.common import FOOTPRINT as HOUSE_FOOTPRINT
from houses.pool_layout import FOOTPRINT as POOL_FOOTPRINT
from interior.interior_layout import FOOTPRINT as INTERIOR_FOOTPRINT
from pond.koi_layout import FOOTPRINT as KOI_FOOTPRINT
from pond.tea_layout import FOOTPRINT as TEA_FOOTPRINT

from .island import ISLAND_WIDE

YARD = (48.0, 40.0)  # the planned yard: zones, trees and the lamp lie in x -24..24, y -20..20
# The yard stands on a floating island (siteplan/island.py): a flat grass top at z 0 whose rim is a jittered squircle a
# little bigger than the yard, over a faceted rock underside whose tip hangs `depth` metres below the top. The yard
# module's footprint is the island's `size`; 52 x 44 m would round off the vegetable garden's corner (-23, -18).
ISLAND = {"size": (54.0, 46.0), "exponent": 4.0, "rim": 64, "jitter": 0.015, "seed": 3, "depth": 15.5}

ZONES = {
    "house": ((-13.0, 2.0), (10.0, 17.0)),  # the tall house, 23 x 15 m: its front, east wall and door stay put
    "pool": ((-20.0, -5.5), (-8.0, 1.5)),
    "pond": ((3.5, -15.0), (14.5, -7.0)),
    "tea": ((4.0, -6.5), (10.0, -3.0)),  # tea table and bonsai (part 3), up to the walk's turn for its stepping stones
    "carport": ((12.0, 3.0), (20.0, 10.0)),  # two-car carport (part 4)
    "driveway": ((15.0, -20.0), (19.0, 3.0)),  # from the car gate to the carport (part 2)
    "bbq": ((-23.0, 3.0), (-15.0, 9.0)),  # outdoor dining and barbecue (part 2)
    "vegetables": ((-23.0, -18.0), (-15.0, -10.0)),  # vegetable garden (part 2)
    "kennel": ((20.5, 11.0), (23.5, 14.0)),  # dog house and the Akita (part 4)
    "path_gate": ((-1.0, -20.0), (1.0, -3.0)),  # stone path from the main gate (part 2)
    "path_turn": ((-1.0, -3.0), (7.0, -1.0)),  # ... turning towards the door
    "path_door": ((5.0, -1.0), (7.0, 2.0)),  # ... up to the front porch
    # the basement's light well (art/README.md, Basement), sunk into the lawn in front of the living room's tall
    # glass, between the pool and the walk; its back edge is the house zone's front, the basement's front wall
    "lightwell": ((-7.5, -2.0), (-1.5, 2.0)),
}

# Where each module stands. `pos` is the centre of its footprint, `yaw` is in degrees, `footprint` is (w, d) before
# turning (the module's own, so the house, the pool, the zoned garden modules, the pond's and the carport's read theirs
# from their layouts); the whole turned footprint must stay inside the slot's zone. The koi pond and the tea corner (part
# 3), the carport and the dog's corner (part 4) fill their zones unturned: their layout checks place them in site space
# so, and the yard's lawn has the koi pond's hole. The basement (art/README.md, Basement) shares the house's slot: ZONE_SHARED
# lets it, its layout puts its light well in the `lightwell` zone, and the lawn has the hole of its pit. So does the
# interior (art/README.md, Interior), the house's curtains and accessories in a module of their own.
# The garden's fence, paths and flower beds spread over the whole island (zone ISLAND_WIDE): they stand at its centre
# unturned with its size as footprint, in site space, and garden/layout_check.py keeps their content on the island and
# out of the zones they do not use.
SLOTS = {
    "house_01": {"module": "house", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0, "footprint": HOUSE_FOOTPRINT},
    "pool_01": {"module": "pool", "zone": "pool", "pos": (-14.0, -2.0), "yaw": 0.0, "footprint": POOL_FOOTPRINT},
    "koi_pond_01": {"module": "koi_pond", "zone": "pond", "pos": (9.0, -11.0), "yaw": 0.0, "footprint": KOI_FOOTPRINT},
    "tea_garden_01": {"module": "tea_garden", "zone": "tea", "pos": (7.0, -4.75), "yaw": 0.0,
                      "footprint": TEA_FOOTPRINT},
    "fence_01": {"module": "fence", "zone": ISLAND_WIDE, "pos": (0.0, 0.0), "yaw": 0.0, "footprint": ISLAND["size"]},
    "garden_paths_01": {"module": "garden_paths", "zone": ISLAND_WIDE, "pos": (0.0, 0.0), "yaw": 0.0,
                        "footprint": ISLAND["size"]},
    "flower_beds_01": {"module": "flower_beds", "zone": ISLAND_WIDE, "pos": (0.0, 0.0), "yaw": 0.0,
                       "footprint": ISLAND["size"]},
    "veg_garden_01": {"module": "veg_garden", "zone": "vegetables", "pos": (-19.0, -14.0), "yaw": 0.0,
                      "footprint": VEG_FOOTPRINT},
    "bbq_area_01": {"module": "bbq_area", "zone": "bbq", "pos": (-19.0, 6.0), "yaw": 0.0, "footprint": BBQ_FOOTPRINT},
    "carport_01": {"module": "carport", "zone": "carport", "pos": (16.0, 6.5), "yaw": 0.0,
                   "footprint": CARPORT_FOOTPRINT},
    "kennel_01": {"module": "kennel", "zone": "kennel", "pos": (22.0, 12.5), "yaw": 0.0, "footprint": KENNEL_FOOTPRINT},
    "basement_01": {"module": "basement", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0,
                    "footprint": BASEMENT_FOOTPRINT},
    "interior_01": {"module": "interior", "zone": "house", "pos": (-1.5, 9.5), "yaw": 0.0,
                    "footprint": INTERIOR_FOOTPRINT},
}
# Slots that stand in another's place, in its zone (zones_check: no other zone holds two slots): the basement under the
# house and the interior in it, in the same module space.
ZONE_SHARED = {"basement_01": "house_01", "interior_01": "house_01"}

# Placeholder yard props stay out of every zone and out of the idle camera's foreground (the camera hangs out at the
# front-right and looks at the house): trees go to the back corners, the strip behind the house (2.5 m behind the tall
# house's back wall) and the side margins.
TREES = ((-21.0, 17.0), (-11.0, 19.5), (11.0, 19.5), (21.5, 17.0), (-22.0, -7.5), (22.0, 6.0))
LAMP = (-4.5, -3.0)  # on the lawn in front of the light well, 10.6 m left of the front door (x = 6.1), off the path

# Cameras, tuned on wallpaper screenshots at 1280 x 800 and 1512 x 982. `pos` and `target` in
# metres, `lens` is the focal length in mm (sensor_fit VERTICAL). The idle camera hangs far out at the front-right, 15.5
# degrees above the target, low enough that the rock underside shows below the rim: with the wallpaper framed on the
# right (?align=right puts the target at 68 % of the width) the whole floating island fills about 60 % of the width on
# the right, the house in the middle of it; it looks at the ground near the island's centre, the site route's orbit
# centre. The first stop is a straight-on view of the whole front, standing on the stone path from the main gate.
CAMERAS = {
    "CAM_idle": {"pos": (72.5, -85.6, 29.6), "target": (4.0, -4.0, 0.0), "lens": 42.0},
    "CAM_stop_01": {"pos": (0.0, -17.0, 3.2), "target": (0.0, 8.0, 3.6), "lens": 30.0},
}

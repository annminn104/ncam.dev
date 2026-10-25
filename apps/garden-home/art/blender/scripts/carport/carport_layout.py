"""The carport (villa v2 part 4) as plain data: a module of its own filling the `carport` zone, at the end of the
driveway on the house's east side. Pure Python.

Module space: the origin is the centre of the 8 x 7 m footprint (the zone), front to -Y, where the driveway
(garden/paths_layout.py) ends on the slab's front edge, flush with it. A modern resort carport: a travertine slab; a
flat roof, a white fascia frame all round over a glass sheet with teak louvres hung under it (the slat soffit, which
from the wallpaper camera reads as a teak roof and from above lets the cars show through), on white beams across that
carry the downlights; two thin dark steel posts on the east side, away from the house; on the house side the roof's beam
runs from a travertine-clad pillar at the front to the travertine wall that closes the back, two metres off the house's
east wall. Two bays: the pickup on the house side, the low red supercar on the open side in front of it from the
wallpaper camera at the front-right, both nose out towards the driveway; a teak storage cabinet behind the pickup, a
bicycle against the wall behind the supercar. Three downlights on the beams over the aisle between the cars pool their
light on the floor at night (lights:carport); each car's head and tail lights are a night light of their own
(lights:car_pickup, lights:car_super), with the light the headlights cast on the ground ahead.

build_carport.py builds the slab as Carport_floor (no shadow), the roof's fascia, louvres and beams, the posts, pillar,
wall, cabinet and bicycle as Carport, the roof's glass sheet as Carport_glass (no click group: a click aimed at a car
from above goes through it), the downlights and their pools as Carport_lights, and every car as its body and its
lights (CARS); layout_check reads SLAB, ROOF, LOUVRES, BEAMS, the structure (PILLAR, POSTS, WALL) and what stands at
the back (CABINET, BIKE), BAYS, CARS, DOWNLIGHTS, POOLS and HEADLIGHT_POOL_TOP.
"""
import math

MODULE_ID = "carport"
ROLE = "prop"
FOOTPRINT = (8.0, 7.0)  # the carport zone (siteplan/zones.py), which a test keeps equal to it
ZONE = "carport"

FLOOR, STILL, GLASS, LIGHTS = "Carport_floor", "Carport", "Carport_glass", "Carport_lights"
SLAB = (-3.95, -3.5, 3.95, 3.25)  # x0, y0, x1, y1: its front edge where the driveway ends, its back under the wall
SLAB_TOP = 0.04  # flush with the driveway (garden/paths_layout.py DRIVEWAY_TOP), which layout_check holds it to
# The roof: its white fascia frame, `fascia` wide, from `under` up to `top`; inside it a glass sheet `glass` under the
# top, teak louvres hung under the glass, `slats` of them `slat` wide and `depth` deep running front to back, and white
# beams across under them at BEAMS["ys"].
ROOF = {"min": (-4.0, -3.5), "max": (4.0, 3.5), "under": 2.45, "top": 2.75, "fascia": 0.2}
LOUVRES = {"glass": 0.03, "slats": 30, "slat": 0.14, "depth": 0.08}
BEAMS = {"ys": (-2.2, 0.0, 2.0), "width": 0.16, "depth": 0.14}
WALL = (-4.0, 3.2, 4.0, 3.5)  # the travertine wall closing the back, up to the roof
PILLAR = {"center": (-3.82, -3.32), "size": 0.3}  # travertine-clad, under the beam on the house side
POSTS = [(3.88, -3.38), (3.88, -0.1)]  # thin dark steel posts on the open side
POST = 0.12

# The bays, side by side between the pillar and the posts, from the front edge back to the wall; the cars in them.
BAYS = [{"min": (-3.67, -3.5), "max": (0.05, 3.2)}, {"min": (0.05, -3.5), "max": (3.82, 3.2)}]
CARS = [
    {"kind": "pickup_truck", "name": "Pickup", "lights": "Pickup_lights", "pos": (-1.75, -0.35), "rot": 0,
     "group": "lights:car_pickup"},
    {"kind": "convertible_supercar", "name": "Supercar", "lights": "Supercar_lights", "pos": (1.9, -0.6), "rot": 0,
     "group": "lights:car_super"},
]

CABINET = {"min": (-3.45, 2.7), "max": (-1.05, 3.2), "height": 2.0}  # teak, against the wall behind the pickup
BIKE = {"center": (1.9, 2.92), "wheel": 0.33, "base": 1.05}  # leaning on the wall behind the supercar, along X

# Downlights under the beams over the aisle between the cars, each pooling its light on the floor (radius).
DOWNLIGHTS = [(0.05, y) for y in BEAMS["ys"]]
DOWNLIGHT_RADIUS = 0.09
POOL_RADIUS = 1.1
POOL_LIFT = 0.006  # over the slab
POOLS = [{"group": LIGHTS, "center": point, "radius": POOL_RADIUS, "start": 0.0, "sweep": 2 * math.pi}
         for point in DOWNLIGHTS]
# The light each car's headlights cast on the ground ahead of its nose (radius of a half disc), in its lights' object:
# over the front of the slab and out onto the driveway and the lawn in front of the carport (layout_check.car_pools),
# at a height just over the grey kerbs along the driveway's sides (garden/paths_layout.py KERB_TOP, 0.07), which a pool
# lying under their top would show as dark stripes; layout_check holds it over them.
HEADLIGHT_POOL = 1.5
HEADLIGHT_POOL_TOP = 0.076

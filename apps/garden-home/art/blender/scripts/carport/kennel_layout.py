"""The dog's corner (villa v2 part 4) as plain data: a module of its own filling the `kennel` zone, on the lawn behind
the carport by the fence. Pure Python.

Module space: the origin is the centre of the 3 x 3 m footprint (the zone), front to -Y, towards the lawn. A teak dog
house with its door to the front (Kennel, which casts its shadow); before its door a dark mat the Akita sits on, turned
towards the lawn and the wallpaper camera at the front-right; beside the mat a water bowl and a food bowl, a red ball
out on the grass and a small bush by the house (Dog_corner: low things, which cast no shadow; the bush sways).

The Akita is three objects (build_kennel.py): Akita, its body, which breathes (BREATHE, ambient_dog_breathe: it swells a
little across and up), with its head (Akita_head) and its tail (Akita_tail) for children, their origins on the pivots of
catalog.AKITA_PIVOTS; the tail wags slowly (WAG, ambient_dog_tail); a click on the dog plays HAPPY (act_dog_happy, the
click group dog "Bé Akita", carport/interact.py) once: two hops with a wiggle, the head tilted and turned, the tail
wagging fast, then back to rest. Frames at FPS (the glTF exporter writes frame / fps); every key list starts at frame 0,
so no clip holds its first frame.
"""
MODULE_ID = "kennel"
ROLE = "prop"
FOOTPRINT = (3.0, 3.0)  # the kennel zone (siteplan/zones.py), which a test keeps equal to it
ZONE = "kennel"

STILL, CORNER = "Kennel", "Dog_corner"
SHADOWLESS = (CORNER,)  # the mat, the bowls, the ball and the bush: their shadow pass is not worth its cost
WIND = {"wind": True}
MAT = (0.25, -0.35)
PIECES = [
    ("dog_house", STILL, (0.25, 0.75), 0),
    ("dog_mat", CORNER, MAT, 0),
    ("dog_bowl", CORNER, (-0.68, -0.25), 0, {"variant": 0}),  # water
    ("dog_bowl", CORNER, (-0.68, 0.1), 0, {"variant": 1}),  # food
    ("dog_ball", CORNER, (1.05, -1.05), 0),
    ("bush", CORNER, (-0.95, 0.95), 0, WIND),
]
# The Akita on its mat, `yaw` degrees counter-clockwise from facing -Y: towards the wallpaper camera.
DOG = {"name": "Akita", "head": "Akita_head", "tail": "Akita_tail", "pos": (0.25, -0.38), "yaw": 25.0}

FPS = 24
# How much the body swells at the top of a breath, as shares of its size across (x), along (y) and up (z).
BREATHE = {"clip": "ambient_dog_breathe", "frames": 72, "scale": (0.025, 0.015, 0.01)}
# The slow wag: degrees either way about the dog's length, one wag over `frames`.
WAG = {"clip": "ambient_dog_tail", "frames": 48, "swing": 9.0}
# The happy clip: (frame, value) keys of the hops (metres up), the body's wiggle (degrees about its yaw) and the head's
# (tilt about the dog's length, turn about the vertical) in degrees; the fast wag: `beats` wags of `swing` degrees
# either way from frame `start` to `end`.
HAPPY = {
    "clip": "act_dog_happy",
    "frames": 60,
    "hop": [(0, 0.0), (2, 0.0), (7, 0.1), (12, 0.0), (17, 0.07), (22, 0.0), (60, 0.0)],
    "turn": [(0, 0.0), (2, 0.0), (10, -15.0), (24, 12.0), (38, -8.0), (52, 0.0), (60, 0.0)],
    "head": [(0, (0.0, 0.0)), (2, (0.0, 0.0)), (12, (24.0, -30.0)), (30, (-18.0, -24.0)), (46, (0.0, 0.0)),
             (60, (0.0, 0.0))],
    "wag": {"start": 2, "end": 50, "beats": 8, "swing": 32.0},
}

"""Generate blender/modules/kennel.blend from carport/kennel_layout.py (art/README.md, Carport and dog): the teak dog house (Kennel);
the mat, the bowls, the ball and the bush (Dog_corner, which casts no shadow; the bush sways); and the Akita on its mat:
its body (Akita, which breathes in the clip ambient_dog_breathe) with its head (Akita_head) and its tail (Akita_tail,
which wags in ambient_dog_tail) for children on their pivots, and the clip act_dog_happy over all three, which the
website plays once for a click on the dog (the click group dog).

Every clip is one action, with a slot for each object it moves: an object's first clip is its active action and its
others lie in tracks of its NLA, so the glTF export (export_module.py, animation mode ACTIONS) writes each clip once,
named after its action, keyed from frame 0.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/carport/build_kennel.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

import bpy  # noqa: E402

from archkit.catalog import AKITA_PIVOTS, FURNITURE  # noqa: E402
from archkit.furniture import BUILDERS  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from carport import interact, layout_check  # noqa: E402
from carport import kennel_layout as L  # noqa: E402
from garden import assemble  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "kennel.blend")
STEP = 3  # frames between the keys of a looping clip, its value exact at each


class Clip:
    """One action with a slot and an F-curve per animated channel of the objects it moves."""

    def __init__(self, name):
        self.action = bpy.data.actions.new(name)
        self.strip = self.action.layers.new("Layer").strips.new(type="KEYFRAME")
        self.slots = {}

    def curve(self, ob, path, index):
        if ob.name not in self.slots:
            self.slots[ob.name] = self.action.slots.new("OBJECT", ob.name)
        bag = self.strip.channelbag(self.slots[ob.name], ensure=True)
        return bag.fcurves.find(path, index=index) or bag.fcurves.new(path, index=index)

    def keys(self, ob, path, index, keys, interpolation="BEZIER"):
        """Keys (frame, value) on one channel; bezier keys get clamped handles, so a hop or a turn eases in and out."""
        curve = self.curve(ob, path, index)
        for frame, value in keys:
            key = curve.keyframe_points.insert(frame, value)
            key.interpolation = interpolation
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
        curve.update()

    def assign(self, ob, active):
        """Give `ob` this clip: as its active action, or in a track of its NLA."""
        data = ob.animation_data or ob.animation_data_create()
        if active:
            data.action = self.action
            data.action_slot = self.slots[ob.name]
            return
        track = data.nla_tracks.new()
        track.name = self.action.name
        strip = track.strips.new(self.action.name, 0, self.action)
        strip.action_slot = self.slots[ob.name]


def _loop(frames, value):
    """Linear keys every STEP frames of one seamless period of `value(t)`, t from 0 to 1."""
    return [(frame, value(frame / frames)) for frame in range(0, frames + 1, STEP)]


def dog(col, mats):
    """The Akita on its mat: its body turned to its yaw, its head and tail as its children on their pivots."""
    w, d, h = FURNITURE["akita"]
    x, y = L.DOG["pos"]
    body = MeshBuilder(L.DOG["name"])
    BUILDERS["akita"](body, mats, w, d, h, part="body")
    akita = body.build(col, location=(x, y, 0.0), rotation_z=math.radians(L.DOG["yaw"]))
    parts = {}
    for part, name in (("head", L.DOG["head"]), ("tail", L.DOG["tail"])):
        pivot = AKITA_PIVOTS[part]
        mb = MeshBuilder(name)
        with mb.placed(tuple(-v for v in pivot)):  # built about its pivot, its origin there
            BUILDERS["akita"](mb, mats, w, d, h, part=part)
        ob = mb.build(col, location=pivot)
        ob.parent = akita  # its location is now in the dog's own space
        parts[part] = ob
    return akita, parts["head"], parts["tail"]


def clips(akita, head, tail):
    """ambient_dog_breathe on the body, ambient_dog_tail on the tail and act_dog_happy on all three."""
    breathe = Clip(L.BREATHE["clip"])
    for axis, share in enumerate(L.BREATHE["scale"]):
        breathe.keys(akita, "scale", axis, _loop(L.BREATHE["frames"],
                                                 lambda t, s=share: 1.0 + s * (1.0 - math.cos(2 * math.pi * t)) / 2),
                     interpolation="LINEAR")
    wag = Clip(L.WAG["clip"])
    swing = math.radians(L.WAG["swing"])
    wag.keys(tail, "rotation_euler", 1, _loop(L.WAG["frames"], lambda t: swing * math.sin(2 * math.pi * t)),
             interpolation="LINEAR")
    happy = Clip(L.HAPPY["clip"])
    keys = L.HAPPY
    happy.keys(akita, "location", 2, keys["hop"])
    yaw = math.radians(L.DOG["yaw"])
    happy.keys(akita, "rotation_euler", 2, [(frame, yaw + math.radians(turn)) for frame, turn in keys["turn"]])
    happy.keys(head, "rotation_euler", 1, [(frame, math.radians(tilt)) for frame, (tilt, _) in keys["head"]])
    happy.keys(head, "rotation_euler", 2, [(frame, math.radians(turn)) for frame, (_, turn) in keys["head"]])
    fast = keys["wag"]
    quarter = (fast["end"] - fast["start"]) / fast["beats"] / 4
    beats = [(fast["start"] + (2 * k + 1) * quarter, (-1) ** k * math.radians(fast["swing"]))
             for k in range(2 * fast["beats"])]
    happy.keys(tail, "rotation_euler", 1, [(0, 0.0), (fast["start"], 0.0)] + beats + [(fast["end"], 0.0),
                                                                                      (keys["frames"], 0.0)])
    breathe.assign(akita, active=True)
    happy.assign(akita, active=False)
    happy.assign(head, active=True)
    wag.assign(tail, active=True)
    happy.assign(tail, active=False)


def build(col, mats):
    bpy.context.scene.render.fps = L.FPS  # what the glTF exporter divides the frames by
    assemble.pieces(col, L, mats)
    clips(*dog(col, mats))


assemble.generate(L, build, "Generate the kennel module", DEFAULT_OUT, check=layout_check.check_kennel,
                  tags=interact.tags)

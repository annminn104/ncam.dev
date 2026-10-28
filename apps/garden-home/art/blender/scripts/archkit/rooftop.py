"""Rooftop jacuzzi: a tile-lined basin sunk into a wood deck, a thin WATER_ slab, an LED ring
under the water line and bubbles that bob in one seamless loop.

The runtime swaps WATER_* for its water shader and plays every ambient_* clip by itself, so the builder only has to
name things: WATER_<name>, LT_<name> (night_light) and the clip ambient_<name>.
"""
import math
import random

import bpy

from .mesh import MeshBuilder

LINING = 0.03  # tile skin on the basin walls
FLOOR = 0.05  # deck material under the basin: the floor sits `height - FLOOR` below the deck top (0.45 m at 0.5 m)
WATER_DROP = 0.05  # the water line lies this far below the deck top
STEP = (1.2, 0.4)  # width and depth of the wood step on the -Y side
BUBBLE_AMPLITUDE = 0.03  # how far a bubble bobs up and down
BUBBLE_RADIUS = (0.025, 0.055)
GROUPS = "abc"  # three bubble groups, a third of a period apart


def jacuzzi(col, name, center, mats, inner=2.4, deck=3.6, height=0.5, bubbles=20, seed=7, frames=60):
    """Square wood deck `deck` x `deck` x `height` standing on `center` = (x, y, z), the middle of its underside (z =
    roof level), with a tile-lined basin `inner` wide cut into it and a step on the -Y side.

    Returns {"deck": <name>, "water": WATER_<name>, "led": LT_<name>, "bubbles": [<name>_bubbles_a, _b, _c]}.
    The bubbles are `bubbles` small icospheres at the water line, dealt out to the three group objects; all of them
    bob in the clip ambient_<name in lower case> (the contract wants lower case), `frames` frames long, with one
    slot per group.
    """
    cx, cy, z = center
    top = z + height
    if inner + 2 * LINING >= deck or height <= FLOOR:
        raise ValueError(f"{name}: a {inner:g} m basin does not fit a {deck:g} x {height:g} m deck")
    half, hole = deck / 2, inner / 2 + LINING  # outer half-width of the deck, half-width of the cut in the wood
    wood, tile = mats["wood"], mats["tile"]

    mb = MeshBuilder(name)
    # Wood: front and back slabs run the full width, the side slabs fill in between them.
    mb.box((cx - half, cy - half, z), (cx + half, cy - hole, top), wood, uv_tile=2.0)
    mb.box((cx - half, cy + hole, z), (cx + half, cy + half, top), wood, uv_tile=2.0)
    mb.box((cx - half, cy - hole, z), (cx - hole, cy + hole, top), wood, uv_tile=2.0)
    mb.box((cx + hole, cy - hole, z), (cx + half, cy + hole, top), wood, uv_tile=2.0)
    step_w, step_d = STEP
    mb.box((cx - step_w / 2, cy - half - step_d, z), (cx + step_w / 2, cy - half, z + height / 2), wood, uv_tile=2.0)
    # Tile: the floor, and a skin on each wall of the cut that leaves the basin exactly `inner` wide.
    floor = z + FLOOR
    mb.box((cx - hole, cy - hole, z), (cx + hole, cy + hole, floor), tile)
    mb.box((cx - hole, cy - hole, floor), (cx + hole, cy - hole + LINING, top), tile)
    mb.box((cx - hole, cy + hole - LINING, floor), (cx + hole, cy + hole, top), tile)
    mb.box((cx - hole, cy - hole + LINING, floor), (cx - hole + LINING, cy + hole - LINING, top), tile)
    mb.box((cx + hole - LINING, cy - hole + LINING, floor), (cx + hole, cy + hole - LINING, top), tile)
    deck_ob = mb.build(col)

    water_top = top - WATER_DROP
    w = inner / 2 - 0.01
    water = MeshBuilder(f"WATER_{name}").box((cx - w, cy - w, water_top - 0.02), (cx + w, cy + w, water_top),
                                             mats["water"]).build(col)

    # LED ring along the four basin walls, just under the water line (the pool's LED rim does the same).
    led_top, bar, r = water_top - 0.06, 0.03, inner / 2
    ring = MeshBuilder(f"LT_{name}")
    ring.box((cx - r, cy - r, led_top - bar), (cx + r, cy - r + bar, led_top), mats["led"])
    ring.box((cx - r, cy + r - bar, led_top - bar), (cx + r, cy + r, led_top), mats["led"])
    ring.box((cx - r, cy - r + bar, led_top - bar), (cx - r + bar, cy + r - bar, led_top), mats["led"])
    ring.box((cx + r - bar, cy - r + bar, led_top - bar), (cx + r, cy + r - bar, led_top), mats["led"])
    led = ring.build(col, night_light=True)

    return {"deck": deck_ob, "water": water, "led": led,
            "bubbles": _bubbles(col, name, (cx, cy), r - 0.15, water_top, mats, bubbles, seed, frames)}


def _bubbles(col, name, center, reach, water_top, mats, count, seed, frames, groups=GROUPS):
    """Group objects holding the bubbles, animated by one action with a slot per group: <name>_bubbles_<g> for each
    letter g of `groups` (the basement's hot tub has one)."""
    rnd = random.Random(seed)
    cx, cy = center
    builders = [MeshBuilder(f"{name}_bubbles_{suffix}") for suffix in groups]
    for i in range(count):
        radius = rnd.uniform(*BUBBLE_RADIUS)
        spot = (cx + rnd.uniform(-reach, reach), cy + rnd.uniform(-reach, reach), water_top + radius * 0.2)
        builders[i % len(groups)].blob(spot, radius, mats["ceramic"], subdivisions=1)  # 20 faces: tiny anyway
    action = bpy.data.actions.new(f"ambient_{name.lower()}")
    strip = action.layers.new("Layer").strips.new(type="KEYFRAME")
    found = []
    for i, mb in enumerate(builders):
        if not mb.bm.verts:
            mb.bm.free()
            continue
        ob = mb.build(col)
        _bob(action, strip, ob, i / len(builders), frames)
        found.append(ob)
    return found


def _bob(action, strip, ob, phase, frames):
    """Give `ob` a slot of `action` that moves it up and down by one sine period over `frames` frames, started
    `phase` of a period in. The keys sit at frames 0..frames because the glTF exporter writes frame / fps: the clip
    then runs from 0 to frames / fps, and its first and last key hold the same value and slope, so the loop has no
    seam (keys from frame 1 would leave the first frame held at the start of every cycle)."""
    slot = action.slots.new("OBJECT", ob.name)
    ob.animation_data_create()
    ob.animation_data.action = action
    ob.animation_data.action_slot = slot
    curve = strip.channelbag(slot, ensure=True).fcurves.new("location", index=2)
    third = frames / 12  # Bezier handle length for quarter-period keys
    omega = 2 * math.pi / frames
    for quarter in range(5):
        frame = quarter * frames / 4
        angle = 2 * math.pi * (quarter % 4 / 4 + phase)  # the last key repeats the first exactly
        key = curve.keyframe_points.insert(frame, BUBBLE_AMPLITUDE * math.sin(angle))
        slope = BUBBLE_AMPLITUDE * omega * math.cos(angle)
        key.handle_left_type = key.handle_right_type = "FREE"  # exact sine tangents, equal at both ends of the loop
        key.handle_left = (frame - third, key.co[1] - slope * third)
        key.handle_right = (frame + third, key.co[1] + slope * third)
    curve.update()

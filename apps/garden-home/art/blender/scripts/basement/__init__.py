"""The basement under the tall house (villa v2 spec §12 "Basement"): a wine cellar, a karaoke lounge, a spa with its
sauna and stone hot tub, a gym, a shower room and the hall at the foot of the spiral stair, which comes down from the
living room, with a light well dug into the lawn in front of the house that lights the spa through a glass
wall.

Like garden/, pond/ and carport/: the plain-data basement_layout.py, checked by layout_check.py before anything is
built, and the generator build_basement.py that turns it into blender/modules/basement.blend with archkit. The layout,
layout_check.py and interact.py are pure Python; build_basement.py needs bpy.
"""

"""The decor pass of the tall house (villa v2 spec §12 "Curtains and accessories"): the curtains along its glazing, as tall as the
rooms they hang in, and the accessories that furnish its rooms (cushions, throws, table decor, lamps, plants, art, a
buffet, a console, benches, the dining table laid, the kitchen counter's things, bath accessories, rugs).

Like basement/: the plain-data interior_layout.py, checked by layout_check.py before anything is built, and the generator
build_interior.py that turns it into blender/modules/interior.blend with archkit. A module of its own in the house's slot,
so the house keeps its triangle budget. The layout, layout_check.py and interact.py are pure Python; build_interior.py
needs bpy.
"""

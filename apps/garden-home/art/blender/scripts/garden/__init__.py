"""The garden of the yard (art/README.md, Garden): the fence round the island and its gates, the stone walk and the driveway
with their bollards, the flower beds, the vegetable garden and the barbecue terrace.

Like houses/: one plain-data *_layout.py per module, checked by layout_check.py before anything is built, and one
generator build_*.py per module that turns it into blender/modules/<module>.blend with archkit (assemble.py holds what
the generators share). The layouts, shapes.py, layout_check.py and interact.py are pure Python; assemble.py and
build_*.py need bpy.
"""

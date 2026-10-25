"""The koi pond and the tea corner by it (villa v2 part 3): a big pond dug into the lawn with a rockery and
its waterfall, many koi and lotus, and a stone tea table with its stools, bonsai and a stone lantern.

Like garden/ (part 2): one plain-data *_layout.py per module, checked by layout_check.py before anything is built, and
one generator build_*.py per module that turns it into blender/modules/<module>.blend with archkit, through garden's
assemble.py. basin.py holds the shape of the pond, swim.py the paths the koi swim (the website moves them along the
same paths in a vertex shader, src/systems/koi.ts). The layouts, basin.py, swim.py, layout_check.py and
interact.py are pure Python; build_*.py need bpy.
"""

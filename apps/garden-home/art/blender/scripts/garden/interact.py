"""What a click toggles in the garden (interaction spec §3.1, villa v2 part 2). Pure Python.

The garden's lights are one group, lights:garden "Đèn sân vườn", across four modules: the bollards along the walk and
the driveway (garden_paths), the lanterns on the gate pillars (fence), the string lights under the barbecue pergola
(bbq_area) and the stone lantern of the tea corner by the koi pond (tea_garden, part 3). The grill is the group bbq
"Bếp nướng": the grill itself (a still object, which casts its shadow by day) and its coals, which glow while it is on
(the website's toggles, like the house's lights). A garden group's pieces are merged into one object
(garden/assemble.py), so the tag goes on that object, and layout_check keeps such a group to pieces of the one interact
group.
"""
from houses.interact import GROUP_RE  # noqa: F401  (the website reads garden and house ids alike)

# The catalog kinds a click toggles, with their group, and the hover label of each group.
GROUPS = {"garden_lamp": "lights:garden", "pillar_lamp": "lights:garden", "bbq_grill": "bbq", "bbq_coals": "bbq",
          "stone_lantern": "lights:garden"}
LABELS = {"lights:garden": "Đèn sân vườn", "bbq": "Bếp nướng"}
STRING_GROUP = "lights:garden"  # the string lights of a garden layout's STRING_LIGHTS


def tags(layout):
    """{object name: custom properties} for every interactive object of a garden layout: "interact" and "label" on the
    object of each PIECES group that holds a toggled kind, and on every string of STRING_LIGHTS."""
    found = {}
    for kind, group, *_ in layout.PIECES:
        if kind in GROUPS:
            found[group] = {"interact": GROUPS[kind], "label": LABELS[GROUPS[kind]]}
    for string in getattr(layout, "STRING_LIGHTS", []):
        found[string["name"]] = {"interact": STRING_GROUP, "label": LABELS[STRING_GROUP]}
    return found

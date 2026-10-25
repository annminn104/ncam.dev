"""What a click toggles at the koi pond (interaction spec §3.1, villa v2 part 3). Pure Python.

The waterfall is the group waterfall "Waterfall": the rockery it falls from, the falling sheet of water and the foam at
its foot. Like the house's wall fountain it runs while on auto, and a click stops it (the website hides the sheet and
the foam) or starts it again. The pond's water is the group koi "Feed the koi", which a click does not toggle: it feeds the
koi, which gather where it fell for a few seconds (src/systems/koi.ts). The stone lantern of the tea corner joins
the garden's lights (lights:garden, garden/interact.py).
"""
from houses.interact import GROUP_RE  # noqa: F401  (the website reads pond, garden and house ids alike)

GROUP, LABEL = "waterfall", "Waterfall"
FEED, FEED_LABEL = "koi", "Feed the koi"
ROCKERY, SHEET, FOAM, WATER = "Rockery", "WATER_waterfall_sheet", "Waterfall_foam", "WATER_surface"


def tags(layout):
    """{object name: custom properties} for every interactive object of a koi pond layout: the rockery, the sheet of
    falling water and the foam of its WATERFALL, and the water when koi swim in it."""
    found = {}
    if getattr(layout, "WATERFALL", None):
        found.update({name: {"interact": GROUP, "label": LABEL} for name in (ROCKERY, SHEET, FOAM)})
    if getattr(layout, "KOI", None):
        found[WATER] = {"interact": FEED, "label": FEED_LABEL}
    return found

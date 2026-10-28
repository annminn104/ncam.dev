"""The flower beds, pots, clipped shrubs and palms of the garden (art/README.md, Garden) as plain data. Pure Python.

An island-wide module like the fence (module space is site space), checked with the fence and the paths so that nothing
stands on them (layout_check.check_island). The travertine-edged flower beds stand end to end in borders, which read as
planting from the wallpaper's distance where single beds dotted over the lawn read as a grid of crates: one down either
side of the walk from the main gate (the bollards between it and the walk), and one along the south edge of the pond
zone (the zone itself is kept for part 3), branching off the walk's right-hand border. Clipped cones and balls mark the
borders' ends, a pot either side of the front steps, palms at both gates, behind the pool and by the driveway. Every
piece sways (wind) and they are all one object, Flower_beds: one draw call per material for the whole garden, and none
in the shadow pass (SHADOWLESS).
"""
from siteplan import zones

MODULE_ID = "flower_beds"
ROLE = "prop"
FOOTPRINT = zones.ISLAND["size"]
ISLAND_WIDE = True
ZONES_USED = ()

GROUP = "Flower_beds"
SHADOWLESS = (GROUP,)  # low beds and pots: the website leaves them out of the shadow pass, which cost frame time
WIND = {"wind": True}
WALK_X = 1.95  # either side of the walk: the beds (0.9 m across) stand 0.5 m off its zone, the bollards (x 1.3) between
WALK_Y = (-18.9, -16.9, -14.9, -12.9)  # 2 m beds end to end, from just inside the main gate past the pond zone's corner
POND_Y = -15.5  # along the pond zone's south edge (y -15), 5 cm off it
POND_X = (3.5, 5.5, 7.5, 9.5)  # from the walk's right-hand border (x 2.4) eastwards
DOOR_Y = 1.45  # the pots either side of the front steps stand in front of the house's zone (y 2)


def _bed(x, y, rot, variant):
    return ("flower_bed", GROUP, (x, y), rot, {"variant": variant, **WIND})


def _pot(x, y, variant):
    return ("flower_pot", GROUP, (x, y), 0, {"variant": variant, **WIND})


def _plant(kind, x, y):
    return (kind, GROUP, (x, y), 0, WIND)


# down either side of the walk: a clipped cone at the gate end (0.3 m off the first bed), a clipped ball at the other
_WALK = ([_bed(side * WALK_X, y, 90, (k + (side > 0)) % 4) for side in (-1, 1) for k, y in enumerate(WALK_Y)]
         + [_plant("topiary_cone", side * WALK_X, WALK_Y[0] - 1.65) for side in (-1, 1)]
         + [_plant("topiary_ball", side * WALK_X, WALK_Y[-1] + 1.5) for side in (-1, 1)])
# along the pond zone's south edge, on from the walk's right-hand border, a clipped ball at its east end
_POND = ([_bed(x, POND_Y, 0, (k + 2) % 4) for k, x in enumerate(POND_X)]
         + [_plant("topiary_ball", POND_X[-1] + 1.6, POND_Y)])
# a pot either side of the front steps (the door at x 6.1), palms at both gates, behind the pool (between the barbecue's
# zone and the tall house's) and by the driveway
_ACCENTS = ([_pot(4.55, DOOR_Y, 1), _pot(7.6, DOOR_Y, 2)]
            + [_plant("palm_tall", x, y) for x, y in ((-3.2, -20.8), (3.2, -20.8), (13.3, -19.5), (20.3, -17.3),
                                                      (-14.0, 2.6), (11.3, 0.8))])
PIECES = _WALK + _POND + _ACCENTS

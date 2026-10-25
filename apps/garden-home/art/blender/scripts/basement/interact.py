"""What a click toggles in the basement (interaction spec §3.1, villa v2 spec §12 "Basement") and what the website's
cut does to its objects. Pure Python.

The groups, like the house's (houses/interact.py), on the objects build_basement.py makes:

- light:<room>, every room's lights: its downlights with the pools of light they cast on the floor (LT_down_<room>; the
  spa's candles are in its object too) and its wall switch (Switch_<room>), which hangs under the cut;
- party "Party mode", the karaoke's party mode: the TV with the speakers and the microphones (Karaoke_party, whose
  screen lights up), the LED strips round the room with the light they cast on the carpet (LED_party, whose colours the
  website cycles while it is on) and the disco ball (Disco_ball), whose clip ambient_disco_ball turns it while it is on;
  on auto it is off, whatever the hour;
- sauna "Sauna": the stove's stones and the warm strip under the bench (Sauna_stove), which glow while it
  runs; off on auto;
- jacuzzi:spa "Soaking tub", the spa's hot tub: the tub, its water and its bubbles, which bob in ambient_hot_tub while it
  runs, like the roof's jacuzzi; on auto it runs;
- lights:garden "Garden lights": the light well's uplights and the light they wash its walls with, the garden's lights.

uncut(layout) names what stands whole under the basement's cut, with its top (build_basement tags it `uncut` and
`cut_top`): the retaining walls and the slab's edge round the pit, the light well and the disco ball, which hangs from
the ceiling the cut takes away. buried(layout) names what the website draws only under that cut: everything but the spa
behind the light well's glass, the hall under the stair's hole and what stands round them.

Each room's light object is the light its downlights cast on the floor (and the spa's candles): the discs themselves would
hang in the ceiling, which the cut takes away and the plinth hides otherwise.
"""
from archkit.catalog import FURNITURE, WALL_MOUNTED
from garden.interact import LABELS as GARDEN_LABELS
from houses.interact import CUT_TOP_STUB, GROUP_RE  # noqa: F401  (the website reads basement and house ids alike)

PARTY, PARTY_LABEL = "party", "Party mode"
SAUNA, SAUNA_LABEL = "sauna", "Sauna"
TUB, TUB_LABEL = "jacuzzi:spa", "Soaking tub"
GARDEN = "lights:garden"
DISCO_CLIP = "ambient_disco_ball"
BUBBLES = "a"  # the hot tub's one group of bubbles, <tub>_bubbles_a (archkit.rooftop)


def tub_clip(layout):
    """The clip the hot tub's bubbles bob in: ambient_<tub> in lower case (archkit.rooftop)."""
    return f"ambient_{layout.TUB.lower()}"


def tags(layout):
    """{object name: custom properties} for every interactive object of the basement: "interact" and "label", plus
    "clip" on the disco ball and the hot tub."""
    labels = layout.ROOM_LABELS
    found = {}
    for group in layout.DOWNLIGHTS:
        room = group["room"]
        found[group["name"]] = {"interact": f"light:{room}", "label": f"{labels[room]} lights"}
    for kind, name, room, *_ in layout.FURNITURE:
        if kind == "light_switch":
            found[name] = {"interact": f"light:{room}", "label": f"{labels[room]} light switch"}
    for name in (layout.PARTY, layout.LEDS):
        found[name] = {"interact": PARTY, "label": PARTY_LABEL}
    found[layout.DISCO] = {"interact": PARTY, "label": PARTY_LABEL, "clip": DISCO_CLIP}
    found[layout.SAUNA] = {"interact": SAUNA, "label": SAUNA_LABEL}
    found[layout.TUB] = {"interact": TUB, "label": TUB_LABEL, "clip": tub_clip(layout)}
    for name in (layout.TUB_WATER["name"], f"{layout.TUB}_bubbles_{BUBBLES}"):
        found[name] = {"interact": TUB, "label": TUB_LABEL}
    found[layout.WELL_LIGHTS] = {"interact": GARDEN, "label": GARDEN_LABELS[GARDEN]}
    return found


def _tops(layout):
    """The height of the top of every uncut object of the layout, module space."""
    tops = {layout.WALLS: layout.CEIL, layout.RIM: 0.0, layout.DISCO: layout.CEIL,
            layout.WELL_OBJECT: layout.COPING, layout.WELL_RAIL["object"]: layout.COPING + layout.WELL_RAIL["height"]}
    for kind, obj, (_x, _y, z), *_ in layout.WELL_PIECES:
        tops[obj] = max(tops.get(obj, z), z + WALL_MOUNTED.get(kind, 0.0) + FURNITURE[kind][2])
    for wash in layout.WASHES:
        top = wash["center"][2] + wash.get("height", wash["radius"])
        tops[wash["group"]] = max(tops.get(wash["group"], top), top)
    for _start, _end, z in getattr(layout, "WELL_STRIPS", []):
        tops[layout.WELL_LIGHTS] = max(tops.get(layout.WELL_LIGHTS, z), z)
    return tops


def uncut(layout):
    """{name: cut_top} for the objects that stand whole under the basement's cut, in OBJECTS order: cut_top is the height
    of the object's top plus CUT_TOP_STUB in module space (the website clips them no lower)."""
    tops = _tops(layout)
    return {name: round(tops[name] + CUT_TOP_STUB, 3) for name, spec in layout.OBJECTS.items() if spec.get("uncut")}


def buried(layout):
    """The objects the website draws only under the basement's cut, in build order: those OBJECTS marks so, and every
    wall switch (under the plinth only a click under the cut reaches one, and the spa's is a pixel through the light
    well's glass, a draw call or two on the wallpaper)."""
    found = [name for name, spec in layout.OBJECTS.items() if spec.get("buried")]
    found += [name for kind, name, *_ in layout.FURNITURE if kind == "light_switch"]
    return found

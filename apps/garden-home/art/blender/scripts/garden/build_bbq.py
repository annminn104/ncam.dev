"""Generate blender/modules/bbq_area.blend from garden/bbq_layout.py (villa v2 part 2): the travertine terrace with the
table for six, the outdoor kitchen, the parasol and its armchairs (BBQ_terrace), the teak pergola (Pergola), the
charcoal grill (BBQ_grill, which casts its shadow) and its coals (BBQ_coals, a night light), both of the click group
bbq, the planters (BBQ_plants, swaying) and the string lights under the pergola (String_lights_bbq, lights:garden).

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/garden/build_bbq.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import lighting, structure  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from garden import assemble  # noqa: E402
from garden import bbq_layout as L  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "bbq_area.blend")


def build(col, mats):
    teak = {**mats, "frame": mats["teak"], "wood": mats["teak"]}  # the pergola and the side table all in golden teak
    p = L.PERGOLA
    structure.pergola(col, p["name"], p["min"], p["max"], 0.0, p["height"], p["slats"], teak, post=p["post"])
    x0, y0, x1, y1 = L.PAVING
    terrace = MeshBuilder(L.STILL)
    terrace.box((x0, y0, 0.0), (x1, y1, L.PAVING_TOP), mats["stone"], uv_tile=1.2)
    assemble.pieces(col, L, {**mats, "wood": mats["teak"]}, builders={L.STILL: terrace})
    for string in L.STRING_LIGHTS:
        lighting.string_lights(col, string["name"], string["points"], mats, bulbs_per_m=string["bulbs_per_m"],
                               sag=string["sag"], bulb_radius=string["bulb_radius"])


assemble.generate(L, build, "Generate the barbecue terrace module", DEFAULT_OUT)

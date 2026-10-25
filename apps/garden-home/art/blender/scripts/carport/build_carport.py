"""Generate blender/modules/carport.blend from carport/carport_layout.py (villa v2 part 4): the travertine slab
(Carport_floor, which casts no shadow); the roof's white fascia frame, its teak louvres and the white beams under them,
the dark steel posts, the travertine pillar and back wall, the teak cabinet and the bicycle (Carport, of the click group
lights:carport); the roof's glass sheet over the louvres (Carport_glass, of no click group, so the website's pick looks
through it to a car); the downlights under the beams with the pools of light they cast on the floor (Carport_lights, a
night light of lights:carport); the pickup and the supercar, each as its body (Pickup, Supercar) and its head and tail
lights with the light they cast ahead (Pickup_lights, Supercar_lights, night lights), both of the car's own click group.

Usage:
  "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 \
    -P blender/scripts/carport/build_carport.py -- [--out PATH] [--force]

An existing file is left alone unless --force is given.
"""
import math
import os
import sys

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

from archkit import furniture  # noqa: E402
from archkit.mesh import MeshBuilder  # noqa: E402
from carport import interact, layout_check  # noqa: E402
from carport import carport_layout as L  # noqa: E402
from garden import assemble  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(SCRIPTS), "modules", "carport.blend")
GLASS = 0.012  # the roof's glass sheet
TUBE = 0.018  # the bicycle's frame tubes
RIM_SIDES = 12


def _rim(mb, mat, centre, outer, inner, width):
    """A bicycle wheel standing across Y at `centre` (x, y, z): a flat ring from `inner` to `outer`, `width` thick."""
    x, y, z = centre
    rings = [[(x + radius * math.cos(a), y + side * width / 2, z + radius * math.sin(a))
              for a in (2 * math.pi * k / RIM_SIDES for k in range(RIM_SIDES))]
             for radius, side in ((outer, -1), (outer, 1), (inner, 1), (inner, -1))]
    points = [p for ring in rings for p in ring]
    faces = []
    for r in range(4):  # outer tread, the +Y side, the inner face, the -Y side
        a, b = r * RIM_SIDES, ((r + 1) % 4) * RIM_SIDES
        faces += [(a + k, b + k, b + (k + 1) % RIM_SIDES, a + (k + 1) % RIM_SIDES) for k in range(RIM_SIDES)]
    mb.faces(points, faces, mat)


def bicycle(mb, mats, centre, wheel, base, z):
    """A black bicycle along X standing on height z: two wheels `base` apart, a diamond frame, saddle and handlebar."""
    x, y = centre
    dark = mats["frame"]
    rear, front = (x - base / 2, y, z + wheel), (x + base / 2, y, z + wheel)
    for hub in (rear, front):
        _rim(mb, dark, hub, wheel, wheel - 0.04, 0.035)
    crank = (x - 0.08, y, z + wheel - 0.04)
    seat = (x - 0.24, y, z + wheel + 0.48)
    head = (x + 0.36, y, z + wheel + 0.5)
    for a, b in ((rear, crank), (rear, seat), (crank, seat), (seat, head), (crank, head), (head, front)):
        mb.stem(a, b, TUBE, dark, segments=4)
    post = (x - 0.27, y, z + wheel + 0.62)
    mb.stem(seat, post, TUBE, dark, segments=4)
    mb.box((post[0] - 0.12, y - 0.07, post[2]), (post[0] + 0.1, y + 0.07, post[2] + 0.05), dark)
    bar = (x + 0.33, y, z + wheel + 0.68)
    mb.stem(head, bar, TUBE, dark, segments=4)
    mb.stem((bar[0], y - 0.27, bar[2]), (bar[0], y + 0.27, bar[2]), TUBE, dark, segments=4)


def _inside_fascia():
    """(x0, y0), (x1, y1) of the roof inside its fascia frame."""
    (rx0, ry0), (rx1, ry1), fascia = L.ROOF["min"], L.ROOF["max"], L.ROOF["fascia"]
    return (rx0 + fascia, ry0 + fascia), (rx1 - fascia, ry1 - fascia)


def carport(col, mats):
    """The roof (fascia, louvres, beams), the posts, pillar and wall, the cabinet and the bicycle, in one object."""
    mb = MeshBuilder(L.STILL)
    roof, louvres, beams = L.ROOF, L.LOUVRES, L.BEAMS
    found = layout_check.heights(L)
    (rx0, ry0), (rx1, ry1) = roof["min"], roof["max"]
    (ix0, iy0), (ix1, iy1) = _inside_fascia()
    for x0, y0, x1, y1 in ((rx0, ry0, rx1, iy0), (rx0, iy1, rx1, ry1), (rx0, iy0, ix0, iy1), (ix1, iy0, rx1, iy1)):
        mb.box((x0, y0, roof["under"]), (x1, y1, roof["top"]), mats["white"])
    slat = louvres["slat"]
    step = (ix1 - ix0 - slat) / (louvres["slats"] - 1)
    for k in range(louvres["slats"]):
        x = ix0 + slat / 2 + k * step
        mb.box((x - slat / 2, iy0, found["slats"]), (x + slat / 2, iy1, found["glass"]), mats["teak"], uv_tile=2.0)
    for y in beams["ys"]:
        mb.box((ix0, y - beams["width"] / 2, found["beams"]), (ix1, y + beams["width"] / 2, found["slats"]),
               mats["white"])
    for px, py in L.POSTS:
        mb.box((px - L.POST / 2, py - L.POST / 2, L.SLAB_TOP), (px + L.POST / 2, py + L.POST / 2, roof["under"]),
               mats["frame"])
    (cx, cy), size = L.PILLAR["center"], L.PILLAR["size"]
    mb.box((cx - size / 2, cy - size / 2, 0.0), (cx + size / 2, cy + size / 2, roof["under"]), mats["stone"],
           uv_tile=1.2)
    wx0, wy0, wx1, wy1 = L.WALL
    mb.box((wx0, wy0, 0.0), (wx1, wy1, roof["under"]), mats["stone"], uv_tile=1.2)
    (kx0, ky0), (kx1, ky1) = L.CABINET["min"], L.CABINET["max"]
    top = L.SLAB_TOP + L.CABINET["height"]
    mb.box((kx0, ky0, L.SLAB_TOP), (kx1, ky1, top), mats["teak"], uv_tile=2.0)
    doors = 4
    for k in range(1, doors):  # the seams between its doors and a handle on each
        x = kx0 + (kx1 - kx0) * k / doors
        mb.box((x - 0.006, ky0 - 0.006, L.SLAB_TOP + 0.08), (x + 0.006, ky0, top - 0.04), mats["frame"])
    for k in range(doors):
        x = kx0 + (kx1 - kx0) * (k + (0.85 if k % 2 == 0 else 0.15)) / doors
        mb.box((x - 0.012, ky0 - 0.025, L.SLAB_TOP + 0.9), (x + 0.012, ky0, L.SLAB_TOP + 1.2), mats["frame"])
    bicycle(mb, mats, L.BIKE["center"], L.BIKE["wheel"], L.BIKE["base"], L.SLAB_TOP)
    return mb.build(col)


def glass(col, mats):
    """The roof's glass sheet over the louvres, inside the fascia: an object of its own and of no click group, as the
    website keeps a glass hit only on an interactive item (src/interact/pick.ts), so the pointer finds the car
    under it."""
    mb = MeshBuilder(L.GLASS)
    (ix0, iy0), (ix1, iy1) = _inside_fascia()
    bottom = layout_check.heights(L)["glass"]
    mb.box((ix0, iy0, bottom), (ix1, iy1, bottom + GLASS), mats["glass"])
    return mb.build(col)


def downlights(col, mats):
    """The downlights under the beams, and the pools of light they cast on the floor at night."""
    mb = MeshBuilder(L.LIGHTS)
    under = layout_check.heights(L)["beams"]
    for x, y in L.DOWNLIGHTS:
        mb.cylinder((x, y, under - 0.02), L.DOWNLIGHT_RADIUS, 0.02, mats["led"], segments=10)
    for pool in L.POOLS:
        x, y = pool["center"]
        mb.disc((x, y, L.SLAB_TOP + L.POOL_LIFT), pool["radius"], mats["glow_pool"], start=pool["start"],
                sweep=pool["sweep"])
    return mb.build(col, night_light=True)


def cars(col, mats):
    """Every car of CARS on the slab, as its body and its lights (a night light, with the pool of light its headlights
    cast ahead of it)."""
    beams = {pool["group"]: pool for pool in layout_check.car_pools(L)}
    for car in L.CARS:
        body = MeshBuilder(car["name"])
        furniture.place_into(body, car["kind"], (*car["pos"], L.SLAB_TOP), car["rot"], mats, part="body")
        body.build(col)
        lights = MeshBuilder(car["lights"])
        furniture.place_into(lights, car["kind"], (*car["pos"], L.SLAB_TOP), car["rot"], mats, part="lights")
        beam = beams[car["lights"]]
        lights.disc((*beam["center"], L.HEADLIGHT_POOL_TOP), beam["radius"], mats["glow_beam"],
                    start=beam["start"], sweep=beam["sweep"])
        lights.build(col, night_light=True)


def build(col, mats):
    floor = MeshBuilder(L.FLOOR)
    x0, y0, x1, y1 = L.SLAB
    floor.box((x0, y0, 0.0), (x1, y1, L.SLAB_TOP), mats["stone"], uv_tile=1.2)
    floor.build(col, cast_shadow=False)  # 4 cm on the lawn: its shadow pass would cost and show nothing
    carport(col, mats)
    glass(col, mats)
    downlights(col, mats)
    cars(col, mats)


def problems(layout):
    return layout_check.check_carport(layout) + layout_check.check_carport_site(layout)


assemble.generate(L, build, "Generate the carport module", DEFAULT_OUT, check=problems, tags=interact.tags)

"""The cars of the carport (art/README.md, Carport and dog): a double-cab pickup truck and a convertible supercar with its top down,
generic designs with no badges or logos.

Low-poly like the rest of the kit: a body lofted along Y through stations (per station a hexagon: its bottom corners,
its shoulders and the corners of its top), its bottom edge rising over the wheel arches; a pickup's cab is a block of
tinted glass under a painted roof, its pillars thin stems, its cargo bed open behind it; the supercar's cockpit is a
dark tub in its top with the seat backs and the steering wheel rising out of it behind a raked windscreen. Wheels are
twelve-sided tyres standing on a corner, with a chrome rim and a dark hub on their outer face. Each builder takes
part="body" or part="lights" (both by default): the carport builds a car's head and tail lights into an object of their
own, a night light a click switches (carport/interact.py), and its body into another.
"""
import math

PARTS = ("body", "lights")
TYRE_SIDES = 12
ARCH_STEPS = 5  # the segments of a wheel arch's edge (and of a fender flare round it)


def _parts(kind, part):
    if part is not None and part not in PARTS:
        raise ValueError(f"{kind} part must be one of {PARTS} or None, got {part!r}")
    return {part} if part else set(PARTS)


def _at(profile, y):
    """The piecewise-linear `profile` [(y, value)], y ascending, at y; flat past its ends."""
    if y <= profile[0][0]:
        return profile[0][1]
    for (y0, v0), (y1, v1) in zip(profile, profile[1:]):
        if y <= y1:
            return v0 + (v1 - v0) * (y - y0) / (y1 - y0)
    return profile[-1][1]


def _arch_points(arch, clearance):
    """The edge of a wheel arch (axle y, axle z, radius) over the wheel, front to back: ARCH_STEPS + 1 points (y, z)
    from where it leaves the sill at `clearance`, or from the axle's height when the sill is lower (a low car's arch
    then drops straight down to it)."""
    ya, za, ra = arch
    start = math.asin(min(1.0, (clearance - za) / ra)) if clearance > za else 0.0
    angles = [start + (math.pi - 2 * start) * k / ARCH_STEPS for k in range(ARCH_STEPS + 1)]
    return [(ya - ra * math.cos(a), za + ra * math.sin(a)) for a in angles]


def _bottom(y, clearance, arches):
    """The height of a body's bottom edge at y: its clearance, rising over every wheel arch."""
    z = clearance
    for ya, za, ra in arches:
        if abs(y - ya) < ra:
            z = max(z, za + math.sqrt(ra * ra - (y - ya) ** 2))
    return z


def _stations(y0, y1, profiles, clearance, arches):
    """Loft stations (y, bottom, shoulder, top, half width low, half width at the top) from y0 to y1: at every
    control point of the profiles (shoulder, top, low, high), along the edge of every arch in between and, where an
    arch drops straight down to a low sill, just either side of that edge."""
    ys = {y0, y1}
    ys |= {y for profile in profiles.values() for y, _ in profile if y0 < y < y1}
    ys |= {y for arch in arches for y, _ in _arch_points(arch, clearance) if y0 < y < y1}
    ys |= {y for ya, za, ra in arches if clearance < za for y in (ya - ra - 0.002, ya - ra + 0.002, ya + ra - 0.002,
                                                                  ya + ra + 0.002) if y0 < y < y1}
    return [(y, _bottom(y, clearance, arches), _at(profiles["shoulder"], y), _at(profiles["top"], y),
             _at(profiles["low"], y), _at(profiles["high"], y)) for y in sorted(ys)]


def _loft(mb, mat, stations, tuck=None):
    """A body lofted along Y through `stations`, front to back: per station a hexagon (bottom corners, shoulders, top
    corners), ring to ring in quads, capped at both ends. A shoulder above the top makes a fender's crest. `tuck`
    (inset, height) draws the bottom corners in by `inset`, the side coming down straight to `height` over the bottom
    (less where a wheel arch leaves less side): the sill rolls under like a sports car's."""
    ring = []
    for y, bottom, shoulder, top, low, high in stations:
        side = [(-low, y, bottom), (-low, y, shoulder), (-high, y, top)]
        if tuck is not None:
            inset, height = tuck
            side = [(-low + inset, y, bottom), (-low, y, bottom + min(height, (shoulder - bottom) / 2))] + side[1:]
        ring.append(side + [(-x, y, z) for x, y, z in reversed(side)])
    n = len(ring[0])
    points = [p for station in ring for p in station]
    faces = [tuple(reversed(range(n)))]  # the front cap, facing -Y
    for s in range(len(stations) - 1):
        a, b = n * s, n * (s + 1)
        faces += [(a + j, a + (j + 1) % n, b + (j + 1) % n, b + j) for j in range(n)]
    last = n * (len(stations) - 1)
    mb.faces(points, faces + [tuple(range(last, last + n))], mat)


def _block(mb, mat, bottom, top):
    """A closed solid of six faces between four corners at its bottom and the four above them, both counter-clockwise
    seen from above: a raked seat back, a sloping windscreen, a roof panel."""
    points = list(bottom) + list(top)
    mb.faces(points, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat)


def _prism_x(mb, mat, x0, x1, ring):
    """A prism along X from x0 to x1 (x0 < x1) over `ring`, (y, z) points counter-clockwise seen from +X: a tyre, a
    fender flare's segment."""
    n = len(ring)
    points = [(x0, y, z) for y, z in ring] + [(x1, y, z) for y, z in ring]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    mb.faces(points, faces, mat)


def _round(y, z, radius, sides):
    """`sides` points round (y, z), counter-clockwise from +X, one corner straight down: a tyre stands on it."""
    return [(y + radius * math.cos(a), z + radius * math.sin(a))
            for a in (-math.pi / 2 + 2 * math.pi * k / sides for k in range(sides))]


def _wheel(mb, m, x, y, radius, width):
    """A tyre standing on the ground at (x, y), `width` across X, with a chrome rim and a dark hub proud of its outer
    face, the one away from the car's middle line."""
    out = 1.0 if x > 0 else -1.0
    _prism_x(mb, m["rubber"], x - width / 2, x + width / 2, _round(y, radius, radius, TYRE_SIDES))
    face = x + out * width / 2
    rim = sorted((face - out * 0.02, face + out * 0.006))
    _prism_x(mb, m["chrome"], *rim, _round(y, radius, 0.62 * radius, 10))
    hub = sorted((face, face + out * 0.014))
    _prism_x(mb, m["rubber"], *hub, _round(y, radius, 0.22 * radius, 6))


def _flares(mb, mat, low, arches, clearance, depth, reach):
    """Black flares round the wheel arches on both sides: bands `depth` wide following each arch's edge, standing out
    `reach` from the body's side at `low`."""
    for arch in arches:
        inner = _arch_points(arch, clearance)
        ya, za, ra = arch
        outer = [(ya + (y - ya) * (ra + depth) / ra, za + (z - za) * (ra + depth) / ra) for y, z in inner]
        for k in range(ARCH_STEPS):
            ring = [inner[k], inner[k + 1], outer[k + 1], outer[k]]
            if ring[1][0] < ring[0][0]:
                ring.reverse()
            for side in (-1.0, 1.0):
                x0, x1 = sorted((side * (low - 0.02), side * (low + reach)))
                _prism_x(mb, mat, x0, x1, ring)


# The pickup: body half widths, its wheels (radius, tyre width, axles), the height its sill stands at, where its
# windscreen stands on the hood and where its cab ends, its bed's floor and the top of the bed's rails.
PICKUP_LOW, PICKUP_HIGH = 0.88, 0.85
PICKUP_WHEEL = (0.4, 0.3)
PICKUP_AXLES = (-1.72, 1.55)
PICKUP_SILL = 0.5
PICKUP_CAB = (-1.15, 0.8)
PICKUP_BED = (0.92, 1.2)


def pickup_truck(mb, m, w, d, h, part=None):
    # A double-cab pickup about 5.3 m long, nose to the front (-Y), in a deep metallic green: a tall hood over a chrome
    # grille between the headlights, a cab of tinted glass with four doors under a roof with black roof bars, an open
    # cargo bed with a black liner behind it, chunky tyres under black flares, side steps and a chrome rear bumper; the
    # tail lights stand up at the corners of the bed.
    parts = _parts("pickup_truck", part)
    half = d / 2
    radius, tyre = PICKUP_WHEEL
    arches = [(axle, radius, radius + 0.07) for axle in PICKUP_AXLES]
    low, high = PICKUP_LOW, PICKUP_HIGH
    floor, rail = PICKUP_BED
    front, back = PICKUP_CAB
    if "body" in parts:
        paint, glass, black, chrome = m["paint_green"], m["glass_tinted"], m["rubber"], m["chrome"]
        nose = {"shoulder": [(-half + 0.05, 0.98), (-half + 0.14, 1.04), (back, 1.05)],
                "top": [(-half + 0.05, 1.06), (-half + 0.14, 1.13), (front, 1.17), (back, 1.17)],
                "low": [(-half + 0.05, low - 0.04), (-half + 0.3, low)], "high": [(-half + 0.05, high - 0.06),
                                                                               (-half + 0.3, high)]}
        _loft(mb, paint, _stations(-half + 0.05, back, nose, PICKUP_SILL, arches))
        bed = {"shoulder": [(0.0, floor - 0.02)], "top": [(0.0, floor)], "low": [(0.0, low)],
               "high": [(0.0, low - 0.01)]}
        _loft(mb, paint, _stations(back + 0.002, half - 0.03, bed, PICKUP_SILL, arches))
        # the bed: its rails, the wall behind the cab, the tailgate and the black liner on its floor
        for side in (-1.0, 1.0):
            x0, x1 = sorted((side * low, side * (low - 0.07)))
            mb.box((x0, back, floor), (x1, half - 0.02, rail), paint)
        mb.box((-low + 0.07, back, floor), (low - 0.07, back + 0.07, rail), paint)
        mb.box((-low + 0.07, half - 0.08, 0.66), (low - 0.07, half - 0.02, rail), paint)
        mb.box((-low + 0.07, back + 0.07, floor), (low - 0.07, half - 0.08, floor + 0.006), black)
        # the cab: tinted glass under a painted roof, A and C pillars in the paint, black B pillars and roof bars
        foot, crown = (front, back - 0.02), (front + 0.65, back - 0.1)
        waist, top = 1.17, 1.78
        _block(mb, glass, [(-high, foot[0], waist), (high, foot[0], waist), (high, foot[1], waist),
                           (-high, foot[1], waist)],
               [(-0.76, crown[0], top), (0.76, crown[0], top), (0.76, crown[1], top), (-0.76, crown[1], top)])
        _block(mb, paint, [(-0.79, crown[0] - 0.03, top), (0.79, crown[0] - 0.03, top), (0.79, crown[1] + 0.02, top),
                           (-0.79, crown[1] + 0.02, top)],
               [(-0.76, crown[0], top + 0.03), (0.76, crown[0], top + 0.03), (0.76, crown[1], top + 0.03),
                (-0.76, crown[1], top + 0.03)])
        for side in (-1.0, 1.0):
            mb.stem((side * high, foot[0], waist), (side * 0.765, crown[0], top), 0.035, paint, segments=4)
            mb.stem((side * high, foot[1], waist), (side * 0.765, crown[1], top), 0.04, paint, segments=4)
            mb.stem((side * high, -0.2, waist), (side * 0.77, -0.12, top), 0.03, black, segments=4)
            x0, x1 = sorted((side * 0.56, side * 0.6))
            mb.box((x0, crown[0] + 0.08, top + 0.03), (x1, crown[1] - 0.06, h), black)  # the roof bars
        for y in (crown[0] + 0.2, crown[1] - 0.2):
            mb.box((-0.56, y - 0.02, h - 0.025), (0.56, y + 0.02, h), black)
        mb.box((-0.8, front + 0.2, waist), (0.8, back - 0.1, 1.42), black)  # dash, seats and headrests behind glass
        # the nose: grille, bumper and skid plate; mirrors, side steps and flares; the chrome rear bumper
        mb.box((-0.52, -half, 0.78), (0.52, -half + 0.07, 1.04), chrome)
        mb.box((-low, -half, PICKUP_SILL - 0.04), (low, -half + 0.16, 0.78), black)
        mb.box((-0.45, -half + 0.03, PICKUP_SILL - 0.1), (0.45, -half + 0.26, PICKUP_SILL - 0.04), chrome)
        for side in (-1.0, 1.0):
            x0, x1 = sorted((side * 0.84, side * w / 2))
            mb.box((x0, front + 0.02, 1.19), (x1, front + 0.16, 1.33), black)
            x0, x1 = sorted((side * 0.76, side * (low + 0.02)))
            mb.box((x0, PICKUP_AXLES[0] + 0.5, PICKUP_SILL - 0.1), (x1, PICKUP_AXLES[1] - 0.52, PICKUP_SILL - 0.05),
                   black)
        _flares(mb, black, low, arches, PICKUP_SILL, 0.07, 0.05)
        mb.box((-low, half - 0.1, PICKUP_SILL - 0.02), (low, half, 0.66), chrome)
        for axle in PICKUP_AXLES:
            for side in (-1.0, 1.0):
                _wheel(mb, m, side * (low - 0.03 - tyre / 2), axle, radius, tyre)
        mb.box((-0.78, -half + 0.4, 0.0), (0.78, half - 0.4, 0.004), black)  # the shade under the car
    if "lights" in parts:
        for side in (-1.0, 1.0):
            x0, x1 = sorted((side * 0.56, side * 0.84))
            mb.box((x0, -half, 0.9), (x1, -half + 0.06, 1.04), m["headlight"])
            x0, x1 = sorted((side * (low - 0.06), side * (low + 0.005)))
            mb.box((x0, half - 0.03, 0.92), (x1, half, 1.18), m["taillight"])


# The supercar: its wheels (radius, front and rear tyre widths, axles), the height of its sill and how its sides roll
# under to it (inset, height), where its windscreen stands on the cowl (y, z) and how far its top leans back and up.
SUPERCAR_WHEEL = (0.35, 0.27, 0.32)
SUPERCAR_AXLES = (-1.42, 1.35)
SUPERCAR_SILL = 0.13
SUPERCAR_TUCK = (0.06, 0.12)
SUPERCAR_SCREEN = ((-0.7, 0.8), (0.42, 0.28))
SUPERCAR_SEATS = (-0.38, 0.38)  # x of the driver's seat (left-hand drive) and the passenger's


def convertible_supercar(mb, m, w, d, h, part=None):
    # A low mid-engined convertible about 4.5 m long, nose to the front (-Y), in bright red: a wedge nose with slim
    # headlights, fenders cresting over big wheels with chrome rims and the sides leaning in above a character line,
    # black intakes in them; its top down: a raked windscreen in a black frame, a dark cockpit with two tan seats and
    # the steering wheel on the left, two humps on the rear deck behind the headrests; a black splitter and diffuser,
    # twin chrome exhausts, a light bar across the tail.
    parts = _parts("convertible_supercar", part)
    half = d / 2
    radius, front_tyre, rear_tyre = SUPERCAR_WHEEL
    arches = [(axle, radius, radius + 0.05) for axle in SUPERCAR_AXLES]
    (foot_y, foot_z), (lean_y, lean_z) = SUPERCAR_SCREEN
    nose, tail = -half + 0.03, half - 0.05
    if "body" in parts:
        paint, glass, black, leather, chrome = (m["paint_red"], m["glass_tinted"], m["rubber"], m["leather"],
                                                m["chrome"])
        body = {"top": [(nose, 0.4), (-2.0, 0.52), (-1.42, 0.62), (foot_y, foot_z), (0.45, 0.82), (0.72, 0.9),
                        (1.9, 0.94), (tail, 0.86)],
                "shoulder": [(nose, 0.36), (-2.0, 0.46), (-1.42, 0.78), (-0.9, 0.6), (0.2, 0.58), (1.35, 0.88),
                             (2.0, 0.82), (tail, 0.74)],
                "low": [(nose, 0.78), (-1.95, 0.95), (-1.0, 0.97), (0.4, 0.96), (1.35, w / 2), (2.0, 0.97),
                        (tail, 0.9)],
                "high": [(nose, 0.52), (-1.95, 0.7), (-1.0, 0.76), (0.4, 0.77), (1.3, 0.8), (tail, 0.7)]}
        _loft(mb, paint, _stations(nose, tail, body, SUPERCAR_SILL, arches), tuck=SUPERCAR_TUCK)
        # the cockpit's dark tub, its dash and the windscreen in its black frame
        tub = [(-0.72, foot_y + 0.02), (0.72, foot_y + 0.02), (0.72, 0.42), (-0.72, 0.42)]
        _block(mb, black, [(x, y, _at(body["top"], y) - 0.02) for x, y in tub],
               [(x, y, _at(body["top"], y) + 0.006) for x, y in tub])
        _block(mb, black, [(-0.72, foot_y + 0.02, foot_z), (0.72, foot_y + 0.02, foot_z), (0.72, -0.42, foot_z),
                           (-0.72, -0.42, foot_z)],
               [(-0.72, foot_y + 0.06, foot_z + 0.09), (0.72, foot_y + 0.06, foot_z + 0.09),
                (0.72, -0.46, foot_z + 0.06), (-0.72, -0.46, foot_z + 0.06)])
        top_y, top_z = foot_y + lean_y, foot_z + lean_z
        _block(mb, glass, [(-0.74, foot_y, foot_z), (0.74, foot_y, foot_z), (0.74, foot_y + 0.015, foot_z),
                           (-0.74, foot_y + 0.015, foot_z)],
               [(-0.62, top_y, top_z), (0.62, top_y, top_z), (0.62, top_y + 0.015, top_z),
                (-0.62, top_y + 0.015, top_z)])
        crown = (top_y + 0.01, top_z + 0.012)
        for side in (-1.0, 1.0):
            mb.stem((side * 0.75, foot_y, foot_z), (side * 0.63, *crown), 0.022, black, segments=4)
        mb.stem((-0.63, *crown), (0.63, *crown), 0.02, black, segments=4)
        # the seats, the steering wheel in front of the driver, the humps behind the headrests
        seat = foot_z - 0.06
        for x in SUPERCAR_SEATS:
            _block(mb, leather, [(x - 0.21, 0.22, seat), (x + 0.21, 0.22, seat), (x + 0.21, 0.36, seat),
                                 (x - 0.21, 0.36, seat)],
                   [(x - 0.16, 0.38, seat + 0.34), (x + 0.16, 0.38, seat + 0.34), (x + 0.16, 0.48, seat + 0.34),
                    (x - 0.16, 0.48, seat + 0.34)])
            mb.ellipsoid((x, 0.95, 0.9), (0.19, 0.45, 0.1), paint, subdivisions=1)
        wheel_x, wheel_y, wheel_z, wheel_r = SUPERCAR_SEATS[0], -0.15, foot_z + 0.12, 0.15
        rim = [(wheel_x + wheel_r * math.cos(a), wheel_y + 0.05 * math.sin(a), wheel_z + wheel_r * math.sin(a))
               for a in (2 * math.pi * k / 10 for k in range(10))]
        for a, b in zip(rim, rim[1:] + rim[:1]):
            mb.stem(a, b, 0.016, black, segments=3)
        mb.stem((wheel_x, -0.52, foot_z + 0.02), (wheel_x, wheel_y, wheel_z), 0.025, black, segments=4)
        # the side intakes, mirrors, splitter, diffuser and twin exhausts
        for side in (-1.0, 1.0):
            x0, x1 = sorted((side * 0.95, side * 0.99))
            _block(mb, black, [(x0, 0.62, 0.3), (x1, 0.62, 0.3), (x1, 1.0, 0.3), (x0, 1.0, 0.3)],
                   [(x0, 0.42, 0.62), (x1, 0.42, 0.62), (x1, 0.98, 0.62), (x0, 0.98, 0.62)])
            x0, x1 = sorted((side * 0.88, side * w / 2))
            mb.box((x0, foot_y + 0.06, foot_z), (x1, foot_y + 0.18, foot_z + 0.09), black)
            mb.cylinder((side * 0.26, half - 0.12, 0.3), 0.045, 0.1, chrome, segments=8, axis="y")
        mb.box((-0.82, nose, SUPERCAR_SILL), (0.82, nose + 0.27, SUPERCAR_SILL + 0.05), black)
        mb.box((-0.72, tail - 0.27, SUPERCAR_SILL + 0.02), (0.72, tail - 0.01, 0.34), black)
        for axle, tyre in zip(SUPERCAR_AXLES, (front_tyre, rear_tyre)):
            for side in (-1.0, 1.0):
                _wheel(mb, m, side * (_at(body["low"], axle) - 0.03 - tyre / 2), axle, radius, tyre)
        mb.box((-0.8, nose + 0.32, 0.0), (0.8, tail - 0.3, 0.004), black)  # the shade under the car
    if "lights" in parts:
        for side in (-1.0, 1.0):
            x0, x1 = sorted((side * 0.42, side * 0.74))
            mb.box((x0, -half + 0.01, 0.31), (x1, nose + 0.05, 0.37), m["headlight"])
        mb.box((-0.84, tail - 0.02, 0.72), (0.84, tail + 0.02, 0.77), m["taillight"])


BUILDERS = {"pickup_truck": pickup_truck, "convertible_supercar": convertible_supercar}

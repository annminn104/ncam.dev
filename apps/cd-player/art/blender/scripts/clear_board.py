"""The Clear model's board: `clear_board(name, root, playing)` builds the board across the lower
part of the body and everything on it, the LCD and the VU strip among them (clear_lcd, clear_vu),
laid out by a `Board` (its parts' footprints, the copper traces and the vias, the small repeated
geometry merged into one mesh per material). make_clear_player (clear.py) calls it.

Exec'd after cdkit.py, parts.py and clear.py, into the same namespace: it reads clear.py's
dimensions (BOARD_Z0, BOARD_Z1, BOARD_W, FACE_Y, SCREWS, ZC, FRONT), its helpers (fslab, ylathe,
band, capsule, and the paths on a face: offset_path, clip_segment, _ccw, _point_segment) and the
materials build_clear_materials makes (M). Positions on the board are (x, z) mm on its face, which
stands at y = FACE_Y, its parts toward the viewer.
"""
import math
import random
import re

import bmesh

# ------------------------------------------------------------------ the board and what is on it
# Where the board's main parts sit, (x, z) mm on its face. The LCD (0, 51), the VU strip (64, 51),
# the logo (-58, 53) and the connectors J1-J6 stay where their cables and flexes land.
SOC = (-108.0, 55.0)                     # U1, a BGA under its heat spreader
RAMS = ((-87.0, 70.0), (-72.0, 70.0))   # U6, U7: the LPDDR packages, above the logo
PMIC = (-136.5, 64.0)                    # U8, a QFN; its three inductors in a column on its right
COILS = ((-127.0, 72.0), (-127.0, 64.0), (-127.0, 56.0))   # L2, L3, L4
USB_X = -118.0                           # J7, its mouth on the lower edge, under the SoC
SUN = (-75.0, 47.0)                      # the Đông Sơn sun, left of the logo
WIFI = (106.0, 63.5)                     # U9's shield can
ANT_ZONE = (116.5, 51.0, 141.0, 76.0)    # the antenna's keep-out
POUR_ZONE = (-61.0, 62.0, -32.0, 78.0)   # the hexagon ground pour
LED_X, LED_Z = (44.0, 52.0, 60.0, 68.0, 76.0, 84.0), 41.4   # the six LEDs, under the VU strip
LED_LABELS = ("PWR", "BT", "WIFI", "PLAY", "SYNC", "CHG")
PASSIVES = {"0402": (1.0, 0.5, 0.35), "0603": (1.6, 0.8, 0.45), "0805": (2.0, 1.25, 0.55)}
TRACE_PROUD, SILK_PROUD = 0.04, 0.05     # mm: the copper under the soldermask, the silkscreen over it
HEADINGS = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0), "NE": (1, 1), "NW": (-1, 1), "SE": (1, -1),
            "SW": (-1, -1)}


def walk(start, moves):
    """A route over the board's face from (x, z) mm: each move a compass heading and how far it
    goes along x and along z ("E4 NE1.5 N3": 4 right, 1.5 up and right, 3 up), so every run is
    straight or diagonal (Board.trace holds every bend to 45 degrees)."""
    pts = [tuple(start)]
    for move in moves.split():
        heading = move.rstrip("0123456789.")
        dx, dz = HEADINGS[heading]
        n = float(move[len(heading):])
        x, z = pts[-1]
        pts.append((x + dx * n, z + dz * n))
    return pts


def trombone(start, u, v, meanders, amp, pitch, cut=0.25):
    """A serpentine's points from `start`: along the heading u, `meanders` times out toward v by
    amp mm and back, pitch mm between its legs, each corner cut at 45 degrees by `cut` mm: the
    length a matched trace adds. The trace comes in along u and goes on along u."""
    (sx, sz), (ux, uz), (vx, vz) = start, u, v
    pts = []
    for k in range(meanders):
        bx, bz = sx + ux * 2 * pitch * k, sz + uz * 2 * pitch * k
        for a, c in ((-cut, 0.0), (0.0, cut), (0.0, amp - cut), (cut, amp), (pitch - cut, amp), (pitch, amp - cut),
                     (pitch, cut), (pitch + cut, 0.0)):     # along u, out toward v
            pts.append((bx + ux * a + vx * c, bz + uz * a + vz * c))
    return pts


def silk(name, root, body, x, z, size=1.7, font="avenir", align="CENTER"):
    """Silkscreened lettering; the web build leaves out what the page could never read (under 3 mm)."""
    if WEB and size < 3.0:
        return None
    return text(name, body, size, M["silk"], font=font, align=align, parent=root,
                loc=L(x, FACE_Y - SILK_PROUD, z), rot=FRONT)


class Board:
    """The board's layout: each part's footprint (what the traces, the vias and the labels keep
    off), the copper traces and the vias, and the small repeated geometry (legs, pads, passives,
    vias, test pads, the LEDs, the shield's dimples, the silk outlines) merged into one mesh per
    material, as each Blender object becomes a node of the GLB."""

    def __init__(self, name, root):
        self.name, self.root = name, root
        self.sheets = {}
        self.parts = []    # (designator, x0, z0, x1, z1)
        self.traces = []   # (points, width, net)
        self.vias = []     # (x, z, outer radius)
        self.zones = []    # (what, x0, z0, x1, z1): nothing inside but their own copper
        self.words = []    # (x0, z0, x1, z1): the silkscreen's lettering, roughly

    def sheet(self, key, material, smooth=False):
        if key not in self.sheets:
            self.sheets[key] = (bmesh.new(), material, smooth)
        return self.sheets[key][0]

    def keep(self, ref, x, z, w, h):
        """A part's footprint: w x h mm round (x, z)."""
        self.parts.append((ref, x - w / 2, z - h / 2, x + w / 2, z + h / 2))

    def box(self, key, material, x, z, w, h, t, y=FACE_Y, rot=0.0):
        """A block w x h (x, z) mm, t mm proud of y toward the viewer, turned rot degrees about the
        board's normal; no back face, as it lies on something."""
        bm = self.sheet(key, material)
        a = math.radians(rot)
        ca, sa = math.cos(a), math.sin(a)
        ring = [(x + px * ca - pz * sa, z + px * sa + pz * ca)
                for px, pz in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
        back = [bm.verts.new((px * MM, y * MM, pz * MM)) for px, pz in ring]
        front = [bm.verts.new((px * MM, (y - t) * MM, pz * MM)) for px, pz in ring]
        bm.faces.new(front)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((back[i], back[j], front[j], front[i]))

    def flat(self, key, material, outline, y):
        """A flat outline (x, z) at y, facing the viewer."""
        bm = self.sheet(key, material)
        bm.faces.new([bm.verts.new((px * MM, y * MM, pz * MM)) for px, pz in _ccw(list(outline))])

    def disc(self, key, material, x, z, r, y, seg=16):
        self.flat(key, material, circle(r, seg, cx=x, cy=z), y)

    def ring(self, key, material, x, z, ro, ri, y, seg=16):
        bm = self.sheet(key, material)
        ang = [2 * math.pi * i / seg for i in range(seg)]
        outer = [bm.verts.new(((x + ro * math.cos(a)) * MM, y * MM, (z + ro * math.sin(a)) * MM)) for a in ang]
        inner = [bm.verts.new(((x + ri * math.cos(a)) * MM, y * MM, (z + ri * math.sin(a)) * MM)) for a in ang]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((inner[i], outer[i], outer[j], inner[j]))

    def dome(self, key, material, x, z, r, h, y, seg=8):
        """A low dome h mm proud of y, as a stamped dimple stands (a smooth-shaded sheet)."""
        bm = self.sheet(key, material, smooth=True)
        ang = [2 * math.pi * i / seg for i in range(seg)]
        top = bm.verts.new((x * MM, (y - h) * MM, z * MM))
        mid = [bm.verts.new(((x + 0.55 * r * math.cos(a)) * MM, (y - 0.7 * h) * MM, (z + 0.55 * r * math.sin(a)) * MM))
               for a in ang]
        base = [bm.verts.new(((x + r * math.cos(a)) * MM, y * MM, (z + r * math.sin(a)) * MM)) for a in ang]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((top, mid[i], mid[j]))
            bm.faces.new((mid[i], base[i], base[j], mid[j]))

    def strip(self, pts, width, closed=False):
        """Copper under the soldermask, `width` mm along the points and 0.04 mm proud of the face:
        the traces' one mesh, in `trace`."""
        left, right = offset_path(pts, width / 2, closed), offset_path(pts, -width / 2, closed)
        bm = self.sheet("trace", M["trace"])
        y = (FACE_Y - TRACE_PROUD) * MM
        lv = [bm.verts.new((x * MM, y, z * MM)) for x, z in left]
        rv = [bm.verts.new((x * MM, y, z * MM)) for x, z in right]
        n = len(pts)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            bm.faces.new((rv[i], rv[j], lv[j], lv[i]))

    def trace(self, pts, width, net):
        """A copper trace on the net `net`: its runs straight or diagonal and every bend 45
        degrees (a right angle is cut by a 45-degree chamfer), or the run stops."""
        pts = [p for i, p in enumerate(pts) if i == 0 or math.dist(p, pts[i - 1]) > 1e-6]
        runs = []
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            dx, dz = x1 - x0, z1 - z0
            if min(abs(dx), abs(dz)) > 1e-6 and abs(abs(dx) - abs(dz)) > 1e-6:
                raise SystemExit("clear_board.py: the %s trace runs off 45 degrees to %r" % (net, (x1, z1)))
            runs.append((dx / math.hypot(dx, dz), dz / math.hypot(dx, dz)))
        for (ax, az), (bx, bz), p in zip(runs, runs[1:], pts[1:]):
            turn = ax * bx + az * bz
            if turn < 1.0 - 1e-6 and abs(turn - math.sqrt(0.5)) > 1e-6:
                raise SystemExit("clear_board.py: the %s trace bends other than 45 degrees at %r" % (net, p))
        self.traces.append((pts, width, net))
        self.strip(pts, width)

    def via(self, x, z, ro=0.45):
        """A via: its tinned ring over the copper, its dark drill."""
        seg = 8 if WEB else 12
        self.vias.append((x, z, ro))
        self.ring("solder", M["solder"], x, z, ro, 0.2, FACE_Y - 0.06, seg)
        self.disc("drill", M["hub_black"], x, z, 0.2, FACE_Y - 0.05, seg)

    def label(self, body, x, z, size=1.2, align="CENTER", font="avenir"):
        """A designator or a word silkscreened beside its part (a render's alone: under 3 mm)."""
        slug = re.sub(r"[^0-9a-z]+", "_", body.lower()).strip("_") or "mark"
        w = 0.36 * len(body) * size                     # the lettering's measured run, about
        x0 = x if align == "LEFT" else x - w / 2
        self.words.append((x0, z - 0.25 * size, x0 + w, z + 0.25 * size))
        return silk("%s_silk_%s" % (self.name, slug), self.root, body, x, z, size=size, font=font, align=align)

    def silk_rect(self, x0, z0, x1, z1):
        self.flat("silk", M["silk"], [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], FACE_Y - SILK_PROUD)

    def frame(self, x, z, w, h, lw=0.15):
        """A silkscreened outline round a part, w x h mm along its line."""
        x0, x1, z0, z1, k = x - w / 2, x + w / 2, z - h / 2, z + h / 2, lw / 2
        self.silk_rect(x0 - k, z1 - k, x1 + k, z1 + k)
        self.silk_rect(x0 - k, z0 - k, x1 + k, z0 + k)
        self.silk_rect(x0 - k, z0 + k, x0 + k, z1 - k)
        self.silk_rect(x1 - k, z0 + k, x1 + k, z1 - k)

    def corners(self, x, z, w, h, arm=1.5, lw=0.15):
        """Silkscreened corner marks round a large package, w x h mm along their lines."""
        k = lw / 2
        for sx in (-1, 1):
            for sz in (-1, 1):
                cx, cz = x + sx * w / 2, z + sz * h / 2
                self.flat("silk", M["silk"], [(cx + sx * k, cz + sz * k), (cx - sx * arm, cz + sz * k),
                                              (cx - sx * arm, cz - sz * k), (cx - sx * k, cz - sz * k),
                                              (cx - sx * k, cz - sz * arm), (cx + sx * k, cz - sz * arm)],
                          FACE_Y - SILK_PROUD)

    def dashes(self, x0, z0, x1, z1, dash=1.2, gap=0.8, lw=0.15):
        """A dashed silkscreened rectangle round a keep-out, a dash at each end of every side."""
        k = lw / 2
        for (ax, az), (bx, bz) in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x0, z1), (x1, z1)),
                                   ((x0, z0), (x0, z1))):
            length = math.hypot(bx - ax, bz - az)
            n = max(2, int(round((length + gap) / (dash + gap))))
            step = (length - dash) / (n - 1)
            for i in range(n):
                s0, s1 = i * step, i * step + dash
                if az == bz:
                    self.silk_rect(ax + s0, az - k, ax + s1, az + k)
                else:
                    self.silk_rect(ax - k, az + s0, ax + k, az + s1)

    def done(self):
        """The merged sheets, one object each."""
        for key, (bm, material, smooth) in self.sheets.items():
            from_bm("%s_board_%s" % (self.name, key), bm, [material], smooth=smooth, parent=self.root)
        self.sheets = {}


# ------------------------------------------------------------------ the board's parts
def passive(B, x, z, size="0402", rot=0.0, cap=False):
    """A chip resistor (black) or capacitor (tan-grey) and its two tinned ends, along x (rot 90:
    along z)."""
    l, w, t = PASSIVES[size]
    e = 0.25 * l
    a = math.radians(rot)
    ux, uz = math.cos(a), math.sin(a)
    B.box("caps" if cap else "chip", M["magnet"] if cap else M["chip"], x, z, l - 2 * e, w, t, rot=rot)
    for s in (-1, 1):
        B.box("solder", M["solder"], x + s * ux * (l - e) / 2, z + s * uz * (l - e) / 2, e, w, t + 0.02, rot=rot)
    B.keep("%s@%g,%g" % ("C" if cap else "R", x, z), x, z, *((l, w) if abs(uz) < 0.5 else (w, l)))


def soic(B, ref, x, z, pins=4, size=(4.9, 3.9), pitch=1.27, t=1.4, turn=False, mark=None):
    """A gull-wing package: its black body (bevelled in a render), `pins` legs along each long side
    (above and below it; `turn` puts them left and right), its pin-1 dot."""
    w, h = (size[1], size[0]) if turn else size
    rbox("%s_%s" % (B.name, ref.lower()), (w, t, h), M["chip"], bevel_mm=0.0 if WEB else 0.25, parent=B.root,
         loc=L(x, FACE_Y - t / 2, z))
    for side in (-1, 1):
        for i in range(pins):
            o = (i - (pins - 1) / 2) * pitch
            if turn:
                B.box("solder", M["solder"], x + side * (w / 2 + 0.5), z + o, 1.0, 0.4, 0.3)
            else:
                B.box("solder", M["solder"], x + o, z + side * (h / 2 + 0.5), 0.4, 1.0, 0.3)
    B.disc("ink", M["ink"], x - w / 2 + 0.7, z + h / 2 - 0.7, 0.3, FACE_Y - t - 0.01, 12)
    if mark and not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), mark, 0.9, M["ink"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.02, z - 0.3), rot=FRONT)
    B.keep(ref, x, z, w + (2.0 if turn else 0.0), h + (0.0 if turn else 2.0))


def qfn(B, ref, x, z, s=5.0, pins=8, pitch=0.5, t=0.85, mark=None):
    """A QFN: its black body, `pins` lands a side showing at its edges, its pin-1 dot (its exposed
    pad's copper is the caller's)."""
    rbox("%s_%s" % (B.name, ref.lower()), (s, t, s), M["chip"], bevel_mm=0.0 if WEB else 0.08, parent=B.root,
         loc=L(x, FACE_Y - t / 2, z))
    for i in range(pins):
        o = (i - (pins - 1) / 2) * pitch
        for side in (-1, 1):
            B.box("solder", M["solder"], x + side * (s / 2 + 0.1), z + o, 0.45, 0.25, 0.15)
            B.box("solder", M["solder"], x + o, z + side * (s / 2 + 0.1), 0.25, 0.45, 0.15)
    B.disc("ink", M["ink"], x - s / 2 + 0.6, z + s / 2 - 0.6, 0.25, FACE_Y - t - 0.01, 12)
    if mark and not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), mark, 0.9, M["ink"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.02, z - 0.4), rot=FRONT)
    B.keep(ref, x, z, s + 0.65, s + 0.65)


def soc(B, x, z):
    """U1, the SoC: a BGA's dark substrate under a stepped metal heat spreader marked ncam N1, the
    capacitors on the substrate's rim, the A1 corner's gold triangle."""
    n = B.name + "_u1"
    rbox(n, (16.0, 1.0, 16.0), M["chip"], bevel_mm=0.0 if WEB else 0.15, parent=B.root, loc=L(x, FACE_Y - 0.5, z))
    y = FACE_Y - 1.0
    fslab(n + "_lid", [rrect(13.6, 13.6, 1.0, seg=4)], y - 0.45, y, M["chrome"], bevel_mm=0.1, x=x, z=z,
          parent=B.root)
    fslab(n + "_lid_top", [rrect(11.4, 11.4, 0.8, seg=4)], y - 1.2, y - 0.43, M["chrome"], bevel_mm=0.25, x=x, z=z,
          parent=B.root)
    B.flat("gold", M["gold"], [(x - 7.6, z + 7.6), (x - 6.4, z + 7.6), (x - 7.6, z + 6.4)], y - 0.01)
    if not WEB:
        top = y - 1.21
        text(n + "_mark", "ncam N1", 2.2, M["ink_dark"], font="futura", parent=B.root, loc=L(x - 1.4, top, z + 1.0),
             rot=FRONT)
        text(n + "_code", "2611  A2", 1.0, M["ink_dark"], font="din", parent=B.root, loc=L(x - 1.4, top, z - 1.4),
             rot=FRONT)
        # A laser-marked Data Matrix beside the mark: its solid L on two sides, its clock track on the others.
        rng = random.Random(1)
        cell, cells = 0.22, 10
        ox, oz = x + 3.7 - cells * cell / 2, z - 0.2 - cells * cell / 2
        for i in range(cells):
            for j in range(cells):
                edge = i == 0 or j == 0 or (j == cells - 1 and i % 2 == 0) or (i == cells - 1 and j % 2 == 1)
                inner = 0 < i < cells - 1 and 0 < j < cells - 1
                if edge or (inner and rng.random() < 0.5):
                    px, pz = ox + i * cell, oz + j * cell
                    square = [(px, pz), (px + cell, pz), (px + cell, pz + cell), (px, pz + cell)]
                    B.flat("ink_dark", M["ink_dark"], square, top)
        for k in range(5):
            o = (k - 2) * 2.4
            B.box("caps", M["magnet"], x - 7.4, z + o, 0.3, 0.6, 0.3, y=y)
            B.box("caps", M["magnet"], x + o, z - 7.4, 0.6, 0.3, 0.3, y=y)
    B.keep("U1", x, z, 16.0, 16.0)


def lpddr(B, ref, x, z):
    """An LPDDR package: its black BGA body, its pin-1 dot, its mark."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (12.0, 0.95, 9.0), M["chip"], bevel_mm=0.0 if WEB else 0.12, parent=B.root, loc=L(x, FACE_Y - 0.475, z))
    B.disc("ink", M["ink"], x - 5.1, z + 3.6, 0.35, FACE_Y - 0.96, 12)
    if not WEB:
        text(n + "_mark", "LPDDR4X", 1.3, M["ink"], font="din", parent=B.root, loc=L(x, FACE_Y - 0.97, z + 0.7),
             rot=FRONT)
        text(n + "_code", "8Gb  2611", 0.9, M["ink"], font="din", parent=B.root, loc=L(x, FACE_Y - 0.97, z - 1.3),
             rot=FRONT)
    B.keep(ref, x, z, 12.0, 9.0)


def coil(B, ref, x, z, mark):
    """A shielded power inductor: its dark body, its metal top marked with its value, its two
    terminals' solder at its sides."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (5.0, 2.2, 5.0), M["magnet"], bevel_mm=0.5, parent=B.root, loc=L(x, FACE_Y - 1.1, z))
    fslab(n + "_top", [rrect(4.0, 4.0, 0.5, seg=3)], FACE_Y - 2.34, FACE_Y - 2.19, M["alu_side"], x=x, z=z,
          parent=B.root)
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 2.6, z, 0.6, 3.0, 0.8)
    if not WEB:
        text(n + "_mark", mark, 1.3, M["ink_dark"], font="din", parent=B.root, loc=L(x, FACE_Y - 2.35, z), rot=FRONT)
    B.keep(ref, x, z, 5.8, 5.0)


def shield_can(B, ref, x, z, s=12.0, t=1.8):
    """The Wi-Fi/BT module: a stamped metal shield can, rows of small dimples above and below its
    mark, its frame's solder round its foot."""
    fslab("%s_%s" % (B.name, ref.lower()), [rrect(s, s, 0.8, seg=4)], FACE_Y - t, FACE_Y, M["chrome"], bevel_mm=0.25,
          x=x, z=z, parent=B.root)
    for i in range(6):
        for j in (0, 1, 4, 5):
            B.dome("dimples", M["chrome"], x + (i - 2.5) * 1.7, z + (j - 2.5) * 1.7, 0.34, 0.08, FACE_Y - t,
                   6 if WEB else 8)
    for side in (-1, 1):
        B.box("solder", M["solder"], x, z + side * (s / 2 + 0.12), s + 0.48, 0.24, 0.12)
        B.box("solder", M["solder"], x + side * (s / 2 + 0.12), z, 0.24, s, 0.12)
    if not WEB:
        text("%s_%s_mark" % (B.name, ref.lower()), "WIFI/BT", 1.6, M["ink_dark"], font="din", parent=B.root,
             loc=L(x, FACE_Y - t - 0.01, z), rot=FRONT)
    B.keep(ref, x, z, s + 0.5, s + 0.5)


def usb_c(B, x):
    """J7: a USB-C receptacle on the board's lower edge, its mouth down past the edge: the
    stainless shell round the dark tongue, the shell's legs at its sides, its pins at its back."""
    n = B.name + "_j7"
    z0 = BOARD_Z0 - 0.6            # the mouth
    z1 = z0 + 7.35                 # the back
    yc = FACE_Y - 1.63
    outer = capsule((x - 2.84, yc), 1.63, (x + 2.84, yc), 1.63, seg=12)
    inner = capsule((x - 2.84, yc), 1.38, (x + 2.84, yc), 1.38, seg=12)
    slab(n, [outer, inner], z0, z1 - 0.75, M["alu_side"], bevel_mm=0.06, parent=B.root)
    slab(n + "_back", [outer], z1 - 0.75, z1, M["alu_side"], bevel_mm=0.15, parent=B.root)
    rbox(n + "_tongue", (6.6, 0.7, 4.6), M["chip"], parent=B.root, loc=L(x, yc, z1 - 0.75 - 2.3))
    for side in (-1, 1):
        for zz in (z0 + 1.8, z0 + 5.6):
            B.box("solder", M["solder"], x + side * 4.75, zz, 0.7, 1.4, 0.5)
    for i in range(10):
        B.box("solder", M["solder"], x + (i - 4.5) * 0.7, z1 + 0.45, 0.3, 0.9, 0.12)
    B.keep("J7", x, (z0 + z1 + 0.9) / 2, 10.2, z1 + 0.9 - z0)
    return z1 + 0.45


def zif(B, ref, x, z):
    """J8: the LCD flex's ZIF connector, the flex entering its front over the dark latch, its
    hold-down tabs at either end."""
    n = "%s_%s" % (B.name, ref.lower())
    rbox(n, (22.0, 3.0, 4.2), M["well"], bevel_mm=0.0 if WEB else 0.2, parent=B.root, loc=L(x, FACE_Y - 1.5, z))
    rbox(n + "_latch", (20.0, 0.6, 1.3), M["chip"], bevel_mm=0.0 if WEB else 0.1, parent=B.root,
         loc=L(x, FACE_Y - 3.3, z - 1.05))
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 11.6, z, 1.2, 2.2, 0.5)
    B.keep(ref, x, z, 24.4, 4.2)


def connector(B, ref, x, z, pins=2):
    """A JST-style header: its white housing (bevelled in a render), its pins' dark slots."""
    w = 2.5 * pins + 2.4
    rbox("%s_%s" % (B.name, ref.lower()), (w, 5.8, 5.6), M["well"], bevel_mm=0.0 if WEB else 0.35, parent=B.root,
         loc=L(x, FACE_Y - 2.9, z))
    for k in range(pins):
        B.box("chip", M["chip"], x + (k - (pins - 1) / 2) * 2.5, z + 0.4, 1.5, 2.4, 5.84)
    B.keep(ref, x, z, w, 5.6)


def flex_header(B, ref, x, z, w):
    """A flex cable's connector: its black body (bevelled in a render), its white latch along the
    top, where the flex comes down into it."""
    rbox("%s_%s" % (B.name, ref.lower()), (w, 2.6, 4.4), M["chip"], bevel_mm=0.0 if WEB else 0.3, parent=B.root,
         loc=L(x, FACE_Y - 1.3, z))
    B.box("well", M["well"], x, z + 1.6, w - 1.0, 1.0, 2.9)
    B.keep(ref, x, z + 0.2, w, 4.8)


def electrolytic(B, ref, x, z, r, h):
    """An aluminium electrolytic: its can, its scored top, its silkscreened ring."""
    n = "%s_%s" % (B.name, ref.lower())
    ylathe(n, [(0.01, 0), (r, 0), (r, h - 0.5), (r - 0.45, h), (0.01, h)], M["cell"], x, FACE_Y, z, toward=-1,
           seg=32, parent=B.root)
    B.disc("solder", M["solder"], x, z, r - 0.55, FACE_Y - h - 0.01, 16 if WEB else 24)
    for k in range(2):
        B.box("ink_dark", M["ink_dark"], x, z, r * 1.1, 0.25, 0.05, y=FACE_Y - h - 0.01, rot=45 + 90 * k)
    B.ring("silk", M["silk"], x, z, r + 0.45, r + 0.3, FACE_Y - SILK_PROUD, 20 if WEB else 32)
    B.keep(ref, x, z, 2 * r, 2 * r)


def crystal(B, ref, x, z):
    """A 3.2 x 2.5 mm crystal: its ceramic base, its metal lid."""
    B.box("well", M["well"], x, z, 3.2, 2.5, 0.3)
    B.box("solder", M["solder"], x, z, 2.7, 2.0, 0.5, y=FACE_Y - 0.3)
    B.keep(ref, x, z, 3.2, 2.5)


def sot23(B, ref, x, z):
    """A SOT-23 transistor: its body, its three legs."""
    B.box("chip", M["chip"], x, z, 2.9, 1.6, 1.1)
    for dx, dz in ((-0.95, -1.15), (0.95, -1.15), (0.0, 1.15)):
        B.box("solder", M["solder"], x + dx, z + dz, 0.4, 0.8, 0.2)
    B.keep(ref, x, z, 2.9, 3.1)


def tantalum(B, ref, x, z, rot=0.0):
    """A tantalum capacitor: its amber body, its polarity band."""
    a = math.radians(rot)
    B.box("flex", M["flex"], x, z, 3.5, 2.8, 1.9, rot=rot)
    B.box("well", M["well"], x - 1.2 * math.cos(a), z - 1.2 * math.sin(a), 0.6, 2.9, 1.95, rot=rot)
    B.keep(ref, x, z, *((3.5, 2.8) if abs(math.sin(a)) < 0.5 else (2.8, 3.5)))


def test_pad(B, ref, x, z, lx, lz):
    """A gold test pad, its label at (lx, lz)."""
    B.disc("gold", M["gold"], x, z, 0.75, FACE_Y - 0.05, 12 if WEB else 24)
    B.keep(ref, x, z, 1.5, 1.5)
    B.label(ref, lx, lz, 1.1)


def led(B, x, z, word):
    """An 0805 LED: its white housing, its lens lit in the light's colour, its tinned ends; its
    word above it."""
    B.box("well", M["well"], x, z, 1.3, 1.25, 0.55)
    B.box("light", M["light"], x, z, 0.9, 0.8, 0.6)
    for side in (-1, 1):
        B.box("solder", M["solder"], x + side * 0.82, z, 0.36, 1.25, 0.57)
    B.keep("D " + word, x, z, 2.0, 1.25)
    B.label(word, x, z + 2.2, 1.1)


def dongson_sun(B, x, z):
    """The Đông Sơn drum's 14-ray star inside its ring, in gold, 12 mm across: a feather's
    chevron between each pair of rays."""
    y = FACE_Y - 0.05

    def at(r, a):
        return x + r * math.cos(a), z + r * math.sin(a)
    B.flat("gold", M["gold"], [at(4.5 if k % 2 == 0 else 1.55, math.pi / 2 + math.pi * k / 14) for k in range(28)], y)
    B.ring("gold", M["gold"], x, z, 6.0, 5.35, y, 40 if WEB else 72)
    apex, tip, spread, w = 3.05, 4.45, math.radians(6.5), 0.2
    for k in range(14):
        g = math.pi / 2 + math.pi * (2 * k + 1) / 14     # between two rays
        B.flat("gold", M["gold"], [at(apex, g), at(tip, g - spread), at(tip + w, g - spread + w / tip),
                                   at(apex + w * 1.4, g), at(tip + w, g + spread - w / tip), at(tip, g + spread)], y)
    B.keep("SUN", x, z, 12.0, 12.0)


def hex_pour(B, zone, cell=4.0, line=0.3, rim=0.4, cut=1.5):
    """A hatched ground pour: outline hexagons `cell` mm across their flats in `line` mm copper,
    inside a rim whose corners are cut at 45 degrees; nothing else inside it."""
    x0, z0, x1, z1 = zone
    B.zones.append(("pour", x0, z0, x1, z1))
    outline = [(x0 + cut, z0), (x1 - cut, z0), (x1, z0 + cut), (x1, z1 - cut), (x1 - cut, z1), (x0 + cut, z1),
               (x0, z1 - cut), (x0, z0 + cut)]
    B.strip(outline, rim, closed=True)
    R = cell / math.sqrt(3)
    edges = {}
    cols = int((x1 - x0) / (1.5 * R)) + 3
    rows = int((z1 - z0) / cell) + 3
    for i in range(-1, cols):
        for j in range(-1, rows):
            cx = x0 + 0.6 * R + i * 1.5 * R
            cz = z0 + 0.5 * cell + j * cell + (cell / 2 if i % 2 else 0.0)
            ring = [(cx + R * math.cos(math.pi * k / 3), cz + R * math.sin(math.pi * k / 3)) for k in range(6)]
            for a, b in zip(ring, ring[1:] + ring[:1]):
                key = (round((a[0] + b[0]) * 50), round((a[1] + b[1]) * 50))
                edges[key] = (a, b)
    for a, b in edges.values():
        seg = clip_segment(a, b, outline)
        if seg and math.dist(*seg) > 0.25:
            B.strip(list(seg), line)


def board_compute(B):
    """The SoC and its two LPDDR packages, the buses between them (a differential clock pair, four
    lines to U6, five to U7, the inner of those, the shortest, tuned by a serpentine), the
    crystal, the decoupling, the debug header J5 and its vias, the test pads TP3-TP6."""
    sx, sz = SOC
    soc(B, sx, sz)
    B.corners(sx, sz, 16.8, 16.8, arm=1.2)
    B.label("U1", -98.8, 64.6)
    for i in range(5):
        passive(B, sx - 3.0 + 2.0 * i, sz + 9.4, cap=True)     # along its top edge
        passive(B, sx - 3.0 + 2.0 * i, sz - 9.7, cap=True)     # and its bottom edge
    for ref, (x, z) in zip(("U6", "U7"), RAMS):
        lpddr(B, ref, x, z)
        B.corners(x, z, 12.8, 9.8, arm=1.2)
        B.label(ref, x - 4.5, z + 6.2)
    right = sx + 7.0                       # the buses start under the package's right edge
    ck = walk((right, 62.3), "E6.6 NE2.8 N2.4")
    for d, net in ((0.35, "CK_T"), (-0.35, "CK_C")):
        B.trace(offset_path(ck, d), 0.35, net)
    bus_a = walk((right, 59.0), "E7.8 NE4.2 N4.3")
    for k in range(4):
        B.trace(offset_path(bus_a, (k - 1.5) * 0.6), 0.25, "DQA%d" % k)
    bus_b = walk((right, 51.3), "E13 NE6 E3 NE4 N6.2")
    for k in range(5):
        line = offset_path(bus_b, (k - 2) * 0.6)
        if k == 4:     # the inner line of every bend, the shortest: its serpentine matches it
            x0, z0 = line[0]
            line = [line[0]] + trombone((x0 + 1.8, z0), (1, 0), (0, 1), 5, 2.3, 0.9) + line[1:]
        B.trace(line, 0.25, "DQB%d" % k)
    crystal(B, "Y1", -95.5, 47.4)
    B.label("Y1", -91.6, 47.4)
    for zz, net in ((48.3, "XIN"), (47.5, "XOUT")):
        B.trace(walk((right, zz), "E4.3"), 0.25, net)
    jx, jz = -94.0, 38.6
    rbox(B.name + "_j5", (12.9, 2.6, 5.2), M["chip"], bevel_mm=0.0 if WEB else 0.3, parent=B.root,
         loc=L(jx, FACE_Y - 1.3, jz))
    for i in range(10):
        B.box("solder", M["solder"], jx + (i // 2 - 2) * 2.54, jz + (i % 2 - 0.5) * 2.54, 0.64, 0.64, 8.4)
    B.keep("J5", jx, jz, 12.9, 5.2)
    B.label("J5", jx - 7.9, jz)
    for i in range(4):
        x = jx + (i - 2) * 2.54
        B.trace(walk((x, jz + 1.8), "N3.2"), 0.25, "SWD%d" % i)
        B.via(x, jz + 5.0)
    for i in range(4):
        x = -90.0 + 5.0 * i
        test_pad(B, "TP%d" % (i + 3), x, 79.0, x, 81.2)
        B.trace(walk((x, 79.0), "SE1.4"), 0.3, "TP%d" % (i + 3))
        B.via(x + 1.4, 77.6)


def board_power(B):
    """The PMIC (U8) and its three inductors in a column, their rails into the SoC's left edge;
    USB-C (J7) on the lower edge, its differential pair to the SoC, VBUS round to the PMIC and to
    TP1; the cells' connector J1 and its switch Q1; C1."""
    px, pz = PMIC
    qfn(B, "U8", px, pz, mark="NC80")
    B.corners(px, pz, 6.4, 6.4, arm=1.0)
    B.label("U8", -139.6, 58.5)
    # The exposed pad's copper out past the package's top, its thermal vias.
    B.flat("trace", M["trace"], [(px - 1.6, pz + 1.6), (px + 1.0, pz + 1.6), (px + 1.0, pz + 6.0),
                                 (px - 1.6, pz + 6.0)], FACE_Y - TRACE_PROUD)
    for dx in (-0.9, 0.3):
        B.via(px + dx, pz + 4.7, ro=0.4)
    electrolytic(B, "C1", -137.0, 77.0, 4.0, 9.0)
    B.label("C1", -137.0, 71.6)
    for ref, (x, z), mark in zip(("L2", "L3", "L4"), COILS, ("2R2", "1R0", "4R7")):
        coil(B, ref, x, z, mark)
        B.label(ref, x + 5.4, z + 1.9)
    # Each switch node from the PMIC's right side into its inductor, each rail on into the SoC.
    switch = (walk((px + 1.9, pz + 1.9), "E0.8 NE1.6 N3.7 NE0.8 E1.8"), walk((px + 1.9, pz), "E5.0"),
              walk((px + 1.9, pz - 1.9), "E0.8 SE1.6 S3.7 SE0.8 E1.8"))
    rails = (walk((-124.4, 72.0), "E4.0 SE6.9 S3.1"), walk((-124.4, 64.0), "E2.4 SE4.0 E3.0"),
             walk((-124.4, 56.0), "E9.4"))
    for k in range(3):
        B.trace(switch[k], 0.9, "SW%d" % (k + 1))
        B.trace(rails[k], 0.9, ("VDD_IO", "VDD_DDR", "VDD_CORE")[k])
    pins = usb_c(B, USB_X)
    B.label("J7", USB_X + 6.6, 36.6)
    pair = walk((USB_X, pins), "N1.0 NE6.0 N2.6")
    for d, net in ((0.35, "USB_DP"), (-0.35, "USB_DN")):
        B.trace(offset_path(pair, d), 0.35, net)
    B.trace(walk((USB_X - 3.15, pins), "N6.2 NW4.0 W9.35 NW2.0 N8.5"), 1.0, "VBUS")
    B.trace(walk((USB_X + 3.15, pins), "N0.5 NE1.2 E3.65"), 0.5, "VBUS")
    test_pad(B, "TP1", -110.0, 43.0, -110.0, 41.2)
    test_pad(B, "TP2", -106.4, 43.0, -106.4, 41.2)
    B.trace(walk((-106.4, 43.0), "E1.8"), 0.4, "GND")
    B.via(-104.6, 43.0)
    connector(B, "J1", -102.0, 80.0)
    B.label("J1", -107.4, 80.0)
    for dx, net in ((-1.25, "VBAT"), (1.25, "GND")):
        B.trace(walk((-102.0 + dx, 78.6), "S2.8"), 0.8, net)
        B.via(-102.0 + dx, 75.8, ro=0.55)
    sot23(B, "Q1", -95.5, 79.6)
    B.label("Q1", -95.5, 82.6)


def board_display(B, playing):
    """The LCD on its standoffs and its flex's ZIF (J8), the VU strip, the six LEDs under it and
    the bus from their driver U4, the DAC U5, the LCD's two tantalums C4 and C5."""
    clear_lcd(B.name, B.root, playing)
    B.keep("LCD", 0.0, 51.45, 58.0, 23.1)
    zif(B, "J8", 0.0, 37.3)
    B.label("J8", 13.6, 37.3)
    clear_vu(B.name, B.root, playing)
    B.keep("VU", 64.0, 51.0, 58.0, 11.0)
    B.label("LEVEL", 35.0, 58.6, 1.9, align="LEFT")
    for x, word in zip(LED_X, LED_LABELS):
        led(B, x, LED_Z, word)
    soic(B, "U4", 96.0, 37.6, pins=8, size=(5.0, 4.4), pitch=0.65, t=1.1, turn=True)
    B.label("U4", 96.0, 41.6)
    for k, x in enumerate(LED_X):      # the nearest LED on the top line: no line crosses another
        zk = 37.6 + (k - 2.5) * 0.65
        B.trace([(93.0, zk), (x - 0.42, zk), (x - 0.82, zk + 0.4), (x - 0.82, LED_Z - 0.2)], 0.25, "LED%d" % k)
    ux, uz = -39.0, 50.5           # the DAC between the logo and the LCD, its legs fanned out to vias
    soic(B, "U5", ux, uz, mark="DAC")
    B.label("U5", ux + 5.0, uz)
    for i in range(4):
        x = ux + (i - 1.5) * 1.27
        for s, heading in ((-1, "S"), (1, "N")):
            reach = 2.35 + 1.1 * (i % 2)
            B.trace(walk((x, uz + s * 2.6), "%s%.2f" % (heading, reach)), 0.25, "U5_%s%d" % (heading, i))
            B.via(x, uz + s * (2.6 + reach))
    for ref, x in (("C4", -18.0), ("C5", 18.0)):
        tantalum(B, ref, x, 67.0)
        B.label(ref, x, 69.6)
        for s, heading in ((-1, "W"), (1, "E")):
            B.trace(walk((x + s * 1.4, 67.0), "%s2.0" % heading), 0.5, "%s_%s" % (ref, heading))
            B.via(x + s * 3.4, 67.0)


def board_radio(B):
    """The Wi-Fi/BT module under its shield can (U9) and its via fence, the SDIO bus to it from
    vias by the pour, and the meander antenna fed from it in a keep-out at the board's upper
    right."""
    wx, wz = WIFI
    shield_can(B, "U9", wx, wz)
    B.label("U9", 113.6, 70.6)
    for i in range(6):
        for zz in (wz + 7.7, wz - 7.7):
            B.via(wx - 5.5 + 2.2 * i, zz)
    sdio = walk((-27.0, 74.2), "E121 SE3 S4.2 SE2 E2")
    for k in range(5):
        line = offset_path(sdio, (k - 2) * 0.9)
        line[0] = (-27.0 + 0.9 * k, line[0][1])
        B.trace(line, 0.25, "SDIO%d" % k)
        B.via(*line[0])
    x0, z0, x1, z1 = ANT_ZONE
    B.zones.append(("antenna", x0, z0, x1, z1))
    B.dashes(x0, z0, x1, z1)
    B.label("ANT", (x0 + x1) / 2, z0 + 3.0, 1.7)
    # An inverted-F: the feed from the module's RF pad up to the arm, the arm shorted to the ground
    # plane by a via outside the keep-out, its meander along the top, its tip open.
    B.trace(walk((wx + 5.0, 66.0), "E7.8 NE0.8 N5.2"), 0.6, "ANT")
    arm = [(114.4, 72.0)] + trombone((122.0, 72.0), (1, 0), (0, -1), 4, 7.0, 2.2, cut=0.6) + \
        [(139.0, 72.0), (139.6, 71.4), (139.6, 66.0)]
    B.trace(arm, 0.5, "ANT")
    B.via(114.4, 72.0)
    for x in (113.4, 115.4):
        for zz in (64.6, 67.4):
            B.via(x, zz)


def board_audio(B):
    """The connectors the cables land in (J2 and J4 the speakers', J3 the laser's flex, J6 the
    keys' ribbon), an amplifier by each speaker's connector with its output pair into it, the
    electrolytics C2 and C3 on the right."""
    connector(B, "J2", -126.0, 80.5)
    B.label("J2", -131.6, 80.5)
    connector(B, "J4", 112.0, 80.5)
    B.label("J4", 117.4, 80.5)
    flex_header(B, "J3", 88.0, 80.0, 16.0)
    B.label("J3", 78.6, 80.0)
    flex_header(B, "J6", 128.0, 80.4, 12.0)
    B.label("J6", 136.6, 80.4)
    for ref, x, s, jx in (("U2", -114.0, -1, -126.0), ("U3", 102.0, 1, 112.0)):
        soic(B, ref, x, 80.5, turn=True, mark="AMP")
        B.label(ref, x, 76.6)
        leg = x + s * 2.8
        h, d, u = ("W", "SW", "NW") if s < 0 else ("E", "SE", "NE")
        far, near = jx + s * 1.25, jx - s * 1.25
        # The output pair: the lower leg to the connector's far pin, round the upper one's.
        lower = abs(far - leg - s * 4.9) - 0.6
        upper = abs(near - leg - s * 4.97) - 0.3
        B.trace(walk((leg, 78.595), "%s2.7 %s2.2 %s%.3f %s0.6 N1.2" % (h, d, h, lower, u)), 0.5, ref + "_OUTN")
        B.trace(walk((leg, 79.865), "%s2.7 %s2.27 %s%.3f %s0.3 N0.3" % (h, d, h, upper, u)), 0.5, ref + "_OUTP")
        for i in range(4):         # its inputs, from the other side's legs down vias
            zz = 80.5 + (i - 1.5) * 1.27
            B.trace(walk((x - s * 2.8, zz), ("E" if s < 0 else "W") + "1.6"), 0.25, "%s_IN%d" % (ref, i))
            B.via(x - s * 4.4, zz)
    electrolytic(B, "C2", 107.0, 44.0, 5.0, 11.0)
    B.label("C2", 107.0, 50.6)
    electrolytic(B, "C3", 118.5, 41.5, 3.15, 7.0)
    B.label("C3", 118.5, 46.2)


def board_stitching(B, pitch):
    """Ground-stitching vias on a regular grid wherever the board is open: clear of every part,
    trace, word, zone, screw hole and via, and of the board's edge."""
    holes = [(x, z) for x, z in SCREWS if z < ZC]

    def gap(x, z, x0, z0, x1, z1):
        return math.hypot(max(x0 - x, 0.0, x - x1), max(z0 - z, 0.0, z - z1))

    def open_at(x, z):
        if any(gap(x, z, *r[1:]) < 1.7 for r in B.parts) or any(gap(x, z, *r[1:]) < 1.6 for r in B.zones):
            return False
        if any(gap(x, z, *r) < 1.2 for r in B.words):
            return False
        if any(_point_segment((x, z), a, b) < w / 2 + 1.1 for pts, w, _ in B.traces for a, b in zip(pts, pts[1:])):
            return False
        if any(math.hypot(vx - x, vz - z) < ro + 1.6 for vx, vz, ro in B.vias):
            return False
        return all(math.hypot(hx - x, hz - z) > 7.5 for hx, hz in holes)
    n = int((BOARD_W / 2 - 2.0) // pitch)
    z = BOARD_Z0 + 2.2
    while z < BOARD_Z1 - 2.0:
        for x in [i * pitch for i in range(-n, n + 1)]:
            if open_at(x, z):
                B.via(x, z, ro=0.4)
        z += pitch


def board_marks(B):
    """The silkscreened ncam logo and its lines, the Đông Sơn sun beside them, the hexagon pour."""
    silk(B.name + "_silk_logo", B.root, "ncam", -58.0, 53.0, size=10.0, font="futura")
    silk(B.name + "_silk_model", B.root, "CD-02  SEE-THROUGH PLAYER", -58.0, 44.0, size=1.9)
    silk(B.name + "_silk_rev", B.root, "REV A  2026", -58.0, 40.6, size=1.6)
    B.words.append((-66.6, 40.2, -49.4, 53.8))     # the logo and its two lines, as Futura and Avenir set them
    dongson_sun(B, *SUN)
    hex_pour(B, POUR_ZONE)


def clear_board(name, root, playing=False):
    """The board across the lower part of the body, its parts facing the viewer: on the left the
    SoC under its heat spreader with its two LPDDR packages, the PMIC and its three inductors,
    USB-C on the lower edge; the Đông Sơn sun beside the ncam logo, a hexagon ground pour; the LCD
    (its flex in J8) and the VU strip with six LEDs under it; on the right the Wi-Fi module's
    shield can and its meander antenna in a keep-out; an amplifier by each speaker's connector,
    the connectors the cables land in, test pads, vias, and the copper traces between them."""
    cz = (BOARD_Z0 + BOARD_Z1) / 2
    holes = [circle(4.8, 24, cx=x, cy=z) for x, z in SCREWS if z < ZC]
    board = fslab(name + "_board", [rrect(BOARD_W, BOARD_Z1 - BOARD_Z0, 3.0, cy=cz)] + holes, FACE_Y,
                  FACE_Y + 1.6, M["board"], bevel_mm=0.3, parent=root)
    B = Board(name, root)
    board_compute(B)
    board_power(B)
    board_display(B, playing)
    board_radio(B)
    board_audio(B)
    board_marks(B)
    board_stitching(B, 10.0 if WEB else 6.0)
    B.done()
    return board


def clear_lcd(name, root, playing):
    """The LCD module on four standoffs, its screen the page's lcd_screen print (54 x 24 mm's
    aspect, as the suitcase's: the page paints 256 x 112)."""
    x, z = 0.0, 51.0
    face = FACE_Y - 7.5
    for k, (dx, dz) in enumerate(((-26.0, -9.5), (26.0, -9.5), (-26.0, 9.5), (26.0, 9.5))):
        ylathe("%s_lcd_post_%d" % (name, k), [(0.01, 0), (1.3, 0), (1.3, 4.5), (0.01, 4.5)], M["solder"],
               x + dx, FACE_Y, z + dz, toward=-1, seg=16, parent=root)
    fslab(name + "_lcd_frame", [rrect(58.0, 24.0, 1.2), rrect(49.6, 22.0, 0.6)], face, face + 3.0, M["chip"],
          bevel_mm=0.3, x=x, z=z, parent=root)
    rbox(name + "_lcd_back", (57.0, 23.0, 0.6), M["chip"], parent=root, loc=L(x, face + 2.7, z), rot=FRONT)
    band(name + "_lcd_tail", [(x, face + 3.0, z - 11.5), (x, face + 3.6, z - 13.5), (x, FACE_Y - 0.4, z - 14.2)],
         18.0, M["flex"], side=(1.0, 0.0, 0.0), parent=root)
    rbox(name + "_lcd_screen", (48.0, 21.0, 0.05), M["lcd_screen"], parent=root, loc=L(x, face + 0.6, z), rot=FRONT)
    if WEB:
        return
    # A render lights the track and the time over the unlit segments.
    y = face + 0.56
    on = M["lcd_glow"] if playing else M["lcd_ghost"]
    text(name + "_lcd_g1", "88", 11.0, M["lcd_ghost"], font="din", parent=root, loc=L(x - 12.5, y + 0.01, z - 1.6),
         rot=FRONT)
    text(name + "_lcd_t1", "01", 11.0, on, font="din", parent=root, loc=L(x - 12.5, y, z - 1.6), rot=FRONT)
    text(name + "_lcd_g2", "8:88", 7.6, M["lcd_ghost"], font="din", parent=root, loc=L(x + 10.5, y + 0.01, z - 2.6),
         rot=FRONT)
    text(name + "_lcd_t2", "1:24", 7.6, on, font="din", parent=root, loc=L(x + 10.5, y, z - 2.6), rot=FRONT)
    text(name + "_lcd_cd", "CD   PLAY   RPT", 2.2, on, font="avenir", align="LEFT", parent=root,
         loc=L(x - 21.5, y, z + 7.4), rot=FRONT)


def clear_vu(name, root, playing):
    """The ten VU segments on a black bar module, one `vu` material for all ten (the page clones it
    per segment); a render lights the first seven."""
    x0, z = 64.0, 51.0
    face = FACE_Y - 4.0
    rbox(name + "_vu_body", (58.0, 4.0, 11.0), M["chip"], bevel_mm=0.4, parent=root, loc=L(x0, FACE_Y - 2.0, z))
    for k in range(10):
        lit = WEB or (playing and k < 7)
        rbox("%s_vu_seg_%d" % (name, k), (3.8, 6.6, 0.3), M["vu"] if lit else M["vu_dim"], parent=root,
             loc=L(x0 + (k - 4.5) * 5.2, face - 0.12, z), rot=FRONT)

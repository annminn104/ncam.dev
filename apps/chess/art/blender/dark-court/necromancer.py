# Necromancer (Bishop). exec kit.py, holy-order/patriarch.py, holy-order/bishop.py, court.py, then this file into one
# dict; call build_b(). Built at the king's scale on the Bishop's body (his cassock, sash, capelet and bead chain, the
# Patriarch's sleeves, face and book frame carry over), then scaled down by SCALE about the base's top.
import math

from mathutils import Euler, Matrix, Vector

PFX = 'NC_'
COLL = 'Necromancer'
SCALE = 0.86
# POSE (the head tilts toward the tome) and CAP_SLOT (a main capelet) carry over from the Bishop.
# the staff's axis: the Patriarch's, stood further out and a little forward, clear of the hood
SX, SYY = -0.287, -0.074
# The right hand holds the staff as the Bishop holds his crozier; the left is raised out to the side, palm up,
# under the tome.
ARMS = {'R': ((-0.12, 0.0, 0.675), (SX + 0.016, SYY + 0.01, 0.548)), 'L': ((0.12, 0.0, 0.675), (0.236, -0.07, 0.59))}
# sleeves with a plum (crimson) band between the silver (gold) cuffs, as the Overlord's
SLEEVE_SLOT = ['main', 'main', 'main', 'main', 'trim', 'accent', 'trim', 'trim', 'trim', 'second', 'second']
HEAD_SUFFIXES = ['Head', 'Face', 'Brows', 'Bangs', 'HairLocks', 'Hood', 'HoodGem', 'LinesHair', 'LinesHood']
FANG_Z = 0.8622                                      # the Patriarch's mouth line at x = 0.006 either side (build_head)
TOGGLES = (0.2, 0.25, 0.3, 0.35, 0.4, 0.5)           # the bone toggles across the cassock's front: their heights
SIGIL_Z = 0.31                                       # the rune circle on the cassock's back: its centre's height
PENDANT_Z, PENDANT_R = 0.585, 0.024                  # the skull on the bead chain: its centre's height and radius
# the hood: its cowl's radius over the hair, the elevation (degrees) where the point rises from the cowl, and the
# rows round the point and down the cowl; its open edge (elevations, degrees): above the brows in front, `open`
# degrees either side of the middle, falling to `back` at `side` degrees round, the hem behind that cut into `points`
# points a side, `depth` degrees deep; the metal band along the edge, degrees wide; the cloth's thickness; how far
# the cowl flares out as it falls 52 degrees from the ears (the Abbess's veil 0.03; less here, so the staff clears it)
HOOD_R, HOOD_EL, HOOD_ROWS = 0.262, 50.0, (12, 12)
HOOD_EDGE = {'front': 34.0, 'open': 46.0, 'side': 82.0, 'back': -46.0, 'points': 4, 'depth': 13.0}
HOOD_BAND, HOOD_THICK, HOOD_FALL = 3.0, 0.009, 0.01
# the hood's point: its length along its spine, how far it bends (degrees) toward HOOD_BEND (the figure's left, so
# that the bend reads from the front and from behind) from what fraction of its length on, how its radius narrows to
# the tip (an exponent), and how far up it the lining reaches (from there to the tip the point is solid cloth)
HOOD_POINT = {'len': 0.27, 'bend': 125.0, 'from': 0.3, 'taper': 1.6, 'lining': 0.4}
HOOD_BEND = Vector((1.0, 0.0, 0.0))
# the staff: its shaft's top; its metal bands (bottom, height, radius); the hook on it, in the staff's plane
# (out from the shaft, away from the head; height); the barbs along the hook's back (where along it, length)
STAFF_TOP = 1.15
STAFF_BANDS = ((0.082, 0.032, 0.0158), (0.468, 0.014, 0.0152), (0.586, 0.014, 0.0152), (0.86, 0.012, 0.014),
               (1.122, 0.032, 0.0165))
HOOK = [(0.0, 1.13), (0.0, 1.2), (-0.008, 1.245), (-0.035, 1.272), (-0.068, 1.272), (-0.09, 1.25), (-0.1, 1.222),
        (-0.1, 1.205)]
HOOK_BARBS = ((0.42, 0.024), (0.58, 0.028), (0.74, 0.024))
# the skull lantern on its chain under the hook's end: its centre and radius
LANTERN = Vector((SX - 0.1, SYY, 1.092))
LANTERN_R = 0.042
# the tome: the Patriarch's book frame (book_at) off his hand, floating beside the left shoulder, its pages turned to
# the front and tilted up; its page width and height, how far each half opens toward the reader (degrees), the page
# blocks' thickness and the covers'
BOOK_C = Vector((0.37, -0.11, 0.725))
BOOK_R = Euler((math.radians(-30), 0.0, math.radians(25))).to_matrix()
TOME = {'w': 0.068, 'h': 0.096, 'open': 14.0, 'pages': 0.007, 'cover': 0.004}
# three sparks above the tome (book frame: x, y, z, radius)
TOME_SPARKS = ((-0.05, -0.02, 0.071, 0.006), (0.032, -0.03, 0.08, 0.005), (0.068, -0.012, 0.062, 0.004))
# invented glyphs, from no alphabet, for the tome's pages: strokes in a cell from -1 to 1 each way, one point a dot
GLYPHS = [
    [[(0.0, -1.0), (0.0, 1.0)], [(0.0, 0.45), (0.65, 0.85)], [(0.0, -0.25), (-0.65, 0.15)]],
    [[(-0.8, -0.8), (0.8, -0.8), (0.0, 0.9), (-0.8, -0.8)], [(0.0, -0.3)]],
    [[(-0.7, 0.9), (0.0, 0.35), (0.7, 0.9)], [(-0.7, -0.15), (0.0, -0.7), (0.7, -0.15)]],
    [[(0.0, 1.0), (0.7, 0.0), (0.0, -1.0), (-0.7, 0.0), (0.0, 1.0)], [(-0.7, 0.0), (0.7, 0.0)]],
    [[(-0.6, -0.9), (0.6, -0.9), (0.6, 0.4), (-0.3, 0.4), (-0.3, -0.35)]],
    [[(-0.9, 0.35), (-0.3, -0.35), (0.3, 0.35), (0.9, -0.35)], [(0.0, 0.85)]],
    [[(0.75 * math.cos(math.pi * q / 4), 0.75 * math.sin(math.pi * q / 4)) for q in range(9)], [(0.0, 0.0)]],
]
GLYPH_ROWS = (0.033, 0.0145, -0.004, -0.0225)       # on each page: the rows' heights, the columns' places from the
GLYPH_COLS = (0.017, 0.03, 0.043, 0.056)             # spine out (book frame) and a glyph's half width and height
GLYPH_SIZE = (0.0045, 0.0056)


# ================================================================== the cassock (the Bishop's)
def build_cassock_nc():
    """The Bishop's cassock: the robe in coat, the sash and its ends, the shoes; its lace in accent, as the Court has
    it. His gold buttons become bone toggles across the front (bones lying on the cloth, knobbed at both ends), and
    his cross on the back the Court's rune circle: an accent disc in two metal rings with eight marks between them, a
    metal star with a gem in the middle."""
    build_cassock()
    reslot(PFX + 'Alb', 'white', 'accent')
    for n in ('Buttons', 'Placket'):
        drop(PFX + n)
    rb = bvh_of(O(PFX + 'Robe'))
    bm = new_bm()                                    # the coat's metal front edge, the Bishop's (its line: LinesCloth)
    decal_band(bm, rb, [(0.012, 0.56), (0.014, 0.42), (0.018, 0.3), (0.024, 0.19)], [0.0035] * 4, FR, 0.003, 'trim',
               n=30)
    out(PFX + 'Placket', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for z in TOGGLES:
        w = 0.046 + 0.06 * max(0.0, 0.42 - z)        # across the Bishop's two columns of buttons
        a, m, b = (on_surf(rb, x, z, 0.0075)[0] for x in (-w, 0.0, w))
        tube(bm, [a, m, b], 0.0042, 'skin', n=10, k=8)
        for p in (a, b):
            ellipsoid(bm, p, (0.0063,) * 3, 'skin', segs=10, rings=6)
    out(PFX + 'Toggles', bm, SMALL, sharp=60)
    bm, bg = new_bm(), new_bm()
    decal_poly(bm, rb, ellipse(0, SIGIL_Z, 0.078, 0.078, 48), BACK, 0.0024, 'accent', rings=3)
    for rr, w in ((0.072, 0.0032), (0.054, 0.0022)):
        decal_band(bm, rb, [(rr * math.cos(math.pi * q / 16), SIGIL_Z + rr * math.sin(math.pi * q / 16))
                            for q in range(33)], [w] * 33, BACK, 0.0034, 'trim', n=96)
    for q in range(8):
        a = math.pi * (q + 0.5) / 4
        rad, tan = Vector((math.cos(a), math.sin(a))), Vector((-math.sin(a), math.cos(a)))
        c = Vector((0.063 * math.cos(a), SIGIL_Z + 0.063 * math.sin(a)))
        mark = [c + rad * 0.0055, c + tan * 0.0028, c - rad * 0.0055, c - tan * 0.0028]
        decal_poly(bm, rb, edge_pts([(p.x, p.y) for p in mark], 0.002), BACK, 0.0036, 'trim', center=(c.x, c.y),
                   rings=2)
    decal_poly(bm, rb, star_poly(0, SIGIL_Z, 0.024, 0.036), BACK, 0.0036, 'trim', center=(0, SIGIL_Z), rings=2)
    decal_poly(bg, rb, ellipse(0, SIGIL_Z, 0.0065, 0.0065, 14), BACK, 0.0048, 'gem', rings=1)
    out(PFX + 'Sigil', bm, 0, sharp=80, recalc=False)
    out(PFX + 'SigilGem', bg, 0, sharp=80, recalc=False)


def build_sleeves_nc():
    """The Patriarch's sleeves on the Necromancer's arms (ARMS, SLEEVE_SLOT), their lace frills in accent."""
    build_sleeves()
    reslot(PFX + 'Frills', 'white', 'accent')


# ================================================================== hands
def palm_frame():
    """The raised left hand: its palm's centre, out of the cuff, the way its fingers point (out to the side, a little
    forward and up) and its palm's normal (up, tipped out toward the tome)."""
    sh, wr = (Vector(p) for p in ARMS['L'])
    H = wr + (wr - sh).normalized() * 0.045 + Vector((0.0, 0.0, 0.014))
    N = Vector((0.35, -0.05, 1.0)).normalized()
    F = Vector((0.8, -0.38, 0.3))
    return H, (F - N * F.dot(N)).normalized(), N


def build_hands_nc():
    """Gloved hands: the right holds the staff as the Patriarch's holds his; the left, on a wrist out of its cuff, is
    raised under the tome, palm up (palm_frame), its fingers a little spread and curled, the thumb back."""
    bm = new_bm()
    S = Vector((SX, SYY, 0.0))                       # the Patriarch's grip, about the staff's axis
    ellipsoid(bm, S + Vector((0.016, 0.006, 0.531)), (0.021, 0.025, 0.03), 'glove', segs=16, rings=10)
    for k in range(4):
        z = 0.55 - 0.0125 * k
        rf = 0.0105 + 0.0072
        pts = [S + Vector((rf * math.cos(math.radians(a)), rf * math.sin(math.radians(a)),
                           z - 0.0018 * (a + 15) / -185)) for a in (-15, -60, -105, -150, -200)]
        tube(bm, pts, 0.0072 - 0.0004 * k, 'glove', n=10, k=8)
        ellipsoid(bm, pts[-1], (0.0068,) * 3, 'glove', segs=8, rings=6)
    thumb = [S + Vector((0.023, -0.012, 0.536)), S + Vector((0.014, -0.022, 0.548)), S + Vector((0.002, -0.024, 0.556))]
    tube(bm, thumb, 0.0078, 'glove', n=8, k=8)
    ellipsoid(bm, thumb[-1], (0.0075,) * 3, 'glove', segs=8, rings=6)
    H, F, N = palm_frame()
    T = N.cross(F)                                   # toward the thumb: back, the palm up and the arm out
    sh, wr = (Vector(p) for p in ARMS['L'])
    tube(bm, [wr - (wr - sh).normalized() * 0.02, H - F * 0.014 - N * 0.002], 0.0125, 'glove', n=4, k=10)
    ellipsoid(bm, H, (0.022, 0.025, 0.011), 'glove', segs=16, rings=10, rot=Matrix((F, T, N)).transposed())
    for k, (o, L) in enumerate(((0.0135, 1.0), (0.0045, 1.08), (-0.0045, 1.0), (-0.0135, 0.84))):
        f = (F + T * (o * 4)).normalized()
        base = H + F * 0.018 + T * o + N * 0.002
        pts = [base, base + f * 0.016 * L + N * 0.004, base + f * 0.029 * L + N * 0.012]
        tube(bm, pts, 0.0066 - 0.0003 * k, 'glove', n=8, k=8)
        ellipsoid(bm, pts[-1], (0.0062 - 0.0003 * k,) * 3, 'glove', segs=8, rings=6)
    root = H + T * 0.017 - F * 0.004
    thumb = [root, root + T * 0.012 + F * 0.007 + N * 0.006, root + T * 0.016 + F * 0.017 + N * 0.012]
    tube(bm, thumb, 0.0074, 'glove', n=8, k=8)
    ellipsoid(bm, thumb[-1], (0.007,) * 3, 'glove', segs=8, rings=6)
    out(PFX + 'Gloves', bm, SMALL, sharp=60)


# ================================================================== capelet and pendant
def build_capelet_nc():
    """The Bishop's capelet and bead chain; where his cross hung, a small skull (court.skull) with glowing pupils
    resting on the capelet, on a short metal bail from the chain's lowest bead."""
    build_capelet_b()
    drop(PFX + 'Pectoral')
    capb = bvh_of(O(PFX + 'Capelet'))
    low, _ = on_surf(capb, 0.0, PENDANT_Z, 0.0)
    C = Vector((0.0, low.y - 1.03 * PENDANT_R - 0.003, PENDANT_Z))
    bm, bf = new_bm(), new_bm()
    skull(bm, C, PENDANT_R, 'skin', face=bf, pupils='glow', segs=24, rings=18)
    out(PFX + 'Pendant', bm, SMALL, sharp=80)
    out(PFX + 'PendantFace', bf, 0, sharp=80, recalc=False)
    bead = on_surf(capb, 0.0, 0.62, 0.0055)[0]       # the chain's lowest bead (build_capelet_b)
    top = C + Vector((0.0, 0.0, 0.95 * PENDANT_R))
    bm = new_bm()
    tube(bm, [bead, (bead + top) / 2 + Vector((0.0, 0.0, 0.003)), top], 0.0022, 'trim', n=6, k=6)
    ring = [(0.0045 + 0.0016 * math.cos(math.pi * q / 3), 0.0016 * math.sin(math.pi * q / 3)) for q in range(6)]
    lathe(bm, ring, 12, 'trim', xform=Matrix.Translation(top) @ axis_to((0, 1, 0)), wrap=True)
    out(PFX + 'PendantBail', bm, SMALL, sharp=45)


# ================================================================== staff and lantern
def build_staff_nc():
    """The staff in the right hand: a leather shaft banded in metal, topped by a metal hook that bends out away from
    the head, small barbs along its back; from the hook's end the lantern hangs on a chain of metal links: a small
    skull (court.skull) whose sockets open on a glowing core."""
    M = Matrix.Translation((SX, SYY, 0))
    bm = new_bm()
    lathe(bm, [(0.0, 0.082), (0.0105, 0.082), (0.0105, STAFF_TOP), (0.0, STAFF_TOP)], 16, 'leather', xform=M)
    for z0, h, r in STAFF_BANDS:
        lathe(bm, [(0.0, z0), (r * 0.9, z0), (r, z0 + h * 0.3), (r, z0 + h * 0.7), (r * 0.9, z0 + h), (0.0, z0 + h)],
              16, 'trim', xform=M)
    out(PFX + 'Shaft', bm, MID, sharp=50)
    path = [Vector((SX + dx, SYY, z)) for dx, z in HOOK]
    C = catmull(path, 48)

    def hook_r(t):
        """The hook's radius at t along it: as thick as the top band, thinning toward its end."""
        return 0.0115 * (1 - 0.4 * t)
    bm = new_bm()
    tube(bm, path, 0.0115, 'trim', n=48, k=10, radius=hook_r)
    ellipsoid(bm, C[-1], (0.0085,) * 3, 'trim', segs=12, rings=8)
    Y = Vector((0.0, 1.0, 0.0))
    for t, L in HOOK_BARBS:
        i = round(t * 48)
        tng = (C[i + 1] - C[i - 1]).normalized()
        back = Vector((tng.z, 0.0, -tng.x))          # the hook's outer side: it curls up, over and down to the left
        z = (back + tng * 0.45).normalized()          # raked toward the hook's end
        x = (tng - z * tng.dot(z)).normalized()
        spike(bm, basis(C[i] + back * hook_r(t) * 0.6, x, Y, z), L, 0.0065, 0.0045, waist=0.1)
    out(PFX + 'Hook', bm, MID, sharp=35)
    top = C[-1] - Vector((0.0, 0.0, 0.007))
    eye = LANTERN + Vector((0.0, 0.0, 0.95 * LANTERN_R + 0.004))
    n = max(2, round((top.z - eye.z) / 0.0105))
    bm = new_bm()
    link = [(0.0048 + 0.0016 * math.cos(math.pi * q / 3), 0.0016 * math.sin(math.pi * q / 3)) for q in range(6)]
    for q in range(n):
        Mq = Matrix.Translation(top.lerp(eye, (q + 0.5) / n)) @ Matrix.Rotation(math.pi / 2 * (q % 2), 4, 'Z') @ \
            Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Diagonal((1.0, 1.6, 1.0, 1.0))
        lathe(bm, link, 12, 'trim', xform=Mq, wrap=True)
    eyelet = [(0.006 + 0.002 * math.cos(math.pi * q / 3), 0.002 * math.sin(math.pi * q / 3)) for q in range(6)]
    lathe(bm, eyelet, 14, 'trim', xform=Matrix.Translation(eye) @ Matrix.Rotation(math.pi / 2, 4, 'X'), wrap=True)
    out(PFX + 'LanternChain', bm, SMALL, sharp=45)
    bm, bf = new_bm(), new_bm()
    skull(bm, LANTERN, LANTERN_R, 'skin', face=bf, hollow=True, segs=40, rings=30)
    out(PFX + 'Lantern', bm, SMALL, sharp=80)
    out(PFX + 'LanternFace', bf, 0, sharp=80, recalc=False)
    bm = new_bm()
    ellipsoid(bm, LANTERN + Vector((0.0, -0.002, -0.004)), (0.7 * LANTERN_R,) * 3, 'glow', segs=16, rings=12)
    out(PFX + 'LanternCore', bm, 0, sharp=80)


# ================================================================== the floating tome
def tome_half(s):
    """One half of the open tome (s = -1 the left, +1 the right) in the book frame (book_at): the way out from the
    spine along its page, the way its page faces (toward the reader) and its rotation (x out, z up the spine)."""
    b = math.radians(TOME['open'])
    ex = Vector((s * math.cos(b), -math.sin(b), 0.0))
    en = Vector((-s * math.sin(b), -math.cos(b), 0.0))
    Z = Vector((0.0, 0.0, 1.0))
    return ex, en, Matrix((ex, Z.cross(ex), Z)).transposed()


def page_pt(s, x, z):
    """A point of the top page of the tome's half s (tome_half), x out from the spine and z up it (book frame): the
    pages dip into the gutter and lie flat from 40% of their width on."""
    ex, en, _ = tome_half(s)
    rise = TOME['pages'] * (0.35 + 0.65 * smooth_nc(x / (0.4 * TOME['w'])))
    return ex * x + en * rise + Vector((0.0, 0.0, z))


def block_nc(bm, top, bot, nu, nv, slot):
    """A closed block into bm between two grids of nu by nv cells, top(i, j) and bot(i, j) (an open book's page block
    over its cover), every face in slot."""
    T = [[bm.verts.new(top(i, j)) for j in range(nv + 1)] for i in range(nu + 1)]
    B = [[bm.verts.new(bot(i, j)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            face(bm, [T[i][j], T[i + 1][j], T[i + 1][j + 1], T[i][j + 1]], slot)
            face(bm, [B[i][j + 1], B[i + 1][j + 1], B[i + 1][j], B[i][j]], slot)
    for i in range(nu):
        face(bm, [T[i][0], B[i][0], B[i + 1][0], T[i + 1][0]], slot)
        face(bm, [T[i + 1][nv], B[i + 1][nv], B[i][nv], T[i][nv]], slot)
    for j in range(nv):
        face(bm, [T[0][j + 1], B[0][j + 1], B[0][j], T[0][j]], slot)
        face(bm, [T[nu][j], B[nu][j], B[nu][j + 1], T[nu][j + 1]], slot)


def build_tome():
    """The open tome floating beside the figure (book_at): white pages in two blocks dipping into the gutter, coat
    covers with metal corners on a round coat spine, invented glyphs (GLYPHS) glowing on the pages, three sparks
    above it."""
    W, H, CT = TOME['w'], TOME['h'], TOME['cover']
    nu, nv = 10, 6
    bm = new_bm()
    for s in (-1, 1):
        ex, en, _ = tome_half(s)
        block_nc(bm, lambda i, j, s=s: book_at(page_pt(s, W * i / nu, H * (j / nv - 0.5))),
                 lambda i, j, ex=ex, en=en: book_at(ex * (W * i / nu) + en * 0.0005 +
                                                    Vector((0.0, 0.0, H * (j / nv - 0.5)))),
                 nu, nv, 'white')
    out(PFX + 'Pages', bm, SMALL, sharp=40)
    bm, bc = new_bm(), new_bm()
    for s in (-1, 1):
        ex, en, R = tome_half(s)
        box(bm, book_at(ex * (W / 2 + 0.0005) - en * (CT / 2)), (W + 0.008, CT, H + 0.008), 'coat', rot=BOOK_R @ R)
        for sz in (-1, 1):
            corner = ex * (W + 0.0045) - en * (CT / 2) + Vector((0.0, 0.0, sz * (H / 2 + 0.004)))
            slab(bc, [(0.0, 0.0), (-0.016, 0.0), (0.0, -sz * 0.016)],
                 Matrix.Translation(book_at(corner)) @ (BOOK_R @ R).to_4x4(), CT + 0.002, bevel=0.0006, seg=1)
    tube(bm, [book_at((0.0, 0.0045, -H / 2 - 0.004)), book_at((0.0, 0.0045, H / 2 + 0.004))], 0.0075, 'coat', n=2, k=12)
    set_slot(bc, bc.faces, 'trim')
    out(PFX + 'Covers', bm, MID, smooth=False)
    out(PFX + 'TomeCorners', bc, SMALL, smooth=False)
    pb = bvh_of(O(PFX + 'Pages'))
    bm = new_bm()
    for s in (-1, 1):
        ex, en, _ = tome_half(s)
        frame = (BOOK_C, BOOK_R @ ex, BOOK_R @ Vector((0.0, 0.0, 1.0)), BOOK_R @ -en)
        for row, z in enumerate(GLYPH_ROWS):
            for col, x in enumerate(GLYPH_COLS):
                for stroke in GLYPHS[(3 * row + 5 * col + (2 if s > 0 else 0)) % len(GLYPHS)]:
                    pts = [(x + gx * GLYPH_SIZE[0], z + gz * GLYPH_SIZE[1]) for gx, gz in stroke]
                    if len(pts) == 1:
                        decal_poly(bm, pb, ellipse(pts[0][0], pts[0][1], 0.0012, 0.0012, 8), frame, 0.0008, 'glow',
                                   rings=1)
                    for p0, p1 in zip(pts, pts[1:]):
                        decal_band(bm, pb, [p0, p1], [0.0009, 0.0009], frame, 0.0008, 'glow', n=3)
    out(PFX + 'Runes', bm, 0, sharp=80, recalc=False)
    bm = new_bm()
    for k, (x, y, z, r) in enumerate(TOME_SPARKS):
        crystal(bm, book_at((x, y, z)), r, r * 1.7, r * 1.7, n=4, slot='glow', twist=0.4 * k)
    out(PFX + 'TomeSparks', bm, 0, smooth=False)


# ================================================================== face and hair
def build_face_nc():
    """The Patriarch's chibi face (build_head) made undead: glowing irises and two small fangs under the mouth
    (court.undead_fangs), joined into the Face part so the pack's lock keeps them."""
    build_head()
    undead_fangs(FANG_Z)


def fringe_pts(phi, tip):
    """The control points of the fringe's strand at azimuth phi whose tip hangs to elevation tip: the Patriarch's
    (bang_pts), rooted higher, under the hood's edge, so no bare brow shows between the two."""
    return [surf(phi, HOOD_EDGE['front'] + 2, 0.003, RH)] + bang_pts(phi, tip)


def build_hair_nc():
    """The hair under the hood: the Patriarch's fringe, as the Bishop wears it but rooted under the hood's edge
    (fringe_pts), and the two locks falling past the cheeks that the Acolyte wears under her hood."""
    bm = new_bm()
    for phi, tip, w in BANGS:
        strand(bm, fringe_pts(phi, tip), w, 0.009, 'hair', HC, n=12, k=10, prof=bang_prof)
    out(PFX + 'Bangs', bm, MID, sharp=70)
    bm = new_bm()
    for s in (-1, 1):
        strand(bm, [surf(s * 58, 24, 0.006, RH), surf(s * 64, -6, 0.016, RH), surf(s * 61, -30, 0.026, RH),
                    surf(s * 54, -46, 0.03, RH)], 0.036, 0.011, 'hair', HC, n=14, k=10, prof=bang_prof)
    out(PFX + 'HairLocks', bm, MID, sharp=70)


# ================================================================== the hood
def smooth_nc(x):
    """Smoothstep of x: 0 up to x = 0, 1 from x = 1, an S between."""
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def cowl_edge(phi):
    """The hood's open edge (an elevation, degrees, as surf() names them) at azimuth phi (0 the front): above the brows
    in front, falling past the cheeks to the back (HOOD_EDGE), where its hem is cut into points."""
    E = HOOD_EDGE
    a = abs(phi)
    if a < E['open']:
        return E['front']
    if a < E['side']:
        return E['front'] + (E['back'] - E['front']) * smooth_nc((a - E['open']) / (E['side'] - E['open']))
    u = (a - E['side']) / (180 - E['side']) * E['points']
    return E['back'] - E['depth'] * (1 - abs(u % 1 * 2 - 1))


def cowl_pt(phi, el, dr=0.0):
    """A point of the hood's cowl at azimuth phi and elevation el (degrees, as surf() names them), dr out from it: a
    shell over the hair (HOOD_R), flaring a little toward its edge below HOOD_EL, falling straight under the ears and
    drawn in under the head at the back, as the Abbess's veil falls."""
    t = max(0.0, (HOOD_EL - el) / (HOOD_EL - cowl_edge(phi)))
    flare = 0.006 + 0.014 * t * t + dr
    if el >= 8:
        return surf(phi, el, flare, HOOD_R)
    top = surf(phi, 8, flare, HOOD_R)
    o = Vector((top.x, top.y, 0.0)).normalized()
    z = HC.z + HOOD_R * 0.95 * math.sin(math.radians(el))
    p = Vector((top.x, top.y, z)) + o * (HOOD_FALL * (8 - el) / 52)
    kb = smooth_nc((abs(phi) - 95) / 45)
    if kb > 0:
        p = p.lerp(Vector((o.x * (0.2 + dr), o.y * (0.2 + dr), z)), kb * smooth_nc((8 - el) / 62) * 0.8)
    return p


def hood_centre():
    """The centre of the cowl's ring at HOOD_EL, where the hood's point rises from it."""
    ring = [cowl_pt(-180 + 5 * i, HOOD_EL) for i in range(72)]
    return sum(ring, Vector()) / len(ring)


def point_spine(J, u):
    """The hood point's spine at u (0 at the cowl's top ring, centred on J; 1 at the tip): its position there and the
    rotation that stands that ring on it. It rises straight up, then from HOOD_POINT['from'] of its length on bends
    HOOD_POINT['bend'] degrees over toward HOOD_BEND."""
    L, u0, bend = HOOD_POINT['len'], HOOD_POINT['from'], math.radians(HOOD_POINT['bend'])
    up = Vector((0.0, 0.0, 1.0))

    def tangent(t):
        """The spine's direction at t along it."""
        a = bend * smooth_nc((t - u0) / (1 - u0))
        return up * math.cos(a) + HOOD_BEND * math.sin(a)
    n = max(1, round(64 * u))
    p = Vector(J)
    for q in range(n):
        p += tangent(u * (q + 0.5) / n) * (L * u / n)
    return p, up.rotation_difference(tangent(u)).to_matrix()


def point_pt(J, phi, u, lift=0.0):
    """A point of the hood's point at azimuth phi and u along it (0 at the cowl's top ring, centred on J; 1 at the
    tip), lift off it: the cowl's ring at HOOD_EL narrowed by (1 - u) ** HOOD_POINT['taper'] and stood on
    point_spine."""
    S, F = point_spine(J, u)
    w = cowl_pt(phi, HOOD_EL) - J
    return S + F @ (w * ((1 - u) ** HOOD_POINT['taper'] + lift / w.length))


def build_hood_nc():
    """The tall pointed hood in coat, lined in accent, a metal band along all its edge and a gem at the brow: a cowl
    over the hair (cowl_pt), open on the face (cowl_edge), its hem pointed at the back; from its top the point rises
    and bends over toward the figure's left (point_pt), narrowing to its tip. The cloth is HOOD_THICK thick; the
    lining stops HOOD_POINT['lining'] up the point under a cap, and from there to the tip the point is solid, so no
    lining (nor its outline) can show through where the point grows thin."""
    cols = 72
    NC, NL = HOOD_ROWS
    J = hood_centre()
    us = [(NC - k) / NC for k in range(1, NC)]      # the point's rings, from under the tip down to the cowl's top
    j0 = next(j for j, u in enumerate(us) if u <= HOOD_POINT['lining'])     # the first ring with a lining
    ref = [point_spine(J, u)[0] for u in us] + [HC] * (NL + 1)    # what each row's normals face away from
    P = []                                           # the outer surface, a column of rows per azimuth
    for i in range(cols):
        phi = -180 + 360 * i / cols
        e = cowl_edge(phi)
        P.append([point_pt(J, phi, u) for u in us] + [cowl_pt(phi, HOOD_EL + (e + HOOD_BAND - HOOD_EL) * m / (NL - 1))
                                                      for m in range(NL)] + [cowl_pt(phi, e)])
    rows = len(P[0]) - 1
    bm = new_bm()
    outer, lining = [], []                           # each column's vertices: outside, and lining by row from j0
    for i in range(cols):
        outer.append([bm.verts.new(p) for p in P[i]])
        col = {}
        for j in range(j0, rows + 1):
            a = P[(i + 1) % cols][j] - P[i - 1][j]
            b = P[i][min(j + 1, rows)] - P[i][j - 1]
            n = a.cross(b).normalized()
            if n.dot(P[i][j] - ref[j]) < 0:
                n = -n
            col[j] = bm.verts.new(P[i][j] - n * HOOD_THICK)
        lining.append(col)
    tip = bm.verts.new(point_spine(J, 1.0)[0])
    cap = bm.verts.new(ref[j0])
    for i in range(cols):
        i2 = (i + 1) % cols
        for j in range(rows):
            face(bm, [outer[i][j], outer[i][j + 1], outer[i2][j + 1], outer[i2][j]],
                 'trim' if j == rows - 1 else 'coat')
            if j >= j0:
                face(bm, [lining[i][j], lining[i2][j], lining[i2][j + 1], lining[i][j + 1]], 'accent')
        face(bm, [outer[i][rows], outer[i2][rows], lining[i2][rows], lining[i][rows]], 'trim')
        face(bm, [outer[i2][0], tip, outer[i][0]], 'coat')
        face(bm, [lining[i][j0], cap, lining[i2][j0]], 'accent')
    out(PFX + 'Hood', bm, BIG, sharp=60)
    c = cowl_pt(0, HOOD_EDGE['front'] + HOOD_BAND / 2, 0.0035)
    n = (c - HC).normalized()
    bm = new_bm()
    gem_cut(bm, Matrix.Translation(c) @ axis_to(-n) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.009, 0.012, 0.014, 0.006)
    out(PFX + 'HoodGem', bm, SMALL, smooth=False)


# ================================================================== drawn lines
def build_lines_nc():
    """The painted linework: the robe's hem band and the cuffs engraved; folds on the cassock, the capelet, the sleeves
    and the hood; the coat's front overlap; strands on the fringe."""
    K = 1.5
    rb = bvh_of(O(PFX + 'Robe'))
    sleeveb = bvh_of(O(PFX + 'Sleeves'))
    # ---- engravings: the robe's hem band, the cuffs
    bm = new_bm()
    pts = [p for p in (ray_in(rb, 2 * math.pi * q / 240, 0.147 + 0.011 * math.sin(26 * 2 * math.pi * q / 240))
                       for q in range(241)) if p is not None]
    strip(bm, pts, [Vector((p.x, p.y, 0)).normalized() for p in pts], [0.0012 * K] * len(pts), 'lgold', 0.0012)
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        P = []
        for q in range(97):
            a = 2 * math.pi * q / 96
            w = max(0.0, math.cos(a) * d.x + math.sin(a) * d.y) ** 1.2
            zn = (0.925 + 0.018 * math.sin(9 * a)) * L + 0.055 * 0.7 * w
            P.append(M @ Vector((0.09 * math.cos(a), 0.09 * math.sin(a), zn)))
        hits = [sleeveb.find_nearest(p) for p in P]
        strip(bm, [h[0] for h in hits], [h[1] for h in hits], [0.0011 * K] * len(hits), 'lgold', 0.0012)
    out(PFX + 'LinesGold', bm, 0, sharp=80, recalc=False)
    # ---- cloth folds: the cassock's (the coat's darker line), its front overlap, the capelet's troughs, the sleeves'
    bm = new_bm()
    for k in range(8):
        a0 = (math.pi - 0.4 + 2 * math.pi * k) / 8
        ctrl = [ray_in(rb, a0 + 0.035 * (0.41 - z) / 0.24, z) for z in (0.41, 0.33, 0.25, 0.19)]
        if None not in ctrl:
            line3d(bm, rb, ctrl, 0.0024, 'lcoat', n=30)
    decal_band(bm, rb, [(-0.004, 0.56), (-0.004, 0.42), (-0.004, 0.3), (-0.004, 0.19)], [0.0012] * 4, FR, 0.003,
               'lcoat', n=30)
    capb = bvh_of(O(PFX + 'Capelet'))
    for k in range(12):
        a = math.radians(15 + 30 * k)
        ctrl = [capb.find_nearest(Vector((0.3 * math.cos(a), 0.27 * math.sin(a), z)))[0] for z in (0.572, 0.59, 0.612)]
        line3d(bm, capb, ctrl, 0.0017, 'lmain', n=10, taper='start')
    SLR = [(0.25, 0.05), (0.55, 0.062), (0.70, 0.071), (0.85, 0.078)]

    def sl_r(zn):
        """The sleeve's radius at zn of the arm's length (SLEEVE, roughly)."""
        for (z0, r0), (z1, r1) in zip(SLR, SLR[1:]):
            if zn <= z1:
                return r0 + (r1 - r0) * (zn - z0) / (z1 - z0)
        return SLR[-1][1]
    for sh, wr in ARMS.values():
        M, L, d = arm_frame(sh, wr)
        for a in (0.4, 1.9, 3.3, 4.6):
            line3d(bm, sleeveb, [M @ Vector((sl_r(zn) * math.cos(a + 0.15 * zn), sl_r(zn) * math.sin(a + 0.15 * zn),
                                             zn * L)) for zn in (0.32, 0.5, 0.66, 0.8)], 0.0016, 'lmain', n=18)
    out(PFX + 'LinesCloth', bm, 0, sharp=80, recalc=False)
    # ---- the fringe's strands (posed with the head)
    bm = new_bm()
    for phi, tip, w in BANGS:
        F = strand_frames(fringe_pts(phi, tip), HC, 12)
        P, N = [], []
        for i in range(1, 11):
            c, t, sd, nr = F[i]
            P.append(c + nr * 0.009 * bang_prof(i / 12))
            N.append(nr)
        strip(bm, P, N, widths(len(P), 0.0013, 'both'), 'lhair', 0.0011)
    out(PFX + 'LinesHair', bm, 0, sharp=80, recalc=False)
    # ---- the hood's folds down the cowl's back and sides and along the point; a metal seam up the middle of its back
    # to near the tip, which shows the point's bend from behind (posed with the head)
    bm = new_bm()
    hb = bvh_of(O(PFX + 'Hood'))
    for phi in (-150, -120, -95, 95, 120, 150):
        line3d(bm, hb, [cowl_pt(phi, el, 0.004) for el in (44, 25, 5, cowl_edge(phi) + HOOD_BAND + 4)], 0.0017, 'lcoat',
               n=24)
    J = hood_centre()
    side = math.degrees(math.atan2(HOOD_BEND.y, HOOD_BEND.x))        # the point's front side, across its bend
    for phi in (side, side - 180):
        line3d(bm, hb, [point_pt(J, phi, u, 0.004) for u in (0.04, 0.25, 0.45, 0.65)], 0.0016, 'lcoat', n=24)
    seam = [cowl_pt(180, el, 0.004) for el in (cowl_edge(180) + HOOD_BAND + 2, -20, 10, 35)]
    line3d(bm, hb, seam + [point_pt(J, 180, u, 0.004) for u in (0.0, 0.25, 0.5, 0.8)], 0.0026, 'trim', n=96,
           taper='end')
    out(PFX + 'LinesHood', bm, 0, sharp=80, recalc=False)


def build_b():
    """The Necromancer: the Bishop's body under a tall pointed hood, a staff hung with a skull lantern in the right
    hand, a tome floating over the raised left; posed and scaled as the Bishop."""
    build_base()
    build_cassock_nc()
    build_sleeves_nc()
    build_hands_nc()
    build_capelet_nc()
    build_staff_nc()
    build_tome()
    build_face_nc()
    build_hair_nc()
    build_brows()
    build_hood_nc()
    build_lines_nc()
    pose_head()
    scale_figure(SCALE)

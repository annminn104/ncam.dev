"""Cycles stills of the CD players and the turntable, headless:

    CDP_MODEL=suitcase|clear|deck|luxe CDP_HERO_VIEW=hero|lid|inside|top|platter|dancer \\
      CDP_HERO_QUALITY=preview|final \\
      /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
      --python-exit-code 1 --python apps/cd-player/art/blender/scripts/hero.py

CDP_MODEL picks the player: `suitcase` (the default; parts.py, its ornament in suitcase_ornament.py,
on ornament.py's kit), `clear` (clear.py, with its board in clear_board.py and its decorations in
clear_decor.py), `deck` (deck.py, with its screen, decor
and body detail in deck_panel.py, its flight case in deck_case.py and its print layer in
deck_print.py) or `luxe`, the turntable (luxe.py on vinyl.py's record, sleeve and LED ring, with
its tonearm in luxe_arm.py, its record stand and ledge in luxe_stand.py, its ornament in
luxe_ornament.py, on ornament.py's kit, and its dancer and her pedestal in luxe_dancer.py). The
Deck's print layer is the page's to paint, never
Cycles': the owner's stills hide it. CDP_DECK_ATLAS=checker maps a debug atlas onto it instead
(each region in its own colour, a 10 mm grid, a white corner where its row 0 and column 0 meet, its
id), into art/.out/deck/debug/.
The suitcase's views: `hero` is the three-quarter product still the design was approved from (the
lid open, a disc spinning, five more in the rack, a stack of cases beside it); `lid` looks straight
into the open lid (the case, the rack and its discs, the strap and the plate).
The Clear model's: `hero`, the three-quarter still of the player between its stand and its case,
and `inside`, a close-up of the board, the LCD and the mechanism through the shell. The Deck's:
`hero`, the three-quarter still of the deck and its flight case from the front left, and `top`,
over the jog (the disc through the acrylic, the LED ring, the pads, the keys and the screen). Luxe's:
`hero`, the three-quarter still of the deck and its record stand from the front left, a little
above, `platter`, over the platter (the record and its label, the strobe dots, the LED ring, the
tonearm on the record, the keys), and `dancer`, a close-up of the dancer on her pedestal from the
hero camera's side (Luxe's alone). `preview` is
800 x 600 at 24 samples, `final` 1600 x 1200 at 160; any other value of the model, the view or the
quality stops the run with exit 1, naming the valid ones. The art it prints is the gallery's
thumbnails (apps/portfolio/public/thumbnails), so anyone can rerun it. The suitcase's PNG lands in
art/.out/v2-<view>-<quality>.png, or art/.out/v2-<view>-grid-<quality>.png when parts.py builds
the grid layout. CDP_SKIN=<id> (an id of src/skins.json) renders that skin instead of Blush, into
art/.out/skins/<id>/. The Clear model renders its default look, or CDP_CLEAR_LOOK=<shell>,<frame>,
<board>,<light> (ids of src/clear-looks.json), into art/.out/clear/<look>/clear-<view>-<quality>.png.
The Deck renders its default look, or CDP_DECK_LOOK=<body>,<light> (ids of src/deck-looks.json),
into art/.out/deck/<body>-<light>/deck-<view>-<quality>.png. Luxe renders its default look, or
CDP_LUXE_LOOK=<body>,<metal>,<light> (ids of src/luxe-looks.json), into
art/.out/luxe/<body>-<metal>-<light>/luxe-<view>-<quality>.png. Each model takes its own colours
only: CDP_SKIN with another model, CDP_CLEAR_LOOK with another, CDP_DECK_LOOK with another, or
CDP_LUXE_LOOK with another stops the run too. Also runs in a live Blender through tools/bl.py.
"""
import math
import os
import bpy

BASE = os.path.dirname(os.path.abspath(__file__))
for f in ("cdkit.py", "parts.py"):
    exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())

ROOT = os.path.abspath(os.path.join(BASE, "..", "..", "..", "..", ".."))
THUMBS = os.path.join(ROOT, "apps", "portfolio", "public", "thumbnails") + "/"
OUT = os.path.abspath(os.path.join(BASE, "..", "..", ".out")) + "/"


def setting(name, default, valid):
    """The environment's `name`, `default` when unset. It stops the run, naming the valid values,
    on anything else (an empty value too), which would otherwise render the default unannounced."""
    value = os.environ.get(name, default)
    if value not in valid:
        raise SystemExit("hero.py: %s must be %s, not %r" % (name, " or ".join(valid), value))
    return value


VIEWS = {"suitcase": ("hero", "lid"), "clear": ("hero", "inside"), "deck": ("hero", "top"),
         "luxe": ("hero", "platter", "dancer")}
MODEL = setting("CDP_MODEL", "suitcase", tuple(VIEWS))
VIEW = setting("CDP_HERO_VIEW", "hero", VIEWS[MODEL])
QUALITY = setting("CDP_HERO_QUALITY", "preview", ("preview", "final"))
SKIN = os.environ.get("CDP_SKIN")  # an id of src/skins.json; unset renders Blush, empty is an error
CLEAR_LOOK = os.environ.get("CDP_CLEAR_LOOK")  # shell,frame,board,light ids of src/clear-looks.json
DECK_LOOK = os.environ.get("CDP_DECK_LOOK")  # body,light ids of src/deck-looks.json
LUXE_LOOK = os.environ.get("CDP_LUXE_LOOK")  # body,metal,light ids of src/luxe-looks.json
DECK_ATLAS = os.environ.get("CDP_DECK_ATLAS")  # `checker`: the Deck's print layer shows its debug atlas
if DECK_ATLAS is not None and (DECK_ATLAS != "checker" or os.environ.get("CDP_MODEL") != "deck"):
    raise SystemExit("hero.py: CDP_DECK_ATLAS must be checker, with CDP_MODEL=deck, not %r" % DECK_ATLAS)
# Each model takes its own colours: another's setting would be ignored unannounced.
if MODEL == "luxe" and (SKIN is not None or CLEAR_LOOK is not None or DECK_LOOK is not None):
    raise SystemExit("hero.py: Luxe takes CDP_LUXE_LOOK=<body>,<metal>,<light>, not CDP_SKIN, "
                     "CDP_CLEAR_LOOK or CDP_DECK_LOOK")
if MODEL != "luxe" and LUXE_LOOK is not None:
    raise SystemExit("hero.py: CDP_LUXE_LOOK colours Luxe (CDP_MODEL=luxe), not the %s" % MODEL)
if MODEL == "clear" and SKIN is not None:
    raise SystemExit("hero.py: CDP_SKIN colours the suitcase; the Clear model takes "
                     "CDP_CLEAR_LOOK=<shell>,<frame>,<board>,<light>, not CDP_SKIN=%r" % SKIN)
if MODEL == "suitcase" and CLEAR_LOOK is not None:
    raise SystemExit("hero.py: CDP_CLEAR_LOOK colours the Clear model (CDP_MODEL=clear); the suitcase "
                     "takes CDP_SKIN=<id>, not CDP_CLEAR_LOOK=%r" % CLEAR_LOOK)
if MODEL == "deck" and SKIN is not None:
    raise SystemExit("hero.py: CDP_SKIN colours the suitcase; the Deck takes CDP_DECK_LOOK=<body>,<light>, "
                     "not CDP_SKIN=%r" % SKIN)
if MODEL == "deck" and CLEAR_LOOK is not None:
    raise SystemExit("hero.py: CDP_CLEAR_LOOK colours the Clear model; the Deck takes "
                     "CDP_DECK_LOOK=<body>,<light>, not CDP_CLEAR_LOOK=%r" % CLEAR_LOOK)
if MODEL != "deck" and DECK_LOOK is not None:
    raise SystemExit("hero.py: CDP_DECK_LOOK colours the Deck (CDP_MODEL=deck); the %s takes %s, not "
                     "CDP_DECK_LOOK=%r" % ("suitcase" if MODEL == "suitcase" else "Clear model",
                                           "CDP_SKIN=<id>" if MODEL == "suitcase" else "CDP_CLEAR_LOOK", DECK_LOOK))
os.makedirs(OUT, exist_ok=True)


def studio():
    area_light("key", L(-900, -950, 1300), L(0, 0, 100), 1.3, 62, size_y=0.9)
    area_light("kicker", L(-700, 600, 500), L(0, 0, 150), 0.6, 30, color=(1.0, 0.94, 0.95))
    area_light("rim", L(700, 900, 900), L(0, 0, 120), 0.9, 40, color=(1.0, 0.96, 0.93))
    area_light("fill", L(1100, -500, 350), L(0, 0, 80), 1.1, 14)


def see_through_backdrop(world):
    """The Clear model's world (new_scene's `world`): the camera sees the flat backdrop,
    reflections and the light the studio HDRI. A ray that has only passed through glass on its way
    from the camera is still the camera's view, so it sees the backdrop too: without this, the
    shell would show the HDRI behind it, as if its back were smoked."""
    nt = world.node_tree if world is not None else None
    lp = next((n for n in nt.nodes if n.type == "LIGHT_PATH"), None) if nt else None
    mix = next((n for n in nt.nodes if n.type == "MIX_SHADER"), None) if nt else None
    if lp is None or mix is None:
        return

    def math_node(op, a, b):
        node = nt.nodes.new("ShaderNodeMath")
        node.operation = op
        for socket, value in zip(node.inputs, (a, b)):
            if isinstance(value, (int, float)):
                socket.default_value = value
            else:
                nt.links.new(value, socket)
        return node.outputs[0]

    # Through glass and nothing else: a transmission ray with no reflection and no diffuse bounce
    # behind it (Cycles counts a refraction in Transmission Depth, never in Glossy Depth), and not a
    # shadow ray.
    only_glass = math_node("MULTIPLY", math_node("LESS_THAN", lp.outputs["Glossy Depth"], 0.5),
                           math_node("LESS_THAN", lp.outputs["Diffuse Depth"], 0.5))
    through = math_node("MULTIPLY", lp.outputs["Is Transmission Ray"], only_glass)
    seen = math_node("MAXIMUM", lp.outputs["Is Camera Ray"], through)
    nt.links.new(math_node("MULTIPLY", seen, math_node("SUBTRACT", 1.0, lp.outputs["Is Shadow Ray"])),
                 mix.inputs["Fac"])


def clear_flags():
    """The Clear model's flags: dark cards out of the camera's sight that only reflections see, as
    a photographer sets them round a clear product, so the shell's edges and walls read against the
    light backdrop (the one on the floor in front takes the milky veil off the front plate). They
    cast no shadow and light nothing."""
    m = mat("flag", (0.012, 0.012, 0.014, 1), rough=0.9)
    for name, loc, size, target in (("flag_l", L(-760, 620, 300), (700, 600), L(0, 0, 150)),
                                    ("flag_r", L(820, 620, 300), (700, 600), L(0, 0, 150)),
                                    ("flag_floor", L(0, -900, 0.6), (2400, 1500), L(0, -900, 100))):
        ob = rbox(name, (size[0], size[1], 1.0), m, loc=loc)
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("Z", "Y").to_euler()
        for attr in ("visible_camera", "visible_diffuse", "visible_transmission", "visible_volume_scatter",
                     "visible_shadow"):
            setattr(ob, attr, False)
    return m


def deck_flags():
    """The Deck's flags: dark cards that glossy rays alone see (out of the camera's sight, casting no
    shadow, lighting nothing), as a photographer flags a glossy product. One behind and above the
    deck keeps the acrylic plate's back half and the deck's top from mirroring the rim light and the
    bright studio; one in front and above keeps the screen's black bezel, which faces the hero
    camera, from mirroring the bright studio behind that camera and reading grey."""
    m = mat("flag", (0.012, 0.012, 0.014, 1), rough=0.9)
    for name, loc, size, target in (("flag_deck", L(190, 640, 580), (1000.0, 700.0), L(0, 143, 93)),
                                    ("flag_screen", L(120, -420, 280), (1000.0, 520.0), L(0, 152, 136))):
        ob = rbox(name, (size[0], size[1], 1.0), m, loc=loc)
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("Z", "Y").to_euler()
        for attr in ("visible_camera", "visible_diffuse", "visible_transmission", "visible_volume_scatter",
                     "visible_shadow"):
            setattr(ob, attr, False)
    return m


def luxe_flags():
    """Luxe's flags, as a photographer flags a lacquered product, so that a gloss black reads black,
    not chrome, and the record black. Dark cards on the floor in front of the deck and left of it,
    which glossy rays alone see (out of the camera's sight, casting no shadow, lighting nothing),
    keep the lacquered front and left side from mirroring the bright floor (clear of the feet, the
    ledge and the stand). The rim light lights the scene but stays out of every glossy reflection:
    from the hero camera its reflection would lie across the whole top and the record, and a flag
    that casts no shadow cannot hide a light's own reflection."""
    m = mat("flag", (0.012, 0.012, 0.014, 1), rough=0.9)
    for name, loc, size in (("flag_floor", L(0, -925, 0.6), (2400.0, 1450.0)),
                            ("flag_floor_left", L(-864, 0, 0.6), (1272.0, 400.0))):
        ob = rbox(name, (size[0], size[1], 1.0), m, loc=loc)
        for attr in ("visible_camera", "visible_diffuse", "visible_transmission", "visible_volume_scatter",
                     "visible_shadow"):
            setattr(ob, attr, False)
    bpy.data.objects["rim"].visible_glossy = False
    return m


def suitcase_scene():
    for f in ("ornament.py", "suitcase_ornament.py"):
        exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())
    new_scene("cd_player_suitcase", res=(1600, 1200), samples=128)
    build_materials(skin_palette(SKIN) if SKIN is not None else None)

    artist = image_mat("art_disc", THUMBS + "holodex.jpg", 117, 117, coat=0.6, rough=0.3)
    album = image_mat("art_booklet", THUMBS + "garden-home.jpg", 120, 120, coat=0.3)
    rack_art = [image_mat("art_rack_%d" % i, THUMBS + f, 117, 117, coat=0.6, rough=0.3) for i, f in enumerate(
        ("chess.jpg", "mini-store.jpg", "garden-home.jpg", "cd-player.jpg", "holodex.jpg"))]
    covers = [image_mat("art_cover_%d" % i, THUMBS + f, 120, 120, coat=0.3) for i, f in enumerate(
        ("chess.jpg", "mini-store.jpg", "cd-player.jpg"))]

    floor = rbox("floor", (5000, 5000, 10), M["floor"], loc=L(0, 0, -5))
    floor.is_shadow_catcher = True
    make_player("player", artist, album, rack_art)
    bpy.data.objects["player_disc"].rotation_euler = (0, 0, math.radians(-8))
    for i, cov in enumerate(covers):
        make_case("stack_%d" % i, cov, L(272, 40, 3.4 + i * 10.45), (0, 0, math.radians(14 - i * 9)))
    make_case("open_case", covers[1], L(318, -178, 3.4), (0, 0, math.radians(-24)), open_deg=168.0)

    studio()
    if VIEW == "lid":
        # Straight into the open lid: its inner face leans back 10 degrees, its centre is at
        # (0, 165, 196); the camera stands 680 mm out along the face's normal.
        camera("cam", L(0, -505, 314), L(0, 165, 196), lens=50, fstop=8.0, focus=L(0, 165, 196))
    else:
        camera("cam", L(-420, -800, 470), L(60, -10, 132), lens=50, fstop=7.1, focus=L(-10, -40, 90))

    return OUT + ("skins/%s/" % SKIN if SKIN is not None else "") + "v2-%s%s-%s.png" % (
        VIEW, "-grid" if RACK_LAYOUT == "grid" else "", QUALITY)


def clear_scene():
    for f in ("clear.py", "clear_board.py", "clear_decor.py"):
        exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())
    look, ids = clear_look(CLEAR_LOOK)
    new_scene("cd_player_clear", res=(1600, 1200), samples=128)
    build_clear_materials(look)
    see_through_backdrop(SC.world)
    artist = image_mat("art_disc", THUMBS + "holodex.jpg", 117, 117, coat=0.6, rough=0.3)
    album = image_mat("art_booklet", THUMBS + "garden-home.jpg", 120, 120, coat=0.3)
    rack_art = [image_mat("art_rack_%d" % i, THUMBS + f, 117, 117, coat=0.6, rough=0.3) for i, f in enumerate(
        ("chess.jpg", "mini-store.jpg", "garden-home.jpg", "cd-player.jpg", "holodex.jpg"))]
    M["card_print"] = mat("card_print", (0.92, 0.9, 0.88, 1), rough=0.4)
    M["tag_print"] = mat("tag_print", (0.92, 0.9, 0.88, 1), rough=0.55)
    M["lcd_screen"] = mat("lcd_screen", lin(14, 22, 26), rough=0.2, emit=lin(*hexrgb(look["light"]["glow"])),
                          emit_s=0.06)
    floor = rbox("floor", (5000, 5000, 10), M["floor"], loc=L(0, 0, -5))
    floor.is_shadow_catcher = True
    make_clear_player("clear", artist, album, look, rack_art)
    studio()
    clear_flags()
    if VIEW == "inside":
        # Low from the left: the board's chips, logo, LCD and VU strip, the door's lower edge, the
        # arm's magnet, the nameplate.
        camera("cam", L(-205, -275, 128), L(-12, 2, 70), lens=55, fstop=5.6, focus=L(-30, 4, 62))
    else:
        camera("cam", L(-255, -880, 400), L(2, 10, 122), lens=50, fstop=7.1, focus=L(0, -38, 140))
    return OUT + "clear/%s/clear-%s-%s.png" % ("-".join(ids[p] for p in CLEAR_PARTS), VIEW, QUALITY)


# 5 x 7 capitals for the checker's ids, rows from the top.
CHECKER_FONT = {
    "A": "01110 10001 10001 11111 10001 10001 10001", "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01111 10000 10000 10000 10000 10000 01111", "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111", "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01111 10000 10000 10011 10001 10001 01111", "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "01110 00100 00100 00100 00100 00100 01110", "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001", "N": "10001 11001 10101 10011 10001 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110", "P": "11110 10001 10001 11110 10000 10000 10000",
    "R": "11110 10001 10001 11110 10100 10010 10001", "S": "01111 10000 10000 01110 00001 00001 11110",
    "T": "11111 00100 00100 00100 00100 00100 00100", "Z": "11111 00001 00010 00100 01000 10000 11111",
    "_": "00000 00000 00000 00000 00000 00000 11111",
}


def deck_atlas_checker():
    """The debug atlas (deck_print.py's layout, the canvas's rows down): each region in its own
    colour, checkered and gridded every 10 mm, a white corner where its row 0 and column 0 meet,
    its id in dark capitals. As a Blender image (rows up from the bottom)."""
    import numpy as np
    W, H = ATLAS
    img = np.zeros((H, W, 4), np.float32)
    img[..., :3], img[..., 3] = 0.05, 1.0
    hues = [(0.95, 0.35, 0.3), (0.3, 0.7, 0.95), (0.95, 0.75, 0.25), (0.45, 0.85, 0.4), (0.7, 0.45, 0.95),
            (0.95, 0.5, 0.75), (0.35, 0.85, 0.8), (0.85, 0.85, 0.35), (0.6, 0.6, 0.95), (0.95, 0.6, 0.35)]
    for k, r in enumerate(deck_atlas_regions()):
        x, y, w, h = r["x"], r["y"], r["w"], r["h"]
        d = w / r["mmW"]
        yy, xx = np.mgrid[0:h, 0:w]
        cell = 10.0 * d
        base = np.array(hues[k], np.float32)
        block = np.where((((xx // cell) + (yy // cell)) % 2 == 1)[..., None], base * 0.72, base)
        block[((xx % cell) < max(1.0, 0.35 * d)) | ((yy % cell) < max(1.0, 0.35 * d))] = 0.95
        block[(xx + yy) < 12.0 * d] = 1.0
        word = r["id"].upper()
        px = max(1, min(int((h - 4) / 8), int((w - 4) / (6 * len(word))), 16))
        ox, oy = (w - (6 * len(word) - 1) * px) // 2, (h - 7 * px) // 2
        for i, ch in enumerate(word):
            for row, bits in enumerate(CHECKER_FONT[ch].split()):
                for col, bit in enumerate(bits):
                    if bit == "1":
                        x0, y0 = ox + (6 * i + col) * px, oy + row * px
                        block[y0:y0 + px, x0:x0 + px] = 0.02
        img[y:y + h, x:x + w, :3] = block
    image = bpy.data.images.new("deck_atlas_checker", W, H, alpha=True)
    image.pixels.foreach_set(np.ascontiguousarray(img[::-1]).ravel())
    return image


def deck_print_layer(checker):
    """The Deck's print layer in a render: hidden (the page paints it, never Cycles), or showing the
    debug atlas, a little lit by itself so that it reads in the shade."""
    if not checker:
        # A list first: a visibility flag set while all_objects is walked rebuilds its cache, which
        # ends the walk early.
        for ob in list(SC.collection.all_objects):
            if ob.type == "MESH" and M["deck_pattern"].name in [m.name for m in ob.data.materials if m]:
                ob.hide_render = True
        return
    m = mat("deck_pattern", (1, 1, 1, 1), rough=0.6)
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = deck_atlas_checker()
    tex.interpolation = "Closest"
    p = bsdf(m)
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 0.4


def deck_scene():
    for f in ("deck.py", "deck_panel.py", "deck_case.py", "deck_print.py"):
        exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())
    look, ids = deck_look(DECK_LOOK)
    new_scene("cd_player_deck", res=(1600, 1200), samples=128)
    build_deck_materials(look)
    artist = image_mat("art_disc", THUMBS + "holodex.jpg", 117, 117, coat=0.6, rough=0.3)
    album = image_mat("art_booklet", THUMBS + "garden-home.jpg", 120, 120, coat=0.3)
    rack_art = [image_mat("art_rack_%d" % i, THUMBS + f, 117, 117, coat=0.6, rough=0.3) for i, f in enumerate(
        ("chess.jpg", "mini-store.jpg", "garden-home.jpg", "cd-player.jpg", "holodex.jpg"))]
    M["card_print"] = mat("card_print", (0.92, 0.9, 0.88, 1), rough=0.4)
    M["tag_print"] = mat("tag_print", (0.92, 0.9, 0.88, 1), rough=0.55)
    # Matte and dark, without the Clear's gloss: a render draws the playing screen over it, and any
    # specular smears the studio's lights across the type.
    M["lcd_screen"] = mat("lcd_screen", lin(10, 12, 15), rough=1.0, spec=0.0,
                          emit=lin(*hexrgb(look["light"]["glow"])), emit_s=0.02)
    floor = rbox("floor", (5000, 5000, 10), M["floor"], loc=L(0, 0, -5))
    floor.is_shadow_catcher = True
    make_deck_player("deck", artist, album, look, rack_art)
    deck_print_layer(DECK_ATLAS == "checker")
    studio()
    deck_flags()
    if VIEW == "top":
        # Over the jog from in front: the disc through the plate, the ring, the pads, the keys, and
        # the screen standing at the back (its top 116 mm over the deck), all in the frame.
        camera("cam", L(30, -320, 800), L(30, 10, 95), lens=50, fstop=8.0, focus=L(30, 10, 90))
    else:
        camera("cam", L(-320, -900, 480), L(60, 0, 80), lens=50, fstop=7.1, focus=L(40, -30, 90))
    look_ids = "-".join(ids[p] for p in DECK_PARTS)
    if DECK_ATLAS == "checker":
        return OUT + "deck/debug/deck-%s-%s-%s.png" % (look_ids, VIEW, QUALITY)
    return OUT + "deck/%s/deck-%s-%s.png" % (look_ids, VIEW, QUALITY)


def luxe_scene():
    for f in ("ornament.py", "vinyl.py", "luxe.py", "luxe_arm.py", "luxe_stand.py",
              "luxe_ornament.py", "luxe_dancer.py"):
        exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())
    look, ids = luxe_look(LUXE_LOOK)
    new_scene("cd_player_luxe", res=(1600, 1200), samples=128)
    build_luxe_materials(look)
    label = image_mat("art_disc", THUMBS + "holodex.jpg", 100, 100, coat=0.3, rough=0.35)
    cover = image_mat("art_sleeve", THUMBS + "garden-home.jpg", 309, 309, coat=0.2)
    rack = [image_mat("art_rack_sleeve_%d" % i, THUMBS + f, 309, 309, coat=0.2) for i, f in enumerate(
        ("chess.jpg", "mini-store.jpg", "garden-home.jpg", "cd-player.jpg", "holodex.jpg"))]
    M["card_print"] = mat("card_print", (0.92, 0.9, 0.88, 1), rough=0.4)
    floor = rbox("floor", (5000, 5000, 10), M["floor"], loc=L(0, 0, -5))
    floor.is_shadow_catcher = True
    make_luxe_player("luxe", label, cover, look, rack)
    studio()
    luxe_flags()
    if VIEW == "platter":
        # Over the platter from in front: the record and its label, the LED ring, the tonearm on
        # the record, the keys along the frame's bottom edge.
        camera("cam", L(-45, -360, 720), L(-45, 15, 100), lens=50, fstop=8.0, focus=L(-45, 10, 100))
    elif VIEW == "dancer":
        # A close-up of the dancer and her pedestal at the back left, from the hero camera's side,
        # a little lower: her pose, the tutu's frills and roses, the pedestal's garland.
        cx, cy = LX_DANCER
        camera("cam", L(cx - 125, cy - 450, 220), L(cx, cy, 144), lens=85, fstop=11.0, focus=L(cx, cy - 10, 145))
    else:
        # Front left, a little above: the deck, its record stand and the ledge behind it.
        camera("cam", L(-520, -1250, 620), L(150, 40, 110), lens=50, fstop=7.1, focus=L(0, -40, 110))
    return OUT + "luxe/%s/luxe-%s-%s.png" % ("-".join(ids[p] for p in LUXE_PARTS), VIEW, QUALITY)


PNG = {"clear": clear_scene, "deck": deck_scene, "luxe": luxe_scene}.get(MODEL, suitcase_scene)()
os.makedirs(os.path.dirname(PNG), exist_ok=True)
if QUALITY == "final":
    render(PNG, res=(1600, 1200), samples=160)
else:
    render(PNG, res=(800, 600), samples=24)
result = {"objects": len(SC.collection.all_objects), "png": PNG}
print("hero.py: %r" % (result,))

"""Cycles stills of the CD players, headless:

    CDP_MODEL=suitcase|clear CDP_HERO_VIEW=hero|lid|inside CDP_HERO_QUALITY=preview|final \\
      /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
      --python-exit-code 1 --python apps/cd-player/art/blender/scripts/hero.py

CDP_MODEL picks the player: `suitcase` (the default) or `clear` (clear.py). The suitcase's views:
`hero` is the three-quarter product still the design was approved from (the lid open, a disc
spinning, five more in the rack, a stack of cases beside it); `lid` looks straight into the open
lid (the case, the rack and its discs, the strap and the plate). The Clear model's: `hero`, the
three-quarter still of the player between its stand and its case, and `inside`, a close-up of the
board, the LCD and the mechanism through the shell. `preview` is 800 x 600 at 24 samples, `final`
1600 x 1200 at 160; any other value of the model, the view or the quality stops the run with exit
1, naming the valid ones. The art it prints is the gallery's thumbnails
(apps/portfolio/public/thumbnails), so anyone can rerun it. The suitcase's PNG lands in
art/.out/v2-<view>-<quality>.png, or art/.out/v2-<view>-grid-<quality>.png when parts.py builds
the grid layout. CDP_SKIN=<id> (an id of src/skins.json) renders that skin instead of Blush, into
art/.out/skins/<id>/. The Clear model renders its default look, or CDP_CLEAR_LOOK=<shell>,<frame>,
<board>,<light> (ids of src/clear-looks.json), into art/.out/clear/<look>/clear-<view>-<quality>.png.
Also runs in a live Blender through tools/bl.py.
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


MODEL = setting("CDP_MODEL", "suitcase", ("suitcase", "clear"))
VIEW = setting("CDP_HERO_VIEW", "hero", ("hero", "lid") if MODEL == "suitcase" else ("hero", "inside"))
QUALITY = setting("CDP_HERO_QUALITY", "preview", ("preview", "final"))
SKIN = os.environ.get("CDP_SKIN")  # an id of src/skins.json; unset renders Blush, empty is an error
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


def suitcase_scene():
    new_scene("cd_player_suitcase", res=(1600, 1200), samples=128)
    build_materials(skin_palette(SKIN) if SKIN is not None else None)

    artist = image_mat("art_disc", THUMBS + "viktor.jpg", 117, 117, coat=0.6, rough=0.3)
    album = image_mat("art_booklet", THUMBS + "mindloop.jpg", 120, 120, coat=0.3)
    rack_art = [image_mat("art_rack_%d" % i, THUMBS + f, 117, 117, coat=0.6, rough=0.3) for i, f in enumerate(
        ("holodex.jpg", "bali.jpg", "garden-home.jpg", "immersive-ocean.jpg", "toonhub.jpg"))]
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
    exec(compile(open(BASE + "/clear.py").read(), "clear.py", "exec"), globals())
    look, ids = clear_look(os.environ.get("CDP_CLEAR_LOOK"))
    new_scene("cd_player_clear", res=(1600, 1200), samples=128)
    build_clear_materials(look)
    see_through_backdrop(SC.world)
    artist = image_mat("art_disc", THUMBS + "viktor.jpg", 117, 117, coat=0.6, rough=0.3)
    album = image_mat("art_booklet", THUMBS + "mindloop.jpg", 120, 120, coat=0.3)
    rack_art = [image_mat("art_rack_%d" % i, THUMBS + f, 117, 117, coat=0.6, rough=0.3) for i, f in enumerate(
        ("holodex.jpg", "bali.jpg", "garden-home.jpg", "immersive-ocean.jpg", "toonhub.jpg"))]
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


PNG = clear_scene() if MODEL == "clear" else suitcase_scene()
os.makedirs(os.path.dirname(PNG), exist_ok=True)
if QUALITY == "final":
    render(PNG, res=(1600, 1200), samples=160)
else:
    render(PNG, res=(800, 600), samples=24)
result = {"objects": len(SC.collection.all_objects), "png": PNG}
print("hero.py: %r" % (result,))

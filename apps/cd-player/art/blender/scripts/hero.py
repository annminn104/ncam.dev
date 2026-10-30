"""Cycles stills of the suitcase CD player, headless:

    CDP_HERO_VIEW=hero|lid CDP_HERO_QUALITY=preview|final \\
      /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \\
      --python-exit-code 1 --python apps/cd-player/art/blender/scripts/hero.py

`hero` is the three-quarter product still the design was approved from (the lid open, a disc
spinning, five more in the rack, a stack of cases beside it); `lid` looks straight into the open
lid (the case, the rack and its discs, the strap and the plate). `preview` is 800 x 600 at 24
samples, `final` 1600 x 1200 at 160. The art it prints is the gallery's thumbnails
(apps/portfolio/public/thumbnails), so anyone can rerun it. The PNG lands in
art/.out/v2-<view>-<quality>.png, or art/.out/v2-<view>-grid-<quality>.png when parts.py builds
the grid layout. Also runs in a live Blender through tools/bl.py.
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
VIEW = os.environ.get("CDP_HERO_VIEW", "hero")
QUALITY = os.environ.get("CDP_HERO_QUALITY", "preview")
os.makedirs(OUT, exist_ok=True)

new_scene("cd_player_suitcase", res=(1600, 1200), samples=128)
build_materials()

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

area_light("key", L(-900, -950, 1300), L(0, 0, 100), 1.3, 62, size_y=0.9)
area_light("kicker", L(-700, 600, 500), L(0, 0, 150), 0.6, 30, color=(1.0, 0.94, 0.95))
area_light("rim", L(700, 900, 900), L(0, 0, 120), 0.9, 40, color=(1.0, 0.96, 0.93))
area_light("fill", L(1100, -500, 350), L(0, 0, 80), 1.1, 14)
if VIEW == "lid":
    # Straight into the open lid: its inner face leans back 10 degrees, its centre is at
    # (0, 165, 196); the camera stands 680 mm out along the face's normal.
    camera("cam", L(0, -505, 314), L(0, 165, 196), lens=50, fstop=8.0, focus=L(0, 165, 196))
else:
    camera("cam", L(-420, -800, 470), L(60, -10, 132), lens=50, fstop=7.1, focus=L(-10, -40, 90))

PNG = OUT + "v2-%s%s-%s.png" % (VIEW, "-grid" if RACK_LAYOUT == "grid" else "", QUALITY)
if QUALITY == "final":
    render(PNG, res=(1600, 1200), samples=160)
else:
    render(PNG, res=(800, 600), samples=24)
result = {"objects": len(SC.collection.all_objects), "png": PNG}
print("hero.py: %r" % (result,))

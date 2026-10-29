"""Hero render: the suitcase CD player, lid open, disc spinning, a stack of cases beside it."""
import math
import os
import bpy

BASE = os.path.dirname(os.path.abspath(__file__))
for f in ("cdkit.py", "parts.py"):
    exec(compile(open(BASE + "/" + f).read(), f, "exec"), globals())

ART = os.environ.get("CDP_HERO_ART", BASE + "/../../.out/art") + "/"
OUT = BASE + "/../../.out/"
PREVIEW = globals().get("PREVIEW", True)

for old in ("concept_A_wall", "concept_B_tower", "concept_C_portable"):
    s = bpy.data.scenes.get(old)
    if s:
        for o in list(s.collection.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(s)

new_scene("cd_player_suitcase", res=(1600, 1200), samples=128)
build_materials()

artist = image_mat("art_disc", ART + "apps_viktor_src_assets_water-wave-poster-1280.jpg", 117, 117, coat=0.6, rough=0.3)
album = image_mat("art_booklet", ART + "apps_mindloop_src_assets_hero-poster-1280.jpg", 120, 120, coat=0.3)
photo_a = image_mat("art_photo_a", ART + "apps_toonhub_assets_figurines_03.jpg", 48, 48, coat=0.5, rough=0.3)
photo_b = image_mat("art_photo_b", ART + "apps_toonhub_assets_figurines_01.jpg", 48, 48, coat=0.5,
                    rough=0.3)
covers = [image_mat("art_cover_%d" % i, ART + f, 120, 120, coat=0.3) for i, f in enumerate(
    ("apps_mindloop_src_assets_hero-poster-1280.jpg", "apps_garden-home_public_backgrounds_example.jpg",
     "apps_bali_public_og.jpg"))]

floor = rbox("floor", (5000, 5000, 10), M["floor"], loc=L(0, 0, -5))
floor.is_shadow_catcher = True
make_player("player", artist, album, (photo_a, photo_b))
bpy.data.objects["player_disc"].rotation_euler = (0, 0, math.radians(-8))
for i, cov in enumerate(covers):
    make_case("stack_%d" % i, cov, L(272, 40, 3.4 + i * 10.45), (0, 0, math.radians(14 - i * 9)))
make_case("open_case", covers[1], L(318, -178, 3.4), (0, 0, math.radians(-24)), open_deg=168.0)

area_light("key", L(-900, -950, 1300), L(0, 0, 100), 1.3, 62, size_y=0.9)
area_light("kicker", L(-700, 600, 500), L(0, 0, 150), 0.6, 30, color=(1.0, 0.94, 0.95))
area_light("rim", L(700, 900, 900), L(0, 0, 120), 0.9, 40, color=(1.0, 0.96, 0.93))
area_light("fill", L(1100, -500, 350), L(0, 0, 80), 1.1, 14)
camera("cam", L(-420, -800, 470), L(60, -10, 132), lens=50, fstop=7.1, focus=L(-10, -40, 90))

if PREVIEW:
    render(OUT + "suitcase_preview.png", res=(800, 600), samples=24)
else:
    render(OUT + "suitcase_hero.png", res=(1600, 1200), samples=160)
result = {"objects": len(SC.collection.all_objects)}

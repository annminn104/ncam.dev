"""Villa v2 part 3: the pond layouts (pond/*_layout.py), the shape of the pond (pond/basin.py), the paths the koi swim
(pond/swim.py), their checks (pond/layout_check.py) and what a click toggles at the pond (pond/interact.py). Pure
Python."""
import math
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit import catalog  # noqa: E402
from siteplan import zones  # noqa: E402
from pond import basin, interact, koi_layout, layout_check, swim  # noqa: E402

WATERFALL = {"interact": "waterfall", "label": "Waterfall"}
FEED = {"interact": "koi", "label": "Feed the koi"}


def copy(layout, **overrides):
    """The layout module's data as a namespace, with some of it changed."""
    data = {key: getattr(layout, key) for key in dir(layout) if key.isupper()}
    data.update(overrides)
    return types.SimpleNamespace(**data)


def water(layout):
    return basin.ring(layout.OUTLINE, layout.CENTRE, layout_check._waterline(layout))


def chains(points, reach):
    """The points (x, y, radius) grouped into chains of neighbours whose circles come within `reach` of each other."""
    groups = []
    for point in points:
        linked = [group for group in groups
                  if any(math.dist(point[:2], other[:2]) <= point[2] + other[2] + reach for other in group)]
        groups = [group for group in groups if all(group is not other for other in linked)]
        groups.append([point] + [member for group in linked for member in group])
    return groups


class BasinTest(unittest.TestCase):
    def test_a_blob_is_an_ellipse_bent_by_harmonics_counter_clockwise_from_x(self):
        plain = basin.blob((1.0, 2.0), (3.0, 2.0), (), 8)
        self.assertAlmostEqual(plain[0][0], 4.0)
        self.assertAlmostEqual(plain[0][1], 2.0)
        self.assertAlmostEqual(plain[2][0], 1.0)
        self.assertAlmostEqual(plain[2][1], 4.0)
        bent = basin.blob((0.0, 0.0), (3.0, 3.0), ((2, 0.1, 0.0),), 4)
        self.assertAlmostEqual(bent[0][0], 3.3)  # 1 + 0.1 cos(0) at +X
        self.assertAlmostEqual(bent[1][1], 2.7)  # 1 + 0.1 cos(pi) at +Y

    def test_a_point_lies_on_the_ring_of_its_share_and_reads_its_depth_off_the_profile(self):
        outline = basin.blob((0.0, 0.0), (4.0, 2.0), ((3, 0.05, 0.3),), 40)
        for share in (0.2, 0.5, 0.97):
            for point in basin.ring(outline, (0.0, 0.0), share)[::7]:
                self.assertAlmostEqual(basin.share(outline, (0.0, 0.0), point), share, places=6)
        profile = ((1.0, 0.0), (0.5, -0.4), (0.0, -0.5))
        self.assertEqual(basin.depth_at(outline, (0.0, 0.0), profile, (0.0, 0.0)), -0.5)
        self.assertAlmostEqual(basin.depth_at(outline, (0.0, 0.0), profile, basin.ring(outline, (0.0, 0.0), 0.75)[5]),
                               -0.2)
        self.assertEqual(basin.depth_at(outline, (0.0, 0.0), profile, (9.0, 0.0)), 0.0)  # out on the lawn

    def test_the_share_finder_finds_the_same_rings_quicker(self):
        outline = basin.blob((0.5, 0.0), (4.0, 2.0), ((3, 0.05, 0.3),), 40)
        find = basin.share_finder(outline, (0.5, 0.0))
        for k in range(200):
            point = (0.5 + 5.0 * math.cos(k * 0.7) * (k % 7) / 6, 3.0 * math.sin(k * 1.3) * (k % 5) / 4)
            self.assertAlmostEqual(find(point), basin.share(outline, (0.5, 0.0), point), places=9)
        self.assertEqual(find((0.5, 0.0)), 0.0)
        self.assertEqual(basin.height(((1.0, 0.0), (0.0, -0.5)), 0.5), -0.25)

    def test_distances_to_the_outline_and_points_along_it(self):
        square = [(1.0, -1.0), (1.0, 1.0), (-1.0, 1.0), (-1.0, -1.0)]  # counter-clockwise
        self.assertAlmostEqual(basin.to_outline(square, (0.0, 0.0)), 1.0)
        self.assertAlmostEqual(basin.to_outline(square, (3.0, 0.0)), 2.0)
        self.assertAlmostEqual(basin.perimeter(square), 8.0)
        (x, y), normal = basin.along(square, 1.0)
        self.assertEqual(((round(x, 6), round(y, 6)), normal), ((1.0, 0.0), (1.0, -0.0)))  # outwards: +X


class SwimTest(unittest.TestCase):
    LOOP = {"centre": (1.0, 2.0), "radii": (2.0, 1.0), "tilt": 0, "z": -0.3, "period": 10.0, "phase": 0.0}

    def test_a_koi_loops_round_its_ellipse_in_its_period(self):
        self.assertEqual(swim.position(self.LOOP, 0.0), (3.0, 2.0, -0.3))
        x, y, z = swim.position(self.LOOP, 2.5)  # a quarter of the way round, counter-clockwise
        self.assertAlmostEqual(x, 1.0)
        self.assertAlmostEqual(y, 3.0)
        for got, want in zip(swim.position(self.LOOP, 10.0), swim.position(self.LOOP, 0.0)):
            self.assertAlmostEqual(got, want)
        back = dict(self.LOOP, period=-10.0)  # clockwise
        self.assertAlmostEqual(swim.position(back, 2.5)[1], 1.0)
        turned = dict(self.LOOP, tilt=90)
        x, y, _ = swim.position(turned, 0.0)
        self.assertAlmostEqual(x, 1.0)
        self.assertAlmostEqual(y, 4.0)
        eight = dict(self.LOOP, eight=True)
        x, y, _ = swim.position(eight, 2.5)  # a figure of eight crosses its middle
        self.assertAlmostEqual(x, 1.0)
        self.assertAlmostEqual(y, 2.0)
        bob = dict(self.LOOP, bob=0.02)
        self.assertAlmostEqual(swim.position(bob, 1.25)[2], -0.28)  # up and down twice a loop

    def test_a_koi_swims_nose_first(self):
        # at (3, 2) going counter-clockwise it moves towards +Y: its nose, local -Y, turns half round
        self.assertAlmostEqual(abs(swim.heading(self.LOOP, 0.0)), math.pi, places=3)
        nose, tail = swim.body(self.LOOP, 0.0, 0.48)
        self.assertAlmostEqual(nose[1] - tail[1], 0.48, places=3)
        back = dict(self.LOOP, period=-10.0)
        nose, tail = swim.body(back, 0.0, 0.48)
        self.assertAlmostEqual(tail[1] - nose[1], 0.48, places=3)

    def test_the_loops_pack_into_twelve_floats_a_fish(self):
        loop = dict(self.LOOP, tilt=30, eight=True, bob=0.01, phase=1.5)
        self.assertEqual(swim.pack([loop, self.LOOP])[:12],
                         [1.0, 2.0, 2.0, 1.0, math.radians(30), -0.3, 2 * math.pi / 10.0, 1.5, 1.0, 0.01, 0.0, 0.0])
        self.assertEqual(len(swim.pack([loop, self.LOOP])), 24)

    def test_fed_koi_leave_their_loops_for_rings_round_the_food_as_the_website_draws_them(self):
        # src/systems/koi.ts KOI_FEED and koiFedPosition: koi.test.ts pins the same numbers
        self.assertEqual(swim.FEED, {"gather": 3.0, "stay": 9.0, "leave": 13.0, "glide": 1.0, "rings": (0.45, 0.8),
                                     "depths": (0.16, 0.25), "spin": 0.4})
        self.assertEqual(swim.hunger(0.0), 0.0)
        self.assertEqual(swim.hunger(5.0), 1.0)
        self.assertEqual(swim.hunger(13.0), 0.0)
        # food fell at 10 s on (1.5, 2.5) after food on (0.5, 2): the rings' middle glides there, the koi set off at 9 s
        food = {"x": 1.5, "y": 2.5, "at": 10.0, "from": (0.5, 2.0), "start": 9.0}
        for got, want in zip(swim.food_centre(food, 10.4), (0.852, 2.176)):
            self.assertAlmostEqual(got, want)
        pinned = [(1.892413, 2.043563, -0.268495), (2.187618, 1.909465, -0.309001)]
        for index in (0, 1):
            for got, want in zip(swim.fed_position(self.LOOP, 10.4, 10.4, index, 2, food, -0.07), pinned[index]):
                self.assertAlmostEqual(got, want, places=5)
        for got, want in zip(swim.fed_position(self.LOOP, 30.0, 30.0, 0, 2, food, -0.07), swim.position(self.LOOP, 30.0)):
            self.assertAlmostEqual(got, want)  # the food is gone: back on its loop
        self.assertEqual(swim.fed_position(self.LOOP, 5.0, 5.0, 0, 2, None, -0.07), swim.position(self.LOOP, 5.0))


class KoiPondLayoutTest(unittest.TestCase):
    K = koi_layout

    def test_the_module_fills_the_pond_zone(self):
        (x0, y0), (x1, y1) = zones.ZONES["pond"]
        self.assertEqual(self.K.ZONE, "pond")
        self.assertEqual(self.K.FOOTPRINT, (x1 - x0, y1 - y0))
        self.assertEqual((self.K.MODULE_ID, self.K.ROLE), ("koi_pond", "prop"))

    def test_the_layout_is_clean(self):
        self.assertEqual(layout_check.check_koi(self.K), [])
        self.assertEqual(layout_check.check_site(self.K), [])

    def test_the_pond_is_a_big_irregular_blob_inside_its_zone(self):
        xs, ys = zip(*water(self.K))
        self.assertTrue(8.5 <= max(xs) - min(xs) <= 10.0, (min(xs), max(xs)))  # about 9 x 6 m of water
        self.assertTrue(5.5 <= max(ys) - min(ys) <= 6.8, (min(ys), max(ys)))
        w, d = self.K.FOOTPRINT
        for x, y in self.K.OUTLINE:  # inside the zone with a margin for the stones
            self.assertTrue(abs(x) <= w / 2 - layout_check.MARGIN and abs(y) <= d / 2 - layout_check.MARGIN, (x, y))
        # not an ellipse: the radius strays from the best ellipse through the outline's extremes by a good share
        cx, cy = self.K.CENTRE
        rx, ry = (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
        strays = [math.hypot((x - cx) / rx, (y - cy) / ry) for x, y in self.K.OUTLINE]
        self.assertGreater(max(strays) - min(strays), 0.12)
        self.assertGreaterEqual(len(self.K.OUTLINE), 40)  # smooth

    def test_the_bank_falls_from_the_lawn_to_a_deep_dark_middle_under_the_water(self):
        profile = self.K.PROFILE
        self.assertEqual([s for s, _ in profile], sorted((s for s, _ in profile), reverse=True))
        self.assertEqual([z for _, z in profile[1:]], sorted((z for _, z in profile[1:]), reverse=True))
        self.assertIn((1.0, 0.0), profile)  # the grass edge, at the lawn's height
        self.assertTrue(profile[0][0] > 1.0 and -0.03 < profile[0][1] < 0.0)  # tucked under the lawn: no crack
        self.assertLessEqual(profile[-1][1], -0.6)  # deep in the middle
        self.assertTrue(-0.1 <= self.K.WATER_Z <= -0.04)  # the water just below the grass
        self.assertTrue(self.K.FLOOR < self.K.GREEN_BAND < 1.0)
        self.assertLess(basin.depth_at(self.K.OUTLINE, self.K.CENTRE, profile,
                                       basin.ring(self.K.OUTLINE, self.K.CENTRE, self.K.FLOOR)[0]), self.K.WATER_Z - 0.3)
        self.assertTrue(layout_check._waterline(self.K) < self.K.WATER_SHARE < 1.0)  # its edge hides in the bank

    def test_stones_line_the_edge_with_gaps_where_the_grass_meets_the_water(self):
        stones = self.K.STONES
        self.assertGreaterEqual(len(stones), 25)
        for x, y, size, height, _ in stones:
            self.assertLess(basin.to_outline(self.K.OUTLINE, (x, y)), 0.15)  # astride the edge
            self.assertTrue(0.3 <= size <= 0.6 and 0.4 * size <= height <= 0.75 * size, (size, height))
        # walking round the edge, a few stretches of a metre or more come with no stone and no rock
        total = basin.perimeter(self.K.OUTLINE)
        bare, run = 0, 0.0
        for k in range(int(total / 0.05)):
            (x, y), _ = basin.along(self.K.OUTLINE, k * 0.05)
            covered = (any(math.dist((x, y), (sx, sy)) <= size / 2 + 0.05 for sx, sy, size, _, _ in stones)
                       or any(math.dist((x, y), pos) <= layout_check.peak_reach(v) for v, pos, _, _ in self.K.PEAKS))
            run = 0.0 if covered else run + 0.05
            bare += run >= 0.9 and run < 0.9 + 0.05
        self.assertGreaterEqual(bare, 3)

    def test_the_rockery_rises_partly_out_of_the_water_with_shrubs_and_its_waterfall(self):
        peaks = self.K.PEAKS
        self.assertTrue(3 <= len(peaks) <= 4)
        self.assertEqual(sorted(v for v, *_ in peaks), list(range(len(peaks))))  # one of each height
        inside = [basin.contains(water(self.K), pos) for _, pos, _, _ in peaks]
        self.assertTrue(any(inside) and not all(inside), inside)  # partly in the water, partly on the bank
        self.assertGreaterEqual(len(self.K.SHRUBS), 2)
        for x, y, z, height, _ in self.K.SHRUBS:
            self.assertTrue(any(math.dist((x, y), pos) <= layout_check.peak_reach(v) for v, pos, _, _ in peaks))
            self.assertTrue(0.3 <= height <= 0.7 and z > 0.3, (z, height))  # on a ledge, not on the lawn
        # the tallest peak carries most of them, one high up near its crag
        tallest = min(peaks, key=lambda peak: peak[0])
        on_it = [shrub for shrub in self.K.SHRUBS if math.dist(shrub[:2], tallest[1]) <= layout_check.peak_reach(0)]
        self.assertGreaterEqual(len(on_it), 3)
        self.assertGreater(max(z for _, _, z, _, _ in on_it), 0.7 * catalog.FURNITURE["rock_peak"][2])
        fall = self.K.WATERFALL
        self.assertTrue(0.3 <= fall["width"] <= 0.7)
        self.assertGreater(fall["top"][2] - self.K.WATER_Z, 0.7)  # a fall that reads from the wallpaper
        # it faces the wallpaper camera (front-right, from the south-east): within 45 degrees of its bearing
        bearing = math.degrees(math.atan2(zones.CAMERAS["CAM_idle"]["pos"][1] + 11.0,
                                          zones.CAMERAS["CAM_idle"]["pos"][0] - 9.0))
        self.assertLess(abs((fall["facing"] - bearing + 180) % 360 - 180), 45)

    def test_fourteen_koi_of_four_colourings_swim_in_layers_under_the_surface(self):
        koi = self.K.KOI
        self.assertTrue(12 <= len(koi) <= 16)
        self.assertEqual({loop["variant"] for loop in koi}, {0, 1, 2, 3})
        self.assertGreaterEqual(len({loop["z"] for loop in koi}), 3)  # some just under, some deeper
        top = self.K.WATER_Z - self.K.KOI_SURFACE_CLEAR
        self.assertTrue(any(loop["z"] + self.K.KOI_TOP > top - 0.05 for loop in koi))  # just under the surface
        self.assertEqual(self.K.KOI_LENGTH, catalog.FURNITURE["koi"][1])
        for loop in koi:
            self.assertTrue(15 <= abs(loop["period"]) <= 60, loop)  # unhurried: about 0.1 to 0.4 m a second
            for x, y, z in swim.samples(loop):
                self.assertGreater(basin.to_outline(water(self.K), (x, y)), self.K.KOI_BANK_CLEAR)
                self.assertTrue(basin.contains(water(self.K), (x, y)))
                self.assertLess(z + self.K.KOI_TOP, self.K.WATER_Z)

    def test_the_koi_are_fed_in_a_disc_round_the_middle_of_their_school(self):
        feeding = self.K.FEEDING
        middle = [sum(loop["centre"][k] for loop in self.K.KOI) / len(self.K.KOI) for k in (0, 1)]
        self.assertLess(math.dist(feeding["centre"], middle), 0.3)
        self.assertTrue(1.0 <= feeding["radius"] <= 1.6, feeding)
        # the rings round food on its rim stay in the water, clear of its edge
        reach = feeding["radius"] + max(swim.FEED["rings"])
        for k in range(24):
            a = 2 * math.pi * k / 24
            point = (feeding["centre"][0] + reach * math.cos(a), feeding["centre"][1] + reach * math.sin(a))
            self.assertGreater(basin.to_outline(water(self.K), point), self.K.KOI_BANK_CLEAR, point)

    def test_lotus_pads_float_in_clusters_with_flowers_and_buds(self):
        pads = self.K.PADS
        self.assertTrue(10 <= len(pads) <= 15)
        circles = [(x, y, catalog.LOTUS_PADS[variant][0]) for x, y, variant, _ in pads]
        self.assertTrue(2 <= len(chains(circles, 0.35)) <= 3)
        self.assertEqual({catalog.LOTUS_PADS[variant][1] for _, _, variant, _ in pads}, {"lotus_pad", "leaf"})
        flowers = [variant for _, _, variant in self.K.FLOWERS]
        self.assertTrue(3 <= sum(1 for v in flowers if v in (0, 1)) <= 5)  # open, pink or white
        self.assertIn(0, flowers)
        self.assertIn(1, flowers)
        self.assertGreaterEqual(flowers.count(2), 2)  # buds
        self.assertAlmostEqual(self.K.LOTUS_Z, self.K.WATER_Z, delta=0.01)

    def test_the_hotspot_focuses_the_pond(self):
        self.assertEqual(self.K.HOTSPOT, {"name": "HS_pond", "pos": (0.0, 0.0, 0.6), "action": "focus",
                                          "label": "Koi pond", "radius": 4.5})

    def test_a_click_on_the_rockery_its_water_or_its_foam_toggles_the_waterfall_one_on_the_pond_feeds_the_koi(self):
        self.assertEqual(interact.tags(self.K), {"Rockery": WATERFALL, "WATER_waterfall_sheet": WATERFALL,
                                                 "Waterfall_foam": WATERFALL, "WATER_surface": FEED})
        self.assertRegex("waterfall", interact.GROUP_RE)
        self.assertRegex("koi", interact.GROUP_RE)
        self.assertEqual(interact.tags(copy(self.K, WATERFALL=None)), {"WATER_surface": FEED})
        self.assertEqual(interact.tags(copy(self.K, WATERFALL=None, KOI=[])), {})


class KoiPondCheckTest(unittest.TestCase):
    K = koi_layout

    def test_the_outline_stays_inside_its_footprint(self):
        wide = copy(self.K, OUTLINE=[(x * 1.3, y) for x, y in self.K.OUTLINE])
        self.assertIn("the outline comes closer than 0.5 m to the edge of the 11 x 8 m footprint",
                      layout_check.check_koi(wide))
        folded = list(self.K.OUTLINE)
        folded[5], folded[6] = folded[6], folded[5]
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, OUTLINE=folded))), "is not star-shaped")

    def test_the_rockery_stands_partly_in_the_water_and_its_waterfall_falls_into_it(self):
        on_lawn = [(v, (x - 4.0, y), rot, sink) for v, (x, y), rot, sink in self.K.PEAKS[:1]] + self.K.PEAKS[1:]
        self.assertIn("peak 1 stands out on the lawn, not on the pond's bank", layout_check.check_koi(
            copy(self.K, PEAKS=on_lawn, WATERFALL=None)))
        bank = basin.ring(self.K.OUTLINE, self.K.CENTRE, 0.995)  # between the water's edge and the grass
        dry = [(v, bank[10 * k], rot, sink) for k, (v, _, rot, sink) in enumerate(self.K.PEAKS)]
        self.assertIn("the rockery stands on the bank only: none of its peaks is in the water",
                      layout_check.check_koi(copy(self.K, PEAKS=dry, WATERFALL=None, KOI=[], PADS=[], FLOWERS=[])))
        far = dict(self.K.WATERFALL, top=(3.0, 0.0, 1.0))
        self.assertIn("the waterfall does not fall from the tallest peak", layout_check.check_koi(copy(self.K, WATERFALL=far)))
        short = dict(self.K.WATERFALL, throw=-1.5)
        self.assertIn("the waterfall's foam does not float on the water clear of its edge",
                      layout_check.check_koi(copy(self.K, WATERFALL=short)))

    def test_koi_keep_off_the_bank_and_the_rockery_under_the_surface_and_out_of_one_another(self):
        loop = self.K.KOI[0]
        wide = dict(loop, radii=(loop["radii"][0] + 2.4, loop["radii"][1]))
        problems = layout_check.check_koi(copy(self.K, KOI=[wide]))
        self.assertRegex(" ".join(problems), r"koi 1 swims \d\.\d\d m from the bank, closer than 0\.3 m")
        high = dict(loop, z=self.K.WATER_Z - 0.1)
        self.assertIn("koi 1 breaks the surface: its dorsal fin comes within 0.025 m of the water line",
                      layout_check.check_koi(copy(self.K, KOI=[high])))
        deep = dict(loop, z=-0.7)
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, KOI=[deep]))), "koi 1 swims into the bank")
        rock = dict(loop, centre=(-2.4, 1.0), radii=(0.6, 0.4))
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, KOI=[rock]))),
                         r"koi 1 swims \d\.\d\d m from the rockery")
        twin = dict(loop, phase=loop["phase"] + 0.02)
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, KOI=[loop, twin]))),
                         r"koi 1 and koi 2 swim through one another \(0\.\d\d m apart\)")
        # koi of two loops of one layer that touch: always 2.1 m apart, but where one passes the other's loop is 0.1 m
        # off, and loops of a layer must not cross whatever the timing (it is checked path to path, not for a while)
        one = dict(loop, centre=(0.0, -0.35), radii=(1.0, 1.0), tilt=0, period=20.0, phase=0.0, eight=False)
        two = dict(one, centre=(2.1, -0.35))
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, KOI=[one, two]))),
                         r"koi 1 and koi 2 swim loops that cross \(0\.1\d m apart\)")
        under = dict(twin, z=loop["z"] - self.K.KOI_BODY - 0.03)  # deep enough below to pass under it
        self.assertFalse(any("one another" in problem
                             for problem in layout_check.check_koi(copy(self.K, KOI=[loop, under]))))

    def test_fed_koi_keep_off_the_rockery_and_the_bank_wherever_the_food_falls_in_the_feeding_disc(self):
        rock = dict(self.K.FEEDING, centre=(-1.6, 0.6))  # the rings round its rim reach the peak in the water
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, FEEDING=rock))),
                         r"fed koi \d+ swims \d\.\d\d m from the rockery, closer than 0\.24 m")
        wide = dict(self.K.FEEDING, radius=3.0)  # rings round food by the bank
        self.assertRegex(" ".join(layout_check.check_koi(copy(self.K, FEEDING=wide))),
                         r"fed koi \d+ swims into the bank: the floor comes within \d\.\d\d m of its underside")
        dry = dict(self.K.FEEDING, centre=self.K.OUTLINE[0])
        self.assertIn("the feeding disc's middle is not in the water", layout_check.check_koi(copy(self.K, FEEDING=dry)))
        self.assertEqual(layout_check.check_koi(copy(self.K, FEEDING=None)), [])  # koi nobody feeds

    def test_lotus_pads_float_clear_of_the_edge_of_one_another_and_of_the_rockery(self):
        x, y, variant, rot = self.K.PADS[0]
        problems = layout_check.check_koi(copy(self.K, PADS=[(x, y, variant, rot), (x + 0.1, y, variant, rot)],
                                               FLOWERS=[]))
        self.assertEqual(problems, ["pad 1 overlaps pad 2"])
        edge = self.K.OUTLINE[0]
        self.assertEqual(layout_check.check_koi(copy(self.K, PADS=[(edge[0], edge[1], 0, 0)], FLOWERS=[])),
                         ["pad 1 does not float clear of the pond's edge"])
        variant_peak, (px, py), _, _ = self.K.PEAKS[1]
        self.assertIn("pad 1 floats into the rockery",
                      layout_check.check_koi(copy(self.K, PADS=[(px + 0.3, py - 0.3, 2, 0)], FLOWERS=[])))
        self.assertEqual(layout_check.check_koi(copy(self.K, FLOWERS=[(0.0, -0.3, 0)])),
                         ["flower 1 rises alone, away from the pads"])

    def test_the_garden_keeps_clear_of_the_pond(self):
        bed = types.SimpleNamespace(MODULE_ID="beds", PIECES=[("flower_pot", "Pots", (9.0, -11.0), 0)])
        self.assertEqual(layout_check.check_site(self.K, layouts=[bed]),
                         ["Pots #1 (flower_pot) (beds) comes within 0.3 m of the pond"])


LIGHTS = {"interact": "lights:garden", "label": "Garden lights"}


class TeaGardenLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from pond import tea_layout
        cls.T = tea_layout

    def site(self, point):
        """A point of the tea corner in site space: the module stands centred on its zone."""
        (x0, y0), (x1, y1) = zones.ZONES["tea"]
        return point[0] + (x0 + x1) / 2, point[1] + (y0 + y1) / 2

    def kinds(self, *kinds):
        return [piece for piece in self.T.PIECES if piece[0] in kinds]

    def test_the_module_fills_the_tea_zone_which_reaches_up_to_the_walk(self):
        (x0, y0), (x1, y1) = zones.ZONES["tea"]
        self.assertEqual(self.T.ZONE, "tea")
        self.assertEqual(self.T.FOOTPRINT, (x1 - x0, y1 - y0))
        self.assertEqual((self.T.MODULE_ID, self.T.ROLE), ("tea_garden", "prop"))
        self.assertEqual(y1, zones.ZONES["path_turn"][0][1])  # its back edge is the walk zone's front edge
        self.assertEqual(y0, zones.ZONES["pond"][1][1] + 0.5)  # half a metre of lawn from the pond's zone

    def test_the_layout_is_clean(self):
        self.assertEqual(layout_check.check_tea(self.T), [])
        self.assertEqual(layout_check.check_tea_site(self.T), [])

    def test_a_round_stone_table_with_its_tea_set_and_four_stools(self):
        (table,) = self.kinds("stone_table_round")
        (tea,) = self.kinds("tea_set")
        stools = self.kinds("stone_stool")
        self.assertEqual(len(stools), 4)
        tx, ty, tz = table[2]
        self.assertEqual(tea[2], (tx, ty, tz + catalog.FURNITURE["stone_table_round"][2]))  # on the table top
        reach = {round(math.dist(stool[2][:2], (tx, ty)), 6) for stool in stools}
        self.assertEqual(len(reach), 1)  # all round it alike
        self.assertTrue(0.6 <= reach.pop() <= 0.9)
        self.assertEqual({piece[1] for piece in (table, tea, *stools)}, {"Tea_corner"})
        x, y = self.site((tx, ty))
        pond = shapes_box(zones.ZONES["pond"])
        self.assertTrue(pond[0] < x < pond[2] and 0.0 < y - pond[3] < 2.5)  # by the pond, just north of its zone

    def test_bonsai_on_pedestals_and_in_a_pot_sway_and_cast_no_shadow(self):
        bonsai = self.kinds("bonsai")
        self.assertTrue(2 <= len(bonsai) <= 3)
        variants = {piece[4]["variant"] for piece in bonsai}
        self.assertIn(1, variants)  # in its celadon pot
        self.assertTrue(variants & {0, 2})  # on a granite pedestal
        self.assertTrue(all(piece[4].get("wind") for piece in bonsai))
        self.assertEqual({piece[1] for piece in bonsai}, {"Bonsai"})
        self.assertIn("Bonsai", self.T.SHADOWLESS)

    def test_the_stone_lantern_is_one_of_the_garden_lights_and_pools_its_light(self):
        (lantern,) = self.kinds("stone_lantern")
        self.assertIn("stone_lantern", catalog.NIGHT_KINDS)
        self.assertEqual(garden_interact().tags(self.T), {"Stone_lantern": LIGHTS})
        (pool,) = self.T.POOLS
        self.assertEqual((pool["group"], pool["kind"], pool["center"]), ("Stone_lantern", "stone_lantern",
                                                                         lantern[2][:2]))

    def test_stepping_stones_lead_from_the_paving_to_the_walk_a_stride_apart(self):
        steps = self.T.STEPS
        self.assertTrue(2 <= len(steps) <= 4)
        self.assertEqual([label for label, _ in self.T.SHAPES], [f"stepping stone {k}" for k in range(1, len(steps) + 1)])
        for step in steps:
            self.assertTrue(5 <= len(step) <= 8)  # a natural stone, not a square slab
        self.assertTrue(0.0 < self.T.STEP_TOP <= 0.06)

    def test_the_stepping_stone_check_finds_a_gap_and_a_stone_on_the_walk(self):
        far = [[(x, y - 0.6) for x, y in step] for step in self.T.STEPS]
        self.assertRegex(" ".join(layout_check.check_tea(copy(self.T, STEPS=far, SHAPES=[]))),
                         r"stepping stones: \d\.\d\d m of grass between the last stone and the walk, more than 0\.45 m")
        apart = [self.T.STEPS[0], [(x, y + 0.5) for x, y in self.T.STEPS[1]]]
        self.assertIn("stepping stone 2 lies on the walk", layout_check.check_tea(copy(self.T, STEPS=apart, SHAPES=[])))
        self.assertRegex(" ".join(layout_check.check_tea(copy(self.T, STEPS=apart, SHAPES=[]))),
                         r"stepping stones: \d\.\d\d m of grass between stones 1 and 2")
        self.assertEqual(layout_check.check_tea(copy(self.T, STEPS=[], SHAPES=[])), ["no stepping stones lead to the walk"])

    def test_the_garden_checks_the_tea_corners_pieces(self):
        crowded = copy(self.T, PIECES=self.T.PIECES + [("stone_stool", "Tea_corner", self.T.TABLE, 0)])
        self.assertIn("Tea_corner #1 (stone_table_round) overlaps Tea_corner #7 (stone_stool)",
                      layout_check.check_tea(crowded))
        out = copy(self.T, PIECES=self.T.PIECES + [("stone_stool", "Tea_corner", (2.95, 0.0), 0)])
        self.assertIn("Tea_corner #7 (stone_stool) sticks out of the 6 x 3.5 m footprint", layout_check.check_tea(out))
        bed = types.SimpleNamespace(MODULE_ID="beds", PIECES=[("flower_pot", "Pots", self.site(self.T.STEP_CENTRES[0]), 0)])
        self.assertEqual(layout_check.check_tea_site(self.T, layouts=[bed]),
                         ["stepping stone 1 overlaps Pots #1 (flower_pot) (beds)"])

    def test_the_garden_walk_and_the_border_by_the_pond_keep_clear_of_the_tea_corner_and_the_pond(self):
        from garden import layout_check as garden_check
        from garden import beds_layout, paths_layout
        for layout in (paths_layout, beds_layout):
            self.assertEqual(garden_check.check(layout), [], layout.MODULE_ID)  # out of the tea zone, grown or not
        self.assertEqual(garden_check.check_island(garden_check.island_layouts()), [])


def shapes_box(zone):
    (x0, y0), (x1, y1) = zone
    return (x0, y0, x1, y1)


def garden_interact():
    from garden import interact as garden
    return garden


if __name__ == "__main__":
    unittest.main()

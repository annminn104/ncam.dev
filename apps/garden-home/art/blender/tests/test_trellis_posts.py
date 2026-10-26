import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit.trellis_posts import trellis_posts  # noqa: E402
from houses import house_layout  # noqa: E402


class TrellisPostsTest(unittest.TestCase):
    """The grape trellis stands on posts at the corners and every ~3.5 m along the long sides. The
    function is pure: the house layout (system Python) reads it to put a planter at the foot of every post, and
    archkit.vines builds the posts from the same list."""

    def test_a_7_by_5_m_frame_has_a_post_at_each_corner_and_one_mid_way_on_the_long_sides(self):
        # 7 m / 3.5 m = 2 runs; the corners come first, then the posts between them
        self.assertEqual(trellis_posts((-3.0, 1.0), (4.0, 6.0)),
                         [(-3.0, 1.0), (-3.0, 6.0), (4.0, 1.0), (4.0, 6.0), (0.5, 1.0), (0.5, 6.0)])

    def test_the_posts_follow_the_long_side_when_it_runs_along_y(self):
        self.assertEqual(trellis_posts((0.0, 0.0), (5.0, 7.0)),
                         [(0.0, 0.0), (0.0, 7.0), (5.0, 0.0), (5.0, 7.0), (0.0, 3.5), (5.0, 3.5)])

    def test_a_short_frame_has_just_its_four_corners(self):
        self.assertEqual(trellis_posts((0.0, 0.0), (3.0, 2.0)), [(0.0, 0.0), (0.0, 2.0), (3.0, 0.0), (3.0, 2.0)])

    def test_a_long_frame_gets_a_pair_of_posts_every_run(self):
        posts = trellis_posts((0.0, 0.0), (10.5, 3.0))  # 3 runs of 3.5 m
        self.assertEqual(len(posts), 8)
        self.assertEqual(sorted({x for x, _ in posts}), [0.0, 3.5, 7.0, 10.5])

    def test_the_roof_planters_stand_at_the_foot_of_every_trellis_post(self):
        L = house_layout
        vine_planters = [p for p in L.PLANTERS if p[0].startswith("PLANT_vine_")]
        feet = sorted((x, y) for _name, (x, y, _z), _size, _shrubs in vine_planters)
        self.assertEqual(feet, sorted(trellis_posts(L.TRELLIS["min"], L.TRELLIS["max"])))
        self.assertEqual(len(feet), 6)
        self.assertEqual({z for _name, (_x, _y, z), _size, _shrubs in vine_planters}, {L.TRELLIS["z0"]})


if __name__ == "__main__":
    unittest.main()

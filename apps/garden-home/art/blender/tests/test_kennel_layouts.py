"""Villa v2 part 4: the dog's corner (carport/kennel_layout.py): its pieces, the Akita on its mat facing the lawn and
the wallpaper camera, its clips, the checks (carport/layout_check.check_kennel) and what a click on the dog does
(carport/interact.py). Pure Python."""
import math
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import contract  # noqa: E402
from archkit import catalog  # noqa: E402
from garden import shapes  # noqa: E402
from siteplan import zones  # noqa: E402
from carport import interact, kennel_layout, layout_check  # noqa: E402

DOG = {"interact": "dog", "label": "Akita pup", "clip": "act_dog_happy"}


def copy(layout, **overrides):
    """The layout module's data as a namespace, with some of it changed."""
    data = {key: getattr(layout, key) for key in dir(layout) if key.isupper()}
    data.update(overrides)
    return types.SimpleNamespace(**data)


class KennelLayoutTest(unittest.TestCase):
    L = kennel_layout

    def test_the_shipped_kennel_is_clean(self):
        self.assertEqual(layout_check.check_kennel(self.L), [])

    def test_the_kennel_is_a_prop_filling_its_zone(self):
        self.assertEqual((self.L.MODULE_ID, self.L.ROLE, self.L.ZONE), ("kennel", "prop", "kennel"))
        (x0, y0), (x1, y1) = zones.ZONES[self.L.ZONE]
        self.assertEqual(self.L.FOOTPRINT, (x1 - x0, y1 - y0))

    def test_a_dog_house_a_mat_a_water_and_a_food_bowl_a_ball_and_a_bush(self):
        kinds = sorted((kind, (opts[0] if opts else {}).get("variant")) for kind, _, _, _, *opts in self.L.PIECES)
        self.assertEqual(kinds, [("bush", None), ("dog_ball", None), ("dog_bowl", 0), ("dog_bowl", 1),
                                 ("dog_house", None), ("dog_mat", None)])
        groups = {kind: group for kind, group, *_ in self.L.PIECES}
        self.assertEqual(groups["dog_house"], self.L.STILL)
        self.assertEqual({groups[k] for k in ("dog_mat", "dog_bowl", "dog_ball", "bush")}, {self.L.CORNER})
        self.assertEqual(tuple(self.L.SHADOWLESS), (self.L.CORNER,))  # low things: no shadow pass

    def test_the_dog_house_faces_the_lawn_and_the_mat_lies_before_its_door(self):
        (house,) = [piece for piece in self.L.PIECES if piece[0] == "dog_house"]
        (mat,) = [piece for piece in self.L.PIECES if piece[0] == "dog_mat"]
        self.assertEqual(house[3], 0)  # its door to the front (-Y)
        self.assertLess(mat[2][1], house[2][1])
        self.assertLess(abs(mat[2][0] - house[2][0]), 0.3)

    def test_the_akita_sits_on_its_mat_clear_of_everything_else(self):
        dog = self.L.DOG
        (mat,) = [piece for piece in self.L.PIECES if piece[0] == "dog_mat"]
        mat_shape = shapes.rect(mat[2][:2], catalog.footprint("dog_mat", 0))
        self.assertEqual(shapes.distance(mat_shape, dog["pos"]), 0.0)
        self.assertEqual((dog["name"], dog["head"], dog["tail"]), ("Akita", "Akita_head", "Akita_tail"))
        on = copy(self.L, DOG=dict(dog, pos=(0.25, 0.75)))
        problems = layout_check.check_kennel(on)
        self.assertIn("the dog is not on its mat", problems)
        self.assertIn("the dog overlaps Kennel #1 (dog_house)", problems)

    def test_the_akita_faces_the_lawn_and_the_wallpaper_camera(self):
        yaw = math.radians(self.L.DOG["yaw"])
        facing = (math.sin(yaw), -math.cos(yaw))  # where the dog's nose points (it is built facing -Y)
        self.assertLess(facing[1], 0.0)  # towards the front of the yard, the lawn
        self.assertLessEqual(layout_check.dog_facing(self.L), layout_check.FACING)
        self.assertLessEqual(layout_check.FACING, 45.0)
        away = copy(self.L, DOG=dict(self.L.DOG, yaw=self.L.DOG["yaw"] + 180.0))
        self.assertTrue(any(problem.startswith("the dog faces") for problem in layout_check.check_kennel(away)))

    def test_pieces_that_overlap_are_a_problem(self):
        bowl = next(piece for piece in self.L.PIECES if piece[0] == "dog_bowl")
        (mat,) = [piece for piece in self.L.PIECES if piece[0] == "dog_mat"]
        pieces = [(kind, group, mat[2], rot, *opts) if piece is bowl else piece
                  for piece in self.L.PIECES for kind, group, _, rot, *opts in [piece]]
        problems = layout_check.check_kennel(copy(self.L, PIECES=pieces))
        self.assertTrue(any("overlaps" in problem and "(dog_bowl)" in problem and "(dog_mat)" in problem
                            for problem in problems), problems)

    def test_the_clips_breathe_and_wag_in_loops_and_the_happy_one_returns_to_rest(self):
        for clip in (self.L.BREATHE, self.L.WAG, self.L.HAPPY):
            self.assertRegex(clip["clip"], contract.CLIP_RE)
        self.assertEqual(self.L.BREATHE["clip"], "ambient_dog_breathe")
        self.assertEqual(self.L.WAG["clip"], "ambient_dog_tail")
        self.assertEqual(self.L.HAPPY["clip"], "act_dog_happy")
        self.assertTrue(all(0.0 < share < 0.05 for share in self.L.BREATHE["scale"]))  # subtle
        self.assertTrue(0.0 < self.L.WAG["swing"] < 20.0)  # slow and small
        happy = self.L.HAPPY
        self.assertLessEqual(happy["frames"], 4 * 24)  # a few seconds at 24 fps
        for key in ("hop", "turn", "head"):
            keys = happy[key]
            self.assertEqual(keys[0][0], 0, key)
            self.assertEqual(keys[-1][0], happy["frames"], key)
            self.assertEqual(keys[0][1], keys[-1][1], key)  # it ends where it began
            self.assertEqual([frame for frame, _ in keys], sorted(frame for frame, _ in keys), key)
        self.assertGreater(max(height for _, height in happy["hop"]), 0.03)  # a little hop
        self.assertGreater(happy["wag"]["beats"] / (happy["wag"]["end"] - happy["wag"]["start"]) * 24,
                           2.0 * 24 / self.L.WAG["frames"])  # wags faster than the slow ambient wag

    def test_a_click_on_the_akita_makes_it_happy(self):
        self.assertEqual(interact.tags(self.L), {"Akita": DOG})
        self.assertRegex(DOG["interact"], interact.GROUP_RE)


if __name__ == "__main__":
    unittest.main()

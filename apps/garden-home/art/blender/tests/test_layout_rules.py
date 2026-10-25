import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import layout_rules  # noqa: E402


class StopOrderTest(unittest.TestCase):
    def test_sorts_by_integer_suffix_not_text(self):
        names = ["CAM_stop_10", "CAM_stop_2", "CAM_stop_01", "CAM_stop_11", "CAM_stop_3"]
        self.assertEqual(layout_rules.stop_order(names),
                         ["CAM_stop_01", "CAM_stop_2", "CAM_stop_3", "CAM_stop_10", "CAM_stop_11"])

    def test_non_numeric_suffix_is_an_error(self):
        for bad in ("CAM_stop_", "CAM_stop_a", "CAM_stop_1b", "CAM_stop_01.001", "CAM_stop_-1"):
            with self.assertRaisesRegex(layout_rules.LayoutError, "CAM_stop_") as ctx:
                layout_rules.stop_order(["CAM_stop_01", bad])
            self.assertIn(bad, str(ctx.exception))

    def test_duplicate_index_is_an_error(self):
        with self.assertRaisesRegex(layout_rules.LayoutError, "same stop number") as ctx:
            layout_rules.stop_order(["CAM_stop_1", "CAM_stop_01"])
        self.assertIn("'CAM_stop_1'", str(ctx.exception))
        self.assertIn("'CAM_stop_01'", str(ctx.exception))

    def test_empty(self):
        self.assertEqual(layout_rules.stop_order([]), [])


class SkyTest(unittest.TestCase):
    def test_defaults_when_unset(self):
        self.assertEqual(layout_rules.sky_config({}), {"sunrise": "06:00", "sunset": "18:00"})

    def test_reads_custom_times(self):
        self.assertEqual(layout_rules.sky_config({"sunrise": "05:45", "sunset": "19:30"}),
                         {"sunrise": "05:45", "sunset": "19:30"})

    def test_accepts_the_edges_of_the_clock(self):
        self.assertEqual(layout_rules.sky_config({"sunrise": "00:00", "sunset": "23:59"}),
                         {"sunrise": "00:00", "sunset": "23:59"})

    def test_rejects_anything_that_is_not_two_digit_hh_mm(self):
        for bad in ("6:00", "06:0", "24:00", "12:60", "0600", "06:00:00", "06:00\n", " 06:00", "", "noon", 6, 6.5, None):
            with self.assertRaisesRegex(layout_rules.LayoutError, "sunrise.*HH:MM") as ctx:
                layout_rules.sky_config({"sunrise": bad})
            self.assertIn(repr(bad), str(ctx.exception))

    def test_names_the_offending_key(self):
        with self.assertRaisesRegex(layout_rules.LayoutError, "sunset"):
            layout_rules.sky_config({"sunset": "6pm"})

    def test_sunrise_must_be_before_sunset(self):
        for rise, sets in (("18:00", "06:00"), ("12:00", "12:00")):
            with self.assertRaisesRegex(layout_rules.LayoutError, "sunrise.*before.*sunset"):
                layout_rules.sky_config({"sunrise": rise, "sunset": sets})


if __name__ == "__main__":
    unittest.main()

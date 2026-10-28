import copy
import os
import struct
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import contract  # noqa: E402

VALID = {
    "id": "pond",
    "collection": {"exists": True, "footprint": [4.0, 3.0], "role": "prop"},
    "tris": 1200,
    "textures": [{"name": "T_pond", "size": [1024, 1024]}],
    "objects": [
        {"name": "Rim", "scale": [1.0, 1.0, 1.0], "animated": False},
        {"name": "Fish", "scale": [1.0, 1.0, 1.0], "animated": True},
    ],
    "actions": ["ambient_swim", "act_fish_scatter"],
    "hotspots": [
        {"name": "HS_pond", "action": "focus", "clip": None},
        {"name": "HS_fish", "action": "play", "clip": "act_fish_scatter"},
    ],
    "color_attrs": [{"mesh": "Reeds", "names": ["wind"]}],
    "lights": [{"name": "L_porch", "type": "POINT", "night_light": True}],
    "glass": [{"name": "GLASS_clear", "alpha": 0.2, "roughness": 0.05}],
    "frosted": [{"name": "FROSTED_bath", "alpha": 0.6, "roughness": 0.5}],
    "glow": [{"name": "GLOW_pool", "base_color": [0.0, 0.0, 0.0], "emission": [1.0, 0.7, 0.4], "strength": 1.5,
              "objects": [{"name": "Garden_lamps", "night_light": True}]}],
}
HERO = {"exists": True, "footprint": [8.0, 6.0], "role": "hero"}


def facts(**changes):
    result = copy.deepcopy(VALID)
    result.update(copy.deepcopy(changes))
    return result


def rules(errors):
    return sorted(e.split(":", 1)[0] for e in errors)


class ContractTest(unittest.TestCase):
    def test_valid_module_has_no_errors(self):
        self.assertEqual(contract.validate(facts()), [])

    def test_missing_collection_short_circuits(self):
        self.assertEqual(rules(contract.validate(facts(collection={"exists": False}))), ["collection-missing"])

    def test_footprint_must_be_two_positive_numbers(self):
        for bad in (None, [4.0], [4.0, 0], "4x3", [True, True]):
            col = {"exists": True, "footprint": bad, "role": "prop"}
            self.assertEqual(rules(contract.validate(facts(collection=col))), ["footprint-invalid"], bad)

    def test_role_must_be_hero_or_prop(self):
        col = {"exists": True, "footprint": [4.0, 3.0], "role": "giant"}
        self.assertEqual(rules(contract.validate(facts(collection=col))), ["role-invalid"])

    def test_tris_budget_depends_on_role(self):
        self.assertEqual(rules(contract.validate(facts(tris=15001))), ["tris-over-budget"])
        # the hero (the house) has 50k since the tall house (art/README.md, Glass villa): 23 x 15 m on two 4.8 m storeys
        self.assertEqual(contract.validate(facts(collection=HERO, tris=50000)), [])
        self.assertEqual(rules(contract.validate(facts(collection=HERO, tris=50001))), ["tris-over-budget"])
        self.assertEqual(contract.BUDGETS["hero"], {"tris": 50000, "texture": 2048})
        self.assertEqual(contract.BUDGETS["prop"], {"tris": 15000, "texture": 1024})

    def test_texture_budget_depends_on_role(self):
        big = [{"name": "T_big", "size": [2048, 1024]}]
        self.assertEqual(rules(contract.validate(facts(textures=big))), ["texture-too-large"])
        self.assertEqual(contract.validate(facts(collection=HERO, textures=big)), [])

    def test_unapplied_scale_on_static_object(self):
        objs = [{"name": "Rim", "scale": [2.0, 2.0, 2.0], "animated": False}]
        errors = contract.validate(facts(objects=objs))
        self.assertEqual(rules(errors), ["scale-not-applied"])
        self.assertIn("Rim", errors[0])

    def test_animated_objects_may_scale(self):
        objs = [{"name": "Fish", "scale": [0.5, 0.5, 0.5], "animated": True}]
        self.assertEqual(contract.validate(facts(objects=objs)), [])

    def test_clip_names_need_prefix(self):
        errors = contract.validate(facts(actions=["swim", "ambient_swim"], hotspots=[]))
        self.assertEqual(rules(errors), ["clip-name-invalid"])
        self.assertIn("'swim'", errors[0])

    def test_hotspot_action_must_be_known(self):
        hs = [{"name": "HS_bad", "action": "jump", "clip": None}]
        self.assertEqual(rules(contract.validate(facts(hotspots=hs))), ["hotspot-action-invalid"])

    def test_play_and_toggle_hotspots_need_existing_clip(self):
        for action in ("play", "toggle"):
            hs = [{"name": "HS_door", "action": action, "clip": "act_door_open"}]
            self.assertEqual(rules(contract.validate(facts(hotspots=hs))), ["hotspot-clip-missing"], action)

    def test_focus_hotspot_needs_no_clip(self):
        hs = [{"name": "HS_view", "action": "focus", "clip": None}]
        self.assertEqual(contract.validate(facts(hotspots=hs)), [])

    def test_wind_must_be_only_color_attribute(self):
        errors = contract.validate(facts(color_attrs=[{"mesh": "Tree", "names": ["wind", "Col"]}]))
        self.assertEqual(rules(errors), ["wind-not-exclusive"])
        self.assertIn("Tree", errors[0])

    def test_other_color_attributes_are_allowed_without_wind(self):
        self.assertEqual(contract.validate(facts(color_attrs=[{"mesh": "Rock", "names": ["Col", "AO"]}])), [])


def f32(value):
    """Round-trip through float32, like Blender's default_value."""
    return struct.unpack("f", struct.pack("f", value))[0]


def light(name, kind="POINT", night=True):
    return {"name": name, "type": kind, "night_light": night}


class VillaContractTest(unittest.TestCase):
    """Glass materials, night lights and texture count."""

    def test_glass_alpha_must_stay_see_through_but_visible(self):
        for alpha in (0.05, 0.6, 1.0):
            glass = [{"name": "GLASS_clear", "alpha": alpha, "roughness": 0.05}]
            self.assertEqual(rules(contract.validate(facts(glass=glass))), ["glass-material-invalid"], alpha)

    def test_glass_must_be_glossy(self):
        errors = contract.validate(facts(glass=[{"name": "GLASS_frosted", "alpha": 0.2, "roughness": 0.3}]))
        self.assertEqual(rules(errors), ["glass-material-invalid"])
        self.assertIn("GLASS_frosted", errors[0])

    def test_glass_bounds_are_inclusive_despite_float32_rounding(self):
        for alpha, roughness in ((0.1, 0.05), (0.5, 0.05), (0.2, 0.1)):
            glass = [{"name": "GLASS_edge", "alpha": f32(alpha), "roughness": f32(roughness)}]
            self.assertEqual(contract.validate(facts(glass=glass)), [], (alpha, roughness))

    def test_glass_without_principled_bsdf_is_rejected(self):
        glass = [{"name": "GLASS_odd", "alpha": None, "roughness": None}]
        self.assertEqual(rules(contract.validate(facts(glass=glass))), ["glass-material-invalid"])

    def test_light_budget_depends_on_role(self):
        self.assertEqual(rules(contract.validate(facts(lights=[light("a"), light("b"), light("c")]))),
                         ["lights-over-budget"])
        four = [light(n) for n in "abcd"]
        self.assertEqual(contract.validate(facts(collection=HERO, lights=four)), [])
        self.assertEqual(rules(contract.validate(facts(collection=HERO, lights=four + [light("e")]))),
                         ["lights-over-budget"])

    def test_only_point_and_spot_lights(self):
        errors = contract.validate(facts(lights=[light("L_sun", kind="SUN")]))
        self.assertEqual(rules(errors), ["light-type-invalid"])
        self.assertIn("L_sun", errors[0])

    def test_lights_must_be_night_lights(self):
        errors = contract.validate(facts(lights=[light("L_always_on", night=False)]))
        self.assertEqual(rules(errors), ["light-not-night"])

    def test_texture_count_limit(self):
        textures = [{"name": f"T_{i}", "size": [512, 512]} for i in range(5)]
        self.assertEqual(rules(contract.validate(facts(textures=textures))), ["texture-count-over-budget"])
        self.assertEqual(contract.validate(facts(textures=textures[:4])), [])


class FrostedContractTest(unittest.TestCase):
    """FROSTED_* materials stay translucent (alpha 0.4-0.85) and diffuse (roughness 0.3-0.8)."""

    def test_valid_frosted_material_is_accepted(self):
        self.assertEqual(contract.validate(facts()), [])

    def test_frosted_alpha_must_stay_in_range(self):
        for alpha in (0.3, 0.9):
            frosted = [{"name": "FROSTED_bath", "alpha": alpha, "roughness": 0.5}]
            errors = contract.validate(facts(frosted=frosted))
            self.assertEqual(rules(errors), ["frosted-material-invalid"], alpha)
            self.assertEqual(errors, [f"frosted-material-invalid: FROSTED_bath alpha {alpha:g} not in [0.4, 0.85]"])

    def test_frosted_roughness_must_stay_in_range(self):
        for roughness in (0.2, 0.9):
            frosted = [{"name": "FROSTED_bath", "alpha": 0.6, "roughness": roughness}]
            errors = contract.validate(facts(frosted=frosted))
            self.assertEqual(rules(errors), ["frosted-material-invalid"], roughness)
            self.assertEqual(errors,
                             [f"frosted-material-invalid: FROSTED_bath roughness {roughness:g} not in [0.3, 0.8]"])

    def test_frosted_bounds_are_inclusive_despite_float32_rounding(self):
        for alpha, roughness in ((0.4, 0.5), (0.85, 0.5), (0.6, 0.3), (0.6, 0.8)):
            frosted = [{"name": "FROSTED_edge", "alpha": f32(alpha), "roughness": f32(roughness)}]
            self.assertEqual(contract.validate(facts(frosted=frosted)), [], (alpha, roughness))

    def test_frosted_without_principled_bsdf_is_rejected(self):
        frosted = [{"name": "FROSTED_odd", "alpha": None, "roughness": None}]
        self.assertEqual(contract.validate(facts(frosted=frosted)),
                         ["frosted-material-invalid: FROSTED_odd has no Principled BSDF"])

    def test_every_frosted_material_is_checked(self):
        frosted = [{"name": "FROSTED_a", "alpha": 0.6, "roughness": 0.5},
                   {"name": "FROSTED_b", "alpha": 1.0, "roughness": 0.5}]
        errors = contract.validate(facts(frosted=frosted))
        self.assertEqual(len(errors), 1)
        self.assertIn("FROSTED_b", errors[0])

    def test_no_frosted_materials_is_fine(self):
        self.assertEqual(contract.validate(facts(frosted=[])), [])


class GlowContractTest(unittest.TestCase):
    """Villa v2 part 2: GLOW_* materials (the light pools under the garden lamps) only add light, at night: the website
    draws them additively and fades them with the night like the other night_light emissives."""

    def glow(self, **changes):
        return [dict(VALID["glow"][0], **changes)]

    def test_valid_glow_material_is_accepted(self):
        self.assertEqual(contract.validate(facts()), [])
        self.assertEqual(contract.validate(facts(glow=[])), [])

    def test_a_glow_must_glow(self):
        for changes in ({"strength": 0.0}, {"emission": [0.0, 0.0, 0.0]}):
            self.assertEqual(contract.validate(facts(glow=self.glow(**changes))),
                             ["glow-material-invalid: GLOW_pool does not glow (emission (1, 0.7, 0.4) x 0)"
                              if "strength" in changes else
                              "glow-material-invalid: GLOW_pool does not glow (emission (0, 0, 0) x 1.5)"], changes)

    def test_a_glow_has_a_black_base_colour_so_daylight_adds_nothing(self):
        self.assertEqual(contract.validate(facts(glow=self.glow(base_color=[0.5, 0.4, 0.3]))),
                         ["glow-material-invalid: GLOW_pool base colour (0.5, 0.4, 0.3) must be black (max 0.02): "
                          "a glow only adds light"])
        self.assertEqual(contract.validate(facts(glow=self.glow(base_color=[0.02, 0.0, 0.01]))), [])

    def test_a_glow_without_principled_bsdf_is_rejected(self):
        self.assertEqual(contract.validate(facts(glow=self.glow(base_color=None, emission=None, strength=None))),
                         ["glow-material-invalid: GLOW_pool has no Principled BSDF"])

    def test_every_object_with_a_glow_is_a_night_light(self):
        objects = [{"name": "Garden_lamps", "night_light": True}, {"name": "Paving", "night_light": False}]
        self.assertEqual(contract.validate(facts(glow=self.glow(objects=objects))),
                         ["glow-not-night: GLOW_pool on Paving needs custom property night_light = True"])


if __name__ == "__main__":
    unittest.main()

import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from archkit import catalog  # noqa: E402
from archkit.catalog import FURNITURE, WALL_MOUNTED  # noqa: E402
from houses import house_layout, interact, layout_check, pool_layout  # noqa: E402
from houses.house_parts import common, shell  # noqa: E402


def layout(**overrides):
    """A 10 x 8 m footprint with one 8 x 6 m room on each of two levels and a sofa in the middle."""
    base = {
        "FOOTPRINT": (10.0, 8.0),
        "ROOMS": [
            {"name": "living", "level": 0, "min": (-4.0, -3.0), "max": (4.0, 3.0)},
            {"name": "upstairs", "level": 1, "min": (-4.0, -3.0), "max": (4.0, 3.0)},
        ],
        "FURNITURE": [("sofa_l", "Sofa", "living", (0.0, 0.0), 0)],
    }
    base.update(overrides)
    return types.SimpleNamespace(**base)


class LayoutCheckTest(unittest.TestCase):
    def test_shipped_house_layout_is_clean(self):
        self.assertEqual(layout_check.check(house_layout), [])

    def test_shipped_house_is_the_23_x_15_tall_villa(self):
        L = house_layout
        self.assertEqual((L.MODULE_ID, L.ROLE, L.FOOTPRINT), ("house", "hero", (23.0, 15.0)))
        self.assertEqual({room["name"] for room in L.ROOMS if not room.get("interior")}, {"terrace", "balcony", "roof"})
        self.assertEqual([light["name"] for light in L.POINT_LIGHTS],
                         ["L_living", "L_kitchen", "L_master", "L_bedroom2"])
        self.assertEqual(len(L.FROSTED), 3)
        self.assertGreaterEqual(len(L.PARTITIONS), 8)

    def test_no_two_rooms_of_the_house_show_the_same_painting(self):
        rooms = {}
        for kind, _name, room, _center, _rot, *opts in house_layout.FURNITURE:
            if kind.startswith("painting_"):
                rooms.setdefault((opts[0] if opts else {}).get("variant", 0), set()).add(room)
        self.assertGreaterEqual(len(rooms), 6)
        self.assertEqual({variant: shared for variant, shared in rooms.items() if len(shared) > 1}, {})

    def test_minimal_layout_is_clean(self):
        self.assertEqual(layout_check.check(layout()), [])

    def test_furniture_must_stay_inside_its_room(self):
        problems = layout_check.check(layout(FURNITURE=[("sofa_l", "Sofa", "living", (3.5, 0.0), 0)]))
        self.assertEqual(problems, ["Sofa (sofa_l) sticks out of room 'living'"])

    def test_nothing_upstairs_may_stand_over_a_stair(self):
        # a spiral stair climbs into the floor above: its landing and the hole beside it stay free there
        stair = ("spiral_stair", "Stair", "living", (0.0, 0.0), 0)
        over = ("bed_double", "Bed", "upstairs", (0.5, 0.5), 0)
        beside = ("bed_double", "Bed", "upstairs", (2.9, 1.5), 0)
        hung = ("painting_m", "Painting", "upstairs", (0.0, 0.5), 0)  # on a wall: it hangs over nothing
        self.assertEqual(layout_check.check(layout(FURNITURE=[stair, over])),
                         ["Bed (bed_double) stands over the stair Stair (spiral_stair)"])
        self.assertEqual(layout_check.check(layout(FURNITURE=[stair, beside, hung])), [])

    def test_rotation_swaps_the_footprint(self):
        # bed_double is 1.8 x 2.2: at y = 1.95 it only fits turned sideways
        upright = layout(FURNITURE=[("bed_double", "Bed", "living", (0.0, 1.95), 0)])
        sideways = layout(FURNITURE=[("bed_double", "Bed", "living", (0.0, 1.95), 90)])
        self.assertEqual(layout_check.check(upright), ["Bed (bed_double) sticks out of room 'living'"])
        self.assertEqual(layout_check.check(sideways), [])

    def test_pieces_on_the_same_level_must_not_overlap(self):
        pieces = [("armchair", "Chair_a", "living", (0.0, 0.0), 0), ("armchair", "Chair_b", "living", (0.5, 0.0), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), ["Chair_a overlaps Chair_b"])

    def test_a_piece_on_a_host_sits_on_its_top_rather_than_beside_it(self):
        # the decor pass (villa v2 spec §12 "Rèm và phụ kiện"): a piece put "on" another stands on one of the host's
        # catalog.SURFACES tops, so it does not clash with it; off every top of its host, on no piece of the layout or on
        # one without a top, it is reported
        sofa = ("sofa_l", "Sofa", "living", (0.0, 0.0), 0)
        table = ("coffee_table", "Table", "living", (0.0, 1.5), 0)
        plant = ("plant_tall", "Plant", "living", (3.0, -2.0), 0)

        def bowl(at, host):
            return ("bowl", "Bowl", "living", at, 0, {"on": host})

        self.assertEqual(layout_check.check(layout(FURNITURE=[sofa, table, plant, bowl((0.3, 1.5), "Table")])), [])
        self.assertAlmostEqual(layout_check.top_under(bowl((0.3, 1.5), "Table"), {"Table": table}), 0.4)
        self.assertEqual(layout_check.check(layout(FURNITURE=[sofa, table, bowl((0.9, 1.5), "Table")])),
                         ["Bowl (bowl) is not on a top of Table (coffee_table)"])
        self.assertEqual(layout_check.check(layout(FURNITURE=[sofa, table, bowl((0.3, 1.5), "Nowhere")])),
                         ["Bowl (bowl) stands on 'Nowhere', which is no piece of the layout"])
        self.assertEqual(layout_check.check(layout(FURNITURE=[sofa, plant, bowl((3.0, -2.0), "Plant")])),
                         ["Bowl (bowl) stands on Plant (plant_tall), which has no top to stand on"])

    def test_the_same_spot_on_another_level_is_fine(self):
        pieces = [("armchair", "Chair_a", "living", (0.0, 0.0), 0), ("armchair", "Chair_b", "upstairs", (0.0, 0.0), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), [])

    def test_rugs_may_lie_under_furniture(self):
        pieces = [("rug", "Rug", "living", (0.0, 0.0), 0), ("sofa_l", "Sofa", "living", (0.0, 0.0), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), [])

    def test_unknown_kind_room_and_rotation_are_reported(self):
        pieces = [
            ("throne", "Throne", "living", (0.0, 0.0), 0),
            ("armchair", "Lost", "attic", (0.0, 0.0), 0),
            ("armchair", "Tilted", "living", (2.0, 2.0), 45),
        ]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), [
            "Throne: unknown furniture kind 'throne'",
            "Lost: unknown room 'attic'",
            "Tilted: rotation must be one of [0, 90, 180, 270], got 45",
        ])

    def test_rooms_must_fit_the_footprint(self):
        rooms = [{"name": "wing", "level": 0, "min": (-6.0, -3.0), "max": (0.0, 3.0)}]
        problems = layout_check.check(layout(ROOMS=rooms, FURNITURE=[]))
        self.assertEqual(problems, ["room 'wing' extends outside the 10 x 8 m footprint"])

    def test_lights_and_planters_must_sit_inside_the_footprint(self):
        problems = layout_check.check(layout(
            POINT_LIGHTS=[{"name": "L_out", "pos": (6.0, 0.0, 2.0)}],
            PLANTERS=[("PLANT_out", (0.0, -4.5, 0.0), (1.0, 0.5, 0.5), 2)],
        ))
        self.assertEqual(problems, ["L_out at (6, 0) is outside the footprint",
                                    "PLANT_out at (0, -4.5) is outside the footprint"])

    def test_shipped_pool_layout_is_clean(self):
        self.assertEqual(layout_check.check(pool_layout), [])

    def test_pool_deck_has_teak_loungers_swaying_palms_and_lanterns(self):
        kinds = {}
        for kind, name, _room, _center, _rot, *opts in pool_layout.FURNITURE:
            kinds.setdefault(kind, []).append((opts[0] if opts else {}).get("wind", False))
        self.assertEqual(len(kinds.get("teak_lounger", [])), 3)
        self.assertNotIn("lounger", kinds)
        self.assertEqual(kinds.get("palm_small"), [True, True])  # outdoors: they sway
        self.assertEqual(len(kinds.get("lantern", [])), 2)
        self.assertFalse(hasattr(pool_layout, "POINT_LIGHTS"))  # lanterns glow, no lights (prop budget)

    def test_builder_options_ride_along_as_a_sixth_element(self):
        pieces = [("painting_l", "Painting", "living", (0.0, 2.95), 0, {"variant": 3})]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), [])

    def test_a_painting_may_hang_above_a_sofa(self):
        pieces = [("sofa_l", "Sofa", "living", (0.0, 1.9), 0), ("painting_l", "Painting", "living", (0.0, 2.95), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), [])

    def test_wall_mounted_pieces_must_not_overlap_each_other(self):
        pieces = [("painting_l", "Painting_a", "living", (0.0, 2.95), 0, {"variant": 0}),
                  ("painting_m", "Painting_b", "living", (1.0, 2.95), 0, {"variant": 1})]
        self.assertEqual(layout_check.check(layout(FURNITURE=pieces)), ["Painting_a overlaps Painting_b"])

    def test_string_lights_and_water_features_must_sit_inside_the_footprint(self):
        problems = layout_check.check(layout(
            STRING_LIGHTS=[{"name": "String_out", "points": [(0.0, 0.0, 3.0), (6.0, 0.0, 3.0)]}],
            REFLECTING_POOLS=[{"name": "pool_out", "level": 0, "min": (-6.0, -3.0), "max": (-4.0, -2.0), "z": 0.0}],
            WALL_FOUNTAINS=[{"name": "fountain_out", "start": (3.0, 3.8), "end": (5.5, 3.8), "z0": 0.0,
                             "height": 1.5}],
        ))
        self.assertEqual(problems, ["String_out at (6, 0) is outside the footprint",
                                    "pool_out at (-6, -3) is outside the footprint",
                                    "fountain_out at (5.5, 3.8) is outside the footprint"])

    def test_nothing_may_stand_in_a_reflecting_pool(self):
        pool = {"name": "pool", "level": 0, "min": (-1.0, -1.0), "max": (1.0, 1.0), "z": 0.0}
        sofa = [("sofa_l", "Sofa", "living", (0.0, 0.0), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=sofa, REFLECTING_POOLS=[pool])), ["Sofa overlaps pool"])
        upstairs = [("sofa_l", "Sofa", "upstairs", (0.0, 0.0), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=upstairs, REFLECTING_POOLS=[pool])), [])

    def test_nothing_may_stand_in_a_wall_fountains_wall_or_basin(self):
        # a 4 m fountain on y = 2 facing -Y: its 0.2 m wall spans y 1.9..2.1 and the basin reaches 0.5 m in front of it
        fountain = {"name": "fountain", "start": (-2.0, 2.0), "end": (2.0, 2.0), "z0": 0.0, "height": 2.0, "facing": -1}

        def lantern(y, room="living"):
            return layout(FURNITURE=[("lantern", "Lantern", room, (0.0, y), 0)], WALL_FOUNTAINS=[fountain])

        self.assertEqual(layout_check.check(lantern(1.7)), ["Lantern overlaps fountain"])  # in the basin
        self.assertEqual(layout_check.check(lantern(2.2)), ["Lantern overlaps fountain"])  # in the wall slab
        self.assertEqual(layout_check.check(lantern(1.0)), [])  # in front of the basin
        self.assertEqual(layout_check.check(lantern(2.6)), [])  # behind the wall: the basin is on the other side
        self.assertEqual(layout_check.check(lantern(1.7, room="upstairs")), [])  # a fountain stands on the ground
        rug = [("rug", "Rug", "living", (0.0, 1.7), 0)]
        self.assertEqual(layout_check.check(layout(FURNITURE=rug, WALL_FOUNTAINS=[fountain])), [])
        facing_back = dict(fountain, facing=1)  # +Y: the basin is behind the wall now
        self.assertEqual(layout_check.check(layout(FURNITURE=[("lantern", "Lantern", "living", (0.0, 2.6), 0)],
                                                   WALL_FOUNTAINS=[facing_back])), ["Lantern overlaps fountain"])
        alongside = dict(fountain, start=(3.0, 2.0), end=(3.0, 3.0), facing=-1)  # along Y: the basin reaches to -X
        self.assertEqual(layout_check.check(layout(FURNITURE=[("lantern", "Lantern", "living", (2.5, 2.5), 0)],
                                                   WALL_FOUNTAINS=[alongside])), ["Lantern overlaps fountain"])

    def test_wind_is_for_plants_that_sway_and_rejected_on_any_other_kind(self):
        # archkit.furniture.place raises TypeError for the option on a kind that does not sway, so the layout check
        # reports it before any geometry is built
        reason = f"does not sway, wind is for {sorted(catalog.WIND_SPANS)}"
        for wind in (True, False):
            sofa = [("sofa_l", "Sofa", "living", (0.0, 0.0), 0, {"wind": wind})]
            self.assertEqual(layout_check.check(layout(FURNITURE=sofa)), [f"Sofa: sofa_l {reason}"])
        palm = [("palm_small", "Palm", "living", (0.0, 0.0), 0, {"wind": True})]
        self.assertEqual(layout_check.check(layout(FURNITURE=palm)), [])
        self.assertTrue(set(catalog.WIND_SPANS) <= set(FURNITURE))  # the swaying plants are catalog kinds


HANGING = ("rattan_pendant", "fern_hanging", "crystal_chandelier")


class ResortHouseTest(unittest.TestCase):
    """Resort deco: the villa dressed as a tropical resort, as plain layout data."""

    def kinds(self):
        found = {}
        for kind, name, room, *_ in house_layout.FURNITURE:
            found.setdefault(kind, []).append((name, room))
        return found

    def rooms_of(self, kind):
        return sorted(room for _name, room in self.kinds().get(kind, []))

    def test_rattan_tropical_and_teak_pieces_furnish_the_rooms(self):
        # two rattan pendants over the dining table, three over the island, one per bedroom
        self.assertEqual(self.rooms_of("rattan_pendant"),
                         ["bedroom2", "bedroom3", "dining", "dining", "kitchen", "kitchen", "kitchen", "master"])
        self.assertEqual(house_layout.PENDANTS, [])  # the plain drum pendant over the table is gone
        self.assertEqual(self.rooms_of("rattan_armchair"), ["living", "living"])
        self.assertNotIn("living", self.rooms_of("armchair"))
        self.assertEqual(self.rooms_of("teak_lounger"), ["roof", "roof"])
        self.assertEqual(self.rooms_of("lounger"), [])
        for kind, room in (("palm_tall", "living"), ("monstera", "living"), ("fern_hanging", "living"),
                           ("egg_chair", "balcony"), ("daybed_cabana", "roof"), ("outdoor_bar", "roof"),
                           ("lantern", "roof")):
            self.assertIn(room, self.rooms_of(kind), kind)
        self.assertIn(len(self.rooms_of("fern_hanging")), (1, 2))
        self.assertIn("living", self.rooms_of("bird_of_paradise") + self.rooms_of("plant_wall"))  # by the TV wall

    def test_every_bedroom_has_a_plant_and_the_balcony_and_roof_have_palms(self):
        plants = set(catalog.WIND_SPANS) | {"plant_tall", "plant_small"}
        for room in ("master", "bedroom2", "bedroom3"):
            self.assertTrue(any(room in self.rooms_of(kind) for kind in plants), room)
        self.assertIn("balcony", self.rooms_of("palm_small"))
        self.assertGreaterEqual(self.rooms_of("palm_small").count("roof"), 2)

    def test_two_potted_palms_flank_the_door_and_two_lanterns_its_steps(self):
        door = house_layout.DOOR
        middle = (door["x0"] + door["x1"]) / 2
        for kind in ("palm_small", "lantern"):
            xs = sorted(x for k, _name, room, (x, _y), *_ in house_layout.FURNITURE if k == kind and room == "terrace")
            self.assertEqual(len(xs), 2, kind)
            self.assertTrue(xs[0] < door["x0"] and xs[1] > door["x1"], (kind, xs))  # one on each side
            self.assertAlmostEqual(middle - xs[0], xs[1] - middle, delta=0.15, msg=kind)

    def test_tropical_plants_sway_outdoors_only(self):
        interior = {room["name"]: room.get("interior", False) for room in house_layout.ROOMS}
        for kind, name, room, _center, _rot, *opts in house_layout.FURNITURE:
            if kind in catalog.WIND_SPANS:
                self.assertEqual((opts[0] if opts else {}).get("wind", False), not interior[room], name)

    def test_hanging_pieces_reach_their_ceiling_on_a_cord(self):
        # the ceiling over them: their level's, or the upper floor's over the double-height living room's void
        levels = {room["name"]: room["level"] for room in house_layout.ROOMS}
        hung = 0
        for kind, name, room, center, _rot, *opts in house_layout.FURNITURE:
            if kind in HANGING:
                level = levels[room]
                top = (house_layout.LEVEL_Z[level] + WALL_MOUNTED[kind] + FURNITURE[kind][2]
                       + (opts[0] if opts else {}).get("cord", 0.0))
                self.assertAlmostEqual(top, common.ceiling_over(level, center), places=3, msg=name)
                hung += 1
        self.assertGreaterEqual(hung, 10)

    def test_floors_are_travertine_downstairs_and_teak_upstairs(self):
        keys = {}  # material key of every horizontal box by the height of its top
        for group in house_layout.STRUCTURE:
            for key, _mn, (_x, _y, top) in group["boxes"]:
                keys.setdefault(round(top, 3), set()).add(key)
            self.assertNotIn("floor", {key for key, _mn, _mx in group["boxes"]}, group["name"])
            self.assertNotIn("wood", {key for key, _mn, _mx in group["boxes"]}, group["name"])  # soffits, louvers
        self.assertEqual(keys[round(house_layout.PLINTH + 0.02, 3)], {"stone"})  # the ground floor
        self.assertEqual(keys[round(common.UPPER_FLOOR + 0.02, 3)], {"teak"})  # upper floors and the balcony deck
        self.assertEqual(house_layout.JACUZZI["deck"], "teak")

    def test_a_reflecting_pool_runs_along_the_terrace_clear_of_the_door_steps(self):
        (pool,) = house_layout.REFLECTING_POOLS
        terrace = next(room for room in house_layout.ROOMS if room["name"] == "terrace")
        self.assertEqual((pool["name"], pool["level"], pool["z"]), ("reflecting_pool", 0, house_layout.PLINTH))
        self.assertTrue(terrace["min"][0] <= pool["min"][0] and pool["max"][0] <= common.STONE_LEFT, pool)
        self.assertTrue(common.TERRACE <= pool["min"][1] and pool["max"][1] < common.FRONT - 0.03, pool)  # off the glass
        self.assertGreaterEqual(pool["max"][0] - pool["min"][0], 10.0)  # a strip along the whole glass front
        self.assertGreaterEqual(len(pool["steps"]), 8)
        door = house_layout.DOOR
        self.assertLess(pool["max"][0], door["x0"] - 1.0)  # the steps up to the door stay free

    def test_the_terrace_stands_on_the_plinth_and_so_do_the_pieces_on_it(self):
        floor = house_layout.FLOOR_Z  # per room: where a piece's feet go (build_house places furniture at it)
        rooms = {room["name"]: room for room in house_layout.ROOMS}
        # the plinth top is 2 cm under the interior floor (LEVEL_Z[0]), which does not reach out to the terrace
        self.assertEqual(rooms["terrace"].get("floor"), house_layout.PLINTH)
        self.assertEqual(floor["terrace"], house_layout.PLINTH)
        self.assertLess(floor["terrace"], house_layout.LEVEL_Z[0])
        for name, room in rooms.items():
            if name != "terrace":
                self.assertEqual(floor[name], house_layout.LEVEL_Z[room["level"]], name)
        stands = {name: floor[room] for _kind, name, room, *_ in house_layout.FURNITURE}
        for name in ("Palm_door_l", "Palm_door_r", "Lantern_steps_l", "Lantern_steps_r"):
            self.assertEqual(stands[name], house_layout.PLINTH, name)
        self.assertEqual((stands["Sofa"], stands["Roof_sofa"]), (house_layout.LEVEL_Z[0], house_layout.LEVEL_Z[2]))

    def test_the_terrace_stops_at_the_facade_so_nothing_stands_in_the_stone_wall(self):
        terrace = next(room for room in house_layout.ROOMS if room["name"] == "terrace")
        self.assertEqual(terrace["max"][1], shell.FACADE)  # the outer face of the stone front, 10 cm in front of FRONT
        palm = ("palm_small", "Palm_in_wall", "terrace", (7.6, -5.9), 0)  # y -6.3..-5.5: its back 10 cm in the wall
        walled = types.SimpleNamespace(**dict(vars(house_layout), FURNITURE=house_layout.FURNITURE + [palm]))
        self.assertEqual(layout_check.check(walled), ["Palm_in_wall (palm_small) sticks out of room 'terrace'"])

    def test_a_wall_fountain_stands_on_the_facade_beside_the_door(self):
        (fountain,) = house_layout.WALL_FOUNTAINS
        door = house_layout.DOOR
        (x0, y0), (x1, y1) = fountain["start"], fountain["end"]
        self.assertEqual((fountain["name"], fountain["z0"], fountain.get("facing", -1)),
                         ("fountain", house_layout.PLINTH, -1))
        self.assertEqual(y0, y1)
        self.assertTrue(door["x1"] < min(x0, x1) and max(x0, x1) <= common.RIGHT, fountain)
        self.assertAlmostEqual(y0 + 0.1, common.FRONT - 0.1, delta=0.01)  # its back against the stone front

    def test_string_lights_zig_zag_under_the_trellis_lattice_and_run_along_the_roof_railing(self):
        lights = {group["name"]: group for group in house_layout.STRING_LIGHTS}
        self.assertEqual(sorted(lights), ["String_lights_railing", "String_lights_trellis"])
        t = house_layout.TRELLIS
        (tx0, ty0), (tx1, ty1) = t["min"], t["max"]
        underside = t["z0"] + t["height"] - 0.24  # under the beams (archkit.vines: BEAM 0.16 and two 0.04 slat layers)
        trellis = lights["String_lights_trellis"]["points"]
        self.assertGreaterEqual(len(trellis), 5)
        for x, y, z in trellis:
            self.assertTrue(tx0 <= x <= tx1 and y in (ty0, ty1), (x, y))
            self.assertAlmostEqual(z, underside, places=3)
        self.assertTrue(all(a[1] != b[1] for a, b in zip(trellis, trellis[1:])))  # a zig-zag across the lattice
        rails = {rail["name"]: rail for rail in house_layout.RAILINGS}
        top = rails["roof_front"]["z0"] + rails["roof_front"]["height"]
        front_y, right_x = rails["roof_front"]["start"][1], rails["roof_right"]["start"][0]
        railing = lights["String_lights_railing"]
        for x, y, z in railing["points"]:
            self.assertTrue(abs(y - front_y) < 1e-6 or abs(x - right_x) < 1e-6, (x, y))
            # the globes are centred on the wire: resting on the handrail takes the wire a bulb radius above it
            self.assertTrue(top + railing["bulb_radius"] <= z <= top + railing["bulb_radius"] + 0.01, z)



# A 4 m partition along y = 1 on the ground floor of layout(), with one 0.9 m door 1 m from its start (x -3.0..-2.1).
WALL = {"name": "W_bath", "level": 0, "start": (-4.0, 1.0), "end": (0.0, 1.0), "doors": [(1.0, 0.9)]}


def walled(doors=WALL["doors"], furniture=(), **wall):
    return layout(PARTITIONS=[dict(WALL, doors=doors, **wall)], FURNITURE=list(furniture))


class PartitionCheckTest(unittest.TestCase):
    """Villa v2 spec §5.1, §10: doors fit their walls, nothing stands in a doorway, partitions stay in the house."""

    def test_a_wall_with_a_free_door_is_clean(self):
        self.assertEqual(layout_check.check(walled()), [])

    def test_doors_must_fit_the_wall(self):
        self.assertEqual(layout_check.check(walled(doors=[(3.5, 0.9)])),
                         ["W_bath: door 1 (3.5 + 0.9 m) does not fit the 4 m wall"])
        self.assertEqual(layout_check.check(walled(doors=[(1.0, 0.9), (-0.2, 0.9)])),
                         ["W_bath: door 2 (-0.2 + 0.9 m) does not fit the 4 m wall"])

    def test_doors_must_not_overlap(self):
        self.assertEqual(layout_check.check(walled(doors=[(1.0, 0.9), (1.5, 0.9)])), ["W_bath: doors 1 and 2 overlap"])

    def test_doors_may_touch(self):
        self.assertEqual(layout_check.check(walled(doors=[(1.0, 0.9), (1.9, 0.9)])), [])

    def test_furniture_must_not_block_a_door(self):
        # the armchair's 0.8 m footprint (y 0.0..0.8) reaches into the clearance 0.8 m in front of the door
        chair = ("armchair", "Chair", "living", (-2.55, 0.4), 0)
        self.assertEqual(layout_check.check(walled(furniture=[chair])), ["Chair (armchair) blocks door 1 of W_bath"])

    def test_touching_the_door_clearance_is_fine(self):
        chair = ("armchair", "Chair", "living", (-2.55, -0.2), 0)  # y -0.6..0.2: ends on the clearance edge
        self.assertEqual(layout_check.check(walled(furniture=[chair])), [])

    def test_rugs_paintings_and_other_levels_do_not_block_a_door(self):
        pieces = [("rug", "Rug", "living", (-2.0, 0.4), 0), ("painting_m", "Painting", "living", (-2.55, 0.915), 0),
                  ("armchair", "Chair_up", "upstairs", (-2.55, 0.4), 0)]
        self.assertEqual(layout_check.check(walled(furniture=pieces)), [])

    def test_partitions_must_stay_inside_the_footprint(self):
        self.assertEqual(layout_check.check(walled(start=(-6.0, 1.0))), ["partition W_bath is outside the footprint"])

    def test_frosted_panels_must_stay_inside_the_footprint(self):
        inside = {"name": "wc", "start": (5.0, -1.0), "end": (5.0, 1.0), "z0": 1.0, "z1": 2.0}
        outside = dict(inside, name="spa", start=(5.5, -1.0), end=(5.5, 1.0))
        self.assertEqual(layout_check.check(layout(FROSTED=[inside, outside])),
                         ["frosted panel spa is outside the footprint"])


# A 1.2 m passage on the ground floor of layout(): the gap the 4 m wall of WALL (no door) leaves to the room's east
# wall, along y = 1 from x 0 to 1.2.
PASSAGE = {"name": "living_way", "level": 0, "start": (0.0, 1.0), "end": (1.2, 1.0)}


def passed(furniture=(), **passage):
    return layout(PARTITIONS=[dict(WALL, doors=[])], PASSAGES=[dict(PASSAGE, **passage)], FURNITURE=list(furniture))


class PassageCheckTest(unittest.TestCase):
    """A way between two rooms that is no partition's door (the gap a wall stops short of another) is kept clear like a
    doorway: DOOR_CLEARANCE on each side of its line."""

    def test_a_free_passage_is_clean(self):
        self.assertEqual(layout_check.check(passed()), [])

    def test_furniture_must_not_block_a_passage(self):
        chair = ("armchair", "Chair", "living", (0.6, 0.4), 0)  # y 0.0..0.8 reaches into the 0.8 m clearance
        self.assertEqual(layout_check.check(passed(furniture=[chair])),
                         ["Chair (armchair) blocks the passage living_way"])
        across = ("armchair", "Chair", "living", (0.6, 1.4), 0)
        self.assertEqual(layout_check.check(passed(furniture=[across])),
                         ["Chair (armchair) blocks the passage living_way"])

    def test_a_passage_along_y_keeps_its_clearance_across_x(self):
        along_y = {"start": (2.0, -2.0), "end": (2.0, -0.8)}
        chair = ("armchair", "Chair", "living", (2.5, -1.4), 0)  # x 2.1..2.9: inside the 0.8 m clearance
        self.assertEqual(layout_check.check(passed(furniture=[chair], **along_y)),
                         ["Chair (armchair) blocks the passage living_way"])
        clear = ("armchair", "Chair", "living", (3.2, -1.4), 0)  # x 2.8..3.6: touches it
        self.assertEqual(layout_check.check(passed(furniture=[clear], **along_y)), [])

    def test_rugs_and_other_levels_do_not_block_a_passage(self):
        pieces = [("rug", "Rug", "living", (0.6, 0.4), 0), ("armchair", "Chair_up", "upstairs", (0.6, 0.4), 0)]
        self.assertEqual(layout_check.check(passed(furniture=pieces)), [])

    def test_passages_must_stay_inside_the_footprint(self):
        self.assertEqual(layout_check.check(passed(end=(6.0, 1.0))), ["passage living_way is outside the footprint"])


def lit(points, level=0, interior=True):
    """layout() with an empty 'bath' on the left half of the ground floor and a downlight group on `level`."""
    bath = {"name": "bath", "level": 0, "min": (-4.0, -3.0), "max": (0.0, 3.0)}
    if interior:
        bath["interior"] = True
    porch = {"name": "porch", "level": 0, "min": (0.0, -3.0), "max": (4.0, 3.0)}
    group = {"name": "LT_down", "z": 3.0, "points": points}
    if level is not None:
        group["level"] = level
    return layout(ROOMS=[bath, porch], FURNITURE=[], DOWNLIGHTS=[group])


class DownlightCheckTest(unittest.TestCase):
    """Villa v2 spec §5.4, §10: every interior room has 2–4 downlights."""

    def test_two_to_four_downlights_are_fine(self):
        self.assertEqual(layout_check.check(lit([(-3.0, 0.0), (-1.0, 0.0)])), [])
        self.assertEqual(layout_check.check(lit([(-3.0, y) for y in (-2.0, -1.0, 1.0, 2.0)])), [])

    def test_too_few_or_too_many_downlights(self):
        self.assertEqual(layout_check.check(lit([(-2.0, 0.0), (2.0, 0.0), (3.0, 1.0)])),
                         ["room 'bath' has 1 downlights, needs 2–4"])
        self.assertEqual(layout_check.check(lit([(-3.5, y) for y in (-2.0, -1.0, 0.0, 1.0, 2.0)])),
                         ["room 'bath' has 5 downlights, needs 2–4"])

    def test_points_on_the_room_edge_count(self):
        self.assertEqual(layout_check.check(lit([(-4.0, 3.0), (0.0, -3.0)])), [])

    def test_groups_on_another_level_or_without_one_do_not_count(self):
        self.assertEqual(layout_check.check(lit([(-3.0, 0.0), (-1.0, 0.0)], level=1)),
                         ["room 'bath' has 0 downlights, needs 2–4"])
        self.assertEqual(layout_check.check(lit([(-3.0, 0.0), (-1.0, 0.0)], level=None)),
                         ["room 'bath' has 0 downlights, needs 2–4"])

    def test_rooms_that_are_not_interior_are_not_counted(self):
        self.assertEqual(layout_check.check(lit([(-3.0, 0.0)], interior=False)), [])


# the wall switch of the 'bath' room of lit(): against its west wall, facing +X
SWITCH = ("light_switch", "Switch_bath", "bath", (-3.99, 0.0), 90)


def interactive(points=((-3.0, 0.0), (-1.0, 0.0)), **overrides):
    """lit() made interactive: ROOM_LABELS names its rooms, so layout_check checks the click groups too. The lit room has
    its wall switch, whose top is 1.27 m over the floor, under the 1.6 m cut of level 0 that the layout names."""
    base = lit(list(points))
    base.ROOM_LABELS = {"bath": "phòng tắm", "porch": "hiên"}
    base.FURNITURE = [SWITCH]
    base.FLOOR_Z = {"bath": 0.0, "porch": 0.0}
    base.CUT_HEIGHTS = {0: 1.6}
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


class InteractionCheckTest(unittest.TestCase):
    """Interaction spec §3.1: in a layout with ROOM_LABELS every lit room gets a labelled light:<room> group, every
    light finds its room and group ids are well formed. Layouts without ROOM_LABELS are not interactive."""

    def test_a_lit_interactive_layout_is_clean(self):
        self.assertEqual(layout_check.check(interactive()), [])

    def test_a_lit_room_needs_a_label_for_its_light_group(self):
        problem = "room 'bath' has lights but no label in ROOM_LABELS for its light:bath group"
        self.assertEqual(layout_check.check(interactive(ROOM_LABELS={"porch": "hiên"})), [problem])
        self.assertEqual(layout_check.check(interactive(ROOM_LABELS={"bath": " ", "porch": "hiên"})), [problem])

    def test_an_unlit_room_needs_no_label(self):
        self.assertEqual(layout_check.check(interactive(ROOM_LABELS={"bath": "phòng tắm"})), [])

    def test_lamps_and_point_lights_light_their_room_too(self):
        lamp = [SWITCH, ("floor_lamp", "Lamp", "porch", (2.0, 0.0), 0)]
        switch = ("light_switch", "Switch_porch", "porch", (3.99, 1.0), 270)
        self.assertEqual(layout_check.check(interactive(FURNITURE=lamp, ROOM_LABELS={"bath": "phòng tắm"})),
                         ["room 'porch' has lights but no label in ROOM_LABELS for its light:porch group",
                          "room 'porch' has lights but no light_switch for its light:porch group"])
        self.assertEqual(layout_check.check(interactive(FURNITURE=[*lamp, switch])), [])
        light = [{"name": "L_porch", "level": 0, "pos": (2.0, 0.0, 2.5), "energy": 10.0}]
        self.assertEqual(layout_check.check(interactive(POINT_LIGHTS=light, FURNITURE=[SWITCH, switch])), [])

    def test_every_light_must_be_in_a_room_of_its_level(self):
        light = [{"name": "L_out", "level": 0, "pos": (4.5, 0.0, 2.5), "energy": 10.0}]
        self.assertEqual(layout_check.check(interactive(POINT_LIGHTS=light)), ["L_out at (4.5, 0) is in no room on level 0"])
        self.assertEqual(layout_check.check(interactive(points=[(-3.0, 0.0), (-1.0, 0.0), (4.5, 1.0)])),
                         ["LT_down at (4.5, 1) is in no room on level 0"])

    def test_group_ids_must_be_well_formed(self):
        tv = [SWITCH, ("tv_cabinet", "TV bath", "bath", (-2.0, -2.0), 0)]
        self.assertEqual(layout_check.check(interactive(FURNITURE=tv)),
                         ["TV bath: group 'tv:TV bath' must match ^[a-z]+(:[A-Za-z0-9_]+)?$"])

    def test_layouts_without_room_labels_are_not_checked_for_interaction(self):
        light = [{"name": "L_out", "level": 0, "pos": (4.5, 0.0, 2.5), "energy": 10.0}]
        self.assertEqual(layout_check.check(lit([(-3.0, 0.0), (-1.0, 0.0)])), [])
        self.assertEqual(layout_check.check(layout(POINT_LIGHTS=light)), [])

    def test_the_shipped_house_is_interactive(self):
        self.assertTrue(house_layout.ROOM_LABELS)
        self.assertEqual(layout_check.check(house_layout), [])


class LightSwitchCheckTest(unittest.TestCase):
    """Every light group needs a target that stays in reach under the dollhouse cut (interaction spec §2, §3.1): the
    wall switch of its room, inside it, below the cut of its level and not hidden behind tall furniture."""

    def test_a_lit_room_without_a_switch_is_reported(self):
        self.assertEqual(layout_check.check(interactive(FURNITURE=[])),
                         ["room 'bath' has lights but no light_switch for its light:bath group"])

    def test_a_switch_in_another_room_does_not_count(self):
        elsewhere = ("light_switch", "Switch_porch", "porch", (3.99, 0.0), 270)
        problems = layout_check.check(interactive(FURNITURE=[elsewhere]))
        self.assertEqual(problems, ["room 'bath' has lights but no light_switch for its light:bath group",
                                    "Switch_porch (light_switch) is in room 'porch', which has no lights"])

    def test_a_switch_has_to_stay_inside_its_room_like_any_piece(self):
        outside = ("light_switch", "Switch_bath", "bath", (-4.2, 0.0), 90)
        self.assertEqual(layout_check.check(interactive(FURNITURE=[outside])),
                         ["Switch_bath (light_switch) sticks out of room 'bath'"])

    def test_a_switch_must_end_below_the_cut_of_its_level(self):
        # 1.15 + 0.12 = 1.27 m over the floor: a floor 0.4 m up leaves it over a 1.6 m cut
        problems = layout_check.check(interactive(FLOOR_Z={"bath": 0.4, "porch": 0.4}))
        self.assertEqual(problems, ["Switch_bath (light_switch) ends at 1.67 m, over the 1.6 m cut of level 0: "
                                    "the room's light could not be switched while the cut hides its ceiling"])
        self.assertEqual(layout_check.check(interactive(FLOOR_Z={"bath": 0.3, "porch": 0.3})), [])
        self.assertEqual(layout_check.check(interactive(CUT_HEIGHTS={1: 0.5})), [])  # a layout names the cuts it has

    def test_a_layout_without_cut_heights_is_not_checked_for_them(self):
        base = interactive(FLOOR_Z={"bath": 5.0, "porch": 5.0})
        del base.CUT_HEIGHTS
        self.assertEqual(layout_check.check(base), [])

    def test_tall_furniture_in_front_of_a_switch_hides_it(self):
        # facing +X from x = -3.99: a wardrobe (2.3 m) 0.1 m in front, a bed (1.1 m: under the switch) does not
        wardrobe = ("wardrobe", "Wardrobe", "bath", (-3.6, 0.0), 270)
        self.assertEqual(layout_check.check(interactive(FURNITURE=[SWITCH, wardrobe])),
                         ["Switch_bath (light_switch) is hidden behind Wardrobe (wardrobe)"])
        bed = ("bed_double", "Bed", "bath", (-2.8, 0.0), 270)
        self.assertEqual(layout_check.check(interactive(FURNITURE=[SWITCH, bed])), [])
        far = ("wardrobe", "Wardrobe", "bath", (-2.0, 0.0), 270)  # beyond the 0.3 m the switch is reached from
        self.assertEqual(layout_check.check(interactive(FURNITURE=[SWITCH, far])), [])

    def test_furniture_on_another_level_hides_nothing(self):
        up = {"name": "attic", "level": 1, "min": (-4.0, -3.0), "max": (4.0, 3.0)}
        wardrobe = ("wardrobe", "Wardrobe", "attic", (-3.6, 0.0), 270)
        self.assertEqual(layout_check.check(interactive(FURNITURE=[SWITCH, wardrobe], ROOMS=[*lit([]).ROOMS, up],
                                                        ROOM_LABELS={"bath": "a", "porch": "b", "attic": "c"})), [])

    def test_every_lit_room_of_the_shipped_house_has_a_switch_under_the_cut_of_its_level(self):
        floors = {room["name"]: room for room in house_layout.ROOMS}
        for room in interact.lit_rooms(house_layout):
            switches = [entry for entry in house_layout.FURNITURE if entry[0] == "light_switch" and entry[2] == room]
            self.assertTrue(switches, room)
            level = floors[room]["level"]
            top = house_layout.FLOOR_Z[room] + WALL_MOUNTED["light_switch"] + FURNITURE["light_switch"][2]
            self.assertLess(top, house_layout.CUT_HEIGHTS[level], room)
        self.assertEqual(house_layout.CUT_HEIGHTS, {0: 2.05, 1: 6.86})  # PLINTH / UPPER_FLOOR + 1.6 m, as cutaway.ts


if __name__ == "__main__":
    unittest.main()

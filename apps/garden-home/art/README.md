# Garden Home: the art side

The Blender modules, their generators and the pipeline that turns them into the glTF files the page
loads. What the visitor can do with the result (controls, the dollhouse cut, the floor buttons,
click toggles, the URL parameters, the wallpaper) is in [`../AGENTS.md`](../AGENTS.md), together
with the module contract and the `interact` / `label` / `clip` / `uncut` / `cut_top` data the page
reads. This file is the per-module reference: how each part of the island is generated, what to
change where, and the performance it was built to.

Conventions used below:

- Paths starting `art/`, `src/`, `public/` or `e2e/` are relative to `apps/garden-home`. A bare
  path such as `houses/interact.py` or `archkit/catalog.py` is relative to
  `art/blender/scripts/`.
- Distances are metres, the front of the house faces −Y, and Blender's Z is glTF's Y.
- Commands are `pnpm --filter @ncam/garden-home <script>`, run from anywhere in the monorepo;
  commands that call Blender by hand run from `apps/garden-home`.
- The performance numbers (draw calls, triangles, milliseconds per frame) were measured in the
  standalone project, with its `shoot --stats` screenshot script (not carried over), on SwiftShader
  with `?bg=example.jpg`. Read them as the budget each module was built to, and re-measure with
  `?debug=1` or the browser's tools after a big change.

## Prerequisites

- **Blender 5.2.2 LTS** at `/Applications/Blender.app` (any other path: set `BLENDER_BIN`).
- **KTX-Software ≥ 4.4.0** (tested with v4.4.2): <https://github.com/KhronosGroup/KTX-Software/releases>.
- Node 22 and pnpm (`pnpm install` at the monorepo root), and `python3` for the unit tests.
- Playwright's Chromium for `e2e` and `capture:poster`:
  `pnpm --filter @ncam/garden-home exec playwright install chromium`.

## Commands

| Command                                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `art:models [--force] [--only <step>…]` | Generates `house.blend`, `pool.blend`, the five garden modules, the koi pond and tea garden, the carport and kennel, the basement, the interior, and the yard and site placeholders. It keeps existing files unless `--force`. `--only` runs just the named steps: `house`, `pool`, `fence`, `garden_paths`, `flower_beds`, `veg_garden`, `bbq_area`, `koi_pond`, `tea_garden`, `carport`, `kennel`, `basement`, `interior`, `yard`, `site`, `broken`. |
| `art:assets -- --check`                 | Checks the modules against the contract and writes nothing.                                                                                                                                                                                                                                                                                                                                                                                            |
| `art:assets`                            | Blender → `public/assets` (GLB `high` and `medium` tiers per module, plus `scene.json`).                                                                                                                                                                                                                                                                                                                                                               |
| `dev`                                   | The dev server on :9010: `/` and `/wallpaper`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `test:art`                              | The Blender (Python) tests and the pipeline's tests. It rewrites `public/assets`.                                                                                                                                                                                                                                                                                                                                                                      |
| `e2e`                                   | Playwright, on the production preview: smoke, day and night, fallbacks, orbiting, the background photo, alignment, the dollhouse cut, clicking things in the house, the garden and the barbecue, the koi pond (waterfall, feeding the fish), the carport (car lights), the Akita pup and the tall house (crystal chandelier, air conditioners).                                                                                                        |
| `capture:poster`                        | Captures the poster the page shows before the scene boots (`src/assets/poster`).                                                                                                                                                                                                                                                                                                                                                                       |

`site.blend` holds hand-placed instances of every module, so **leave `site` out of `--only` and
never run `art:models --force` bare** (it regenerates every generated file, `site.blend` included,
and with it the positions placed by hand). The `--force --only …` examples below therefore list
the modules and `yard` only.

## Adding or replacing a module

1. Create `art/blender/modules/<id>.blend` with one top-level collection named `<id>` and the
   custom props `footprint: [w, d]` and `role: "hero" | "prop"`.
2. Follow the contract (`art/blender/scripts/contract.py`, summarised in `../AGENTS.md`): apply
   scale, `ambient_*` / `act_*` clips, `HS_*` hotspots, `WATER_*` water meshes, the `night_light`
   prop, the `wind` colour attribute.
3. Open `art/blender/site.blend` → File → Link → `<id>.blend` → Collection `<id>`, and place the
   instance.
4. Run `art:assets`. A contract failure names the module and the rule in the terminal.

Who generates what. `yard` is a placeholder made by `dev/make_placeholders.py` (the old placeholder
pond gave way to the koi pond); `house` and `pool` by `houses/build_house.py` and
`houses/build_pool.py`; the five garden modules by `garden/build_*.py`, the koi pond and tea garden
by `pond/build_*.py`, the carport and kennel by `carport/build_*.py`, the basement by
`basement/build_basement.py` and the curtains and accessories in the house by
`interior/build_interior.py`. One section for each follows.

## Glass villa: generation and tuning

- The house's layout (the tall house, 23 × 15 m on both storeys) is plain data in
  `houses/house_parts/`: `common.py` (heights, axes, the double-height void `VOID`), `shell.py`
  (structure, glass, partitions, frosted panes, doors, the stair's opening through the floors),
  `ground.py`, `upper.py` and `roof.py` (rooms, furniture, lights, hot tub, grape trellis, stair
  pavilion, condensers). `houses/house_layout.py` gathers them. The pool is in `pool_layout.py`.
- **The tall house with a double-height living room:**
  - Heights: the plinth is still 0.45 m and every storey above it is 30 % taller
    (`common.HEIGHT_SCALE`): ground ceiling 4.87, upper floor 5.26, upper ceiling 9.29, roof 9.68,
    door head 3.57 m. Each storey is 4.81 m floor to floor, 4.4 and 4.0 m clear. The site route's
    cuts are at 2.05 and 6.86 m.
  - Plan 23 × 15 m: zone `house` (−13, 2) to (10, 17), slot (−1.5, 9.5). The front (y = 2), the east
    wall (x = 10, 2 m from the carport) and the front door (x 6.1, at the end of the stone walk)
    kept their places in the yard; the bigger house grows 3 m to the left and 2 m to the back. The
    two trees behind the house moved to y 19.5 and the flower beds' "behind the pool" palm to
    (−14, 2.6).
  - The double-height living room at the front left: the void `VOID`, 7.84 × 7 m, has no upper
    floor (the cantilever included), and its front and west flank are one glass wall from the
    plinth to the upper ceiling (6 and 5 panes, continuous mullions). The TV stands on its own wall,
    the L-shaped sofa has its back to the west glass, and a reading corner sits under the gallery at
    the back. Upper floor: the `gallery` hallway runs along the back edge of the void behind a
    glass balustrade; bedroom 2 and the master bedroom face the front; the wardrobe and master
    bathroom are behind the master (frosted glass on the east side, seen over the stone block's
    roof); bedroom 3 has a glass window in its west wall; the shared bathroom has frosted glass in
    its back wall; the `gaming` computer corner opens onto the hallway; the balcony projects from
    x −2.8 (so the chandelier is seen from the front right). The 20 × 14.5 m roof terrace keeps its
    old layout.
  - The spiral stair (`spiral_stair`, `archkit/spiral.py` and `archkit/furniture/stairs.py`): a
    steel column, 25 open teak treads (19 cm, 18° each, one turn and a quarter) and a spiral
    handrail, at the back left corner of the void with its centre on the hallway's edge. The upper
    landing is the back-right quarter and the back-left quarter is the opening in the floor. It
    goes on up to the roof (option `upper`, 23 treads, same column): the roof slab has an opening
    except for the landing, and the stair comes out in the **stair pavilion** `stair_pavilion` by
    the west balustrade. The pavilion has solid white walls to the west and back (so there are no
    two layers behind the glass balustrade), glass to the east and on the right half of the front
    between teak posts, a 1.2 m door in the left half of the front under a teak lintel, and a thin
    10 cm white slab roof overhanging 20 cm to the front and east (`catalog.STAIR_PAVILION`). Its
    2.6 × 2.6 m walls enclose the stair and its 2.8 × 2.8 × 2.4 m roof is in the catalog, so the
    pavilion stands 0.1 m off the stair's centre, to the east and to the front. The cabana bed moved
    east (x −6.2) so the two masses do not look alike. Head room is at least 2 m under every landing
    (a test).
  - The crystal chandelier (`crystal_chandelier`, `archkit/furniture/lights.py`): 2.4 × 2.4 × 2.2 m.
    Three rings of flat brass strip, 6 × 2 cm (24 segments), Ø 2.2 / 1.6 / 1.0 m; under each ring
    an open, 24-sided, pleated **crystal curtain** with a zig-zag edge 14 to 22 cm deep; in front
    of the curtain 40 / 28 / 20 strings of large crystal drops (10 × 22 cm, long and short in turn,
    180 drops); 16 / 12 / 8 candle bulbs (flame 8 × 18 cm) on the three rings and an emissive core,
    `M_led`, round the body. `M_crystal` is champagne mirror (metallic 1.0, roughness 0.04: next to
    `L_living` every diffuse part burns out to white, so at night the crystal only sparkles and
    glows warm yellow at 1.2), opaque so there is no transparent pass. It hangs from the upper
    ceiling in front of the sofa rug (−7.4, −2.8), its lowest ring 3.5 m above the floor; from
    `CAM_idle` the stair is about 8° off the line of sight instead of right behind the chandelier.
    `L_living` (160) sits inside it; 3 100 triangles, one object with three materials.
  - Air conditioning (`archkit/furniture/climate.py`): an `ac_split` hangs at 2.4 m on the partition
    in the master bedroom, bedroom 2 and bedroom 3 (the flap is a child object turning about
    `catalog.AC_FLAP_PIVOT`, clip `act_ac_<room>`; the main flap is the status light, `M_ac_light`,
    white like the body and pale green when the unit runs, so body and flap have a material each);
    an `ac_remote` beside the light switch (black glass, one material); three `ac_condenser`s (all
    grey metal, with a raised fan grille) between two `teak_screen`s along the west parapet on the
    roof, one on the deck side and one on the parapet side so they are not seen from outside through
    the glass balustrade either (merged into one `AC_condensers` object with two materials, the
    `into` option of `FURNITURE`).
  - The back: clerestory glass strips high over the kitchen run (5.2 × 1.1 m) and at the computer
    corner (3.6 × 1 m), `shell.WINDOWS` (one `GLASS_window_<name>` pane per window,
    `glazing.window`, the black frame in `Facade_details`). The way from the hall into the kitchen
    is a 1.1 m gap between the end of `Wall_kitchen_hall` and the back wall: `shell.PASSAGES`, and
    `layout_check` keeps 0.8 m free on each side as for a door.
  - Budget: the `hero` ceiling went from 40k to 50k triangles (`contract.py`); the house is 45.8k
    (at most 48k), 301 mesh objects, 4 point lights, textures still `T_stone`, `T_wood`, `T_art`.
    The light switches, air conditioners (body, flap, remote) and condensers carry
    `cast_shadow = False`.
  - Performance (`shoot --stats`, `?bg=example.jpg`, SwiftShader): 762 → 788 draw calls at 12:00 and
    768 → 794 at 21:00 (+12 for the tall house, void, stair and chandelier; +14 for the way to the
    roof, the air conditioners and the back windows); wallpaper triangles 82.9k → 89.5k; the site
    route (7 interleaved rounds, load 7) 46.6 ms (main) → 51.2 ms per frame, draw calls
    1 283 → 1 278 (the last fix changed nothing: 51.2 → 50.8 ms).
- The 48 × 40 m yard is in `siteplan/zones.py`: the zones (house, pool, pond, carport, driveway,
  barbecue, vegetable garden, kennel, stone walk…), the module slots, the trees, lamp posts and
  cameras. The yard stands on a floating island (`zones.ISLAND`, rim in `siteplan/island.py`): a
  flat grass top at z = 0, a seeded super-elliptical rim 54 × 46 m, a grass lip, a layer of earth
  and a low-poly rock underside tapering to a point 15.5 m below (darker towards the point, with a
  few light faces), a few hanging rocks, roots and small tufts and stones along the rim. The `yard`
  module's footprint is the island's bounding size. `make_placeholders.py` runs `zones_check` first
  and stops with `ZONES: …` if zones overlap, a slot lies outside its zone, or a zone, tree or lamp
  post lies outside the island's rim (also for a differently sized island, `--yard-size W D`). The
  house and pool slots take their footprints from the modules themselves (`common.py`,
  `pool_layout.py`).
- The builders are in `archkit/`. Furniture: sizes in `archkit/catalog.py`, builders split by area
  in `archkit/furniture/` (living, dining_kitchen, bedroom, office, bath, outdoor, decor, tropical,
  stairs, lights, climate). Paintings take a `variant` option 0 to 7 (one cell of the `T_art`
  atlas).
- Tropical resort decoration (`archkit/furniture/tropical.py`): the plants `palm_tall`,
  `palm_small`, `monstera`, `bird_of_paradise`, `fern_hanging` (hanging) and `plant_wall`; rattan,
  teak and linen furniture `rattan_armchair`, `egg_chair`, `daybed_cabana`, `teak_lounger` and
  `outdoor_bar`; the lights `rattan_pendant` (hanging) and `lantern` (both glow, `night_light`).
  Materials: travertine `M_stone`, `M_teak`, `M_rattan`, `M_linen`, `M_terracotta`, `M_leaf_dark`.
  - Outdoor plants take the option `{"wind": True}` (only `palm_tall`, `palm_small`, `monstera`,
    `bird_of_paradise` and `fern_hanging`): the object is painted with the `wind` colour attribute
    from the pot to the tip, so the runtime sways the leaves. Indoor plants keep the default (no
    wind). Any other piece given `wind` raises `TypeError`.
  - Ceiling-hung pieces (`rattan_pendant`, `fern_hanging`, `crystal_chandelier`) hang at
    `WALL_MOUNTED`; where the ceiling is higher, add the option `cord` (extra cord length, m): the
    house layout uses `common.hang(kind, level, point)` so the cord reaches the ceiling exactly
    there (in the void that is the upper ceiling, `common.ceiling_over`).
  - `lighting.string_lights(col, name, points, mats, bulbs_per_m, sag, bulb_radius)`: one
    `night_light` string-light object through the anchor points (x, y, z), sagging by `sag` × the
    length of each span (0 = taut). The house uses 12 cm round bulbs (`bulb_radius=0.06`) because
    smaller ones are not visible from the wallpaper camera. In the layout: `roof.STRING_LIGHTS` (a
    zig-zag under the grape trellis and along the front roof railing).
  - Water: `water.reflecting_pool(...)` (a shallow pool with a travertine rim, `WATER_<name>`,
    stepping stones `<name>_steps`) and `water.wall_fountain(...)` (the water wall: a vertical
    `WATER_<name>_sheet`, `WATER_<name>` in the trough, an LED `LT_<name>`). In the layout:
    `ground.REFLECTING_POOLS` (along the porch, a column standing in the water) and
    `ground.WALL_FOUNTAINS` (beside the front door). `layout_check` checks the string-light
    anchors, pools and fountains lie inside the footprint and that no piece stands in a pool. The
    runtime's water shader gives a vertical face (steeper than 60°) streaks of running water
    instead of surface ripples.
- Edit the layout, regenerate that module, then run `art:assets`. The house:
  `"${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup --python-exit-code 1 -P art/blender/scripts/houses/build_house.py -- --force`
  (from `apps/garden-home`); the pool: the same with `build_pool.py`. `layout_check` reports
  furniture outside its room or overlapping before the script builds anything in Blender.
- `art:models --force` overwrites **every** generated file: `house.blend`, `pool.blend`, the five
  garden modules, `koi_pond.blend`, `tea_garden.blend`, `yard.blend`, `site.blend` (and with it
  every hand-placed instance) and the fixture. Use it only when no file has been edited by hand;
  to regenerate a few files add `--only` (for example
  `art:models --force --only bbq_area yard`).
- To tune by hand, open `art/blender/modules/house.blend` and edit materials and details. From then
  on do not run `--force` again: the `.blend` is the source. `art:assets` still checks the contract.
- Conventions for hand edits:
  - Glass uses `GLASS_*` materials: alpha 0.1 to 0.5, roughness ≤ 0.1, one object per pane (except
    the sliding door `Door_main`).
  - Frosted glass (bathroom, WC) uses `FROSTED_*`: alpha 0.4 to 0.85, roughness 0.3 to 0.8. Every
    frosted pane must carry `night_light = True`: its weak emission is multiplied by the night
    factor, and without the prop the pane glows in daylight.
  - Lights are Point or Spot with the custom prop `night_light = True`, at most 4 for the house
    (`hero`) and 2 for the pool (`prop`). The intensity (W) goes straight into three.js.
    Triangle ceilings: `hero` 50k (the tall house), `prop` 15k.
  - Every object with an emissive material (the `M_led` LEDs, the `M_rgb` strip, the
    `M_screen_on` screens, the `FROSTED_*` panes…) must carry `night_light = True`, or it glows by
    day. `test_villa_modules.py` checks this on the house and pool exports.

## Garden

The garden: a fence and gates, a stone walk and garden lamps, flower beds, a vegetable garden, an
outdoor dining and barbecue area, in the house's resort style (travertine, teak, rattan,
terracotta, palms), low-poly. The code is in `garden/`, built like `houses/`: each module has a
plain-data layout (`*_layout.py`) and a generator (`build_*.py`); `garden/layout_check.py` checks
before building and, on an error, prints `LAYOUT <module>: …` and exits 1.

- **`fence`** (slot `fence_01`, the whole island): a travertine post at every vertex of the island's
  rim (set back 0.45 m) and three teak rails between posts; a pedestrian gate at the main walk
  (x 0) and a car gate at the driveway (x 17), each with two travertine gate posts topped by a
  lantern (glowing core 32 cm high) and two closed teak-slat leaves; under each lantern half a pool
  of light (radius 1.1 m) facing inwards.
- **`garden_paths`** (`garden_paths_01`, the whole island): 34 travertine slabs a step apart (square
  landings at the two turns) from inside the main gate along `path_gate` → `path_turn` →
  `path_door` to the foot of the door step; a travertine driveway between two grey kerbs (sharing
  no face, so no z-fighting) from inside the car gate to the carport zone, its last 2.4 m
  flaring out into a parking apron (`APRON`, from x 15–19 to 12.4–19.8) for both carport bays,
  with the kerb running diagonally and meeting the straight kerb in a mitre; 15 low lamp posts
  (`garden_lamp`, light head 29 cm high) along both routes, each with a round 1.6 m pool of light on
  the lawn; a few pebbles.
- **`flower_beds`** (`flower_beds_01`, the whole island): travertine-edged beds (pink, yellow, red
  and white flowers) joined end to end into two strips: one of four beds on each side of the stone
  walk from the main gate, and one of four along the south edge of the pond zone (the koi pond's,
  below), branching off the right-hand strip; cone-trimmed topiary at the gate end of a
  strip, round at the other; terracotta flower pots at the door step, palms at both gates, behind
  the pool and by the driveway; every plant sways (12 beds, 25 pieces, 9.4k triangles).
- **`veg_garden`** (`veg_garden_01`, zone `vegetables`): a gravel yard edged with teak; six raised
  wooden beds (lettuce, cabbage, carrots, herbs) on both sides of a gravel path, a bamboo-stake
  tomato trellis, a compost bin, a terracotta-roofed tool shed, a wheelbarrow and a watering can.
  The front-left corner (0.6 m from the island's rim, the fence running just outside) is gravel
  only.
- **`bbq_area`** (`bbq_area_01`, zone `bbq`): a travertine terrace; a teak pergola over a
  six-seat dining table with a zig-zag of string lights under it (9 cm round bulbs); an outdoor
  kitchen counter along the east edge, the charcoal grill just in front of it and set well back into
  the terrace so the pool's deck hides it less (nothing tall hides it from the wallpaper camera),
  a parasol over two rattan chairs, and planters at the corners.

Notes:

- **The three whole-island modules** (slots with `zone = "island"`, `siteplan.island.ISLAND_WIDE`)
  stand at the island's centre, unrotated, with a footprint equal to the island's bounding size;
  their coordinates are yard coordinates. `zones_check` enforces exactly that (position (0, 0),
  yaw 0, footprint `zones.ISLAND["size"]`, also when `--yard-size` builds a different island).
  `garden/layout_check.py` checks the content: inside the island's rim, not over any zone other
  than the ones the module uses (`ZONES_USED`: the stone walk uses `path_*` and `driveway`; the
  house, pool, vegetable garden, barbecue and the zones of the modules below, `pond`, `tea`,
  `carport` and `kennel`, are all off limits), at least 0.35 m from the yard's tree trunks and lamp
  posts. `check_island` checks the three modules against each other: no piece of one over a piece
  of another, and every gate leads to a stone walk or driveway of the right kind. The stone walk
  must be continuous (grass gaps ≤ 0.45 m, the first slab right at the gate, the last touching the
  door step) and the driveway starts at the car gate and runs to the carport zone. The vegetable
  garden and barbecue are ordinary modules inside their zones (module coordinates, front −Y). A
  parasol is allowed over the pieces below it; a piece standing on the floor (gravel, paving,
  z < 0.3 m) still counts as on the ground, a piece placed on another (a lamp on a post) does not.
- **Performance:** each module merges the pieces of one group into **one object** (`PIECES`:
  `(kind, group, position, rotation[, option])`): `furniture.place_into` builds the piece into a
  shared mesh and `MeshBuilder.placed` paints `wind` per piece, so each material is one draw call
  however many hundred pieces there are. `shoot --stats` at 12:00 (SwiftShader,
  `?bg=example.jpg`): 642 → 696 draw calls (+54, budget +120; 21:00 adds 2 for the pools of light:
  698), 44.6k → 70.3k triangles (fence 5.0k, stone walk 3.2k, flower beds 9.4k, vegetable garden
  4.6k, barbecue 3.6k). No point lights: the garden lights are emissive `night_light`s that glow
  with the night. Flat or small objects carry `cast_shadow = False` (`Paving`, `Flower_beds` and
  `Veg_beds` through the layout's `SHADOWLESS`, and the yard's `Rim_tufts`): `prepareModule` keeps
  them out of the shadow pass (they still receive shadows), which saves the site route about 16k
  triangles and 20 draw calls in that pass.
- **Pools of light.** From the wallpaper camera a lamp head is 1 to 2 px; what reads at 21:00 is the
  lawn it lights. Each lamp has a flat `GLOW_pool` disc 2.5 cm high (`MeshBuilder.disc`, UV running
  from 0 at the centre to 1 at the rim; `garden/lights.py`, the layout lists them in `POOLS`,
  `assemble.pieces` merges them into the lamp's object). The page draws `GLOW_*` additively (no depth
  write, one pass, no shadows cast or received), fading towards the rim by `(1 − u²)²` through a
  32 × 1 alpha map made at run time (the module carries no texture) with the opacity following the
  night factor like any other emissive (the `lights:garden` toggle overrides it), and hides it
  altogether by day so it costs no draw call (+2 at night). Contract: `GLOW_*` must emit, have a
  black base colour, and every object using it must be `night_light`.
- **Clicking on the page:** the group `lights:garden` ("Garden lights": the objects
  `Garden_lamps`, `Gate_lamps` and `String_lights_bbq`, three modules in one group, the pools of
  light following the same group) and `bbq` ("Barbecue": `BBQ_grill`, whose body casts shadows like
  any piece, and `BBQ_coals`, the `M_ember` coals, their own `night_light`: they glow when switched
  on, by day too, and follow the night while automatic). The labels are in `garden/interact.py`.
- **Regenerate** just the garden (not the house or pool):
  `art:models --force --only fence garden_paths flower_beds veg_garden bbq_area yard`, then
  `art:assets`. `yard` is in the list because the grass and rocks of the island's rim
  (`siteplan/rim.py`) avoid the fence, posts and whole-island pieces: change the garden's layout
  without regenerating `yard` and old rocks may lie on top of it. `--only` without names is an
  error, not a silent no-op. One module:
  `"${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup --python-exit-code 1 -P art/blender/scripts/garden/build_fence.py -- --force`
  (likewise `build_paths.py`, `build_beds.py`, `build_veg.py`, `build_bbq.py`). Regenerating twice
  gives byte-identical GLBs.
- **New catalog pieces** (`archkit/furniture/garden.py`): `flower_bed` and `flower_pot` (option
  `variant` 0 to 3: the flower colour set), `topiary_ball`, `topiary_cone`, `raised_bed` (option
  `crop`: `lettuce`, `cabbage`, `carrot`, `herbs`), `tomato_trellis`, `wheelbarrow`,
  `watering_can`, `compost_bin`, `tool_shed`, `bbq_grill`, `bbq_coals` (emissive, on the firebox
  mouth, `GRILL_COALS_Z` = 0.86 m), `outdoor_kitchen`, `dining_set_6`, `parasol` and `pillar_lamp`
  (emissive). Plants and beds take `{"wind": True}`. New materials: `M_flower_pink`,
  `M_flower_yellow`, `M_flower_red` (the ripe tomatoes too), `M_flower_white`, `M_cabbage`,
  `M_gravel` (warm grey 0.42, 0.39, 0.34: lighter and it reads as white concrete at noon),
  `M_pebble`, `M_ember` and `GLOW_pool`.
- **The island's rim:** the yard's grass tufts and small stones (`Rim_tufts`) are placed by
  `siteplan/rim.py` along the fence line of the island as built: grass in a strip 0.05 to 0.25 m
  outside the fence (the grass roots too, 0.05 m clear of the post caps, leaning outwards, none at
  the gates), stones inside the fence at least 0.8 m from it and clear of the zones, garden pieces
  and tree roots by their own size; they used to poke through the fence.

## Koi pond

A big pond dug into the lawn, a rockery with a waterfall, many koi, lily pads and lotus flowers;
beside it a tea corner with a table and stools of stone, a tea set, bonsai and a stone lantern;
low-poly, in the same resort style. The code is in `pond/`, built like `garden/` (sharing
`garden/assemble.py`): `koi_layout.py` and `tea_layout.py` (plain data), `basin.py` (the pond's
shape: rim, bank, depth), `swim.py` (the fish's swimming paths), `layout_check.py` (on an error it
prints `LAYOUT <module>: …` and exits 1), `interact.py`, `build_koi.py` and `build_tea.py`.

- **`koi_pond`** (slot `koi_pond_01`, zone `pond`, 11 × 8 m, yaw 0): a pond about 9.3 × 6.1 m whose
  rim is a soft, irregular round shape (an ellipse bent by four harmonics, 56 points). The `yard`'s
  lawn has a hole of exactly that outline, and the bank is tucked 1.2 cm under the grass so there is
  no gap. The bank slopes: a strip of green grass down to the water's edge, then mud, then a dark
  floor 0.65 m deep in the middle; the water surface is 7 cm below the grass. 31 grey stones along
  the edge, leaving four grass stretches that touch the water, and a few pebbles. The rockery at
  the north-west corner: four grey limestone peaks (`rock_peak`, the tallest 2.2 m, two of them
  standing in the water) built with truncated tips rather than needle points, three moss tufts on
  each peak, seven shrubs on the rock ledges (four on the tallest peak, one on a tip), and a waterfall
  falling from the tallest peak into the pond (facing the wallpaper camera) with white foam at its
  foot; at night the waterfall and foam soften like water under the moon. 14 koi (orange,
  white-and-orange kohaku, black-and-orange, gold) swim five loops at three depths; 13 lily pads
  (two greens), 5 flowers (pink, white) and 2 buds in three clusters drift a little in the wind.
- **`tea_garden`** (slot `tea_garden_01`, zone `tea`, 6 × 3.5 m): a round travertine paved area, a
  round granite stone table with an earthenware pot and four cups on a teak tray, four stone
  stools; three bonsai (two on stone pedestals, one in a jade-glazed pot); a stone lantern (in the
  garden lights group) with a 1 m pool of light after dark; two stepping stones from the paving up
  to the stone walk's landing at the turn towards the door.
- **The `tea` zone** now stretches to y −3.0 (touching the `path_turn` zone), so the stepping
  stones reach the stone walk with grass gaps ≤ 0.45 m as the walk itself does; the two pebbles of
  `garden_paths` there moved aside.
- **Checks** (`pond/layout_check.py`):
  - the pond's rim is star-shaped about its centre, at least 0.5 m inside the footprint; the
    rockery stands on the bank, at least one peak is in the water, and the waterfall falls from
    the tallest peak into the water;
  - every fish (nose and tail) is at least 0.3 m from the bank and the rockery, its floor at least
    5 cm under its belly, its dorsal fin at least 2.5 cm under the water; two fish at the same depth
    do not swim through each other (fish on the same loop are compared over a whole loop, their
    distance repeats each loop; fish on two different loops are compared path to path, so two loops
    at one depth must not cross even out of step);
  - feeding: wherever the food falls in the feeding disc (`FEEDING`, centre (0.21, −0.31) in the
    middle of the school, radius 1.2 m), every fish, on the straight line from its swimming loop to
    the loop round the food (the shader's formula copied in `swim.fed_position`), stays at least
    half a body (0.24 m) from the standing rock peaks and 5 cm above the floor under its belly (the
    floor is measured further than half a body towards the bank; just under the nose and tail, when
    leaving the food in the shallows, it is really about 4 cm);
  - the reach of a rock peak (`peak_reach`) is its widest foot ring, the larger radius ×
    (1 + `catalog.ROCK_PEAK_JITTER` 0.22), and the kit's test measures that it covers every mesh
    vertex of the peak;
  - lily pads float in the water 0.1 m from the edge, do not overlap, and keep off the rockery
    and the waterfall foam; flowers grow in the middle of a cluster of pads; the garden's beds, stone
    walk and lamp posts are at least 0.3 m from the pond. The tea corner uses the rules of
    `garden/layout_check.py` (no overlaps, inside the footprint) plus the stepping stones joining
    the paving to the stone walk without lying on any slab of it.
- **The fish swim in a shader:** the 14 are **one object** `Koi` (four materials, four draw calls),
  built where each fish's swimming loop starts. The object carries the custom props `koi` (12
  numbers per fish: centre, radius, tilt, depth, angular speed, phase, figure-eight, bobbing:
  `swim.pack`), `koi_water` and `koi_feed` (the feeding disc: x, y, radius); a second UV map `koi`
  numbers each fish. The vertex shader on the page (`src/systems/koi.ts`) recomputes `swim.py`'s
  formula, brings each fish into its own frame, wags its tail (on its own clock `mod(uTime, 2π/6)`,
  wrapping after a whole beat so nothing jerks at the end of a loop) and puts it back where its
  loop has it for the current time. The fish are drawn after the water surface (transparent,
  `renderOrder` 1, one pass) and fade towards the water colour with depth, so from the wallpaper
  camera you still see orange dots in the dark green pond (behind the old shader's 0.7 water layer
  the fish were only a brown smear). One object per fish with `ambient_*` clips would cost about 29
  draw calls instead of 4.
- **The pond water** carries `water = "pond"`: the page draws it in the pond style
  (`WATER_STYLES.pond` in `src/systems/water.ts`: deep green, gently rippled, whiter waterfall; at
  night the waterfall's white is a quarter of its day value and the dark `*_foam` foam is 0.45 by
  `uNight` (`FALL_NIGHT`), so the waterfall reads as water under the moon and not a bright sheet on
  dark rock); the pool, hot tubs, water wall and showers keep the old style.
- **Clicking on the page:** `waterfall` ("Waterfall": `Rockery`, `WATER_waterfall_sheet`,
  `Waterfall_foam`; running while automatic like the water wall, a click turns it off and on),
  `koi` ("Feed the koi": `WATER_surface`; click a point on the pond and the food falls exactly
  there, or on the edge of the feeding disc if you click outside it; the fish arrive within 3 s,
  form two loops round it and disperse to their loops after 9 to 13 s; click again while they are
  feeding and the centre of the two loops glides to the new place over 1 s, the fish keeping the
  same "hunger" they had (none snaps back to its loop) and staying as long as the first time; the
  fish do not block the click) and the stone lantern in `lights:garden`.
- **Performance** (`shoot --stats` at 12:00, `?bg=example.jpg`, SwiftShader): 696 → 727 draw calls
  (21:00: 698 → 730; the last fix added none), 70.3k → 77.3k triangles; `koi_pond` 5.7k triangles
  (23 primitives; the truncated peaks, moss and two shrubs added 320), `tea_garden` 1.6k (14; the
  pool of light is drawn only at night). Site route: each frame 43–44 → 44.5–46 ms (interleaved
  against the version before the pond, the pond version before the last fix, and after it; noise
  ±1.5 ms; the last fix 0 to +1.2 ms). No point lights. The bank, rim stones, foam, fish, lotus
  and bonsai cast no shadows (`cast_shadow = False`); the rockery and the stone table and stools do.
- **New catalog pieces** (`archkit/furniture/pond.py`): `stone_table_round`, `stone_stool`,
  `tea_set`, `bonsai` (`variant` 0 stone pedestal, 1 glazed pot, 2 leaning shape), `stone_lantern`
  (emissive), `lotus_pad` (`variant` 0 to 3: four sizes, two greens, notched), `lotus_flower`
  (`variant` 0 pink, 1 white, 2 bud), `koi` (`variant` 0 orange, 1 kohaku, 2 black-and-orange,
  3 gold; nose towards −Y, tail fanned flat so it shows from above) and `rock_peak` (`variant` 0
  to 3, tall to low). `bonsai`, `lotus_pad` and `lotus_flower` take `{"wind": True}` (the lotus only
  drifts a few centimetres). `boulder()` and `shrub()` build the rim stones and the shrubs on the
  rockery. `MeshBuilder.faces(points, faces, mat)` builds an arbitrary piece of mesh. New materials
  (flat colour, no texture): `M_granite`, `M_rock`, `M_rock_light`, `M_moss`, `M_bark`, `M_glaze`,
  `M_lotus`, `M_lotus_pad`, `M_koi_orange`, `M_koi_white`, `M_koi_black`, `M_koi_gold`,
  `M_pond_bank`, `M_pond_floor` and `M_foam`.
- **Regenerate** the pond and tea corner (not the house or pool):
  `art:models --force --only koi_pond tea_garden yard`, then `art:assets` (`yard` because the hole
  in the lawn follows the pond's rim). One module:
  `"${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup --python-exit-code 1 -P art/blender/scripts/pond/build_koi.py -- --force`
  (likewise `build_tea.py`). Regenerating gives byte-identical GLBs.

## Carport and dog

A roofed two-car carport at the side of the house, at the end of the driveway, with a pickup truck
and a convertible supercar; behind it, by the fence, a dog house and an Akita pup. Everything is
built by script (no downloaded model), with generic designs: no brand names, logos or badges. The
code is in `carport/`, built like `garden/` and `pond/`: `carport_layout.py`, `kennel_layout.py`,
`layout_check.py` and `interact.py` are pure Python; `build_carport.py` and `build_kennel.py` need
bpy.

- **`carport`** (slot `carport_01`, zone `carport`, 8 × 7 m, centre (16, 6.5), yaw 0): a 4 cm
  travertine floor level with the driveway, its front edge exactly where the driveway ends (y = 3),
  where the driveway has already flared into an apron the width of both bays (`garden_paths`). A
  flat roof: a white fascia frame 0.2 m wide and 0.3 m thick round the edge, inside it a glass
  panel (`GLASS_clear`, its own object `Carport_glass`, in no click group) and teak slats hung under
  the glass (30 slats of 14 cm, running front to back) on three white cross beams. From the
  wallpaper camera the roof reads as a timber roof; from above you still see the cars through the
  slats, and the sun makes stripes on the floor and the cars. Two slim black steel posts on the side
  away from the house (east); on the house side a travertine-clad pier at the front corner and a
  travertine wall closing the back, 2 m from the house's east wall. Two bays: the pickup next to
  the house, the low red supercar on the outside, both parked nose to the driveway; a teak cabinet
  behind the pickup, a black bicycle leaning on the back wall behind the supercar. Three recessed
  lights under the beams in the aisle between the cars, each throwing a 1.1 m pool of light on the
  floor after dark.
- **`kennel`** (slot `kennel_01`, zone `kennel`, 3 × 3 m, centre (22, 12.5), yaw 0): a teak dog
  house on a dark base, a charcoal gable roof, an arched door and a plain sign over it; in front of
  the door a dark mat with the Akita sitting on it facing the lawn and the wallpaper camera (25°);
  beside the mat a water bowl and a red food bowl, a red ball on the grass, a small shrub by the
  house (it sways).
- **The cars** (`archkit/furniture/vehicles.py`; `pickup_truck` 1.9 × 5.3 × 1.85 m and
  `convertible_supercar` 2.0 × 4.5 × 1.15 m, nose towards −Y): the body is lofted along Y through
  hexagonal cross sections (straight sides, shoulder, top), the lower edge curving up into the wheel
  arches; the 12-sided wheels stand on one point, with chrome rims and black centre caps. The pickup
  is moss green (`paint_green` (0.08, 0.27, 0.15), metallic 0.15, a light metallic sheen; it used to
  be (0.06, 0.2, 0.11), metallic 0.45: a heavily metallic paint mostly reflects the dark night sky,
  so at night under the roof the truck was nearly black, and now it reads dark green): a double-cab
  with black glass under the painted roof, black B pillars, a black roof rack, an open bed with a
  black liner, a black front bumper, a chrome grille, black arch flares, running boards, a chrome
  rear bumper and tail lights standing at the bed's two corners. The red supercar: a low wedge nose,
  front wings higher than the bonnet, flanks tucked in under a character line, black air intakes on
  both sides, a folded-down roof: a raked windscreen in a black frame, a dark cockpit with two tan
  leather seats and the steering wheel on the left, two headrest fairings behind, a black front
  splitter and rear diffuser, two chrome exhaust pipes and a horizontal strip of tail lights.
  `part="body"` or `part="lights"` builds the body or the lights alone (the default builds both):
  the carport splits each car's lights into an object of their own, a `night_light` (`Pickup_lights`,
  `Supercar_lights`), with a half disc `GLOW_beam` 1.5 m in front of the nose (the headlight beam on
  the floor, driveway and lawn), `HEADLIGHT_POOL_TOP` 0.076 m high, above the driveway's kerb top
  (0.07 m): below the kerb top the kerb would cut the beam into dark stripes. The pickup is 1 238
  triangles, the supercar 1 382.
- **The Akita** (`archkit/furniture/animals.py`, `akita` 0.48 × 0.8 × 0.95 m): sitting, russet
  coat (`M_akita_red`), cream "urajiro" (`M_akita_cream`) on the muzzle, cheeks, chest, front legs
  and paws, glossy black eyes and nose (`M_dog_dark`): materials of their own rather than vertex
  colours (the export keeps only `wind`). Upright triangular ears and a big tail curled up over the
  back: an eight-sided tube swept along a Catmull-Rom curve through the `TAIL` points (two rings per
  segment, a flat root inside the rump, a closed pointed tip), with the inside of the curl a thinner
  cream tube (it used to be five tube sections joined by spheres, which read as a string of beads
  from the side). The haunches are rounder (an icosphere subdivided twice) and the hind paws sit
  under the haunch (before, they sat well forward and nearly came off the leg).
  `part="body" / "head" / "tail"` builds one part in the dog's own space; `catalog.AKITA_PIVOTS` is
  where the head turns (the neck) and the tail wags (the tail's root). In `kennel.blend` the dog is
  three objects: `Akita` (the body) with the children `Akita_head` and `Akita_tail` whose origins
  are at the pivots. 1 168 triangles (before: 1 076).
- **Clips:** `ambient_dog_breathe` (the body swells a little: 2.5 % across, 1.5 % deep, 1 % tall,
  a 3 s cycle) and `ambient_dog_tail` (a slow wag of ±9° about the body's long axis, 2 s) loop for
  ever like every `ambient_*` clip; `act_dog_happy` (2.5 s: a 10 cm hop then a 7 cm one, a ±15°
  shake, the head tilting 24° and turning 30°, the tail wagging fast ±32° for eight beats in 2 s,
  then back to rest) plays once per click. Each clip is an action with a slot for each object; the
  object's first clip is the assigned action and the others sit in NLA tracks, so glTF exports all
  three animations, keyed from frame 0.
- **On the page:** the group `dog` is a "play once" kind (`playsOnce` in `src/interact/toggles.ts`):
  a click makes `store.play(group)` count one more, and `ModuleInstance` calls `playOnce` for the
  action of the clip, converted to additive (`effects.oneShot`, `AnimationUtils.makeClipAdditive`
  on a copy of the clip), so it runs on top of the breathing and the slow wag (a fast wag over the
  slow one, the body hopping while it breathes) and returns exactly to where it was; a click while
  the clip is still running is ignored by `playOnce` (`action.isRunning()`), so the dog never
  snaps back to the start in mid-hop. The car and carport lights use the existing light group
  (`lights`): automatic follows the night, a click turns them off and on. The roof glass is an
  object of its own in no click group (`Carport_glass`), so `pick.ts` skips it like any pane that
  is not an item's own: from above, a pointer ray that passes between the slats hits a car ("Pickup
  truck lights" / "Supercar lights") and one that hits a slat is still "Carport lights" (from a
  52° high angle in the south-east about a fifth of the points on a horizontal line across a car
  fall through a gap; before, the glass was inside the `Carport` object and every ray from above
  stopped at it). The dollhouse cut never touches the carport or the dog: they are always whole
  (the e2e checks).
- **Checks** (`carport/layout_check.py`): the roof, floor, posts, pier, wall, cabinet, bicycle and
  pools of light lie inside the footprint and do not overlap; each car is of the right catalog
  kind, inside its bay, at least 0.5 m from both bay edges, touching no post, pier, wall, cabinet,
  bicycle or the other car, under the roof and at least 0.3 m under the bottom of a beam or the
  fascia; the recessed lights are under a beam inside the fascia frame, their pools on the floor;
  in yard coordinates: the carport (roof, floor, structure) is at least 1 m from the house's
  footprint, the floor's front edge coincides with the end of the driveway (the apron's top edge,
  `APRON`), covers its whole width, at the same surface height (0.04 m), the roof is at least 1.5 m
  from a tree trunk (canopy 1.2 m), the headlight beam lies inside the island, does not fall on the
  house and is higher than the kerb top. The dog's corner: the garden's rules
  (`garden/layout_check.check`: known kinds, no overlaps, inside the footprint, `wind` only on
  plants), the dog sitting on the mat (its centre over it), touching no house, bowl, ball or shrub,
  facing the lawn (−Y) and no more than 30° off the wallpaper camera (now 2°), and correct
  `ambient_*` / `act_*` clip names.
- **Performance** (`shoot --stats`, `?bg=example.jpg`, SwiftShader): 727 → 762 draw calls at 12:00
  (+35), 730 → 768 at 21:00 (+38: three pools of light drawn only at night), wallpaper triangles
  77.3k → 82.8k; `carport` 3 688 triangles (23 primitives), `kennel` 1 876 (15). Site route: the
  median of 5 interleaved rounds against the previous version (`/?t=12:00`, 40 frames after load)
  44.1 → 46.6 ms (+2.5 ms; the site route's draw calls 1 227 → 1 283). Turning off the cars' or
  the dog's shadows made no measurable difference (within ±1 ms noise), so they still cast; the
  carport floor, the mat, bowls and shrub corner cast none (`cast_shadow = False`). The last fix
  (the glass as its own object, the apron, the paint, the dog's tail and legs): draw calls stay at
  762 / 768, wallpaper triangles 82.9k / 83.2k; `carport` still 3 688 triangles in 23 primitives;
  `kennel` 1 968 (15); `garden_paths` 3 164 → 3 200 (5); site route 5 interleaved rounds against
  the previous version 48.3 → 47.5 ms (within the noise), draw calls 1 283 as before.
- **e2e** (`e2e/carport.spec.ts`): the wallpaper at 12:00 and 21:00 requires every object of the
  carport and the dog's corner (through three's devtools hook), and the middle of the `Carport` box
  on screen changes colour when the carport is hidden (measured 35.5 at 12:00, 12.7 at 21:00;
  thresholds 15 / 6), so a missing carport fails the test; clicking the pickup at night: the share
  of bright pixels around it drops and rises again, and the emissive of `Pickup_lights` goes to 0
  and comes back (the supercar's lights do not change); from a high angle over the carport, a line
  of points across each car must hit one that shows the car's name; clicking the dog: the head
  turns, then returns to rest.
- **New catalog pieces:** `pickup_truck`, `convertible_supercar` (`part`), `akita` (`part`),
  `dog_house`, `dog_mat`, `dog_bowl` (`variant` 0 water, 1 food), `dog_ball`, `bush` (`garden.py`,
  sways). Palette: `paint_green`, `paint_red`, `glass_tinted` (`GLASS_tinted`, dark car glass),
  `chrome`, `rubber`, `leather`, `headlight`, `taillight`, `glow_beam` (`GLOW_beam`), `akita_red`,
  `akita_cream`, `dog_dark`.
- **Regenerate** the carport and dog's corner (not the house or pool):
  `art:models --force --only carport kennel`, then `art:assets`. One module:
  `"${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup --python-exit-code 1 -P art/blender/scripts/carport/build_carport.py -- --force`
  (likewise `build_kennel.py`). The `carport` and `kennel` zones are unchanged, so `yard` (whose
  rocks and grass avoid the zones) need not be regenerated. The apron at the head of the driveway
  belongs to `garden_paths` (`APRON`, `APRON_X`, `APRON_RUN` in `garden/paths_layout.py`): change
  it and run `art:models --force --only garden_paths`, then `art:assets`.

## Basement

A basement under the house: a wine cellar, a karaoke room, a sauna, a gym and a spa. It is a module
of its own (`basement`, role `prop`, so the house keeps its triangle budget) in slot `basement_01`,
standing exactly where the house slot does (`zones.ZONE_SHARED`: the `house` zone lets this one slot
share it). The module's space is the house's, so it shares the axes in `house_parts/common.py`. The
code is in `basement/` (`basement_layout.py`, `layout_check.py` and `interact.py` are pure Python;
`build_basement.py` needs bpy), the pieces in `archkit/furniture/basement.py`.

- **Heights** (`common.py`): the house's plinth is pulled down into a ground slab `GROUND_SLAB`
  0.85 m thick, whose underside is the basement ceiling `BASEMENT_CEIL` −0.40; the basement floor
  `BASEMENT_FLOOR` is −3.62 (finished −3.60), 3.2 m clear; the basement's cut is at −2.02.
- **Plan** (inside a 0.2 m retaining wall round the plinth, x ±11.3, y −6.6 to 7.3): the lobby (x
  −11.3 to 2, y 0 to 3: the stair at the west end, two rattan chairs round a coffee table on a rug,
  a plant wall, planters); the wine cellar behind a glass partition along the back of the lobby (8
  racks of green and red bottle heads along three walls, a granite tasting table with two bar
  stools, two wooden barrels); the karaoke room at the east end, the full depth (a U-shaped velvet
  sofa round a coffee table, a big TV on a low cabinet against the east wall between two tower
  speakers, a stand with two microphones, a disco ball hanging in the middle, a dark rug, purple
  velvet walls); along the front the basement bathroom (two shower cubicles, a WC, a basin, a towel
  rack), the spa (a wooden sauna cabin with a glass door in the front left corner with two benches
  and a stone stove, a stone-edged soaking tub `WATER_hot_tub`, two massage beds, an oil shelf,
  candles) and the gym (two treadmills and a squat rack with a bench facing the mirror on the east
  wall, a dumbbell rack, three yoga mats). Doors: lobby → bathroom, spa, karaoke room, wine cellar
  (a doorway between two glass panels); spa → gym.
- **Stair:** the house's spiral stair continues down the same column (`Stair_basement`: 21 treads of
  19.4 cm, 18° each like the house's, turned 180° so the top tread ends on the −X axis at the
  ground floor's level, a quarter turn before the house's first tread; the column stops at the
  ground floor, the house's column goes on). The ground floor (plinth and stone layer) keeps the
  landing quarter (as on the roof) and is open over the other three quarters; the balustrade round
  the opening's edge on the living room side is in the object `Columns`: black steel on the back
  edge and the back half of the east edge, and on the front right quarter, where the first five
  treads of the stair up (0.64 to 1.41 m) pass just over the opening's edge, a frameless glass
  panel 1 m high and 2 cm from the edge of tread 2 (the steel is at least 10 cm from every tread at
  the same height, a test). Clearance over every tread is at least 2 m (a test).
- **The light well** (zone `lightwell` (−7.5, −2) to (−1.5, 2), in front of the living room glass,
  between the pool and the stone walk; the placeholder lamp post moved to (−4.5, −3)): a 5.2 × 4.3 m
  pit down to the basement floor, with travertine walls and a 5 cm lip at grass level, darkening
  towards the bottom (`WELL_BANDS`: a bright band 40 cm under the lip, `M_stone_shade` down to
  −1.1 m, `M_stone_deep` to the floor, the same travertine texture tinted darker; the wallpaper
  camera sees only about a metre of the far wall), and it still casts a shadow into the pit (the
  lip stands 2 cm over `UNDERGROUND`), so from the wallpaper it reads as a sunken courtyard and no
  longer as a pale square; a gravel floor, a 5.5 m palm (its crown nearly 2 m above the grass),
  two small potted palms, a bird of paradise, frameless glass balustrade on the three open sides
  (`GLASS_rail`, alpha 0.1, half the house glass's, reflecting the sky less); the back side is a
  glass wall looking into the spa. At night: wall-washing lights, an LED strip under the lip round
  the opening that throws light down the west wall and over the plinth behind (the wallpaper camera
  sees only about a metre down the pit), in the `lights:garden` group.
- **The lawn:** the yard's `Ground` has a hole following `PIT` (the plinth's outline plus the light
  well): the plinth covers the hole while the house is whole; when you look at the basement the
  retaining wall (always whole to the ceiling, `uncut`) and the ground slab's concrete lip
  (−0.4 to 0, shown only when cut) surround the pit.
- **What is drawn, and when:** objects tagged `buried` (the basement's rooms, furniture, lights,
  switches) are drawn only when the cut is at the basement level, so never on the wallpaper; always
  drawn: the stair, the light well and its planting. The rest below the lawn (walls, partitions, the
  stone floor, the spa behind the light well's glass, the soaking tub) is drawn only when it can be
  seen through an "opening" (`OPENINGS` in `basement_layout.py`, extras `opening` on `Light_well`
  and `Stair_basement`: the light well's mouth inside its lip and the stair's hole in the ground
  floor): every frame `showThroughOpenings` (`src/scene/cutaway.ts`) tests each mesh's bounding box
  against four planes through the camera and the opening's edges, on the site route and the
  wallpaper alike; from the first frame you see the spa through the glass but not the low soaking
  tub behind. The basement's opaque meshes are drawn after everything else when the basement is not
  being viewed (`renderOrder` `UNDER_LAWN_ORDER` 1): the grass and plinth are already in the depth
  buffer, so those fragments are rejected before shading. Pieces under the lawn cast shadows only
  when the basement is viewed (only then does sunlight reach into the pit); the stair (rising to the
  ground floor's balustrade) casts shadows only when the house is cut to the ground floor or
  lower. The basement module drops the cut plane from its materials while the house is whole (no
  `discard` in the shader); `uncut` materials that the void's plane never reaches (the retaining
  wall, the light well) never carry a plane; the shader variants for the basement view are
  compiled ahead, when the site route is idle after loading (`warmCut` + `renderer.compileAsync`).
  Each room has a `GLOW_room` pool of light under its recessed lights (the recessed light discs
  themselves are not built, since the cut removes the ceiling). The disco ball is a mirror-tile
  `M_disco` (pale grey, half metallic, so it is no longer black at night) that lights up and changes
  colour with the LED strips when party mode is on.
- **Performance** (SwiftShader, `?bg=example.jpg`): wallpaper 788 → 806 draw calls at 12:00, 794 →
  813 at 21:00 (main → branch); the `basement` module 14 180 triangles (87 primitives), the house
  45 800 → 46 040, the yard 2 548 → 2 558. Site route `/?t=12:00` (three passes of 5 to 7
  interleaved rounds against main): about 51.5 → 53.5–54.7 ms per frame at cut `none` (1 278 →
  1 301 draw calls; the median per-round difference +2.0 to +3.1 ms depending on machine load, +2.5
  over all 19 rounds); pressing **Basement** takes the camera to 35 m, 55° and the frame costs
  69–71 ms (308 draw calls), the cheapest at that spot (the same spot: **Ground floor** 114 ms,
  the whole house 175 ms).
- **Regenerate:** `art:models --force --only basement house yard`, then `art:assets`. One module:
  `"${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup --python-exit-code 1 -P art/blender/scripts/basement/build_basement.py -- --force`.

## Interior

The house's curtains and accessories: the curtains, the roller blinds and 79 small pieces of
furniture and decoration. A module of its own, `interior` (role `prop`, at most 15k triangles, no
point light; the house stands at 46k under its 50k ceiling), in slot `interior_01`, standing exactly
where the house does (`zones.ZONE_SHARED`, like the basement). The module's space is the house's
and the rooms are `house_layout.ROOMS`. The code is in `interior/` (`interior_layout.py`,
`layout_check.py` and `interact.py` are pure Python; `build_interior.py` needs bpy), the pieces in
`archkit/furniture/interior.py` (31 kinds) and `decor.py` (`curtain`, `roller_blind`).

- **Curtains** (`curtain`, replacing the old fixed 3 m curtain and the house's `Curtain_master`): a
  slim bronze ceiling track (`M_bronze`) as wide as the glazing (`width`), as tall as the room
  (`drop` = ceiling − floor − 1 cm, `interior_layout.drop`; in the void it is the upper ceiling, so
  the living room's voile curtain is 8.8 m tall), the fabric 2 cm off the floor. At each end of a
  run a bundle of soft wavy fabric (a one-sided strip of quads in a sine wave, 8 waves a metre,
  smooth shading): the ivory `M_sheer` voile on the glass side (the inner one, alpha 0.75: the
  module's only transparent primitive; the page draws it in one pass (`forceSinglePass`, not the
  back-then-front two passes of a two-sided transparent material) and lights both faces: the back
  face keeps its normal pointing into the room, so at night, from outside, the voile glows with the
  room's warm light instead of showing moon-blue stripes; clicks and zooming go through the voile
  as through glass) and the sand-coloured linen drape `M_drape` on the room side (one-sided, with
  backface culling: seen from outside at night, the backs of the wave strips are dark blue
  columns behind the voile; when the house is cut every opaque material draws both faces), tied
  back with a bronze band at 1.05 m; the glass between is left clear (`catalog.CURTAIN`). Six runs:
  the front and west flank of the double-height living room, the dining room glass, bedroom 2, the
  master bedroom (the glass onto the balcony) and bedroom 3's west window; roller blinds
  (`roller_blind`) on the two clerestory windows over the kitchen and the computer corner.
- **Accessories** (79 pieces): cushions and throws on the sofa and beds; a candle tray, books and a
  bowl on the coffee table; a dried-flower vase, a travertine side table, a fiddle-leaf fig, a
  rattan chair, a low teak-and-rattan cabinet under the round mirror; a laid dining table for 8 on
  a large sisal rug, a table lamp on the buffet; a fruit bowl, a chopping board, teapot and jar, a
  herb pot and bar-stool cushions in the kitchen; bedside lamps, a bench at the foot of the bed, a
  study corner in bedroom 2, a low cabinet doing duty as a dressing table; a console, a bench, a
  painting and a long rug in the hallway; a tray, a bath mat, a towel rail and a plant in the
  bathrooms; a mirror, a vase and an umbrella stand in the entrance hall. A cushion is a square
  cushion (two 4 × 4 grids stitched at the edge, thick in the middle and thin at the edge, 64
  triangles; before, a flattened sphere that read as a ball from the site camera); the glasses on
  the dining table and the wine set in the basement are `M_glassware`, opaque and glossy (no extra
  transparent draw); a small travertine piece (the side table, a bowl, a tray) takes its UVs in its
  own system offset by half a stone slab (`MeshBuilder` `uv_offset`, `STONE_MID`), so the grout
  cross does not show. A piece set on another carries the option `"on": <object name>` and stands on
  its top (`catalog.SURFACES`, `houses/layout_check.top_under`; ±1 cm); a wall-hung piece must lean
  on a solid wall (not glass, not over a doorway). `interior/layout_check.py` also checks: a
  curtain runs along the room's glass, inside the room, under the ceiling, clear of doors, the stair,
  the chandelier, the house's furniture and the switches; floor pieces avoid the house's furniture
  and the walkways (doors, gaps, the stair, the strip along the hallway balustrade).
- **Objects:** `Interior_decor` (curtains, chairs, plants, cabinets, mirrors, lamp bases: 9
  materials, 5 100 triangles), `Interior_details` (the small pieces, extras `detail`, 10 materials,
  6 872 triangles: the site route draws it only when the camera is near the house, under 45 m from
  its middle like the upper-floor cut level and with the same ±3 m hysteresis (`nearHouse`,
  `nearFor`, the store's `near`, set by `OrbitRig`), whether the house is whole ("Roof" at 20 m, or
  "Auto" close in with a low camera) or cut; the wallpaper does not draw it: from far away the
  pieces are a pixel or two across yet hold most of the triangles) and
  `LT_lamp_dining` / `LT_lamp_bedroom2` / `LT_lamp_bedroom3` (the table lamp shades, `night_light`,
  in the house's `light:<room>` groups: the room's switch turns the room's table lamps off and on
  too; the lamp bases are in `Interior_decor`, drawn whenever a shade is, so a shade never floats).
  No object casts a shadow. On the page: `CUTAWAY_MODULES.interior` (cut with the house at every
  level, hidden with the house on "Basement"), `cutOnlyByButton` (only the basement takes the plane
  away when whole), `applyCut(…, near)`, `leaveOutDetails`. The module's real transparent draw
  calls: 1 (the voile, one pass); before the fix it was 2 with the house whole and 4 with the
  details shown (`M_sheer` in both decor and the glasses in details, two passes per primitive), and
  2 more in the basement (the wine set).
- The regenerated house no longer has `Curtain_master` (45 884 triangles); the monstera, the living
  room palm, the dining room plant, the hallway plant and bedroom 3's desk moved a little to make
  room for the curtain bundles and the bench. The basement gained a few pieces in empty spots (a
  decanter and glasses on the tasting table, cushions on the karaoke sofa, rolled towels on the
  massage bed, towels and water bottles in the gym; 14 784 triangles).
- **Performance** (SwiftShader, `?bg=example.jpg`): wallpaper 806 → 816 draw calls at 12:00,
  813 → 823 at 21:00; the `interior` module 12 192 triangles (`Interior_decor` 5 100 + the lamp
  shades + `Interior_details` 6 872; far from the house only the decor and the shades are drawn, 12
  draw calls). Wallpaper triangles about 98.2k. Site route `/?t=12:00` at cut none, first view (7
  rounds interleaved with the main build, machine load 7 to 15): 64.2 → 66.3 ms per frame (median
  difference +2.0 ms), 1 301 → 1 309 draw calls; near the house (20 m, cut to the ground floor or
  "Roof") the curtains and accessories cost about 19 to 21 ms per frame more on SwiftShader (the
  voile about 5, the fabric and linen about 7, the small pieces about 5 ms; mostly fill cost).
- **Regenerate:** `art:models --force --only interior house` (add `basement` if you changed the
  basement's pieces), then `art:assets`.

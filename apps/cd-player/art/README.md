# CD Player: the art side

Both CD players, the suitcase and the Clear model (an upright, see-through player), are generated
by Python running inside Blender, not modelled by hand.

- `blender/scripts/cdkit.py`: geometry helpers (2D slabs with rounded edges, tubes, lathes, a
  partial lathe for the corner caps, stitches, text) and Principled materials, in millimetres;
  the Cycles-only quilt and weave bumps; Metal and a headless render.
- `blender/scripts/parts.py`: the CD, the crystal jewel case and the player: its hardware (corner
  caps, keyhole clasps, rivets, nameplate, grille frame), piping and stitching, the handle with
  its luggage tag, the deck's chrome ring, screws and VU strip, the tonearm, the quilted lid with
  its strap, the five-slot rack and the plate. `build_materials(palette)` makes every material;
  the seven the skins recolour take their colours from a palette of sRGB hex values (`BLUSH` by
  default).
- `blender/scripts/build_player.py`: the web scene, with the names the page drives
  (`src/scene/contract.ts`).
- `blender/scripts/clear.py`: the Clear model, on `parts.py`'s disc and case: a clear
  polycarbonate shell (front and back plates and one hollow band, never a filled block) on a
  plinth, the round glass door hinged on its left, the disc on its spindle ringed by the light
  ring, the swing arm with its voice coil, the spindle motor's copper coils, the board with its
  chips, LCD, VU strip and silkscreened logo, the speakers, four AA cells, the keys and their own
  board, the knob standing upright on the top beside them, the handle and its tag, the nameplate,
  the stand with the rack's five slots and the standing case. `clear_look(spec)` reads a look
  from `src/clear-looks.json` (and stops the run, naming what is wrong, on a part or a field it
  lacks) and `build_clear_materials(look)` makes its materials.
- `blender/scripts/build_clear.py`: the Clear model's web scene, with the names the page drives
  (`src/scene/contract.ts`) and the door's `door_hinge`.
- `blender/scripts/export.py`: the background entry. It builds the model `CDP_MODEL` names
  (`suitcase`, the default, or `clear`), meshes curves and text, adds UVs, and writes the raw GLB.
- `blender/scripts/hero.py`: the Cycles stills, headless: `CDP_MODEL=suitcase|clear`,
  `CDP_HERO_VIEW=hero|lid` (the suitcase) or `hero|inside` (the Clear model),
  `CDP_HERO_QUALITY=preview|final`, into `.out/v2-<view>-<quality>.png`, or
  `.out/clear/<shell>-<frame>-<board>-<light>/clear-<view>-<quality>.png` for the Clear model
  (`CDP_CLEAR_LOOK`, below), whose studio also sees the backdrop through the shell
  (`see_through_backdrop`) and sets dark reflection flags round it (`clear_flags`). For the owner's
  gates and the docs only.
- `blender/tools/bl.py`: talks to a running Blender through the Blender Lab MCP add-on's socket
  (127.0.0.1:9876, `{"type": "execute", "code": …}` + NUL). Use it for interactive design work;
  the build never needs it.

## Build

Needs Blender 5.2.2 LTS (`/Applications/Blender.app`, or `BLENDER_BIN`).

    pnpm --filter @ncam/cd-player art:build         # the suitcase
    pnpm --filter @ncam/cd-player art:build:clear   # the Clear model

They write `public/assets/cd-player.glb` and `public/assets/cd-player-clear.glb` (both committed;
`pipeline/build.mjs` hands the model to `export.py` as `CDP_MODEL`).
`src/scene/model-contract.test.ts` checks each one's names, materials, where things are parented
and the budget (150k triangles, 4 MB). The committed suitcase is about 100,633 triangles and
777 KB, the Clear model about 106,246 and 802 KB. Rebuild a model after any change to its scripts
(`cdkit.py` and `parts.py` are both models').

## Renders

    CDP_HERO_VIEW=hero CDP_HERO_QUALITY=preview \
      /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python-exit-code 1 --python blender/scripts/hero.py

The first Cycles run on Metal compiles its kernels for about two minutes. The renders are not in
the repository.

## Skins

`src/skins.json`, the file the page reads, holds every skin's palette; `parts.py` reads Blush
from it as `BLUSH`, the default of `build_materials()`. `CDP_SKIN=<id>` (an id of that file)
renders another skin with `hero.py`, into `.out/skins/<id>/v2-<view>-<quality>.png`:

    CDP_SKIN=sage CDP_HERO_VIEW=hero CDP_HERO_QUALITY=final \
      /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python-exit-code 1 --python blender/scripts/hero.py

The skins change only the seven materials named after the skin roles; every other material keeps
the colour `build_materials()` gives it.

## The Clear model

`src/clear-looks.json`, the file the page reads, holds the Clear model's colours part by part:
the shell's tint, the frame (the plinth, the door's bezel, the keys, the handle, the speaker cones,
the stand's cheeks), the board and the light (the ring round the disc, the VU strip, the keys'
icons). The play key carries two icons, ▶ and ‖ (`button_icon("play")` and `("pause")` in
`parts.py`), built as `icon_play` / `icon_pause` in both models and shown one at a time by the
page. `CDP_MODEL=clear` renders it in its default look, or in the one
`CDP_CLEAR_LOOK=<shell>,<frame>,<board>,<light>` names (ids of that file), into
`.out/clear/<shell>-<frame>-<board>-<light>/clear-<view>-<quality>.png` (`CDP_SKIN` is the
suitcase's alone: with the Clear model it stops the run, as `CDP_CLEAR_LOOK` does with the
suitcase); `hero` is the three-quarter still between the stand and the case, `inside` a close-up of
the board and the mechanism through the shell:

    CDP_MODEL=clear CDP_CLEAR_LOOK=smoke,black,black,amber CDP_HERO_VIEW=inside \
      CDP_HERO_QUALITY=final /Applications/Blender.app/Contents/MacOS/Blender --background \
      --factory-startup --python-exit-code 1 --python blender/scripts/hero.py

A render plays: the arm over the disc, discs in the rack, the LCD and seven VU segments lit, the
plate and the tag lettered. The web scene (`build_clear.py`) is at rest: the door shut, the arm off
the disc's rim, the rack's slots empty, the prints as plain planes for the page to paint.

"""Material palette (glass villa spec §3: white + grey stone + wood, black frames, LED; GLASS_* per spec §6;
villa v2 spec §6: FROSTED_bath, grape, bathroom tile and ceramic, brushed metal, cushion, lit screen, PC RGB, art;
resort deco: travertine, teak, rattan, linen, terracotta and a dark tropical leaf; garden: four flower colours, cabbage,
gravel, pebble, the glowing charcoal of the grill and GLOW_pool, the light the garden lamps cast on the lawn; the koi
pond: granite, rock, moss, bark, glaze, lotus, the koi colours, the pond's bank and floor, foam; the carport: two car
paints, tinted car glass, chrome, tyre rubber, tan leather, the head and tail lights and GLOW_beam, the light the
headlights cast; the Akita's red-fawn coat, its cream urajiro and the dark of its eyes and nose; the tall house: the
chandelier's crystal and brass, the air conditioner's louvre light; the basement: velvet, the bottles' green glass and
their wine, carpet, the concrete edge of its pit, the karaoke's party lights and the disco ball's tiles, the light
well's shaded travertine and its railing's fainter glass; the decor pass: the curtains' sheer, their sand linen drape
and the bronze of their tracks, the tables' glassware).

Blender drops materials and images nobody uses when it saves, so a module only ships what its objects reference.
"""
import bpy

from . import textures


def principled(name, color, roughness=0.6, metallic=0.0, alpha=1.0, emission=None, strength=0.0, image=None,
               tint=False, culled=False):
    """Principled material. An `image` is linked straight to Base Color, which hides `color` from Blender and from the
    glTF exporter (it writes no baseColorFactor then); with tint=True the image goes through a multiply node instead,
    so `color` reaches glTF as the baseColorFactor that three.js multiplies with the map. culled=True draws only the
    faces' fronts (backface culling: glTF doubleSided false)."""
    mat = bpy.data.materials.new(name)
    mat.use_backface_culling = culled
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha  # alpha < 1 exports as alphaMode BLEND (spec §13 V1, verified)
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if image is not None:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        if tint:
            mix = nodes.new("ShaderNodeMix")
            mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs["B"].default_value = (*color, 1.0)
            links.new(tex.outputs["Color"], mix.inputs["A"])
            links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def palette():
    """Every material a villa module uses, keyed by its role in the design."""
    stone = textures.stone_tiles()
    wood = textures.wood_planks()
    art = textures.art_atlas()
    return {
        "white": principled("M_white", (0.9, 0.9, 0.88), roughness=0.55),
        "stone": principled("M_stone", (1.0, 0.95, 0.86), roughness=0.8, image=stone, tint=True),
        "wood": principled("M_wood", (0.5, 0.32, 0.18), roughness=0.55, image=wood),
        "frame": principled("M_frame", (0.04, 0.04, 0.045), roughness=0.35, metallic=0.7),
        "floor": principled("M_floor", (0.72, 0.69, 0.64), roughness=0.45),
        "glass": principled("GLASS_clear", (0.82, 0.9, 0.94), roughness=0.05, alpha=0.2),
        "led": principled("M_led", (1.0, 0.86, 0.62), roughness=0.5, emission=(1.0, 0.8, 0.55), strength=6.0),
        "fabric": principled("M_fabric", (0.85, 0.79, 0.68), roughness=0.95),
        "fabric_dark": principled("M_fabric_dark", (0.22, 0.24, 0.27), roughness=0.95),
        "counter": principled("M_counter", (0.94, 0.94, 0.93), roughness=0.25),
        "screen": principled("M_screen", (0.02, 0.02, 0.025), roughness=0.15),
        "leaf": principled("M_leaf", (0.2, 0.42, 0.18), roughness=0.8),
        "soil": principled("M_soil", (0.12, 0.09, 0.07), roughness=0.95),
        "tile": principled("M_pool_tile", (0.55, 0.8, 0.86), roughness=0.3),
        "water": principled("M_water", (0.2, 0.55, 0.65), roughness=0.1),
        # a lit bathroom behind the pane: the runtime scales this emission by the night factor (the panel is night_light)
        "frosted": principled("FROSTED_bath", (0.9, 0.93, 0.95), roughness=0.5, alpha=0.6,
                              emission=(1.0, 0.72, 0.42), strength=0.45),
        "grape": principled("M_grape", (0.28, 0.08, 0.32), roughness=0.4),
        "tile_bath": principled("M_tile_bath", (0.85, 0.87, 0.88), roughness=0.2),
        "ceramic": principled("M_ceramic", (0.97, 0.97, 0.96), roughness=0.15),
        "metal": principled("M_metal", (0.6, 0.6, 0.62), roughness=0.35, metallic=0.9),
        "cushion": principled("M_cushion", (0.55, 0.6, 0.5), roughness=0.9),
        "screen_on": principled("M_screen_on", (0.02, 0.02, 0.03), roughness=0.15, emission=(0.55, 0.75, 1.0),
                                strength=3.0),
        "rgb": principled("M_rgb", (0.1, 0.02, 0.12), roughness=0.5, emission=(0.9, 0.2, 1.0), strength=5.0),
        "art": principled("M_art", (1.0, 1.0, 1.0), roughness=0.6, image=art),
        # resort: golden teak (a flat colour: a factor can only darken T_wood's walnut), woven cane, bleached cloth,
        # fired clay and the deep green of monstera and palm shade
        "teak": principled("M_teak", (0.52, 0.30, 0.10), roughness=0.5),
        "rattan": principled("M_rattan", (0.72, 0.55, 0.32), roughness=0.85),
        "linen": principled("M_linen", (0.93, 0.9, 0.84), roughness=0.95),
        "terracotta": principled("M_terracotta", (0.72, 0.38, 0.24), roughness=0.9),
        "leaf_dark": principled("M_leaf_dark", (0.1, 0.3, 0.12), roughness=0.75),
        # garden (villa v2 part 2): bougainvillea pink, marigold yellow, hibiscus red (the ripe tomatoes too) and
        # frangipani white, a pale cabbage green, warm grey path gravel (lighter read as white concrete at noon), grey
        # edge stones, and the charcoal of the grill, which glows like a lamp (night_light: by day it is cold unless a
        # click lights it)
        "flower_pink": principled("M_flower_pink", (0.85, 0.12, 0.42), roughness=0.7),
        "flower_yellow": principled("M_flower_yellow", (0.95, 0.68, 0.08), roughness=0.7),
        "flower_red": principled("M_flower_red", (0.78, 0.06, 0.05), roughness=0.6),
        "flower_white": principled("M_flower_white", (0.95, 0.93, 0.88), roughness=0.7),
        "cabbage": principled("M_cabbage", (0.45, 0.62, 0.22), roughness=0.7),
        "gravel": principled("M_gravel", (0.42, 0.39, 0.34), roughness=1.0),
        "pebble": principled("M_pebble", (0.42, 0.4, 0.37), roughness=0.9),
        "ember": principled("M_ember", (0.06, 0.03, 0.025), roughness=0.9, emission=(1.0, 0.2, 0.03), strength=1.6),
        # the pool of warm light a garden lamp casts on the ground (MeshBuilder.disc): black, so it only ever adds
        # light; the website draws GLOW_* additively, faded out from the centre and by the night (contract glow-*)
        "glow_pool": principled("GLOW_pool", (0.0, 0.0, 0.0), roughness=1.0, emission=(1.0, 0.6, 0.28), strength=2.2),
        # koi pond and tea corner (villa v2 part 3), all flat colours: dark grey granite (the tea table, stools,
        # pedestals and lantern), the grey limestone of the rockery and the pond's stones with paler facets, moss,
        # bonsai bark, a celadon pot glaze, lotus pink and a fresh pad green, the four koi colours (bright enough to
        # read through the water from the wallpaper camera), the muddy bank and the dark floor of the pond, white foam
        "granite": principled("M_granite", (0.36, 0.36, 0.35), roughness=0.85),
        "rock": principled("M_rock", (0.25, 0.245, 0.23), roughness=0.9),
        "rock_light": principled("M_rock_light", (0.33, 0.315, 0.285), roughness=0.9),  # weathered, not bleached
        "moss": principled("M_moss", (0.17, 0.3, 0.07), roughness=0.95),
        "bark": principled("M_bark", (0.2, 0.13, 0.08), roughness=0.9),
        "glaze": principled("M_glaze", (0.16, 0.32, 0.34), roughness=0.25),
        "lotus": principled("M_lotus", (0.95, 0.4, 0.6), roughness=0.7),
        "lotus_pad": principled("M_lotus_pad", (0.24, 0.52, 0.12), roughness=0.6),
        "koi_orange": principled("M_koi_orange", (1.0, 0.3, 0.03), roughness=0.45),
        "koi_white": principled("M_koi_white", (0.96, 0.95, 0.92), roughness=0.45),
        "koi_black": principled("M_koi_black", (0.025, 0.025, 0.03), roughness=0.45),
        "koi_gold": principled("M_koi_gold", (1.0, 0.72, 0.18), roughness=0.35),
        "pond_bank": principled("M_pond_bank", (0.13, 0.12, 0.07), roughness=1.0),
        "pond_floor": principled("M_pond_floor", (0.03, 0.045, 0.035), roughness=1.0),
        "foam": principled("M_foam", (0.94, 0.97, 1.0), roughness=1.0),
        # carport (villa v2 part 4): a deep forest green for the pickup and a bright red for the supercar, glossy with
        # a metallic flake (the green's light, so it does not mirror the dark night sky and still reads green under
        # the carport's roof at night); dark tinted glass (a GLASS_ pane of the contract), chrome, black rubber and
        # trim, tan leather; head and tail lights that glow like a lamp (the carport makes their object a night light,
        # so by day they are a pale lens and a dark red one)
        "paint_green": principled("M_paint_green", (0.08, 0.27, 0.15), roughness=0.3, metallic=0.15),
        "paint_red": principled("M_paint_red", (0.72, 0.025, 0.02), roughness=0.25, metallic=0.25),
        "glass_tinted": principled("GLASS_tinted", (0.06, 0.08, 0.1), roughness=0.05, alpha=0.45),
        "chrome": principled("M_chrome", (0.9, 0.9, 0.92), roughness=0.15, metallic=1.0),
        "rubber": principled("M_rubber", (0.02, 0.02, 0.022), roughness=0.9),
        "leather": principled("M_leather", (0.42, 0.21, 0.08), roughness=0.55),
        "headlight": principled("M_headlight", (0.82, 0.84, 0.86), roughness=0.2, emission=(1.0, 0.93, 0.8),
                                strength=5.0),
        "taillight": principled("M_taillight", (0.3, 0.015, 0.015), roughness=0.3, emission=(1.0, 0.04, 0.02),
                                strength=4.0),
        # the light a car's headlights cast on the ground ahead of it, whiter than the lamps' GLOW_pool
        "glow_beam": principled("GLOW_beam", (0.0, 0.0, 0.0), roughness=1.0, emission=(1.0, 0.92, 0.78), strength=1.8),
        # the Akita (part 4): its red-fawn coat, the cream of its muzzle, chest and paws, a glossy dark for its eyes and
        # nose
        "akita_red": principled("M_akita_red", (0.62, 0.2, 0.055), roughness=0.85),
        "akita_cream": principled("M_akita_cream", (0.9, 0.8, 0.64), roughness=0.85),
        "dog_dark": principled("M_dog_dark", (0.015, 0.012, 0.012), roughness=0.3),
        # the tall house's crystal chandelier: cut crystal, opaque so its drops and curtains cost no transparent pass,
        # mirror-glossy champagne that catches the sky by day and, at night, the living room's light (inside the
        # chandelier) only as sparkles off its facets: a diffuse part would burn white that close to the light. The
        # candle bulbs give it a warm golden glow at night (the chandelier is a night light), kept low enough to stay
        # golden; on a gold brass frame that the candle light warms at night too
        "crystal": principled("M_crystal", (1.0, 0.95, 0.86), roughness=0.04, metallic=1.0,
                              emission=(1.0, 0.55, 0.2), strength=1.2),
        "brass": principled("M_brass", (0.9, 0.68, 0.3), roughness=0.4, metallic=0.8, emission=(1.0, 0.66, 0.28),
                            strength=0.35),
        # the split air conditioner's louvre flap, its status light: white like the unit, a soft cool glow while it runs
        "ac_light": principled("M_ac_light", (0.9, 0.9, 0.88), roughness=0.55, emission=(0.45, 0.78, 1.0),
                               strength=0.8),
        # the basement (villa v2 spec §12 "Tầng hầm"), opaque flat colours: the karaoke sofa's plum velvet, the dark
        # green glass of the bottle ends in the wine racks and the red wine of others, the karaoke's dark carpet, the
        # concrete edge of the ground slab round the basement's pit (it shows when the website cuts the house down to
        # it); and the karaoke's party LEDs with the light they cast on its carpet, a magenta the website cycles through
        # the hues while the party is on (night lights of the party group, glow-* like the garden's pools), dim enough
        # that the tone mapping keeps their colour rather than burning it white
        "velvet": principled("M_velvet", (0.32, 0.05, 0.2), roughness=0.9),
        "bottle": principled("M_bottle", (0.04, 0.16, 0.07), roughness=0.2),
        "wine": principled("M_wine", (0.3, 0.02, 0.06), roughness=0.25),
        "carpet": principled("M_carpet", (0.07, 0.06, 0.12), roughness=1.0),
        "concrete": principled("M_concrete", (0.2, 0.2, 0.21), roughness=0.95),
        "party_led": principled("M_party_led", (0.9, 0.9, 0.9), roughness=0.5, emission=(1.0, 0.25, 0.85),
                                strength=1.6),
        "glow_party": principled("GLOW_party", (0.0, 0.0, 0.0), roughness=1.0, emission=(1.0, 0.3, 0.9),
                                 strength=0.7),
        # the light a basement room's downlights cast on its pale floor: softer and warmer than the lawn's GLOW_pool,
        # which would burn the travertine white
        "glow_room": principled("GLOW_room", (0.0, 0.0, 0.0), roughness=1.0, emission=(1.0, 0.68, 0.38), strength=0.35),
        # the disco ball's mirror tiles: pale and half metallic, so the night's dim light keeps them grey rather than
        # black, glowing a magenta while the party is on (the ball is a night light of the party group, whose colour
        # the website cycles with the LEDs')
        "disco": principled("M_disco", (0.82, 0.82, 0.86), roughness=0.25, metallic=0.5, emission=(1.0, 0.3, 0.9),
                            strength=1.2),
        # the light well's walls, darker and darker down from the lawn (the travertine's texture, tinted): the sun lights
        # the top of the 3.6 m deep court, little of its foot, so from the wallpaper camera it reads as sunk in the lawn
        "stone_shade": principled("M_stone_shade", (0.6, 0.56, 0.5), roughness=0.85, image=stone, tint=True),
        "stone_deep": principled("M_stone_deep", (0.36, 0.33, 0.3), roughness=0.9, image=stone, tint=True),
        # the frameless railing round the light well's top: fainter than the house's panes (half the alpha, contract
        # glass-*), so its edge-on panes do not frame the well in the sky's reflection
        "glass_rail": principled("GLASS_rail", (0.82, 0.9, 0.94), roughness=0.05, alpha=0.1),
        # the decor pass (villa v2 spec §12 "Rèm và phụ kiện"): the curtains' ivory voile, paler than the linen drape in
        # front of it and see-through, the interior's one blended primitive (opaque, it showed from outside at night as
        # moonlit navy panels in front of the warm rooms, where a real sheer lets the room's light through: the website
        # lights it from both sides, prepareModule; gathered at the ends of the glass, it never hides the view); and the
        # dark bronze of the curtains' tracks and tie-backs, the lamps' stems and the frames of the art
        "sheer": principled("M_sheer", (0.98, 0.95, 0.89), roughness=0.95, alpha=0.75),
        # the curtains' drape (and the blinds, the throws, the dining table's runner): a sand linen, warmer and darker
        # than M_linen, which renders near white, so the drape reads apart from the voile behind it. Single-sided: its
        # ribbons turn their front to the room, and from outside at night their moonlit backs read as dark navy stripes
        # behind the voile (the throws, the runner and the blinds are closed boxes; under the cut the website draws every
        # opaque material double-sided)
        "drape": principled("M_drape", (0.78, 0.68, 0.54), roughness=0.95, culled=True),
        "bronze": principled("M_bronze", (0.24, 0.16, 0.09), roughness=0.4, metallic=0.75),
        # the glasses on the dining table and the cellar's tasting tray: a pale glossy glassware, opaque, so they add no
        # see-through draw (a blended material draws in a pass of its own, twice when double-sided)
        "glassware": principled("M_glassware", (0.8, 0.86, 0.88), roughness=0.08),
    }

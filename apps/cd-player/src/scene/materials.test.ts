import {
  BoxGeometry,
  Color,
  FrontSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  type Material,
} from 'three';
import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES, clearSwatch, type ClearLook } from '../clear-looks';
import { deckSwatch } from '../deck-looks';
import { SKINS, skinById, type Skin } from '../skins';
import { DYNAMIC_MATERIALS } from './contract';
import { etchColour, traceColour } from './decor-colours';
import { SKIN_ROLES } from './material-roles';
import {
  applyLook,
  applySkin,
  leatherSheen,
  makeMaterial,
  SILK_DARK,
  SILK_LIGHT,
  skinColours,
  upgradeMaterials,
} from './materials';

const meshOf = (name: string, color = '#ffffff') =>
  new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name, color }));

/** The largest difference between two colours in any linear channel. */
const gap = (a: Color, b: Color) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));

describe('makeMaterial', () => {
  const source = new MeshStandardMaterial({ name: 'from_the_glb' });
  const maps = { grain: new Texture(), quilt: new Texture(), weave: new Texture() };

  // The studio's panels are bright: reflected in full they lift the blacks of what is behind the
  // glass (the booklet's art) and leave hot spots on it. The edges and a faint reflection still
  // read as glass.
  it('makes the crystal clear glass with a faint reflection, not a mirror-strong one', () => {
    const glass = makeMaterial('crystal', source, maps) as MeshPhysicalMaterial;
    expect(glass.transmission).toBe(1);
    expect(glass.metalness).toBe(0);
    expect(glass.roughness).toBeLessThanOrEqual(0.05);
    expect(glass.specularIntensity).toBeGreaterThan(0);
    expect(glass.specularIntensity).toBeLessThanOrEqual(0.4);
  });

  it('makes a print a paper with a soft sheen: no clearcoat, a reflection well under full', () => {
    const print = makeMaterial('print', source, maps) as MeshPhysicalMaterial;
    expect(print.clearcoat).toBe(0);
    expect(print.roughness).toBeGreaterThanOrEqual(0.3);
    expect(print.specularIntensity).toBeGreaterThan(0);
    expect(print.specularIntensity).toBeLessThanOrEqual(0.4);
  });

  // The LED, the display and the VU strip are lamps, drawn at their own colour: tone-mapped (AgX),
  // the strip's glow would come out dull.
  it('draws an emissive part outside the tone mapping', () => {
    expect(makeMaterial('emissive', source, maps).toneMapped).toBe(false);
  });

  it('makes the etching a frosted, half-opaque surface with no transmission and no depth write', () => {
    const etch = makeMaterial('etch', source, maps) as MeshPhysicalMaterial;
    expect(etch.transparent).toBe(true);
    expect(etch.opacity).toBe(0.5);
    expect(etch.roughness).toBe(0.85);
    expect(etch.metalness).toBe(0);
    expect(etch.transmission).toBe(0);
    expect(etch.depthWrite).toBe(false);
    expect(etch.side).toBe(FrontSide);
  });

  it('makes the gold #d6ae5a, fully metallic, roughness 0.3', () => {
    const gold = makeMaterial('gold', source, maps) as MeshPhysicalMaterial;
    expect(`#${gold.color.getHexString(SRGBColorSpace)}`).toBe('#d6ae5a');
    expect(gold.metalness).toBe(1);
    expect(gold.roughness).toBe(0.3);
  });

  // The Deck’s prints draw in the opaque pass, cut out by their atlas’s alpha, and sit 0.15 mm over
  // their faces: the offset keeps them from fighting those faces in the depth buffer.
  it('makes the Deck’s print layer a cut-out decal pulled off its face, hidden until it is painted', () => {
    const decal = makeMaterial('decal', source, maps) as MeshPhysicalMaterial;
    expect(decal.alphaTest).toBe(0.5);
    expect(decal.transparent).toBe(false);
    expect(decal.polygonOffset).toBe(true);
    expect(decal.polygonOffsetFactor).toBe(-1);
    expect(decal.polygonOffsetUnits).toBe(-4);
    expect(decal.visible).toBe(false);
  });
});

describe('upgradeMaterials', () => {
  it('samples the leather grain filtered and mip-mapped, so it fades with distance and does not shimmer', () => {
    const root = new Group();
    const mesh = meshOf('leather');
    root.add(mesh);
    const upgraded = upgradeMaterials(root);
    const grain = (mesh.material as MeshPhysicalMaterial).normalMap;
    expect(grain).not.toBeNull();
    expect(grain?.magFilter).toBe(LinearFilter);
    expect(grain?.minFilter).toBe(LinearMipmapLinearFilter);
    expect(grain?.generateMipmaps).toBe(true);
    expect(grain?.anisotropy).toBeGreaterThan(1);
    upgraded.dispose();
  });

  it('quilts the lining and weaves the cloth and the strap with maps of their own', () => {
    const root = new Group();
    const [leather, lining, fabric, strap] = ['leather', 'lining', 'fabric', 'strap'].map(
      (name) => {
        const mesh = meshOf(name);
        root.add(mesh);
        return mesh;
      },
    );
    const upgraded = upgradeMaterials(root);
    const mapOf = (mesh: Mesh) => (mesh.material as MeshPhysicalMaterial).normalMap;
    expect(mapOf(lining)).not.toBeNull();
    expect(mapOf(fabric)).not.toBeNull();
    expect(mapOf(lining)).not.toBe(mapOf(leather));
    expect(mapOf(fabric)).not.toBe(mapOf(leather));
    expect(mapOf(fabric)).not.toBe(mapOf(lining));
    expect(mapOf(strap)).toBe(mapOf(fabric));
    expect(mapOf(fabric)?.repeat.x).toBe(3);
    upgraded.dispose();
  });

  it('keeps glass and the etching out of the shadow map, and casts the rest', () => {
    const root = new Group();
    const [glass, etch, board] = ['door_glass', 'etch', 'board'].map((name) => {
      const mesh = meshOf(name);
      mesh.castShadow = true;
      root.add(mesh);
      return mesh;
    });
    const upgraded = upgradeMaterials(root);
    expect(glass.castShadow).toBe(false);
    expect(etch.castShadow).toBe(false);
    expect(board.castShadow).toBe(true);
    upgraded.dispose();
  });

  it('keeps the Deck’s print layer out of the shadow map, and hands it to the page as a slot', () => {
    const root = new Group();
    const print = meshOf('deck_pattern');
    print.castShadow = true;
    root.add(print);
    const upgraded = upgradeMaterials(root);
    expect(print.castShadow).toBe(false);
    expect(upgraded.optionalSlots.deck_pattern).toBe(print.material);
    upgraded.dispose();
  });

  it('hands each of the five printed materials to the page as a slot, and puts it on its mesh', () => {
    const root = new Group();
    const meshes = DYNAMIC_MATERIALS.map((name) => {
      const mesh = meshOf(name);
      root.add(mesh);
      return mesh;
    });
    const { slots, dispose } = upgradeMaterials(root);
    expect(Object.keys(slots).sort()).toEqual([...DYNAMIC_MATERIALS].sort());
    DYNAMIC_MATERIALS.forEach((name, i) => expect(meshes[i].material, name).toBe(slots[name]));
    // The prints are lit surfaces; the LCD is a lamp, drawn as it is painted.
    expect(slots.art_disc).toBeInstanceOf(MeshPhysicalMaterial);
    expect(slots.lcd_screen).toBeInstanceOf(MeshBasicMaterial);
    expect(slots.tag_print).toBeInstanceOf(MeshPhysicalMaterial);
    dispose();
  });

  it('still gives a material of its own to a name it has no role for, shared by every mesh of it', () => {
    const root = new Group();
    const source = new MeshStandardMaterial({ name: 'not_in_the_contract' });
    const first = new Mesh(new BoxGeometry(), source);
    const second = new Mesh(new BoxGeometry(), source);
    root.add(first, second);
    const { slots, dispose } = upgradeMaterials(root);
    expect(first.material).not.toBe(source);
    expect(first.material).toBeInstanceOf(MeshPhysicalMaterial);
    expect((first.material as MeshPhysicalMaterial).name).toBe('not_in_the_contract');
    expect(second.material).toBe(first.material);
    expect(Object.keys(slots)).toEqual([]);
    dispose();
  });
});

describe('leatherSheen', () => {
  it('lifts a base toward white by its own luminance, 40 % at most, in the linear working colour', () => {
    expect(leatherSheen(new Color(0, 0, 0)).toArray()).toEqual([0, 0, 0]);
    expect(leatherSheen(new Color(1, 1, 1)).toArray()).toEqual([1, 1, 1]);
    // A grey of luminance 0.2 is lifted 20 % of the way, one of 0.6 only 40 %.
    expect(leatherSheen(new Color(0.2, 0.2, 0.2)).r).toBeCloseTo(0.36, 6);
    expect(leatherSheen(new Color(0.6, 0.6, 0.6)).r).toBeCloseTo(0.76, 6);
  });

  // The sheen lights the whole of the leather, not only its edges: lifted toward white it laid a
  // haze over Cherry and greyed it to a dusty rose on the page. Cherry's leather and trim, and the
  // trims of Blush and Sage, are the darkest bases of the skins.
  it('keeps a dark leather deep: its sheen stays close to its base', () => {
    for (const hex of ['#7a1d2a', '#4a0f18', '#7d3352', '#3f5a3d']) {
      const base = new Color(hex);
      expect(gap(leatherSheen(base), base), hex).toBeLessThan(0.1);
    }
  });

  it('gives a light leather the full lift it always had', () => {
    // Blush, Sage and Cream: the base lifted 40 % of the way to white.
    for (const hex of ['#e296a4', '#9db39a', '#eadfca']) {
      const was = new Color(hex).lerp(new Color('#ffffff'), 0.4);
      expect(gap(leatherSheen(new Color(hex)), was), hex).toBeLessThan(0.01);
    }
  });

  it('is the sheen the leather gets from its GLB colour', () => {
    const root = new Group();
    const mesh = meshOf('leather', '#e296a4');
    root.add(mesh);
    const upgraded = upgradeMaterials(root);
    expect((mesh.material as MeshPhysicalMaterial).sheenColor.getHexString()).toBe(
      leatherSheen(new Color('#e296a4')).getHexString(),
    );
    upgraded.dispose();
  });
});

describe('applySkin', () => {
  /** Every material a skin recolours, two no skin touches (in colours of their own), a print. */
  function scene() {
    const root = new Group();
    for (const name of Object.keys(SKIN_ROLES)) root.add(meshOf(name));
    root.add(meshOf('chrome', '#8090a0'), meshOf('btn', '#d0c0b0'), meshOf('art_disc'));
    return { root, upgraded: upgradeMaterials(root) };
  }
  function materialOf(root: Group, name: string): MeshPhysicalMaterial {
    for (const child of root.children) {
      const material = (child as Mesh).material as MeshPhysicalMaterial;
      if (material.name === name) return material;
    }
    throw new Error(`no ${name}`);
  }

  it('recolours every material SKIN_ROLES names to its role colour, on the same material', () => {
    const { root, upgraded } = scene();
    const before = root.children.map((child) => (child as Mesh).material);
    for (const skin of SKINS) {
      upgraded.applyLook({ model: 'suitcase', skin: skin.id });
      const expected = Object.fromEntries(
        Object.entries(SKIN_ROLES).map(([name, role]) => [name, skin.palette[role]]),
      );
      expect(skinColours(root), skin.id).toEqual(expected);
    }
    root.children.forEach((child, i) => expect((child as Mesh).material).toBe(before[i]));
    upgraded.dispose();
  });

  it('leaves every other material as the GLB made it', () => {
    const { root, upgraded } = scene();
    upgraded.applyLook({ model: 'suitcase', skin: 'cherry' });
    expect(materialOf(root, 'chrome').color.getHexString()).toBe('8090a0');
    expect(materialOf(root, 'btn').color.getHexString()).toBe('d0c0b0');
    expect(materialOf(root, 'art_disc').color.getHexString()).toBe('ffffff');
    upgraded.dispose();
  });

  it('lifts the leather sheen from its new base, and leaves the lining its white one', () => {
    const { root, upgraded } = scene();
    for (const skin of SKINS) {
      upgraded.applyLook({ model: 'suitcase', skin: skin.id });
      expect(materialOf(root, 'leather').sheenColor.getHexString(), skin.id).toBe(
        leatherSheen(new Color(skin.palette.leather)).getHexString(),
      );
    }
    expect(materialOf(root, 'lining').sheenColor.getHexString()).toBe('ffffff');
    upgraded.dispose();
  });

  it('brings the sheen with the new base: deep under a dark leather, lifted again under a light one', () => {
    const { root, upgraded } = scene();
    const sheenGap = (name: string) => {
      const { sheenColor, color } = materialOf(root, name);
      return gap(sheenColor, color);
    };
    upgraded.applyLook({ model: 'suitcase', skin: 'cherry' });
    expect(sheenGap('leather')).toBeLessThan(0.1);
    expect(sheenGap('trim')).toBeLessThan(0.1);
    // Blush's leather is a light one, its trim a dark one.
    upgraded.applyLook({ model: 'suitcase', skin: 'blush' });
    expect(sheenGap('leather')).toBeGreaterThan(0.2);
    expect(sheenGap('trim')).toBeLessThan(0.1);
    upgraded.dispose();
  });

  it('reads a hex as sRGB and keeps the linear colour Blender wrote into the GLB', () => {
    const { root, upgraded } = scene();
    const blush = skinById('blush');
    const probe: Skin = { ...blush, palette: { ...blush.palette, leather: '#e296a4' } };
    const materials = new Set<Material>();
    root.traverse((object) => {
      if ((object as Mesh).isMesh) materials.add((object as Mesh).material as Material);
    });
    applySkin(materials, probe);
    // Blender's lin(226, 150, 164): the GLB's baseColorFactor for leather.
    const { r, g, b } = materialOf(root, 'leather').color;
    expect(r).toBeCloseTo(0.76052, 4);
    expect(g).toBeCloseTo(0.30499, 4);
    expect(b).toBeCloseTo(0.37124, 4);
    upgraded.dispose();
  });

  it('works on any material by its name', () => {
    const deck = new MeshPhysicalMaterial({ name: 'deck' });
    const cream = skinById('cream');
    applySkin([deck], cream);
    expect(deck.color.getHexString()).toBe(cream.palette.deck.slice(1));
  });
});

describe('applyLook', () => {
  const clearMaterials = () => ({
    shell: new MeshPhysicalMaterial({ name: 'clear_shell' }),
    frame: new MeshPhysicalMaterial({ name: 'clear_frame' }),
    board: new MeshPhysicalMaterial({ name: 'board' }),
    light: new MeshBasicMaterial({ name: 'light' }),
    silk: new MeshPhysicalMaterial({ name: 'silk' }),
    leather: new MeshPhysicalMaterial({ name: 'leather' }),
  });
  const hex = (c: Color) => `#${c.getHexString(SRGBColorSpace)}`;
  const look: ClearLook = { shell: 'blush', frame: 'black', board: 'purple', light: 'pink' };

  it('colours the Clear model part by part from its swatches', () => {
    const m = clearMaterials();
    applyLook(Object.values(m), { model: 'clear', clear: look });
    expect(hex(m.shell.color)).toBe(clearSwatch(look, 'shell').tint);
    expect(hex(m.frame.color)).toBe(clearSwatch(look, 'frame').colour);
    expect(m.frame.metalness).toBe(clearSwatch(look, 'frame').metalness);
    expect(m.frame.roughness).toBe(clearSwatch(look, 'frame').roughness);
    expect(hex(m.board.color)).toBe(clearSwatch(look, 'board').colour);
    expect(hex(m.light.color)).toBe(clearSwatch(look, 'light').glow);
  });

  it('leaves the suitcase’s materials to its skin, and the Clear model’s to its look', () => {
    const m = clearMaterials();
    const before = hex(m.leather.color);
    applyLook(Object.values(m), { model: 'clear', clear: look });
    expect(hex(m.leather.color)).toBe(before);
    const shell = hex(m.shell.color);
    applyLook(Object.values(m), { model: 'suitcase', skin: 'cherry' });
    expect(hex(m.shell.color)).toBe(shell);
    expect(hex(m.leather.color)).toBe(skinById('cherry').palette.leather);
  });

  describe('the Deck', () => {
    const deck = { body: 'silver', light: 'red' };
    const deckMaterials = () => ({
      body: new MeshPhysicalMaterial({ name: 'deck_body' }),
      light: new MeshBasicMaterial({ name: 'deck_light' }),
      hardware: new MeshPhysicalMaterial({ name: 'hardware' }),
      pattern: new MeshBasicMaterial({ name: 'deck_pattern' }),
      shell: new MeshPhysicalMaterial({ name: 'clear_shell' }),
    });

    it('colours the body and the light from their swatches', () => {
      const m = deckMaterials();
      applyLook(Object.values(m), { model: 'deck', deck });
      expect(hex(m.body.color)).toBe(deckSwatch(deck, 'body').colour);
      expect(m.body.metalness).toBe(deckSwatch(deck, 'body').metalness);
      expect(m.body.roughness).toBe(deckSwatch(deck, 'body').roughness);
      expect(hex(m.light.color)).toBe(deckSwatch(deck, 'light').glow);
    });

    it('leaves every other material alone, the suitcase’s hardware and the print layer included', () => {
      const m = deckMaterials();
      const before = Object.fromEntries(
        Object.entries(m).map(([key, material]) => [key, hex(material.color)]),
      );
      applyLook(Object.values(m), { model: 'deck', deck });
      for (const key of ['hardware', 'pattern', 'shell'] as const) {
        expect(hex(m[key].color), key).toBe(before[key]);
      }
    });

    it('is left alone by the other looks, and reports its colours to the live check', () => {
      const m = deckMaterials();
      applyLook(Object.values(m), { model: 'deck', deck });
      const body = hex(m.body.color);
      applyLook(Object.values(m), { model: 'suitcase', skin: 'cherry' });
      expect(hex(m.body.color)).toBe(body);
      const root = new Group();
      for (const material of [m.body, m.light, m.pattern]) {
        root.add(new Mesh(new BoxGeometry(), material));
      }
      expect(skinColours(root)).toEqual({
        deck_body: deckSwatch(deck, 'body').colour,
        deck_light: deckSwatch(deck, 'light').glow,
      });
    });
  });

  it('prints the silkscreen light on a dark board and dark on the white one, as the render does', () => {
    const m = clearMaterials();
    applyLook(Object.values(m), { model: 'clear', clear: { ...look, board: 'green' } });
    expect(hex(m.silk.color)).toBe(SILK_LIGHT);
    applyLook(Object.values(m), { model: 'clear', clear: { ...look, board: 'white' } });
    expect(hex(m.silk.color)).toBe(SILK_DARK);
  });

  it('recolours the traces from the board and the etching from the shell, for every swatch', () => {
    const trace = new MeshPhysicalMaterial({ name: 'trace' });
    const etch = new MeshPhysicalMaterial({ name: 'etch' });
    for (const board of CLEAR_SWATCHES.board) {
      for (const shell of CLEAR_SWATCHES.shell) {
        applyLook([trace, etch], {
          model: 'clear',
          clear: { ...look, board: board.id, shell: shell.id },
        });
        expect(hex(trace.color), board.id).toBe(traceColour(board.colour));
        expect(hex(etch.color), shell.id).toBe(etchColour(shell.tint));
      }
    }
  });

  // By hand: the green board #1e6b3b is dark, so each channel goes 22 % of the way to 255:
  // 30 + 49.5 -> 80 (0x50), 107 + 32.56 -> 140 (0x8c), 59 + 43.12 -> 102 (0x66).
  it('gives the default green board the traces #508c66', () => {
    const trace = new MeshPhysicalMaterial({ name: 'trace' });
    applyLook([trace], { model: 'clear', clear: { ...look, board: 'green' } });
    expect(hex(trace.color)).toBe('#508c66');
  });

  it('never recolours the gold', () => {
    const gold = makeMaterial('gold', new MeshStandardMaterial(), {
      grain: new Texture(),
      quilt: new Texture(),
      weave: new Texture(),
    }) as MeshPhysicalMaterial;
    for (const board of CLEAR_SWATCHES.board) {
      applyLook([gold], { model: 'clear', clear: { ...look, board: board.id } });
      expect(hex(gold.color)).toBe('#d6ae5a');
      expect(gold.metalness).toBe(1);
      expect(gold.roughness).toBe(0.3);
    }
    applyLook([gold], { model: 'suitcase', skin: 'cherry' });
    expect(hex(gold.color)).toBe('#d6ae5a');
  });

  it('lists the traces and the etching, not the gold, for the live check', () => {
    const root = new Group();
    for (const name of ['trace', 'etch', 'gold']) root.add(meshOf(name));
    applyLook(
      root.children.map((c) => (c as Mesh).material as Material),
      { model: 'clear', clear: look },
    );
    expect(Object.keys(skinColours(root)).sort()).toEqual(['etch', 'trace']);
  });

  it('leaves the silkscreen alone for a suitcase look', () => {
    const m = clearMaterials();
    const before = hex(m.silk.color);
    applyLook(Object.values(m), { model: 'suitcase', skin: 'cherry' });
    expect(hex(m.silk.color)).toBe(before);
  });

  it('reports the Clear model’s colours to the live check, part by part', () => {
    const m = clearMaterials();
    const root = new Group();
    for (const material of Object.values(m)) root.add(new Mesh(new BoxGeometry(), material));
    applyLook(Object.values(m), { model: 'clear', clear: look });
    expect(skinColours(root)).toEqual({
      clear_shell: clearSwatch(look, 'shell').tint,
      clear_frame: clearSwatch(look, 'frame').colour,
      board: clearSwatch(look, 'board').colour,
      light: clearSwatch(look, 'light').glow,
      silk: SILK_LIGHT,
      leather: hex(m.leather.color),
    });
  });
});

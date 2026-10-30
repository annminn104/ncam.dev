import {
  BoxGeometry,
  Color,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from 'three';
import { describe, expect, it } from 'vitest';
import { SKINS, skinById, type Skin } from '../skins';
import { DYNAMIC_MATERIALS } from './contract';
import { applySkin, leatherSheen, makeMaterial, skinColours, upgradeMaterials } from './materials';
import { SKIN_ROLES } from './material-roles';

const meshOf = (name: string, color = '#ffffff') =>
  new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name, color }));

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
  it('lifts a colour 40 % of the way to white, in the linear working colour', () => {
    expect(leatherSheen(new Color(0, 0, 0)).toArray()).toEqual([0.4, 0.4, 0.4]);
    expect(leatherSheen(new Color(1, 1, 1)).toArray()).toEqual([1, 1, 1]);
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
      upgraded.applySkin(skin);
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
    upgraded.applySkin(skinById('cherry'));
    expect(materialOf(root, 'chrome').color.getHexString()).toBe('8090a0');
    expect(materialOf(root, 'btn').color.getHexString()).toBe('d0c0b0');
    expect(materialOf(root, 'art_disc').color.getHexString()).toBe('ffffff');
    upgraded.dispose();
  });

  it('lifts the leather sheen from its new base, and leaves the lining its white one', () => {
    const { root, upgraded } = scene();
    for (const skin of SKINS) {
      upgraded.applySkin(skin);
      expect(materialOf(root, 'leather').sheenColor.getHexString(), skin.id).toBe(
        leatherSheen(new Color(skin.palette.leather)).getHexString(),
      );
    }
    expect(materialOf(root, 'lining').sheenColor.getHexString()).toBe('ffffff');
    upgraded.dispose();
  });

  it('reads a hex as sRGB and keeps the linear colour Blender wrote into the GLB', () => {
    const { root, upgraded } = scene();
    const blush = skinById('blush');
    const probe: Skin = { ...blush, palette: { ...blush.palette, leather: '#e296a4' } };
    upgraded.applySkin(probe);
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

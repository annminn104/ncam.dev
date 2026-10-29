import {
  BoxGeometry,
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
import { DYNAMIC_MATERIALS } from './contract';
import { makeMaterial, upgradeMaterials } from './materials';

const meshOf = (name: string) => new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name }));

describe('makeMaterial', () => {
  const source = new MeshStandardMaterial({ name: 'from_the_glb' });
  const grain = new Texture();

  // The studio's panels are bright: reflected in full they lift the blacks of what is behind the
  // glass (the booklet's art) and leave hot spots on it. The edges and a faint reflection still
  // read as glass.
  it('makes the crystal clear glass with a faint reflection, not a mirror-strong one', () => {
    const glass = makeMaterial('crystal', source, grain) as MeshPhysicalMaterial;
    expect(glass.transmission).toBe(1);
    expect(glass.metalness).toBe(0);
    expect(glass.roughness).toBeLessThanOrEqual(0.05);
    expect(glass.specularIntensity).toBeGreaterThan(0);
    expect(glass.specularIntensity).toBeLessThanOrEqual(0.4);
  });

  it('makes a print a paper with a soft sheen: no clearcoat, a reflection well under full', () => {
    const print = makeMaterial('print', source, grain) as MeshPhysicalMaterial;
    expect(print.clearcoat).toBe(0);
    expect(print.roughness).toBeGreaterThanOrEqual(0.3);
    expect(print.specularIntensity).toBeGreaterThan(0);
    expect(print.specularIntensity).toBeLessThanOrEqual(0.4);
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

  it('hands each of the six printed materials to the page as a slot, and puts it on its mesh', () => {
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

import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SpotLight,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  cutTop,
  extractHotspots,
  extractWindWeights,
  isGlass,
  isNightLight,
  isPunctualLight,
  isUncut,
  isWater,
  owningNode,
} from './extras';

function node(name: string, userData: Record<string, unknown> = {}): Object3D {
  const object = new Object3D();
  object.name = name;
  object.userData = userData;
  return object;
}

/** What GLTFLoader builds for a named glTF node: the sanitized name plus the original in userData.name. */
function gltfNode(name: string, extras: Record<string, unknown> = {}): Object3D {
  return node(name, { ...extras, name });
}

/** A mesh as GLTFLoader names it when the node has no name of its own: after the mesh data. */
function unnamedChildMesh(meshName: string): Mesh {
  const mesh = new Mesh();
  mesh.name = meshName;
  return mesh;
}

describe('extractHotspots', () => {
  it('reads HS_* extras and fills defaults', () => {
    const root = new Group();
    root.add(
      node('HS_pond', { action: 'focus', label: 'Koi pond', radius: 1.5 }),
      node('HS_door', { action: 'toggle', clip: 'act_door_open' }),
      node('Tree'),
    );
    const hotspots = extractHotspots(root);
    expect(
      hotspots.map((h) => ({
        name: h.name,
        action: h.action,
        clip: h.clip,
        label: h.label,
        radius: h.radius,
      })),
    ).toEqual([
      { name: 'pond', action: 'focus', clip: null, label: 'Koi pond', radius: 1.5 },
      { name: 'door', action: 'toggle', clip: 'act_door_open', label: 'door', radius: 0.5 },
    ]);
    expect(hotspots[0].object.name).toBe('HS_pond');
  });

  it('skips hotspots with unknown actions and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new Group();
    root.add(node('HS_bad', { action: 'jump' }));
    expect(extractHotspots(root)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('isNightLight / isWater', () => {
  it('detects night_light true or 1', () => {
    expect(isNightLight(node('Lamp', { night_light: true }))).toBe(true);
    expect(isNightLight(node('Lamp', { night_light: 1 }))).toBe(true);
    expect(isNightLight(node('Lamp'))).toBe(false);
  });

  it('detects WATER_* meshes only', () => {
    const water = new Mesh();
    water.name = 'WATER_surface';
    expect(isWater(water)).toBe(true);
    expect(isWater(node('WATER_empty'))).toBe(false);
  });
});

describe('owningNode', () => {
  it('is the object itself when it carries a glTF node name', () => {
    const named = gltfNode('Rock');
    new Group().add(gltfNode('Parent'), named);
    expect(owningNode(named)).toBe(named);
  });

  it('is the nearest named ancestor for an unnamed child (gltf-transform splits animated nodes)', () => {
    const fish = gltfNode('Fish');
    const mesh = unnamedChildMesh('Fish_mesh');
    fish.add(mesh);
    expect(owningNode(mesh)).toBe(fish);
  });

  it('skips several unnamed levels', () => {
    const outer = gltfNode('Outer');
    const middle = new Group();
    const mesh = unnamedChildMesh('Mesh');
    outer.add(middle);
    middle.add(mesh);
    expect(owningNode(mesh)).toBe(outer);
  });

  it('falls back to the object itself when no ancestor has a glTF node name', () => {
    const mesh = unnamedChildMesh('Loose');
    new Group().add(mesh);
    expect(owningNode(mesh)).toBe(mesh);
  });
});

describe('isNightLight / isWater on split glTF structures', () => {
  it('reads night_light from the owning node of an unnamed child mesh', () => {
    const lamp = gltfNode('Lamp', { night_light: true });
    const bulb = unnamedChildMesh('Lamp_bulb');
    lamp.add(bulb);
    expect(isNightLight(bulb)).toBe(true);
  });

  it('does not flag a named child object of a night-light parent', () => {
    const lamp = gltfNode('Lamp', { night_light: true });
    const pole = gltfNode('Lamp_pole');
    lamp.add(pole);
    expect(isNightLight(pole)).toBe(false);
  });

  it('matches WATER_* on the owning node, not on the mesh data name', () => {
    const water = gltfNode('WATER_surface');
    const mesh = unnamedChildMesh('Plane.003');
    water.add(mesh);
    expect(isWater(mesh)).toBe(true);
    const fish = gltfNode('Fish');
    const fishMesh = unnamedChildMesh('WATER_looking_mesh_data');
    fish.add(fishMesh);
    expect(isWater(fishMesh)).toBe(false);
  });
});

describe('isUncut and cutTop', () => {
  it("reads uncut from the owning glTF node: what the dollhouse cut clips at the void's plane (the chandelier in the void)", () => {
    const chandelier = gltfNode('Chandelier', { uncut: true, night_light: true });
    const crystals = unnamedChildMesh('Chandelier_1'); // a multi-material mesh is a group of meshes under its node
    chandelier.add(crystals);
    expect(isUncut(crystals)).toBe(true);
    expect(isUncut(chandelier)).toBe(true);
    expect(isUncut(gltfNode('Sofa'))).toBe(false);
    expect(isUncut(gltfNode('Odd', { uncut: 1 }))).toBe(true);
    expect(isUncut(gltfNode('Off', { uncut: false }))).toBe(false);
  });

  it("reads cut_top from the owning glTF node: how low the void's plane may come for it (its crown, module space)", () => {
    const chandelier = gltfNode('Chandelier', { uncut: true, cut_top: 5.72 });
    const crystals = unnamedChildMesh('Chandelier_1');
    chandelier.add(crystals);
    expect(cutTop(crystals)).toBe(5.72);
    expect(cutTop(chandelier)).toBe(5.72);
    expect(cutTop(gltfNode('Bare', { uncut: true }))).toBeNull();
    expect(cutTop(gltfNode('Text', { uncut: true, cut_top: '5.72' }))).toBeNull();
    expect(cutTop(gltfNode('Nan', { uncut: true, cut_top: Number.NaN }))).toBeNull();
  });
});

describe('extractWindWeights', () => {
  it('copies the denormalized red channel into a 1-component attribute', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'color',
      new BufferAttribute(new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255, 128, 0, 0, 255]), 4, true),
    );
    const weights = extractWindWeights(geometry);
    expect(weights?.itemSize).toBe(1);
    expect(Array.from(weights?.array ?? [])).toEqual([1, 0, expect.closeTo(0.502, 3)]);
  });

  it('returns null when there is no color attribute', () => {
    expect(extractWindWeights(new BufferGeometry())).toBeNull();
  });
});

describe('isGlass / isPunctualLight', () => {
  it('recognises GLASS_* materials by name', () => {
    expect(isGlass(new MeshStandardMaterial({ name: 'GLASS_clear' }))).toBe(true);
    expect(isGlass(new MeshStandardMaterial({ name: 'M_white' }))).toBe(false);
  });

  it('recognises FROSTED_* materials as glass too (villa v2 spec §7)', () => {
    expect(isGlass(new MeshStandardMaterial({ name: 'FROSTED_bath' }))).toBe(true);
    expect(isGlass(new MeshStandardMaterial({ name: 'M_frosted_look' }))).toBe(false); // a prefix, not a substring
  });

  it('recognises point and spot lights only', () => {
    expect(isPunctualLight(new PointLight())).toBe(true);
    expect(isPunctualLight(new SpotLight())).toBe(true);
    expect(isPunctualLight(new DirectionalLight())).toBe(false);
    expect(isPunctualLight(new Object3D())).toBe(false);
  });
});

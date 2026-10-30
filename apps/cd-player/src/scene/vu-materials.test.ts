import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { RequiredNode } from './contract';
import type { Slots } from './materials';
import type { PlayerModel } from './model';
import { VU_NODES, vuMaterialsFor } from './vu-materials';

function fakeModel() {
  const shared = new MeshBasicMaterial({ name: 'vu' });
  const root = new Group();
  const nodes: Partial<Record<RequiredNode, Object3D>> = {};
  const meshes = VU_NODES.map((name) => {
    const mesh = new Mesh(new BoxGeometry(), shared);
    mesh.name = name;
    root.add(mesh);
    nodes[name] = mesh;
    return mesh;
  });
  const dispose = vi.fn();
  const model: PlayerModel = {
    root,
    nodes: nodes as Record<RequiredNode, Object3D>,
    slots: {} as Slots,
    applySkin: vi.fn(),
    dispose,
  };
  return { model, shared, meshes, dispose };
}

describe('vuMaterialsFor', () => {
  it('gives each of the ten segments a material of its own, off, and disposes them with the model', () => {
    const { model, shared, meshes, dispose } = fakeModel();
    const materials = vuMaterialsFor(model);
    expect(materials).toHaveLength(10);
    expect(new Set(materials).size).toBe(10);
    meshes.forEach((mesh, i) => {
      expect(mesh.material).toBe(materials[i]);
      expect(mesh.material).not.toBe(shared);
    });
    const spies = materials.map((material) => vi.spyOn(material, 'dispose'));
    model.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clones once per model', () => {
    const { model } = fakeModel();
    expect(vuMaterialsFor(model)).toBe(vuMaterialsFor(model));
  });
});

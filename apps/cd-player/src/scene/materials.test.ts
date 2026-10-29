import {
  BoxGeometry,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  type MeshPhysicalMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';
import { upgradeMaterials } from './materials';

describe('upgradeMaterials', () => {
  it('samples the leather grain filtered and mip-mapped, so it fades with distance and does not shimmer', () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'leather' }));
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
});

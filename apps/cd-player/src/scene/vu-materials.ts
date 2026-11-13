import type { Mesh, MeshBasicMaterial } from 'three';
import type { CdNode } from './contract';
import type { PlayerModel } from './model';
import { VU_OFF, VU_SEGMENTS } from './vu';

/** The strip's segments, bottom to top: the `vu_seg_` nodes of the model contract. */
export const VU_NODES = Array.from({ length: VU_SEGMENTS }, (_, i) => `vu_seg_${i}` as CdNode);

const clones = new WeakMap<PlayerModel, MeshBasicMaterial[]>();

/**
 * The ten segments share one `vu` material in the GLB; each gets its own copy here, unlit, so each
 * can light alone. Once per model (StrictMode renders twice), disposed with the model.
 */
export function vuMaterialsFor(model: PlayerModel): MeshBasicMaterial[] {
  const existing = clones.get(model);
  if (existing) return existing;
  const materials = VU_NODES.map((name, i) => {
    const mesh = model.nodes[name] as Mesh;
    const own = (mesh.material as MeshBasicMaterial).clone();
    own.name = `vu_${i}`;
    own.color.set(VU_OFF);
    mesh.material = own;
    return own;
  });
  const disposeModel = model.dispose;
  model.dispose = () => {
    disposeModel();
    for (const material of materials) material.dispose();
  };
  clones.set(model, materials);
  return materials;
}

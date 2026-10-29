import type { Group, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { REQUIRED_NODES, type RequiredNode } from './contract';
import { upgradeMaterials, type Slots } from './materials';

export class ModelContractError extends Error {
  constructor(readonly missing: string[]) {
    super(`cd-player.glb is missing ${missing.join(', ')}`);
    this.name = 'ModelContractError';
  }
}

export interface PlayerModel {
  root: Group;
  nodes: Record<RequiredNode, Object3D>;
  slots: Slots;
  dispose(): void;
}

export async function loadPlayerModel(url: string): Promise<PlayerModel> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  const nodes = {} as Record<RequiredNode, Object3D>;
  const missing: string[] = [];
  for (const name of REQUIRED_NODES) {
    const node = root.getObjectByName(name);
    if (node) nodes[name] = node;
    else missing.push(name);
  }
  if (missing.length) throw new ModelContractError(missing);
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  const materials = upgradeMaterials(root);
  root.updateMatrixWorld(true);
  return {
    root,
    nodes,
    slots: materials.slots,
    dispose: () => {
      materials.dispose();
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    },
  };
}

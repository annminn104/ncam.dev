import type { Group, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Skin } from '../skins';
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
  /** Recolours the model for `skin` in place: no reload, no new download (materials.ts). */
  applySkin(skin: Skin): void;
  dispose(): void;
}

/** What GLTFLoader's progress events carry (`ProgressEvent`'s fields), so node tests can make one. */
export type DownloadProgress = Pick<ProgressEvent, 'lengthComputable' | 'loaded' | 'total'>;

/**
 * How much of the GLB has come, 0–1, or null when the response names no length. Over a compressed
 * transfer the decoded bytes are counted against the encoded length and can pass it: held at 1.
 */
export function downloadFraction({
  lengthComputable,
  loaded,
  total,
}: DownloadProgress): number | null {
  if (!lengthComputable || !(total > 0)) return null;
  return Math.min(1, Math.max(0, loaded / total));
}

/** Loads the player; `onProgress` hears the GLB's download as it comes (see `downloadFraction`). */
export async function loadPlayerModel(
  url: string,
  onProgress?: (fraction: number | null) => void,
): Promise<PlayerModel> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(
    url,
    onProgress ? (event: ProgressEvent) => onProgress(downloadFraction(event)) : undefined,
  );
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
    applySkin: materials.applySkin,
    dispose: () => {
      materials.dispose();
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    },
  };
}

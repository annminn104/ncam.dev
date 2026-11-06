import { LoaderUtils, type Group, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Look } from '../looks';
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
  /** Recolours the model for `look` in place: no reload, no new download (materials.ts). */
  applyLook(look: Look): void;
  dispose(): void;
}

/** What a progress event of the download carries (`ProgressEvent`'s fields). */
export type DownloadProgress = Pick<ProgressEvent, 'lengthComputable' | 'loaded' | 'total'>;

/** The most a chunk counts for, 99 %: only the end of the stream is the whole (`downloadModel`). */
const STREAMING_CAP = 0.99;

/**
 * How much of the GLB has come while it streams, 0–0.99, or null when the response names no
 * length. A chunk never makes the whole: over a compressed transfer the decoded bytes are counted
 * against the encoded length and can pass it long before the end, so the count holds at 99 %.
 */
export function downloadFraction({
  lengthComputable,
  loaded,
  total,
}: DownloadProgress): number | null {
  if (!lengthComputable || !(total > 0)) return null;
  return Math.min(STREAMING_CAP, Math.max(0, loaded / total));
}

/**
 * Fetches the GLB, telling `onProgress` how it goes: null as the request goes out, a fraction as
 * each chunk arrives (see `downloadFraction`) and 1 once the stream has ended, the only report of
 * the whole (the boot's stall watch ends on it, src/boot.ts); `signal` aborts the request. Every
 * call asks anew: three's FileLoader joins a load to a request for the same URL still in flight,
 * so a boot that tried again after a stall waited on the request that had stalled.
 */
export async function downloadModel(
  url: string,
  onProgress?: (fraction: number | null) => void,
  signal?: AbortSignal,
  fetchModel: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  onProgress?.(null);
  const response = await fetchModel(url, { signal });
  if (!response.ok) throw new Error(`cd-player.glb answered ${response.status}`);
  if (!onProgress || !response.body) return response.arrayBuffer();
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(downloadFraction({ lengthComputable: total > 0, loaded, total }));
  }
  onProgress(1);
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/**
 * Loads the player; `onProgress` hears the GLB's download as it goes (see `downloadModel`),
 * and `signal` aborts the download (a scene that lets go of the load).
 */
export async function loadPlayerModel(
  url: string,
  onProgress?: (fraction: number | null) => void,
  signal?: AbortSignal,
): Promise<PlayerModel> {
  const data = await downloadModel(url, onProgress, signal);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(data, LoaderUtils.extractUrlBase(url));
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
    applyLook: materials.applyLook,
    dispose: () => {
      materials.dispose();
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    },
  };
}

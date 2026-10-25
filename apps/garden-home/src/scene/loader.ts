import { useLoader, useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let ktx2: KTX2Loader | null = null;
/** public/basis/ on the remote's origin; GardenScene sets it before the first module loads. */
let transcoderPath = '/basis/';
/** Every module URL loaded since the last release, for releaseLoaders to drop from R3F's cache. */
const loaded = new Set<string>();

export function setTranscoderPath(path: string): void {
  transcoderPath = path;
  ktx2?.setTranscoderPath(path);
}

export function getKTX2Loader(gl: WebGLRenderer): KTX2Loader {
  ktx2 ??= new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(gl);
  return ktx2;
}

/** Suspends until a module GLB (meshopt + KTX2) is loaded; cached per URL by R3F. */
export function useModuleGLTF(url: string): GLTF {
  const gl = useThree((state) => state.gl);
  loaded.add(url);
  return useLoader(GLTFLoader, url, (loader) => {
    loader.setKTX2Loader(getKTX2Loader(gl));
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}

/** Drops the parsed modules from R3F's cache and stops the KTX2 transcoder's workers. */
export function releaseLoaders(): void {
  for (const url of loaded) useLoader.clear(GLTFLoader, url);
  loaded.clear();
  ktx2?.dispose();
  ktx2 = null;
}

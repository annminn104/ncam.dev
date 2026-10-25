import { useLoader, useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let ktx2: KTX2Loader | null = null;

function getKTX2Loader(gl: WebGLRenderer): KTX2Loader {
  ktx2 ??= new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl);
  return ktx2;
}

/** Suspends until a module GLB (meshopt + KTX2) is loaded; cached per URL by R3F. */
export function useModuleGLTF(url: string): GLTF {
  const gl = useThree((state) => state.gl);
  return useLoader(GLTFLoader, url, (loader) => {
    loader.setKTX2Loader(getKTX2Loader(gl));
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}

import { useLoader } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Loader } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { onDispose, own } from '../../dispose';
import { parseFigureGlb, type FigureData } from './figure-glb';

/** A figure's arrays as the geometry its paint and outline materials read. */
export function figureGeometry(data: FigureData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(data.normal, 3));
  geometry.setAttribute('_slot', new BufferAttribute(data.slot, 1));
  geometry.setAttribute('_line', new BufferAttribute(data.line, 1));
  geometry.setAttribute('outlineNormal', new BufferAttribute(data.outlineNormal, 3));
  geometry.setIndex(new BufferAttribute(data.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Every file asked for since the last battle ended, loaded or failed: the reset drops each from
 * R3F's cache.
 */
const requested = new Set<string>();
/** The files among them that loaded. */
const loaded = new Set<string>();

/** Whether this battle has `url`'s geometry already: FigureRenderer picks its stand-in by it. */
export function isFigureLoaded(url: string): boolean {
  return loaded.has(url);
}

/**
 * Loads a figure GLB (figure-glb.ts) into a BufferGeometry the battle owns (dispose.ts), for
 * R3F's `useLoader(FigureLoader, url)`, which suspends on it and caches it by URL. It fetches
 * the file itself: three's FileLoader reports progress with `ProgressEvent`, which Node lacks.
 */
export class FigureLoader extends Loader<BufferGeometry> {
  override load(
    url: string,
    onLoad: (geometry: BufferGeometry) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    requested.add(url);
    const href = this.manager.resolveURL(this.path + url);
    this.manager.itemStart(href);
    fetch(href, {
      headers: this.requestHeader,
      credentials: this.withCredentials ? 'include' : 'same-origin',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Promise.all([response.arrayBuffer(), MeshoptDecoder.ready]);
      })
      .then(([bytes]) => {
        const geometry = own(figureGeometry(parseFigureGlb(bytes, MeshoptDecoder)));
        loaded.add(url);
        onLoad(geometry);
      })
      .catch((error: unknown) => {
        this.manager.itemError(href);
        onError?.(error);
      })
      .finally(() => this.manager.itemEnd(href));
  }
}

// The geometries go with the battle (disposeOwned); so must R3F's cache entries, or the next
// battle would be handed a freed geometry, or a failure it should ask for again.
onDispose(() => {
  for (const url of requested) useLoader.clear(FigureLoader, url);
  requested.clear();
  loaded.clear();
});

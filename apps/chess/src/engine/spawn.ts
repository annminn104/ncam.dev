import type { WorkerLike } from './engine';
import { assetUrl } from '../lib/asset-url';

/**
 * Start Stockfish from this remote's origin even when the page is the host's.
 * Workers must be same-origin, so the script runs from a blob URL, and the wasm
 * path rides in the URL hash. Checked against the shipped build
 * (stockfish-17.1-lite-single): its loader reads `self.location.hash.substr(1)`,
 * splits on ",", and takes decodeURIComponent(part 0) as the wasm location,
 * defaulting to a sibling `.wasm` of the page URL only when the hash is empty.
 */
export async function spawnStockfish(base: string): Promise<WorkerLike> {
  const jsUrl = assetUrl('stockfish/stockfish.js', base);
  const wasmUrl = assetUrl('stockfish/stockfish.wasm', base);
  const sameOrigin = new URL(jsUrl, location.href).origin === location.origin;
  if (sameOrigin)
    return new Worker(`${jsUrl}#${encodeURIComponent(wasmUrl)}`) as unknown as WorkerLike;
  const source = await fetch(jsUrl).then((r) => {
    if (!r.ok) throw new Error(`stockfish.js ${r.status}`);
    return r.text();
  });
  const blob = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  return new Worker(`${blob}#${encodeURIComponent(wasmUrl)}`) as unknown as WorkerLike;
}

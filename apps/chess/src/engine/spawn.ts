import type { WorkerLike } from './engine';
import { download } from './download';
import { assetUrl } from '../lib/asset-url';

/** A download that gets no bytes for this long has stalled. A slow one that keeps coming is fine. */
const STALL_MS = 20_000;

/**
 * Start Stockfish from this remote's origin even when the page is the host's.
 *
 * The ~2 MB wasm is downloaded here, not by the worker. A worker's own fetch can't be watched from
 * outside, so the engine's handshake clock couldn't tell a slow network from a dead engine. This
 * way the worker exists only once the files are in hand, the handshake gets its full budget, and a
 * stalled download fails instead of hanging. The worker instantiates the wasm from a blob URL.
 *
 * Workers must be same-origin, so a cross-origin script runs from a blob URL too. The wasm
 * location rides in the URL hash. Checked against the shipped build
 * (stockfish-19-lite-single): its loader reads `self.location.hash.substr(1)`, splits on ",",
 * and takes decodeURIComponent(part 0) as the wasm location. For split builds it builds a wasm
 * blob URL the same way itself. Only an empty hash makes it default to a sibling `.wasm` of the
 * script URL.
 */
export async function spawnStockfish(
  base: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkerLike> {
  const jsUrl = assetUrl('stockfish/stockfish.js', base);
  const wasmUrl = assetUrl('stockfish/stockfish.wasm', base);
  const sameOrigin = new URL(jsUrl, location.href).origin === location.origin;
  const blobs: string[] = [];
  const blobUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    blobs.push(url);
    return url;
  };
  const revoke = () => {
    for (const url of blobs) URL.revokeObjectURL(url);
  };
  try {
    const script = sameOrigin
      ? jsUrl
      : blobUrl(await download(jsUrl, { type: 'text/javascript', stallMs: STALL_MS, signal }));
    const wasm = blobUrl(
      await download(wasmUrl, { type: 'application/wasm', stallMs: STALL_MS, signal }),
    );
    const worker = new Worker(`${script}#${encodeURIComponent(wasm)}`);
    const terminate = worker.terminate.bind(worker);
    worker.terminate = () => {
      terminate();
      revoke();
    };
    return worker as unknown as WorkerLike;
  } catch (error) {
    revoke();
    throw error;
  }
}

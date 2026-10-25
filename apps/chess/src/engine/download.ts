/**
 * Fetch a file whole, as a Blob of `type`. A slow download is fine however long it takes; one that
 * stalls (no answer, or no bytes, for `stallMs`) is aborted and fails, and so is one whose
 * `signal` aborts.
 */
export async function download(
  url: string,
  { type, stallMs, signal }: { type: string; stallMs: number; signal?: AbortSignal },
): Promise<Blob> {
  const abort = new AbortController();
  const onAbort = () => abort.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => abort.abort(new Error(`${url} stalled for ${stallMs} ms`)), stallMs);
  };
  alive();
  try {
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok || !res.body) {
      res.body?.cancel().catch(() => undefined);
      throw new Error(`${url} ${res.status}`);
    }
    alive();
    const reader = res.body.getReader();
    const parts: BlobPart[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      alive();
    }
    return new Blob(parts, { type });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Rewrites the `<link rel="modulepreload">` tags of a streamed HTML response.
 *
 * TanStack Start preloads each matched route's chunks with plain modulepreload
 * links, which Chrome fetches at High priority. None of them blocks rendering
 * (the entry script is `async`), so by default they go to `fetchpriority="low"`,
 * as Next.js does for its script preloads: they still preload, behind the
 * document, its fonts and its images.
 *
 * A project page drops them instead. Its largest content is the remote's
 * (TOONHUB's figurine, a hero's poster), and on a slow phone every request in
 * flight takes its share of the link whatever its priority: ten host chunks,
 * ~120 KB, held the remote's LCP image back by most of a second. Unpreloaded,
 * the entry script still loads them all, one import wave later, and the host
 * only hydrates its own chrome with them there.
 */
const TAG = '<link rel="modulepreload"';
const LOW = `${TAG} fetchpriority="low"`;

export type PreloadMode = 'lower' | 'drop';

/** The same markup with every modulepreload link at low priority, or gone. */
export function rewriteModulePreloads(html: string, mode: PreloadMode = 'lower'): string {
  if (mode === 'lower') return html.replaceAll(TAG, LOW);
  let out = '';
  let from = 0;
  for (;;) {
    const start = html.indexOf(TAG, from);
    if (start === -1) return out + html.slice(from);
    const end = html.indexOf('>', start);
    // An unclosed tag at the very end is left as it is (never in a full page).
    if (end === -1) return out + html.slice(from);
    out += html.slice(from, start);
    from = end + 1;
  }
}

/** {@link rewriteModulePreloads} with the default mode, for the one-shot callers. */
export function lowerModulePreloads(html: string): string {
  return rewriteModulePreloads(html, 'lower');
}

/**
 * A text stream that does {@link rewriteModulePreloads} across chunk
 * boundaries: it holds back whatever could be an unfinished tag at the end of
 * a chunk (the start of TAG, or a whole TAG whose `>` has not arrived) until
 * the next chunk completes it.
 */
export function lowerModulePreloadsStream(
  mode: PreloadMode = 'lower',
): TransformStream<string, string> {
  let pending = '';
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      const text = pending + chunk;
      const keep = unfinishedTagLength(text);
      pending = text.slice(text.length - keep);
      controller.enqueue(rewriteModulePreloads(text.slice(0, text.length - keep), mode));
    },
    flush(controller) {
      if (pending) controller.enqueue(rewriteModulePreloads(pending, mode));
    },
  });
}

/** How many trailing characters of `text` could belong to a tag not yet closed. */
function unfinishedTagLength(text: string): number {
  // A whole TAG with no `>` after it yet.
  const last = text.lastIndexOf(TAG);
  if (last !== -1 && text.indexOf('>', last) === -1) return text.length - last;
  // Or the beginning of a TAG.
  for (let length = Math.min(TAG.length - 1, text.length); length > 0; length--) {
    if (TAG.startsWith(text.slice(text.length - length))) return length;
  }
  return 0;
}

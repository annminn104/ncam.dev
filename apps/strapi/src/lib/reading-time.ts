export const WORDS_PER_MINUTE = 200;

/** Counts whitespace-separated words in every `text` leaf of a Strapi Blocks tree. */
export function countWords(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce<number>((sum, child) => sum + countWords(child), 0);
  }
  if (node === null || typeof node !== 'object') return 0;

  const record = node as { text?: unknown; children?: unknown };
  let words = 0;
  if (typeof record.text === 'string') {
    words += record.text.split(/\s+/).filter(Boolean).length;
  }
  if (record.children !== undefined) {
    words += countWords(record.children);
  }
  return words;
}

/** Whole minutes at 200 wpm, never less than 1. Accepts any JSON (missing body → 1). */
export function estimateReadingTime(blocks: unknown): number {
  return Math.max(1, Math.ceil(countWords(blocks) / WORDS_PER_MINUTE));
}

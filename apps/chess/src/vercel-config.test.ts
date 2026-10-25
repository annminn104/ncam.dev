import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Stockfish files keep stable names (scripts/copy-stockfish.mjs writes stockfish.js and
// stockfish.wasm whatever the version), so a browser must ask the server before it reuses its
// copy. Cached as immutable, a returning visitor would keep the old js/wasm pair after an upgrade.
interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
};

/** The Cache-Control values Vercel would send for `path` (its `source` patterns read as regexps). */
function cacheControl(path: string): string[] {
  return config.headers
    .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
    .flatMap((rule) => rule.headers)
    .filter((header) => header.key.toLowerCase() === 'cache-control')
    .map((header) => header.value);
}

describe('vercel.json', () => {
  it('has browsers revalidate the Stockfish files rather than keep them for good', () => {
    for (const path of ['/stockfish/stockfish.js', '/stockfish/stockfish.wasm']) {
      const values = cacheControl(path);
      expect(values, path).not.toHaveLength(0);
      for (const value of values) {
        expect(value, path).not.toMatch(/immutable/);
        expect(value, path).toMatch(/no-cache|max-age=0\b[^]*must-revalidate/);
      }
    }
  });
});

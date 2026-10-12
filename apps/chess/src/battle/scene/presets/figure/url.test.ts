import { describe, expect, it } from 'vitest';
import { figureUrl } from './url';

describe('figureUrl', () => {
  it("names a piece's high and low files under its preset", () => {
    const base = 'https://chess.example.dev/';
    expect(figureUrl('holy-order', 'k', 'high', base)).toBe(
      'https://chess.example.dev/presets/holy-order/k.glb',
    );
    expect(figureUrl('holy-order', 'p', 'low', base)).toBe(
      'https://chess.example.dev/presets/holy-order/p-low.glb',
    );
  });

  it('falls back to a root-relative path without a base', () => {
    expect(figureUrl('holy-order', 'q', 'high', '')).toBe('/presets/holy-order/q.glb');
  });
});

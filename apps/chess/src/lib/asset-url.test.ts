import { describe, expect, it } from 'vitest';
import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it('joins a remote-relative path onto the base', () => {
    expect(assetUrl('stockfish/stockfish.js', 'https://chess.example.dev/')).toBe(
      'https://chess.example.dev/stockfish/stockfish.js',
    );
  });
  it('keeps a base path and tolerates a leading slash', () => {
    expect(assetUrl('/arenas/cloud-peak-640.avif', 'https://cdn.example.dev/chess/')).toBe(
      'https://cdn.example.dev/chess/arenas/cloud-peak-640.avif',
    );
  });
  it('adds the missing trailing slash on the base', () => {
    expect(assetUrl('a.avif', 'http://localhost:9008')).toBe('http://localhost:9008/a.avif');
  });
  it('returns a root-relative path when there is no base', () => {
    expect(assetUrl('a.avif', '')).toBe('/a.avif');
  });
});

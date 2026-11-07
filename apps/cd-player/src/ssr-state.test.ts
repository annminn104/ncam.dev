import { describe, expect, it } from 'vitest';
import { parseState, serialiseState } from './ssr-state';

describe('ssr-state', () => {
  it('escapes what could end the script element, and parses back', () => {
    const state = {
      ref: { type: 'playlist' as const, id: 'p' },
      collection: null,
      firstTrack: null,
      firstArtist: { id: 'a', name: '</script><b>&\u{2028}\u{2029}', images: [], palette: null },
    };
    const text = serialiseState(state);
    expect(text).not.toMatch(/[<>&\u{2028}\u{2029}]/u);
    expect(parseState(text)).toEqual(state);
  });

  it('reads nothing from junk', () => {
    expect(parseState('{nope')).toBeNull();
    expect(parseState('null')).toBeNull();
    expect(parseState('{"collection":null}')).toBeNull();
    expect(parseState(undefined)).toBeNull();
  });
});

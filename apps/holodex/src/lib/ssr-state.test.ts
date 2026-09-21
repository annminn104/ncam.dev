import { describe, expect, it } from 'vitest';
import { parseState, readState, readStateJson, serialiseState, SSR_STATE_ID } from './ssr-state';

const docWith = (textContent: string | null) => ({
  getElementById: (id: string) => (id === SSR_STATE_ID ? { textContent } : null),
});

describe('serialiseState', () => {
  it('round-trips a dehydrated payload', () => {
    const state = { queries: [{ queryKey: ['sets'], state: { data: [1, 2] } }] };
    expect(JSON.parse(serialiseState(state))).toEqual(state);
  });

  it('escapes a closing script tag so the payload cannot break out of the script', () => {
    const serialised = serialiseState({ evil: '</script><script>alert(1)</script>' });
    expect(serialised).not.toContain('</script>');
    expect(JSON.parse(serialised).evil).toBe('</script><script>alert(1)</script>');
  });
});

describe('readState', () => {
  it('parses the embedded payload', () => {
    expect(readState(docWith('{"queries":[]}'))).toEqual({ queries: [] });
  });

  it('returns undefined when the element is missing', () => {
    expect(readState({ getElementById: () => null })).toBeUndefined();
  });

  it('returns undefined rather than throwing on a corrupt payload', () => {
    expect(readState(docWith('{not json'))).toBeUndefined();
  });

  it('returns undefined for an empty element', () => {
    expect(readState(docWith(''))).toBeUndefined();
  });
});

describe('readStateJson', () => {
  it('returns the raw text, so hydrate can render it back byte-identically', () => {
    // The client re-renders this exact string into the React tree; anything
    // re-serialised could differ from what the server wrote.
    const raw = '{"queries":[{"queryKey":["sets"],"state":{"data":[1,2]}}]}';
    expect(readStateJson(docWith(raw))).toBe(raw);
  });

  it('returns null when the element is missing or empty', () => {
    expect(readStateJson({ getElementById: () => null })).toBeNull();
    expect(readStateJson(docWith(''))).toBeNull();
    expect(readStateJson(docWith(null))).toBeNull();
  });
});

describe('parseState', () => {
  it('parses what readStateJson returned', () => {
    expect(parseState('{"queries":[]}')).toEqual({ queries: [] });
  });

  it('degrades to undefined on null or corrupt input', () => {
    expect(parseState(null)).toBeUndefined();
    expect(parseState('{not json')).toBeUndefined();
  });
});

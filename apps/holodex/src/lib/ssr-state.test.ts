import { describe, expect, it } from 'vitest';
import { readState, serialiseState, SSR_STATE_ID } from './ssr-state';

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

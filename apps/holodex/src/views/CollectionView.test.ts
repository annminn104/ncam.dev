import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { failedIds, LoadFailures } from './CollectionView';

// The server render reports a failed query with no data as pending (it
// expects a fetch on mount), so a failure cannot reach this DOM-free suite's
// markup through SavedCards itself: its two halves are held apart here, and
// the whole checked in a browser.

/** The markup's text: React's `<!-- -->` separators dropped, tags spaced, whitespace collapsed. */
const text = (html: string) =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const render = (ids: string[]) =>
  renderToString(createElement(LoadFailures, { ids, onRetry: () => undefined }));

describe('failedIds', () => {
  it('picks the saved cards whose query failed, in their order', () => {
    const results = [{ isError: false }, { isError: true }, { isError: false }, { isError: true }];
    expect(failedIds(['a', 'b', 'c', 'd'], results)).toEqual(['b', 'd']);
    expect(failedIds(['a'], [{ isError: false }])).toEqual([]);
  });
});

describe('LoadFailures', () => {
  it('names a saved card TCGdex could not serve, with a way to ask again', () => {
    const html = render(['swsh3-25']);
    expect(text(html)).toContain("Couldn't load one saved card from TCGdex: swsh3-25.");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
  });

  it('counts them when there are several', () => {
    expect(text(render(['swsh3-25', 'swsh3-30']))).toContain(
      "Couldn't load 2 saved cards from TCGdex: swsh3-25, swsh3-30.",
    );
  });

  it('says nothing when every saved card loaded', () => {
    expect(render([])).toBe('');
  });
});

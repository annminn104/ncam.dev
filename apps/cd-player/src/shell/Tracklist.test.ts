import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Track } from '../spotify/types';
import { Tracklist } from './Tracklist';

type Props = Parameters<typeof Tracklist>[0];

const noop = () => {};
const track: Track = {
  id: 'a',
  uri: 'spotify:track:a',
  title: 'Housewife',
  artists: 'Tate McRae',
  durationMs: 208_810,
  playable: true,
  explicit: false,
};
const render = (over: Partial<Props> = {}) =>
  renderToString(
    createElement(Tracklist, {
      tracks: [],
      currentIndex: null,
      status: 'idle',
      open: false,
      onToggle: noop,
      onSelect: noop,
      ...over,
    }),
  );

describe('Tracklist', () => {
  it('shows an empty shelf with the message and Retry after a first load that failed', () => {
    const html = render({
      failure: { message: "Spotify didn't answer. Try again in a moment.", onRetry: noop },
    });
    expect(html).toContain('class="cdp-tracks__empty"');
    expect(html).toMatch(/<p role="alert">Spotify didn.*t answer\. Try again in a moment\.<\/p>/);
    expect(html).toMatch(/<button type="button" class="cdp-button">Retry<\/button>/);
    expect(html).not.toContain('<ol');
    // The toggle still names what it opens.
    expect(html).toContain('aria-controls="cdp-tracklist"');
    expect(html).toMatch(/<div id="cdp-tracklist" class="cdp-tracks__empty"/);
  });

  it('gives the shelf no Retry when trying again cannot help', () => {
    const html = render({
      failure: { message: "We couldn't open that playlist. It may be private or deleted." },
    });
    expect(html).toContain('It may be private or deleted.');
    expect(html).not.toContain('Retry');
  });

  it('lists the tracks otherwise', () => {
    const html = render({ tracks: [track] });
    expect(html).toContain('<ol id="cdp-tracklist"');
    expect(html).toContain('Housewife');
    expect(html).not.toContain('cdp-tracks__empty');
  });
});

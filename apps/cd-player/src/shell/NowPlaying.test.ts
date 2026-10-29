import { createElement, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NowPlaying } from './NowPlaying';

type Props = Parameters<typeof NowPlaying>[0];

const noop = () => {};
const props: Props = {
  now: { title: 'Housewife', artists: 'Tate McRae', trackNo: 1, total: 50 },
  status: 'playing',
  positionMs: 83_700,
  durationMs: 208_810,
  embed: 'ready',
  hint: false,
  embedRef: createRef<HTMLDivElement>(),
  repeat: false,
  shuffle: false,
  onPrev: noop,
  onToggle: noop,
  onNext: noop,
  onStop: noop,
  onRepeat: noop,
  onShuffle: noop,
  onSeek: noop,
};
const render = (over: Partial<Props> = {}) =>
  renderToString(createElement(NowPlaying, { ...props, ...over }));

/** Every aria-label in the markup, in document order (which is the order Tab reaches them in). */
const labels = (html: string) => [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
/** The opening tag of the element carrying `label`. */
const tagOf = (html: string, label: string) =>
  new RegExp(`<[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '';

describe('NowPlaying controls', () => {
  it('lists the controls in the order the keyboard reaches them', () => {
    expect(labels(render())).toEqual([
      'Now playing',
      'Previous track',
      'Pause',
      'Next track',
      'Seek',
      'Stop',
      'Repeat',
      'Shuffle',
    ]);
  });

  it('offers Play until the track plays', () => {
    for (const status of ['idle', 'paused'] as const) {
      expect(labels(render({ status }))).toContain('Play');
      expect(labels(render({ status }))).not.toContain('Pause');
    }
  });

  it('says whether Repeat and Shuffle are on, and gives Stop no state', () => {
    const off = render();
    expect(tagOf(off, 'Repeat')).toContain('aria-pressed="false"');
    expect(tagOf(off, 'Shuffle')).toContain('aria-pressed="false"');
    const on = render({ repeat: true, shuffle: true });
    expect(tagOf(on, 'Repeat')).toContain('aria-pressed="true"');
    expect(tagOf(on, 'Shuffle')).toContain('aria-pressed="true"');
    const repeating = render({ repeat: true });
    expect(tagOf(repeating, 'Repeat')).toContain('aria-pressed="true"');
    expect(tagOf(repeating, 'Shuffle')).toContain('aria-pressed="false"');
    // Stop is a command, not a switch.
    expect(tagOf(on, 'Stop')).not.toContain('aria-pressed');
  });

  it('draws Stop, Repeat and Shuffle as the small round keys', () => {
    const html = render();
    for (const label of ['Stop', 'Repeat', 'Shuffle']) {
      expect(tagOf(html, label)).toMatch(/<button[^>]*class="cdp-round cdp-round--small"/);
    }
  });

  it('shows the position on a slider, in whole seconds', () => {
    const slider = tagOf(render(), 'Seek');
    expect(slider).toMatch(/^<input\b/);
    expect(slider).toContain('class="cdp-now__seek"');
    expect(slider).toContain('type="range"');
    expect(slider).toContain('min="0"');
    expect(slider).toContain('max="208"');
    expect(slider).toContain('step="1"');
    expect(slider).toContain('value="83"');
    expect(slider).toContain('aria-valuetext="1:23 of 3:28"');
    expect(slider).not.toContain('disabled');
  });

  it('never reads the slider past its end', () => {
    const slider = tagOf(render({ positionMs: 209_900 }), 'Seek');
    expect(slider).toContain('max="208"');
    expect(slider).toContain('value="208"');
  });

  it('keeps the slider off while nothing is loaded or the disc is changing', () => {
    expect(tagOf(render({ status: 'idle', positionMs: 0 }), 'Seek')).toContain('disabled');
    // A seek does nothing while swapping: the thumb would snap back under the finger.
    expect(tagOf(render({ status: 'swapping', positionMs: 0 }), 'Seek')).toContain('disabled');
    expect(tagOf(render({ status: 'playing', durationMs: 0, positionMs: 0 }), 'Seek')).toContain(
      'disabled',
    );
    expect(tagOf(render({ status: 'playing' }), 'Seek')).not.toContain('disabled');
    expect(tagOf(render({ status: 'paused' }), 'Seek')).not.toContain('disabled');
  });

  it('has no progress bar: the slider took its place', () => {
    const html = render();
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('Track progress');
  });

  it('seats a note that stands for the embed right under the row (the card grows by the row alone)', () => {
    for (const embed of ['off', 'blocked'] as const) {
      expect(render({ embed })).toContain('class="cdp-now__note cdp-now__note--lead"');
    }
    // The hint comes below the embed's iframe, and keeps its own space above it.
    const hint = render({ embed: 'ready', hint: true });
    expect(hint).toContain('Press play inside the Spotify card to start.');
    expect(hint).not.toContain('cdp-now__note--lead');
  });

  it('still names the track and carries the embed slot and the note', () => {
    const html = render({ embed: 'off' });
    expect(html).toContain('Track 1 of 50');
    expect(html).toContain('Housewife');
    expect(html).toContain('Tate McRae');
    expect(html).toContain('class="cdp-now__embed"');
    expect(html).toContain('Press play to connect Spotify');
  });
});

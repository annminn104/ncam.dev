import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOOK_STATE } from '../looks';
import { copyText, LinkBar } from './LinkBar';

type Props = Parameters<typeof LinkBar>[0];

const render = (over: Partial<Props> = {}) =>
  renderToString(
    createElement(LinkBar, {
      collection: null,
      loading: false,
      error: null,
      onSubmit: () => {},
      look: DEFAULT_LOOK_STATE,
      onLook: () => {},
      modelLoad: null,
      current: null,
      busy: null,
      onPick: () => {},
      ...over,
    }),
  );

describe('LinkBar', () => {
  it('offers Retry beside an error that trying again may fix', () => {
    const html = render({
      error: "Spotify didn't answer. Try again in a moment.",
      onRetry: () => {},
    });
    expect(html).toMatch(/<p id="cdp-link-error" role="alert">Spotify didn.*t answer\./);
    expect(html).toMatch(
      /<button type="button" class="cdp-button cdp-button--small">Retry<\/button>/,
    );
  });

  it('gives no Retry to an error that trying again cannot fix', () => {
    const html = render({ error: "We couldn't open that album. It may be private or deleted." });
    expect(html).toContain('It may be private or deleted.');
    expect(html).not.toContain('Retry');
  });

  it('marks the field invalid for its own error alone, not for a preset’s or the engine’s', () => {
    const error = "Spotify didn't answer. Try again in a moment.";
    const own = render({ error, invalid: true });
    expect(own).toMatch(/<input[^>]*aria-invalid="true" aria-describedby="cdp-link-error"/);
    const other = render({ error });
    expect(other).toMatch(/<p id="cdp-link-error" role="alert">Spotify didn.*t answer\./);
    expect(other).not.toContain('aria-invalid');
    expect(other).not.toContain('aria-describedby');
  });

  it('stops saying "Loading…" once a first load has failed', () => {
    expect(render()).toContain('<h1>Loading…</h1>');
    expect(render({ failed: true })).toContain('<h1>No tracks</h1>');
  });
});

describe('LinkBar and Popular on Spotify', () => {
  it('lists the presets last, after the form and the error, the one in view marked', () => {
    const html = render({
      error: "Spotify didn't answer. Try again in a moment.",
      onRetry: () => {},
      current: { type: 'playlist', id: '37i9dQZEVXbMDoHDwVN2tF' },
    });
    const presets = html.indexOf('<section class="cdp-presets"');
    expect(presets).toBeGreaterThan(html.indexOf('</form>'));
    expect(presets).toBeGreaterThan(html.indexOf('id="cdp-link-error"'));
    expect(presets).toBeLessThan(html.indexOf('</header>'));
    expect(html).toMatch(
      /class="cdp-preset is-current" aria-current="true">[\s\S]*?Top 50 - Global/,
    );
  });
});

describe('LinkBar and Player', () => {
  it('puts Player after Share, inside the link form', () => {
    const html = render({ look: { ...DEFAULT_LOOK_STATE, skin: 'sage' } });
    const share = html.indexOf('>Share</button>');
    const picker = html.indexOf('<div class="cdp-skin">');
    expect(share).toBeGreaterThan(-1);
    expect(picker).toBeGreaterThan(share);
    expect(picker).toBeLessThan(html.indexOf('</form>'));
    expect(html).toContain('<span class="cdp-sr">: Suitcase, Sage</span>');
  });
});

describe('copyText (Share)', () => {
  it('copies the text', async () => {
    const writeText = vi.fn(async () => {});
    await expect(copyText('https://ncam.dev/x', { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://ncam.dev/x');
  });

  it('answers false, never a rejection, when the clipboard refuses or is missing', async () => {
    const writeText = vi.fn(() =>
      Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    );
    await expect(copyText('https://ncam.dev/x', { writeText })).resolves.toBe(false);
    // A page on plain http has no navigator.clipboard.
    await expect(copyText('https://ncam.dev/x', undefined)).resolves.toBe(false);
  });
});

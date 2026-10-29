import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { copyText, LinkBar } from './LinkBar';

type Props = Parameters<typeof LinkBar>[0];

const render = (over: Partial<Props> = {}) =>
  renderToString(
    createElement(LinkBar, {
      collection: null,
      loading: false,
      error: null,
      onSubmit: () => {},
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

  it('stops saying "Loading…" once a first load has failed', () => {
    expect(render()).toContain('<h1>Loading…</h1>');
    expect(render({ failed: true })).toContain('<h1>No tracks</h1>');
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

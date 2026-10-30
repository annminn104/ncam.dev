import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Loader } from './Loader';

const render = (progress: number | null) => renderToString(createElement(Loader, { progress }));

describe('Loader', () => {
  it('draws a disc that a screen reader skips, beside one plain line', () => {
    const html = render(null);
    expect(html).toMatch(/^<div class="cdp-loader"><svg class="cdp-loader__disc"/);
    expect(html).toMatch(/<svg class="cdp-loader__disc"[^>]*aria-hidden="true"/);
    expect(html).toContain('<p class="cdp-loader__line">Loading the player</p>');
  });

  it("counts the model's download once its size is known", () => {
    expect(render(0.63)).toContain('cdp-loader__line">Loading the player 63%</p>');
  });

  it('is plain from the first paint: no inline style, nothing hidden', () => {
    const html = render(null);
    expect(html).not.toContain('style=');
    // `hidden` as an attribute of its own (the disc's `aria-hidden` is fine).
    expect(html).not.toMatch(/\shidden[\s=>]/);
    expect(html).not.toContain('opacity');
  });
});

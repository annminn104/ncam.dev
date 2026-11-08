import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCameraChannel, type ZoomLimits } from '../camera-channel';
import { textOf } from '../testing/markup';
import { ZoomControls } from './ZoomControls';

/** The buttons, the scene having said `limits` (none: where every scene starts, 1×). */
const render = (limits?: ZoomLimits) => {
  const camera = createCameraChannel();
  if (limits) camera.setLimits(limits);
  return renderToString(createElement(ZoomControls, { camera }));
};
/** Every aria-label in the markup, in document order (which is the order Tab reaches them in). */
const labels = (html: string) => [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
/** The opening tag of the element carrying `label`. */
const tagOf = (html: string, label: string) =>
  new RegExp(`<[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '';

describe('ZoomControls', () => {
  it('names its group and its three buttons, −, + and reset, in the order Tab reaches them', () => {
    expect(labels(render())).toEqual(['View', 'Zoom out', 'Zoom in', 'Reset view']);
    expect(tagOf(render(), 'View')).toMatch(/^<div class="cdp-zoom" role="group"/);
  });

  it('draws them as the card’s square keys, an icon each that a screen reader skips', () => {
    const html = render();
    for (const label of ['Zoom out', 'Zoom in', 'Reset view']) {
      expect(tagOf(html, label), label).toMatch(/^<button type="button" class="cdp-key"/);
    }
    expect(html.match(/<svg [^>]*aria-hidden="true"/g)).toHaveLength(3);
    // Their names are all a screen reader reads: no text of their own.
    expect(textOf(html)).toBe('');
  });

  it('says Zoom out is unavailable at 1× and Zoom in at 3×, and never Reset view', () => {
    const rest = render({ atMin: true, atMax: false });
    expect(tagOf(rest, 'Zoom out')).toContain('aria-disabled="true"');
    expect(tagOf(rest, 'Zoom in')).toContain('aria-disabled="false"');
    const top = render({ atMin: false, atMax: true });
    expect(tagOf(top, 'Zoom out')).toContain('aria-disabled="false"');
    expect(tagOf(top, 'Zoom in')).toContain('aria-disabled="true"');
    const between = render({ atMin: false, atMax: false });
    expect(tagOf(between, 'Zoom out')).toContain('aria-disabled="false"');
    expect(tagOf(between, 'Zoom in')).toContain('aria-disabled="false"');
    for (const html of [rest, top, between]) {
      expect(tagOf(html, 'Reset view')).not.toContain('aria-disabled');
    }
    // Not `disabled`: a button at its end keeps the keyboard's focus.
    expect(rest).not.toMatch(/\sdisabled=""/);
    expect(render()).toBe(rest);
  });

  it('sends nothing from a button at its end (its press is read from the source: no DOM here)', () => {
    const source = readFileSync(new URL('./ZoomControls.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/if \(!spent\) camera\.send\(command\);/);
    expect(source).toMatch(
      /aria-disabled=\{atMin\}\s*onClick=\{\(\) => press\('zoom-out', atMin\)\}/,
    );
    expect(source).toMatch(
      /aria-disabled=\{atMax\}\s*onClick=\{\(\) => press\('zoom-in', atMax\)\}/,
    );
  });
});

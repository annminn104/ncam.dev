import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCameraChannel, type ZoomLimits } from '../camera-channel';
import { textOf } from '../testing/markup';
import { Hud } from './Hud';

/** The help line, the scene having said `limits` (none: where every scene starts, 1×). */
const render = (limits?: ZoomLimits) => {
  const camera = createCameraChannel();
  if (limits) camera.setLimits(limits);
  return renderToString(createElement(Hud, { camera }));
};

describe('Hud', () => {
  it('says how to play, look around and zoom', () => {
    expect(textOf(render())).toBe(
      'Space play or pause · N next · P previous · drag to look around · scroll or pinch to zoom',
    );
  });

  it('stands plain at 1×, as the server draws it, and fades out once the view is zoomed in', () => {
    expect(render()).toMatch(/^<p class="cdp-hud">/);
    expect(render({ atMin: true, atMax: false })).toMatch(/^<p class="cdp-hud">/);
    expect(render({ atMin: false, atMax: false })).toMatch(/^<p class="cdp-hud is-zoomed">/);
    expect(render({ atMin: false, atMax: true })).toMatch(/^<p class="cdp-hud is-zoomed">/);
  });
});

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../engine/settings';
import { SettingsPanel } from './SettingsPanel';

const render = () =>
  renderToString(
    createElement(SettingsPanel, { settings: DEFAULT_SETTINGS, fps: null, onChange: () => {} }),
  );

describe('SettingsPanel', () => {
  it('starts folded behind a toggle that names the body it opens', () => {
    const html = render();
    const toggles = html.match(/<button\b[^>]*>/g) ?? [];
    expect(toggles).toHaveLength(1);
    expect(toggles[0]).toContain('class="ms-panel-toggle"');
    expect(toggles[0]).toContain('aria-expanded="false"');
    expect(toggles[0]).toContain('aria-controls="ms-settings-body"');
    expect(html).toMatch(/<section class="ms-panel"/);
  });

  it('wraps every control in that body', () => {
    const html = render();
    const body = html.indexOf('<div id="ms-settings-body" class="ms-panel-body">');
    expect(body).toBeGreaterThan(html.indexOf('ms-panel-toggle'));
    for (const label of ['Rain', 'Exposure', 'Fog', 'Bloom', 'SSAO', 'Traffic', 'Auto-orbit (C)']) {
      expect(html.indexOf(label, body), label).toBeGreaterThan(body);
    }
    expect(html.match(/type="range"/g)).toHaveLength(4);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
  });
});

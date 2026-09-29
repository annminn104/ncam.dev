import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StageLoading, type StageLoadingProps } from './StageLoading';

const HOLODEX: StageLoadingProps['project'] = { name: 'Holodex' };

const render = (props: StageLoadingProps) => renderToString(createElement(StageLoading, props));

describe('StageLoading', () => {
  it('shows only a spinner, and tells screen readers what is loading', () => {
    const html = render({ project: HOLODEX, done: false });
    expect(html).toMatch(/<div[^>]*class="stage__loading"[^>]*data-state="loading"/);
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(html).toMatch(/<span[^>]*class="stage__spinner"[^>]*aria-hidden="true"/);
    // Visually hidden (styles.css), but the status's accessible text.
    expect(html).toContain('<span class="stage__loading-label">Loading Holodex…</span>');
    // No screenshot behind it any more.
    expect(html).not.toContain('<img');
  });

  it('stays in the DOM once the remote attaches, so it can fade out', () => {
    expect(render({ project: HOLODEX, done: true })).toMatch(/data-state="done"/);
  });

  it("lets the ellipsis replace a name's own full stop", () => {
    const html = render({ project: { name: 'Viktor.' }, done: false });
    expect(html).toContain('Loading Viktor…');
    expect(html).not.toContain('Viktor.…');
  });
});

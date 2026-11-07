import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EnterButton } from './EnterButton';

const render = (props: Parameters<typeof EnterButton>[0]) =>
  renderToString(createElement(EnterButton, props));
const onStart = () => {};

describe('EnterButton', () => {
  it('opens the player while the scene waits, and leaves its boot to the loader', () => {
    const waiting = render({ phase: 'waiting', failure: null, onStart });
    expect(waiting).toContain('Open the player');
    expect(waiting).not.toContain('disabled');
    expect(render({ phase: 'booting', failure: null, onStart })).toBe('');
  });

  it('offers "Try again" for a failure that can be retried in place', () => {
    const html = render({
      phase: 'error',
      failure: { message: 'It broke.', retry: true },
      onStart,
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('It broke.');
    expect(html).toContain('Try again');
  });

  it('offers "Reload the page" instead when the failure can only be retried by a reload', () => {
    // A reload stops the Spotify embed: the button must not read like a retry that leaves it be.
    const html = render({
      phase: 'error',
      failure: { message: 'It broke.', retry: true, reload: true },
      onStart,
    });
    expect(html).toContain('Reload the page');
    expect(html).not.toContain('Try again');
  });

  it('offers no button for a failure that cannot be retried, and goes once the scene is live', () => {
    const html = render({
      phase: 'error',
      failure: { message: 'No WebGL.', retry: false },
      onStart,
    });
    expect(html).toContain('No WebGL.');
    expect(html).not.toContain('<button');
    expect(render({ phase: 'live', failure: null, onStart })).toBe('');
  });
});

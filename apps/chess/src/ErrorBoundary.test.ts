import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArenaFailed, BattleErrorBoundary } from './ErrorBoundary';

// react-dom/server never runs a class error boundary (a child that throws makes renderToString
// throw, or hands the failure to the client through Suspense), so a thrown child cannot be
// rendered into the fallback here. These tests take the boundary apart instead: what it
// renders in each state, what it turns a thrown value into, what it logs and what its button
// does. The wiring (a failed chunk, a failed renderer) is checked in a real browser.

const boundary = (children: string = 'THE-BATTLE', onBack: () => void = () => {}) =>
  new BattleErrorBoundary({ children, onBack });

afterEach(() => vi.restoreAllMocks());

describe('ArenaFailed', () => {
  it('is an alert that says the arena failed to open and leads back to the lobby', () => {
    const html = renderToString(createElement(ArenaFailed, { onBack: () => {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('The arena failed to open');
    expect(html).toContain('<button');
    expect(html).toContain('Back to the lobby');
  });

  it('tells the player to reload, since a chunk that failed to load fails again until then', () => {
    expect(renderToString(createElement(ArenaFailed, { onBack: () => {} }))).toMatch(
      /reload the page/,
    );
  });

  it('wires the button to onBack', () => {
    const onBack = vi.fn();
    const element = ArenaFailed({ onBack }) as ReactElement<{ children: ReactElement[] }>;
    const button = element.props.children.find((child) => child.type === 'button') as ReactElement<{
      onClick(): void;
    }>;
    button.props.onClick();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('BattleErrorBoundary', () => {
  it('renders its children until something throws', () => {
    expect(boundary().render()).toBe('THE-BATTLE');
  });

  it('treats whatever was thrown as a failure, a falsy value included', () => {
    const derive = BattleErrorBoundary.getDerivedStateFromError as (thrown: unknown) => {
      failed: boolean;
    };
    for (const thrown of [new TypeError('chunk gone'), 'text', 0, '', null, undefined]) {
      expect(derive(thrown)).toEqual({ failed: true });
    }
  });

  it('renders the failure screen instead of the children once it has failed', () => {
    const failed = boundary();
    failed.state = BattleErrorBoundary.getDerivedStateFromError();
    const html = renderToString(failed.render() as ReactElement);
    expect(html).toContain('The arena failed to open');
    expect(html).not.toContain('THE-BATTLE');
  });

  it('logs the failure through @ncam/logger with the error stack and the component stack', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/Battle.js');
    boundary().componentDidCatch(error, { componentStack: '\n    at Battle\n    at Suspense' });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const [label, data] = consoleError.mock.calls[0] as [string, { error: string; info: string }];
    expect(label).toBe('[chess] chess.battle-failed');
    expect(data.error).toContain('Failed to fetch dynamically imported module');
    expect(data.error).toContain('TypeError');
    expect(data.info).toContain('at Battle');
  });

  it('logs a thrown non-error as text rather than failing while it reports the failure', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    boundary().componentDidCatch('chunk gone', { componentStack: '' });
    expect((consoleError.mock.calls[0][1] as { error: string }).error).toBe('chunk gone');
  });

  it('"Back to the lobby" clears the failure and leaves the battle', () => {
    const onBack = vi.fn();
    const failed = boundary('THE-BATTLE', onBack);
    const setState = vi.spyOn(failed, 'setState').mockImplementation(() => {});
    failed.state = BattleErrorBoundary.getDerivedStateFromError();
    const screen = failed.render() as ReactElement<{ onBack(): void }>;
    screen.props.onBack();
    expect(setState).toHaveBeenCalledWith({ failed: false });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

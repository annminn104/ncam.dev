import { describe, expect, it, vi } from 'vitest';
import { FigureBoundary } from './FigureBoundary';

const { error } = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@ncam/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error }),
}));

describe('FigureBoundary', () => {
  it('draws its fallback once a figure has failed', () => {
    expect(FigureBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const boundary = new FigureBoundary({ fallback: 'treasure', children: 'figure' });
    expect(boundary.render()).toBe('figure');
    boundary.state = { failed: true };
    expect(boundary.render()).toBe('treasure');
  });

  it('logs each failing file once, however many pieces draw it', () => {
    const boundary = new FigureBoundary({ fallback: null, children: null });
    const k = 'Could not load /presets/holy-order/k.glb: 404';
    boundary.componentDidCatch(new Error(k));
    boundary.componentDidCatch(new Error(k));
    boundary.componentDidCatch(new Error('Could not load /presets/holy-order/q.glb: 404'));
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith('figure.load-failed', { error: k });
  });
});

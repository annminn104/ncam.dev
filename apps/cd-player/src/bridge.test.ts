import { describe, expect, it, vi } from 'vitest';
import { createBridge, EMPTY_VIEW } from './bridge';

const view = { ...EMPTY_VIEW, trackNo: 3 };
const track = { id: 't', title: 'T', artists: 'A', artUrl: null, artistUrl: null, palette: null };

describe('createBridge', () => {
  it('holds the view and notifies subscribers', () => {
    const bridge = createBridge();
    const listener = vi.fn();
    const off = bridge.subscribe(listener);
    bridge.setView(view);
    expect(bridge.getView()).toBe(view);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    bridge.setView(EMPTY_VIEW);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changes discs instantly without a scene, through it when one is there', async () => {
    const bridge = createBridge();
    await expect(bridge.swap(track)).resolves.toBeUndefined();
    const swapper = vi.fn(async () => {});
    bridge.setSwapper(swapper);
    await bridge.swap(track);
    expect(swapper).toHaveBeenCalledWith(track);
  });

  it('passes the scene actions to the app', () => {
    const bridge = createBridge();
    const listener = vi.fn();
    const off = bridge.onAction(listener);
    bridge.emit({ type: 'next' });
    off();
    bridge.emit({ type: 'prev' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: 'next' });
  });
});

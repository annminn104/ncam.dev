import { describe, expect, it, vi } from 'vitest';
import { AT_REST, createCameraChannel } from './camera-channel';

describe('createCameraChannel', () => {
  it('carries the shell’s commands to the scene’s camera, and to nothing once it has gone', () => {
    const camera = createCameraChannel();
    // No scene yet: the command goes nowhere, and nothing throws.
    camera.send('zoom-in');
    const listener = vi.fn();
    const off = camera.onCommand(listener);
    camera.send('zoom-in');
    camera.send('zoom-out');
    camera.send('reset');
    off();
    camera.send('reset');
    expect(listener.mock.calls).toEqual([['zoom-in'], ['zoom-out'], ['reset']]);
  });

  it('starts at 1×, so − does nothing until the scene says otherwise', () => {
    expect(createCameraChannel().getLimits()).toEqual({ atMin: true, atMax: false });
    expect(AT_REST).toEqual({ atMin: true, atMax: false });
  });

  it('tells its subscribers of a change of the limits alone, never of the same again', () => {
    const camera = createCameraChannel();
    const listener = vi.fn();
    const off = camera.subscribe(listener);
    camera.setLimits({ atMin: true, atMax: false });
    expect(listener).not.toHaveBeenCalled();
    camera.setLimits({ atMin: false, atMax: false });
    camera.setLimits({ atMin: false, atMax: false });
    expect(listener).toHaveBeenCalledTimes(1);
    const top = { atMin: false, atMax: true };
    camera.setLimits(top);
    expect(camera.getLimits()).toEqual(top);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    camera.setLimits(AT_REST);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps one snapshot until the limits change, as useSyncExternalStore asks', () => {
    const camera = createCameraChannel();
    const before = camera.getLimits();
    camera.setLimits({ ...AT_REST });
    expect(camera.getLimits()).toBe(before);
  });
});

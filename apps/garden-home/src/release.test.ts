import { describe, expect, it, vi } from 'vitest';
import { onRelease, releaseAll } from './release';

describe('releaseAll', () => {
  it('runs every registered release, each time it is called', () => {
    const one = vi.fn();
    const two = vi.fn();
    onRelease(one);
    onRelease(two);
    releaseAll();
    releaseAll();
    expect(one).toHaveBeenCalledTimes(2);
    expect(two).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one release throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const after = vi.fn();
    onRelease(() => {
      throw new Error('boom');
    });
    onRelease(after);
    releaseAll();
    expect(after).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

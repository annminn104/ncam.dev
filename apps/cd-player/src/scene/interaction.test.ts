import { describe, expect, it } from 'vitest';
import { releaseLost } from './interaction';

describe('releaseLost', () => {
  it('is a mouse that moves with no button down', () => {
    expect(releaseLost({ pointerType: 'mouse', buttons: 0 })).toBe(true);
    expect(releaseLost({ pointerType: 'mouse', buttons: 1 })).toBe(false);
    expect(releaseLost({ pointerType: 'mouse', buttons: 3 })).toBe(false);
  });

  it('is never a touch or a pen: their contact lasts until pointerup or pointercancel', () => {
    expect(releaseLost({ pointerType: 'touch', buttons: 0 })).toBe(false);
    expect(releaseLost({ pointerType: 'touch', buttons: 1 })).toBe(false);
    expect(releaseLost({ pointerType: 'pen', buttons: 0 })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createFrameGate } from './frameGate';

function countOpen(fps: number, displayHz: number): number {
  const gate = createFrameGate(fps);
  let open = 0;
  for (let i = 0; i < displayHz; i++) if (gate((i * 1000) / displayHz)) open += 1;
  return open; // frames rendered during one second
}

describe('createFrameGate', () => {
  it('caps 120 Hz ProMotion to 30 fps', () => expect(countOpen(30, 120)).toBe(30));
  it('caps 60 Hz to 30 fps', () => expect(countOpen(30, 60)).toBe(30));
  it('lets 60 fps through on a 60 Hz display', () => expect(countOpen(60, 60)).toBe(60));
  it('caps 120 Hz to 60 fps', () => expect(countOpen(60, 120)).toBe(60));
  it('always opens on the first frame', () => expect(createFrameGate(30)(12345)).toBe(true));
});

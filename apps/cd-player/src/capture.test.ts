import { describe, expect, it } from 'vitest';
import { CAPTURE, captureShape } from './capture';

describe('captureShape', () => {
  it('reads ?capture=landscape|portrait and nothing else', () => {
    expect(captureShape('?capture=landscape')).toBe('landscape');
    expect(captureShape('?x=1&capture=portrait')).toBe('portrait');
    expect(captureShape('?capture=square')).toBeNull();
    expect(captureShape('')).toBeNull();
  });

  it('captures the landscape wide and the portrait at a phone width', () => {
    expect(CAPTURE.landscape.viewport.width).toBeGreaterThan(820);
    expect(CAPTURE.portrait.viewport.width).toBeLessThanOrEqual(820);
    expect(CAPTURE.portrait.viewport.width * CAPTURE.portrait.scale).toBe(1080);
  });
});

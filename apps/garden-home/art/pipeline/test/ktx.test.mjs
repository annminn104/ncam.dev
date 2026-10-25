import { describe, expect, it } from 'vitest';
import { isKtxSupported } from '../src/ktx.mjs';

describe('isKtxSupported', () => {
  it('requires KTX-Software 4.4.0 or newer', () => {
    expect(isKtxSupported([4, 4, 0])).toBe(true);
    expect(isKtxSupported([4, 10, 2])).toBe(true);
    expect(isKtxSupported([5, 0, 0])).toBe(true);
    expect(isKtxSupported([4, 3, 9])).toBe(false);
    expect(isKtxSupported(null)).toBe(false);
  });
});

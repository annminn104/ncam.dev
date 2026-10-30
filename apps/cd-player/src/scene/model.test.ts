import { describe, expect, it } from 'vitest';
import { downloadFraction } from './model';

describe('downloadFraction', () => {
  it('reads how much of a GLB of known size has come', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 0, total: 589_824 })).toBe(0);
    expect(downloadFraction({ lengthComputable: true, loaded: 147_456, total: 589_824 })).toBe(
      0.25,
    );
    expect(downloadFraction({ lengthComputable: true, loaded: 589_824, total: 589_824 })).toBe(1);
  });

  it('has no fraction when the response names no length', () => {
    expect(downloadFraction({ lengthComputable: false, loaded: 65_536, total: 0 })).toBeNull();
    expect(downloadFraction({ lengthComputable: true, loaded: 65_536, total: 0 })).toBeNull();
  });

  it('holds a compressed transfer, whose decoded bytes outrun the length it named, at 1', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 900_000, total: 589_824 })).toBe(1);
  });
});

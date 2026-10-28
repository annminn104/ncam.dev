import { describe, expect, it } from 'vitest';
import { pickPicture } from './types';

const pics = [
  { url: 'a', width: 64 },
  { url: 'b', width: 300 },
  { url: 'c', width: 640 },
];

describe('pickPicture', () => {
  it('takes the largest picture that fits', () => {
    expect(pickPicture(pics, 640)?.url).toBe('c');
    expect(pickPicture(pics, 400)?.url).toBe('b');
  });

  it('takes the smallest when none fits, null when there are none', () => {
    expect(pickPicture(pics, 32)?.url).toBe('a');
    expect(pickPicture([], 640)).toBeNull();
  });
});

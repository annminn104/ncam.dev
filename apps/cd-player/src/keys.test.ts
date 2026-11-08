import { describe, expect, it } from 'vitest';
import { keyCommand } from './keys';

const press = (key: string, code = '') => keyCommand({ key, code });

describe('keyCommand', () => {
  it('plays with Space, N and P, as the page always has', () => {
    // Space by its place on the keyboard, whatever it types.
    expect(press(' ', 'Space')).toBe('toggle');
    expect(press('Unidentified', 'Space')).toBe('toggle');
    expect(press('n', 'KeyN')).toBe('next');
    expect(press('N', 'KeyN')).toBe('next');
    expect(press('p', 'KeyP')).toBe('prev');
    expect(press('P', 'KeyP')).toBe('prev');
  });

  it('zooms in with + or =, out with - or _, and resets the view with 0', () => {
    // = is + without Shift, _ is - with it; the keypad's keys type the same.
    expect(press('+', 'Equal')).toBe('zoom-in');
    expect(press('=', 'Equal')).toBe('zoom-in');
    expect(press('+', 'NumpadAdd')).toBe('zoom-in');
    expect(press('-', 'Minus')).toBe('zoom-out');
    expect(press('_', 'Minus')).toBe('zoom-out');
    expect(press('-', 'NumpadSubtract')).toBe('zoom-out');
    expect(press('0', 'Digit0')).toBe('reset');
    expect(press('0', 'Numpad0')).toBe('reset');
  });

  it('leaves every other key alone', () => {
    for (const [key, code] of [
      ['Enter', 'Enter'],
      ['z', 'KeyZ'],
      ['1', 'Digit1'],
      [')', 'Digit0'],
      ['ArrowUp', 'ArrowUp'],
      ['Escape', 'Escape'],
    ]) {
      expect(press(key, code), key).toBeNull();
    }
  });
});

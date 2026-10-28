import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseParams } from './params';

describe('parseParams', () => {
  it('returns defaults for an empty query', () => {
    expect(parseParams('')).toEqual({
      t: null,
      quality: null,
      fps: null,
      debug: false,
      align: null,
      bg: null,
    });
  });

  it('parses a valid time override', () => {
    expect(parseParams('?t=18:30').t).toEqual({ hours: 18, minutes: 30 });
  });

  it('ignores malformed times', () => {
    for (const t of ['24:00', '7:30', '12:60', 'noon']) expect(parseParams(`?t=${t}`).t).toBeNull();
  });

  it('accepts only known quality tiers', () => {
    expect(parseParams('?quality=medium').quality).toBe('medium');
    expect(parseParams('?quality=ultra').quality).toBeNull();
  });

  it('accepts fps between 1 and 120 only', () => {
    expect(parseParams('?fps=24').fps).toBe(24);
    expect(parseParams('?fps=0').fps).toBeNull();
    expect(parseParams('?fps=500').fps).toBeNull();
    expect(parseParams('?fps=abc').fps).toBeNull();
  });

  it('enables debug only for debug=1', () => {
    expect(parseParams('?debug=1').debug).toBe(true);
    expect(parseParams('?debug=true').debug).toBe(false);
  });

  it('accepts only left, center and right for align', () => {
    for (const align of ['left', 'center', 'right'] as const)
      expect(parseParams(`?align=${align}`).align).toBe(align);
    for (const align of ['middle', 'RIGHT', ''])
      expect(parseParams(`?align=${align}`).align).toBeNull();
  });

  it('turns a plain image file name into its URL under /backgrounds/', () => {
    for (const name of ['example.jpg', 'beach.jpeg', 'my_photo-2.png', 'dusk.v2.webp']) {
      expect(parseParams(`?bg=${name}`).bg).toBe(`/backgrounds/${name}`);
    }
  });

  it('accepts upper-case extensions, as cameras and phones write them, with the same safe character set', () => {
    for (const name of ['IMG_1234.JPG', 'Beach.Jpeg', 'DUSK.PNG', 'sea.WebP']) {
      expect(parseParams(`?bg=${name}`).bg).toBe(`/backgrounds/${name}`);
    }
  });

  it('ignores a bg that is not a plain jpg, jpeg, png or webp file name', () => {
    const bad = [
      '',
      '../secret.jpg',
      'dir/a.jpg',
      'https://example.com/a.jpg',
      'a.gif',
      'a.JPG.exe',
      'a b.jpg',
      '.jpg',
      'a.jpg?x=1',
      'a.jpg/',
      '%2e%2e%2fa.jpg',
      'a\\b.png',
      'a.JPGG',
      'ü.jpg',
    ];
    for (const bg of bad) expect(parseParams(`?${new URLSearchParams({ bg })}`).bg).toBeNull();
    expect(parseParams('?bg=%2e%2e%2fa.jpg').bg).toBeNull(); // decoded to ../a.jpg
  });

  describe('a rejected bg', () => {
    afterEach(() => vi.restoreAllMocks());

    it('warns once in the console, naming the value, so a typo does not just show the sky', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseParams('?bg=../secret.jpg').bg).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('../secret.jpg');
      expect(String(warn.mock.calls[0][0])).toContain('?bg=');
      parseParams('?bg=beach.gif&t=12:00');
      expect(warn).toHaveBeenCalledTimes(2); // one warning per parse, not one per check
    });

    it('stays quiet for a good name and for no bg at all', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      parseParams('?bg=example.jpg');
      parseParams('?bg=IMG_1.JPG');
      parseParams('');
      parseParams('?bg=');
      parseParams('?t=12:00&align=left');
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  cleanName,
  DEFAULT_PERSONAL,
  engraving,
  NAME_FALLBACK,
  NAME_MAX,
  PATTERN_STYLES,
  PATTERNS,
  personalFrom,
  styleFor,
} from './personal';

describe('cleanName', () => {
  it("keeps letters with accents, digits, spaces and . - _ & ' !", () => {
    expect(cleanName("Ánh-2 & O'k_!.")).toBe("Ánh-2 & O'k_!.");
  });

  it('drops what cannot be engraved', () => {
    expect(cleanName('a<b>c/d"e')).toBe('abcde');
    expect(cleanName('DJ ' + String.fromCodePoint(0x1f3a7) + ' Lan')).toBe('DJ Lan');
    expect(cleanName('Lan' + String.fromCodePoint(0xfe0f, 0, 9, 10))).toBe('Lan');
  });

  it('has no leading space and no run of spaces, and keeps one trailing space', () => {
    expect(cleanName('   Lan    Anh ')).toBe('Lan Anh ');
  });

  it('composes accents', () => {
    expect(cleanName('A' + String.fromCodePoint(0x301) + 'nh')).toBe('Ánh');
  });

  it('keeps at most NAME_MAX code points', () => {
    expect(NAME_MAX).toBe(16);
    expect(cleanName('x'.repeat(20))).toBe('x'.repeat(16));
    expect(cleanName('Ư'.repeat(20))).toBe('Ư'.repeat(16));
  });
});

describe('engraving', () => {
  it('is the fallback for no name', () => {
    expect(NAME_FALLBACK).toBe('ncam');
    expect(engraving('')).toBe('ncam');
    expect(engraving('   ')).toBe('ncam');
  });

  it('trims the ends of a name', () => {
    expect(engraving('Lan Anh ')).toBe('Lan Anh');
  });
});

describe('styleFor', () => {
  it('prints nothing for Plain and the pattern itself for a style', () => {
    expect(styleFor('plain', 7)).toBeNull();
    expect(styleFor('circuit', 7)).toBe('circuit');
  });

  it('picks a style for the music by the seed', () => {
    expect(styleFor('music', 0)).toBe('guilloche');
    expect(styleFor('music', 6)).toBe('circuit');
    expect(styleFor('music', 4294967295)).toBe('guilloche');
  });
});

describe('personalFrom', () => {
  it('keeps good marks and cleans the name', () => {
    expect(personalFrom({ pattern: 'circuit', name: 'Lan' })).toEqual({
      pattern: 'circuit',
      name: 'Lan',
    });
    expect(personalFrom({ pattern: 'plain', name: 'a<b>' })).toEqual({
      pattern: 'plain',
      name: 'ab',
    });
  });

  it('falls back to the default for junk', () => {
    for (const junk of [
      null,
      'x',
      [],
      { pattern: 'neon' },
      { pattern: '__proto__' },
      { name: 42 },
    ]) {
      expect(personalFrom(junk), JSON.stringify(junk)).toEqual({ pattern: 'music', name: '' });
    }
    expect(DEFAULT_PERSONAL).toEqual({ pattern: 'music', name: '' });
  });
});

describe('PATTERNS', () => {
  it('lists seven patterns, From the music first and Plain last', () => {
    const ids = PATTERNS.map((pattern) => pattern.id);
    expect(ids).toHaveLength(7);
    expect(ids[0]).toBe('music');
    expect(ids[6]).toBe('plain');
    for (const style of PATTERN_STYLES) expect(ids).toContain(style);
    expect(PATTERN_STYLES).toHaveLength(5);
  });
});

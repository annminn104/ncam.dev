import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('falls back to defaults for junk', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid fields and repairs invalid ones', () => {
    expect(
      parseSettings({
        mode: 'ai',
        playerSide: 'b',
        level: 4,
        arenaId: 'lotus-lake',
        autoRotate: false,
      }),
    ).toEqual({ mode: 'ai', playerSide: 'b', level: 4, arenaId: 'lotus-lake', autoRotate: false });
    expect(parseSettings({ mode: 'online', level: 42, arenaId: 'mars' })).toEqual({
      ...DEFAULT_SETTINGS,
      level: 5,
    });
  });
});

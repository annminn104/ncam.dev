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
    ).toEqual({
      mode: 'ai',
      playerSide: 'b',
      level: 4,
      arenaId: 'lotus-lake',
      autoRotate: false,
      whitePreset: 'treasures',
      blackPreset: 'treasures',
      linkPresets: true,
    });
    expect(parseSettings({ mode: 'online', level: 42, arenaId: 'mars' })).toEqual({
      ...DEFAULT_SETTINGS,
      level: 5,
    });
  });
  it('defaults the piece sets to linked treasures', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      whitePreset: 'treasures',
      blackPreset: 'treasures',
      linkPresets: true,
    });
  });
  it('keeps ready preset choices and repairs unknown or not-yet-ready ones', () => {
    expect(
      parseSettings({ whitePreset: 'treasures', blackPreset: 'nope', linkPresets: false }),
    ).toMatchObject({ whitePreset: 'treasures', blackPreset: 'treasures', linkPresets: false });
    // Holy Order and the Dark Overlord Court are ready, so they are kept. Constellation is not
    // yet, so it is repaired.
    expect(parseSettings({ whitePreset: 'holy-order' }).whitePreset).toBe('holy-order');
    expect(parseSettings({ blackPreset: 'dark-court' }).blackPreset).toBe('dark-court');
    expect(parseSettings({ whitePreset: 'constellation' }).whitePreset).toBe('treasures');
  });
});

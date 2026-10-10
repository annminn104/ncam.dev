import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import { choosePreset, setLinked } from './PresetPicker';

const base = { ...DEFAULT_SETTINGS, whitePreset: 'treasures', blackPreset: 'treasures' } as const;

describe('choosePreset', () => {
  it('sets both sides while linked', () => {
    expect(choosePreset({ ...base }, 'both', 'treasures')).toMatchObject({
      whitePreset: 'treasures',
      blackPreset: 'treasures',
    });
  });
  it('sets one side while unlinked', () => {
    const s = choosePreset({ ...base, linkPresets: false }, 'b', 'constellation');
    expect(s).toMatchObject({ whitePreset: 'treasures', blackPreset: 'constellation' });
  });
});

describe('setLinked', () => {
  it('vs AI starts the AI side on the contrast when unlinking', () => {
    const s = setLinked(
      {
        ...base,
        mode: 'ai',
        playerSide: 'w',
        whitePreset: 'constellation',
        blackPreset: 'constellation',
      },
      false,
    );
    expect(s).toMatchObject({
      linkPresets: false,
      whitePreset: 'constellation',
      blackPreset: 'treasures',
    });
  });
  it('hot-seat keeps both sides when unlinking', () => {
    const s = setLinked(
      { ...base, mode: 'hotseat', whitePreset: 'constellation', blackPreset: 'constellation' },
      false,
    );
    expect(s).toMatchObject({
      linkPresets: false,
      whitePreset: 'constellation',
      blackPreset: 'constellation',
    });
  });
  it('relinking copies the player side to both', () => {
    const s = setLinked(
      {
        ...base,
        linkPresets: false,
        playerSide: 'b',
        whitePreset: 'treasures',
        blackPreset: 'constellation',
      },
      true,
    );
    expect(s).toMatchObject({
      linkPresets: true,
      whitePreset: 'constellation',
      blackPreset: 'constellation',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import { choosePreset, setLinked } from './PresetPicker';

const base = { ...DEFAULT_SETTINGS, whitePreset: 'treasures', blackPreset: 'treasures' } as const;

describe('choosePreset', () => {
  it('sets both sides while linked', () => {
    // The sides start apart: an identity function, or one that writes only whitePreset, fails.
    const s = choosePreset(
      { ...base, whitePreset: 'treasures', blackPreset: 'constellation' },
      'both',
      'holy-order',
    );
    expect(s).toMatchObject({ whitePreset: 'holy-order', blackPreset: 'holy-order' });
  });
  it('sets white only while unlinked', () => {
    const s = choosePreset(
      { ...base, linkPresets: false, whitePreset: 'treasures', blackPreset: 'constellation' },
      'w',
      'holy-order',
    );
    expect(s).toEqual({
      ...base,
      linkPresets: false,
      whitePreset: 'holy-order',
      blackPreset: 'constellation',
    });
  });
  it('sets black only while unlinked', () => {
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
  it('vs AI with the player on black starts the white side on the contrast of black', () => {
    const s = setLinked(
      {
        ...base,
        mode: 'ai',
        playerSide: 'b',
        whitePreset: 'holy-order',
        blackPreset: 'constellation',
      },
      false,
    );
    expect(s).toMatchObject({
      linkPresets: false,
      whitePreset: 'treasures',
      blackPreset: 'constellation',
    });
  });
  it("vs AI with 'random' counts as white when unlinking", () => {
    const s = setLinked(
      {
        ...base,
        mode: 'ai',
        playerSide: 'random',
        whitePreset: 'constellation',
        blackPreset: 'holy-order',
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
  it("relinking with 'random' copies white to both", () => {
    const s = setLinked(
      {
        ...base,
        linkPresets: false,
        playerSide: 'random',
        whitePreset: 'constellation',
        blackPreset: 'holy-order',
      },
      true,
    );
    expect(s).toMatchObject({
      linkPresets: true,
      whitePreset: 'constellation',
      blackPreset: 'constellation',
    });
  });
  it('hot-seat relinking copies the player side to both', () => {
    const s = setLinked(
      {
        ...base,
        mode: 'hotseat',
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

import { describe, expect, it } from 'vitest';
import { CARD_RARITIES } from '../lib/constants';
import { foilTier, TIER_BY_RARITY, TIER_INTENSITY, type FoilTier } from './tiers';

describe('foilTier', () => {
  it('maps every rarity the API can return', () => {
    // Assert against the table, not against foilTier(): foilTier falls back to
    // 'sparkle' for anything unknown, so testing its return value here would
    // pass even with an empty table.
    const unmapped = CARD_RARITIES.filter((rarity) => !(rarity in TIER_BY_RARITY));
    expect(unmapped).toEqual([]);
  });

  it('has no table entry for a rarity the API does not list', () => {
    // Guards the other direction: a typo'd key would otherwise sit unnoticed.
    const stray = Object.keys(TIER_BY_RARITY).filter(
      (rarity) => !(CARD_RARITIES as readonly string[]).includes(rarity),
    );
    expect(stray).toEqual([]);
  });

  it('puts the everyday rarities on flat', () => {
    expect(foilTier('Common')).toBe('flat');
    expect(foilTier('Uncommon')).toBe('flat');
    expect(foilTier('None')).toBe('flat');
    expect(foilTier('Two Diamond')).toBe('flat');
  });

  it('puts the holo rares on rainbow', () => {
    expect(foilTier('Holo Rare')).toBe('rainbow');
    expect(foilTier('Rare Holo')).toBe('rainbow');
    expect(foilTier('Ultra Rare')).toBe('rainbow');
  });

  it('puts the chase rarities on cosmos', () => {
    expect(foilTier('Secret Rare')).toBe('cosmos');
    expect(foilTier('Special illustration rare')).toBe('cosmos');
    expect(foilTier('Crown')).toBe('cosmos');
  });

  it('falls back to sparkle for an unknown or missing rarity', () => {
    expect(foilTier(undefined)).toBe('sparkle');
    expect(foilTier('Brand New Rarity 2027')).toBe('sparkle');
  });

  it('upgrades flat to sparkle for a reverse-holo printing', () => {
    expect(foilTier('Common', { reverse: true })).toBe('sparkle');
  });

  it('upgrades sparkle to rainbow for a holo printing', () => {
    expect(foilTier('Rare', { holo: true })).toBe('rainbow');
    // reverse then holo compounds: flat -> sparkle -> rainbow
    expect(foilTier('Common', { reverse: true, holo: true })).toBe('rainbow');
  });

  it('never downgrades a tier through variants', () => {
    expect(foilTier('Secret Rare', { reverse: true, holo: true })).toBe('cosmos');
  });

  it('gives every tier an intensity', () => {
    const tiers: FoilTier[] = ['flat', 'sparkle', 'rainbow', 'cosmos'];
    for (const tier of tiers) expect(TIER_INTENSITY[tier]).toBeGreaterThanOrEqual(0);
  });
});

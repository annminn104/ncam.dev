import type { Variants } from '../lib/tcgdex';

/**
 * Four foil looks. TCGdex reports 42 rarities; hand-authoring 42 shaders would
 * be absurd, so they collapse into tiers by how a real card of that rarity is
 * actually printed.
 */
export type FoilTier = 'flat' | 'sparkle' | 'rainbow' | 'cosmos';

const ORDER: FoilTier[] = ['flat', 'sparkle', 'rainbow', 'cosmos'];

/** Foil strength the shader multiplies by, per tier. */
export const TIER_INTENSITY: Record<FoilTier, number> = {
  flat: 0,
  sparkle: 0.35,
  rainbow: 0.7,
  cosmos: 1,
};

/** Exported so a test can assert it covers exactly the API's rarity list. */
export const TIER_BY_RARITY: Record<string, FoilTier> = {
  // flat — no foil at all
  Common: 'flat',
  Uncommon: 'flat',
  None: 'flat',
  'One Diamond': 'flat',
  'Two Diamond': 'flat',
  'Three Diamond': 'flat',
  // sparkle — fine glitter
  Rare: 'sparkle',
  'Four Diamond': 'sparkle',
  Promo: 'sparkle',
  'One Star': 'sparkle',
  'Classic Collection': 'sparkle',
  'Black White Rare': 'sparkle',
  // rainbow — spectral sheen across the art
  'Holo Rare': 'rainbow',
  'Rare Holo': 'rainbow',
  'Rare Holo LV.X': 'rainbow',
  'Rare PRIME': 'rainbow',
  'Holo Rare V': 'rainbow',
  'Holo Rare VMAX': 'rainbow',
  'Holo Rare VSTAR': 'rainbow',
  'Double rare': 'rainbow',
  'Amazing Rare': 'rainbow',
  'Radiant Rare': 'rainbow',
  'Shiny rare': 'rainbow',
  'Shiny rare V': 'rainbow',
  'Shiny rare VMAX': 'rainbow',
  'One Shiny': 'rainbow',
  'Two Shiny': 'rainbow',
  LEGEND: 'rainbow',
  'ACE SPEC Rare': 'rainbow',
  'Two Star': 'rainbow',
  'Full Art Trainer': 'rainbow',
  'Ultra Rare': 'rainbow',
  'Pikachu Rare': 'rainbow',
  // cosmos — galaxy speckle and the strongest refraction
  'Hyper rare': 'cosmos',
  'Mega Hyper Rare': 'cosmos',
  'Secret Rare': 'cosmos',
  'Special illustration rare': 'cosmos',
  'Illustration rare': 'cosmos',
  'Shiny Ultra Rare': 'cosmos',
  Crown: 'cosmos',
  'Three Star': 'cosmos',
  'Futuristic Rare': 'cosmos',
};

function bump(tier: FoilTier, steps: number): FoilTier {
  const index = Math.min(ORDER.length - 1, ORDER.indexOf(tier) + steps);
  return ORDER[index];
}

/**
 * The foil a card should get. Rarity decides the baseline; the printing
 * variants can only raise it — a reverse-holo Common really is foiled, and a
 * holo printing of an ordinary Rare really does have a spectral sheen.
 */
export function foilTier(rarity?: string, variants?: Variants): FoilTier {
  let tier: FoilTier = rarity && TIER_BY_RARITY[rarity] ? TIER_BY_RARITY[rarity] : 'sparkle';
  if (variants?.reverse && tier === 'flat') tier = bump(tier, 1);
  if (variants?.holo && tier === 'sparkle') tier = bump(tier, 1);
  return tier;
}

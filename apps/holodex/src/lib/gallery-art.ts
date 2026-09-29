import { EFFECT_GALLERY } from '../holo/effect-gallery';

/**
 * The effects page's first-screen art as served from this remote's own origin
 * (`public/gallery/<id>.webp`, copied from TCGdex at build time by
 * scripts/download-gallery-art.mjs): the first section's three cards, the
 * page's LCP. Undefined for every other card, which loads TCGdex's own file.
 *
 * Named from this module's URL, since the host's page is on another origin:
 * the host's loader fetched it from the remote's (or, standalone, the page's
 * own). CardImage tries it first and moves on to TCGdex's files if it fails.
 */
export function galleryArt(cardId: string): string | undefined {
  if (!FIRST_SECTION.has(cardId)) return undefined;
  return new URL(`${import.meta.env.BASE_URL}gallery/${cardId}.webp`, import.meta.url).href;
}

const FIRST_SECTION = new Set<string>(EFFECT_GALLERY[0]?.cardIds ?? []);

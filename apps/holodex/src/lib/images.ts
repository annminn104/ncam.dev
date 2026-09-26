/**
 * TCGdex returns an extension-less asset base like
 * `https://assets.tcgdex.net/en/swsh/swsh3/136`; quality and format are path
 * suffixes. Roughly one card brief in five has no image at all, so every call
 * site has to handle `null`.
 */
export type ImageQuality = 'low' | 'high';
export type ImageFormat = 'webp' | 'png';

export function imageUrl(
  base: string | undefined | null,
  quality: ImageQuality,
  format: ImageFormat = 'webp',
): string | null {
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${quality}.${format}`;
}

/**
 * The files to try for a card's art, in order: WebP, then PNG, as a set logo
 * falls back (TCGdex serves three of its 157 set logos only as PNG). Empty for
 * a card without an image.
 */
export function imageUrls(base: string | undefined | null, quality: ImageQuality): string[] {
  const webp = imageUrl(base, quality, 'webp');
  const png = imageUrl(base, quality, 'png');
  return webp && png ? [webp, png] : [];
}

/**
 * The files to try for a set's image, in order: its logo as WebP, then as PNG
 * (basep, hgss3 and xy3 have only the PNG), then its symbol the same way.
 * Empty for a set with neither.
 */
export function setImageUrls(set: { logo?: string; symbol?: string }): string[] {
  return [set.logo, set.symbol].flatMap((base) => (base ? [`${base}.webp`, `${base}.png`] : []));
}

/**
 * A subset set's id: its parent's id plus `tg` (Trainer Gallery), `gg`
 * (Galarian Gallery) or `sv` (Shiny Vault). Anchored at both ends and only on
 * `swsh`, because the same letters sit elsewhere in real TCGdex ids: Scarlet &
 * Violet ids *start* with `sv` (`sv03.5`), McDonald's collections *end* with
 * it (`2023sv`, none of whose cards has an image either) and put a year before
 * `swsh` (`2021swsh`). Matches exactly the six sets `cardImageBase` names, and
 * no other of TCGdex's 220.
 */
const SUBSET_SET = /^(swsh[\d.]+)(tg|gg|sv)$/i;

/**
 * The asset base for a card, recovering subset images the API does not link.
 *
 * TCGdex's API omits `image` for every card in a subset set, yet the asset
 * exists, stored under the **parent** set's path:
 *
 *     swsh12tg-TG23  →  https://assets.tcgdex.net/en/swsh/swsh12/TG23
 *
 * Verified on 2026-09-24 against assets.tcgdex.net for all 312 such cards,
 * every one resolving, with the API linking an image for none of them:
 * `swsh4.5sv` → `swsh4.5` (122 of 122), `swsh9tg` → `swsh9`, `swsh10tg` →
 * `swsh10`, `swsh11tg` → `swsh11`, `swsh12tg` → `swsh12` (30 of 30 each) and
 * `swsh12.5gg` → `swsh12.5` (70 of 70). Content was checked by eye as well,
 * since a 200 only proves *some* image is there: `swsh12/TG23` is Friends in
 * Galar and `swsh4.5/SV106` is shiny Rillaboom VMAX, both exactly right.
 *
 * Correct by construction, not just by sampling: every one of the 312
 * `localId`s carries its prefix (`SV…`, `TG…`, `GG…`) and none collides with
 * a `localId` in its parent set, so the path can only reach the intended
 * subset card, never a main-set card that shares its number. So the `localId`
 * goes in unchanged — keep the prefix. The serie is `swsh` for all six, which
 * the regex guarantees, and `en` is the language the app queries.
 *
 * Deliberately NOT covered — do not widen the rule to reach these:
 *  - `cel25cc` (Celebrations Classic Collection). Its obvious parent path,
 *    `en/swsh/cel25/1`, answers 200, but with Ho-Oh, not the Blastoise that
 *    `cel25cc-CC001` is: dropping the `CC` prefix lands on Celebrations' own
 *    #1. A rule that reached it would ship the wrong artwork.
 *  - `sm7.5`, and anything else. `en/sm/sm75/1` also answers 200, but nobody
 *    has checked what it serves, and the id mangling (dropping the dot) is not
 *    consistent across series: `swsh4.5` and `sv03.5` keep theirs.
 * The rule exists because it was checked on 312 of 312 cards. A case nobody
 * has looked at stays imageless rather than getting a guess.
 *
 * The API is authoritative when it answers: a card with an `image` gets it
 * back unchanged. `CardBrief` has no `set`, so the set id comes from stripping
 * the trailing `-${localId}` off `card.id`, never from splitting on a hyphen,
 * which set ids contain (`P-A`, `30th-c`).
 */
export function cardImageBase(card: {
  id: string;
  localId: string;
  image?: string;
}): string | undefined {
  if (card.image) return card.image;
  const suffix = `-${card.localId}`;
  if (!card.id.endsWith(suffix)) return undefined;
  const match = SUBSET_SET.exec(card.id.slice(0, -suffix.length));
  return match ? `https://assets.tcgdex.net/en/swsh/${match[1]}/${card.localId}` : undefined;
}

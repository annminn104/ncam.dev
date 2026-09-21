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

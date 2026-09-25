import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { CARD_ASPECT } from '../lib/constants';
import { imageUrls, type ImageQuality } from '../lib/images';
import { cn } from '../lib/utils';

export interface CardImageProps {
  base?: string;
  name: string;
  quality?: ImageQuality;
  className?: string;
  priority?: boolean;
  /**
   * Something beside the image already names the card (an effects-page tile's
   * caption), so the art stays out of the accessible name instead of
   * repeating it: `alt=""` on the image, `aria-hidden` on the placeholder.
   */
  decorative?: boolean;
}

export function CardImage({
  base,
  name,
  quality = 'low',
  className,
  priority = false,
  decorative = false,
}: CardImageProps) {
  // WebP first, then PNG, then the placeholder below: an art file that fails
  // to load moves on to the next. Counted against the first URL, so a new card
  // or quality starts again from its WebP.
  const urls = imageUrls(base, quality);
  const key = urls[0] ?? '';
  const [failures, setFailures] = useState({ key, count: 0 });
  const src = urls[failures.key === key ? failures.count : 0];
  const ref = useRef<HTMLImageElement>(null);
  const advance = () => setFailures(oneMoreFailure(key));
  useEffect(() => {
    // An image that failed before hydration fired its error event unheard.
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setFailures(oneMoreFailure(key));
  }, [src, key]);
  if (!src) {
    // A <span> (its `grid` class makes it a block), not a <div>: grid tiles
    // and effects-page tiles are <button>s, which take phrasing content only.
    return (
      <span
        aria-hidden={decorative || undefined}
        style={{ aspectRatio: CARD_ASPECT }}
        className={cn(
          'grid place-items-center rounded-lg border border-holo-line bg-holo-panel p-2 text-center',
          className,
        )}
      >
        <span className="text-holo-muted">
          <ImageOff aria-hidden="true" className="mx-auto mb-1 h-5 w-5" />
          <span className="block text-[0.7rem] leading-tight">{name}</span>
          <span className="sr-only">No image available</span>
        </span>
      </span>
    );
  }
  return (
    <img
      ref={ref}
      src={src}
      onError={advance}
      alt={decorative ? '' : name}
      style={{ aspectRatio: CARD_ASPECT }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('w-full rounded-lg object-contain', className)}
    />
  );
}

/** One more failed file for the art at `key`, counting afresh for a new card or quality. */
function oneMoreFailure(key: string) {
  return (prev: { key: string; count: number }) => ({
    key,
    count: (prev.key === key ? prev.count : 0) + 1,
  });
}

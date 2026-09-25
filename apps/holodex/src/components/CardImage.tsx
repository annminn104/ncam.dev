import { ImageOff } from 'lucide-react';
import { CARD_ASPECT } from '../lib/constants';
import { imageUrl, imageUrls, type ImageQuality } from '../lib/images';
import { cn } from '../lib/utils';
import { useImageFallback } from './use-image-fallback';

export interface CardImageProps {
  base?: string;
  name: string;
  quality?: ImageQuality;
  className?: string;
  priority?: boolean;
  /**
   * Something beside the image already names the card (an effects-page tile's
   * caption), so the art stays out of the accessible name instead of
   * repeating it: `alt=""` on the image, `aria-hidden` on the fallback.
   */
  decorative?: boolean;
}

/** A card-shaped glow in the holo palette: what a grid tile shows until its art loads. */
const SILHOUETTE = {
  backgroundImage: [
    'radial-gradient(circle at 30% 22%, color-mix(in oklab, var(--color-holo-accent) 26%, transparent), transparent 58%)',
    'radial-gradient(circle at 72% 78%, color-mix(in oklab, var(--color-holo-accent) 14%, transparent), transparent 55%)',
  ].join(', '),
};

const FADE = 'transition-opacity duration-300';

/**
 * A card's art, WebP first, then PNG, then the unavailable card below: a file
 * that fails to load moves on to the next (`useImageFallback`). While it
 * loads, a placeholder holds its place and it fades in over it: the card's own
 * low-res art, blurred, for a high-res image (a visitor from the grid has it
 * cached already), and a blurred card silhouette for a grid image, which has
 * nothing smaller.
 */
export function CardImage({
  base,
  name,
  quality = 'low',
  className,
  priority = false,
  decorative = false,
}: CardImageProps) {
  const { src, loaded, ref, onLoad, onError } = useImageFallback(imageUrls(base, quality));
  if (!src) return <UnavailableCard name={name} decorative={decorative} className={className} />;
  const lqip = quality === 'high' ? imageUrl(base, 'low') : null;

  // Spans, not divs: grid tiles and effects-page tiles are <button>s, which
  // take phrasing content only.
  return (
    <span
      style={{ aspectRatio: CARD_ASPECT }}
      className={cn('relative block overflow-hidden rounded-lg', className)}
    >
      {lqip ? (
        <img
          data-placeholder="lqip"
          src={lqip}
          alt=""
          aria-hidden="true"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={cn(
            'absolute inset-0 h-full w-full scale-105 object-contain blur-md',
            FADE,
            loaded && 'opacity-0',
          )}
        />
      ) : (
        <span
          data-placeholder="silhouette"
          aria-hidden="true"
          style={SILHOUETTE}
          className={cn(
            'absolute inset-0 rounded-lg bg-holo-panel',
            FADE,
            loaded ? 'opacity-0' : 'animate-pulse',
          )}
        >
          <span className="absolute inset-[6%] rounded-md border border-holo-line blur-[1px]" />
          <span className="absolute inset-x-[11%] top-[13%] h-[38%] rounded bg-holo-bg/60 blur-[2px]" />
        </span>
      )}
      <img
        ref={ref}
        src={src}
        alt={decorative ? '' : name}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={onLoad}
        onError={onError}
        className={cn(
          'relative block h-full w-full rounded-lg object-contain',
          FADE,
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </span>
  );
}

/**
 * A card TCGdex has no art for, or could serve in no format: a card frame,
 * marked unavailable and named.
 */
function UnavailableCard({
  name,
  decorative,
  className,
}: {
  name: string;
  decorative: boolean;
  className?: string;
}) {
  return (
    <span
      data-fallback="unavailable"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${name}: image unavailable`}
      style={{ aspectRatio: CARD_ASPECT }}
      className={cn(
        'relative grid place-items-center rounded-lg border border-holo-line bg-holo-panel p-2 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-[6%] rounded-md border border-dashed border-holo-line"
      />
      <span className="relative text-holo-muted">
        <ImageOff aria-hidden="true" className="mx-auto mb-1 h-5 w-5" />
        <span className="block text-[0.7rem] leading-tight font-medium">Image unavailable</span>
        <span className="mt-0.5 block text-[0.7rem] leading-tight opacity-80">{name}</span>
      </span>
    </span>
  );
}

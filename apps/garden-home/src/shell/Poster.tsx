import { poster } from '../assets/poster';

/**
 * The scene as a picture: what the first paint shows until the scene draws it live. Portrait
 * (1:2) at or below a square viewport, landscape (2.4:1) above; `object-fit: cover` in styles.css.
 * `sizes` follows cover: a viewport wider than the picture fills its width, a narrower one its height.
 */
export function Poster() {
  return (
    <picture className="gh-poster">
      <source
        type="image/avif"
        media="(max-aspect-ratio: 1/1)"
        srcSet={poster.portrait.avif}
        sizes="(max-aspect-ratio: 1/2) 50vh, 100vw"
      />
      <source type="image/webp" media="(max-aspect-ratio: 1/1)" srcSet={poster.portrait.fallback} />
      <source
        type="image/avif"
        srcSet={poster.landscape.avif}
        sizes="(min-aspect-ratio: 12/5) 100vw, 240vh"
      />
      <img
        src={poster.landscape.fallback}
        width={poster.landscape.width}
        height={poster.landscape.height}
        alt="A glass villa on a floating green island, with its pool, koi pond, gardens and carport around it."
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}

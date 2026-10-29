import { poster } from '../assets/poster';

/**
 * The scene as a picture until it runs, over the page's own backdrop (the capture has alpha).
 * Portrait at or below a square viewport, landscape above; `object-fit: cover`.
 */
export function Poster() {
  return (
    <picture className="cdp-poster">
      <source
        type="image/avif"
        media="(max-aspect-ratio: 1/1)"
        srcSet={poster.portrait.avif}
        sizes="100vw"
      />
      <source type="image/webp" media="(max-aspect-ratio: 1/1)" srcSet={poster.portrait.fallback} />
      <source type="image/avif" srcSet={poster.landscape.avif} sizes="100vw" />
      <img
        src={poster.landscape.fallback}
        width={poster.landscape.width}
        height={poster.landscape.height}
        alt="A pink leather suitcase CD player with its lid open: a crystal CD case, two polaroids and a now-spinning card inside the lid."
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}

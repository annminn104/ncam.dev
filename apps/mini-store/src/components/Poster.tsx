import { poster } from '../assets/poster';

/**
 * The scene as a picture until the engine draws it live: the page's LCP. Portrait (1:2) at or
 * below a square viewport, landscape (2.4:1) above; `object-fit: cover` in globals.css. `sizes`
 * follows cover: a viewport wider than the picture fills its width, a narrower one its height.
 */
export function Poster() {
  return (
    <picture className="ms-poster">
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
        alt="A miniature convenience store on a rainy street corner at night, its lit windows reflected in the wet road as scooters and a taxi pass."
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}

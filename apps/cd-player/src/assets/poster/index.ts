/**
 * The poster the page shows until the scene runs: the scene itself with its default prints,
 * captured with alpha by scripts/capture-poster.mjs (SwiftShader, so any machine makes the same
 * picture). AVIF at three widths per shape plus a WebP fallback. Imported, not in public/, so
 * defineRemote's renderBuiltUrl names them from this remote's origin, on the server too. Capture
 * again after any change to the model, the lights, the camera or the default prints.
 */
import landscape1280 from './landscape-1280.avif';
import landscape1920 from './landscape-1920.avif';
import landscape2560 from './landscape-2560.avif';
import landscapeFallback from './landscape-1920.webp';
import portrait480 from './portrait-480.avif';
import portrait750 from './portrait-750.avif';
import portrait1080 from './portrait-1080.avif';
import portraitFallback from './portrait-750.webp';

export interface PosterSource {
  /** `srcset` of the AVIF files. */
  avif: string;
  /** The WebP `src` for a browser without AVIF. */
  fallback: string;
  /** The capture's size in pixels (src/capture.ts: its CSS viewport times its scale). */
  width: number;
  height: number;
}

export const poster: Readonly<Record<'landscape' | 'portrait', PosterSource>> = {
  landscape: {
    avif: `${landscape1280} 1280w, ${landscape1920} 1920w, ${landscape2560} 2560w`,
    fallback: landscapeFallback,
    width: 2560,
    height: 1440,
  },
  portrait: {
    avif: `${portrait480} 480w, ${portrait750} 750w, ${portrait1080} 1080w`,
    fallback: portraitFallback,
    width: 1080,
    height: 2337,
  },
};

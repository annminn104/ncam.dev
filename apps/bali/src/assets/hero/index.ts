/**
 * The hero's three parallax layers, self-hosted. Derived with sharp from the
 * provided artwork on the strvid CDN
 * (https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/s7_layer_{1,2,3}.png,
 * 1 MB of PNG together): AVIF (quality 50) at 640 and 1280 px and the source
 * width, plus a 1280 px WebP (quality 70) for browsers without AVIF. A phone
 * fetches about 110 KB of it where the PNGs were the whole megabyte, on the
 * first screen. Regenerate from those PNGs the same way if the artwork changes.
 */
import back640 from './back-640.avif';
import back1280 from './back-1280.avif';
import back1672 from './back-1672.avif';
import backFallback from './back-1280.webp';
import mid640 from './mid-640.avif';
import mid1280 from './mid-1280.avif';
import mid1536 from './mid-1536.avif';
import midFallback from './mid-1280.webp';
import front640 from './front-640.avif';
import front1280 from './front-1280.avif';
import front1536 from './front-1536.avif';
import frontFallback from './front-1280.webp';

export interface HeroLayer {
  /** `srcset` of the AVIF files. */
  avif: string;
  /** The WebP `src` for a browser without AVIF. */
  fallback: string;
}

export const heroLayers: Readonly<Record<'back' | 'mid' | 'front', HeroLayer>> = {
  back: {
    avif: `${back640} 640w, ${back1280} 1280w, ${back1672} 1672w`,
    fallback: backFallback,
  },
  mid: {
    avif: `${mid640} 640w, ${mid1280} 1280w, ${mid1536} 1536w`,
    fallback: midFallback,
  },
  front: {
    avif: `${front640} 640w, ${front1280} 1280w, ${front1536} 1536w`,
    fallback: frontFallback,
  },
};

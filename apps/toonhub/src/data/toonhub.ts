/**
 * TOONHUB — single source of truth.
 *
 * Every configurable aspect of the hero (content, behaviour, timing,
 * accessibility strings, responsive thresholds and feature flags) lives here
 * and is passed to `ToonHubHero.astro` through one single `config` prop.
 */

export interface ToonHubItem {
  /**
   * The figurine, as a path without width or extension: it is published as
   * `<image>-<width>.webp` for every width in `FIGURINE_WIDTHS`
   * (hero-template.ts), which `scripts/download-assets.mjs` derives from the
   * PNG source in `assets/figurines/`.
   */
  image: string;
  bg: string;
  panel: string;
  name: string;
  edition: string;
  category: string;
  alt: string;
}

export interface ToonHubFeatureFlags {
  autoplay: boolean;
  swipe: boolean;
  keyboard: boolean;
  wheel: boolean;
  pointerParallax: boolean;
  cursorGlow: boolean;
  floatingParticles: boolean;
  soundToggle: boolean;
  autoplayToggle: boolean;
  progressIndicator: boolean;
  metadata: boolean;
  easterEgg: boolean;
  grain: boolean;
  ambientGlow: boolean;
  floorShadow: boolean;
  auroraBlobs: boolean;
  halftoneGrid: boolean;
  lightSweep: boolean;
  vignette: boolean;
}

export interface ToonHubTimingConfig {
  transitionMs: number;
  autoplayMs: number;
  entryDelayMs: number;
  easterEggDurationMs: number;
}

export interface ToonHubCopyConfig {
  brand: string;
  ghostText: string;
  heading: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface ToonHubAccessibilityConfig {
  carouselLabel: string;
  previousLabel: string;
  nextLabel: string;
  autoplayPauseLabel: string;
  autoplayPlayLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  /**
   * What the CTA leads to, read after its visible label ("DISCOVER IT,
   * TOONHUB figurines"). An addition rather than a replacement: an accessible
   * name must contain the visible label (WCAG 2.5.3, Label in Name).
   */
  discoverLabel: string;
  slideAnnouncementTemplate: string;
}

export interface ToonHubResponsiveConfig {
  mobileBreakpoint: number;
  shortViewportHeight: number;
  dragThreshold: number;
  wheelThreshold: number;
}

/** Background music. Must stay JSON-serializable. When `src` is empty a
 *  built-in Web Audio synth loop is used; otherwise the file at `src` plays. */
export interface ToonHubAudioConfig {
  /** Master switch for the audio engine. */
  enabled: boolean;
  /** Optional audio file URL. Empty string = use the built-in synth loop. */
  src: string;
  /** Master volume, 0..1. */
  volume: number;
  /** Loop the file (file mode only). */
  loop: boolean;
  /** Play a short chime when the active figurine changes (synth mode only). */
  navChime: boolean;
}

/** How the carousel reports user/state actions. Must stay JSON-serializable. */
export interface ToonHubLoggingConfig {
  /** Master switch. When false, no logging or events are emitted. */
  enabled: boolean;
  /** Emit action logs to the browser console. */
  console: boolean;
  /** Dispatch a `toonhub:action` CustomEvent on the root for external listeners. */
  events: boolean;
  /** Minimum level that is emitted: 'debug' < 'info' < 'warn'. */
  level: 'debug' | 'info' | 'warn';
  /** Console label prefix, e.g. '[TOONHUB]'. */
  prefix: string;
}

export interface ToonHubConfig {
  id: string;
  items: ToonHubItem[];
  initialIndex: number;
  copy: ToonHubCopyConfig;
  features: ToonHubFeatureFlags;
  timing: ToonHubTimingConfig;
  accessibility: ToonHubAccessibilityConfig;
  responsive: ToonHubResponsiveConfig;
  audio?: ToonHubAudioConfig;
  logging?: ToonHubLoggingConfig;
}

// Images are self-hosted from `public/figurines/`, derived from the PNG sources
// in `assets/figurines/` by `pnpm assets` (which also runs before `dev` / `build`).
const items: ToonHubItem[] = [
  {
    image: '/figurines/01',
    bg: '#F4845F',
    panel: '#F79B7F',
    name: 'Solar Scout',
    edition: '01',
    category: 'Adventure Series',
    alt: 'Orange TOONHUB collectible figurine',
  },
  {
    image: '/figurines/02',
    bg: '#6BBF7A',
    panel: '#85CC92',
    name: 'Forest Runner',
    edition: '02',
    category: 'Nature Series',
    alt: 'Green TOONHUB collectible figurine',
  },
  {
    image: '/figurines/03',
    bg: '#E882B4',
    panel: '#ED9DC4',
    name: 'Candy Dreamer',
    edition: '03',
    category: 'Dream Series',
    alt: 'Pink TOONHUB collectible figurine',
  },
  {
    image: '/figurines/04',
    bg: '#6EB5FF',
    panel: '#8DC4FF',
    name: 'Sky Surfer',
    edition: '04',
    category: 'Future Series',
    alt: 'Blue TOONHUB collectible figurine',
  },
];

export const toonHubConfig: ToonHubConfig = {
  id: 'toonhub-hero',
  initialIndex: 0,
  items,
  copy: {
    brand: 'TOONHUB',
    ghostText: '3D SHAPE',
    heading: 'TOONHUB FIGURINES',
    description:
      'The artwork is stunning, shipped fully prepared. The finish is a vision, the 3D craft is flawless. Many thanks! Wishing you the win. Order now.',
    ctaLabel: 'DISCOVER IT',
    ctaHref: '#discover',
  },
  features: {
    autoplay: true,
    swipe: true,
    keyboard: true,
    wheel: true,
    pointerParallax: true,
    cursorGlow: true,
    floatingParticles: true,
    soundToggle: true,
    autoplayToggle: true,
    progressIndicator: true,
    metadata: true,
    easterEgg: true,
    grain: true,
    ambientGlow: true,
    floorShadow: true,
    auroraBlobs: true,
    halftoneGrid: true,
    lightSweep: true,
    vignette: true,
  },
  timing: {
    transitionMs: 650,
    autoplayMs: 5500,
    entryDelayMs: 120,
    easterEggDurationMs: 3000,
  },
  accessibility: {
    carouselLabel: 'TOONHUB collectible figurine carousel',
    previousLabel: 'Show previous figurine',
    nextLabel: 'Show next figurine',
    autoplayPauseLabel: 'Pause automatic slide rotation',
    autoplayPlayLabel: 'Resume automatic slide rotation',
    muteLabel: 'Mute background music',
    unmuteLabel: 'Play background music',
    discoverLabel: 'TOONHUB figurines',
    slideAnnouncementTemplate: 'Showing figurine {current} of {total}: {name}',
  },
  responsive: {
    mobileBreakpoint: 640,
    shortViewportHeight: 700,
    dragThreshold: 50,
    wheelThreshold: 45,
  },
  audio: {
    enabled: true,
    src: '',
    volume: 0.35,
    loop: true,
    navChime: true,
  },
  logging: {
    enabled: true,
    console: true,
    events: true,
    level: 'info',
    prefix: '[TOONHUB]',
  },
};

export default toonHubConfig;

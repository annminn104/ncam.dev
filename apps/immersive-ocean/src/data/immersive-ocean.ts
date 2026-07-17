/**
 * Immersive Ocean — single source of truth for page content (mirrors the
 * data-module convention used by toonhub / mindloop).
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface ImmersiveOceanConfig {
  brand: string;
  /** Looping background video (absolute URL). */
  video: string;
  nav: NavLink[];
  badge: string;
  /** Hero heading, one entry per line (rendered with <br/> between). */
  headingLines: string[];
  paragraph: string;
  ctaLabel: string;
  talkLabel: string;
}

export const immersiveOceanConfig: ImmersiveOceanConfig = {
  brand: 'Immersive Ocean',
  video:
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4',
  nav: [
    { label: 'Home', href: '#' },
    { label: 'Projects', href: '#' },
    { label: 'Studio', href: '#' },
    { label: 'Reach Us', href: '#' },
  ],
  badge: 'Brand & Visual Storytelling',
  headingLines: ['Shaping visual', 'narratives,', 'one pixel at a time.'],
  paragraph: 'Turning vision into reality through craft, motion, and an endless pursuit of beauty.',
  ctaLabel: 'Explore Work',
  talkLabel: "Let's Talk",
};

export default immersiveOceanConfig;

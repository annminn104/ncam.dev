import type { Theme } from '../lib/theme';

/**
 * The home page's sections — the contract between the host shell and the
 * `profile` remote. `id` is the DOM id the remote's <section> renders (the nav,
 * manifest rail and scroll tracker key off it); `module` is the exposed module
 * the host imports (`profile/<module>`); `bg` is the page background while the
 * section is active (GSAP tweens `--page-bg` on `.home`).
 *
 * `bg` carries one value per theme rather than a token reference because GSAP
 * tweens between two concrete colours — it cannot interpolate `var(--…)`. Each
 * light value is the same hue as its dark counterpart at the other end of the
 * lightness range, so the scroll choreography reads the same in both themes.
 */
export interface SectionMeta {
  id: string;
  label: string;
  module: string;
  bg: Record<Theme, string>;
}

export const sections: SectionMeta[] = [
  { id: 'top', label: 'Intro', module: 'hero', bg: { dark: '#0b0b12', light: '#fbfaff' } },
  { id: 'stacks', label: 'Stacks', module: 'stacks', bg: { dark: '#0c1022', light: '#f2f4fd' } },
  {
    id: 'experience',
    label: 'Experience',
    module: 'experience',
    bg: { dark: '#140f1f', light: '#f7f3fc' },
  },
  {
    id: 'projects',
    label: 'Projects',
    module: 'projects',
    bg: { dark: '#0b0f16', light: '#f1f4f8' },
  },
  { id: 'blog', label: 'Blog', module: 'blog', bg: { dark: '#0e1518', light: '#eff6f6' } },
  { id: 'contact', label: 'Contact', module: 'contact', bg: { dark: '#160e10', light: '#fdf2f2' } },
];

export type SectionId = (typeof sections)[number]['id'];

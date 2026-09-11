/**
 * The home page's sections — the contract between the host shell and the
 * `profile` remote. `id` is the DOM id the remote's <section> renders (the nav,
 * manifest rail and scroll tracker key off it); `module` is the exposed module
 * the host imports (`profile/<module>`); `bg` is the page background while the
 * section is active (GSAP tweens `--page-bg` on `.home`).
 */
export interface SectionMeta {
  id: string;
  label: string;
  module: string;
  bg: string;
}

export const sections: SectionMeta[] = [
  { id: 'top', label: 'Intro', module: 'hero', bg: '#0b0b12' },
  { id: 'stacks', label: 'Stacks', module: 'stacks', bg: '#0c1022' },
  { id: 'experience', label: 'Experience', module: 'experience', bg: '#140f1f' },
  { id: 'projects', label: 'Projects', module: 'projects', bg: '#0b0f16' },
  { id: 'blog', label: 'Blog', module: 'blog', bg: '#0e1518' },
  { id: 'contact', label: 'Contact', module: 'contact', bg: '#160e10' },
];

export type SectionId = (typeof sections)[number]['id'];

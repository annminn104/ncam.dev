/**
 * Shared registry of showcase projects.
 *
 * The shell reads this to render its gallery. `remote` + `module` describe how
 * to load the project's federated micro-frontend; the shell keeps a matching
 * loader whose import specifier is static (required by the federation plugin).
 */
export interface ProjectEntry {
  /** Stable id, also used as the gallery route key. */
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Brand accent colour (used for the gallery card). */
  accent: string;
  /** Gallery card thumbnail (served from the host's /public), also used as OG image. */
  thumbnail?: string;
  /** Module Federation remote name, e.g. 'toonhub'. */
  remote: string;
  /** Exposed module on that remote, e.g. './mount'. */
  module: string;
  status: 'live' | 'coming-soon';
}

export const projects: ProjectEntry[] = [
  {
    id: 'toonhub',
    name: 'TOONHUB',
    tagline: 'Collectible figurines',
    description:
      'A premium interactive collectible-figurine carousel hero — bold, playful, cinematic, with autoplay, swipe, ambient effects and music.',
    accent: '#F4845F',
    thumbnail: '/thumbnails/toonhub.png',
    remote: 'toonhub',
    module: './mount',
    status: 'live',
  },
  {
    id: 'mindloop',
    name: 'Mindloop',
    tagline: 'Newsletter / content platform',
    description:
      'A dark monochrome landing page for a newsletter & content platform — React, Framer Motion, liquid-glass UI, scroll-driven reveals and video + HLS backgrounds.',
    accent: '#62837C',
    thumbnail: '/thumbnails/mindloop.png',
    remote: 'mindloop',
    module: './mount',
    status: 'live',
  },
  {
    id: 'immersive-ocean',
    name: 'Immersive Ocean',
    tagline: 'Creative studio hero',
    description:
      'A fullscreen creative-studio landing page — looping ocean video background, responsive navbar with an animated mobile menu, and staggered CSS entrance animations. React + Tailwind + Geist.',
    accent: '#2C7DA0',
    thumbnail: '/thumbnails/immersive-ocean.png',
    // MF remote name must be a valid identifier → underscore (route id stays kebab).
    remote: 'immersive_ocean',
    module: './mount',
    status: 'live',
  },
];

export function getProject(id: string): ProjectEntry | undefined {
  return projects.find((project) => project.id === id);
}

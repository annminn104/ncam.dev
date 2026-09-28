import type { ProjectEntry } from '@ncam/project-registry';
import { AUTHOR_NAME, PERSON_ID, SITE_IMAGE, SITE_URL } from './site';

/**
 * The home page's WebSite node. `/` declares it once, with the Person as its
 * publisher (`PERSON_ID` in site.ts); every other page's JSON-LD points at the
 * two by `@id` instead of repeating them, so crawlers merge them into one
 * entity each.
 */
export const WEBSITE_ID = `${SITE_URL}/#website`;

// Public facts for SEO, copied from the profile remote's data file
// (apps/profile/src/data/profile.ts: displayName/fullName, role, the NAVER
// experience, socials, skillsSummary), where the full content lives.
const PERSON = {
  alternateName: ['Matthew', 'Nguyen Cao Anh Minh'],
  jobTitle: 'Frontend Developer',
  worksFor: 'NAVER Vietnam',
  knowsAbout: [
    'React',
    'Next.js',
    'Remix',
    'Angular',
    'TypeScript',
    'Tailwind CSS',
    'GSAP',
    'Micro Frontends',
  ],
  sameAs: [
    'https://www.linkedin.com/in/nguyencaoanhminh',
    'https://github.com/annminn104',
    'https://www.facebook.com/Minhmin0507',
  ],
};

/** `/`: the site's two entities, declared here and nowhere else. */
export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'ncam.dev',
        url: `${SITE_URL}/`,
        description: `Portfolio of ${PERSON.alternateName[0]} (${AUTHOR_NAME}), ${PERSON.jobTitle} — micro-frontends, motion and high-performance web apps.`,
        publisher: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: AUTHOR_NAME,
        alternateName: PERSON.alternateName,
        url: `${SITE_URL}/`,
        // The site's own card: there is no portrait to point at.
        image: SITE_IMAGE.url,
        jobTitle: PERSON.jobTitle,
        worksFor: { '@type': 'Organization', name: PERSON.worksFor },
        knowsAbout: PERSON.knowsAbout,
        sameAs: PERSON.sameAs,
      },
    ],
  };
}

/**
 * A project page: its breadcrumb, and the project as a CreativeWork whose
 * author and site are the home page's Person and WebSite, by `@id`.
 */
export function projectJsonLd(project: ProjectEntry) {
  const projectUrl = `${SITE_URL}/projects/${project.id}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Projects', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: project.name, item: projectUrl },
        ],
      },
      {
        '@type': 'CreativeWork',
        name: project.name,
        headline: project.tagline,
        description: project.description,
        url: projectUrl,
        ...(project.thumbnail ? { image: `${SITE_URL}${project.thumbnail}` } : {}),
        author: { '@type': 'Person', '@id': PERSON_ID, name: AUTHOR_NAME },
        isPartOf: { '@id': WEBSITE_ID },
      },
    ],
  };
}

/**
 * JSON destined for a `<script>` block. Same treatment the remotes give their
 * SSR payload (see holodex's `serialiseState`): `<` becomes its unicode escape,
 * so no value can open or close a tag, and `JSON.parse` reads the original
 * character back. Registry-controlled today — escaped anyway, because this is
 * the same sink and the registry will not always be the only source.
 */
export function serialiseJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

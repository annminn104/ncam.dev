import { getProject } from '@ncam/project-registry';
import { SITE_URL } from './site';

/**
 * Per-project SEO. The route is SSR'd, so crawlers get a project-specific
 * title/description/canonical + Open Graph, even for client-mounted remotes.
 *
 * Shared by the bare project route and its splat route: `splat`, when given,
 * is appended to the canonical URL and `og:url` so a route-aware remote's
 * deep links get their own canonical instead of all pointing at the project
 * root.
 */
export function projectHead(projectId: string, splat?: string) {
  const project = getProject(projectId);
  if (!project) {
    return {
      meta: [{ title: 'Project not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
    };
  }
  const title = `${project.name} — ${project.tagline} · ncam.dev`;
  const description = project.description;
  const url = `${SITE_URL}/projects/${project.id}${splat ? `/${splat}` : ''}`;
  const image = project.thumbnail ? `${SITE_URL}${project.thumbnail}` : undefined;
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: project.status === 'live' ? 'index,follow' : 'noindex' },
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      ...(image
        ? [
            { property: 'og:image', content: image },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
          ]
        : []),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(image ? [{ name: 'twitter:image', content: image }] : []),
    ],
    links: [{ rel: 'canonical', href: url }],
  };
}

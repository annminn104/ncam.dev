import { getProject } from '@ncam/project-registry';
import { SITE_URL } from './site';

/**
 * Whether a deep link below a project path is a real page of that project.
 *
 * The splat route answers 200 for any depth, so for a remote that renders a
 * single page every typo — `/projects/bali/anything/at/all` — is served as the
 * full bali stage. Left alone it would carry a self-referential canonical and
 * become another indexable duplicate, an unbounded URL space per project.
 * Only a route-aware remote (one that implements `MountConfig.route` /
 * `MountHandle.update`) actually owns URLs down there.
 */
export function isRealProjectPath(projectId: string, splat?: string): boolean {
  if (!splat) return true;
  return getProject(projectId)?.routeAware === true;
}

/**
 * Per-project SEO. The route is SSR'd, so crawlers get a project-specific
 * title/description/canonical + Open Graph, even for client-mounted remotes.
 *
 * Shared by the bare project route and its splat route: `splat`, when given,
 * is appended to the canonical URL and `og:url` so a route-aware remote's
 * deep links get their own canonical instead of all pointing at the project
 * root. A deep link into a remote that is NOT route-aware is not a page of its
 * own — it gets `noindex` and a canonical back to the project root.
 */
export function projectHead(projectId: string, splat?: string) {
  const project = getProject(projectId);
  if (!project) {
    return {
      meta: [{ title: 'Project not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
    };
  }
  const real = isRealProjectPath(projectId, splat);
  const title = `${project.name} — ${project.tagline} · ncam.dev`;
  const description = project.description;
  const url = `${SITE_URL}/projects/${project.id}${real && splat ? `/${splat}` : ''}`;
  const image = project.thumbnail ? `${SITE_URL}${project.thumbnail}` : undefined;
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      {
        name: 'robots',
        content: project.status === 'live' && real ? 'index,follow' : 'noindex',
      },
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

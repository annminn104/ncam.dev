import type { SsrHead } from '@ncam/mf-remote';
import { getProject } from '@ncam/project-registry';
import { NOT_FOUND_META } from './not-found';
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
 * A remote's `head` from its server render (`SsrHead`, @ncam/mf-remote), kept
 * as far as it is usable: non-empty strings, whitespace collapsed. It is
 * another deployment's code answering over the network, so the host checks
 * the value rather than trust the type.
 */
export function remoteHead(value: unknown): SsrHead | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const text = (field: unknown) =>
    typeof field === 'string' ? field.replace(/\s+/g, ' ').trim() || undefined : undefined;
  const { title, description } = value as Record<string, unknown>;
  const head: SsrHead = {};
  const cleanTitle = text(title);
  const cleanDescription = text(description);
  if (cleanTitle) head.title = cleanTitle;
  if (cleanDescription) head.description = cleanDescription;
  return cleanTitle || cleanDescription ? head : undefined;
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
 *
 * `remote` is the `head` the remote's server render named the page with (the
 * splat route's loader data). It titles and describes a route-aware remote's
 * deep link — "Base Set card list · Holodex · ncam.dev" — so no two share the
 * project's. Absent (the bare project page, a page the remote could not name,
 * a client navigation or `vite dev`, where the loader renders nothing), the
 * project's own title and description stand.
 */
export function projectHead(projectId: string, splat?: string, remote?: SsrHead) {
  const project = getProject(projectId);
  // Both project loaders throw notFound() for such an id, which renders the
  // root's 404 head instead; this is the same head, should one ever get here.
  if (!project) return { meta: NOT_FOUND_META };
  const real = isRealProjectPath(projectId, splat);
  const page = real && splat ? remote : undefined;
  const title = page?.title
    ? `${page.title} · ${project.name} · ncam.dev`
    : `${project.name} — ${project.tagline} · ncam.dev`;
  const description = page?.description ?? project.description;
  const url = `${SITE_URL}/projects/${project.id}${real && splat ? `/${splat}` : ''}`;
  const image = project.thumbnail ? `${SITE_URL}${project.thumbnail}` : undefined;
  // The root route's alt text describes the site's own og.png; tags merge by
  // name, so a thumbnail without an alt of its own would inherit that one.
  const imageAlt = `Screenshot of ${project.name} — ${project.tagline}`;
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
            { property: 'og:image:alt', content: imageAlt },
          ]
        : []),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(image
        ? [
            { name: 'twitter:image', content: image },
            { name: 'twitter:image:alt', content: imageAlt },
          ]
        : []),
    ],
    links: [{ rel: 'canonical', href: url }],
  };
}

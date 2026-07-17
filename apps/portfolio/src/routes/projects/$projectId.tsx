import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getProject } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';

const log = createLogger({ scope: 'portfolio' });

const SITE_URL = 'https://ncam.dev';

// Static import specifiers so the Module Federation plugin can transform them.
// `./ssr` is server-safe (loader); `./hydrate` / `./mount` are client-only.
type SsrResult = { html: string; css: string };
type SsrModule = {
  renderHeroSSR: (opts?: {
    config?: unknown;
    assetBase?: string;
  }) => SsrResult | Promise<SsrResult>;
};
type HydrateModule = { hydrate: (target: HTMLElement) => () => void };
type MountModule = { mount: (el: HTMLElement, config?: unknown) => () => void };

const ssrLoaders: Record<string, () => Promise<SsrModule>> = {
  toonhub: () => import('toonhub/ssr'),
  mindloop: () => import('mindloop/ssr'),
  immersive_ocean: () => import('immersive_ocean/ssr'),
};
const hydrateLoaders: Record<string, () => Promise<HydrateModule>> = {
  toonhub: () => import('toonhub/hydrate'),
  mindloop: () => import('mindloop/hydrate'),
  immersive_ocean: () => import('immersive_ocean/hydrate'),
};
const mountLoaders: Record<string, () => Promise<MountModule>> = {
  toonhub: () => import('toonhub/mount'),
  mindloop: () => import('mindloop/mount'),
  immersive_ocean: () => import('immersive_ocean/mount'),
};

interface LoaderData {
  html: string | null;
  css: string;
}

export const Route = createFileRoute('/projects/$projectId')({
  // SSR the remote's markup for SEO / first paint. Federated SSR resolution is
  // only wired in the production build — in `vite dev` this throws, so we fall
  // back to client-side mount (below). Either way the loader stays graceful.
  loader: async ({ params }): Promise<LoaderData> => {
    const project = getProject(params.projectId);
    if (!project || project.status !== 'live') return { html: null, css: '' };
    const load = ssrLoaders[project.remote];
    // Federated SSR only resolves in the production build; in dev it can't (and
    // may hang), so always fall back to the reliable client mount there.
    if (!load || !import.meta.env.PROD) return { html: null, css: '' };
    try {
      const { renderHeroSSR } = await load();
      const { html, css } = await renderHeroSSR({ assetBase: import.meta.env.VITE_TOONHUB_ORIGIN });
      log.debug('project.ssr', { id: project.id });
      return { html, css };
    } catch {
      // SSR remote resolution unavailable (e.g. vite dev) → client-side mount.
      log.debug('project.ssr-fallback', { id: project.id });
      return { html: null, css: '' };
    }
  },
  // Per-project SEO. The route is SSR'd, so crawlers get a project-specific
  // title/description/canonical + Open Graph, even for client-mounted remotes.
  head: ({ params }) => {
    const project = getProject(params.projectId);
    if (!project) {
      return {
        meta: [{ title: 'Project not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
      };
    }
    const title = `${project.name} — ${project.tagline} · ncam.dev`;
    const description = project.description;
    const url = `${SITE_URL}/projects/${project.id}`;
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
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { html, css } = Route.useLoaderData();
  const project = getProject(projectId);
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project || project.status !== 'live') return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    // SSR available → hydrate the server-rendered DOM. Otherwise → client mount.
    const attach = html
      ? hydrateLoaders[project.remote]?.().then((m) => m.hydrate)
      : mountLoaders[project.remote]?.().then((m) => m.mount);
    attach
      ?.then((fn) => {
        if (!cancelled && mountRef.current) {
          dispose = fn(mountRef.current);
          log.info('project.open', { id: project.id, mode: html ? 'ssr-hydrate' : 'csr-mount' });
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('project.mount-failed', { id: project.id, error: message });
        setError(message);
      });
    return () => {
      cancelled = true;
      try {
        dispose?.();
      } catch {
        /* ignore disposer errors */
      }
    };
  }, [project, html]);

  if (!project) {
    return (
      <div className="stage">
        <Link to="/" className="stage__back">
          <span aria-hidden="true">←</span> Projects
        </Link>
        <div className="stage__error">
          <h2>Project not found</h2>
          <p>No project with id "{projectId}".</p>
        </div>
      </div>
    );
  }

  const projectUrl = `${SITE_URL}/projects/${project.id}`;
  const jsonLd = {
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
        author: { '@type': 'Person', name: 'Nguyen Cao Anh Minh' },
      },
    ],
  };

  return (
    <div className="stage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Projects
      </Link>
      {error ? (
        <div className="stage__error">
          <h2>Couldn't load {project.name}</h2>
          <p>{error}</p>
          <p className="stage__hint">
            Make sure the <code>{project.remote}</code> remote is running (run <code>pnpm dev</code>{' '}
            at the repo root), then reload.
          </p>
        </div>
      ) : null}
      {/* SSR path fills this via dangerouslySetInnerHTML; CSR path via mount(). */}
      {html && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        // Fresh container per project so React never reuses one mount node
        // across different remotes (avoids cross-framework teardown races).
        key={project.id}
        className="stage__mount"
        ref={mountRef}
        aria-label={project.name}
        {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
      />
    </div>
  );
}

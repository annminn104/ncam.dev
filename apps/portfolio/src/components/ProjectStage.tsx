import { Link, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getProject, type ProjectEntry } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import { loadRemoteModuleSSR } from '../lib/federation';
import { fromRemoteRoute } from '../lib/remote-route';
import { SITE_URL } from '../lib/site';

const log = createLogger({ scope: 'portfolio' });

// Static import specifiers so the Module Federation plugin can transform them.
// `./ssr` is server-safe (loader); `./hydrate` / `./mount` are client-only.
type SsrResult = { html: string; css: string };
type RenderHeroSSR = (opts?: {
  config?: unknown;
  assetBase?: string;
}) => SsrResult | Promise<SsrResult>;
type SsrExports = { renderHeroSSR?: RenderHeroSSR };
type HydrateModule = { hydrate: (target: HTMLElement, config?: MountConfig) => MountHandle };
type MountModule = { mount: (el: HTMLElement, config?: MountConfig) => MountHandle };

// In the production server bundle the federation plugin rewrites each of these
// into: import the generated wrapper (which boots the host runtime and starts
// loading the remote), then await the wrapper's `__mf_remote_pending`. That
// promise is created once per process, so after a single failed attempt the
// import rejects forever, and even when it resolves the module namespace only
// carries the wrapper's own exports — never `renderHeroSSR`. Treat the result
// as opaque; `loadSsrExports()` reads the module from the runtime instead.
export const ssrLoaders: Record<string, () => Promise<unknown>> = {
  toonhub: () => import('toonhub/ssr'),
  mindloop: () => import('mindloop/ssr'),
  immersive_ocean: () => import('immersive_ocean/ssr'),
  viktor: () => import('viktor/ssr'),
  bali: () => import('bali/ssr'),
};
const hydrateLoaders: Record<string, () => Promise<HydrateModule>> = {
  toonhub: () => import('toonhub/hydrate'),
  mindloop: () => import('mindloop/hydrate'),
  immersive_ocean: () => import('immersive_ocean/hydrate'),
  viktor: () => import('viktor/hydrate'),
  bali: () => import('bali/hydrate'),
};
const mountLoaders: Record<string, () => Promise<MountModule>> = {
  toonhub: () => import('toonhub/mount'),
  mindloop: () => import('mindloop/mount'),
  immersive_ocean: () => import('immersive_ocean/mount'),
  viktor: () => import('viktor/mount'),
  bali: () => import('bali/mount'),
};

/**
 * Resolve a project remote's `./ssr` module on the server through the shared
 * federation helper (runtime read + failed-remote reset, see lib/federation.ts).
 */
export async function loadSsrExports(
  project: ProjectEntry,
  load: () => Promise<unknown>,
): Promise<{ renderHeroSSR: RenderHeroSSR }> {
  const exports = await loadRemoteModuleSSR<SsrExports>(project.remote, 'ssr', load);
  const renderHeroSSR = exports.renderHeroSSR;
  if (typeof renderHeroSSR !== 'function') {
    throw new Error(`${project.remote}/ssr does not export renderHeroSSR`);
  }
  return { renderHeroSSR };
}

export interface ProjectStageProps {
  projectId: string;
  html: string | null;
  css: string;
  /** Remote-relative route, `/` on the non-splat project route. */
  route: string;
}

export function ProjectStage({ projectId, html, css, route }: ProjectStageProps) {
  const project = getProject(projectId);
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `onNavigate` must not change identity between renders, or the mount effect
  // below would tear the remote down on every navigation — the exact thing the
  // update path exists to avoid.
  const onNavigate = useCallback(
    (to: string) => {
      const { splat, search } = fromRemoteRoute(to);
      void router.navigate({
        to: '/projects/$projectId/$',
        params: { projectId, _splat: splat },
        search,
      });
    },
    [router, projectId],
  );

  // The route the remote should show. Kept in a ref so the mount effect can
  // read the current value without listing it as a dependency.
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    if (!project || project.status !== 'live') return;
    let cancelled = false;
    const attach = html
      ? hydrateLoaders[project.remote]?.().then((m) => m.hydrate)
      : mountLoaders[project.remote]?.().then((m) => m.mount);
    attach
      ?.then((fn) => {
        if (cancelled || !mountRef.current) return;
        handleRef.current = fn(mountRef.current, {
          route: routeRef.current,
          onNavigate,
        });
        log.info('project.open', { id: project.id, mode: html ? 'ssr-hydrate' : 'csr-mount' });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('project.mount-failed', { id: project.id, error: message });
        setError(message);
      });
    return () => {
      cancelled = true;
      try {
        handleRef.current?.();
      } catch {
        /* ignore disposer errors */
      }
      handleRef.current = null;
    };
  }, [project, html, onNavigate]);

  // Route changed without the project changing → hand the new route to a
  // route-aware remote. A remote without `update` has no internal routes, so
  // it never sees a route change and there is nothing to do.
  useEffect(() => {
    handleRef.current?.update?.(route);
  }, [route]);

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

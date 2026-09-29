import { createFileRoute, notFound } from '@tanstack/react-router';
import { getProject } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';
import type { SsrHead } from '@ncam/mf-remote';
import { ProjectStagePage, loadSsrExports, ssrLoaders } from '../../components/ProjectStage';
import { toRemoteRoute } from '../../lib/remote-route';
import { projectHead, remoteHead, withStageExpect } from '../../lib/project-head';

const log = createLogger({ scope: 'portfolio' });

interface LoaderData {
  html: string | null;
  css: string;
  /**
   * The remote's own name for the page it rendered, for head(). Only a server
   * render produces one, so a client navigation's head (and all of `vite dev`)
   * falls back to the project's title; loader data reaches head() on both sides,
   * and hydration reuses the server's, so a crawler reads the same title twice.
   */
  head?: SsrHead;
}
const NO_SSR: LoaderData = { html: null, css: '' };

export const Route = createFileRoute('/projects/$projectId_/$')({
  // Remote routes carry arbitrary filters; the remote validates them itself.
  validateSearch: (search: Record<string, unknown>) => search,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }): Promise<LoaderData> => {
    const project = getProject(params.projectId);
    // A real 404, as on the bare project route.
    if (!project) throw notFound();
    if (project.status !== 'live') return NO_SSR;
    const load = ssrLoaders[project.remote];
    if (!load || !import.meta.env.PROD || !import.meta.env.SSR) return NO_SSR;
    const route = toRemoteRoute(
      params._splat,
      new URLSearchParams(
        Object.entries(deps).map(([key, value]) => [key, String(value)]),
      ).toString(),
    );
    try {
      const { renderHeroSSR } = await loadSsrExports(project, load);
      const { html, css, head } = await renderHeroSSR({
        config: { route },
        assetBase: import.meta.env.VITE_TOONHUB_ORIGIN,
      });
      log.debug('project.ssr', { id: project.id, route });
      return { html, css, head: remoteHead(head) };
    } catch (error) {
      log.warn('project.ssr-fallback', {
        id: project.id,
        route,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return NO_SSR;
    }
  },
  head: ({ params, loaderData }) =>
    withStageExpect(
      projectHead(params.projectId, params._splat, loaderData?.head),
      Boolean(loaderData?.html),
    ),
  // Same component function as the bare project route, so crossing between the
  // two reconciles the stage in place rather than tearing the remote down.
  // See ProjectStagePage.
  component: ProjectStagePage,
});

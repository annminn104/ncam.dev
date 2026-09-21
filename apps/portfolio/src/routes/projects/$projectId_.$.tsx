import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { getProject } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';
import { ProjectStage, loadSsrExports, ssrLoaders } from '../../components/ProjectStage';
import { toRemoteRoute } from '../../lib/remote-route';
import { projectHead } from '../../lib/project-head';

const log = createLogger({ scope: 'portfolio' });

interface LoaderData {
  html: string | null;
  css: string;
}
const NO_SSR: LoaderData = { html: null, css: '' };

export const Route = createFileRoute('/projects/$projectId_/$')({
  // Remote routes carry arbitrary filters; the remote validates them itself.
  validateSearch: (search: Record<string, unknown>) => search,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }): Promise<LoaderData> => {
    const project = getProject(params.projectId);
    if (!project || project.status !== 'live') return NO_SSR;
    const load = ssrLoaders[project.remote];
    if (!load || !import.meta.env.PROD || !import.meta.env.SSR) return NO_SSR;
    const route = toRemoteRoute(
      params._splat,
      new URLSearchParams(deps as Record<string, string>).toString(),
    );
    try {
      const { renderHeroSSR } = await loadSsrExports(project, load);
      const { html, css } = await renderHeroSSR({ config: { route } });
      log.debug('project.ssr', { id: project.id, route });
      return { html, css };
    } catch (error) {
      log.warn('project.ssr-fallback', {
        id: project.id,
        route,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return NO_SSR;
    }
  },
  head: ({ params }) => projectHead(params.projectId, params._splat),
  component: ProjectSplatPage,
});

function ProjectSplatPage() {
  const { projectId, _splat } = Route.useParams();
  const { html, css } = Route.useLoaderData();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  return (
    <ProjectStage
      projectId={projectId}
      html={html}
      css={css}
      route={toRemoteRoute(_splat, searchStr)}
    />
  );
}

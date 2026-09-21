import { createFileRoute } from '@tanstack/react-router';
import { getProject } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';
import { ProjectStage, loadSsrExports, ssrLoaders } from '../../components/ProjectStage';
import { projectHead } from '../../lib/project-head';

const log = createLogger({ scope: 'portfolio' });

interface LoaderData {
  html: string | null;
  css: string;
}
const NO_SSR: LoaderData = { html: null, css: '' };

export const Route = createFileRoute('/projects/$projectId')({
  // SSR the remote's markup for SEO / first paint. Federated SSR resolution is
  // only wired in the production build — in `vite dev` this throws, so we fall
  // back to client-side mount (below). Either way the loader stays graceful.
  loader: async ({ params }): Promise<LoaderData> => {
    const project = getProject(params.projectId);
    if (!project || project.status !== 'live') return NO_SSR;
    const load = ssrLoaders[project.remote];
    // Federated SSR is only wired up in the production *server* build: `vite dev`
    // can't resolve it (and may hang), and client-side navigations take the
    // lighter mount path instead of rendering markup in the browser. The SSR
    // guard also keeps the Node-only recovery code out of the client bundle.
    if (!load || !import.meta.env.PROD || !import.meta.env.SSR) return NO_SSR;
    try {
      const { renderHeroSSR } = await loadSsrExports(project, load);
      const { html, css } = await renderHeroSSR({
        config: { route: '/' },
        assetBase: import.meta.env.VITE_TOONHUB_ORIGIN,
      });
      log.debug('project.ssr', { id: project.id });
      return { html, css };
    } catch (error) {
      // SSR remote resolution unavailable → client-side mount. Loud on purpose:
      // a silent fallback hid a broken SSR path in production for months.
      log.warn('project.ssr-fallback', {
        id: project.id,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return NO_SSR;
    }
  },
  head: ({ params }) => projectHead(params.projectId),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { html, css } = Route.useLoaderData();
  return <ProjectStage projectId={projectId} html={html} css={css} route="/" />;
}

import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  /** Compiled Tailwind CSS, for the host to inline so first paint is styled. */
  css: string;
}

export interface RenderHeroSSROptions {
  config?: unknown;
  /** Accepted for parity with other remotes; unused (media is absolute / inline SVG). */
  assetBase?: string;
}

/**
 * SSR entry: renders the Mindloop page to an HTML string plus its compiled CSS.
 * `react-dom/server` is imported dynamically (not statically) so it never enters
 * the client's Module Federation shared graph — the client remote only ever runs
 * `./mount` / `./hydrate`, and pulling `react-dom/server` into the shared map
 * destabilises the remote's browser bootstrap.
 */
export async function renderHeroSSR(
  _options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  // animate=false → visible, static markup (identical to the hydrate render).
  return { html: renderToString(<App animate={false} />), css };
}

export default renderHeroSSR;

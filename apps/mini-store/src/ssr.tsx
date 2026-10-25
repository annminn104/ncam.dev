import type { SsrResult } from '@ncam/mf-remote';
import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSROptions {
  config?: unknown;
  /**
   * Accepted for the host contract and ignored: the poster files are JS-imported assets, which
   * defineRemote's renderBuiltUrl names from this module's own URL, on the server too.
   */
  assetBase?: string;
}

/** Server render: the poster, the HUD and the Enter button. The engine never runs here. */
export async function renderHeroSSR(_options: RenderHeroSSROptions = {}): Promise<SsrResult> {
  const { renderToString } = await import('react-dom/server');
  return {
    html: renderToString(<App />),
    css,
    head: {
      title: 'Mini Store — a rainy night on the corner',
      description:
        'A hand-built WebGL2 diorama of a Saigon corner store on a rainy night: PBR, shadowed spotlights, volumetric fog, wet-road reflections, SSAO and bloom, no three.js.',
    },
  };
}

export default renderHeroSSR;

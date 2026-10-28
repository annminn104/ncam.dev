import type { SsrResult } from '@ncam/mf-remote';
import App from './App';
import css from './styles.css?inline';

export interface RenderHeroSSROptions {
  config?: unknown;
  /**
   * Accepted for the host contract and ignored: the poster files are JS-imported assets, which
   * defineRemote's renderBuiltUrl names from this module's own URL, on the server too.
   */
  assetBase?: string;
}

/** Server render: the poster, the HUD and the Enter button. The scene never runs here. */
export async function renderHeroSSR(_options: RenderHeroSSROptions = {}): Promise<SsrResult> {
  const { renderToString } = await import('react-dom/server');
  return {
    html: renderToString(<App />),
    css,
    head: {
      title: 'Garden Home — a glass villa on a garden island',
      description:
        'A 3D glass villa and its garden island, built from Blender modules and drawn with React Three Fiber: orbit it, zoom in to cut the house away floor by floor, and switch its lights, screens and water on and off.',
    },
  };
}

export default renderHeroSSR;

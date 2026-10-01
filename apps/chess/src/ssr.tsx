import type { SsrResult } from '@ncam/mf-remote';
import { originOf } from '@ncam/mf-remote/css';
import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSROptions {
  config?: unknown;
  assetBase?: string;
}

export async function renderHeroSSR(options: RenderHeroSSROptions = {}): Promise<SsrResult> {
  const { renderToString } = await import('react-dom/server');
  // No origin to derive (a module that wasn't fetched over http) means an empty
  // base, which assetUrl() reads as root-relative; '/' alone is not a valid base.
  const origin = originOf(import.meta.url);
  const base = options.assetBase ?? (origin ? `${origin}/` : '');
  return {
    html: renderToString(<App assetBase={base} />),
    css,
    head: {
      title: 'Cultivation Chess',
      description:
        'International chess with cultivation treasures for pieces, fought in 3D arenas — play a friend or Stockfish.',
    },
  };
}

export default renderHeroSSR;

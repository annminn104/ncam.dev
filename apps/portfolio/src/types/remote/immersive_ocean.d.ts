// Type declarations for the federated immersive_ocean remote modules.

declare module 'immersive_ocean/mount' {
  export function mount(target: HTMLElement): () => void;
  export function unmount(target: HTMLElement): void;
  const mountDefault: (target: HTMLElement) => () => void;
  export default mountDefault;
}

declare module 'immersive_ocean/hydrate' {
  export function hydrate(target: HTMLElement): () => void;
  export function dispose(target: HTMLElement): void;
  const hydrateDefault: (target: HTMLElement) => () => void;
  export default hydrateDefault;
}

declare module 'immersive_ocean/ssr' {
  export interface RenderHeroSSRResult {
    html: string;
    css: string;
  }
  export function renderHeroSSR(options?: {
    config?: unknown;
    assetBase?: string;
  }): Promise<RenderHeroSSRResult>;
  const renderHeroSSRDefault: (options?: {
    config?: unknown;
    assetBase?: string;
  }) => Promise<RenderHeroSSRResult>;
  export default renderHeroSSRDefault;
}

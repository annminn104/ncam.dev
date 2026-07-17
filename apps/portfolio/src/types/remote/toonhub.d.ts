// Type declarations for the federated toonhub remote modules loaded at runtime.

declare module 'toonhub/mount' {
  export function mount(target: HTMLElement, config?: unknown): () => void;
  export function unmount(target: HTMLElement): void;
  const mountDefault: (target: HTMLElement, config?: unknown) => () => void;
  export default mountDefault;
}

declare module 'toonhub/hydrate' {
  export function hydrate(target: HTMLElement, config?: unknown): () => void;
  export function dispose(target: HTMLElement): void;
  const hydrateDefault: (target: HTMLElement, config?: unknown) => () => void;
  export default hydrateDefault;
}

declare module 'toonhub/ssr' {
  export interface RenderHeroSSRResult {
    html: string;
    css: string;
  }
  export function renderHeroSSR(options?: {
    config?: unknown;
    assetBase?: string;
  }): RenderHeroSSRResult;
  const renderHeroSSRDefault: (options?: {
    config?: unknown;
    assetBase?: string;
  }) => RenderHeroSSRResult;
  export default renderHeroSSRDefault;
}

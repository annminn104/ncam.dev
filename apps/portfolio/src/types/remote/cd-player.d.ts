// Type declarations for the federated CD Player remote modules: route-aware like holodex
// (MountConfig.route, MountHandle.update; apps/cd-player/src/mount.tsx and hydrate.tsx), and its
// ssr resolves to the contract's SsrResult, whose `head` names the visitor's playlist
// (apps/cd-player/src/head.ts). Inline `import()` type queries keep this file a script of fresh
// ambient declarations rather than module augmentations.

declare module 'cd_player/mount' {
  export function mount(
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ): import('@ncam/mf-remote').MountHandle;
  const mountDefault: (
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ) => import('@ncam/mf-remote').MountHandle;
  export default mountDefault;
}

declare module 'cd_player/hydrate' {
  export function hydrate(
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ): import('@ncam/mf-remote').MountHandle;
  const hydrateDefault: (
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ) => import('@ncam/mf-remote').MountHandle;
  export default hydrateDefault;
}

declare module 'cd_player/ssr' {
  export type RenderHeroSSRResult = import('@ncam/mf-remote').SsrResult;
  export function renderHeroSSR(options?: {
    config?: { route?: string };
    assetBase?: string;
  }): Promise<RenderHeroSSRResult>;
  const renderHeroSSRDefault: (options?: {
    config?: { route?: string };
    assetBase?: string;
  }) => Promise<RenderHeroSSRResult>;
  export default renderHeroSSRDefault;
}

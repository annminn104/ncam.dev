// Type declarations for the federated chess remote modules.
//
// Same shape as holodex.d.ts: mount/hydrate take the host contract's
// MountConfig (only its `assetBase` is read; chess has no routes of its own)
// and return a MountHandle, and ssr resolves to the contract's SsrResult, whose
// `head` names the page (apps/chess/src/ssr.tsx). All referenced via inline
// `import()` type queries, not a top-level `import`, so this file stays a
// script of fresh ambient declarations rather than module augmentations.

declare module 'chess/mount' {
  export function mount(
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ): import('@ncam/mf-remote').MountHandle;
  export function unmount(target: HTMLElement): void;
  const mountDefault: (
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ) => import('@ncam/mf-remote').MountHandle;
  export default mountDefault;
}

declare module 'chess/hydrate' {
  export function hydrate(
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ): import('@ncam/mf-remote').MountHandle;
  export function dispose(target: HTMLElement): void;
  const hydrateDefault: (
    target: HTMLElement,
    config?: import('@ncam/mf-remote').MountConfig,
  ) => import('@ncam/mf-remote').MountHandle;
  export default hydrateDefault;
}

declare module 'chess/ssr' {
  export type RenderHeroSSRResult = import('@ncam/mf-remote').SsrResult;
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

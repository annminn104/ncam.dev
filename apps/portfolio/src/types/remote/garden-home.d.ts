// Type declarations for the federated Garden Home remote modules.
//
// Same shape as mini-store.d.ts: mount/hydrate take the host contract's MountConfig
// (only assetBase is read; Garden Home has no routes of its own in the host) and
// return a MountHandle, and ssr resolves to the contract's SsrResult, whose `head`
// names the page (apps/garden-home/src/ssr.tsx). All referenced via inline
// `import()` type queries, not a top-level `import`, so this file stays a script
// of fresh ambient declarations rather than module augmentations.

declare module 'garden_home/mount' {
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

declare module 'garden_home/hydrate' {
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

declare module 'garden_home/ssr' {
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

// Type declarations for the federated holodex remote modules.
//
// Unlike the pre-Task-2 remotes' .d.ts siblings in this directory, holodex's
// mount/hydrate are built against the route-aware host contract from
// `@ncam/mf-remote` (MountConfig / MountHandle) — see apps/holodex/src/mount.tsx
// and hydrate.tsx. Referenced via inline `import()` type queries, not a
// top-level `import`, so this file stays a script: a top-level import/export
// would turn each `declare module` below into an augmentation of an existing
// module instead of a fresh ambient declaration, and 'holodex/mount' etc. have
// no real module to augment.

declare module 'holodex/mount' {
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

declare module 'holodex/hydrate' {
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

declare module 'holodex/ssr' {
  export interface RenderHeroSSRResult {
    html: string;
    css: string;
  }
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

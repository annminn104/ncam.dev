/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The toonhub remote's browser origin (injected via `define` in vite.config). */
  readonly VITE_TOONHUB_ORIGIN: string;
  /**
   * The site's public origin, no trailing slash (injected via `define` in
   * vite.config from `SITE_URL`). Read it through `src/lib/site.ts`.
   */
  readonly VITE_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

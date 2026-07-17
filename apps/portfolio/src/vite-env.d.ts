/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The toonhub remote's browser origin (injected via `define` in vite.config). */
  readonly VITE_TOONHUB_ORIGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

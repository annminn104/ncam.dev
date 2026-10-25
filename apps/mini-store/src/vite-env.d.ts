/// <reference types="vite/client" />

interface Window {
  /** Set by capture mode once the poster frame has settled (scripts/capture-poster.mjs). */
  __miniStoreReady?: boolean;
}

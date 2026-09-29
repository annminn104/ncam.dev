/**
 * Runtime helpers for a remote's server render. Import them from
 * `@ncam/mf-remote/css`, never from the package root: that one is the Vite
 * config (node:fs, the federation plugin) and must stay out of a bundle.
 */

/**
 * The origin a module was loaded from, for `import.meta.url`: the remote's own
 * `http(s)://host[:port]` when the host's loader fetched it, `''` when there is
 * none to name (a `file:` URL, or no URL at all).
 */
export function originOf(moduleUrl: string): string {
  try {
    const { origin } = new URL(moduleUrl);
    return origin === 'null' ? '' : origin;
  } catch {
    return '';
  }
}

/**
 * `css` with every root-relative `url(/…)` prefixed with `origin`.
 *
 * A remote's `?inline` stylesheet names its files from the remote's root
 * (`/assets/…`). That is right on the remote's own page and wrong once the host
 * inlines the CSS into its document, where the same path resolves against the
 * host. Protocol-relative (`//…`), absolute and `data:` URLs pass through, and
 * so does all of `css` when `origin` is `''`.
 */
export function rebaseCssUrls(css: string, origin: string): string {
  if (!origin) return css;
  return css.replace(/url\((['"]?)\/(?!\/)/g, `url($1${origin}/`);
}

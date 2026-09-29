import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plugin, UserConfig } from 'vite';

// The module imports the federation plugin at top level; stub it so the unit
// test doesn't pull the real Vite plugin graph. The stub keeps the options it
// was given, which is what defineRemote decides.
const federation = vi.hoisted(() =>
  vi.fn((options: object) => ({ name: 'mock-federation', options })),
);
vi.mock('@module-federation/vite', () => ({ federation }));

import { defineRemote, env, resolveSiteUrl } from './index';

const KEY = 'NCAM_TEST_ENV_VAR';

describe('env()', () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it('prefers the real process environment over the fallback', () => {
    process.env[KEY] = 'from-process';
    expect(env(KEY, 'fallback')).toBe('from-process');
  });

  it('uses the provided fallback when the key is unset everywhere', () => {
    expect(env(KEY, 'fallback')).toBe('fallback');
  });

  it('returns an empty string when unset and no fallback is given', () => {
    expect(env(KEY)).toBe('');
  });
});

describe('defineRemote()', () => {
  const remote = () =>
    defineRemote({ name: 'probe', port: 9999, exposes: { './mount': './src/mount.ts' } });

  it('generates no federated types, in dev or in a build', () => {
    // The host types its remotes by hand (apps/portfolio/src/types/remote)
    // and consumes none. Generating them ran a full tsc for every file event a
    // dev server saw, all at once: a build's writes into dist-ssr, watched by
    // two dev servers, spawned about 400 and took the machine down.
    remote();
    expect(federation).toHaveBeenLastCalledWith(expect.objectContaining({ dts: false }));
  });

  it('names imported assets from the module’s own URL, not the page’s', () => {
    // In the host page a root-relative /assets/… resolves against the host.
    type Render = (
      filename: string,
      context: { hostType: 'js' | 'css' | 'html' },
    ) => { runtime: string } | undefined;
    const render = remote().experimental?.renderBuiltUrl as unknown as Render;
    expect(render('assets/poster-Ab12.webp', { hostType: 'js' })).toEqual({
      runtime: 'new URL("/assets/poster-Ab12.webp", import.meta.url).href',
    });
    // A stylesheet's own url()s already resolve against the stylesheet.
    expect(render('assets/font-Cd34.woff2', { hostType: 'css' })).toBeUndefined();
  });

  it('keeps the SSR build output out of the dev server’s watcher', () => {
    // Vite ignores the client outDir (dist) by itself, but not the ssr
    // environment's, so a build flooded every dev server watching the app.
    expect(remote().server?.watch?.ignored).toContain('**/dist-ssr/**');
  });

  describe('%SITE_URL% in index.html', () => {
    afterEach(() => {
      delete process.env.SITE_URL;
    });

    /** The index.html transform defineRemote() installs, and its order. */
    const siteUrlHook = (config: UserConfig) => {
      const plugin = config.plugins?.find(
        (option): option is Plugin =>
          typeof option === 'object' &&
          option !== null &&
          'name' in option &&
          option.name === 'ncam:site-url',
      );
      const hook = plugin?.transformIndexHtml;
      if (!hook || typeof hook === 'function') throw new Error('no ordered ncam:site-url hook');
      const handler = hook.handler as unknown as (html: string) => string;
      return { order: hook.order, run: handler };
    };

    // Every place a standalone page names its canonical copy on the host.
    const page = [
      '<link rel="canonical" href="%SITE_URL%/projects/probe" />',
      '<meta property="og:url" content="%SITE_URL%/projects/probe" />',
      '<meta property="og:image" content="%SITE_URL%/thumbnails/probe.jpg" />',
      '<meta name="twitter:image" content="%SITE_URL%/thumbnails/probe.jpg" />',
      '<script type="application/ld+json">{ "url": "%SITE_URL%/projects/probe" }</script>',
    ].join('\n');

    it('replaces every placeholder with SITE_URL, so none ships', () => {
      process.env.SITE_URL = 'https://example.test/';
      const html = siteUrlHook(remote()).run(page);

      expect(html).not.toContain('%SITE_URL%');
      expect(html).toContain('<link rel="canonical" href="https://example.test/projects/probe" />');
      expect(html).toContain('content="https://example.test/thumbnails/probe.jpg"');
      expect(html).toContain('{ "url": "https://example.test/projects/probe" }');
      expect(html.match(/https:\/\/example\.test\//g)).toHaveLength(5);
    });

    it('runs before Vite reads the page’s URLs', () => {
      // Vite's build treats link hrefs, og:image and twitter:image as asset
      // URLs; they reach it absolute, as external URLs it leaves alone, and so
      // does every other plugin's hook.
      expect(siteUrlHook(remote()).order).toBe('pre');
    });

    it('leaves a page with no placeholder as it is', () => {
      // profile's standalone page is noindex and names no canonical.
      const html = '<meta name="robots" content="noindex" />';
      expect(siteUrlHook(remote()).run(html)).toBe(html);
    });
  });
});

describe('resolveSiteUrl()', () => {
  it('falls back to the host’s own last resort when SITE_URL is unset or blank', () => {
    expect(resolveSiteUrl('')).toBe('https://ncam.dev');
    expect(resolveSiteUrl('  ')).toBe('https://ncam.dev');
  });

  it('drops trailing slashes and whitespace, since every URL appends a path', () => {
    expect(resolveSiteUrl(' https://example.test/ ')).toBe('https://example.test');
    expect(resolveSiteUrl('https://example.test//')).toBe('https://example.test');
  });

  it('strips slashes in linear time, however many there are', () => {
    // A run of slashes that is not at the end is where `/\/+$/` goes quadratic.
    const slashes = '/'.repeat(100_000);
    expect(resolveSiteUrl(`https://example.test${slashes}`)).toBe('https://example.test');
    expect(resolveSiteUrl(`https://example.test${slashes}x`)).toBe(
      `https://example.test${slashes}x`,
    );
  });

  it('refuses a value that would make the canonical relative', () => {
    for (const value of ['example.test', '/projects', 'https://', 'ftp://example.test']) {
      expect(() => resolveSiteUrl(value)).toThrow(/SITE_URL/);
    }
  });
});

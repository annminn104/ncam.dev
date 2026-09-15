import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { HomeNav } from '../components/home/nav';
import { ManifestRail, type LoadState } from '../components/home/manifest-rail';
import { sections, type SectionMeta } from '../data/sections';
import { getBlogPosts } from '../functions/blog.functions';
import { loadRemoteModuleSSR, SSR_LOAD_TIMEOUT_MS, withTimeout } from '../lib/federation';
import { ScrollTrigger } from '../lib/gsap';
import { useSectionTracker } from '../lib/use-section-tracker';

const log = createLogger({ scope: 'portfolio' });

const SITE_URL = 'https://ncam.dev';
/** The remote that exposes the home-page sections (see apps/profile). */
const REMOTE = 'profile';
/** Total server-side budget for rendering the home sections (see the loader). */
const SSR_PAGE_BUDGET_MS = 4_000;
/** The one section that takes data from the host. */
const BLOG_MODULE = 'blog';
/** Slice of the request the CMS may take on the home page (@ncam/cms itself aborts at 5 s; the SSR loop still needs its 4 s). */
const BLOG_POSTS_TIMEOUT_MS = 2_500;

// Public facts for SEO (the full content lives in the remote's data file).
const PERSON = {
  name: 'Minh Nguyen',
  alternateName: ['Matthew', 'Nguyen Cao Anh Minh'],
  jobTitle: 'Frontend Developer',
  worksFor: 'NAVER Vietnam',
  sameAs: [
    'https://www.linkedin.com/in/nguyencaoanhminh',
    'https://github.com/annminn104',
    'https://www.facebook.com/Minhmin0507',
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'ncam.dev',
      url: `${SITE_URL}/`,
      description: `Portfolio of ${PERSON.alternateName[0]} (${PERSON.name}), ${PERSON.jobTitle} — micro-frontends, motion and high-performance web apps.`,
    },
    {
      '@type': 'Person',
      name: PERSON.name,
      alternateName: PERSON.alternateName,
      url: `${SITE_URL}/`,
      jobTitle: PERSON.jobTitle,
      worksFor: { '@type': 'Organization', name: PERSON.worksFor },
      sameAs: PERSON.sameAs,
    },
  ],
};

/** Props the host hands to a section module (only the blog section takes any). */
type SectionProps = { posts: BlogPost[] } | undefined;

/** Shape of every `profile/<module>` (see apps/profile/src/lib/section-module.tsx). */
type SectionModule = {
  ssr(props?: SectionProps): Promise<{ html: string; css: string }>;
  hydrate(target: HTMLElement, props?: SectionProps): () => void;
  mount(target: HTMLElement, props?: SectionProps): () => void;
};

// Static import specifiers so the Module Federation plugin can transform them —
// one per exposed module, keyed by `SectionMeta.module`.
const loaders: Record<string, () => Promise<SectionModule>> = {
  hero: () => import('profile/hero'),
  stacks: () => import('profile/stacks'),
  experience: () => import('profile/experience'),
  projects: () => import('profile/projects'),
  blog: () => import('profile/blog'),
  contact: () => import('profile/contact'),
};

interface LoaderData {
  /** Server-rendered markup per module (missing → client mount). */
  html: Record<string, string>;
  /** The remote's CSS (one copy — every module returns the same string). */
  css: string;
  /** Published blog posts from the CMS (empty when unavailable → the remote shows placeholders). */
  posts: BlogPost[];
}

function propsFor(module: string, posts: BlogPost[]): SectionProps {
  return module === BLOG_MODULE ? { posts } : undefined;
}

export const Route = createFileRoute('/')({
  // Server-render every section through the federation runtime so the page is
  // complete, styled and crawlable on first paint. Only wired in the production
  // server build (`vite dev` cannot resolve federated SSR) — otherwise, and for
  // any module that fails, the client mounts that section instead.
  loader: async (): Promise<LoaderData> => {
    // Blog posts come from the CMS in every mode (a server function: direct call
    // during SSR, RPC on client navigations). Unavailable → empty → placeholders.
    // Bounded to 2.5 s so a hanging CMS costs the blog cards, never the response.
    const posts = await withTimeout('getBlogPosts', getBlogPosts(), BLOG_POSTS_TIMEOUT_MS).catch(
      (error: unknown) => {
        log.warn('home.blog-posts-unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
        return [] as BlogPost[];
      },
    );
    const data: LoaderData = { html: {}, css: '', posts };
    if (!import.meta.env.PROD || !import.meta.env.SSR) return data;
    // One budget for the whole page: serverless hosts cap a request (Vercel Hobby:
    // 10 s), so a slow remote must cost sections their SSR, never the response.
    const deadline = Date.now() + SSR_PAGE_BUDGET_MS;
    // Sequential on purpose: the first federated import also boots the host's MF
    // runtime for this process, and kicking six of those off concurrently
    // deadlocks the runtime's init. Later modules reuse the cached remote entry.
    for (const section of sections) {
      const load = loaders[section.module];
      if (!load) continue;
      const remaining = deadline - Date.now();
      if (remaining < 250) {
        log.warn('home.ssr-budget-exhausted', { module: section.module });
        continue;
      }
      try {
        const mod = await loadRemoteModuleSSR<SectionModule>(
          REMOTE,
          section.module,
          load,
          Math.min(SSR_LOAD_TIMEOUT_MS, remaining),
        );
        if (typeof mod.ssr !== 'function') {
          throw new Error(`${REMOTE}/${section.module} does not export ssr()`);
        }
        const { html, css } = await mod.ssr(propsFor(section.module, posts));
        data.html[section.module] = html;
        data.css ||= css;
      } catch (error) {
        log.warn('home.ssr-fallback', {
          module: section.module,
          error: error instanceof Error ? (error.stack ?? error.message) : String(error),
        });
      }
    }
    log.debug('home.ssr', { modules: Object.keys(data.html), posts: posts.length });
    return data;
  },
  head: () => ({
    meta: [
      { name: 'robots', content: 'index,follow' },
      { property: 'og:url', content: `${SITE_URL}/` },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/` }],
  }),
  component: HomePage,
});

/**
 * Re-measure every ScrollTrigger once late-arriving layout settles: fonts
 * swapping in, and hydration landing after the window `load` event.
 */
function useScrollTriggerRefresh() {
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 800);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) refresh();
    });
    window.addEventListener('load', refresh);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('load', refresh);
    };
  }, []);
}

/**
 * The remote renders plain `<a href="/projects/…">` and `<a href="/blog/…">`
 * links (it has no router); turn them into client-side navigations so the stage
 * and blog routes open without a full page load.
 */
function useInternalLinks(rootRef: React.RefObject<HTMLElement | null>) {
  const navigate = useNavigate();
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.(
        'a[href^="/projects/"], a[href^="/blog/"]',
      );
      const href = anchor?.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      void navigate({ href });
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [navigate, rootRef]);
}

interface SectionSlotProps {
  section: SectionMeta;
  html: string | undefined;
  props: SectionProps;
  onState: (module: string, state: LoadState) => void;
}

/**
 * One federated section. The div is `display: contents`, so the module's own
 * <section> becomes the page-level element the nav/rail/tracker key off. With
 * SSR markup present the module hydrates it; otherwise it mounts from scratch.
 * `props` is the exact object the server rendered with (from loader data).
 */
function SectionSlot({ section, html, props, onState }: SectionSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = ref.current;
    const load = loaders[section.module];
    if (!target || !load) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    onState(section.module, 'loading');
    load()
      .then((mod) => {
        if (cancelled || !ref.current) return;
        dispose = html ? mod.hydrate(ref.current, props) : mod.mount(ref.current, props);
        log.info('home.module', {
          module: section.module,
          mode: html ? 'ssr-hydrate' : 'csr-mount',
        });
        onState(section.module, 'ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        log.error('home.module-failed', { module: section.module, error: message });
        setError(message);
        onState(section.module, 'error');
      });
    return () => {
      cancelled = true;
      try {
        dispose?.();
      } catch {
        /* ignore disposer errors */
      }
    };
  }, [section.module, html, props, onState]);

  return (
    <>
      <div
        ref={ref}
        className="mf-slot"
        data-module={`./${section.module}`}
        {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
      />
      {error ? (
        <div className="mf-slot__error" id={section.id} role="alert">
          <div className="mf-slot__error-card">
            <strong>./{section.module}</strong> could not be mounted — <code>{error}</code>
            <br />
            Make sure the <code>{REMOTE}</code> remote is running (<code>pnpm dev</code> at the repo
            root), then reload.
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The portfolio home: a shell (nav + manifest rail + page-level transitions)
 * around six federated modules from the `profile` remote — each section is
 * loaded, server-rendered and mounted exactly like the project remotes are.
 */
function HomePage() {
  const { html, css, posts } = Route.useLoaderData();
  const homeRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<Record<string, LoadState>>(() =>
    Object.fromEntries(sections.map((section) => [section.module, 'idle'])),
  );
  const onState = useCallback((module: string, state: LoadState) => {
    setLoadState((prev) => (prev[module] === state ? prev : { ...prev, [module]: state }));
  }, []);
  // One stable props object per module: the slot effect depends on it, and the
  // rail's state updates re-render this component while modules are still loading.
  const sectionProps = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [section.module, propsFor(section.module, posts)]),
      ) as Record<string, SectionProps>,
    [posts],
  );

  const settled = sections.every((section) => {
    const state = loadState[section.module];
    return state === 'ready' || state === 'error';
  });
  const { active, visited } = useSectionTracker(homeRef, settled);
  useScrollTriggerRefresh();
  useInternalLinks(homeRef);

  return (
    <div ref={homeRef} className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Remote CSS from the SSR pass; on the client-mount path the module injects it itself. */}
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <HomeNav active={active} />
      <ManifestRail active={active} visited={visited} loadState={loadState} />
      <main>
        {sections.map((section) => (
          <SectionSlot
            key={section.module}
            section={section}
            html={html[section.module]}
            props={sectionProps[section.module]}
            onState={onState}
          />
        ))}
      </main>
    </div>
  );
}

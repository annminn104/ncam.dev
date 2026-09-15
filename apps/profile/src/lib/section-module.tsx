import { StrictMode, createElement, type Attributes, type FunctionComponent } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import css from '../styles/profile.css?inline';

export interface SectionSSRResult {
  html: string;
  /** The remote's compiled CSS — identical for every section; the host inlines it once. */
  css: string;
}

/**
 * Shape of every exposed `./<section>` module. `P` is the optional props object
 * the host may pass (only the blog section uses one today); the same value must
 * reach `ssr()` on the server and `hydrate()` on the client or hydration mismatches.
 */
export interface SectionModule<P = undefined> {
  /** Server: render the section to markup. Browser-free (react-dom/server is imported lazily). */
  ssr(props?: P): Promise<SectionSSRResult>;
  /** Client: attach React to server-rendered markup already inside `target`. Returns a disposer. */
  hydrate(target: HTMLElement, props?: P): () => void;
  /** Client: render from scratch into `target` (no SSR available). Returns a disposer. */
  mount(target: HTMLElement, props?: P): () => void;
}

const STYLE_ID = 'profile-styles';
const roots = new WeakMap<HTMLElement, Root>();

/** CSR path only — the SSR path gets `css` back from `ssr()` and inlines it itself. */
function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

function dispose(target: HTMLElement): void {
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  // Six modules share one <style>; it stays for the page's lifetime.
  queueMicrotask(() => root.unmount());
}

/** The element a section renders: StrictMode around the component with the (optional) props. */
function sectionElement<P extends object>(Component: FunctionComponent<P>, props: P | undefined) {
  return createElement(StrictMode, null, createElement(Component, (props ?? {}) as P & Attributes));
}

/**
 * Server half of a section module. Each `src/modules/*` entry passes in
 * `renderToString` from its OWN lazy `import('react-dom/server')`: that keeps the
 * server-only chunk a dependant of the shared chunk (this file + React) rather
 * than the other way round. If the lazy import lived here, the shared chunk and
 * the server chunk would import each other, and the host's SSR entry loader
 * (which fetches chunks into temp files) deadlocks on that cycle.
 */
export function renderSection<P extends object>(
  renderToString: (node: React.ReactNode) => string,
  Component: FunctionComponent<P>,
  props?: P,
): SectionSSRResult {
  return { html: renderToString(sectionElement(Component, props)), css };
}

/**
 * Client half of a section module: hydrate / mount into a slot. Each section is
 * its own React root inside the same remote bundle, so the six sections share
 * one React and one GSAP instance while the host mounts them independently.
 * The element is built per call so the props the host passes reach the component.
 */
export function createClientModule<P extends object>(
  Component: FunctionComponent<P>,
): Pick<SectionModule<P>, 'hydrate' | 'mount'> {
  return {
    hydrate(target, props) {
      dispose(target);
      const root = hydrateRoot(target, sectionElement(Component, props));
      roots.set(target, root);
      return () => dispose(target);
    },
    mount(target, props) {
      injectStyles(target.ownerDocument ?? document);
      dispose(target);
      const root = createRoot(target);
      root.render(sectionElement(Component, props));
      roots.set(target, root);
      return () => dispose(target);
    },
  };
}

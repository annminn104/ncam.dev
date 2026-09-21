import { useSyncExternalStore } from 'react';

/**
 * Light/dark theming for the host shell — and, because remotes mount into the
 * host document and inherit `<html data-theme>`, for the profile remote too.
 *
 * Three states, two of them visible:
 *  - no stored preference → NO `data-theme` attribute, so the tokens'
 *    `@media (prefers-color-scheme: light)` rule decides. Leaving the attribute
 *    off is deliberate: it keeps the page live-reactive to the OS switching
 *    themes mid-session, which a pinned attribute would freeze out.
 *  - stored 'light' / 'dark' → the attribute is written and beats the OS.
 *
 * Palette lives in @ncam/design-tokens/tokens.css; this module only decides
 * WHICH of its two sets is live.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ncam-theme';

/** Matches the tokens' `--dark-bg` / `--light-bg`, for the address-bar tint. */
const THEME_COLOR: Record<Theme, string> = { dark: '#0b0b12', light: '#fbfaff' };

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** Fired on <document> whenever the stored preference changes. */
const CHANGE_EVENT = 'ncam:themechange';

/**
 * Runs before first paint, inlined into <head> by routes/__root.tsx. A
 * synchronous script there executes while the document is still being parsed,
 * so both of its jobs land before anything is painted:
 *  1. replay a stored preference onto <html>, so a returning visitor who pinned
 *     a theme never sees a frame of the other one;
 *  2. write the `theme-color` meta for the resolved theme.
 *
 * It owns that meta outright — creating it rather than editing one React
 * rendered — because React 19 hoists and de-duplicates `<meta>` by name, so the
 * usual pair of scheme-scoped tags collapses into whichever came last. The cost
 * is that a JS-less visitor gets no address-bar tint, which is a cosmetic
 * mobile-only detail; the page itself still themes from CSS alone.
 *
 * Dependency-free, tiny, and wrapped in try/catch because `localStorage` throws
 * outright in some privacy modes.
 */
export const THEME_SCRIPT = `(function(){try{
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}
else{t=window.matchMedia('${LIGHT_QUERY}').matches?'light':'dark';}
var m=document.querySelector('meta[name="theme-color"]');
if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
m.setAttribute('content',t==='light'?'${THEME_COLOR.light}':'${THEME_COLOR.dark}');
}catch(e){}})();`;

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** The theme actually on screen: explicit choice, else the OS, else dark. */
export function resolveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const pinned = document.documentElement.getAttribute('data-theme');
  if (pinned === 'light' || pinned === 'dark') return pinned;
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

/**
 * Keeps the address bar in step with the page. The tag has no `data-theme`
 * equivalent and cannot be driven from CSS, so it is written imperatively — by
 * THEME_SCRIPT before first paint, and by this from then on.
 */
export function syncThemeColor(theme: Theme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode — the theme still applies, it just will not survive a reload. */
  }
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeColor(theme);
  document.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleTheme() {
  setTheme(resolveTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Another tab toggled the theme. `storage` only tells us the stored VALUE
 * changed — this tab's own `<html data-theme>` is still whatever it was, and
 * `resolveTheme` reads that attribute first. So replay the new value onto the
 * document before reporting the change, or the other tab's choice would be
 * remembered but not shown until a reload.
 */
function applyStoredTheme() {
  const stored = storedTheme();
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // `theme-color` is not touched here: ThemeToggle re-syncs it off the resolved
  // theme, which covers this, an OS switch and a local toggle with one path.
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(LIGHT_QUERY);
  // Only matters while nothing is pinned, but `resolveTheme` already ignores the
  // OS in that case, so an extra re-render is harmless and the wiring stays flat.
  media.addEventListener('change', onChange);
  document.addEventListener(CHANGE_EVENT, onChange);
  const onStorage = (event: StorageEvent) => {
    // `key` is null when the whole store was cleared — that concerns us too.
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyStoredTheme();
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', onChange);
    document.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The live theme. Server-renders as 'dark' (the token fallback) and corrects
 * itself on hydration — components that show the theme by name should carry
 * `suppressHydrationWarning`.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, resolveTheme, () => 'dark' as const);
}

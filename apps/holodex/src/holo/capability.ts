/**
 * Whether this visitor should get the WebGL holo layer at all.
 *
 * The browser bits arrive as an injected probe so this is testable under the
 * repo's `node` test environment — there is no jsdom here on purpose.
 */
export interface HoloProbe {
  matchMedia?: (query: string) => { matches: boolean };
  hardwareConcurrency?: number;
  /** Returns a WebGL2 context, or null/throws when unavailable. */
  createContext?: () => unknown;
}

/** The media query the app's reduced-motion policy is keyed to. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function supportsHolo(probe: HoloProbe): boolean {
  if (!probe.createContext) return false;
  if (probe.matchMedia?.(REDUCED_MOTION_QUERY).matches) return false;
  if (typeof probe.hardwareConcurrency === 'number' && probe.hardwareConcurrency <= 2) return false;
  try {
    return Boolean(probe.createContext());
  } catch {
    return false;
  }
}

/** The real browser probe. Returns an empty probe on the server. */
export function browserProbe(): HoloProbe {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {};
  return {
    matchMedia: (query) => window.matchMedia(query),
    hardwareConcurrency: navigator.hardwareConcurrency,
    createContext: () => document.createElement('canvas').getContext('webgl2'),
  };
}

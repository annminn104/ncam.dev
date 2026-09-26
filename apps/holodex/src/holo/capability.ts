/**
 * Whether this visitor should get the WebGL holo layer at all.
 *
 * The browser bits arrive as an injected probe so this is testable under the
 * repo's `node` test environment — there is no jsdom here on purpose.
 */
export interface HoloProbe {
  matchMedia?: (query: string) => { matches: boolean };
  hardwareConcurrency?: number;
  /**
   * Anything truthy when a WebGL2 context could be created; falsy or throws
   * when not. Deliberately `unknown` rather than a context type: the real
   * probe releases the context it opens and reports only the verdict.
   */
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
    // Probing costs a real WebGL2 context, and `HoloCard` probes once per
    // mount. Left to the garbage collector those accumulate: browsers cap
    // live contexts near 16 and drop the oldest, which is precisely the
    // `holo.context-lost` path — a grid of cards could knock out its own
    // earlier canvases just by asking whether WebGL works. See the same
    // reasoning in scene.ts's teardown. So free it the instant the answer is
    // known, and hand `supportsHolo` the boolean rather than the context.
    createContext: () => {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl !== null;
    },
  };
}

// Whether the garden opens by itself once the page has settled, or waits for the visitor's first
// interaction. `shouldAutoplay` is the decision, pure for node tests; the rest reads the browser
// and is called from an effect only (the SSR entry renders App, which imports this module).

export interface AutoplaySignals {
  /** WebGL2 without a major performance caveat: a hardware GPU, not a software rasteriser. */
  hardwareGpu: boolean;
  /** The visitor asked for `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
}

/**
 * Open by itself only on a hardware GPU, for a visitor who welcomes motion. A software rasteriser
 * (SwiftShader: the Lighthouse runner, machines without a usable GPU) spends ~2.6 s on the main
 * thread compiling shaders, so there the first interaction starts the scene, as it always did.
 */
export function shouldAutoplay({ hardwareGpu, reducedMotion }: AutoplaySignals): boolean {
  return hardwareGpu && !reducedMotion;
}

/** Software rasterisers by the renderer name WebGL reports: SwiftShader, Mesa's, Windows' WARP. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|microsoft basic render/i;

/** True when `renderer` names a software rasteriser; an unknown name is not one. */
export function isSoftwareRenderer(renderer: string | null): boolean {
  return renderer !== null && SOFTWARE_RENDERER.test(renderer);
}

/**
 * A throwaway WebGL2 context, released at once. `failIfMajorPerformanceCaveat` makes the browser
 * refuse it when it would render in software, but Chrome still hands out SwiftShader when it was
 * enabled outright (`--enable-unsafe-swiftshader`), so the renderer's name is checked too.
 */
function hasHardwareWebGL2(): boolean {
  try {
    const gl = document
      .createElement('canvas')
      .getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !isSoftwareRenderer(typeof renderer === 'string' ? renderer : null);
  } catch {
    return false;
  }
}

export function readAutoplaySignals(): AutoplaySignals {
  return {
    hardwareGpu: hasHardwareWebGL2(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

/** The latest an idle callback may wait once the page has loaded. */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs `fn` once the page has loaded and the main thread is idle, so the scene's setup never
 * competes with the first paint. Returns a canceller.
 */
export function whenSettled(fn: () => void): () => void {
  let cancelled = false;
  let idle = 0;
  let timer = 0;
  const run = () => {
    if (!cancelled) fn();
  };
  const onLoad = () => {
    if (typeof requestIdleCallback === 'function') {
      idle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    } else {
      timer = window.setTimeout(run, 0);
    }
  };
  if (document.readyState === 'complete') onLoad();
  else addEventListener('load', onLoad, { once: true });
  return () => {
    cancelled = true;
    removeEventListener('load', onLoad);
    if (idle) cancelIdleCallback(idle);
    if (timer) clearTimeout(timer);
  };
}

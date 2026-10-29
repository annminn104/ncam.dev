// Whether this browser can make the WebGL 2 context the 3D player needs. Called from an effect only
// (the SSR entry renders App, which imports this module) and three-free, so the shell can ask
// before the scene mounts a canvas.

/** What the probe asks of a WebGL 2 context. */
export interface ProbeContext {
  getExtension(name: 'WEBGL_lose_context'): { loseContext(): void } | null;
}

/** What the probe asks of a canvas: a real one, or a stand-in for node tests. */
export interface ProbeCanvas {
  getContext(type: 'webgl2'): ProbeContext | null;
}

/**
 * True when a WebGL 2 context can be made, a software rasteriser included (the scene runs on one,
 * slowly; src/autoplay.ts decides whether it opens unasked). The throwaway context is released at
 * once, so the scene's own is the only one left.
 */
export function hasWebGL2(
  createCanvas: () => ProbeCanvas = () => document.createElement('canvas'),
): boolean {
  try {
    const gl = createCanvas().getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

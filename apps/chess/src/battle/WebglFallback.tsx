export function WebglFallback({ onExit }: { onExit(): void }) {
  return (
    <div className="chess-fallback" role="alert">
      <h2>Your spirit sense is too weak</h2>
      <p>This arena needs WebGL, which this browser or device has turned off.</p>
      <button type="button" className="chess-start" onClick={onExit}>
        Back to the lobby
      </button>
    </div>
  );
}

/**
 * Can this browser give three a WebGL context? Only WebGL 2 counts: three creates nothing else
 * (WebGLRenderer asks for 'webgl2' alone and throws without it), so a probe that also took
 * WebGL 1 would let a browser through only for the renderer to fail.
 */
export function hasWebgl(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): boolean {
  try {
    const gl = createCanvas().getContext('webgl2');
    // Browsers cap live contexts (Chrome keeps 16 and drops the oldest, which could be the
    // battle's own), so a probe that is only here to answer yes/no gives its context back.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

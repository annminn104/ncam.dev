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

export function hasWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    // Browsers cap live contexts (Chrome keeps 16 and drops the oldest, which could be the
    // battle's own), so a probe that is only here to answer yes/no gives its context back.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

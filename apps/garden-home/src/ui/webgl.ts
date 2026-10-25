export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context right away
    return gl !== null;
  } catch {
    return false;
  }
}

/** What failed, for the visitor; the music keeps playing either way. */
export interface Failure {
  message: string;
  /** Offer "Try again". */
  retry: boolean;
  /** "Try again" reloads the page: the browser remembers a chunk that failed to load until then. */
  reload?: boolean;
}

export class SceneChunkError extends Error {
  name = 'SceneChunkError';
}

export class NoWebGLError extends Error {
  name = 'NoWebGLError';
}

const COULDNT_START = "The 3D player couldn't start. The music still plays.";

export function describeFailure(error: unknown): Failure {
  if (error instanceof NoWebGLError) {
    return {
      message: "This browser can't draw the 3D player. The music still plays.",
      retry: false,
    };
  }
  if (error instanceof SceneChunkError) {
    return { message: COULDNT_START, retry: true, reload: true };
  }
  return { message: COULDNT_START, retry: true };
}

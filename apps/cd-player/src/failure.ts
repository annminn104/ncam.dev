/** What failed, for the visitor; the music keeps playing either way. */
export interface Failure {
  message: string;
  /** Offer "Try again". */
  retry: boolean;
}

export class SceneChunkError extends Error {
  name = 'SceneChunkError';
}

export class NoWebGLError extends Error {
  name = 'NoWebGLError';
}

export function describeFailure(error: unknown): Failure {
  if (error instanceof NoWebGLError) {
    return {
      message: "This browser can't draw the 3D player. The music still plays.",
      retry: false,
    };
  }
  return { message: "The 3D player couldn't start. The music still plays.", retry: true };
}

import { BOOT_STALL_MS, type StallPart } from './boot';

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

/**
 * A boot went BOOT_STALL_MS without a word, waiting on the scene's code or on the model's download
 * (`watchStall` in src/boot.ts); its message names which.
 */
export class BootStallError extends Error {
  name = 'BootStallError';
  constructor(readonly part: StallPart) {
    super(
      part === 'scene'
        ? `the scene's code did not come within ${BOOT_STALL_MS} ms`
        : `the model's download sent nothing for ${BOOT_STALL_MS} ms`,
    );
  }
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

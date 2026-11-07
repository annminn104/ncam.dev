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

/** What a stalled load waited on, for the log. */
function stallMessage(part: StallPart): string {
  switch (part) {
    case 'scene':
      return `the scene's code did not come within ${BOOT_STALL_MS} ms`;
    case 'model':
      return `the model's download sent nothing for ${BOOT_STALL_MS} ms`;
    case 'compile':
      return `the model did not compile within ${BOOT_STALL_MS} ms of its download`;
  }
}

/**
 * A boot went BOOT_STALL_MS without a word, waiting on the scene's code, on the model's download or
 * on its parse and compile (`watchStall` in src/boot.ts); its message names which.
 */
export class BootStallError extends Error {
  name = 'BootStallError';
  constructor(readonly part: StallPart) {
    super(stallMessage(part));
  }
}

/**
 * A change of model once one is on show went BOOT_STALL_MS without a word, on its download or on
 * its parse and compile (src/scene/model-load.ts): logged, and the model on show stays.
 */
export class ModelStallError extends Error {
  name = 'ModelStallError';
  constructor(readonly part: StallPart) {
    super(stallMessage(part));
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

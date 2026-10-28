// What a failed start tells the visitor. SSR-safe: the shell imports it, so does the scene chunk.

/** A failure whose message is already written for the visitor (no WebGL2). */
export class GardenStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GardenStartError';
  }
}

/** The scene chunk would not load. lazy() and Chromium remember a rejected import until a reload. */
export class SceneChunkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneChunkError';
  }
}

export const NO_WEBGL2 = "This browser can't draw the 3D garden: WebGL 2 is off or unsupported.";
export const GENERIC_FAILURE = "The 3D garden couldn't start. Please try again.";
export const CHUNK_FAILURE = "The 3D garden couldn't load. Reload the page to try again.";

export interface Failure {
  message: string;
  /** Whether "Try again" can help; a chunk that failed to load fails again until a reload. */
  retry: boolean;
}

export function describeFailure(error: unknown): Failure {
  if (error instanceof Error && error.name === 'SceneChunkError') {
    return { message: CHUNK_FAILURE, retry: false };
  }
  if (error instanceof Error && error.name === 'GardenStartError' && error.message) {
    return { message: error.message, retry: true };
  }
  return { message: GENERIC_FAILURE, retry: true };
}

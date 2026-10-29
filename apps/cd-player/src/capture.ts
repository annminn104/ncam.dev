/**
 * `?capture=<shape>` on the standalone page draws the scene alone, with its default prints and a
 * transparent background, for scripts/capture-poster.mjs. The poster is the first paint, so it must
 * be the scene as it boots: the default prints, not a track's (they change daily).
 */
export type CaptureShape = 'landscape' | 'portrait';

/**
 * CSS viewport and device scale: the framing reads the CSS width (wide above 820 px), and the
 * picture is cut to the screen it stands in for. 1280 x 720 is a 16:9 desktop; 390 x 844 is the
 * commonest phone viewport, so `object-fit: cover` shows the poster there at the live scene's
 * scale and the canvas fades in with no jump. Keep in step with SHAPES in
 * scripts/capture-poster.mjs and the sizes in src/assets/poster/index.ts.
 */
export const CAPTURE: Readonly<
  Record<CaptureShape, { viewport: { width: number; height: number }; scale: number }>
> = {
  landscape: { viewport: { width: 1280, height: 720 }, scale: 2 },
  portrait: { viewport: { width: 390, height: 844 }, scale: 1080 / 390 },
};

export function captureShape(search: string): CaptureShape | null {
  const value = new URLSearchParams(search).get('capture');
  return value === 'landscape' || value === 'portrait' ? value : null;
}

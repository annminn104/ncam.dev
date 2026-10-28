import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * The scene's first frames are on screen and, on the site route, its layer is live: `__sceneReady` is set a
 * moment before React commits `is-live`, and until then the layer is inert (src/shell/SceneHost.tsx), so an action
 * right after would hit a deaf scene. The wallpaper's and the capture view's layers are always live, so the second
 * condition changes nothing there.
 */
export async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as { __sceneReady?: boolean }).__sceneReady === true &&
      document.querySelector('.gh-scene:not(.is-live)') === null,
    null,
    { timeout: 45_000 },
  );
}

/**
 * The site route waits behind the poster on SwiftShader (src/autoplay.ts): open it and press
 * Enter, as a visitor would. The wallpaper boots by itself; open it with page.goto.
 */
export async function gotoSite(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.getByRole('button', { name: 'Enter the garden' }).click();
}

/** A part of a screenshot, in shares of its width and height from the top left. */
export interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Share of pixels whose luma (0..255) exceeds `threshold`, over the whole frame or just `region`: lit windows and LEDs
 * in a night frame.
 */
export function brightFraction(
  png: Buffer,
  threshold = 170,
  region: Region = { x0: 0, x1: 1, y0: 0, y1: 1 },
): number {
  const { data, width, height } = PNG.sync.read(png);
  let bright = 0;
  let total = 0;
  for (let y = Math.round(region.y0 * height); y < Math.round(region.y1 * height); y++) {
    for (let x = Math.round(region.x0 * width); x < Math.round(region.x1 * width); x++) {
      const i = (y * width + x) * 4;
      total += 1;
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > threshold) bright += 1;
    }
  }
  return bright / total;
}

/** Mean luma (0..255) of a `width` x `height` pixel box centred on (x, y) of a screenshot, clipped to the frame. */
export function boxLuma(png: Buffer, x: number, y: number, width: number, height: number): number {
  const { data, width: w, height: h } = PNG.sync.read(png);
  let sum = 0;
  let count = 0;
  for (
    let py = Math.max(0, Math.round(y - height / 2));
    py < Math.min(h, Math.round(y + height / 2));
    py++
  ) {
    for (
      let px = Math.max(0, Math.round(x - width / 2));
      px < Math.min(w, Math.round(x + width / 2));
      px++
    ) {
      const i = (py * w + px) * 4;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count += 1;
    }
  }
  return sum / count;
}

/** Mean colour [r, g, b] (0..255) of a `width` x `height` pixel box centred on (x, y) of a screenshot, clipped to the frame. */
export function boxColor(
  png: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number, number] {
  const { data, width: w, height: h } = PNG.sync.read(png);
  const sum = [0, 0, 0];
  let count = 0;
  for (
    let py = Math.max(0, Math.round(y - height / 2));
    py < Math.min(h, Math.round(y + height / 2));
    py++
  ) {
    for (
      let px = Math.max(0, Math.round(x - width / 2));
      px < Math.min(w, Math.round(x + width / 2));
      px++
    ) {
      const i = (py * w + px) * 4;
      for (let c = 0; c < 3; c++) sum[c] += data[i + c];
      count += 1;
    }
  }
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

/** Mean absolute difference per colour channel (0..255) between two screenshots of the same size. */
export function meanDifference(a: Buffer, b: Buffer): number {
  const one = PNG.sync.read(a);
  const two = PNG.sync.read(b);
  if (one.width !== two.width || one.height !== two.height)
    throw new Error('screenshots differ in size');
  let sum = 0;
  for (let i = 0; i < one.data.length; i += 4) {
    sum +=
      Math.abs(one.data[i] - two.data[i]) +
      Math.abs(one.data[i + 1] - two.data[i + 1]) +
      Math.abs(one.data[i + 2] - two.data[i + 2]);
  }
  return sum / ((one.data.length / 4) * 3);
}

/** Mean and standard deviation of luma (0..255) over a PNG screenshot. */
export function luminance(png: Buffer): { mean: number; std: number } {
  const { data, width, height } = PNG.sync.read(png);
  const pixels = width * height;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / pixels;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / pixels - mean * mean)) };
}

/** What OrbitRig reports on the site route (window.__camera). */
export interface CameraState {
  position: [number, number, number];
  /** The orbit target, on the ground. */
  target: [number, number, number];
  distance: number;
  polar: number;
  cut: 'none' | 'upper' | 'ground' | 'basement';
  /** Whether the camera is near the house, close enough for the interior's small things to show (orbit.ts nearFor). */
  near: boolean;
  /** What the floor buttons picked: 'auto' (the cut by distance) or the level held. */
  mode: 'auto' | 'none' | 'upper' | 'ground' | 'basement';
  /** Whether a floor button's ease of the camera is under way. */
  easing: boolean;
  /** The house focus the cut measures from. */
  house: [number, number, number] | null;
  /** The point a drag turns round, null while it turns round the target. */
  pivot: [number, number, number] | null;
}

type Point3 = readonly [number, number, number] | readonly number[];

interface CameraHook {
  (): CameraState;
  pick(x: number, y: number): [number, number, number] | null;
  project(point: Point3): { x: number; y: number } | null;
}

/** The live site camera. */
export async function camera(page: Page): Promise<CameraState> {
  const state = await page.evaluate(
    () => (window as { __camera?: CameraHook }).__camera?.() ?? null,
  );
  expect(state, 'window.__camera is set on the site route').not.toBeNull();
  return state!;
}

/** The point of the scene under client (x, y) the site camera would zoom towards or turn round, null over the sky. */
export async function pick(
  page: Page,
  x: number,
  y: number,
): Promise<[number, number, number] | null> {
  return page.evaluate(
    ([px, py]) => (window as { __camera?: CameraHook }).__camera!.pick(px, py),
    [x, y],
  );
}

/** The client pixels a world point shows at, null off screen. */
export async function project(page: Page, point: Point3): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    (p) => (window as { __camera?: CameraHook }).__camera!.project(p),
    [...point],
  );
}

export const distance = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Resolves after `count` animation frames: the scene draws on them, however long SwiftShader takes for each. */
export async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count,
  );
}

/**
 * Wheel steps with the cursor on `at` (a world point; by default the house focus, so the house tests zoom onto the house)
 * until the camera is `distance` from it, so two visits frame alike. A zoom goes towards the point under the cursor, on
 * the line through `at`: a step changes the distance to `at` by what it changes the distance to that point, which
 * OrbitControls scales by 0.95 per 100 units of wheel delta. The wheel event gives the pointer's position in whole
 * pixels (truncated), so the cursor goes to the pixel nearest `at` and the point under it is picked there: otherwise the
 * step's reach is off and two visits to a distance land centimetres apart, which the carport's louvres show. Stops
 * within 5 mm, or short where the orbit is as close as it goes (14.5 m from its target, ORBIT_LIMITS.minDistance).
 */
export async function zoomTo(page: Page, to: number, at?: Point3): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const state = await camera(page);
    const point = at ?? state.house;
    expect(point ?? null, 'a point to zoom at (window.__camera().house)').not.toBeNull();
    const now = distance(state.position, point!);
    if (Math.abs(now - to) < 0.005 || (now > to && state.distance < 14.501)) return;
    const screen = await project(page, point!);
    expect(screen, 'the point to zoom at on screen').not.toBeNull();
    const [x, y] = [Math.round(screen!.x), Math.round(screen!.y)];
    await page.mouse.move(x, y);
    const hit = await pick(page, x, y);
    const reach = hit ? distance(state.position, hit) : now;
    const scale = Math.max(0.2, (reach - (now - to)) / reach);
    await page.mouse.wheel(0, (-Math.log(scale) / Math.log(0.95)) * 100);
    await frames(page, 3); // the step applies on the next frame
  }
  const state = await camera(page);
  throw new Error(
    `could not zoom to ${to} m, stopped at ${distance(state.position, at ?? state.house!)} m`,
  );
}

/**
 * Waits until the camera stops moving. Damping eases it out by a share of what is left on every frame, so this counts
 * frames rather than time: under load SwiftShader draws a few frames a second, and a fixed wait would let two visits
 * to a distance frame differently.
 */
export async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const before = await camera(page);
    await frames(page, 10);
    const after = await camera(page);
    if (Math.hypot(...after.position.map((v, k) => v - before.position[k])) < 2e-3) return;
  }
  throw new Error('the camera did not settle');
}

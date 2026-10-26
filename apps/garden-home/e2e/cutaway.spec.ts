import { expect, type Page, test } from '@playwright/test';
import {
  camera,
  type CameraState,
  collectErrors,
  frames,
  gotoSite,
  meanDifference,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

/** The cut level once the camera is at `distance` and still, after the frames that apply it. */
async function cutAt(page: Page, distance: number): Promise<CameraState['cut']> {
  await zoomTo(page, distance);
  await settle(page);
  await frames(page, 4); // the cut follows the level a frame later (a React effect)
  return (await camera(page)).cut;
}

/**
 * Three.js announces its renderer and scenes to window.__THREE_DEVTOOLS__ when there is one: keep them, to read which
 * meshes clip.
 */
async function watchThree(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const hook = new EventTarget();
    hook.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail;
      const w = window as unknown as { __renderer?: unknown; __scenes?: unknown[] };
      if (detail?.info) w.__renderer = detail;
      else if (detail?.isScene) (w.__scenes ??= []).push(detail);
    });
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
  });
}

interface Clipping {
  local: boolean;
  clipped: string[];
  whole: string[];
}

/** Whether the renderer clips per material, and the glTF nodes whose meshes carry clipping planes or none. */
async function clipping(page: Page): Promise<Clipping> {
  return page.evaluate(() => {
    type Node = {
      name: string;
      userData: { name?: string };
      parent: Node | null;
      isMesh?: boolean;
      material?: unknown;
    };
    type Mat = { clippingPlanes?: unknown[] | null };
    const w = window as unknown as {
      __renderer?: { localClippingEnabled: boolean };
      __scenes?: { traverse(f: (o: Node) => void): void }[];
    };
    const clipped = new Set<string>();
    const whole = new Set<string>();
    for (const scene of w.__scenes ?? []) {
      scene.traverse((object) => {
        if (!object.isMesh) return;
        let node: Node | null = object;
        while (node && node.userData.name === undefined) node = node.parent;
        const name = node?.userData.name ?? object.name;
        const materials = (
          Array.isArray(object.material) ? object.material : [object.material]
        ) as Mat[];
        (materials.some((m) => (m.clippingPlanes?.length ?? 0) > 0) ? clipped : whole).add(name);
      });
    }
    return {
      local: w.__renderer?.localClippingEnabled === true,
      clipped: [...clipped],
      whole: [...whole],
    };
  });
}

test('zooming in cuts the roof, then the upper floor, away; zooming out brings the house back', async ({
  page,
}) => {
  // Eight zooms that each wait for the camera to settle: 40-45 s on its own, but up to 2.5 min in a full parallel run
  // on SwiftShader since the garden (villa v2 part 2) made the site route ~15 % slower to draw: over the 150 s it had.
  // With the carport and the dog's corner (part 4) it took 3.3-4.0 min under load 20-40, at its four minutes' end.
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  const canvas = page.locator('canvas');
  // Look down on the house from about 50 degrees, so no clearance ever holds the camera: every visit to a distance
  // then frames the same picture and the cut alone tells two visits apart.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 455, { steps: 8 });
  await page.mouse.up();
  await settle(page);

  expect(await cutAt(page, 44)).toBe('none'); // coming from afar: the roof stays until 42 m
  const whole44 = await canvas.screenshot();
  expect(await cutAt(page, 40)).toBe('upper');
  expect(await cutAt(page, 44)).toBe('upper'); // going back out: the roof stays off until 48 m
  const upper44 = await canvas.screenshot();
  expect(meanDifference(whole44, upper44)).toBeGreaterThan(4);

  expect(await cutAt(page, 27)).toBe('upper'); // the upper floor stays until 25 m
  const upper27 = await canvas.screenshot();
  expect(await cutAt(page, 24)).toBe('ground');
  expect(await cutAt(page, 27)).toBe('ground'); // and stays off until 31 m
  const ground27 = await canvas.screenshot();
  expect(meanDifference(upper27, ground27)).toBeGreaterThan(4);

  expect(await cutAt(page, 60)).toBe('none');
  expect(await cutAt(page, 44)).toBe('none');
  // the same picture as on the way in, up to the water and the swaying palms (two frames in a row differ by ~1)
  expect(meanDifference(whole44, await canvas.screenshot())).toBeLessThan(3);
  expect(errors).toEqual([]);
});

test('only the house clips, and only on the site route', async ({ page }) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  const site = await clipping(page);
  expect(site.local).toBe(true);
  expect(site.clipped).toEqual(
    expect.arrayContaining(['Sofa', 'TV_wall', 'Walls_white', 'WATER_jacuzzi']),
  );
  expect(site.clipped).not.toContain('WATER_pool');
  expect(site.whole).toContain('WATER_pool');
  // the carport by the house's east wall and the dog's corner (part 4) stand whole while the house is cut (the tall
  // house's chandelier clips too, at the upper floor's cut: tallhouse.spec finds it under the ground floor's)
  for (const name of ['Carport', 'Pickup', 'Supercar', 'Akita']) {
    expect(site.whole, name).toContain(name);
    expect(site.clipped, name).not.toContain(name);
  }

  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const wallpaper = await clipping(page);
  expect(wallpaper.local).toBe(false);
  expect(wallpaper.clipped).toEqual([]);
  expect(wallpaper.whole).toEqual(expect.arrayContaining(['Sofa', 'TV_wall', 'WATER_pool']));
  expect(errors).toEqual([]);
});

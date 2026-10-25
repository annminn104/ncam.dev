import { expect, type Page, test } from '@playwright/test';
import {
  boxColor,
  brightFraction,
  camera,
  collectErrors,
  frames,
  luminance,
  pick,
  type Region,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

/**
 * Three.js announces its renderer and scenes to window.__THREE_DEVTOOLS__ when there is one: keep the scenes, to read
 * where the Akita's head is turned while its clip plays and how bright the pickup's lights glow, and the camera of the
 * last frame the renderer drew (window.__drawnCamera), to find the carport on the wallpaper.
 */
async function watchThree(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Renderer = { isWebGLRenderer?: boolean; render(scene: unknown, camera: unknown): void };
    const hook = new EventTarget();
    hook.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail;
      const page = window as unknown as { __scenes?: unknown[]; __drawnCamera?: unknown };
      if (detail?.isScene) (page.__scenes ??= []).push(detail);
      if ((detail as Renderer)?.isWebGLRenderer) {
        const renderer = detail as Renderer;
        const render = renderer.render;
        renderer.render = function (scene, camera) {
          page.__drawnCamera = camera;
          return render.call(this, scene, camera);
        };
      }
    });
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
  });
}

/** The quaternion [x, y, z, w] of the glTF node `name` (its own, in its parent's space), or null. */
async function rotation(page: Page, name: string): Promise<number[] | null> {
  return page.evaluate((n) => {
    type Node = { userData: { name?: string }; quaternion: { toArray(): number[] } };
    let found: number[] | null = null;
    for (const scene of (
      window as unknown as { __scenes?: { traverse(f: (o: Node) => void): void }[] }
    ).__scenes ?? []) {
      scene.traverse((object) => {
        if (!found && object.userData.name === n) found = object.quaternion.toArray();
      });
    }
    return found;
  }, name);
}

/**
 * How the materials of the glTF node `name` glow: the strongest emissive intensity of its lamps and the opacity of its
 * light pools (GLOW_*, 0 while hidden), or null when there is no such node.
 */
async function glow(page: Page, name: string): Promise<{ lamps: number; pools: number } | null> {
  return page.evaluate((n) => {
    type Material = { name: string; visible: boolean; opacity: number; emissiveIntensity?: number };
    type Node = {
      userData: { name?: string };
      material?: Material | Material[];
      traverse(f: (o: Node) => void): void;
    };
    let found: { lamps: number; pools: number } | null = null;
    for (const scene of (window as unknown as { __scenes?: Node[] }).__scenes ?? []) {
      scene.traverse((object) => {
        if (found || object.userData.name !== n) return;
        const glowing = { lamps: 0, pools: 0 };
        object.traverse((part) => {
          for (const material of [part.material ?? []].flat()) {
            if (material.name.startsWith('GLOW_'))
              glowing.pools = Math.max(glowing.pools, material.visible ? material.opacity : 0);
            else glowing.lamps = Math.max(glowing.lamps, material.emissiveIntensity ?? 0);
          }
        });
        found = glowing;
      });
    }
    return found;
  }, name);
}

/** The names of the glTF nodes of `names` the scenes hold. */
async function present(page: Page, names: string[]): Promise<string[]> {
  return page.evaluate((wanted) => {
    type Node = { userData: { name?: string }; traverse(f: (o: Node) => void): void };
    const found = new Set<string>();
    for (const scene of (window as unknown as { __scenes?: Node[] }).__scenes ?? []) {
      scene.traverse((object) => {
        if (wanted.includes(object.userData.name ?? '')) found.add(object.userData.name!);
      });
    }
    return wanted.filter((name) => found.has(name));
  }, names);
}

/** Shows or hides the glTF nodes of `names`. */
async function show(page: Page, names: string[], visible: boolean): Promise<void> {
  await page.evaluate(
    ({ wanted, on }) => {
      type Node = {
        userData: { name?: string };
        visible: boolean;
        traverse(f: (o: Node) => void): void;
      };
      for (const scene of (window as unknown as { __scenes?: Node[] }).__scenes ?? []) {
        scene.traverse((object) => {
          if (wanted.includes(object.userData.name ?? '')) object.visible = on;
        });
      }
    },
    { wanted: names, on: visible },
  );
}

/**
 * The box the glTF node `name` covers on the canvas, in shares of its width and height (helpers' Region), as the last
 * frame's camera saw it, or null.
 */
async function onScreen(page: Page, name: string): Promise<Region | null> {
  return page.evaluate((n) => {
    type Vector = {
      x: number;
      y: number;
      z: number;
      applyMatrix4(m: unknown): Vector;
      project(c: unknown): Vector;
    };
    type Mesh = {
      isMesh?: boolean;
      matrixWorld: unknown;
      geometry: { boundingBox: { min: Vector; max: Vector } | null; computeBoundingBox(): void };
    };
    type Node = Mesh & {
      userData: { name?: string };
      position: Vector;
      traverse(f: (o: Node) => void): void;
    };
    const page = window as unknown as { __scenes?: Node[]; __drawnCamera?: unknown };
    let node: Node | null = null;
    for (const scene of page.__scenes ?? []) {
      scene.traverse((object) => {
        if (!node && object.userData.name === n) node = object;
      });
    }
    if (!node || !page.__drawnCamera) return null;
    const Vector3 = (node as Node).position.constructor as new (
      x: number,
      y: number,
      z: number,
    ) => Vector;
    const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    (node as Node).traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox!;
      for (const x of [min.x, max.x])
        for (const y of [min.y, max.y])
          for (const z of [min.z, max.z]) {
            const p = new Vector3(x, y, z)
              .applyMatrix4(mesh.matrixWorld)
              .project(page.__drawnCamera);
            box.x0 = Math.min(box.x0, (p.x + 1) / 2);
            box.x1 = Math.max(box.x1, (p.x + 1) / 2);
            box.y0 = Math.min(box.y0, (1 - p.y) / 2);
            box.y1 = Math.max(box.y1, (1 - p.y) / 2);
          }
    });
    return box;
  }, name);
}

/** The angle in degrees between two unit quaternions. */
function angle(a: number[], b: number[]): number {
  const dot = Math.min(1, Math.abs(a.reduce((sum, v, i) => sum + v * b[i], 0)));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

// Zooming in, dragging and waiting for the camera to settle takes a while when SwiftShader shares the machine with other
// workers: the dog's test took 2.7-2.9 min in a full parallel run under load 20-40.
test.describe.configure({ timeout: 240_000 });

interface Point {
  x: number;
  y: number;
}

/** The objects of the carport and the dog's corner (villa v2 part 4). */
const CARPORT = [
  'Carport_floor',
  'Carport',
  'Carport_glass',
  'Carport_lights',
  'Pickup',
  'Pickup_lights',
  'Supercar',
  'Supercar_lights',
  'Kennel',
  'Dog_corner',
  'Akita',
  'Akita_head',
  'Akita_tail',
];

/** The middle of the carport's slot and the dog house's on the ground (scene.json; Blender (16, 6.5) and (22, 12.5)). */
const CARPORT_AT = [16, 0, -6.5] as const;
const KENNEL_AT = [22, 0, -12.5] as const;

/**
 * Turns the camera round its target by a drag of (dx, dy): the sideways part starts on the sky along the top of the view
 * (a drag that starts on the scene turns round the point under it, OrbitRig), the tilt from the middle (it turns round
 * the target wherever it starts). Then waits for the camera to settle.
 */
async function turnRoundTarget(page: Page, dx: number, dy: number): Promise<void> {
  if (dx !== 0) {
    let sky: Point | null = null;
    for (const x of [640, 480, 800, 320, 960, 160, 1120]) {
      if (!sky && (await pick(page, x, 12)) === null) sky = { x, y: 12 };
    }
    expect(sky, 'some sky along the top of the view').not.toBeNull();
    await page.mouse.move(sky!.x, sky!.y);
    await page.mouse.down();
    await page.mouse.move(sky!.x + dx, sky!.y, { steps: 12 });
    expect((await camera(page)).pivot, 'a drag on the sky turns round the target').toBeNull();
    await page.mouse.up();
  }
  if (dy !== 0) {
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(640, 400 + dy, { steps: 12 });
    await page.mouse.up();
  }
  await settle(page);
}

async function at(page: Page, name: string): Promise<Point | null> {
  return page.evaluate(
    (n) =>
      (window as { __interact?: { at(name: string): Point | null } }).__interact?.at(n) ?? null,
    name,
  );
}

async function state(
  page: Page,
): Promise<{ toggles: Record<string, string>; hover: { label: string; node: string } | null }> {
  const found = await page.evaluate(
    () => (window as { __interact?: { state(): unknown } }).__interact?.state() ?? null,
  );
  expect(found, 'window.__interact is set on the site route').not.toBeNull();
  return found as {
    toggles: Record<string, string>;
    hover: { label: string; node: string } | null;
  };
}

/**
 * How much the middle of the carport's box on the wallpaper changes, mean over the channels (0..255), when the carport
 * and the dog's corner are hidden and the lawn under them shows, at the least: measured 35.5 at 12:00 (the grey-white
 * roof over the green lawn) and 12.7 at 21:00, so a little under half of that.
 */
const WALLPAPER_CHANGE = { '12:00': 15, '21:00': 6 };

test("the wallpaper draws the carport and the dog's corner by day and by night without console errors", async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  for (const time of ['12:00', '21:00'] as const) {
    await page.goto(`/wallpaper?t=${time}&bg=example.jpg`);
    await waitForScene(page);
    const canvas = page.locator('canvas');
    expect(luminance(await canvas.screenshot()).std).toBeGreaterThan(8);
    expect(await present(page, CARPORT), time).toEqual(CARPORT);
    // the carport's roof, not bare lawn, in the middle half of its box
    const box = await onScreen(page, 'Carport');
    expect(box, 'the carport on the wallpaper').not.toBeNull();
    const { width, height } = (await canvas.boundingBox())!;
    const { x0, x1, y0, y1 } = box!;
    const middle = async () =>
      boxColor(
        await canvas.screenshot(),
        ((x0 + x1) / 2) * width,
        ((y0 + y1) / 2) * height,
        ((x1 - x0) / 2) * width,
        ((y1 - y0) / 2) * height,
      );
    const shown = await middle();
    await show(page, CARPORT, false);
    await frames(page, 6);
    const lawn = await middle();
    await show(page, CARPORT, true);
    const change = shown.reduce((sum, value, i) => sum + Math.abs(value - lawn[i]), 0) / 3;
    expect(change, `${time}: the carport ${shown} over the lawn ${lawn}`).toBeGreaterThan(
      WALLPAPER_CHANGE[time],
    );
  }
  expect(errors).toEqual([]);
});

test('the carport, its two cars and the Akita by its dog house stand on the island in the first view of the site', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  for (const name of CARPORT) expect(await at(page, name), name).not.toBeNull();
  expect(errors).toEqual([]);
});

// From 40 m off the carport's slot, zoomed with the cursor on it (the zoom keeps it where the first view shows it, right
// of the middle): the pickup's dark cab by the low red supercar, the light of their headlights on the ground ahead.
const CLOSE = 40;
/** The box round the pickup (CSS pixels either way of its middle) its lights and the light they cast fall in, from CLOSE. */
const PICKUP_BOX = { x: 140, y: 80 };
const LIT = 170;

test('at night a click on the pickup switches its head and tail lights off, and a second on again', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=21:00');
  await waitForScene(page);
  await zoomTo(page, CLOSE, CARPORT_AT);
  await settle(page);
  await frames(page, 4);
  const canvas = page.locator('canvas');
  const pickup = await at(page, 'Pickup');
  expect(pickup, 'the pickup on screen').not.toBeNull();
  const { x, y } = pickup!;
  const box = await canvas.boundingBox();
  const region = {
    x0: (x - PICKUP_BOX.x - box!.x) / box!.width,
    x1: (x + PICKUP_BOX.x - box!.x) / box!.width,
    y0: (y - PICKUP_BOX.y - box!.y) / box!.height,
    y1: (y + PICKUP_BOX.y - box!.y) / box!.height,
  };
  // the share of lit pixels round the pickup, the pointer up in the sky so no hover box or label is drawn over it
  const lit = async () => {
    await page.mouse.move(box!.x + 5, box!.y + 5);
    await frames(page, 2);
    return brightFraction(await canvas.screenshot(), LIT, region);
  };
  await page.mouse.move(x, y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Đèn xe bán tải');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  const on = await lit();
  // its head and tail lights glow and the light they cast lies on the ground, the supercar's too
  const glowing = await glow(page, 'Pickup_lights');
  expect(glowing, "the pickup's lights on the scene").not.toBeNull();
  expect(glowing!.lamps).toBeGreaterThan(0);
  expect(glowing!.pools).toBeGreaterThan(0);
  const supercar = await glow(page, 'Supercar_lights');

  await page.mouse.click(x, y);
  expect((await state(page)).toggles).toEqual({ 'lights:car_pickup': 'off' }); // lit at night on auto, so off
  await expect.poll(() => glow(page, 'Pickup_lights')).toEqual({ lamps: 0, pools: 0 });
  expect(await glow(page, 'Supercar_lights')).toEqual(supercar); // only the pickup's group switched
  // measured 0.042 lit and 0.021 off (the supercar's lights and the downlights stay on): half of that drop at least
  await expect.poll(lit, { timeout: 15_000 }).toBeLessThan(on - 0.01);
  const off = await lit();
  await page.mouse.click(x, y);
  expect((await state(page)).toggles).toEqual({ 'lights:car_pickup': 'on' });
  await expect
    .poll(async () => (await glow(page, 'Pickup_lights'))!.lamps)
    .toBeGreaterThan(glowing!.lamps * 0.99);
  expect((await glow(page, 'Pickup_lights'))!.pools).toBeGreaterThan(0);
  await expect.poll(lit, { timeout: 15_000 }).toBeGreaterThan(off + 0.01);
  expect(errors).toEqual([]);
});

// From 45 m off the carport's slot (zoomed with the cursor on it), raised over the south-east by a drag 50 px down,
// both cars show through the gaps between the roof's louvres under its glass sheet. A line of points across each car's
// middle, CSS pixels either way of it, up to the first that names the car (measured: 3 of the 21 over the pickup, 5 over
// the supercar, the 3rd and the 7th the first; before the glass was an object of its own, all 21 named the roof).
const RAISED = { distance: 45, drag: { x: 0, y: 50 }, span: 30, step: 3 };

test("from a raised view the pointer finds each car through the carport's glass roof, between its louvres", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await zoomTo(page, RAISED.distance, CARPORT_AT);
  await turnRoundTarget(page, RAISED.drag.x, RAISED.drag.y);
  await frames(page, 4);
  for (const [name, label] of [
    ['Pickup', 'Đèn xe bán tải'],
    ['Supercar', 'Đèn siêu xe'],
  ]) {
    const car = await at(page, name);
    expect(car, `the ${name} on screen`).not.toBeNull();
    let named: (string | null)[] = [];
    let through: [number, number, number] | null = null;
    // the line of points up to the first that names the car; again if a hover read raced its pointer move
    const sweep = async () => {
      named = [];
      for (let dx = -RAISED.span; dx <= RAISED.span; dx += RAISED.step) {
        await page.mouse.move(car!.x + dx, car!.y);
        named.push((await state(page)).hover?.label ?? null);
        if (named.at(-1) === label) {
          through = await pick(page, car!.x + dx, car!.y);
          break;
        }
      }
      return named.includes(label);
    };
    // the glass is no item: where a ray passes between the louvres the car is what it meets, elsewhere the roof
    await expect
      .poll(sweep, { message: `the ${name} through the louvres`, timeout: 30_000 })
      .toBe(true);
    // and the point a zoom or a drag would take there is on the car, under the glass sheet (the roof is 2.75 m up)
    expect(through, `the scene through the louvres over the ${name}`).not.toBeNull();
    expect(through![1], `the point under the cursor over the ${name}`).toBeLessThan(2.4);
  }
  expect(errors).toEqual([]);
});

// 34 m off the dog house (zoomed with the cursor on it), turned round to the east and lowered, the dog's corner stands
// in the lower right of the view: the Akita on its mat by the dog house, a few metres beyond the carport.
const DOG_VIEW = { distance: 34, drag: { x: -125, y: -60 } };

test('a click on the Akita plays its happy clip once: its head turns and comes back to rest, and nothing toggles', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await zoomTo(page, DOG_VIEW.distance, KENNEL_AT);
  await turnRoundTarget(page, DOG_VIEW.drag.x, DOG_VIEW.drag.y);
  await frames(page, 4);
  const dog = await at(page, 'Akita');
  expect(dog, 'the Akita on screen').not.toBeNull();
  await page.mouse.move(dog!.x, dog!.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Bé Akita');
  await expect(page.getByTestId('hover-label')).toContainText('Bấm để chơi với bé');
  const rest = await rotation(page, 'Akita_head');
  expect(rest, 'the head on the scene').not.toBeNull();
  await frames(page, 10);
  expect(angle(rest!, (await rotation(page, 'Akita_head'))!)).toBeLessThan(0.5); // no clip moves it before a click

  await page.mouse.click(dog!.x, dog!.y);
  const turned = async () => angle(rest!, (await rotation(page, 'Akita_head'))!);
  await expect.poll(turned, { timeout: 15_000, intervals: [50] }).toBeGreaterThan(8); // tilted and turned (25 degrees)
  await expect.poll(turned, { timeout: 30_000 }).toBeLessThan(0.5); // and back, the clip played once
  const found = await page.evaluate(() =>
    (
      window as { __interact?: { state(): { plays?: unknown; toggles: unknown } } }
    ).__interact?.state(),
  );
  expect(found?.plays).toEqual({ dog: 1 });
  expect(found?.toggles).toEqual({});
  expect(errors).toEqual([]);
});

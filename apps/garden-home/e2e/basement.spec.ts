import { expect, type Page, test } from '@playwright/test';
import {
  boxColor,
  brightFraction,
  camera,
  collectErrors,
  frames,
  meanDifference,
  project,
  type Region,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

// The basement (villa v2 spec §12 "Basement") and the floor buttons (interaction spec §2): each test turns the camera,
// zooms and waits for it, a minute or two on SwiftShader, longer under load.
test.describe.configure({ timeout: 240_000 });

/** The karaoke lounge's middle and its TV's screen in world space (glTF, Y up): module (6.65, 3.65) and (10.95, 3.6), the
 * screen 1 m over the floor (-3.6 m), in the slot at (-1.5, 9.5). */
const KARAOKE = [5.15, -3.6, -13.15] as const;
const KARAOKE_TV = [9.45, -2.6, -13.1] as const;
/** The tall house's focus, the middle of its footprint on the ground (glTF): its slot (-1.5, 9.5). */
const HOUSE_FOCUS = [-1.5, 0, -9.5] as const;
/** Objects of the basement the website draws only under its cut; ones it draws always (the stair under its hole, the
 * light well and its palm); and ones under the lawn it draws where the light well's top or the stair's hole shows them
 * (cutaway.ts showThroughOpenings: the spa behind the light well's glass, the walls round it, the hall's floor). */
const BURIED = ['Basement_rooms', 'Karaoke_party', 'LED_party', 'Glass_cellar', 'Switch_karaoke'];
const SHOWN = ['Stair_basement', 'Light_well', 'Light_well_plants'];
const THROUGH = ['Spa', 'Hot_tub', 'Basement_walls', 'Basement_floor'];
/** Of those, the ones the light well's top shows from the site's first view and from the wallpaper camera. */
const WELL_SIDES = ['Basement_walls', 'Basement_floor'];
/** A node of the tall house's roof, over the upper floor's cut: drawn only while the house is whole. */
const ROOF = 'Trellis';

/**
 * Keeps what three announces to window.__THREE_DEVTOOLS__: the scenes (to read which nodes are drawn), the renderer and
 * the camera of the last frame it drew (window.__drawnCamera, to find the light well on the wallpaper).
 */
async function watchThree(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Renderer = { isWebGLRenderer?: boolean; render(scene: unknown, camera: unknown): void };
    const hook = new EventTarget();
    hook.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail;
      const page = window as unknown as {
        __scenes?: unknown[];
        __drawnCamera?: unknown;
        __renderer?: unknown;
      };
      if (detail?.isScene) (page.__scenes ??= []).push(detail);
      if (detail?.info) page.__renderer = detail;
      if ((detail as Renderer)?.isWebGLRenderer) {
        const renderer = detail as Renderer;
        const render = renderer.render;
        renderer.render = function (scene, camera) {
          page.__drawnCamera = camera;
          (page as { __onRender?: () => void }).__onRender?.(); // a test's per-frame record
          return render.call(this, scene, camera);
        };
      }
    });
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
  });
}

/** Of the glTF nodes `names`, those the renderer draws: a mesh of theirs on the camera's layer (0), visible all the way up. */
async function drawn(page: Page, names: readonly string[]): Promise<string[]> {
  return page.evaluate(
    (wanted) => {
      type Node = {
        userData: { name?: string };
        isMesh?: boolean;
        visible: boolean;
        parent: Node | null;
        layers: { mask: number };
        traverse(f: (o: Node) => void): void;
      };
      const seen = (node: Node) => {
        if ((node.layers.mask & 1) === 0) return false;
        for (let n: Node | null = node; n; n = n.parent) if (!n.visible) return false;
        return true;
      };
      const found = new Set<string>();
      for (const scene of (window as unknown as { __scenes?: Node[] }).__scenes ?? []) {
        scene.traverse((object) => {
          const name = object.userData.name ?? '';
          if (!wanted.includes(name)) return;
          object.traverse((part) => {
            if (part.isMesh && seen(part)) found.add(name);
          });
        });
      }
      return wanted.filter((name) => found.has(name));
    },
    [...names],
  );
}

/**
 * The box the glTF node `name` covers on the canvas, in shares of its width and height, as the last frame's camera saw
 * it, or null (carport.spec.ts does the same for the carport).
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

/** The floor button labelled `label`. */
const floorButton = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Floors' }).getByRole('button', { name: label, exact: true });

/**
 * Picks a floor button and waits for the cut to follow it (a frame to read it, a React effect to apply it) and for the
 * camera to stop, should the button ease it to the house.
 */
async function pickFloor(page: Page, label: string): Promise<void> {
  await floorButton(page, label).click();
  await frames(page, 6);
  await settle(page);
}

/** The camera's angle down onto the house focus (degrees), its distance from it and its azimuth round it. */
function overHouse(state: { position: readonly number[] }): {
  down: number;
  distance: number;
  azimuth: number;
} {
  const [dx, dy, dz] = [0, 1, 2].map((k) => state.position[k] - HOUSE_FOCUS[k]);
  const distance = Math.hypot(dx, dy, dz);
  return {
    down: (Math.asin(dy / distance) * 180) / Math.PI,
    distance,
    azimuth: Math.atan2(dx, dz),
  };
}

/** Looks down at the house steeply: a drag from the middle of the view tips the camera up over its target. */
async function lookDown(page: Page, dy: number): Promise<void> {
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 400 + dy, { steps: 10 });
  await page.mouse.up();
  await settle(page);
}

/** Mean difference (0..255 a channel) between two screenshots over a region (shares of the frame). */
function regionDifference(
  a: Buffer,
  b: Buffer,
  region: Region,
  width: number,
  height: number,
): number {
  const [x, y] = [((region.x0 + region.x1) / 2) * width, ((region.y0 + region.y1) / 2) * height];
  const [w, h] = [(region.x1 - region.x0) * width, (region.y1 - region.y0) * height];
  const one = boxColor(a, x, y, w, h);
  const two = boxColor(b, x, y, w, h);
  return Math.abs(one[0] - two[0]) + Math.abs(one[1] - two[1]) + Math.abs(one[2] - two[2]);
}

test('the floor buttons hold a level of the cut whatever the distance, and Auto gives it back to the distance', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await expect(page.getByRole('group', { name: 'Floors' }).getByRole('button')).toHaveText([
    'Auto',
    'Roof',
    'Upper floor',
    'Ground floor',
    'Basement',
  ]);
  await expect(floorButton(page, 'Auto')).toHaveAttribute('aria-pressed', 'true');
  await lookDown(page, 80); // well down onto the house, so no clearance holds the camera and only the cut changes the view
  await zoomTo(page, 44);
  await settle(page);
  await frames(page, 4);
  const canvas = page.locator('canvas');
  const start = await camera(page);
  expect(start.cut).toBe('none'); // 44 m out: auto shows the whole house
  expect(overHouse(start).down).toBeGreaterThan(36); // near enough and steep enough that no button moves the camera
  const whole = await canvas.screenshot();
  const shots: Record<string, Buffer> = {};
  for (const [label, cut] of [
    ['Upper floor', 'upper'],
    ['Ground floor', 'ground'],
    ['Basement', 'basement'],
    ['Roof', 'none'],
  ] as const) {
    await pickFloor(page, label);
    const state = await camera(page);
    expect(state.cut, label).toBe(cut);
    expect(state.mode, label).toBe(cut);
    for (const other of ['Auto', 'Roof', 'Upper floor', 'Ground floor', 'Basement']) {
      await expect(floorButton(page, other)).toHaveAttribute(
        'aria-pressed',
        String(other === label),
      );
    }
    expect(Math.hypot(...state.position.map((v, k) => v - start.position[k])), label).toBeLessThan(
      0.01,
    );
    shots[label] = await canvas.screenshot();
  }
  expect(meanDifference(whole, shots['Upper floor'])).toBeGreaterThan(2); // the roof goes
  expect(meanDifference(shots['Upper floor'], shots['Ground floor'])).toBeGreaterThan(2); // the upper floor goes
  expect(meanDifference(shots['Ground floor'], shots['Basement'])).toBeGreaterThan(2); // the house goes, the basement shows
  expect(meanDifference(whole, shots['Roof'])).toBeLessThan(3); // the whole house again, up to the water and the palms
  await pickFloor(page, 'Auto');
  expect((await camera(page)).cut).toBe('none');
  await zoomTo(page, 24); // and the distance cuts it again
  await settle(page);
  await frames(page, 4);
  expect((await camera(page)).cut).toBe('ground');
  expect(errors).toEqual([]);
});

test('"Basement" takes the house away and shows the basement\'s rooms from above', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await lookDown(page, 300); // straight down
  await zoomTo(page, 40);
  await settle(page);
  await frames(page, 4);
  expect((await camera(page)).cut).toBe('upper');
  expect(await drawn(page, BURIED)).toEqual([]); // under the plinth: not drawn while the cut is the house's
  expect(await drawn(page, SHOWN)).toEqual(SHOWN);
  // straight down over the house, the light well's sides hide what lies under the plinth behind its glass
  expect(await drawn(page, ['Spa', 'Hot_tub'])).toEqual([]);
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();
  await pickFloor(page, 'Basement');
  expect((await camera(page)).cut).toBe('basement');
  expect(await drawn(page, BURIED)).toEqual(BURIED);
  expect(await drawn(page, THROUGH)).toEqual(THROUGH); // the pit open to the sky
  expect(await drawn(page, ['Walls_white', 'Sofa', 'Plinth', 'Stair'])).toEqual([]); // the house, cut away whole
  await frames(page, 4);
  const after = await canvas.screenshot();
  // where the house stood the basement's rooms show now: round the house focus, which the zoom kept in the middle
  // (from 40 m straight down the footprint fills the view, its corners off screen)
  const { width, height } = (await canvas.boundingBox())!;
  const focus = (await project(page, HOUSE_FOCUS))!;
  const house: Region = {
    x0: (focus.x - 300) / width,
    x1: (focus.x + 300) / width,
    y0: (focus.y - 200) / height,
    y1: (focus.y + 200) / height,
  };
  expect(
    regionDifference(before, after, house, width, height),
    JSON.stringify(house),
  ).toBeGreaterThan(20);
  expect(meanDifference(before, after)).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

/**
 * How much more the karaoke lounge's colour (summed over the channels, 0..765) changes than between two shots with
 * nothing on (measured 0), at the least: when the party starts (measured 62 to 76 over six runs) and at most over half
 * of its turn through the hues (PARTY_PERIOD 6 s, sampled each second: 23 to 32; one shot 2 s on gave 4 to 34, by where
 * in the turn it started): under half of the lowest, a twofold margin.
 */
const PARTY_LIT = 30;
const PARTY_TURN = 10;

test("a click on the karaoke's TV starts the party: its LEDs light and turn through the colours", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=21:00');
  await waitForScene(page);
  await pickFloor(page, 'Basement');
  await lookDown(page, 300);
  await zoomTo(page, 18, KARAOKE);
  await settle(page);
  const canvas = page.locator('canvas');
  const { width, height } = (await canvas.boundingBox())!;
  const middle = (await project(page, KARAOKE))!;
  const lounge: Region = {
    x0: (middle.x - 250) / width,
    x1: (middle.x + 250) / width,
    y0: (middle.y - 200) / height,
    y1: (middle.y + 200) / height,
  };
  const tv = (await project(page, KARAOKE_TV))!;
  await page.mouse.move(tv.x, tv.y);
  await frames(page, 4);
  const hover = await page.evaluate(
    () =>
      (
        window as unknown as {
          __interact: { state(): { hover: { group: string; label: string } | null } };
        }
      ).__interact.state().hover,
  );
  expect(hover).toEqual(expect.objectContaining({ group: 'party', label: 'Party mode' }));
  await page.mouse.move(1279, 1); // off the scene: no hover frame in the shots
  await frames(page, 4);
  const off = await canvas.screenshot();
  await page.waitForTimeout(2000);
  await frames(page, 4);
  const stillOff = await canvas.screenshot();
  await page.mouse.click(tv.x, tv.y);
  await page.mouse.move(1279, 1);
  await frames(page, 6);
  const toggles = await page.evaluate(
    () =>
      (
        window as unknown as { __interact: { state(): { toggles: Record<string, string> } } }
      ).__interact.state().toggles,
  );
  expect(toggles.party).toBe('on');
  const on = await canvas.screenshot();
  // the most the lounge's colour moves from there over half the LEDs' turn through the hues, a second at a time: how much
  // one stretch of the turn shows depends on where in it it starts
  let turned = 0;
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(1000);
    await frames(page, 4);
    turned = Math.max(
      turned,
      regionDifference(on, await canvas.screenshot(), lounge, width, height),
    );
  }
  const quiet = regionDifference(off, stillOff, lounge, width, height);
  const lit = regionDifference(off, on, lounge, width, height);
  console.log(
    `party: quiet ${quiet.toFixed(1)}, lights on ${lit.toFixed(1)}, colour turned ${turned.toFixed(1)}`,
  );
  expect(lit).toBeGreaterThan(quiet + PARTY_LIT); // the lights come on
  expect(turned).toBeGreaterThan(quiet + PARTY_TURN); // and change colour
  expect(errors).toEqual([]);
});

test('the wallpaper has no floor buttons, cuts nothing and draws of the basement only what the light well shows', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  await expect(page.getByTestId('floor-selector')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __camera?: unknown }).__camera)).toBeUndefined();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __renderer?: { localClippingEnabled: boolean } }).__renderer
          ?.localClippingEnabled,
    ),
  ).toBe(false);
  expect(await drawn(page, BURIED)).toEqual([]);
  expect(await drawn(page, SHOWN)).toEqual(SHOWN);
  // the spa behind the light well's glass shows, its hot tub low behind it does not; and the walls round the well and
  // the floor under it, through its top
  expect(await drawn(page, ['Spa', 'Hot_tub'])).toEqual(['Spa']);
  expect(await drawn(page, WELL_SIDES)).toEqual(WELL_SIDES);
  expect(errors).toEqual([]);
});

/**
 * How much the light well's middle on the wallpaper differs from the lawn just in front of it (the box under it), mean
 * over the channels (0..255), at the least: measured 12.0 at 12:00 (the pale travertine and the palm in the green), so
 * half of that; and how much more of it glows at night than of the lawn, as a share of pixels over luma 110: measured
 * 0.15 against the lawn's 0.02 at 21:00 (the strips round its rim and the light they wash its walls with).
 */
const WELL_CHANGE = 6;
const WELL_GLOW = 0.05;

test('the light well shows from the wallpaper camera by day and glows at night', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  for (const time of ['12:00', '21:00'] as const) {
    await page.goto(`/wallpaper?t=${time}&bg=example.jpg`);
    await waitForScene(page);
    await frames(page, 6);
    const canvas = page.locator('canvas');
    const box = await onScreen(page, 'Light_well');
    expect(box, 'the light well on the wallpaper').not.toBeNull();
    const { width, height } = (await canvas.boundingBox())!;
    const { x0, x1, y0, y1 } = box!;
    const shot = await canvas.screenshot();
    const span = y1 - y0;
    const well: Region = {
      x0: x0 + (x1 - x0) * 0.25,
      x1: x1 - (x1 - x0) * 0.25,
      y0: y0 + span * 0.25,
      y1: y1 - span * 0.25,
    };
    const lawn: Region = { ...well, y0: y1 + span * 0.2, y1: y1 + span * 0.7 };
    if (time === '12:00') {
      const at = (r: Region) =>
        boxColor(
          shot,
          ((r.x0 + r.x1) / 2) * width,
          ((r.y0 + r.y1) / 2) * height,
          (r.x1 - r.x0) * width,
          (r.y1 - r.y0) * height,
        );
      const [a, b] = [at(well), at(lawn)];
      const change = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / 3;
      expect(change, `the light well ${a} over the lawn ${b}`).toBeGreaterThan(WELL_CHANGE);
    } else {
      await expect
        .poll(
          async () => {
            const night = await canvas.screenshot();
            return (
              brightFraction(night, 110, { x0, x1, y0, y1 }) - brightFraction(night, 110, lawn)
            );
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(WELL_GLOW);
    }
  }
  expect(errors).toEqual([]);
});

test('"Basement" from the site\'s first view eases the camera to the house, where the basement\'s rooms fill the view', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  const first = overHouse(await camera(page));
  expect(first.distance).toBeGreaterThan(100); // 124 m out, 13.8 degrees down: the basement would be a pit
  expect(first.down).toBeLessThan(20);
  // the house whole, the basement under the lawn: through the light well's top, the walls round it and the floor under it
  expect((await camera(page)).cut).toBe('none');
  expect(await drawn(page, WELL_SIDES)).toEqual(WELL_SIDES);
  await page.mouse.move(1279, 1);
  await floorButton(page, 'Basement').click();
  await frames(page, 2);
  expect((await camera(page)).easing).toBe(true); // it moves over a few frames
  await settle(page);
  const state = await camera(page);
  expect([state.easing, state.cut]).toEqual([false, 'basement']);
  const now = overHouse(state);
  expect(Math.abs(now.distance - 35)).toBeLessThan(0.5); // FLOOR_VIEW: 35 m from the house focus, 55 degrees down
  expect(Math.abs(now.down - 55)).toBeLessThan(1);
  expect(Math.abs(now.azimuth - first.azimuth)).toBeLessThan(0.01); // from the side it looked from
  // the inner part of the footprint (16 x 10 of its 23 x 15 m) spans most of the view
  const canvas = page.locator('canvas');
  const { width, height } = (await canvas.boundingBox())!;
  const [fx, fy, fz] = HOUSE_FOCUS;
  const corners = await Promise.all(
    [
      [-8, -5],
      [8, -5],
      [8, 5],
      [-8, 5],
    ].map(([dx, dz]) => project(page, [fx + dx, fy, fz + dz])),
  );
  expect(
    corners.every((corner) => corner !== null),
    JSON.stringify(corners),
  ).toBe(true);
  const xs = corners.map((c) => c!.x / width);
  const ys = corners.map((c) => c!.y / height);
  const rooms: Region = {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
  expect((rooms.x1 - rooms.x0) * (rooms.y1 - rooms.y0), JSON.stringify(rooms)).toBeGreaterThan(0.3);
  const basement = await canvas.screenshot();
  // "Roof" from there leaves the camera where it is: the house stands where the rooms showed
  await pickFloor(page, 'Roof');
  const roofed = await camera(page);
  expect(Math.hypot(...roofed.position.map((v, k) => v - state.position[k]))).toBeLessThan(0.01);
  const whole = await canvas.screenshot();
  expect(regionDifference(basement, whole, rooms, width, height)).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('"Basement" pressed again once the camera has left the house eases it back, though the button is on already', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await pickFloor(page, 'Basement');
  expect(Math.abs(overHouse(await camera(page)).distance - 35)).toBeLessThan(0.5);
  await zoomTo(page, 60); // past FLOOR_VIEW.far (45 m): from here a floor button eases the camera to the house
  await settle(page);
  const away = await camera(page);
  expect([away.cut, away.mode]).toEqual(['basement', 'basement']);
  expect(overHouse(away).distance).toBeGreaterThan(45);
  await page.mouse.move(1279, 1);
  await floorButton(page, 'Basement').click();
  await frames(page, 2);
  expect((await camera(page)).easing).toBe(true);
  await settle(page);
  const back = overHouse(await camera(page));
  expect(Math.abs(back.distance - 35)).toBeLessThan(0.5);
  expect(Math.abs(back.down - 55)).toBeLessThan(1);
  await expect(floorButton(page, 'Basement')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('leaving a low "Basement" view for "Ground floor", "Upper floor" and "Auto" never brings the whole house back in between', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await pickFloor(page, 'Basement');
  await zoomTo(page, 20);
  await settle(page);
  // a drag up tips the camera towards the horizon until the clearance holds it: low over the pit
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 100, { steps: 10 });
  await page.mouse.up();
  await settle(page);
  const low = await camera(page);
  expect(low.cut).toBe('basement');
  expect(low.position[1] - HOUSE_FOCUS[1]).toBeLessThan(8);
  expect(low.position[1] - HOUSE_FOCUS[1]).toBeGreaterThan(5.5 - 0.01); // the ground floor cut's camera floor, 5.55 m
  // from here on, for every frame drawn: the cut the camera calls for, whether the roof is drawn, where the camera is
  await page.evaluate((roof) => {
    type Node = {
      userData: { name?: string };
      isMesh?: boolean;
      visible: boolean;
      parent: Node | null;
      layers: { mask: number };
      traverse(f: (o: Node) => void): void;
    };
    const w = window as unknown as {
      __scenes?: Node[];
      __records?: { cut?: string; roof: boolean; position?: number[] }[];
      __onRender?: () => void;
      __camera?: () => { cut: string; position: number[] };
    };
    const meshes: Node[] = [];
    for (const scene of w.__scenes ?? [])
      scene.traverse(
        (o) => o.userData.name === roof && o.traverse((m) => m.isMesh && meshes.push(m)),
      );
    const drawnNow = (m: Node) => {
      if ((m.layers.mask & 1) === 0) return false;
      for (let n: Node | null = m; n; n = n.parent) if (!n.visible) return false;
      return true;
    };
    w.__records = [];
    w.__onRender = () => {
      const state = w.__camera?.();
      w.__records!.push({
        cut: state?.cut,
        roof: meshes.some(drawnNow),
        position: state?.position,
      });
    };
  }, ROOF);
  for (const [label, cut] of [
    ['Ground floor', 'ground'],
    ['Upper floor', 'upper'],
    ['Auto', null],
  ] as const) {
    await pickFloor(page, label);
    await frames(page, 4);
    if (cut) expect((await camera(page)).cut, label).toBe(cut);
  }
  const records = await page.evaluate(
    () =>
      (window as unknown as { __records: { cut: string; roof: boolean; position: number[] }[] })
        .__records,
  );
  expect(records.length).toBeGreaterThan(20);
  expect(records.filter((record) => record.cut === 'none').length).toBe(0); // never the whole house in between
  expect(records.filter((record) => record.roof).length).toBe(0); // no frame with its roof
  let step = 0;
  for (let i = 1; i < records.length; i++)
    step = Math.max(
      step,
      Math.hypot(...records[i].position.map((v, k) => v - records[i - 1].position[k])),
    );
  expect(step).toBeLessThan(4); // eased, never a jump
  expect(errors).toEqual([]);
});

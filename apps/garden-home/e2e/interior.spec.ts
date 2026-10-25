import { expect, type Page, test } from '@playwright/test';
import { camera, collectErrors, frames, settle, waitForScene, zoomTo } from './helpers';

// The interior (villa v2 spec §12 "Rèm và phụ kiện"): the house's curtains and accessories, a module of its own in the
// house's slot, which the dollhouse cut cuts with the house. Each test waits on floor buttons, a minute or two on
// SwiftShader under load.
test.describe.configure({ timeout: 240_000 });

/** The interior's static decor (curtains, chairs, trees, buffets, merged), its small things, and a lamp object upstairs. */
const DECOR = 'Interior_decor';
const DETAILS = 'Interior_details';
const LAMP_UPSTAIRS = 'LT_lamp_bedroom2';
const LAMPS = ['LT_lamp_dining', 'LT_lamp_bedroom2', 'LT_lamp_bedroom3'];
/** A node of the house cut at every level: its white walls, both storeys. */
const HOUSE_WALLS = 'Walls_white';

/** Keeps the scenes three announces to window.__THREE_DEVTOOLS__, to read what the renderer draws and how it clips. */
async function watchThree(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const hook = new EventTarget();
    hook.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail;
      const w = window as unknown as { __scenes?: unknown[]; __renderer?: unknown };
      if (detail?.isScene) (w.__scenes ??= []).push(detail);
      if (detail?.info) w.__renderer = detail;
    });
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
  });
}

interface Look {
  /** Whether a mesh of the node is on the camera's layer (0), visible all the way up. */
  drawn: boolean;
  /** The world heights its materials' clipping planes keep what lies under (normal (0, -1, 0)), none when unclipped. */
  planes: number[];
  /** The emissive intensity of its first material (the night factor on a night light). */
  glow: number;
}

/** How the renderer treats the glTF nodes `names` (Look). */
async function look(page: Page, names: readonly string[]): Promise<Record<string, Look>> {
  return page.evaluate(
    (wanted) => {
      type Plane = { normal: { y: number }; constant: number };
      type Material = { clippingPlanes?: Plane[] | null; emissiveIntensity?: number };
      type Node = {
        userData: { name?: string };
        isMesh?: boolean;
        visible: boolean;
        parent: Node | null;
        layers: { mask: number };
        material?: Material | Material[];
        traverse(f: (o: Node) => void): void;
      };
      const seen = (node: Node) => {
        if ((node.layers.mask & 1) === 0) return false;
        for (let n: Node | null = node; n; n = n.parent) if (!n.visible) return false;
        return true;
      };
      const found: Record<string, { drawn: boolean; planes: number[]; glow: number }> = {};
      for (const scene of (window as unknown as { __scenes?: Node[] }).__scenes ?? []) {
        scene.traverse((object) => {
          const name = object.userData.name ?? '';
          if (!wanted.includes(name)) return;
          object.traverse((part) => {
            if (!part.isMesh) return;
            const materials = (
              Array.isArray(part.material) ? part.material : [part.material!]
            ) as Material[];
            const entry = (found[name] ??= { drawn: false, planes: [], glow: 0 });
            entry.drawn ||= seen(part);
            for (const material of materials) {
              for (const plane of material.clippingPlanes ?? []) {
                if (plane.normal.y < 0 && !entry.planes.includes(plane.constant))
                  entry.planes.push(plane.constant);
              }
            }
            entry.glow = Math.max(entry.glow, materials[0].emissiveIntensity ?? 0);
          });
        });
      }
      return found;
    },
    [...names],
  );
}

/** The floor button labelled `label`, clicked, and the cut and the camera given time to follow it. */
async function pickFloor(page: Page, label: string): Promise<void> {
  await page
    .getByRole('group', { name: 'Xem tầng' })
    .getByRole('button', { name: label, exact: true })
    .click();
  await frames(page, 6);
  await settle(page);
  await frames(page, 4);
}

test('the interior is cut with the house: its decor at the storey\'s cut, hidden with the house under "Hầm"', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  const whole = await look(page, [DECOR, DETAILS, LAMP_UPSTAIRS, HOUSE_WALLS]);
  expect(whole[DECOR].drawn).toBe(true);
  expect(whole[DETAILS].drawn).toBe(false); // a pixel or two from afar: drawn only near the house
  expect(whole[LAMP_UPSTAIRS].drawn).toBe(true);
  // like the house, it keeps its clipping plane on the site route, far above it while it is whole
  expect(whole[DECOR].planes.length).toBe(1);
  expect(whole[DECOR].planes[0]).toBeGreaterThan(1000);

  await pickFloor(page, 'Tầng 1');
  const ground = await look(page, [DECOR, DETAILS, LAMP_UPSTAIRS, HOUSE_WALLS]);
  expect(ground[DECOR].drawn).toBe(true);
  expect(ground[DETAILS].drawn).toBe(true);
  expect(ground[DETAILS].planes).toEqual(ground[HOUSE_WALLS].planes);
  // the same plane as the house's walls, 1.6 m over the ground floor
  expect(ground[DECOR].planes).toEqual(ground[HOUSE_WALLS].planes);
  expect(ground[DECOR].planes.length).toBe(1);
  expect(ground[LAMP_UPSTAIRS].drawn).toBe(false); // a bedroom's lamps, wholly over the cut

  await pickFloor(page, 'Tầng 2');
  const upper = await look(page, [DECOR, LAMP_UPSTAIRS, HOUSE_WALLS]);
  expect(upper[DECOR].planes).toEqual(upper[HOUSE_WALLS].planes);
  // 1.6 m over the upper floor: a storey (5.26 - 0.45 m) over the ground floor's cut
  expect(upper[DECOR].planes[0] - ground[DECOR].planes[0]).toBeCloseTo(4.81, 2);
  expect(upper[LAMP_UPSTAIRS].drawn).toBe(true); // on its nightstand, under the upper floor's cut

  await pickFloor(page, 'Hầm');
  const basement = await look(page, [DECOR, DETAILS, LAMP_UPSTAIRS, HOUSE_WALLS]);
  expect(basement[HOUSE_WALLS].drawn).toBe(false);
  expect(basement[DECOR].drawn).toBe(false);
  expect(basement[DETAILS].drawn).toBe(false);
  expect(basement[LAMP_UPSTAIRS].drawn).toBe(false);

  await pickFloor(page, 'Tự động');
  expect(errors).toEqual([]);
});

test('near the house its small things show with the house whole ("Mái" at 20 m), and go again from afar', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await pickFloor(page, 'Mái'); // from the site's first view the camera stays where it is, 110 m out
  expect((await camera(page)).near).toBe(false);
  expect((await look(page, [DETAILS]))[DETAILS].drawn).toBe(false);

  await zoomTo(page, 20); // onto the house focus: through the living room's and the dining room's glass
  await settle(page);
  await frames(page, 4);
  const state = await camera(page);
  expect([state.cut, state.near]).toEqual(['none', true]);
  const near = await look(page, [DECOR, DETAILS, HOUSE_WALLS]);
  expect(near[HOUSE_WALLS].drawn).toBe(true); // the house whole
  expect(near[DECOR].drawn).toBe(true);
  expect(near[DETAILS].drawn).toBe(true); // the table laid, the sofa's cushions, the books

  await zoomTo(page, 60);
  await settle(page);
  await frames(page, 4);
  expect((await camera(page)).near).toBe(false);
  expect((await look(page, [DETAILS]))[DETAILS].drawn).toBe(false);
  await pickFloor(page, 'Tự động');
  expect(errors).toEqual([]);
});

test('on the wallpaper the interior shows whole through the glass and its lamps glow only at night', async ({
  page,
}) => {
  await watchThree(page);
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  await frames(page, 4);
  const day = await look(page, [DECOR, DETAILS, ...LAMPS]);
  expect(day[DECOR].drawn).toBe(true);
  expect(day[DETAILS].drawn).toBe(false);
  expect(day[DECOR].planes).toEqual([]); // the wallpaper cuts nothing
  for (const lamp of LAMPS) expect(day[lamp].glow, lamp).toBe(0);

  await page.goto('/wallpaper?t=21:00');
  await waitForScene(page);
  await frames(page, 4);
  const night = await look(page, LAMPS);
  for (const lamp of LAMPS) expect(night[lamp].glow, lamp).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

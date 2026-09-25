# Holodex legacy glare ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the by-eye glare of each of the 22 effects derived from pokemon-cards-css with a port of its CSS, painted beneath the shine.

**Architecture:** Each effect's `glare` becomes `[]` and its `beneath` one element built with `effects/css.ts` (`radial`, `stop`, `hsl`, `filterRGB`, `neutralBefore`) from the rules the tables below copy out of the reference. A new `effects/legacy-glare.ts` holds what the 22 share (base.css's radial, the neutral a transparent glare folds toward, and source-over for reverse-holo's normal-blended `:after`). The DSL gains a layer opacity for cosmos-holo's fading `:after`.

**Tech Stack:** TypeScript (strict), the holo effect DSL (`holo/shader/types.ts`), GLSL codegen (`holo/shader/compile.ts`), Vitest under node, Playwright 1.58 (headless Chromium) for the comparison.

**Spec:** `docs/superpowers/specs/2026-09-25-holodex-legacy-glare-ports-design.md`

**Executed 2026-09-25**: `e091908` (layer opacity), `2aafa5a`, `c419ed3`, `605217a`,
`f93a51f` (the 22 glares), and the docs after them. What running it showed:

- **The glares match.** Compared glare only (the shine hidden on both sides) against a floor with
  the glare hidden too, across the six samples: floor 2.40, glare-only 3.09. Five sit within the
  floor; cosmos-holo 3 to 6 over it (its `:after` meets a pre-folded radial; noted in its file).
- **The whole-card gap** fell from 18.80 to 15.90, led by regular-holo (36.6 → 8.8), v-regular
  (27.6 → 11.2) and shiny-v (9.4 → 1.2). It grew for secret-rare (to ~30) and radiant-holo (~23),
  whose by-eye shines work over the now-correct glare differently from the reference's; a shine
  re-port is what would close that. The whole-card metric is luminance only, blind to saturation.
- **Two refuted hypotheses** along the way, each measured: baking the element filter into the
  stops (for CSS's per-pixel clamp) took the glare-only gap from ~3 to ~11, so the shader's
  element filter, run per fragment, is the faithful place for it; and filtering cosmos's `:after`
  per dense sample instead of per stop left its gap where it was.
- **`basic`'s port changes nothing a visitor sees**: `HoloCard` draws no scene for a `basic` card,
  so Commons and Uncommons stay plain art; it shows only as the fallback material. Whether they
  should get base.css's glare, as pokemon-cards-css gives every card, is a product call (a WebGL
  context on every plain card).
- The harness needed two fixes: a Playwright locator by `data-rarity` re-queries after the
  attribute changes, so the card is addressed by a mark; and every card on the reference is
  `.masked`, so it is unmasked and re-typed (AGENTS.md).
- The GPU smoke on `/effects` stalled on TCGdex throttling (tiles left loading), and a
  `getContext('webgl2')` check proves nothing (it creates a context); the scene's own active state
  (canvas shown, art `invisible`) was checked instead, on each effect's card page: all 21 that draw
  a scene are live.

## Global Constraints

- Branch `feat/holodex-holo-v2`. Commit locally only: **never `git push`**, never open a PR.
- Stage by explicit path (`git add -- <paths>`); never `git add -A`; never stage `.claude/launch.json`.
- Commit bodies wrapped under 100 characters a line (commitlint), through `git commit -F <file>`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never touch the owner's dev servers (1337, 9000–9007, 9106). The smoke server is `holodex-smoke` on 9107.
- **The shines of the 22 do not change**, and no Scarlet & Violet port changes.
- Test expectations are literals worked out by hand from the CSS, never values computed with `css.ts` or `legacy-glare.ts`.
- Pace TCGdex: no more than a request every 200 ms from scripts (it throttles bursts).

## Porting rules (every port follows them)

1. `glare: []`; `beneath: [<one element>]`.
2. **Layer 0** is `.card__glare`'s `background-image`, or base.css's (`BASE_GLARE`) when the rarity sets none: `{ ...radial(stops, box, glareNeutral(blend, filter)), blend: 'normal' }`, where `blend` is the element's blend and `filter` the element's filter, because the element's filter runs after the layers.
3. **Layer 1**, only where the rarity gives `:after` content: its radial with its own filter baked into each stop (`stop(filterRGB(c, AFTER), at, alpha)`), folded toward `grey(0.5)` for overlay / soft-light, and `blend` set to the `:after`'s `mix-blend-mode`. A pointer-driven `:after` opacity becomes the layer's `opacity`.
4. **Element**: `filter` = `.card__glare`'s filter as `{ brightness: { base }, contrast: { base }, saturate: { base } }` (only the functions the rule names); `opacity` = its `calc()` with `--card-opacity` dropped (the shader multiplies `uCardOpacity` itself), omitted when it is just `var(--card-opacity)`; `mixBlend` = its `mix-blend-mode`, else `'overlay'` (base.css).
5. **Box**: `COVER`, or `{ size: [w, h], position: [x, y] }` from `background-size` / `background-position`; a size with no position sits at `[fixed(0), fixed(0)]`.
6. **Stops**: an unpositioned first stop is 0%, an unpositioned last one 100%, and an unpositioned middle one sits midway between its neighbours. `hsla(0, 0%, L%, a)` is `grey(L / 100)` with alpha `a`; any other colour is `hsl(h, s, l)`.
7. Every file's header says what it no longer approximates and lists what it still does (the `:after` clips, masked-only rules dropped).

## The CSS, per effect

Filters are (brightness, contrast, saturate); `—` is none. Stops are `colour position [alpha]`.

| Effect                      | Layer 0 stops                                                      | Box                 | Element filter | Opacity            | Blend      | `:after`                                                                                    |
| --------------------------- | ------------------------------------------------------------------ | ------------------- | -------------- | ------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| basic                       | BASE_GLARE                                                         | cover               | —              | —                  | overlay    | —                                                                                           |
| regular-holo                | BASE_GLARE                                                         | cover               | .8, 1.5        | .8                 | overlay    | hsl(180,100%,95%) 5%, grey .39 55% a.25, black 110% a.36; filter .6, 3; overlay             |
| reverse-holo                | white 10% a.8, white 20% a.5, black 90% a.75                       | cover               | .7, 1.5        | —                  | overlay    | white 10%, white 20% a.5, black 120% a.5; filter 1, 1.5; **normal**                         |
| cosmos-holo                 | hsl(204,100%,95%) 5% a.8, hsl(250,15%,20%) 150%                    | cover               | .75, 2, 2      | .25 + 1·fromCenter | overlay    | hsl(280,100%,96%) 5%, grey .1 60%; filter .75, 2.5, 2; soft-light; opacity 1 − .75·fromTop  |
| amazing-rare                | white 10%, white 20% a.85, black 90% a.35                          | cover               | —              | —                  | multiply   | —                                                                                           |
| radiant-holo                | white 0% a.33, grey .25 110%                                       | cover               | 1, 1.5         | —                  | hard-light | —                                                                                           |
| rainbow-holo                | grey .8 0%, hsl(187,10%,85%) 30% a.25, hsl(197,6%,25%) 120%        | cover               | .9, 1.75       | .9·fromCenter      | hard-light | —                                                                                           |
| rainbow-alt                 | hsl(50,20%,90%) 0% a.75, hsl(150,20%,30%) 45% a.65, black 100%     | cover               | .9, 2          | .75                | overlay    | —                                                                                           |
| secret-rare                 | hsl(45,8%,80%) 0% a.3, hsl(22,15%,12%) 180%                        | cover               | 1.3, 1.5       | —                  | hard-light | —                                                                                           |
| shiny-rare                  | white 0%, hsl(320,5%,15%) 150%                                     | cover               | 1.2, 1, .7     | 1·fromCenter       | multiply   | —                                                                                           |
| shiny-v                     | grey .9 5%, hsl(200,5%,45%) 80%, hsl(320,40%,10%) 150%             | 120% × 140%, center | .88, 2.25, .7  | .75·fromCenter     | darken     | —                                                                                           |
| shiny-vmax                  | hsl(248,5%,90%) 0% a.45, hsl(206,5%,30%) 45% a.45, black 120% a.33 | cover               | 1, 1.25        | —                  | overlay    | hsl(248,5%,90%) 0% a.75, hsl(206,5%,30%) 45% a.65, black 100% a.75; filter 1, 1.25; overlay |
| swsh-pikachu                | grey .8 0%, grey .749 30% a.25, grey .216 130%                     | cover               | .9, 2          | .9·fromCenter      | hard-light | —                                                                                           |
| trainer-full-art            | BASE_GLARE                                                         | 170% × 170%, at 0 0 | 1.5, 1.4, 1    | .75                | multiply   | —                                                                                           |
| trainer-gallery-holo        | white 10%, white 35% a.6, hsl(180,11%,35%) 60%                     | cover               | —              | —                  | soft-light | — (`display: none`)                                                                         |
| trainer-gallery-secret-rare | hsl(40,100%,95%) 10% a.2, hsl(40,20%,5%) 180%                      | cover               | .5, 1          | —                  | hard-light | —                                                                                           |
| trainer-gallery-v-max       | hsl(50,30%,90%) 0%, hsl(162,5%,40%) 60%, black 120%                | cover               | 1, 1           | .85·fromCenter     | overlay    | —                                                                                           |
| trainer-gallery-v-regular   | BASE_GLARE                                                         | cover               | —              | .4                 | overlay    | —                                                                                           |
| v-full-art                  | grey .75 5%, hsl(200,5%,35%) 60%, hsl(320,40%,10%) 150%            | 120% × 150%, center | 1, 1.2, 1      | .75                | hard-light | —                                                                                           |
| v-max                       | white 0% a.75, black 120%                                          | cover               | 1, 1           | .2 + .8·fromCenter | hard-light | —                                                                                           |
| v-regular                   | white 0%, hsl(210,3%,54%) 45% a.33, grey .2 130% a.9               | cover               | .9, 1.75       | .5                 | hard-light | —                                                                                           |
| v-star                      | hsl(195,90%,90%) 5%, hsl(300,3%,60%) 60%, grey .15 150%            | cover               | .55, 2         | .75·fromCenter     | hard-light | —                                                                                           |

`BASE_GLARE` is base.css's: white 10% a.8, white 20% a.65, black 90% a.5. Sources: `rainbow-holo`, `swsh-pikachu` leave their first stop unpositioned (0%), `trainer-gallery-v-max` its middle one (midway, 60%); `v-star` and `trainer-gallery-secret-rare` take their `:not(.masked)` filter, which is more specific than the plain one; `amazing-rare` its `:not(.masked)` rule; `hsl(350, 0%, 15%)` is `grey(0.15)`.

---

### Task 1: The comparison harness, and the baseline it measures

**Files (scratch, not committed):** `$S/cmp/legacy/ours.mjs`, `$S/cmp/legacy/ref.mjs`, `$S/cmp/legacy/stats.mjs`, where `$S` is the session scratchpad (`/private/tmp/claude-502/-Users-mason-nguyencaominhanh-Mason-Workspace-ncam/e0870a3b-c2b4-4b99-bf0a-f22db85c397f/scratchpad`).

- [ ] **Step 1: Write `ours.mjs`** — for each sample, our card page on 9107 hovered at (0.3, 0.3) and (0.7, 0.7), springs settled by nudging, the HoloCard root screenshotted; records the art URL the page drew.

```js
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/mason.nguyencaominhanh/Mason_Workspace/ncam/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright');

export const SAMPLES = [
  ['regular-holo', 'hgss4-1'],
  ['cosmos-holo', 'sv10.5b-171'],
  ['radiant-holo', 'swsh10.5-004'],
  ['v-regular', 'xyp-XY84'],
  ['secret-rare', 'sm115-69'],
  ['shiny-v', 'swsh4.5sv-SV105'],
];
export const POINTS = [
  [0.3, 0.3],
  [0.7, 0.7],
];
const TAG = process.env.TAG ?? 'baseline';
const OUT = new URL(`./${TAG}/`, import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const art = {};
for (const [effect, id] of SAMPLES) {
  await page.goto(`http://127.0.0.1:9107/card/${id}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  const root = page.locator('span[data-effect]').first();
  await root.waitFor({ timeout: 30_000 });
  if ((await root.getAttribute('data-effect')) !== effect)
    throw new Error(`${id} is not ${effect}`);
  await page.waitForFunction(() => document.querySelector('span[data-effect] canvas'), null, {
    timeout: 30_000,
  });
  art[id] = await page.evaluate(() => document.querySelector('span[data-effect] img')?.currentSrc);
  const box = await root.boundingBox();
  for (const [px, py] of POINTS) {
    const [x, y] = [box.x + box.width * px, box.y + box.height * py];
    await page.mouse.move(x, y, { steps: 12 });
    for (let t = 0; t < 26; t += 1) {
      await page.mouse.move(x + (t % 2), y);
      await page.waitForTimeout(100);
    }
    await root.screenshot({ path: `${OUT}ours-${effect}-${px}-${py}.png` });
  }
  await page.mouse.move(2, 2);
}
await writeFile(`${OUT}art.json`, JSON.stringify(art, null, 1));
await browser.close();
```

- [ ] **Step 2: Write `ref.mjs`** — on poke-holo.simey.me, one card made to be each sample: unmasked, given the sample's rarity and our card's type, our art in its `<img>`, and its pointer variables pinned for each point with the reference's own tilt there.

```js
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { SAMPLES, POINTS } from './ours.mjs';
const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/mason.nguyencaominhanh/Mason_Workspace/ncam/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright');

// the reference's data-rarity for each of our effects, and the card's own type
const AS = {
  'regular-holo': { rarity: 'rare holo', subtypes: 'stage 2', supertype: 'pokémon' },
  'cosmos-holo': { rarity: 'rare holo cosmos', subtypes: 'basic', supertype: 'pokémon' },
  'radiant-holo': { rarity: 'radiant rare', subtypes: 'basic radiant', supertype: 'pokémon' },
  'v-regular': { rarity: 'rare holo v', subtypes: 'basic ex', supertype: 'pokémon' },
  'secret-rare': { rarity: 'rare secret', subtypes: 'basic tag team gx', supertype: 'pokémon' },
  'shiny-v': { rarity: 'rare shiny v', subtypes: 'basic v', supertype: 'pokémon' },
};
const TAG = process.env.TAG ?? 'baseline';
const OUT = new URL(`./${TAG}/`, import.meta.url).pathname;
const art = JSON.parse(await readFile(`${OUT}art.json`, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
await page.goto('https://poke-holo.simey.me/', { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForSelector('.card', { timeout: 30_000 });
await page.mouse.move(2, 2);
const card = page.locator('.card[data-rarity="rare holo"]').first();
await card.evaluate((el) => el.setAttribute('data-probe', ''));
for (const [effect, id] of SAMPLES) {
  const as = AS[effect];
  await card.evaluate(
    async (el, [as, src]) => {
      el.classList.remove('masked');
      Object.assign(el.dataset, {
        rarity: as.rarity,
        subtypes: as.subtypes,
        supertype: as.supertype,
      });
      const img = el.querySelector('.card__front img');
      img.removeAttribute('srcset');
      img.src = src;
      await img.decode();
    },
    [as, art[id]],
  );
  for (const [px, py] of POINTS) {
    const [x, y] = [px * 100, py * 100];
    const fromCenter = Math.min(1, Math.hypot(x - 50, y - 50) / 50);
    await page.evaluate(
      (css) => {
        let s = document.getElementById('pin');
        if (!s) {
          s = document.createElement('style');
          s.id = 'pin';
          document.head.append(s);
        }
        s.textContent = css;
      },
      `.card[data-probe] { --mask: none !important; --foil: none !important;
      --pointer-x: ${x}% !important; --pointer-y: ${y}% !important;
      --pointer-from-center: ${fromCenter} !important; --pointer-from-top: ${py} !important; --pointer-from-left: ${px} !important;
      --card-opacity: 1 !important; --card-scale: 1 !important; --translate-x: 0px !important; --translate-y: 0px !important;
      --rotate-x: ${Math.round(-(x - 50) / 3.5)}deg !important; --rotate-y: ${Math.round((y - 50) / 3.5)}deg !important;
      --background-x: ${37 + 0.26 * x}% !important; --background-y: ${33 + 0.34 * y}% !important; }`,
    );
    await page.waitForTimeout(500);
    await card
      .locator('.card__rotator')
      .screenshot({ path: `${OUT}ref-${effect}-${px}-${py}.png` });
  }
}
await browser.close();
```

- [ ] **Step 3: Write `stats.mjs`** — for each sample and point, luminance p10 / median / p97 of both captures over three regions (whole card, the art window rows 10–47%, the text box rows 55–90%), and the mean absolute gap between ours and the reference across those nine numbers.

```js
import { createRequire } from 'node:module';
import { SAMPLES, POINTS } from './ours.mjs';
const require = createRequire(import.meta.url);
const {
  chromium,
} = require('/Users/mason.nguyencaominhanh/Mason_Workspace/ncam/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright');
const TAG = process.env.TAG ?? 'baseline';
const DIR = new URL(`./${TAG}/`, import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const REGIONS = { card: [0, 1], art: [0.1, 0.47], text: [0.55, 0.9] };
const stats = (file) =>
  page.evaluate(
    async ([url, regions]) => {
      const img = await createImageBitmap(await (await fetch(url)).blob());
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const out = {};
      for (const [name, [top, bottom]] of Object.entries(regions)) {
        const lum = [];
        for (let y = Math.floor(top * img.height); y < Math.floor(bottom * img.height); y += 1)
          for (let x = Math.floor(0.06 * img.width); x < Math.floor(0.94 * img.width); x += 1) {
            const i = (y * img.width + x) * 4;
            if (d[i + 3] < 250) continue;
            lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
          }
        lum.sort((a, b) => a - b);
        const q = (p) => lum[Math.floor(p * (lum.length - 1))];
        out[name] = [q(0.1), q(0.5), q(0.97)];
      }
      return out;
    },
    [file, REGIONS],
  );
await page.goto('about:blank');
const rows = [];
for (const [effect] of SAMPLES)
  for (const [px, py] of POINTS) {
    const o = await stats(new URL(`ours-${effect}-${px}-${py}.png`, DIR).href);
    const r = await stats(new URL(`ref-${effect}-${px}-${py}.png`, DIR).href);
    const gaps = Object.keys(REGIONS).flatMap((k) => o[k].map((v, i) => Math.abs(v - r[k][i])));
    rows.push(
      `${effect} @${px},${py}: gap ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)}  ours ${JSON.stringify(o)}  ref ${JSON.stringify(r)}`,
    );
  }
console.log(rows.join('\n'));
await browser.close();
```

(`stats.mjs` reads the PNGs by `file://` URL: launch Chromium with `--allow-file-access-from-files` if the fetch is refused.)

- [ ] **Step 4: Capture and record the baseline, before any port**

```bash
cd $S/cmp/legacy && TAG=baseline node ours.mjs && TAG=baseline node ref.mjs && TAG=baseline node stats.mjs | tee baseline/stats.txt
```

Expected: 12 rows, one gap per sample and point. Keep `baseline/`.

---

### Task 2: A layer can carry its own opacity

**Files:**

- Modify: `apps/holodex/src/holo/shader/types.ts` (`Layer`)
- Modify: `apps/holodex/src/holo/shader/compile.ts` (`layerCode`, where a layer after the first is blended onto the stack)
- Test: `apps/holodex/src/holo/shader/compile.test.ts`

**Interfaces:**

- Produces: `Layer.opacity?: PointerDriven`. A layer with it compiles to `stack = mix(stack, <blended>, clamp(<opacity>, 0.0, 1.0));`; one without compiles exactly as before.

- [ ] **Step 1: Write the failing tests** in `compile.test.ts`, beside the existing transpile tests (reuse their harness that runs emitted GLSL as JS): (a) an element whose layer 1 has `opacity: { base: 0.25 }` and `blend: 'normal'` over a solid layer 0 yields `0.75 · layer0 + 0.25 · layer1` at a sample fragment; (b) with `opacity: { base: 1, fromTop: -0.75 }`, at `fromTop = 1` the weight is 0.25 and at `fromTop = 0` it is 1. Separately, as a scratch check and not a committed test (it would fire on every later intentional change): hash `compileEffect(EFFECTS[id])` for all 30 now, and again after Step 3; every hash must match.
- [ ] **Step 2: Run** `cd apps/holodex && pnpm exec vitest run src/holo/shader/compile.test.ts` — Expected: (a) and (b) FAIL (the opacity is ignored).
- [ ] **Step 3: Implement** — in `types.ts` add to `Layer`:

```ts
  /** The layer's own opacity, as its pseudo-element's `opacity`: 1 when left out. */
  opacity?: PointerDriven;
```

and in `compile.ts`'s layer loop, where a later layer is written as `stack = <blend expr>;`, emit instead, only when `layer.opacity` is set: `stack = mix(stack, <blend expr>, clamp(<pointerDriven(layer.opacity)>, 0.0, 1.0));` — using the same pointer-driven expression emitter the element opacity uses.

- [ ] **Step 4: Run** the same command — Expected: PASS, both; then the scratch hash check — all 30 unchanged.
- [ ] **Step 5: Mutation check** — drop the `clamp`, then swap the `mix` arguments: each must fail (a) or (b). Restore by checksum.
- [ ] **Step 6: Commit** `feat(holodex): let a layer carry its own opacity` (types.ts, compile.ts, compile.test.ts).

---

### Task 3: What the ports share, the test table, and base.css's four

**Files:**

- Create: `apps/holodex/src/holo/effects/legacy-glare.ts`
- Create: `apps/holodex/src/holo/effects/legacy-glares.test.ts`
- Modify: `apps/holodex/src/holo/effects/basic.ts`, `regular-holo.ts`, `trainer-full-art.ts`, `trainer-gallery-v-regular.ts`

**Interfaces:**

- Produces, in `legacy-glare.ts`: `BASE_GLARE: CssStop[]`; `glareNeutral(blend: 'overlay' | 'soft-light' | 'hard-light' | 'multiply' | 'darken', filter?: FixedFilter): RGB`; `overStops(top: CssStop[], bottom: CssStop[], at: number[]): CssStop[]` (CSS source-over of two gradients about one centre, sampled at `at`).

- [ ] **Step 1: Write `legacy-glare.ts`**

```ts
import {
  BLACK,
  WHITE,
  grey,
  neutralBefore,
  stop,
  type CssStop,
  type FixedFilter,
  type RGB,
} from './css';

/**
 * base.css's own glare, which every card of pokemon-cards-css draws unless its
 * rarity paints another: radial-gradient(farthest-corner circle at the
 * pointer, hsla(0, 0%, 100%, .8) 10%, hsla(0, 0%, 100%, .65) 20%,
 * hsla(0, 0%, 0%, .5) 90%), overlaid.
 */
export const BASE_GLARE: CssStop[] = [
  stop(WHITE, 10, 0.8),
  stop(WHITE, 20, 0.65),
  stop(BLACK, 90, 0.5),
];

type GlareBlend = 'overlay' | 'soft-light' | 'hard-light' | 'multiply' | 'darken';

/**
 * The colour a glare's transparency folds toward: the one its blend leaves
 * the card as it is (0.5 grey for the overlay family, white for multiply and
 * darken), taken back through the glare's own filter, which the shader runs
 * after the layers.
 */
export function glareNeutral(blend: GlareBlend, filter?: FixedFilter): RGB {
  const target = blend === 'multiply' || blend === 'darken' ? 1 : 0.5;
  return grey(filter ? neutralBefore(filter, target) : target);
}
```

and `overStops`, used by Task 4's reverse-holo, whose `:after` is painted with no blend over the glare's own radial. Both are radials about the pointer in one box, so the pair is one radial: at each distance, CSS's source-over of the one onto the other. Gradients interpolate premultiplied, as CSS's do:

```ts
/** A gradient's colour and alpha at `at` percent, interpolated premultiplied. */
function rgbaAt(stops: CssStop[], at: number): { color: RGB; alpha: number } {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (at <= first.at) return { color: first.color, alpha: first.alpha };
  if (at >= last.at) return { color: last.color, alpha: last.alpha };
  const i = stops.findIndex((s) => s.at >= at);
  const [a, b] = [stops[i - 1], stops[i]];
  const f = (at - a.at) / (b.at - a.at);
  const alpha = a.alpha + (b.alpha - a.alpha) * f;
  const color = a.color.map((c, k) => {
    const pre = c * a.alpha + (b.color[k] * b.alpha - c * a.alpha) * f;
    return alpha > 0 ? pre / alpha : 0;
  }) as RGB;
  return { color, alpha };
}

/** `top` painted over `bottom` (both about one centre), sampled at `at` percents. */
export function overStops(top: CssStop[], bottom: CssStop[], at: number[]): CssStop[] {
  return at.map((p) => {
    const t = rgbaAt(top, p);
    const b = rgbaAt(bottom, p);
    const alpha = t.alpha + b.alpha * (1 - t.alpha);
    const color = t.color.map((c, k) =>
      alpha > 0 ? (c * t.alpha + b.color[k] * b.alpha * (1 - t.alpha)) / alpha : 0,
    ) as RGB;
    return stop(color, p, alpha);
  });
}
```

Read `neutralBefore` and `CssStop` in `css.ts` first and use their exact signatures (a `CssStop`'s `alpha` may be optional; default it to 1 in `rgbaAt`).

- [ ] **Step 2: Write `legacy-glares.test.ts`** with: a helper `layerAt(layer, t)` that linearly interpolates a converted radial's own sampled stops (written in the test, not imported); a `SHAPE` table — for all 22 ids, `{ blend, opacity: PointerDriven | undefined, filter: Record<string, number> | undefined, layerBlends: BlendMode[], box: [number, number] }`, every value from the per-effect table above; and the shared assertions: `glare` is `[]`, `beneath` has one element, every `radial-pointer` in it has a `cssBox`, and the element matches its `SHAPE` row. Plus colour checks by hand for base.css's radial as ported into `basic`: at t = 0.10 the colour is `0.8·1 + 0.2·0.5 = 0.9`, at 0.20 `0.65 + 0.35·0.5 = 0.825`, at 0.90 `0.5·0.5 = 0.25`; and for `regular-holo`, whose filter (.8, 1.5) folds toward `0.625` (`((0.8·v − 0.5)·1.5 + 0.5 = 0.5` gives `v = 0.625`): at 0.10 `0.8 + 0.2·0.625 = 0.925`.
- [ ] **Step 3: Run** `cd apps/holodex && pnpm exec vitest run src/holo/effects/legacy-glares.test.ts` — Expected: FAIL for every row (glares still derived).
- [ ] **Step 4: Port the four** per the rules and table. `basic.ts`:

```ts
import type { Effect } from '../shader/types';
import { COVER, radial } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';

/**
 * No foil: the card as printed, under base.css's glare, which pokemon-cards-css
 * paints on every card (basic.css adds nothing). It sits beneath where a shine
 * would be, as the reference's z-index stacks it; basic has no shine.
 */
export const basic: Effect = {
  id: 'basic',
  shine: [],
  beneath: [
    {
      layers: [{ ...radial(BASE_GLARE, COVER, glareNeutral('overlay')), blend: 'normal' }],
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
```

`regular-holo.ts` keeps its shine and replaces its glare with:

```ts
const GLARE_FILTER = { brightness: 0.8, contrast: 1.5, saturate: 1 };
const AFTER_FILTER = { brightness: 0.6, contrast: 3, saturate: 1 };
const afterStop = (c: RGB, at: number, alpha = 1) => stop(filterRGB(c, AFTER_FILTER), at, alpha);
// …
  beneath: [
    {
      // .card__glare paints base.css's radial; its :after, overlaid onto it
      layers: [
        { ...radial(BASE_GLARE, COVER, glareNeutral('overlay', GLARE_FILTER)), blend: 'normal' },
        {
          ...radial(
            [afterStop(hsl(180, 100, 95), 5), afterStop(grey(0.39), 55, 0.25), afterStop(BLACK, 110, 0.36)],
            COVER,
            grey(0.5),
          ),
          blend: 'overlay',
        },
      ],
      filter: { brightness: { base: 0.8 }, contrast: { base: 1.5 } },
      opacity: { base: 0.8 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
```

`trainer-full-art.ts`: one layer `radial(BASE_GLARE, { size: [1.7, 1.7], position: [fixed(0), fixed(0)] }, glareNeutral('multiply', { brightness: 1.5, contrast: 1.4, saturate: 1 }))`, filter (1.5, 1.4, 1), opacity `{ base: 0.75 }`, `mixBlend: 'multiply'`. `trainer-gallery-v-regular.ts`: one layer `radial(BASE_GLARE, COVER, glareNeutral('overlay'))`, opacity `{ base: 0.4 }`, `mixBlend: 'overlay'`.

- [ ] **Step 5: Run** the test file — Expected: the four rows PASS, the other 18 still FAIL. Run `pnpm exec vitest run src/holo` — the registry tests PASS.
- [ ] **Step 6: Mutation check** — in `glareNeutral`, return 0.5 for multiply: the trainer-full-art colour check must fail (add one: at t = 0.90 BASE_GLARE's black a.5 folds toward `v` with `((1.5v − .5)·1.4 + .5) = 1`, so `v = 0.5714`, giving `0.2857`). Restore.
- [ ] **Step 7: Commit** `feat(holodex): port base.css's glare and its four users, beneath the shine`.

---

### Task 4: The three with an `:after`

**Files:** `reverse-holo.ts`, `cosmos-holo.ts`, `shiny-vmax.ts`; rows and colour checks in `legacy-glares.test.ts`.

- [ ] **Step 1: Add the failing colour checks** (by hand): cosmos-holo's layer 1 has `opacity: { base: 1, fromTop: -0.75 }` and `blend: 'soft-light'`; shiny-vmax's layer 1 `blend: 'overlay'`, no opacity; reverse-holo is a **single** layer (its normal-blended `:after` is combined onto the glare's radial with `overStops`), whose colour at t = 0.10 is white (the `:after` is opaque there) and at t = 0.20 is white with combined alpha `0.5 + 0.5·0.5 = 0.75`, folded toward reverse-holo's neutral `glareNeutral('overlay', {.7, 1.5, 1})` (`v` from `((0.7v − .5)·1.5 + .5) = .5`, `v = 0.7143`): `0.75 + 0.25·0.7143 = 0.9286`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Port** per the table. `cosmos-holo.ts`'s element:

```ts
const GLARE_FILTER = { brightness: 0.75, contrast: 2, saturate: 2 };
const AFTER_FILTER = { brightness: 0.75, contrast: 2.5, saturate: 2 };
// …
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(204, 100, 95), 5, 0.8), stop(hsl(250, 15, 20), 150)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
        {
          // the :after, soft-lit onto it, fading as the pointer moves down the card
          ...radial([
            stop(filterRGB(hsl(280, 100, 96), AFTER_FILTER), 5),
            stop(filterRGB(grey(0.1), AFTER_FILTER), 60),
          ]),
          blend: 'soft-light',
          opacity: { base: 1, fromTop: -0.75 },
        },
      ],
      filter: { brightness: { base: 0.75 }, contrast: { base: 2 }, saturate: { base: 2 } },
      opacity: { base: 0.25, fromCenter: 1 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
```

`shiny-vmax.ts`: layer 0 `radial([stop(hsl(248,5,90),0,.45), stop(hsl(206,5,30),45,.45), stop(BLACK,120,.33)], COVER, glareNeutral('overlay', {1, 1.25, 1}))`; layer 1 its `:after` with filter (1, 1.25) baked, folded to `grey(0.5)`, `blend: 'overlay'`; filter (1, 1.25); `mixBlend: 'overlay'`. `reverse-holo.ts`: one layer `radial(overStops(AFTER, GLARE, SAMPLE_AT), COVER, glareNeutral('overlay', {.7, 1.5, 1}))` where `AFTER` is its `:after` stops with filter (1, 1.5) baked, `GLARE` its own radial, `SAMPLE_AT` every 2.5% from 0 to 120; filter (.7, 1.5); `mixBlend: 'overlay'`.

- [ ] **Step 4: Run** — Expected: the seven rows so far PASS.
- [ ] **Step 5: Commit** `feat(holodex): port the glares that carry an :after`.

---

### Task 5: The single radials, hard-light and overlay

**Files:** `radiant-holo.ts`, `rainbow-holo.ts`, `rainbow-alt.ts`, `secret-rare.ts`, `swsh-pikachu.ts`, `v-max.ts`, `v-regular.ts`, `v-star.ts`, `amazing-rare.ts`; their rows in `legacy-glares.test.ts`.

- [ ] **Step 1: Add hand colour checks** for two of them: radiant-holo at t = 0 is white a.33 folded toward `glareNeutral('hard-light', {1, 1.5, 1})` = 0.5: `0.33 + 0.67·0.5 = 0.665`; v-max at t = 0 is white a.75 folded toward 0.5: `0.875`. Run — Expected: FAIL.
- [ ] **Step 2: Port each** as one layer `{ ...radial(<its stops>, COVER, glareNeutral(<its blend>, <its filter>)), blend: 'normal' }` with its filter, opacity and `mixBlend` from the table, `glare: []`, and its header rewritten per rule 7.
- [ ] **Step 3: Run** — Expected: the sixteen rows so far PASS; `pnpm exec vitest run src/holo` PASS.
- [ ] **Step 4: Commit** `feat(holodex): port the single-radial glares`.

---

### Task 6: The sized boxes, multiply and darken, and the trainer galleries

**Files:** `shiny-rare.ts`, `shiny-v.ts`, `v-full-art.ts`, `trainer-gallery-holo.ts`, `trainer-gallery-secret-rare.ts`, `trainer-gallery-v-max.ts`; their rows.

- [ ] **Step 1: Add a hand geometry check** for shiny-v's box: its `cssBox.size` is `[1.2, 1.4]`, and with the pointer at the card's top-left corner (`fromLeft = fromTop = 0`) the centre is `[(1 − 1.2)·0.5, (1 − 1.4)·0.5] = [−0.1, −0.2]`. Run — Expected: FAIL.
- [ ] **Step 2: Port each** per the table: shiny-v and v-full-art with `{ size: [1.2, 1.4] | [1.2, 1.5], position: [CENTER, CENTER] }`; shiny-rare `COVER`, `multiply`; the three galleries with their `[trainer-gallery="true"]` rules (trainer-gallery-secret-rare's filter the `:not(.masked)` one, (.5, 1)).
- [ ] **Step 3: Run** — Expected: all 22 rows PASS; the whole suite PASS.
- [ ] **Step 4: Commit** `feat(holodex): port the sized, darken and trainer-gallery glares`.

---

### Task 7: Compare with the baseline, smoke on a GPU, document

**Files:** `apps/holodex/AGENTS.md`; the scratch harness from Task 1.

- [ ] **Step 1: Capture after** — `cd $S/cmp/legacy && TAG=after node ours.mjs && TAG=after node ref.mjs && TAG=after node stats.mjs | tee after/stats.txt`, then compare each row's gap with `baseline/stats.txt`. Expected: the gap drops for most rows. A row whose gap grows by more than 5 is investigated (superpowers:systematic-debugging) before the work is accepted.
- [ ] **Step 2: GPU smoke** — on 9107's `/effects`, pick the first card of each of the 22 legacy sections in turn: each time one `span[data-effect] canvas`, the section's effect, and no `holo.compile-failed` or `holo.unavailable` in the console.
- [ ] **Step 3: Build and split check** — delete `dist`/`dist-ssr`, `pnpm --filter @ncam/holodex build`, then the two `grep` counts in AGENTS.md (2 and 1). Note the lazy chunk's gzip size.
- [ ] **Step 4: AGENTS.md** — "Two families of effects": the glares of the 22 are now ported from pokemon-cards-css's CSS through `css.ts` and `legacy-glare.ts`, painted beneath the shine; their shines stay derived. "Glare stacks by z-index": true of all 30, and verified on poke-holo.simey.me too. The DSL paragraph: a layer's optional `opacity`. Prettier-check it.
- [ ] **Step 5: Full verification** — `pnpm vitest run && pnpm lint && pnpm --filter @ncam/holodex typecheck`.
- [ ] **Step 6: Commit** `docs(holodex): record the legacy glare ports and how they compare`, its body carrying the baseline and after gaps.

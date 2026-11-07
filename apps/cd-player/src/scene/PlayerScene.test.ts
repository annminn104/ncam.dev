import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The scene draws into a WebGL canvas, which node has not: its wiring is read from its source, as
// App.test.ts reads App's. What it wires is tested on its own: model-load.test.ts (a load, its
// reports and a change's stall watch) and model-holder.test.ts (what the scene holds).
const source = readFileSync(new URL('./PlayerScene.tsx', import.meta.url), 'utf8');

describe('PlayerScene (its wiring, read from its source)', () => {
  it('runs every load through startModelLoad, a stall watch on the page’s timers for a change alone', () => {
    expect(source).toMatch(/const run = startModelLoad<PlayerModel>\(/);
    // The boot is App's to watch: its load runs with none here.
    expect(source).toMatch(/booted \? PAGE_TIMERS : null,/);
    // Let go of with the effect: a newer look, the swap, the scene going.
    expect(source).toMatch(/return \(\) => \{\s*run\.cancel\(\);/);
  });

  it('logs and reports a change that fails, and fails the boot with its own', () => {
    expect(source).toMatch(
      /failed: \(error\) => \{\s*if \(!booted\) return fail\(error\);\s*log\.warn\('cd-player\.model-failed', \{ model: wanted\.id, error: String\(error\) \}\);\s*reportModel\(\{ model: wanted\.id, status: 'failed' \}\);/,
    );
  });

  it('lets a stalled change’s model go through the holder, never shown', () => {
    expect(source).toMatch(/abandon: \(model\) => holder\.failed\(model\),/);
  });

  it('ends a change’s watch as its compile lands, before the holder swaps it in', () => {
    expect(source).toMatch(
      /onDone=\{\(model\) => \{\s*(\/\/[^\n]*\n\s*)*loading\.current\?\.compiled\(model\);\s*holder\.compiled\(model, wanted\.id\);/,
    );
  });

  it('tells App the model on the stage each time the holder changes it, and none as it goes', () => {
    // The latest callback, as the holder lives on from the first render.
    expect(source).toMatch(/useLayoutEffect\(\(\) => \{\s*stage\.current = onStage;\s*\}\);/);
    expect(source).toMatch(
      /createModelHolder<PlayerModel>\(\(held\) => \{\s*setHeld\(held\);\s*if \(held\.shown === staged\) return;\s*staged = held\.shown;\s*stage\.current\(staged\?\.id \?\? null\);/,
    );
  });
});

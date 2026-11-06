import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ModelId } from '../models';
import {
  createModelHolder,
  NOTHING_HELD,
  stepHeld,
  type Held,
  type HeldModel,
} from './model-holder';

/** A stand-in for a loaded PlayerModel: its id, and a dispose the test counts. */
function model(id: ModelId): { id: ModelId; dispose: Mock<() => void> } {
  return { id, dispose: vi.fn<() => void>() };
}

/** A holder whose every change of what renders is kept, in order. */
function holder() {
  const renders: Held<HeldModel>[] = [];
  return { held: createModelHolder<HeldModel>((held) => renders.push(held)), renders };
}

describe('stepHeld', () => {
  it('holds a load of the wanted model as the next, and shows it once compiled', () => {
    const suitcase = model('suitcase');
    const loaded = stepHeld(NOTHING_HELD, { type: 'loaded', model: suitcase }, 'suitcase');
    expect(loaded).toEqual({ held: { shown: null, next: suitcase }, drop: null, retire: null });
    const compiled = stepHeld(loaded.held, { type: 'compiled', model: suitcase }, 'suitcase');
    // The boot: nothing was on show, so nothing goes.
    expect(compiled).toEqual({ held: { shown: suitcase, next: null }, drop: null, retire: null });
  });

  it('takes the model a swap replaces off show, to go once the swap is drawn', () => {
    const suitcase = model('suitcase');
    const clear = model('clear');
    const step = stepHeld(
      { shown: suitcase, next: clear },
      { type: 'compiled', model: clear },
      'clear',
    );
    expect(step).toEqual({ held: { shown: clear, next: null }, drop: null, retire: suitcase });
  });

  it('drops a next that a newer load replaces', () => {
    const suitcase = model('suitcase');
    const older = model('clear');
    const newer = model('clear');
    const step = stepHeld(
      { shown: suitcase, next: older },
      { type: 'loaded', model: newer },
      'clear',
    );
    expect(step).toEqual({ held: { shown: suitcase, next: newer }, drop: older, retire: null });
  });

  it('drops a load the look no longer names, or of the model already on show, and holds on', () => {
    const suitcase = model('suitcase');
    const clear = model('clear');
    const held = { shown: suitcase, next: null };
    expect(stepHeld(held, { type: 'loaded', model: clear }, 'suitcase')).toEqual({
      held,
      drop: clear,
      retire: null,
    });
    const again = model('suitcase');
    expect(stepHeld(held, { type: 'loaded', model: again }, 'suitcase')).toEqual({
      held,
      drop: again,
      retire: null,
    });
  });

  it('drops a next once the look names another model, and keeps one it still names', () => {
    const suitcase = model('suitcase');
    const clear = model('clear');
    const held = { shown: suitcase, next: clear };
    expect(stepHeld(held, { type: 'wanted' }, 'suitcase')).toEqual({
      held: { shown: suitcase, next: null },
      drop: clear,
      retire: null,
    });
    expect(stepHeld(held, { type: 'wanted' }, 'clear')).toEqual({ held, drop: null, retire: null });
    expect(stepHeld(NOTHING_HELD, { type: 'wanted' }, 'clear').held).toBe(NOTHING_HELD);
  });

  it('never shows a next the look stopped naming while it compiled: it is dropped instead', () => {
    const suitcase = model('suitcase');
    const clear = model('clear');
    const step = stepHeld(
      { shown: suitcase, next: clear },
      { type: 'compiled', model: clear },
      'suitcase',
    );
    expect(step).toEqual({ held: { shown: suitcase, next: null }, drop: clear, retire: null });
  });

  it('ignores the compile of a model that is no longer the next (it went when it was let go)', () => {
    const suitcase = model('suitcase');
    const gone = model('clear');
    const held = { shown: suitcase, next: model('clear') };
    expect(stepHeld(held, { type: 'compiled', model: gone }, 'clear')).toEqual({
      held,
      drop: null,
      retire: null,
    });
  });
});

describe('createModelHolder', () => {
  it('disposes a next replaced by a newer one at once, and renders the newer', () => {
    const { held, renders } = holder();
    const older = model('suitcase');
    const newer = model('suitcase');
    held.loaded(older, 'suitcase');
    held.loaded(newer, 'suitcase');
    expect(older.dispose).toHaveBeenCalledOnce();
    expect(newer.dispose).not.toHaveBeenCalled();
    expect(renders.at(-1)).toEqual({ shown: null, next: newer });
  });

  it('disposes a next the look stopped naming, when it changes and when its compile lands', () => {
    const { held } = holder();
    const suitcase = model('suitcase');
    held.loaded(suitcase, 'suitcase');
    held.compiled(suitcase, 'suitcase');
    const first = model('clear');
    held.loaded(first, 'clear');
    held.want('suitcase');
    expect(first.dispose).toHaveBeenCalledOnce();
    const second = model('clear');
    held.loaded(second, 'clear');
    held.compiled(second, 'suitcase');
    expect(second.dispose).toHaveBeenCalledOnce();
    // The late compile of the first changes nothing and disposes nothing twice.
    held.compiled(first, 'clear');
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(suitcase.dispose).not.toHaveBeenCalled();
  });

  it('disposes the model a swap replaces only once the new one is drawn', () => {
    const { held, renders } = holder();
    const suitcase = model('suitcase');
    const clear = model('clear');
    held.loaded(suitcase, 'suitcase');
    held.compiled(suitcase, 'suitcase');
    held.settle(suitcase);
    held.loaded(clear, 'clear');
    held.compiled(clear, 'clear');
    expect(renders.at(-1)).toEqual({ shown: clear, next: null });
    expect(suitcase.dispose).not.toHaveBeenCalled();
    held.settle(clear);
    expect(suitcase.dispose).toHaveBeenCalledOnce();
    held.settle(clear);
    expect(suitcase.dispose).toHaveBeenCalledOnce();
    expect(clear.dispose).not.toHaveBeenCalled();
  });

  it('keeps the replaced model while only its own late probe says it is drawn', () => {
    // A swap within a rig's first three frames: that rig's probe can still answer before the
    // canvas has taken it out of the scene, so it must not let it go.
    const { held } = holder();
    const suitcase = model('suitcase');
    const clear = model('clear');
    held.loaded(suitcase, 'suitcase');
    held.compiled(suitcase, 'suitcase');
    held.loaded(clear, 'clear');
    held.compiled(clear, 'clear');
    held.settle(suitcase);
    expect(suitcase.dispose).not.toHaveBeenCalled();
    held.settle(clear);
    expect(suitcase.dispose).toHaveBeenCalledOnce();
  });

  it('disposes everything it holds on release, the one on show, the next and any taken off show', () => {
    const { held, renders } = holder();
    const suitcase = model('suitcase');
    const clear = model('clear');
    const next = model('suitcase');
    held.loaded(suitcase, 'suitcase');
    held.compiled(suitcase, 'suitcase');
    held.loaded(clear, 'clear');
    held.compiled(clear, 'clear');
    held.loaded(next, 'suitcase');
    held.release();
    for (const each of [suitcase, clear, next]) expect(each.dispose).toHaveBeenCalledOnce();
    expect(renders.at(-1)).toEqual(NOTHING_HELD);
    // Held again from nothing (StrictMode mounts twice), it holds and lets go as before.
    const again = model('clear');
    held.loaded(again, 'clear');
    expect(renders.at(-1)).toEqual({ shown: null, next: again });
  });

  it('never renders the Clear model for a quick Suitcase → Clear → Suitcase', () => {
    const { held, renders } = holder();
    const suitcase = model('suitcase');
    held.loaded(suitcase, 'suitcase');
    held.compiled(suitcase, 'suitcase');
    // Clear loads, and the visitor goes back while its shaders compile…
    const compiling = model('clear');
    held.loaded(compiling, 'clear');
    held.want('suitcase');
    held.compiled(compiling, 'suitcase');
    // …or before its load lands (the scene lets go of that load: one that lands anyway is dropped).
    const late = model('clear');
    held.loaded(late, 'suitcase');
    expect(renders.map((each) => each.shown)).not.toContain(compiling);
    expect(renders.map((each) => each.shown)).not.toContain(late);
    expect(renders.at(-1)).toEqual({ shown: suitcase, next: null });
    expect(compiling.dispose).toHaveBeenCalledOnce();
    expect(late.dispose).toHaveBeenCalledOnce();
  });
});

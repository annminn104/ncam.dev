import { describe, expect, it, vi } from 'vitest';
import type { ModelId } from './models';
import { createModelKeeper } from './model-keeper';

function setup() {
  const keep = vi.fn<(model: ModelId) => void>();
  return { keeper: createModelKeeper(keep), keep };
}

describe('createModelKeeper', () => {
  it('keeps a model chosen while nothing is on the stage at once: the boot loads it', () => {
    const { keeper, keep } = setup();
    keeper.choose('clear');
    expect(keep.mock.calls).toEqual([['clear']]);
    expect(keeper.staged).toBeNull();
  });

  it('keeps nothing as the boot’s own model comes on show: it was kept as it was chosen', () => {
    const { keeper, keep } = setup();
    keeper.stage('clear');
    keeper.drawn('clear');
    expect(keep).not.toHaveBeenCalled();
    expect(keeper.staged).toBe('clear');
  });

  it('keeps a change once its first frames are drawn, never as it is chosen', () => {
    const { keeper, keep } = setup();
    keeper.stage('suitcase');
    keeper.drawn('suitcase');
    keeper.choose('clear');
    expect(keep).not.toHaveBeenCalled();
    keeper.stage('clear');
    expect(keep).not.toHaveBeenCalled();
    keeper.drawn('clear');
    keeper.drawn('clear');
    expect(keep.mock.calls).toEqual([['clear']]);
  });

  it('counts a model chosen once the boot’s takes the stage as a change, before its frames are drawn', () => {
    // The window between the boot's first swap and its ready probe: the scene loads a choice made
    // in it as a change, so it is kept only once it is on show, and a failure goes back to the
    // boot's model, which the page has not heard is drawn yet.
    const { keeper, keep } = setup();
    keeper.stage('clear');
    keeper.choose('suitcase');
    expect(keep).not.toHaveBeenCalled();
    expect(keeper.staged).toBe('clear');
    keeper.drawn('clear');
    expect(keep).not.toHaveBeenCalled();
    keeper.stage('suitcase');
    keeper.drawn('suitcase');
    expect(keep.mock.calls).toEqual([['suitcase']]);
  });

  it('keeps a change whose frames come first, the boot’s model taken off the stage undrawn', () => {
    const { keeper, keep } = setup();
    keeper.stage('clear');
    keeper.choose('suitcase');
    keeper.stage('suitcase');
    keeper.drawn('suitcase');
    expect(keep.mock.calls).toEqual([['suitcase']]);
  });

  it('keeps nothing of a change that fails: the model on the stage is the one to go back to', () => {
    const { keeper, keep } = setup();
    keeper.stage('clear');
    keeper.drawn('clear');
    keeper.choose('suitcase');
    // The change fails: the stage still holds the Clear, and the look goes back to it.
    expect(keeper.staged).toBe('clear');
    keeper.choose('clear');
    expect(keep).not.toHaveBeenCalled();
  });

  it('starts again once the scene goes: a change it never drew is forgotten', () => {
    const { keeper, keep } = setup();
    keeper.stage('suitcase');
    keeper.choose('clear');
    keeper.stage('clear');
    keeper.stage(null);
    expect(keeper.staged).toBeNull();
    // "Try again": the boot's model, drawn, is not a change.
    keeper.stage('clear');
    keeper.drawn('clear');
    expect(keep).not.toHaveBeenCalled();
    keeper.stage(null);
    keeper.choose('suitcase');
    expect(keep.mock.calls).toEqual([['suitcase']]);
  });
});

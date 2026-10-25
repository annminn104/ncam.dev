import { Box3, Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CLICK_SLOP, createDragWatch, createHoverWatch } from './pointer';

describe('createDragWatch', () => {
  it('counts a press that stays within 5 px as a click, jitter included', () => {
    expect(CLICK_SLOP).toBe(5);
    const watch = createDragWatch();
    watch.press(100, 100);
    watch.move(103, 104); // 5 px: not more than the slop
    watch.release();
    expect(watch.dragged).toBe(false);
  });

  it('counts a press that wandered off as a drag even when it is released where it started', () => {
    const watch = createDragWatch();
    watch.press(100, 100);
    watch.move(140, 100);
    watch.move(101, 100); // back on the spot: the press-and-release distance alone would say click
    watch.release();
    expect(watch.dragged).toBe(true);
  });

  it('keeps its verdict after the release, for the click that follows it', () => {
    const watch = createDragWatch();
    watch.press(0, 0);
    watch.move(30, 0);
    watch.release();
    watch.move(0, 0); // no button down: ignored
    expect(watch.dragged).toBe(true);
  });

  it('starts afresh at every press', () => {
    const watch = createDragWatch();
    watch.press(0, 0);
    watch.move(30, 0);
    watch.release();
    watch.press(50, 50);
    expect(watch.dragged).toBe(false);
    watch.move(50, 54);
    watch.release();
    expect(watch.dragged).toBe(false);
  });

  it('ignores moves nobody pressed for', () => {
    const watch = createDragWatch();
    watch.move(0, 0);
    watch.move(500, 500);
    expect(watch.dragged).toBe(false);
  });
});

describe('createHoverWatch', () => {
  const at = (x: number) => new Matrix4().makeTranslation(x, 0, 0);
  const box = (x: number) => new Box3(new Vector3(x, 0, 0), new Vector3(x + 1, 1, 1));

  it('has nothing to compare with the first time', () => {
    expect(createHoverWatch().changed(at(0), 'none', null)).toBe(false);
  });

  it('reports a camera move once, then nothing while it stays put', () => {
    const watch = createHoverWatch();
    watch.changed(at(0), 'none', null);
    expect(watch.changed(at(0), 'none', null)).toBe(false);
    expect(watch.changed(at(2), 'none', null)).toBe(true);
    expect(watch.changed(at(2), 'none', null)).toBe(false);
  });

  it('reports a change of the cut', () => {
    const watch = createHoverWatch();
    watch.changed(at(0), 'upper', null);
    expect(watch.changed(at(0), 'ground', null)).toBe(true);
    expect(watch.changed(at(0), 'ground', null)).toBe(false);
  });

  it('reports the hovered item moving (a sliding door) but not the hover starting or ending', () => {
    const watch = createHoverWatch();
    watch.changed(at(0), 'none', null);
    expect(watch.changed(at(0), 'none', box(0))).toBe(false); // the item was just found there
    expect(watch.changed(at(0), 'none', box(0))).toBe(false);
    expect(watch.changed(at(0), 'none', box(0.5))).toBe(true);
    expect(watch.changed(at(0), 'none', box(0.5))).toBe(false);
    expect(watch.changed(at(0), 'none', null)).toBe(false);
    expect(watch.changed(at(0), 'none', box(3))).toBe(false); // another item, found by the pointer itself
  });

  it('reports the hovered item hidden (a click stopped the waterfall it names) until the hover has moved on', () => {
    const watch = createHoverWatch();
    watch.changed(at(0), 'none', null);
    expect(watch.changed(at(0), 'none', box(0), true)).toBe(false);
    expect(watch.changed(at(0), 'none', box(0), false)).toBe(true); // no longer under the pointer: look again
    expect(watch.changed(at(0), 'none', box(0), false)).toBe(true); // still named: keep asking
    expect(watch.changed(at(0), 'none', box(2), true)).toBe(false); // what the pointer found behind it
    expect(watch.changed(at(0), 'none', null, false)).toBe(false); // nothing hovered: nothing hidden
  });

  it('does not keep the matrix it is given: a camera that moves in place is still noticed', () => {
    const watch = createHoverWatch();
    const camera = at(0);
    watch.changed(camera, 'none', null);
    camera.setPosition(5, 0, 0);
    expect(watch.changed(camera, 'none', null)).toBe(true);
  });
});

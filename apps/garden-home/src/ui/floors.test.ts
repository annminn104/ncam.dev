import { describe, expect, it } from 'vitest';
import { useAppStore } from '../state/store';
import { FLOOR_BUTTONS, isPressed } from './floors';

describe('the floor buttons (AGENTS.md, Controls)', () => {
  it('offer auto, the whole house, the two storeys and the basement, in English, top to bottom', () => {
    expect(FLOOR_BUTTONS.map(({ mode, label }) => [mode, label])).toEqual([
      ['auto', 'Auto'],
      ['none', 'Roof'],
      ['upper', 'Upper floor'],
      ['ground', 'Ground floor'],
      ['basement', 'Basement'],
    ]);
    for (const button of FLOOR_BUTTONS)
      expect(button.title.length).toBeGreaterThan(button.label.length);
  });

  it('press the button of the mode picked, and only that one', () => {
    for (const mode of ['auto', 'none', 'upper', 'ground', 'basement'] as const) {
      expect(
        FLOOR_BUTTONS.filter((button) => isPressed(button.mode, mode)).map((button) => button.mode),
      ).toEqual([mode]);
    }
  });

  it('are kept in the store as cutMode, auto to begin with', () => {
    expect(useAppStore.getState().cutMode).toBe('auto');
    useAppStore.getState().setCutMode('basement');
    expect(useAppStore.getState().cutMode).toBe('basement');
    useAppStore.getState().setCutMode('auto');
    expect(useAppStore.getState().cutMode).toBe('auto');
  });

  it("count every press, the pressed button's too (floorPress), so the camera moves for it again (OrbitRig)", () => {
    const before = useAppStore.getState().floorPress;
    expect(before).toBeGreaterThanOrEqual(0);
    useAppStore.getState().setCutMode('basement');
    useAppStore.getState().setCutMode('basement');
    expect(useAppStore.getState().cutMode).toBe('basement');
    expect(useAppStore.getState().floorPress).toBe(before + 2);
    useAppStore.getState().setCutMode('auto');
  });
});

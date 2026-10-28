import { describe, expect, it } from 'vitest';
import { useAppStore } from '../state/store';
import {
  DAY_SCREEN_GLOW,
  GLOW_KINDS,
  glowFactor,
  hintFor,
  isOn,
  isToggled,
  nextToggle,
  playsOnce,
} from './toggles';

describe('nextToggle', () => {
  it('turns auto into the opposite of what shows now, then alternates on and off (AGENTS.md, Controls)', () => {
    expect(nextToggle('auto', true)).toBe('off');
    expect(nextToggle('auto', false)).toBe('on');
    expect(nextToggle('on', true)).toBe('off');
    expect(nextToggle('on', false)).toBe('off');
    expect(nextToggle('off', true)).toBe('on');
    expect(nextToggle('off', false)).toBe('on');
  });
});

describe('isOn', () => {
  it('follows the night for lights and screens while auto', () => {
    for (const kind of ['light', 'lights', 'tv', 'pc']) {
      expect(isOn(kind, 'auto', 0)).toBe(false);
      expect(isOn(kind, 'auto', 0.4)).toBe(false);
      expect(isOn(kind, 'auto', 0.6)).toBe(true);
      expect(isOn(kind, 'on', 0)).toBe(true);
      expect(isOn(kind, 'off', 1)).toBe(false);
    }
  });

  it("lights the grill's coals with the night while auto, like the garden lights", () => {
    for (const kind of ['bbq', 'lights']) {
      expect(isOn(kind, 'auto', 0)).toBe(false);
      expect(isOn(kind, 'auto', 0.6)).toBe(true);
      expect(isOn(kind, 'on', 0)).toBe(true);
      expect(isOn(kind, 'off', 1)).toBe(false);
    }
    expect(glowFactor('on', 0, 'bbq')).toBe(1); // coals glow in full by day: they are not a screen
    expect(glowFactor('auto', 0.3, 'bbq')).toBe(0.3);
    expect(hintFor('bbq', true)).toBe('Click to switch off');
  });

  it('keeps showers off and the door shut, and the jacuzzi and the fountain running, while auto', () => {
    expect(isOn('shower', 'auto', 1)).toBe(false);
    expect(isOn('door', 'auto', 0)).toBe(false);
    expect(isOn('jacuzzi', 'auto', 0)).toBe(true);
    expect(isOn('fountain', 'auto', 1)).toBe(true);
    expect(isOn('shower', 'on', 0)).toBe(true);
    expect(isOn('fountain', 'off', 0)).toBe(false);
  });

  it('offers to feed the koi: a click on the pond is no toggle', () => {
    expect(hintFor('koi', false)).toBe('Click to feed the koi');
    expect(hintFor('koi', true)).toBe('Click to feed the koi');
    expect(isToggled('koi')).toBe(false);
    expect(isToggled('waterfall')).toBe(true);
  });

  it('offers to play with the Akita: a click on the dog plays its happy clip once and toggles nothing', () => {
    expect(isToggled('dog')).toBe(false);
    expect(playsOnce('dog')).toBe(true);
    expect(playsOnce('koi')).toBe(false); // the pond's water feeds the koi
    expect(playsOnce('door')).toBe(false); // the door's act_ clip runs forwards and back with its toggle
    expect(hintFor('dog', false)).toBe('Click to play with the pup');
    expect(hintFor('dog', true)).toBe('Click to play with the pup');
    expect(isOn('dog', 'auto', 1)).toBe(false);
  });

  it("switches each car's lights and the carport's with the night while auto, like the garden lights", () => {
    for (const group of ['lights:car_pickup', 'lights:car_super', 'lights:carport']) {
      const kind = group.slice(0, group.indexOf(':'));
      expect(isOn(kind, 'auto', 0)).toBe(false);
      expect(isOn(kind, 'auto', 1)).toBe(true);
      expect(isToggled(kind)).toBe(true);
    }
  });

  it("keeps the koi pond's waterfall running while auto, day and night, like the fountain", () => {
    expect(isOn('waterfall', 'auto', 0)).toBe(true);
    expect(isOn('waterfall', 'auto', 1)).toBe(true);
    expect(isOn('waterfall', 'off', 0)).toBe(false);
  });
});

describe("the air conditioners (ac:<room>, the tall house's bedrooms)", () => {
  it('stay off while auto, day and night, and a click turns one on and then off', () => {
    for (const night of [0, 0.5, 1]) expect(isOn('ac', 'auto', night)).toBe(false);
    expect(isOn('ac', 'on', 0)).toBe(true);
    expect(isOn('ac', 'off', 1)).toBe(false);
    expect(nextToggle('auto', isOn('ac', 'auto', 1))).toBe('on');
    expect(isToggled('ac')).toBe(true);
    expect(playsOnce('ac')).toBe(false); // its louvre clip runs with its toggle, like the door's
  });

  it('light their status LED only while on, at full strength by day as at night', () => {
    expect(GLOW_KINDS.has('ac')).toBe(true);
    for (const night of [0, 1]) {
      expect(glowFactor('auto', night, 'ac')).toBe(0);
      expect(glowFactor(undefined, night, 'ac')).toBe(0); // the wallpaper: no toggles, an idle unit
      expect(glowFactor('on', night, 'ac')).toBe(1);
      expect(glowFactor('off', night, 'ac')).toBe(0);
    }
    expect(hintFor('ac', false)).toBe('Click to switch on');
    expect(hintFor('ac', true)).toBe('Click to switch off');
  });
});

describe("the basement's groups (art/README.md, Basement)", () => {
  it("keep the karaoke's party mode and the sauna off while auto, day and night, and a click turns one on", () => {
    for (const kind of ['party', 'sauna']) {
      expect(GLOW_KINDS.has(kind)).toBe(true);
      for (const night of [0, 0.5, 1]) {
        expect(isOn(kind, 'auto', night), `${kind} at ${night}`).toBe(false);
        expect(glowFactor('auto', night, kind)).toBe(0);
      }
      expect(isOn(kind, 'on', 0)).toBe(true);
      expect(glowFactor('on', 0, kind)).toBe(1); // full strength by day too: not a screen
      expect(nextToggle('auto', isOn(kind, 'auto', 1))).toBe('on');
    }
  });

  it("let the spa's hot tub run on auto, like the roof's jacuzzi (jacuzzi:spa)", () => {
    expect(isOn('jacuzzi', 'auto', 0)).toBe(true);
    expect(isOn('jacuzzi', 'off', 0)).toBe(false);
    expect(hintFor('party', false)).toBe('Click to switch on');
  });
});

describe('glowFactor', () => {
  it('is the night factor while auto, full when on, nothing when off', () => {
    expect(glowFactor('auto', 0.3)).toBe(0.3);
    expect(glowFactor(undefined, 0.7)).toBe(0.7);
    expect(glowFactor('on', 0)).toBe(1);
    expect(glowFactor('off', 1)).toBe(0);
  });

  it('caps a screen that is on by day, so it reads as a lit blue-ish panel and not as white', () => {
    expect(DAY_SCREEN_GLOW).toBeGreaterThan(0);
    expect(DAY_SCREEN_GLOW).toBeLessThanOrEqual(0.2);
    for (const kind of ['tv', 'pc']) {
      expect(glowFactor('on', 0, kind)).toBe(DAY_SCREEN_GLOW);
      expect(glowFactor('on', 0.5, kind)).toBeCloseTo(
        DAY_SCREEN_GLOW + (1 - DAY_SCREEN_GLOW) * 0.5,
        9,
      );
      expect(glowFactor('on', 1, kind)).toBe(1); // the night look is the exported one
      expect(glowFactor('off', 0, kind)).toBe(0);
      expect(glowFactor('auto', 0.4, kind)).toBe(0.4); // and so is what a screen does by itself
      expect(glowFactor(undefined, 1, kind)).toBe(1);
    }
  });

  it('does not cap lights, by day or at night', () => {
    expect(glowFactor('on', 0, 'light')).toBe(1);
    expect(glowFactor('on', 0, 'lights')).toBe(1);
    expect(glowFactor('on', 0.5, 'light')).toBe(1);
  });

  it('never makes an on screen dimmer than the same screen on auto', () => {
    for (let night = 0; night <= 1; night += 0.05)
      expect(glowFactor('on', night, 'tv')).toBeGreaterThanOrEqual(glowFactor('auto', night, 'tv'));
  });
});

describe('hintFor', () => {
  it('says in English what a click will do', () => {
    expect(hintFor('tv', false)).toBe('Click to switch on');
    expect(hintFor('light', true)).toBe('Click to switch off');
    expect(hintFor('door', false)).toBe('Click to open');
    expect(hintFor('door', true)).toBe('Click to close');
  });
});

describe('the toggles store', () => {
  it('starts every group on auto and steps a group with nextToggle', () => {
    useAppStore.setState({ toggles: {} });
    expect(useAppStore.getState().toggles).toEqual({});
    useAppStore.getState().toggle('tv:TV_wall', false);
    expect(useAppStore.getState().toggles).toEqual({ 'tv:TV_wall': 'on' });
    useAppStore.getState().toggle('tv:TV_wall', true);
    useAppStore.getState().toggle('light:living', true);
    expect(useAppStore.getState().toggles).toEqual({ 'tv:TV_wall': 'off', 'light:living': 'off' });
  });

  it("counts the clicks that play a group's one-shot clip, and toggles nothing for them", () => {
    useAppStore.setState({ toggles: {}, plays: {} });
    useAppStore.getState().play('dog');
    useAppStore.getState().play('dog');
    expect(useAppStore.getState().plays).toEqual({ dog: 2 });
    expect(useAppStore.getState().toggles).toEqual({});
  });

  it('remembers where the koi were last fed and when, and toggles nothing for it', () => {
    useAppStore.setState({ toggles: {}, feed: null });
    useAppStore.getState().feedKoi([12, -0.07, 9], 30);
    expect(useAppStore.getState().feed).toEqual({ point: [12, -0.07, 9], at: 30 });
    expect(useAppStore.getState().toggles).toEqual({});
  });
});

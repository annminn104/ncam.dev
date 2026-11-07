import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES, DEFAULT_CLEAR_LOOK } from '../clear-looks';
import { DEFAULT_LOOK_STATE, lookLabel, lookOf, lookSwatch, type LookState } from '../looks';
import type { ModelLoad } from '../scene-props';
import { SKINS } from '../skins';
import { textOf as text } from '../testing/markup';
import {
  LookMenu,
  LookPicker,
  loadLine,
  optionForKey,
  optionForPress,
  tickOn,
  type KeyPress,
} from './LookPicker';

const picker = (look: LookState) =>
  renderToString(createElement(LookPicker, { look, onChange: () => {}, load: null }));
const menu = (look: LookState, load: ModelLoad | null = null, open = true) =>
  renderToString(createElement(LookMenu, { look, open, onChange: () => {}, load }));
const groups = (html: string) =>
  [...html.matchAll(/role="radiogroup" aria-label="([^"]+)"/g)].map((m) => m[1]);
const CLEAR: LookState = { ...DEFAULT_LOOK_STATE, model: 'clear' };
const RADIO =
  /<button type="button" role="radio" aria-checked="(true|false)" tabindex="(0|-1)"[^>]*>(.*?)<\/button>/g;

describe('LookPicker (server markup)', () => {
  it('renders Player closed, named for the look, with its swatch', () => {
    const html = picker(DEFAULT_LOOK_STATE);
    expect(html).toContain(
      '<button type="button" class="cdp-button cdp-skin__button" aria-expanded="false" aria-controls="cdp-skin-menu">',
    );
    expect(html).toContain(
      `<span class="cdp-skin__swatch" style="background-color:${lookSwatch(lookOf(DEFAULT_LOOK_STATE))}" aria-hidden="true"></span><span class="cdp-skin__label">Player</span>`,
    );
    expect(html).toContain(
      `<span class="cdp-sr">${lookLabel(lookOf(DEFAULT_LOOK_STATE)).replace('Player', '')}</span>`,
    );
    expect(picker(CLEAR)).toContain(lookLabel(lookOf(CLEAR)).replace('Player', ''));
    expect(picker(CLEAR)).toContain(`background-color:${lookSwatch(lookOf(CLEAR))}`);
  });

  it('shows the skin it is given', () => {
    expect(picker({ ...DEFAULT_LOOK_STATE, skin: 'cherry' })).toContain(': Suitcase, Cherry');
  });

  it('renders the same markup every time, so the server and the first client render agree', () => {
    const look = { ...DEFAULT_LOOK_STATE, skin: 'sage' } as const;
    expect(picker(look)).toBe(picker(look));
  });
});

describe('LookMenu', () => {
  it('offers the model first, then the suitcase’s four skins', () => {
    const html = menu(DEFAULT_LOOK_STATE);
    expect(groups(html)).toEqual(['Model', 'Player colour']);
    expect(html).toMatch(/role="radio" aria-checked="true" tabindex="0"[^>]*>(<[^>]+>)*Suitcase/);
  });

  it('lists the skins in order, the current one checked and its group’s only tab stop', () => {
    const html = menu({ ...DEFAULT_LOOK_STATE, skin: 'sage' });
    const skins = html.slice(html.indexOf('aria-label="Player colour"'));
    const radios = [...skins.matchAll(RADIO)];
    expect(radios.map((m) => text(m[3]))).toEqual(SKINS.map((skin) => skin.name));
    expect(radios.map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'false -1',
      'true 0',
      'false -1',
      'false -1',
    ]);
  });

  it('marks the choice with a tick, not colour alone', () => {
    const html = menu({ ...DEFAULT_LOOK_STATE, skin: 'cream' });
    const skins = html.slice(html.indexOf('aria-label="Player colour"'));
    const radios = [...skins.matchAll(RADIO)];
    expect(radios.map((m) => m[3].includes('<svg'))).toEqual([false, false, true, false]);
  });

  it('offers the model first, then the Clear model’s four parts, each its own group', () => {
    const html = menu(CLEAR);
    expect(groups(html)).toEqual(['Model', 'Shell', 'Frame', 'Board', 'Light']);
    for (const swatch of CLEAR_SWATCHES.light)
      expect(html).toContain(`aria-label="${swatch.name}"`);
    expect([...html.matchAll(/aria-checked="true"/g)]).toHaveLength(5);
    expect(DEFAULT_CLEAR_LOOK.light).toBe('ice');
  });

  it('is hidden while closed and shown while open', () => {
    expect(menu(DEFAULT_LOOK_STATE, null, false)).toMatch(
      /<div id="cdp-skin-menu" class="cdp-skin__menu" hidden="">/,
    );
    expect(menu(DEFAULT_LOOK_STATE, null, true)).not.toContain('hidden=""');
  });

  it('says how the model’s download goes, and when it failed', () => {
    expect(loadLine({ model: 'clear', status: 'loading', fraction: 0.63 })).toBe('Loading 63%');
    expect(loadLine({ model: 'clear', status: 'loading', fraction: null })).toBe('Loading…');
    expect(loadLine({ model: 'clear', status: 'failed' })).toBe("Couldn't load Clear");
    expect(loadLine({ model: 'clear', status: 'ready' })).toBeNull();
    expect(loadLine(null)).toBeNull();
  });

  it('shows the load line of the model the look wants', () => {
    const html = menu(CLEAR, { model: 'clear', status: 'loading', fraction: 0.5 });
    expect(html).toContain('<p class="cdp-skin__load" role="status">Loading 50%</p>');
  });

  it('says a model failed even after the look went back to the one on show', () => {
    const html = menu(DEFAULT_LOOK_STATE, { model: 'clear', status: 'failed' });
    expect(html).toContain('<p class="cdp-skin__load" role="status">Couldn&#x27;t load Clear</p>');
  });

  it('keeps its status line in the markup, empty, so a later line is announced', () => {
    expect(menu(DEFAULT_LOOK_STATE)).toContain('<p class="cdp-skin__load" role="status"></p>');
  });

  it('puts a white tick on a dark swatch and the ink on a light one', () => {
    expect(tickOn('#000000')).toBe('light');
    expect(tickOn('#1a1a1a')).toBe('light');
    expect(tickOn('#ffffff')).toBe('dark');
    expect(tickOn('#c0c0c0')).toBe('dark');
    const html = menu(CLEAR);
    expect(html).toContain('aria-label="Black" class="cdp-skin__dot cdp-skin__dot--dark"');
    expect(html).toContain('aria-label="Purple" class="cdp-skin__dot cdp-skin__dot--dark"');
    expect(html).toContain('aria-label="Silver" class="cdp-skin__dot"');
  });
});

describe('the keys (the menu keeps a key it picks with from the page, and only that)', () => {
  const ids = ['a', 'b', 'c'];
  const press = (key: string, held: Partial<KeyPress> = {}): KeyPress => ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...held,
  });

  it('steps with the arrows, wrapping at both ends', () => {
    expect(optionForKey('ArrowRight', ids, 'a')).toBe('b');
    expect(optionForKey('ArrowDown', ids, 'b')).toBe('c');
    expect(optionForKey('ArrowRight', ids, 'c')).toBe('a');
    expect(optionForKey('ArrowLeft', ids, 'a')).toBe('c');
    expect(optionForKey('ArrowUp', ids, 'b')).toBe('a');
  });

  it('jumps with Home and End, and ignores every other key', () => {
    expect(optionForKey('Home', ids, 'b')).toBe('a');
    expect(optionForKey('End', ids, 'a')).toBe('c');
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a']) {
      expect(optionForKey(key, ids, 'b'), key).toBeNull();
    }
  });

  it('picks on a plain arrow, Home or End', () => {
    expect(optionForPress(press('ArrowRight'), ids, 'a')).toBe('b');
    expect(optionForPress(press('ArrowUp'), ids, 'a')).toBe('c');
    expect(optionForPress(press('End'), ids, 'a')).toBe('c');
    expect(optionForPress(press('Home'), ids, 'c')).toBe('a');
  });

  it('leaves Alt, Ctrl and Cmd with a key to the browser: Alt+Arrow is Back and Forward', () => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      for (const key of keys) {
        expect(optionForPress(press(key, held), ids, 'a'), `${Object.keys(held)[0]} + ${key}`).toBe(
          null,
        );
      }
    }
  });

  it('passes every other key through', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a']) {
      expect(optionForPress(press(key), ids, 'b'), key).toBeNull();
    }
  });
});

describe('LookPicker opening', () => {
  it('brings the popover into view, then focuses without a second scroll', () => {
    // No DOM in this repo's tests: the wiring is read from the source.
    const source = readFileSync(new URL('./LookPicker.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/scrollIntoView\(\{ block: 'nearest' \}\)/);
    expect(source).toMatch(/focus\(\{ preventScroll: true \}\)/);
  });

  it('puts focus back on the checked model when a change unmounts the focused part', () => {
    // A failed change returns the look to the Suitcase: the Clear's groups unmount under the focus
    // and it falls to <body>. An effect keyed on the look's model brings it back to the menu.
    const source = readFileSync(new URL('./LookPicker.tsx', import.meta.url), 'utf8');
    const effect = source.match(/useEffect\(\(\) => \{[^]*?\}, \[open, look\.model\]\)/);
    expect(effect?.[0]).toMatch(/document\.activeElement/);
    expect(effect?.[0]).toMatch(/\[role="radio"\]\[aria-checked="true"\]/);
    expect(effect?.[0]).toMatch(/focus\(\{ preventScroll: true \}\)/);
  });
});

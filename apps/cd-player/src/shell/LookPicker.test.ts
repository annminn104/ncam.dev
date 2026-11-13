import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES, DEFAULT_CLEAR_LOOK } from '../clear-looks';
import { DECK_SWATCHES, DEFAULT_DECK_LOOK } from '../deck-looks';
import { DEFAULT_LOOK_STATE, lookLabel, lookOf, lookSwatch, type LookState } from '../looks';
import { DEFAULT_LUXE_LOOK, LUXE_SWATCHES } from '../luxe-looks';
import { DEFAULT_PERSONAL, PATTERNS } from '../personal';
import type { ModelLoad } from '../scene-props';
import { SKINS } from '../skins';
import { textOf as text } from '../testing/markup';
import {
  LookMenu,
  LookPicker,
  loadLine,
  optionForKey,
  nameEdit,
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
/** Every element of a React element tree, depth first, so a test can find a group by its label. */
const walk = (node: unknown, out: { props: Record<string, unknown> }[] = []) => {
  if (Array.isArray(node)) for (const k of node) walk(k, out);
  else if (node && typeof node === 'object') {
    const el = node as { props?: Record<string, unknown> };
    if (el.props) out.push(el as { props: Record<string, unknown> });
    const kids = el.props?.children;
    for (const k of Array.isArray(kids) ? kids : [kids]) walk(k, out);
  }
  return out;
};
const CLEAR: LookState = { ...DEFAULT_LOOK_STATE, model: 'clear' };
const DECK: LookState = { ...DEFAULT_LOOK_STATE, model: 'deck' };
const LUXE: LookState = { ...DEFAULT_LOOK_STATE, model: 'luxe' };
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

  it('offers the Deck its Body and Light, as dots, with the look’s ids ticked', () => {
    const html = menu(DECK);
    expect(groups(html)).toEqual(['Model', 'Body', 'Light', 'Pattern']);
    const models = html.slice(
      html.indexOf('aria-label="Model"'),
      html.indexOf('aria-label="Body"'),
    );
    for (const name of ['Suitcase', 'Clear', 'Deck']) expect(models).toContain(name);
    for (const part of ['body', 'light'] as const)
      for (const swatch of DECK_SWATCHES[part])
        expect(html).toContain(`aria-label="${swatch.name}"`);
    expect(DECK_SWATCHES.body).toHaveLength(3);
    expect(DECK_SWATCHES.light).toHaveLength(6);
    expect([...html.matchAll(/aria-checked="true"/g)]).toHaveLength(4);
    const ticked = (label: string, next: string) => {
      const from = html.indexOf(`aria-label="${label}"`);
      const end = next ? html.indexOf(`aria-label="${next}"`) : html.length;
      const m = [...html.slice(from, end).matchAll(RADIO)].find((r) => r[1] === 'true');
      return m?.[3].includes('<svg');
    };
    expect(ticked('Body', 'Light')).toBe(true);
    expect(ticked('Light', 'Pattern')).toBe(true);
    expect(DEFAULT_DECK_LOOK).toEqual({ body: 'black', light: 'ice' });
  });

  it('changes only the Deck’s light when a light is picked', () => {
    const seen: LookState[] = [];
    const tree = LookMenu({ look: DECK, open: true, onChange: (n) => seen.push(n), load: null });
    const lightGroup = walk(tree).find(
      (n) => (n.props.group as { label?: string } | undefined)?.label === 'Light',
    )!.props.group as { pick(id: string): void };
    lightGroup.pick('violet');
    expect(seen).toEqual([{ ...DECK, deck: { ...DEFAULT_DECK_LOOK, light: 'violet' } }]);
  });

  it('offers the Deck a Pattern group of seven rows and a name field', () => {
    const html = menu({ ...DECK, personal: { pattern: 'waves', name: 'Lan' } });
    expect(groups(html)).toEqual(['Model', 'Body', 'Light', 'Pattern']);
    const pattern = html.slice(html.indexOf('aria-label="Pattern"'));
    const rows = [...pattern.matchAll(RADIO)];
    expect(rows.map((row) => text(row[3]))).toEqual(PATTERNS.map((p) => p.name));
    expect(rows.filter((row) => row[1] === 'true').map((row) => text(row[3]))).toEqual([
      'Sound waves',
    ]);
    const input = /<input [^>]*>/.exec(html)![0];
    expect(input).toContain('type="text"');
    expect(input).toContain('value="Lan"');
    expect(input).toContain('placeholder="ncam"');
    expect(html).toMatch(/<span class="cdp-skin__legend">Your name<\/span><input /);
    expect(html.indexOf('<input')).toBeGreaterThan(html.indexOf('aria-label="Pattern"'));
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('role="status"'));
  });

  it('shows neither Pattern nor the name field on the suitcase or the Clear', () => {
    for (const look of [DEFAULT_LOOK_STATE, CLEAR]) {
      const html = menu(look);
      expect(groups(html)).not.toContain('Pattern');
      expect(html).not.toContain('<input');
    }
  });

  it('picking a pattern changes only the personal pattern', () => {
    const seen: LookState[] = [];
    const look = { ...DECK, personal: { pattern: 'music' as const, name: 'Lan' } };
    const tree = LookMenu({ look, open: true, onChange: (n) => seen.push(n), load: null });
    const group = walk(tree).find(
      (n) => (n.props.group as { label?: string } | undefined)?.label === 'Pattern',
    )!.props.group as { pick(id: string): void };
    group.pick('graffiti');
    expect(seen).toEqual([{ ...look, personal: { pattern: 'graffiti', name: 'Lan' } }]);
    expect(DEFAULT_LOOK_STATE.personal).toEqual(DEFAULT_PERSONAL);
  });

  it('offers Luxe its Body, Metal and Light, as dots, no Pattern and no name', () => {
    const html = menu(LUXE);
    expect(groups(html)).toEqual(['Model', 'Body', 'Metal', 'Light']);
    expect(html).not.toContain('<input');
    for (const s of LUXE_SWATCHES.metal) expect(html).toContain(`aria-label="${s.name}"`);
  });

  it('changes only Luxe’s metal when a metal is picked', () => {
    const seen: LookState[] = [];
    const tree = LookMenu({ look: LUXE, open: true, onChange: (n) => seen.push(n), load: null });
    const metal = walk(tree).find(
      (n) => (n.props.group as { label?: string } | undefined)?.label === 'Metal',
    )!.props.group as { pick(id: string): void };
    metal.pick('chrome');
    expect(seen).toEqual([{ ...LUXE, luxe: { ...DEFAULT_LUXE_LOOK, metal: 'chrome' } }]);
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

describe('nameEdit', () => {
  it('only drafts the raw text mid-composition, and cleans and keeps it otherwise', () => {
    const raw = 'Ho' + String.fromCodePoint(0x61, 0x300) + '<ng';
    expect(nameEdit(true, raw)).toEqual({ draft: raw, name: null });
    expect(nameEdit(false, raw)).toEqual({ draft: null, name: 'Hoàng' });
  });
});

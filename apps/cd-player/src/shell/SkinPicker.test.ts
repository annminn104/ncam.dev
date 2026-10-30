import { createElement, type KeyboardEvent, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SKINS, skinById, type SkinId } from '../skins';
import { SkinMenu, SkinPicker, skinForKey } from './SkinPicker';

const picker = (skin: SkinId) =>
  renderToString(createElement(SkinPicker, { skin, onChange: () => {} }));
const menu = (skin: SkinId, open: boolean) =>
  renderToString(createElement(SkinMenu, { skin, open, onPick: () => {} }));
const RADIO =
  /<button type="button" role="radio" aria-checked="(true|false)" tabindex="(0|-1)" class="cdp-skin__option">(.*?)<\/button>/g;
const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('SkinPicker (server markup)', () => {
  it('renders Player closed, with the current skin swatch and its name', () => {
    const html = picker('blush');
    expect(html).toContain(
      '<button type="button" class="cdp-button cdp-skin__button" aria-expanded="false" aria-controls="cdp-skin-menu">',
    );
    expect(html).toContain(
      `<span class="cdp-skin__swatch" style="background-color:${skinById('blush').palette.leather}" aria-hidden="true"></span><span class="cdp-skin__label">Player</span><span class="cdp-sr"> colour: Blush</span>`,
    );
    expect(html).toContain(
      '<div id="cdp-skin-menu" class="cdp-skin__menu" role="radiogroup" aria-label="Player colour" hidden="">',
    );
  });

  it('shows the skin it is given', () => {
    expect(picker('cherry')).toContain(
      `style="background-color:${skinById('cherry').palette.leather}" aria-hidden="true"></span><span class="cdp-skin__label">Player</span><span class="cdp-sr"> colour: Cherry</span>`,
    );
  });

  it('renders the same markup every time, so the server and the first client render agree', () => {
    expect(picker('sage')).toBe(picker('sage'));
  });
});

describe('SkinMenu', () => {
  it('lists the four in order, the current one checked and the only tab stop', () => {
    const radios = [...menu('sage', true).matchAll(RADIO)];
    expect(radios.map((m) => text(m[3]))).toEqual(SKINS.map((skin) => skin.name));
    expect(radios.map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'false -1',
      'true 0',
      'false -1',
      'false -1',
    ]);
  });

  it('marks the choice with a tick, not colour alone', () => {
    const radios = [...menu('cream', true).matchAll(RADIO)];
    expect(radios.map((m) => m[3].includes('<svg'))).toEqual([false, false, true, false]);
  });

  it('is hidden while closed and shown while open', () => {
    expect(menu('blush', false)).toContain('aria-label="Player colour" hidden=""');
    expect(menu('blush', true)).not.toContain('hidden=""');
  });
});

describe('SkinMenu keys', () => {
  type Held = { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };

  /**
   * Presses `key` on the menu with Blush checked: what it picked, and whether it kept the key from
   * the browser. SkinMenu holds no hook, so calling it gives back the element, and the real
   * handler is on its props (no DOM is needed to run it).
   */
  function press(key: string, held: Held = {}) {
    const picked: SkinId[] = [];
    const menu = SkinMenu({ skin: 'blush', open: true, onPick: (id) => picked.push(id) });
    const { onKeyDown } = (menu as ReactElement<{ onKeyDown(event: KeyboardEvent): void }>).props;
    const preventDefault = vi.fn();
    const event = { key, altKey: false, ctrlKey: false, metaKey: false, ...held, preventDefault };
    onKeyDown(event as unknown as KeyboardEvent);
    return { picked, kept: preventDefault.mock.calls.length > 0 };
  }

  it('picks on an arrow, Home or End, and keeps the key from the page', () => {
    expect(press('ArrowRight')).toEqual({ picked: ['sage'], kept: true });
    expect(press('ArrowUp')).toEqual({ picked: ['cherry'], kept: true });
    expect(press('End')).toEqual({ picked: ['cherry'], kept: true });
  });

  it('leaves Alt, Ctrl and Cmd with a key to the browser: Alt+Arrow is Back and Forward', () => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      for (const key of keys) {
        expect(press(key, held), `${Object.keys(held)[0]} + ${key}`).toEqual({
          picked: [],
          kept: false,
        });
      }
    }
  });
});

describe('skinForKey', () => {
  it('steps with the arrows, wrapping at both ends', () => {
    expect(skinForKey('ArrowRight', 'blush')).toBe('sage');
    expect(skinForKey('ArrowDown', 'cream')).toBe('cherry');
    expect(skinForKey('ArrowRight', 'cherry')).toBe('blush');
    expect(skinForKey('ArrowLeft', 'sage')).toBe('blush');
    expect(skinForKey('ArrowUp', 'blush')).toBe('cherry');
  });

  it('jumps with Home and End, and ignores every other key', () => {
    expect(skinForKey('Home', 'cream')).toBe('blush');
    expect(skinForKey('End', 'sage')).toBe('cherry');
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a']) {
      expect(skinForKey(key, 'sage'), key).toBeNull();
    }
  });
});

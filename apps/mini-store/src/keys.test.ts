import { describe, expect, it } from 'vitest';
import { takesText } from './keys';

describe('takesText', () => {
  it('lets shortcuts through from the settings panel controls', () => {
    expect(takesText('INPUT', 'range', false)).toBe(false);
    expect(takesText('INPUT', 'checkbox', false)).toBe(false);
  });

  it('lets shortcuts through from other controls that take no text', () => {
    for (const type of ['radio', 'button', 'submit', 'reset', 'color', 'file', 'image']) {
      expect(takesText('INPUT', type, false)).toBe(false);
    }
    expect(takesText('BUTTON', null, false)).toBe(false);
  });

  it('holds shortcuts back while the visitor types in an input', () => {
    expect(takesText('INPUT', 'text', false)).toBe(true);
    expect(takesText('INPUT', 'search', false)).toBe(true);
    expect(takesText('INPUT', 'email', false)).toBe(true);
    // An input with no type attribute is a text input.
    expect(takesText('INPUT', null, false)).toBe(true);
  });

  it('holds shortcuts back in a textarea, a select and a contenteditable element', () => {
    expect(takesText('TEXTAREA', null, false)).toBe(true);
    expect(takesText('SELECT', null, false)).toBe(true);
    expect(takesText('DIV', null, true)).toBe(true);
  });

  it('reads tag names and input types in any case', () => {
    expect(takesText('input', 'RANGE', false)).toBe(false);
    expect(takesText('textarea', null, false)).toBe(true);
  });
});

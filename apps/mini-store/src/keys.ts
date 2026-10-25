// Whether a focused element takes typed text, so the page's single-key shortcuts (C, H, O, Esc)
// must stand aside. DOM-free, so node tests can cover every case; App.tsx reads the element.

/** `<input>` types that take no typed text: the settings panel's range and checkbox among them. */
const NO_TEXT_INPUTS = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'color',
  'file',
  'image',
]);

/**
 * True for a textarea, a select, a contenteditable element, and an `<input>` whose type takes
 * text (a missing or unknown type is text, as in the browser). `inputType` is null off inputs.
 */
export function takesText(tagName: string, inputType: string | null, editable: boolean): boolean {
  if (editable) return true;
  switch (tagName.toUpperCase()) {
    case 'TEXTAREA':
    case 'SELECT':
      return true;
    case 'INPUT':
      return !NO_TEXT_INPUTS.has((inputType ?? 'text').toLowerCase());
    default:
      return false;
  }
}

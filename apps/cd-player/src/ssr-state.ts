import type { InitialData } from './playback/engine';

/** The `<script type="application/json">` the server render writes inside the remote's markup. */
export const SSR_STATE_ID = 'cdp-state';

/** JSON that cannot end the script element or open an HTML comment. */
export function serialiseState(state: InitialData | null): string {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u{2028}/gu, '\\u2028')
    .replace(/\u{2029}/gu, '\\u2029');
}

export function parseState(text: string | null | undefined): InitialData | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as InitialData | null;
    return value && typeof value === 'object' && 'ref' in value ? value : null;
  } catch {
    return null;
  }
}

export function readState(doc: Document): InitialData | null {
  return parseState(doc.getElementById(SSR_STATE_ID)?.textContent);
}

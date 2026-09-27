export const SSR_STATE_ID = 'holodex-state';

/**
 * JSON for a `<script type="application/json">` block. The host injects our
 * HTML with dangerouslySetInnerHTML, which parses it as markup — so a literal
 * `</script>` inside the payload would end the element early. `<` is escaped
 * to its unicode form, which JSON.parse reads back as the original character.
 */
export function serialiseState(state: unknown): string {
  return JSON.stringify(state).replace(/</g, '\\u003c');
}

interface StateDocument {
  getElementById: (id: string) => { textContent: string | null } | null;
}

/**
 * The payload's raw JSON text, exactly as the server wrote it.
 *
 * `hydrate` reads the state (through `readState`) before `hydrateRoot`, since
 * react-query needs it to build its client. It renders the script element
 * back from `serialiseState(state)`, never from this raw text: page text
 * written back as HTML is how DOM XSS happens, and re-serialising what the
 * server serialised yields the same string anyway.
 */
export function readStateJson(doc: StateDocument): string | null {
  return doc.getElementById(SSR_STATE_ID)?.textContent || null;
}

/** Degraded, not broken: on anything unparseable react-query refetches. */
export function parseState(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function readState(doc: StateDocument): unknown {
  return parseState(readStateJson(doc));
}

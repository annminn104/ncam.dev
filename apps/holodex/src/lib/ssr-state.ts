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

export function readState(doc: {
  getElementById: (id: string) => { textContent: string | null } | null;
}): unknown {
  const raw = doc.getElementById(SSR_STATE_ID)?.textContent;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // Degraded, not broken: react-query refetches on the client.
    return undefined;
  }
}

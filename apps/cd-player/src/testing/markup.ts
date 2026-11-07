/**
 * The text of server markup with its tags taken out, as a screen reader reads it: the runs of text
 * between one tag's `>` and the next tag's `<`. React escapes `<` and `>` in text and in attribute
 * values, so neither stands inside a run or inside a tag.
 */
export function textOf(html: string): string {
  return [...`>${html}<`.matchAll(/>([^<]*)</g)].map(([, run]) => run).join('');
}

import type { SceneView } from '../../bridge';
import { deckSwatch } from '../../deck-looks';
import type { Look } from '../../looks';
import { engraving, styleFor, type Personal } from '../../personal';
import { collectionSeed, patternKey, type PatternPrint } from './deck-pattern';

/** How long the print waits after a key typed into the name before it paints. */
export const NAME_SETTLE_MS = 150;

/** What the atlas prints for a look, the visitor's marks and the view: nothing off the Deck. */
export function printFor(look: Look, personal: Personal, view: SceneView): PatternPrint | null {
  if (look.model !== 'deck') return null;
  const seed = collectionSeed(view.collection?.key ?? null);
  return {
    style: styleFor(personal.pattern, seed),
    seed,
    light: deckSwatch(look.deck, 'light'),
    body: deckSwatch(look.deck, 'body'),
    name: engraving(personal.name),
    collection: view.collection?.name ?? '',
  };
}

/** Whether going from `before` to `after` changes the name alone: typing, which waits a moment. */
export function nameOnly(before: PatternPrint | null, after: PatternPrint): boolean {
  return (
    before !== null &&
    before.name !== after.name &&
    patternKey({ ...before, name: after.name }) === patternKey(after)
  );
}

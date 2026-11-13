import type { SceneView } from '../../bridge';
import { FACES_WAIT_MS, loadFaces } from './paint';
import { settlesWithin } from './painter';

/** What the plate (and a CD player's tag) prints of the collection: its name over its subtitle. */
export function collectionLabel(collection: SceneView['collection']): string {
  return collection ? `${collection.name}\n${collection.subtitle}` : '';
}

/**
 * Prints `label` with `print` once the page's faces for it are in. A font that stalls does not
 * hold it: past FACES_WAIT_MS it goes out in the fallback faces, and again once they come. A print
 * whose label is no longer `current()` by then (a newer collection) draws nothing.
 */
export function printInFaces(label: string, current: () => string, print: () => void): void {
  const faces = loadFaces(label);
  const once = () => {
    if (current() === label) print();
  };
  void settlesWithin(faces, FACES_WAIT_MS).then((inTime) => {
    once();
    if (!inTime) void faces.then(once);
  });
}

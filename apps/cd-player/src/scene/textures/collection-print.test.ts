import { describe, expect, it } from 'vitest';
import { collectionLabel, printInFaces } from './collection-print';

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('collectionLabel', () => {
  it('is the name over the subtitle, and nothing without a collection', () => {
    expect(
      collectionLabel({ name: 'Top 50 - Global', subtitle: 'Spotify', key: 'playlist:x' }),
    ).toBe('Top 50 - Global\nSpotify');
    expect(collectionLabel(null)).toBe('');
  });
});

describe('printInFaces', () => {
  it('prints once its faces are in (at once where nothing loads fonts)', async () => {
    let prints = 0;
    printInFaces(
      'A\nB',
      () => 'A\nB',
      () => (prints += 1),
    );
    await flush();
    expect(prints).toBe(1);
  });

  it('prints nothing for a label a newer collection has overtaken', async () => {
    let prints = 0;
    printInFaces(
      'A\nB',
      () => 'C\nD',
      () => (prints += 1),
    );
    await flush();
    expect(prints).toBe(0);
  });
});

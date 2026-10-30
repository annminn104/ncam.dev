import { describe, expect, it } from 'vitest';
import {
  readLast,
  readSkin,
  restoreTarget,
  SKIN_KEY,
  STORAGE_KEY,
  writeLast,
  writeSkin,
} from './persist';
import { DEFAULT_COLLECTION, type CollectionRef } from './routes';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}
const ID = '37i9dQZEVXbMDoHDwVN2tF';

describe('persist', () => {
  it('round-trips the last collection', () => {
    const storage = memory();
    writeLast(storage, { type: 'album', id: ID });
    expect(storage.data.get(STORAGE_KEY)).toBe(JSON.stringify({ type: 'album', id: ID }));
    expect(readLast(storage)).toEqual({ type: 'album', id: ID });
  });

  it('ignores junk, wrong types, missing storage and throwing storage', () => {
    expect(readLast(memory({ [STORAGE_KEY]: '{nope' }))).toBeNull();
    expect(
      readLast(memory({ [STORAGE_KEY]: JSON.stringify({ type: 'track', id: ID }) })),
    ).toBeNull();
    expect(
      readLast(memory({ [STORAGE_KEY]: JSON.stringify({ type: 'album', id: 'short' }) })),
    ).toBeNull();
    expect(readLast(null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readLast(broken)).toBeNull();
    expect(() => writeLast(broken, { type: 'album', id: ID })).not.toThrow();
  });
});

describe('the saved skin', () => {
  it('round-trips under ncam.cd-player.skin, beside the saved collection', () => {
    const storage = memory();
    writeLast(storage, { type: 'album', id: ID });
    writeSkin(storage, 'cherry');
    expect(SKIN_KEY).toBe('ncam.cd-player.skin');
    expect(storage.data.get(SKIN_KEY)).toBe('cherry');
    expect(readSkin(storage)).toBe('cherry');
    expect(readLast(storage)).toEqual({ type: 'album', id: ID });
  });

  it('is Blush when nothing is saved, the value is no skin, or storage is missing or throws', () => {
    expect(readSkin(memory())).toBe('blush');
    for (const junk of ['midnight', '', '{"id":"sage"}', 'SAGE', 'toString']) {
      expect(readSkin(memory({ [SKIN_KEY]: junk })), junk).toBe('blush');
    }
    expect(readSkin(null)).toBe('blush');
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readSkin(broken)).toBe('blush');
    expect(() => writeSkin(broken, 'sage')).not.toThrow();
  });
});

describe('restoreTarget', () => {
  const saved: CollectionRef = { type: 'album', id: '64LU4c1nfjz1t4VnGhagcg' };

  it('sends `/` to the saved collection the first time this page load looks', () => {
    expect(restoreTarget('home', saved, false)).toEqual(saved);
  });

  it('stays put once this page load has looked, so Back to `/` is not bounced forward', () => {
    expect(restoreTarget('home', saved, true)).toBeNull();
  });

  it('leaves a collection URL alone', () => {
    expect(restoreTarget('collection', saved, false)).toBeNull();
  });

  it('has nowhere to go when the saved collection is the default one', () => {
    expect(restoreTarget('home', { ...DEFAULT_COLLECTION }, false)).toBeNull();
  });

  it('has nowhere to go when nothing is saved', () => {
    expect(restoreTarget('home', null, false)).toBeNull();
  });
});

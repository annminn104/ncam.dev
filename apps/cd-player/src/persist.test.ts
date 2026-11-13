import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES, DEFAULT_CLEAR_LOOK } from './clear-looks';
import {
  CLEAR_KEY,
  DECK_KEY,
  LOOK_SCRIPT,
  LUXE_KEY,
  MODEL_KEY,
  PERSONAL_KEY,
  readClearLook,
  readDeckLook,
  readLast,
  readLookState,
  readLuxeLook,
  readModel,
  readPersonal,
  readSkin,
  restoreTarget,
  scriptLiteral,
  SKIN_KEY,
  STORAGE_KEY,
  writeClearLook,
  writeDeckLook,
  writeLast,
  writeLuxeLook,
  writeModel,
  writePersonal,
  writeSkin,
} from './persist';
import { DECK_SWATCHES, DEFAULT_DECK_LOOK } from './deck-looks';
import { DEFAULT_LUXE_LOOK, LUXE_SWATCHES } from './luxe-looks';
import { DEFAULT_PERSONAL } from './personal';
import { DEFAULT_COLLECTION, type CollectionRef } from './routes';
import { SKINS } from './skins';

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

describe('the saved model and the Clear model’s colours', () => {
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };

  it('round-trips the model under ncam.cd-player.model, the suitcase for anything else', () => {
    const storage = memory();
    writeModel(storage, 'clear');
    expect(MODEL_KEY).toBe('ncam.cd-player.model');
    expect(readModel(storage)).toBe('clear');
    for (const junk of ['glass', '', 'Clear']) {
      expect(readModel(memory({ [MODEL_KEY]: junk })), junk).toBe('suitcase');
    }
    expect(readModel(null)).toBe('suitcase');
    expect(readModel(broken)).toBe('suitcase');
    expect(() => writeModel(broken, 'clear')).not.toThrow();
  });

  it('round-trips the Clear look as JSON, part by part', () => {
    const storage = memory();
    const look = { shell: 'smoke', frame: 'black', board: 'purple', light: 'pink' };
    writeClearLook(storage, look);
    expect(CLEAR_KEY).toBe('ncam.cd-player.clear');
    expect(readClearLook(storage)).toEqual(look);
    expect(readClearLook(memory({ [CLEAR_KEY]: '{"shell":"smoke","light":"neon"}' }))).toEqual({
      ...DEFAULT_CLEAR_LOOK,
      shell: 'smoke',
    });
    for (const junk of ['{nope', '"clear"', 'null', '[]']) {
      expect(readClearLook(memory({ [CLEAR_KEY]: junk })), junk).toEqual(DEFAULT_CLEAR_LOOK);
    }
    expect(readClearLook(broken)).toEqual(DEFAULT_CLEAR_LOOK);
  });

  it('round-trips the Deck look as JSON, part by part', () => {
    const storage = memory();
    const look = { body: 'silver', light: 'violet' };
    writeDeckLook(storage, look);
    expect(DECK_KEY).toBe('ncam.cd-player.deck');
    expect(readDeckLook(storage)).toEqual(look);
    expect(readDeckLook(memory({ [DECK_KEY]: '{"body":"silver","light":"neon"}' }))).toEqual({
      ...DEFAULT_DECK_LOOK,
      body: 'silver',
    });
    for (const junk of ['{nope', '"deck"', 'null', '[]']) {
      expect(readDeckLook(memory({ [DECK_KEY]: junk })), junk).toEqual(DEFAULT_DECK_LOOK);
    }
    expect(readDeckLook(null)).toEqual(DEFAULT_DECK_LOOK);
    expect(readDeckLook(broken)).toEqual(DEFAULT_DECK_LOOK);
    expect(() => writeDeckLook(broken, look)).not.toThrow();
  });

  it('round-trips Luxe’s look as JSON, part by part', () => {
    const storage = memory();
    const look = { body: 'rose', metal: 'chrome', light: 'amber' };
    writeLuxeLook(storage, look);
    expect(LUXE_KEY).toBe('ncam.cd-player.luxe');
    expect(readLuxeLook(storage)).toEqual(look);
    expect(readLuxeLook(memory({ [LUXE_KEY]: '{"body":"rose","metal":"brass"}' }))).toEqual({
      ...DEFAULT_LUXE_LOOK,
      body: 'rose',
    });
    for (const junk of ['{nope', '"luxe"', 'null', '[]']) {
      expect(readLuxeLook(memory({ [LUXE_KEY]: junk })), junk).toEqual(DEFAULT_LUXE_LOOK);
    }
    expect(readLuxeLook(null)).toEqual(DEFAULT_LUXE_LOOK);
    expect(readLuxeLook(broken)).toEqual(DEFAULT_LUXE_LOOK);
    expect(() => writeLuxeLook(broken, look)).not.toThrow();
  });

  it('round-trips the visitor’s pattern and name as JSON', () => {
    const storage = memory();
    const personal = { pattern: 'circuit' as const, name: 'Lan Anh' };
    writePersonal(storage, personal);
    expect(PERSONAL_KEY).toBe('ncam.cd-player.personal');
    expect(readPersonal(storage)).toEqual(personal);
    for (const junk of ['{nope', '[]']) {
      expect(readPersonal(memory({ [PERSONAL_KEY]: junk })), junk).toEqual(DEFAULT_PERSONAL);
    }
    expect(readPersonal(memory())).toEqual(DEFAULT_PERSONAL);
    expect(readPersonal(null)).toEqual(DEFAULT_PERSONAL);
    expect(readPersonal(broken)).toEqual(DEFAULT_PERSONAL);
    expect(() => writePersonal(broken, personal)).not.toThrow();
  });

  it('reads the whole look state', () => {
    const storage = memory({
      [MODEL_KEY]: 'clear',
      [SKIN_KEY]: 'sage',
      [CLEAR_KEY]: '{"light":"lime"}',
      [DECK_KEY]: '{"light":"red"}',
      [LUXE_KEY]: '{"metal":"rose"}',
      [PERSONAL_KEY]: '{"pattern":"waves","name":"Lan"}',
    });
    expect(readLookState(storage)).toEqual({
      model: 'clear',
      skin: 'sage',
      clear: { ...DEFAULT_CLEAR_LOOK, light: 'lime' },
      deck: { ...DEFAULT_DECK_LOOK, light: 'red' },
      luxe: { ...DEFAULT_LUXE_LOOK, metal: 'rose' },
      personal: { pattern: 'waves', name: 'Lan' },
    });
  });
});

describe('LOOK_SCRIPT', () => {
  /** Runs it as the browser does, as the root's child; returns what it set on the root's style. */
  function paint(storage: Pick<Storage, 'getItem'> | null): Record<string, string> {
    const set: Record<string, string> = {};
    const style = { setProperty: (name: string, value: string) => void (set[name] = value) };
    runInNewContext(LOOK_SCRIPT, {
      ...(storage ? { localStorage: storage } : {}),
      document: { currentScript: { parentNode: { style } } },
    });
    return set;
  }

  it('paints the saved skin’s pair on the suitcase, as App renders it after hydrating', () => {
    for (const skin of SKINS) {
      expect(paint(memory({ [SKIN_KEY]: skin.id })), skin.id).toEqual({
        '--cdp-accent': skin.accent,
        '--cdp-on-accent': skin.onAccent,
      });
    }
    expect(paint(memory())).toEqual({});
  });

  it('paints nothing where readSkin finds no skin', () => {
    for (const junk of ['midnight', '', 'SAGE', 'toString', '__proto__', 'constructor']) {
      expect(paint(memory({ [SKIN_KEY]: junk })), junk).toEqual({});
    }
  });

  it('paints the saved light’s pair on the Deck, its default light’s for junk', () => {
    const pair = (id: string) => {
      const light = DECK_SWATCHES.light.find((l) => l.id === id)!;
      return { '--cdp-accent': light.accent, '--cdp-on-accent': light.onAccent };
    };
    expect(paint(memory({ [MODEL_KEY]: 'deck', [DECK_KEY]: '{"light":"violet"}' }))).toEqual(
      pair('violet'),
    );
    for (const junk of [undefined, '{nope', '{"light":"neon"}', '{"light":"__proto__"}']) {
      const store: Record<string, string> = { [MODEL_KEY]: 'deck' };
      if (junk !== undefined) store[DECK_KEY] = junk;
      expect(paint(memory(store)), String(junk)).toEqual(pair(DEFAULT_DECK_LOOK.light));
    }
  });

  it('paints the saved skin’s pair for any saved model but the Clear one', () => {
    const sage = SKINS.find((skin) => skin.id === 'sage')!;
    for (const model of ['glass', '', 'Clear', 'suitcase']) {
      const store = { [MODEL_KEY]: model, [SKIN_KEY]: 'sage', [CLEAR_KEY]: '{"light":"pink"}' };
      expect(paint(memory(store)), model).toEqual({
        '--cdp-accent': sage.accent,
        '--cdp-on-accent': sage.onAccent,
      });
    }
  });

  it('paints the saved light’s pair on the Clear model, its default light’s for junk', () => {
    const pair = (id: string) => {
      const light = CLEAR_SWATCHES.light.find((l) => l.id === id)!;
      return { '--cdp-accent': light.accent, '--cdp-on-accent': light.onAccent };
    };
    expect(paint(memory({ [MODEL_KEY]: 'clear', [CLEAR_KEY]: '{"light":"pink"}' }))).toEqual(
      pair('pink'),
    );
    for (const junk of [undefined, '{nope', '{"light":"neon"}', '{"light":"__proto__"}']) {
      const store: Record<string, string> = { [MODEL_KEY]: 'clear' };
      if (junk !== undefined) store[CLEAR_KEY] = junk;
      expect(paint(memory(store)), String(junk)).toEqual(pair(DEFAULT_CLEAR_LOOK.light));
    }
  });

  it('paints the saved light’s pair on Luxe, its default light’s for junk', () => {
    const pair = (id: string) => {
      const light = LUXE_SWATCHES.light.find((l) => l.id === id)!;
      return { '--cdp-accent': light.accent, '--cdp-on-accent': light.onAccent };
    };
    expect(paint(memory({ [MODEL_KEY]: 'luxe', [LUXE_KEY]: '{"light":"amber"}' }))).toEqual(
      pair('amber'),
    );
    for (const junk of [
      undefined,
      '{nope',
      '{"light":"neon"}',
      '{"light":"__proto__"}',
      '{"light":"lime"}',
    ]) {
      const store: Record<string, string> = { [MODEL_KEY]: 'luxe' };
      if (junk !== undefined) store[LUXE_KEY] = junk;
      expect(paint(memory(store)), String(junk)).toEqual(pair(DEFAULT_LUXE_LOOK.light));
    }
  });

  it('never throws, and can never end the script element it is written into', () => {
    // No storage at all, and storage that throws (a sandboxed frame, a private mode).
    expect(paint(null)).toEqual({});
    expect(
      paint({
        getItem: () => {
          throw new Error('denied');
        },
      }),
    ).toEqual({});
    expect(LOOK_SCRIPT).not.toMatch(/[<>\u2028\u2029]/);
  });
});

describe('scriptLiteral', () => {
  it('writes a value a script reads back as it was, with nothing that could end the element', () => {
    const values = [
      '</script><!-- -->',
      'a\u2028b\u2029c',
      { k: '</SCRIPT>', n: [1, '/'] },
      'blush',
    ];
    for (const value of values) {
      const literal = scriptLiteral(value);
      expect(literal, JSON.stringify(value)).not.toMatch(/[<>/\u2028\u2029]/);
      expect(runInNewContext(`(${literal})`), JSON.stringify(value)).toEqual(value);
    }
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

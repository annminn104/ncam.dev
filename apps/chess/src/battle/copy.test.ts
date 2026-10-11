import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../game/game';
import { DEFAULT_SETTINGS } from '../settings';
import { BoardA11y } from './BoardA11y';
import { Hud } from './Hud';
import { PromotionDialog } from './PromotionDialog';
import type { GameApi } from './useGame';

// The battle's own words fit every piece set: treasures and the pearl belong to the Cultivation
// Treasures' piece names, never to the HUD, the dialogs or the keyboard board.

afterEach(() => {
  vi.unstubAllGlobals();
});

const noop = () => {};
const HOLY = { w: 'holy-order', b: 'holy-order' } as const;

/** The opening position, with nothing selected and no way to move. */
function stillGame(): GameApi {
  return {
    snap: createGame().snapshot(),
    selected: null,
    targets: [],
    pendingPromotion: null,
    clickSquare: noop,
    choosePromotion: noop,
    play: () => false,
    undo: noop,
    resign: noop,
    agreeDraw: noop,
    locked: false,
    setLocked: noop,
    plyCount: 0,
  };
}

describe('battle copy', () => {
  it('asks for a promotion in words every set shares, naming the choices by the set', () => {
    // useDialog remembers what had the focus; under Node there is no document to ask.
    vi.stubGlobal('document', { activeElement: null });
    const html = renderToString(
      createElement(PromotionDialog, { side: 'w', preset: 'holy-order', onChoose: noop }),
    );
    expect(html).toContain('Promotion — choose a piece');
    expect(html).toContain('Saint Abbess');
    expect(html).not.toMatch(/pearl|treasure/i);
  });

  it('tells keyboard players they pick up a piece', () => {
    const html = renderToString(
      createElement(BoardA11y, {
        game: stillGame(),
        viewSide: 'w',
        presets: HOLY,
        onCursor: noop,
      }),
    );
    expect(html).toContain('Enter picks up a piece or moves it there');
    expect(html).not.toMatch(/treasure/i);
  });

  it('heads the lost pieces "Captured"', () => {
    const html = renderToString(
      createElement(Hud, {
        game: stillGame(),
        settings: DEFAULT_SETTINGS,
        humanSide: 'w',
        presets: HOLY,
        thinking: false,
        autoRotate: false,
        onToggleRotate: noop,
        onResetView: noop,
        onExit: noop,
        onRematch: noop,
      }),
    );
    expect(html).toContain('>Captured</h2>');
    expect(html).not.toContain('Treasures lost');
  });
});

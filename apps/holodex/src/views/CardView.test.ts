import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { CAPTURED_CARDS } from '../holo/effect-gallery.fixture';
import { CardView } from './CardView';
import { dataEffects, renderView } from './render-view.test-util';

function renderCard(cardId: string, variant?: 'reverse'): string {
  return renderView(
    createElement(CardView, { cardId, variant }),
    `/card/${cardId}${variant ? '?variant=reverse' : ''}`,
    [CAPTURED_CARDS[cardId]],
  );
}

/** Both Commons, so both would take the reverse foil if it were asked for. */
const WITH_REVERSE = 'swsh3-3'; // Paras
const WITHOUT_REVERSE = 'sm1-1'; // Caterpie

describe('CardView — ?variant=reverse', () => {
  it('starts from two Commons, only one of which has a reverse printing', () => {
    expect(CAPTURED_CARDS[WITH_REVERSE]?.variants?.reverse).toBe(true);
    expect(CAPTURED_CARDS[WITHOUT_REVERSE]?.variants?.reverse).toBe(false);
    expect(dataEffects(renderCard(WITH_REVERSE))).toEqual(['basic']);
    expect(dataEffects(renderCard(WITHOUT_REVERSE))).toEqual(['basic']);
  });

  it('shows the reverse printing of a card that has one, with the toggle to undo it', () => {
    const html = renderCard(WITH_REVERSE, 'reverse');
    expect(dataEffects(html)).toEqual(['reverse-holo']);
    expect(html).toContain('>Reverse holo</button>');
  });

  it('ignores it on a card with no reverse printing, which has no toggle to undo it', () => {
    const html = renderCard(WITHOUT_REVERSE, 'reverse');
    expect(dataEffects(html)).toEqual(['basic']);
    expect(html).not.toContain('>Reverse holo</button>');
  });
});

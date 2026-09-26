import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { CAPTURED_CARDS } from '../holo/effect-gallery.fixture';
import { CardView } from './CardView';
import { dataEffects, renderView } from './render-view.test-util';

function renderCard(cardId: string, variant?: 'reverse' | 'masterball'): string {
  return renderView(
    createElement(CardView, { cardId, variant }),
    `/card/${cardId}${variant ? `?variant=${variant}` : ''}`,
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

/**
 * Prismatic Evolutions' Eevee lists a Master Ball reverse printing in TCGdex
 * (variants_detailed, foil: 'masterball'); 151's Ivysaur has a reverse
 * printing but no ball one listed.
 */
const WITH_MASTER_BALL = 'sv08.5-074'; // Eevee
const WITHOUT_MASTER_BALL = 'sv03.5-002'; // Ivysaur

describe('CardView — ?variant=masterball', () => {
  it('starts from two cards with reverse printings, only one listing a Master Ball one', () => {
    const foils = (id: string) =>
      (CAPTURED_CARDS[id]?.variants_detailed ?? []).map((v) => v.foil).filter(Boolean);
    expect(foils(WITH_MASTER_BALL)).toContain('masterball');
    expect(foils(WITHOUT_MASTER_BALL)).not.toContain('masterball');
  });

  it('shows the Master Ball printing of a card that lists one, pressed in its toggle', () => {
    const html = renderCard(WITH_MASTER_BALL, 'masterball');
    expect(dataEffects(html)).toEqual(['masterball-holo']);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Master Ball<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Reverse holo<\/button>/);
  });

  it('offers the Master Ball button alongside the others, unpressed, on the normal printing', () => {
    const html = renderCard(WITH_MASTER_BALL);
    expect(dataEffects(html)).toEqual(['basic']);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Master Ball<\/button>/);
  });

  it('ignores it on a card that lists no Master Ball printing, which offers no such button', () => {
    const html = renderCard(WITHOUT_MASTER_BALL, 'masterball');
    expect(dataEffects(html)).toEqual(['basic']);
    expect(html).not.toContain('>Master Ball</button>');
    expect(html).toContain('>Reverse holo</button>');
  });
});

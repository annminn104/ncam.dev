import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { RouteControllerContext } from '../app-context';
import { createQueryClient, queryKeys } from '../lib/queries';
import type { Card } from '../lib/tcgdex';
import { createRouteController } from '../route-controller';

/**
 * Test-only. A view rendered the way the server renders it — renderToString
 * under node, so no DOM, no effects and no network — inside the two providers
 * App gives every view. Each card in `cards` is seeded into the query cache
 * under its own key, so a view that asks for it renders it loaded; anything
 * else renders its pending state.
 */
export function renderView(view: ReactElement, route: string, cards: readonly Card[] = []): string {
  const client = createQueryClient();
  for (const card of cards) client.setQueryData(queryKeys.card(card.id), card);
  try {
    return renderToString(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          RouteControllerContext.Provider,
          { value: createRouteController({ route }) },
          view,
        ),
      ),
    );
  } finally {
    // Drops the queries, and with them the gc timers they scheduled.
    client.clear();
  }
}

/** The effect every rendered HoloCard resolved to, in document order. */
export function dataEffects(html: string): string[] {
  return [...html.matchAll(/data-effect="([^"]*)"/g)].map(([, effect]) => effect);
}

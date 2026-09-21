import { Layers, Search, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useRoute } from '../app-context';
import { EMPTY_FILTERS, type Route } from '../routes';
import { cn } from '../lib/utils';

const NAV: Array<{ label: string; icon: typeof Layers; route: Route; match: Route['view'][] }> = [
  { label: 'Sets', icon: Layers, route: { view: 'home' }, match: ['home', 'set'] },
  {
    label: 'Search',
    icon: Search,
    route: { view: 'search', filters: EMPTY_FILTERS },
    match: ['search'],
  },
  { label: 'Collection', icon: Star, route: { view: 'collection' }, match: ['collection'] },
];

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const navigate = useNavigate();
  return (
    <div className="holodex flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-holo-line bg-holo-bg/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3" aria-label="Holodex">
          <span className="mr-4 text-sm font-semibold tracking-[0.2em] uppercase">Holodex</span>
          {NAV.map(({ label, icon: Icon, route: target, match }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(target)}
              aria-current={match.includes(route.view) ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-holo-muted hover:text-holo-text',
                match.includes(route.view) && 'bg-holo-panel text-holo-text',
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-holo-line px-4 py-6 text-center text-xs text-holo-muted">
        Card data and images from{' '}
        <a
          className="underline"
          href="https://tcgdex.dev"
          rel="noreferrer noopener"
          target="_blank"
        >
          TCGdex
        </a>
        . Pokémon and Pokémon card images are trademarks of Nintendo, Creatures Inc. and GAME FREAK
        inc. This is a non-commercial demo and is not affiliated with them.
      </footer>
    </div>
  );
}

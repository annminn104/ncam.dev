import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../app-context';
import { setsQuery } from '../lib/queries';
import { EMPTY_FILTERS } from '../routes';
import { ErrorPanel } from '../components/ErrorPanel';
import { Skeleton } from '../components/Skeleton';

export function SetsView() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const { data, error, isPending, refetch } = useQuery(setsQuery());

  const sets = useMemo(() => {
    if (!data) return [];
    const needle = term.trim().toLowerCase();
    const filtered = needle ? data.filter((s) => s.name.toLowerCase().includes(needle)) : data;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, term]);

  if (error)
    return (
      <ErrorPanel title="Couldn't load the set list" error={error} onRetry={() => void refetch()} />
    );

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Sets</h1>
      <p className="mt-1 text-sm text-holo-muted">
        {data ? `${data.length} sets` : 'Loading the catalogue'} from TCGdex.
      </p>

      <label className="mt-4 block">
        <span className="sr-only">Filter sets by name</span>
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Filter sets…"
          className="w-full max-w-sm rounded-lg border border-holo-line bg-holo-panel px-3 py-2 text-sm outline-none focus:border-holo-accent"
        />
      </label>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isPending ? (
          <Skeleton count={12} />
        ) : (
          sets.map((set) => (
            <li key={set.id}>
              <button
                type="button"
                onClick={() => navigate({ view: 'set', setId: set.id, filters: EMPTY_FILTERS })}
                className="flex w-full items-center gap-3 rounded-lg border border-holo-line bg-holo-panel p-3 text-left hover:border-holo-accent"
              >
                <SetLogo logo={set.logo} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{set.name}</span>
                  <span className="block text-xs text-holo-muted">
                    {set.cardCount.official} cards · {set.id}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {!isPending && sets.length === 0 ? (
        <p className="mt-8 text-center text-sm text-holo-muted">No set matches “{term}”.</p>
      ) : null}
    </section>
  );
}

/** The files to try for a set logo, in order: WebP, then PNG. */
export function logoUrls(logo: string): string[] {
  return [`${logo}.webp`, `${logo}.png`];
}

/**
 * A set's logo. TCGdex serves most as WebP but three (basep, hgss3, xy3) only
 * as PNG, so a WebP that fails falls back to the PNG, and a PNG that fails to
 * the blank a set without a logo shows. An image that failed before hydration
 * fired its error event unheard, so mounting checks for one too.
 */
function SetLogo({ logo }: { logo?: string }) {
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  const src = logo ? logoUrls(logo)[attempt] : undefined;
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setAttempt((n) => n + 1);
  }, [src]);
  if (!src) return <span aria-hidden="true" className="h-10 w-16 rounded bg-holo-bg" />;
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setAttempt((n) => n + 1)}
      className="h-10 w-16 object-contain"
    />
  );
}

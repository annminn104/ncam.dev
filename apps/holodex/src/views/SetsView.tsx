import { useMemo, useState } from 'react';
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
                {set.logo ? (
                  <img
                    src={`${set.logo}.webp`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-16 object-contain"
                  />
                ) : (
                  <span aria-hidden="true" className="h-10 w-16 rounded bg-holo-bg" />
                )}
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

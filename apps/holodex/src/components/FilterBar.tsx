import { CARD_RARITIES, CARD_TYPES } from '../lib/constants';
import type { Filters } from '../routes';

export interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  showSearch?: boolean;
}

export function FilterBar({ filters, onChange, showSearch = true }: FilterBarProps) {
  // Any filter change resets to page 1 — page 4 of the old result set is
  // meaningless against the new one.
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 });
  const selectClass =
    'rounded-lg border border-holo-line bg-holo-panel px-3 py-2 text-sm outline-none focus:border-holo-accent';

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {showSearch ? (
        <label>
          <span className="sr-only">Card name</span>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => set({ q: event.target.value })}
            placeholder="Card name…"
            className={selectClass}
          />
        </label>
      ) : null}
      <label>
        <span className="sr-only">Type</span>
        <select
          value={filters.type}
          onChange={(event) => set({ type: event.target.value })}
          className={selectClass}
        >
          <option value="">All types</option>
          {CARD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Rarity</span>
        <select
          value={filters.rarity}
          onChange={(event) => set({ rarity: event.target.value })}
          className={selectClass}
        >
          <option value="">All rarities</option>
          {CARD_RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </label>
      {filters.q || filters.type || filters.rarity ? (
        <button
          type="button"
          onClick={() => onChange({ q: '', type: '', rarity: '', page: 1 })}
          className="text-sm text-holo-muted underline hover:text-holo-text"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

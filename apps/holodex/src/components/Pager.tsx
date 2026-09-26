export interface PagerProps {
  page: number;
  hasNext: boolean;
  total?: number;
  perPage: number;
  onChange: (page: number) => void;
}

export function Pager({ page, hasNext, total, perPage, onChange }: PagerProps) {
  const lastPage = typeof total === 'number' ? Math.max(1, Math.ceil(total / perPage)) : undefined;
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-4 text-sm" aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-holo-line px-3 py-1.5 disabled:opacity-40"
      >
        ‹ Prev
      </button>
      <span className="text-holo-muted">
        Page {page}
        {lastPage ? ` of ${lastPage}` : ''}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-holo-line px-3 py-1.5 disabled:opacity-40"
      >
        Next ›
      </button>
    </nav>
  );
}

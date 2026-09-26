import { AlertTriangle, RotateCw } from 'lucide-react';

export interface ErrorPanelProps {
  title: string;
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorPanel({ title, error, onRetry }: ErrorPanelProps) {
  const detail = error instanceof Error ? error.message : error ? String(error) : null;
  return (
    <div
      role="alert"
      className="mx-auto my-12 max-w-md rounded-xl border border-holo-line bg-holo-panel p-6 text-center"
    >
      <AlertTriangle aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-holo-accent" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {detail ? <p className="mt-2 text-sm text-holo-muted">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-holo-line px-4 py-2 text-sm hover:border-holo-accent"
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" /> Try again
        </button>
      ) : null}
    </div>
  );
}

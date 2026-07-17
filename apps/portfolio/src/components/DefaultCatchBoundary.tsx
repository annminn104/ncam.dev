import { Link, type ErrorComponentProps } from '@tanstack/react-router';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <div className="stage">
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Projects
      </Link>
      <div className="stage__error">
        <h2>Something went wrong</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    </div>
  );
}

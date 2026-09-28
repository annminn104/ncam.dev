import { Link } from '@tanstack/react-router';

/**
 * The router's defaultNotFoundComponent: every 404 renders it, and its head is
 * the root route's (see lib/not-found.ts). The page's one heading, so an h1.
 */
export function NotFound() {
  return (
    <div className="stage">
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Projects
      </Link>
      <div className="stage__error">
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist.</p>
      </div>
    </div>
  );
}

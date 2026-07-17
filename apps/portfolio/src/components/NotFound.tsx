import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <div className="stage">
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Projects
      </Link>
      <div className="stage__error">
        <h2>Page not found</h2>
        <p>The page you're looking for doesn't exist.</p>
      </div>
    </div>
  );
}

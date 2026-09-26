import { useNavigate } from '../app-context';
import { HOME } from '../components/Shell';

export function NotFoundView({ path }: { path: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto my-16 max-w-md text-center">
      <h2 className="text-xl font-semibold">Nothing here</h2>
      <p className="mt-2 text-sm text-holo-muted">
        <code>{path}</code> is not a Holodex page.
      </p>
      <button
        type="button"
        onClick={() => navigate(HOME)}
        className="mt-4 rounded-lg border border-holo-line px-4 py-2 text-sm hover:border-holo-accent"
      >
        Back to Holodex
      </button>
    </div>
  );
}

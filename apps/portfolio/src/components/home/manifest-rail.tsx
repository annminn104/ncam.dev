import { sections } from '../../data/sections';

/** Real load lifecycle of a section module, reported by the home route. */
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type RailState = 'idle' | 'loading' | 'loaded' | 'mounted' | 'cached' | 'error';

const STATUS_LABEL: Record<RailState, string> = {
  idle: 'idle',
  loading: 'loading…',
  loaded: 'loaded',
  mounted: 'mounted',
  cached: 'cached',
  error: 'failed',
};

interface ManifestRailProps {
  /** Section id currently crossing the middle of the viewport. */
  active: string;
  /** Section ids that have been active at least once. */
  visited: string[];
  /** Module load state, keyed by exposed module name. */
  loadState: Record<string, LoadState>;
}

/**
 * The page's signature: a fixed "remote manifest" listing every section as the
 * federated module it actually is (`profile/<module>`). States are real — a
 * module reads `loading…` while its chunk is fetched, `mounted` while its section
 * is in view, `cached` once you have scrolled past it, `failed` if the remote
 * could not be loaded.
 */
export function ManifestRail({ active, visited, loadState }: ManifestRailProps) {
  return (
    <aside className="rail" aria-label="Page sections">
      <p className="rail__title">profile · remoteEntry</p>
      <ol className="rail__list">
        {sections.map((section) => {
          const load = loadState[section.module] ?? 'idle';
          const state: RailState =
            load === 'error'
              ? 'error'
              : load === 'loading'
                ? 'loading'
                : load === 'idle'
                  ? 'idle'
                  : active === section.id
                    ? 'mounted'
                    : visited.includes(section.id)
                      ? 'cached'
                      : 'loaded';
          return (
            <li key={section.id} className="rail__item" data-state={state}>
              <a
                href={`#${section.id}`}
                aria-current={state === 'mounted' ? 'location' : undefined}
              >
                <span className="rail__dot" aria-hidden="true" />
                <span className="rail__module">./{section.module}</span>
                <span className="rail__status">{STATUS_LABEL[state]}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

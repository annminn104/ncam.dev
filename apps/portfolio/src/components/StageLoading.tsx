import type { ProjectEntry } from '@ncam/project-registry';

export interface StageLoadingProps {
  project: Pick<ProjectEntry, 'name' | 'tagline' | 'thumbnail'>;
  /** The remote has attached: fade out (styles.css), staying in the DOM for the fade. */
  done: boolean;
}

/**
 * What the stage shows while a client-mounted remote downloads: the project's
 * own 1200×630 screenshot, blurred and dimmed, under its name and tagline, so
 * entering `/projects/<id>` never paints a blank page. An SSR entry already
 * carries the remote's markup and never renders this (see ProjectStage).
 *
 * `done` hides it with CSS (opacity, then visibility) instead of unmounting it,
 * so the remote fades in underneath rather than popping in.
 */
export function StageLoading({ project, done }: StageLoadingProps) {
  // "Viktor." would read "Loading Viktor.…": the ellipsis replaces its stop.
  const name = project.name.endsWith('.') ? project.name.slice(0, -1) : project.name;
  return (
    <div
      className="stage__loading"
      data-state={done ? 'done' : 'loading'}
      role="status"
      aria-live="polite"
    >
      {project.thumbnail ? (
        <img
          className="stage__loading-backdrop"
          src={project.thumbnail}
          alt=""
          width={1200}
          height={630}
          decoding="async"
          // The largest thing on a client-mounted entry's first paint.
          fetchPriority="high"
        />
      ) : null}
      <div className="stage__loading-card">
        <span className="stage__spinner" aria-hidden="true" />
        <p className="stage__loading-title">{`Loading ${name}…`}</p>
        <p className="stage__loading-tagline">{project.tagline}</p>
      </div>
    </div>
  );
}

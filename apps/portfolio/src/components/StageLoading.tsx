import type { ProjectEntry } from '@ncam/project-registry';

export interface StageLoadingProps {
  project: Pick<ProjectEntry, 'name'>;
  /** The remote has attached: fade out (styles.css), staying in the DOM for the fade. */
  done: boolean;
}

/**
 * What the stage shows while a client-mounted remote downloads: a spinner in
 * the middle of the empty stage, so entering `/projects/<id>` never paints a
 * blank page. Screen readers hear "Loading <name>…" instead; the text is
 * visually hidden. An SSR entry already carries the remote's markup and never
 * renders this (see ProjectStage).
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
      <span className="stage__spinner" aria-hidden="true" />
      <span className="stage__loading-label">{`Loading ${name}…`}</span>
    </div>
  );
}

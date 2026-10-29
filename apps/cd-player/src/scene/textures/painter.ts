import type { SceneView, TrackView } from '../../bridge';
import type { Painter } from '../swap-controller';

/**
 * A painter that loads what a track's prints need, then draws them on a disc. Prints of one disc
 * overlap and finish in any order (the director's, and the hook's own for the lid before the first
 * play, which has no signal), and the last one started wins: a print that finishes after a newer
 * print of its disc has started, or after the director aborted it, draws nothing.
 */
export function createPainter<Loaded>(
  load: (view: TrackView) => Promise<Loaded>,
  draw: (index: 0 | 1, loaded: Loaded, view: TrackView) => void,
): Painter {
  const started: [number, number] = [0, 0];
  return async (index, view, signal) => {
    const mine = ++started[index];
    const loaded = await load(view);
    if (signal?.aborted || started[index] !== mine) return;
    draw(index, loaded, view);
  };
}

/**
 * Whether `work` settled (finished or failed) within `ms`: false once the wait runs out, with the
 * work going on. A print waits for its fonts this way, so a stalled request never holds it.
 */
export function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    const settled = () => {
      clearTimeout(timer);
      resolve(true);
    };
    work.then(settled, settled);
  });
}

/** What a print shows of a track: it is made again when this changes. */
export function printKey(track: TrackView): string {
  return `${track.id}\n${track.artUrl}\n${track.artistUrl}`;
}

/**
 * The view to print again on a disc whose print was made for `printed`: the same track, once the
 * view knows more of it. A track picked from beyond the few the engine has fetched details of has
 * no art when its change begins; the art arrives while the disc turns. Never another track.
 */
export function reprintFor(
  printed: TrackView | null,
  view: Pick<SceneView, 'current' | 'upcoming'>,
): TrackView | null {
  if (!printed) return null;
  const now = [view.current, ...view.upcoming].find((track) => track?.id === printed.id);
  return now && printKey(now) !== printKey(printed) ? now : null;
}

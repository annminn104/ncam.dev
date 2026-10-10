import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@ncam/logger';

const log = createLogger({ scope: 'chess' });

interface Props {
  children: ReactNode;
  /** Leave the failed battle for the lobby. */
  onBack(): void;
}
interface State {
  failed: boolean;
}

/**
 * What the player sees when a battle cannot open. Its styles are in globals.css, not in the
 * battle's own stylesheet: that chunk may be the very thing that failed to load.
 */
export function ArenaFailed({ onBack }: { onBack(): void }) {
  return (
    <div className="chess-fallback" role="alert">
      <h2>The arena failed to open</h2>
      <p>
        Something went wrong while gathering qi. Go back to the lobby and try again; if it keeps
        happening, reload the page.
      </p>
      <button type="button" className="chess-start" onClick={onBack}>
        Back to the lobby
      </button>
    </div>
  );
}

/**
 * Keeps a battle that cannot open from taking the lobby down with it: a chunk that fails to
 * load (a stale tab after a deploy, offline), a renderer that cannot start, a scene that throws.
 * R3F rethrows what goes wrong inside its Canvas in the render above it, so this catches those
 * too. Without a boundary React unmounts the whole root.
 */
export class BattleErrorBoundary extends Component<Props, State> {
  // A flag, not the error itself: whatever was thrown (even a falsy value) must count as a failure.
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    log.error('chess.battle-failed', {
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      info: info.componentStack,
    });
  }

  private back = () => {
    this.setState({ failed: false });
    this.props.onBack();
  };

  render(): ReactNode {
    return this.state.failed ? <ArenaFailed onBack={this.back} /> : this.props.children;
  }
}

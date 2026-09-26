import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@ncam/logger';
import { ErrorPanel } from './ErrorPanel';

const log = createLogger({ scope: 'holodex' });

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Keeps a render error inside the remote instead of taking the host page down. */
export class HolodexErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('holodex.render-failed', {
      error: error.stack ?? error.message,
      info: info.componentStack,
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorPanel
        title="Holodex hit a problem"
        error={this.state.error}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

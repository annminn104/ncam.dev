import { createLogger } from '@ncam/logger';
import { Component, type ReactNode } from 'react';

const log = createLogger({ scope: 'chess' });
/** Failures already logged: one line per failing file and page, however many pieces draw it. */
const reported = new Set<string>();

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Draws `fallback` (the treasure) in place of a figure whose file could not load. R3F names the
 * file in its error ("Could not load <url>: …"), which keeps the log to one line per file.
 */
export class FigureBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (reported.has(message)) return;
    reported.add(message);
    log.error('figure.load-failed', { error: message });
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

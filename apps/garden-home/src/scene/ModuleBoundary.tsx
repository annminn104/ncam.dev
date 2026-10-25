import { Component, type ReactNode } from 'react';

interface Props {
  slotId: string;
  onFailed: (slotId: string) => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** A broken or missing GLB removes only its own slot (spec §12). */
export class ModuleBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[scene] slot ${this.props.slotId} failed to load and was skipped`, error);
    this.props.onFailed(this.props.slotId);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

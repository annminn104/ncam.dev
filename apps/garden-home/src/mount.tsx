import { createRoot } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import { App } from './App';
import './styles.css';

/** Federated entry until the shell lands (Task 5): the source's App, as its own page runs it. */
export function mount(target: HTMLElement, _config?: MountConfig): MountHandle {
  const root = createRoot(target);
  root.render(<App />);
  return () => root.unmount();
}

export default mount;

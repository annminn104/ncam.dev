import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('app')!, {
  // Error boundaries already handle module failures; keep them out of console.error.
  onCaughtError: (error) => console.warn('[react] caught', error),
}).render(<App />);

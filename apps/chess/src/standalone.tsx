import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import css from './styles/globals.css?inline';
import App from './App';
import { ARENAS, type ArenaId } from './arenas-meta';
import { mount } from './mount';
import { remoteBase } from './lib/asset-url';

const el = document.getElementById('app');
const capture = new URLSearchParams(location.search).get('capture');
if (el && capture && ARENAS.some((a) => a.id === capture)) {
  // scripts/capture-arenas.mjs: the arena alone, for the lobby previews.
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  createRoot(el).render(
    <StrictMode>
      <App assetBase={remoteBase()} capture={capture as ArenaId} />
    </StrictMode>,
  );
} else if (el) {
  mount(el);
}

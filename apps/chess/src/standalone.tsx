import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import css from './styles/globals.css?inline';
import App from './App';
import { parseCapture } from './capture';
import { mount } from './mount';
import { remoteBase } from './lib/asset-url';

const el = document.getElementById('app');
const capture = parseCapture(location.search);
if (el && capture) {
  // scripts/capture-arenas.mjs and capture-presets.mjs: the battle alone, for previews and reviews.
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  createRoot(el).render(
    <StrictMode>
      <App assetBase={remoteBase()} capture={capture} />
    </StrictMode>,
  );
} else if (el) {
  mount(el);
}

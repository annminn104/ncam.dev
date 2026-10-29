import { createRoot } from 'react-dom/client';
import '../fonts';
import { createBridge } from '../bridge';
import { remoteBase } from '../lib/asset-url';
import { PlayerScene } from './PlayerScene';
import { loadFaces } from './textures/paint';

declare global {
  interface Window {
    __sceneReady?: boolean;
    __sceneError?: string;
  }
}

/**
 * The scene alone, default prints, transparent: what the poster captures. The capture page never
 * mounts the app, so nothing else asks for the page's fonts: they are loaded first, or the prints
 * would go out in Georgia and Arial.
 */
export async function mountCapture(element: HTMLElement): Promise<void> {
  element.style.cssText = 'position:fixed;inset:0;background:transparent';
  // index.html paints the page's own backdrop colour on html and body, which a screenshot would
  // keep: the poster has none, the page's backdrop shows around the player.
  for (const node of [document.documentElement, document.body])
    node.style.background = 'transparent';
  await loadFaces();
  createRoot(element).render(
    <PlayerScene
      assetBase={remoteBase()}
      bridge={createBridge()}
      onReady={() => {
        window.__sceneReady = true;
      }}
      onFail={(error) => {
        window.__sceneError = String(error);
      }}
    />,
  );
}

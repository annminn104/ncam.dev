import { useEffect, useState, type CSSProperties } from 'react';
import type { Palette } from '../spotify/types';

interface Layer {
  key: string;
  artUrl: string | null;
  palette: Palette | null;
}

const FALLBACK = { background: 'rgb(42, 31, 36)', tinted: 'rgb(18, 12, 16)' };

function layerStyle(layer: Layer): CSSProperties {
  return {
    '--cdp-bg': layer.palette?.background ?? FALLBACK.background,
    '--cdp-tint': layer.palette?.tinted ?? FALLBACK.tinted,
    '--cdp-art': layer.artUrl ? `url(${JSON.stringify(layer.artUrl)})` : 'none',
  } as CSSProperties;
}

/**
 * The page behind the player: the album art, blurred, under the track's own colours. A new track's
 * layer fades in over the last one; the first paint's layer never animates (Lighthouse).
 */
export function Backdrop({ artUrl, palette }: { artUrl: string | null; palette: Palette | null }) {
  const key = artUrl ?? 'none';
  const [layers, setLayers] = useState<Layer[]>(() => [{ key, artUrl, palette }]);
  useEffect(() => {
    setLayers((previous) =>
      previous[previous.length - 1]?.key === key
        ? previous
        : [...previous.slice(-1), { key, artUrl, palette }],
    );
  }, [key, artUrl, palette]);
  return (
    <div className="cdp-backdrop" aria-hidden="true">
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={index > 0 ? 'cdp-backdrop__layer is-entering' : 'cdp-backdrop__layer'}
          style={layerStyle(layer)}
        />
      ))}
      <div className="cdp-backdrop__grain" />
    </div>
  );
}

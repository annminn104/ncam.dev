import { useEffect, useState, type CSSProperties } from 'react';

interface Layer {
  key: string;
  artUrl: string | null;
}

function layerStyle(layer: Layer): CSSProperties {
  return {
    '--cdp-art': layer.artUrl ? `url(${JSON.stringify(layer.artUrl)})` : 'none',
  } as CSSProperties;
}

/**
 * The page behind the player: the album art, blurred and multiplied into the skin's pastel
 * (styles/app.css). A new track's layer fades in over the last one; the first paint's layer never
 * animates (Lighthouse).
 */
export function Backdrop({ artUrl }: { artUrl: string | null }) {
  const key = artUrl ?? 'none';
  const [layers, setLayers] = useState<Layer[]>(() => [{ key, artUrl }]);
  useEffect(() => {
    setLayers((previous) =>
      previous[previous.length - 1]?.key === key
        ? previous
        : [...previous.slice(-1), { key, artUrl }],
    );
  }, [key, artUrl]);
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

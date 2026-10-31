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
 * (styles/app.css). A new track's art fades in over the last one; a track whose art has not come
 * yet keeps the last, since a layer without art would cut the page to the bare pastel between
 * two covers. The first paint's layer never animates (Lighthouse).
 */
export function Backdrop({ artUrl }: { artUrl: string | null }) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ key: artUrl ?? 'none', artUrl }]);
  useEffect(() => {
    if (artUrl === null) return;
    setLayers((previous) =>
      previous[previous.length - 1]?.artUrl === artUrl
        ? previous
        : [...previous.slice(-1), { key: artUrl, artUrl }],
    );
  }, [artUrl]);
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

import type { CSSProperties } from 'react';
import type { Side } from '../game/coords';
import { presetPreview, type PresetMeta } from '../presets-meta';
import { usePreviewImage } from './usePreviewImage';

export function PresetCard(props: {
  preset: PresetMeta;
  side: Side | 'both';
  checked: boolean;
  assetBase: string;
  onSelect(): void;
}) {
  const { preset, side, checked, assetBase, onSelect } = props;
  const src = presetPreview(preset.id, 640, assetBase);
  const { ref, failed, onError } = usePreviewImage(src);
  const [w, b] = [preset.swatches.w, preset.swatches.b];
  // The card's own background when its preview is missing or still loading: the side's swatches.
  const fallback =
    side === 'b'
      ? `linear-gradient(135deg, ${b[0]} 0%, ${b[1]} 60%, ${b[2]} 100%)`
      : side === 'w'
        ? `linear-gradient(135deg, ${w[0]} 0%, ${w[1]} 60%, ${w[2]} 100%)`
        : `linear-gradient(135deg, ${w[0]} 0%, ${w[2]} 48%, ${b[2]} 52%, ${b[0]} 100%)`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className="chess-preset"
      onClick={onSelect}
      style={
        { '--preset-accent': (side === 'b' ? b : w)[2], background: fallback } as CSSProperties
      }
    >
      <img
        ref={ref}
        className="chess-preset__img"
        src={src}
        srcSet={`${presetPreview(preset.id, 320, assetBase)} 320w, ${src} 640w`}
        sizes="(max-width: 720px) 50vw, 200px"
        width={640}
        height={400}
        alt=""
        decoding="async"
        loading="lazy"
        fetchPriority="auto"
        data-failed={failed ? '' : undefined}
        onError={onError}
      />
      <span className="chess-preset__caption">
        <span className="chess-preset__name">{preset.name}</span>
        <span className="chess-preset__tagline">{preset.tagline}</span>
      </span>
    </button>
  );
}

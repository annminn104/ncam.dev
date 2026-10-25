import type { CSSProperties } from 'react';
import { arenaPreview, type ArenaMeta } from '../arenas-meta';
import { usePreviewImage } from './usePreviewImage';

export function ArenaCard(props: {
  arena: ArenaMeta;
  selected: boolean;
  priority: boolean;
  assetBase: string;
  onSelect(): void;
}) {
  const { arena, selected, priority, assetBase, onSelect } = props;
  const src = arenaPreview(arena.id, 640, assetBase);
  const { ref, failed, onError } = usePreviewImage(src);

  return (
    <button
      type="button"
      className="chess-arena"
      aria-pressed={selected}
      onClick={onSelect}
      style={{ '--arena-accent': arena.accent, background: arena.fallback } as CSSProperties}
    >
      <img
        ref={ref}
        className="chess-arena__img"
        src={src}
        srcSet={`${arenaPreview(arena.id, 320, assetBase)} 320w, ${src} 640w`}
        sizes="(max-width: 720px) 100vw, 320px"
        width={640}
        height={400}
        alt=""
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        data-failed={failed ? '' : undefined}
        onError={onError}
      />
      <span className="chess-arena__caption">
        <span className="chess-arena__name">{arena.name}</span>
        <span className="chess-arena__lore">{arena.lore}</span>
      </span>
    </button>
  );
}

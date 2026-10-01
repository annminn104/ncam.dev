import type { CSSProperties } from 'react';
import { arenaPreview, type ArenaMeta } from '../arenas-meta';

export function ArenaCard(props: {
  arena: ArenaMeta;
  selected: boolean;
  priority: boolean;
  assetBase: string;
  onSelect(): void;
}) {
  const { arena, selected, priority, assetBase, onSelect } = props;
  return (
    <button
      type="button"
      className="chess-arena"
      aria-pressed={selected}
      onClick={onSelect}
      style={{ '--arena-accent': arena.accent, background: arena.fallback } as CSSProperties}
    >
      <img
        className="chess-arena__img"
        src={arenaPreview(arena.id, 640, assetBase)}
        srcSet={`${arenaPreview(arena.id, 320, assetBase)} 320w, ${arenaPreview(arena.id, 640, assetBase)} 640w`}
        sizes="(max-width: 720px) 100vw, 320px"
        width={640}
        height={400}
        alt=""
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      <span className="chess-arena__name">{arena.name}</span>
      <span className="chess-arena__lore">{arena.lore}</span>
    </button>
  );
}

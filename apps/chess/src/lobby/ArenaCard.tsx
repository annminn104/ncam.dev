import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { arenaPreview, type ArenaMeta } from '../arenas-meta';

export function ArenaCard(props: {
  arena: ArenaMeta;
  selected: boolean;
  priority: boolean;
  assetBase: string;
  onSelect(): void;
}) {
  const { arena, selected, priority, assetBase, onSelect } = props;
  const src = arenaPreview(arena.id, 640, assetBase);
  const img = useRef<HTMLImageElement>(null);
  // The preview URL that failed to load. The card then shows its fallback gradient alone, without
  // the browser's broken-image icon painted over it. Nothing is marked on the first render, so the
  // server markup and the first client render are identical.
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    // The server-rendered <img> starts loading before React hydrates, so an `error` that fired
    // in between never reached onError. By now the image has settled: look at where it ended up.
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(src);
  }, [src]);

  return (
    <button
      type="button"
      className="chess-arena"
      aria-pressed={selected}
      onClick={onSelect}
      style={{ '--arena-accent': arena.accent, background: arena.fallback } as CSSProperties}
    >
      <img
        ref={img}
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
        data-failed={failed === src ? '' : undefined}
        onError={() => setFailed(src)}
      />
      <span className="chess-arena__caption">
        <span className="chess-arena__name">{arena.name}</span>
        <span className="chess-arena__lore">{arena.lore}</span>
      </span>
    </button>
  );
}

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { CardBrief } from '../lib/tcgdex';
import { CardImage } from './CardImage';

export function CardTile({ card, onOpen }: { card: CardBrief; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  const tilt = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${(-y * 12).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(x * 12).toFixed(2)}deg`);
    el.style.setProperty('--sheen', `${((x + 0.5) * 100).toFixed(1)}%`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--tilt-x');
    el.style.removeProperty('--tilt-y');
  };

  return (
    <button
      ref={ref}
      type="button"
      onPointerMove={tilt}
      onPointerLeave={reset}
      onClick={() => onOpen(card.id)}
      className="group relative block w-full [perspective:900px] motion-reduce:[--tilt-x:0deg] motion-reduce:[--tilt-y:0deg]"
    >
      <span className="block transition-transform duration-100 [transform:rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))]">
        <CardImage base={card.image} name={card.name} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-60"
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) var(--sheen,50%), transparent 60%)',
          }}
        />
      </span>
      <span className="mt-1 block truncate text-xs text-holo-muted">
        {card.localId} · {card.name}
      </span>
    </button>
  );
}

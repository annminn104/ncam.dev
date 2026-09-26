import { CARD_ASPECT } from '../lib/constants';

/**
 * Placeholder boxes. Both call sites render inside a <ul>, so each box is an
 * <li> — a bare <div> child of a <ul> is invalid markup and trips a11y tooling.
 */
export function Skeleton({ count, card = false }: { count: number; card?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          aria-hidden="true"
          className="animate-pulse rounded-lg bg-holo-panel"
          style={card ? { aspectRatio: CARD_ASPECT } : { height: '4.5rem' }}
        />
      ))}
    </>
  );
}

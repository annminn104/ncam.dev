import type { Card, PriceBlock } from '../lib/tcgdex';

function money(value: number | undefined, currency: string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** avg30 → avg7 → avg1, the only history the API gives us. */
function Sparkline({ block }: { block: PriceBlock }) {
  const points = [block.avg30, block.avg7, block.avg1].filter(
    (value): value is number => typeof value === 'number',
  );
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map(
      (value, index) => `${(index / (points.length - 1)) * 60},${16 - ((value - min) / span) * 14}`,
    )
    .join(' ');
  return (
    <svg
      viewBox="0 0 60 18"
      width="60"
      height="18"
      role="img"
      aria-label="30-day, 7-day and 24-hour average"
    >
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Market({ name, block, currency }: { name: string; block: PriceBlock; currency: string }) {
  const low = money(block.low, currency);
  const avg = money(block.avg, currency);
  const trend = money(block.trend, currency);
  if (!low && !avg && !trend) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-holo-line py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-holo-muted">
          {[low && `low ${low}`, avg && `avg ${avg}`, trend && `trend ${trend}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span className="text-holo-accent">
        <Sparkline block={block} />
      </span>
    </div>
  );
}

export function PricePanel({ card }: { card: Card }) {
  const variants = (card.variants_detailed ?? []).filter((variant) => variant.pricing);
  if (variants.length === 0) return null;

  const updated = variants
    .flatMap((variant) => [
      variant.pricing?.cardmarket?.updated,
      variant.pricing?.tcgplayer?.updated,
    ])
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <section className="mt-4 rounded-xl border border-holo-line bg-holo-panel p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-holo-muted">
        Market prices
      </h2>
      {variants.map((variant) => (
        <div key={variant.variantId ?? variant.type} className="mt-3">
          <p className="text-xs uppercase tracking-wide text-holo-muted">{variant.type}</p>
          {variant.pricing?.cardmarket ? (
            <Market
              name="Cardmarket"
              block={variant.pricing.cardmarket}
              currency={variant.pricing.cardmarket.unit ?? 'EUR'}
            />
          ) : null}
          {variant.pricing?.tcgplayer ? (
            <Market
              name="TCGplayer"
              block={variant.pricing.tcgplayer}
              currency={variant.pricing.tcgplayer.unit ?? 'USD'}
            />
          ) : null}
        </div>
      ))}
      <p className="mt-3 text-xs text-holo-muted">
        Indicative third-party market data via TCGdex
        {updated ? `, updated ${new Date(updated).toLocaleDateString()}` : ''}.
      </p>
    </section>
  );
}

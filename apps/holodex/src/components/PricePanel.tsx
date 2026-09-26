import type { Card, PriceBlock, TcgplayerPricing, TcgplayerProductPrice } from '../lib/tcgdex';

/** Keys on `TcgplayerPricing` that are metadata, not a product-type entry. */
const TCGPLAYER_META_KEYS = new Set(['unit', 'updated']);

function isProductPrice(
  value: TcgplayerProductPrice | string | undefined,
): value is TcgplayerProductPrice {
  return typeof value === 'object' && value !== null;
}

/** The dynamic product-type entries on a tcgplayer block, `unit`/`updated` excluded. */
function productEntries(pricing: TcgplayerPricing): [string, TcgplayerProductPrice][] {
  return Object.entries(pricing).filter(
    (entry): entry is [string, TcgplayerProductPrice] =>
      !TCGPLAYER_META_KEYS.has(entry[0]) && isProductPrice(entry[1]),
  );
}

/** `holofoil` → `Holofoil`, `1st-edition-holofoil` → `1st Edition Holofoil`. */
function productLabel(productType: string): string {
  return productType
    .split('-')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function money(value: number | undefined, currency: string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function hasCardmarketData(block: PriceBlock | null | undefined): boolean {
  return (
    typeof block?.low === 'number' ||
    typeof block?.avg === 'number' ||
    typeof block?.trend === 'number'
  );
}

function hasTcgplayerData(pricing: TcgplayerPricing | null | undefined): boolean {
  if (!pricing) return false;
  return productEntries(pricing).some(
    ([, price]) =>
      typeof price.marketPrice === 'number' ||
      typeof price.lowPrice === 'number' ||
      typeof price.midPrice === 'number',
  );
}

/** avg30 → avg7 → avg1, the only history the API gives us. Cardmarket only. */
function Sparkline({ block }: { block: PriceBlock }) {
  const points = [
    { value: block.avg30, label: '30-day average' },
    { value: block.avg7, label: '7-day average' },
    { value: block.avg1, label: '24-hour average' },
  ].filter((point): point is { value: number; label: string } => typeof point.value === 'number');
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = points
    .map(
      (point, index) =>
        `${(index / (points.length - 1)) * 60},${16 - ((point.value - min) / span) * 14}`,
    )
    .join(' ');
  return (
    <svg
      viewBox="0 0 60 18"
      width="60"
      height="18"
      role="img"
      // The API often omits one of the three, in which case only two points
      // are drawn — name the ones actually on screen, not all three.
      aria-label={`Price trend: ${points.map((point) => point.label).join(', ')}`}
    >
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CardmarketRow({ block, currency }: { block: PriceBlock; currency: string }) {
  const low = money(block.low, currency);
  const avg = money(block.avg, currency);
  const trend = money(block.trend, currency);
  if (!low && !avg && !trend) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-holo-line py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">Cardmarket</p>
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

/** One TCGplayer product-type row. No sparkline: that shape carries no history. */
function TcgplayerRow({
  label,
  price,
  currency,
}: {
  label: string;
  price: TcgplayerProductPrice;
  currency: string;
}) {
  const market = money(price.marketPrice ?? undefined, currency);
  const low = money(price.lowPrice ?? undefined, currency);
  const mid = money(price.midPrice ?? undefined, currency);
  if (!market && !low && !mid) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-holo-line py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">TCGplayer · {label}</p>
        <p className="text-xs text-holo-muted">
          {[low && `low ${low}`, mid && `mid ${mid}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {market ? <span className="text-sm font-medium text-holo-accent">{market}</span> : null}
    </div>
  );
}

export function PricePanel({ card }: { card: Card }) {
  const variants = (card.variants_detailed ?? []).filter(
    (variant) =>
      hasCardmarketData(variant.pricing?.cardmarket) ||
      hasTcgplayerData(variant.pricing?.tcgplayer),
  );
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
      {variants.map((variant) => {
        const cardmarket = variant.pricing?.cardmarket;
        const tcgplayer = variant.pricing?.tcgplayer;
        return (
          <div key={variant.variantId ?? variant.type} className="mt-3">
            <p className="text-xs uppercase tracking-wide text-holo-muted">{variant.type}</p>
            {cardmarket ? (
              <CardmarketRow block={cardmarket} currency={cardmarket.unit ?? 'EUR'} />
            ) : null}
            {tcgplayer
              ? productEntries(tcgplayer).map(([productType, price]) => (
                  <TcgplayerRow
                    key={productType}
                    label={productLabel(productType)}
                    price={price}
                    currency={tcgplayer.unit ?? 'USD'}
                  />
                ))
              : null}
          </div>
        );
      })}
      <p className="mt-3 text-xs text-holo-muted">
        Indicative third-party market data via TCGdex
        {updated ? `, updated ${new Date(updated).toLocaleDateString()}` : ''}.
      </p>
    </section>
  );
}

import type { ReactNode } from 'react';
import type { Card } from '../lib/tcgdex';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-holo-line py-2 last:border-0">
      <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-holo-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function StatPanel({
  card,
  onOpenName,
}: {
  card: Card;
  onOpenName?: (name: string) => void;
}) {
  return (
    <dl className="rounded-xl border border-holo-line bg-holo-panel p-4">
      {card.hp ? <Row label="HP">{card.hp}</Row> : null}
      {card.types?.length ? <Row label="Type">{card.types.join(' · ')}</Row> : null}
      {card.stage ? <Row label="Stage">{card.stage}</Row> : null}
      {card.evolveFrom ? (
        <Row label="Evolves from">
          {onOpenName ? (
            <button
              type="button"
              onClick={() => onOpenName(card.evolveFrom!)}
              className="underline hover:text-holo-accent"
            >
              {card.evolveFrom}
            </button>
          ) : (
            card.evolveFrom
          )}
        </Row>
      ) : null}
      {card.attacks?.length ? (
        <Row label="Attacks">
          <ul className="space-y-2">
            {card.attacks.map((attack) => (
              <li key={attack.name}>
                <span className="font-medium">{attack.name}</span>
                {attack.damage ? (
                  <span className="ml-2 text-holo-accent">{attack.damage}</span>
                ) : null}
                {attack.cost?.length ? (
                  <span className="ml-2 text-xs text-holo-muted">{attack.cost.join(' + ')}</span>
                ) : null}
                {attack.effect ? (
                  <p className="mt-0.5 text-xs text-holo-muted">{attack.effect}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Row>
      ) : null}
      {card.weaknesses?.length ? (
        <Row label="Weakness">{card.weaknesses.map((w) => `${w.type} ${w.value}`).join(', ')}</Row>
      ) : null}
      {typeof card.retreat === 'number' ? <Row label="Retreat">{card.retreat}</Row> : null}
      {card.description ? <Row label="Flavour">{card.description}</Row> : null}
      {card.illustrator ? <Row label="Illustrator">{card.illustrator}</Row> : null}
      {card.rarity ? <Row label="Rarity">{card.rarity}</Row> : null}
      <Row label="Set">
        {card.set.name} · {card.localId}/{card.set.cardCount.official}
      </Row>
      {card.regulationMark ? <Row label="Regulation">{card.regulationMark}</Row> : null}
      {card.legal ? (
        <Row label="Legal">
          {[card.legal.standard ? 'Standard' : null, card.legal.expanded ? 'Expanded' : null]
            .filter(Boolean)
            .join(' · ') || 'Not tournament legal'}
        </Row>
      ) : null}
    </dl>
  );
}

import { ARENAS } from '../arenas-meta';
import { LEVELS, type LevelId } from '../engine/levels';
import type { GameSettings, Mode, SidePick } from '../settings';
import { ArenaCard } from './ArenaCard';
import { PresetPicker } from './PresetPicker';

const SIDES: { id: SidePick; label: string }[] = [
  { id: 'w', label: 'Righteous (white)' },
  { id: 'b', label: 'Demonic (black)' },
  { id: 'random', label: 'Let fate decide' },
];

export function Lobby(props: {
  settings: GameSettings;
  onChange(settings: GameSettings): void;
  onStart(): void;
  assetBase: string;
}) {
  const { settings, onChange, onStart, assetBase } = props;
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <main className="chess-lobby">
      <header className="chess-lobby__head">
        <p className="chess-lobby__kicker">Treasures of the Nine Heavens</p>
        <h1 className="chess-lobby__title">Cultivation Chess</h1>
        <p className="chess-lobby__lede">
          International chess, fought with seals, swords and spirit bells. Choose your path and your
          arena.
        </p>
      </header>

      <fieldset className="chess-field">
        <legend>Opponent</legend>
        <div className="chess-seg">
          {(
            [
              ['ai', 'Stockfish elder'],
              ['hotseat', 'Fellow cultivator (same device)'],
            ] as [Mode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={settings.mode === id}
              onClick={() => set('mode', id)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {settings.mode === 'ai' && (
        <>
          <fieldset className="chess-field">
            <legend>Your sect</legend>
            <div className="chess-seg">
              {SIDES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={settings.playerSide === s.id}
                  onClick={() => set('playerSide', s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="chess-field">
            <legend>Opponent realm</legend>
            <div className="chess-seg chess-seg--wrap">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={settings.level === l.id}
                  onClick={() => set('level', l.id as LevelId)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="chess-field">
        <legend>Arena</legend>
        <div className="chess-arenas">
          {ARENAS.map((arena, i) => (
            <ArenaCard
              key={arena.id}
              arena={arena}
              selected={settings.arenaId === arena.id}
              priority={i === 0}
              assetBase={assetBase}
              onSelect={() => set('arenaId', arena.id)}
            />
          ))}
        </div>
      </fieldset>

      <PresetPicker settings={settings} onChange={onChange} assetBase={assetBase} />

      <button type="button" className="chess-start" onClick={onStart}>
        Enter battle
      </button>
      <p className="chess-lobby__note">Drag to rotate the view, scroll or pinch to zoom.</p>
    </main>
  );
}

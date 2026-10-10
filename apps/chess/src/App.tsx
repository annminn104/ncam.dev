import { Suspense, lazy, useEffect, useState } from 'react';
import { BattleErrorBoundary } from './ErrorBoundary';
import { Lobby } from './lobby/Lobby';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GameSettings } from './settings';

// three, R3F and drei live in this chunk. It loads when a battle starts, never with the lobby
// or its server render (ssr-graph.test.ts holds the static import graph to that). The server
// only ever renders the lobby (a battle starts from a click), so its build names no chunk at
// all: Vite folds import.meta.env.SSR to true there and the import goes with its branch. A load
// that fails stays failed: lazy() and the browser both remember a rejected import, so there is
// no retry to offer, only the lobby, and the failure screen tells the player to reload.
const Battle = lazy(() =>
  import.meta.env.SSR
    ? Promise.reject(new Error('A battle never renders on the server'))
    : import('./battle/Battle'),
);

export interface AppProps {
  assetBase: string;
}

export default function App({ assetBase }: AppProps) {
  // Server and first client render use the defaults (hydration-safe); stored
  // settings arrive in an effect.
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<'lobby' | 'battle'>('lobby');
  // Bumped by a rematch: a new key mounts a fresh battle.
  const [round, setRound] = useState(0);
  useEffect(() => setSettings(loadSettings()), []);
  const change = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  };
  return (
    <div className="chess-root">
      {phase === 'lobby' ? (
        <Lobby
          settings={settings}
          onChange={change}
          onStart={() => setPhase('battle')}
          assetBase={assetBase}
        />
      ) : (
        <BattleErrorBoundary onBack={() => setPhase('lobby')}>
          <Suspense fallback={<p className="chess-loading">Gathering qi…</p>}>
            <Battle
              key={round}
              settings={settings}
              assetBase={assetBase}
              onExit={() => setPhase('lobby')}
              onRematch={() => setRound((r) => r + 1)}
            />
          </Suspense>
        </BattleErrorBoundary>
      )}
    </div>
  );
}

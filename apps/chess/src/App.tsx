import { useEffect, useState } from 'react';
import { Lobby } from './lobby/Lobby';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GameSettings } from './settings';

export interface AppProps {
  assetBase: string;
}

export default function App({ assetBase }: AppProps) {
  // Server and first client render use the defaults (hydration-safe); stored
  // settings arrive in an effect.
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadSettings()), []);
  const change = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  };
  return (
    <div className="chess-root">
      <Lobby settings={settings} onChange={change} onStart={() => {}} assetBase={assetBase} />
    </div>
  );
}

import type { Settings } from '../engine/settings';

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const SLIDERS: { key: NumKey; label: string; min: number; max: number }[] = [
  { key: 'rain', label: 'Rain', min: 0, max: 1.5 },
  { key: 'exposure', label: 'Exposure', min: 0.3, max: 2.5 },
  { key: 'fog', label: 'Fog', min: 0, max: 2.5 },
  { key: 'bloom', label: 'Bloom', min: 0, max: 2 },
];
const TOGGLES: { key: BoolKey; label: string }[] = [
  { key: 'ao', label: 'SSAO' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'cruise', label: 'Auto-orbit (C)' },
];

interface Props {
  settings: Settings;
  fps: number | null;
  onChange(patch: Partial<Settings>): void;
}

export function SettingsPanel({ settings, fps, onChange }: Props) {
  return (
    <section className="ms-panel" aria-label="Settings">
      <div className="ms-panel-title">
        <span>Settings</span>
        <span className="ms-fps">{fps === null ? '--' : Math.round(fps)} fps</span>
      </div>
      {SLIDERS.map((s) => (
        <label key={s.key}>
          {s.label}
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={0.01}
            value={settings[s.key]}
            onChange={(e) => onChange({ [s.key]: +e.target.value })}
          />
        </label>
      ))}
      {TOGGLES.map((t) => (
        <label key={t.key}>
          {t.label}
          <input
            type="checkbox"
            checked={settings[t.key]}
            onChange={(e) => onChange({ [t.key]: e.target.checked })}
          />
        </label>
      ))}
    </section>
  );
}

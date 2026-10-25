import { useState } from 'react';
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

/**
 * The live scene's controls. On a desktop the body always shows and the toggle is hidden; on a
 * phone (styles/globals.css, max-width 640px) the panel folds into the toggle, so it no longer
 * covers the diorama, and the toggle opens and closes it. CSS alone decides which applies.
 */
export function SettingsPanel({ settings, fps, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rate = `${fps === null ? '--' : Math.round(fps)} fps`;
  return (
    <section className={open ? 'ms-panel is-open' : 'ms-panel'} aria-label="Settings">
      <button
        type="button"
        className="ms-panel-toggle"
        aria-expanded={open}
        aria-controls="ms-settings-body"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Settings</span>
        {/* Hidden from the name, which would otherwise change with every reading. */}
        <span className="ms-fps" aria-hidden="true">
          {rate}
        </span>
      </button>
      <div id="ms-settings-body" className="ms-panel-body">
        <div className="ms-panel-title">
          <span>Settings</span>
          <span className="ms-fps">{rate}</span>
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
      </div>
    </section>
  );
}

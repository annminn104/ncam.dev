import type { Side } from '../game/coords';
import { contrastOf, presetMeta, readyPresets, type PresetId } from '../presets-meta';
import type { GameSettings } from '../settings';
import { PresetCard } from './PresetCard';

/** The side the human plays; "let fate decide" counts as white until the battle draws it. */
const playerOf = (s: GameSettings): Side => (s.playerSide === 'b' ? 'b' : 'w');

/** A choice for one side, or for both while the sides are linked. */
export function choosePreset(s: GameSettings, side: Side | 'both', id: PresetId): GameSettings {
  if (side === 'both') return { ...s, whitePreset: id, blackPreset: id };
  return side === 'w' ? { ...s, whitePreset: id } : { ...s, blackPreset: id };
}

/**
 * Linking or unlinking the sides. Unlinking keeps the player's set where it is; vs the AI the
 * other side starts on its contrast, in hot-seat it stays as it was. Linking makes both sides
 * the player's set.
 */
export function setLinked(s: GameSettings, linked: boolean): GameSettings {
  const mine = playerOf(s) === 'w' ? s.whitePreset : s.blackPreset;
  if (linked) return { ...s, linkPresets: true, whitePreset: mine, blackPreset: mine };
  if (s.mode !== 'ai') return { ...s, linkPresets: false };
  const theirs = contrastOf(mine);
  return playerOf(s) === 'w'
    ? { ...s, linkPresets: false, whitePreset: mine, blackPreset: theirs }
    : { ...s, linkPresets: false, whitePreset: theirs, blackPreset: mine };
}

function Row(props: {
  label: string;
  side: Side | 'both';
  value: PresetId;
  assetBase: string;
  onPick(id: PresetId): void;
}) {
  const { label, side, value, assetBase, onPick } = props;
  return (
    <div className="chess-presets" role="radiogroup" aria-label={label}>
      {readyPresets().map((p) => (
        <PresetCard
          key={p.id}
          preset={p}
          side={side}
          checked={value === p.id}
          assetBase={assetBase}
          onSelect={() => onPick(p.id)}
        />
      ))}
    </div>
  );
}

export function PresetPicker({
  settings,
  onChange,
  assetBase,
}: {
  settings: GameSettings;
  onChange(s: GameSettings): void;
  assetBase: string;
}) {
  // Nothing to choose between yet: no empty UI while the other sets are being built.
  if (readyPresets().length < 2) return null;
  const mine = playerOf(settings) === 'w' ? settings.whitePreset : settings.blackPreset;
  const answer = contrastOf(mine);
  return (
    <fieldset className="chess-field">
      <legend>Piece set</legend>
      {settings.linkPresets ? (
        <>
          <Row
            label="Piece set"
            side="both"
            value={mine}
            assetBase={assetBase}
            onPick={(id) => onChange(choosePreset(settings, 'both', id))}
          />
          {settings.mode === 'ai' && answer !== mine && (
            <p className="chess-presets__note">The elder answers with {presetMeta(answer).name}.</p>
          )}
        </>
      ) : (
        <>
          <p className="chess-presets__side">Righteous (white)</p>
          <Row
            label="Righteous (white) piece set"
            side="w"
            value={settings.whitePreset}
            assetBase={assetBase}
            onPick={(id) => onChange(choosePreset(settings, 'w', id))}
          />
          <p className="chess-presets__side">Demonic (black)</p>
          <Row
            label="Demonic (black) piece set"
            side="b"
            value={settings.blackPreset}
            assetBase={assetBase}
            onPick={(id) => onChange(choosePreset(settings, 'b', id))}
          />
        </>
      )}
      <label className="chess-check">
        <input
          type="checkbox"
          checked={!settings.linkPresets}
          onChange={(e) => onChange(setLinked(settings, !e.currentTarget.checked))}
        />
        Choose a different set for each side
      </label>
    </fieldset>
  );
}

import { useState, type FormEvent } from 'react';
import type { CollectionRef } from '../routes';
import type { SkinId } from '../skins';
import type { Collection } from '../spotify/types';
import { Presets } from './Presets';
import { SkinPicker } from './SkinPicker';

interface Props {
  collection: Collection | null;
  loading: boolean;
  /** Nothing is loaded or loading: a first load failed (the tracklist says why). */
  failed?: boolean;
  error: string | null;
  /** The error is the field's own: a pasted link that was refused or would not load. */
  invalid?: boolean;
  /** Loads the link again, beside an error that trying again may fix (a 502, a stall). */
  onRetry?: () => void;
  onSubmit(input: string): void;
  /** The player's colourway, picked after Share. */
  skin: SkinId;
  onSkin(id: SkinId): void;
  /** The collection in view, and the one being loaded, for "Popular on Spotify" (Presets). */
  current: CollectionRef | null;
  busy: CollectionRef | null;
  onPick(ref: CollectionRef): void;
}

/**
 * Copies `text`: false when there is no clipboard (a page on plain http) or it refuses (a denied
 * permission). It never rejects.
 */
export function copyText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<boolean> {
  if (!clipboard) return Promise.resolve(false);
  return clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

/**
 * The collection's name, the link input (the page's personalisation), Share and Player, then the
 * playlists of "Popular on Spotify".
 */
export function LinkBar({
  collection,
  loading,
  failed = false,
  error,
  invalid = false,
  onRetry,
  onSubmit,
  skin,
  onSkin,
  current,
  busy,
  onPick,
}: Props) {
  const [value, setValue] = useState('');
  // What Share last did, said on its button for two seconds.
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value);
  };
  const share = () => {
    void copyText(window.location.href, navigator.clipboard).then((copied) => {
      setShared(copied ? 'copied' : 'failed');
      setTimeout(() => setShared(null), 2000);
    });
  };
  return (
    <header className="cdp-bar">
      <div className="cdp-bar__title">
        <p className="cdp-eyebrow">Now spinning</p>
        <h1>{collection?.name ?? (failed ? 'No tracks' : 'Loading…')}</h1>
        {collection?.subtitle && <p className="cdp-bar__subtitle">{collection.subtitle}</p>}
      </div>
      <form className="cdp-link" onSubmit={submit} noValidate>
        <label htmlFor="cdp-link-input" className="cdp-sr">
          Spotify playlist or album link
        </label>
        <input
          id="cdp-link-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a Spotify playlist or album link"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error && invalid ? true : undefined}
          aria-describedby={error && invalid ? 'cdp-link-error' : undefined}
        />
        <button type="submit" className="cdp-button cdp-button--primary" disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        <button type="button" className="cdp-button" onClick={share}>
          {shared === 'copied' ? 'Copied' : shared === 'failed' ? "Couldn't copy" : 'Share'}
        </button>
        <SkinPicker skin={skin} onChange={onSkin} />
      </form>
      {error && (
        <div className="cdp-link__error">
          <p id="cdp-link-error" role="alert">
            {error}
          </p>
          {onRetry && (
            <button type="button" className="cdp-button cdp-button--small" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
      <Presets current={current} busy={busy} onPick={onPick} />
    </header>
  );
}

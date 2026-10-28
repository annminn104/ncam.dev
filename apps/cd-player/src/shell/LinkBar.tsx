import { useState, type FormEvent } from 'react';
import type { Collection } from '../spotify/types';

interface Props {
  collection: Collection | null;
  loading: boolean;
  error: string | null;
  onSubmit(input: string): void;
}

/** The collection's name, the link input (the page's personalisation) and Share. */
export function LinkBar({ collection, loading, error, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value);
  };
  const share = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <header className="cdp-bar">
      <div className="cdp-bar__title">
        <p className="cdp-eyebrow">Now spinning</p>
        <h1>{collection?.name ?? 'Loading…'}</h1>
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cdp-link-error' : undefined}
        />
        <button type="submit" className="cdp-button cdp-button--primary" disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        <button type="button" className="cdp-button" onClick={share}>
          {copied ? 'Copied' : 'Share'}
        </button>
      </form>
      {error && (
        <p id="cdp-link-error" className="cdp-link__error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

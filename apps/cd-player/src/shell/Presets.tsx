import { PRESETS } from '../presets';
import { sameCollection, type CollectionRef } from '../routes';

interface Props {
  /** The collection in view: its preset is marked as the current one. */
  current: CollectionRef | null;
  /** The collection a preset or a pasted link is loading: its preset says so in place of its tag. */
  busy: CollectionRef | null;
  onPick(ref: CollectionRef): void;
}

/**
 * "Popular on Spotify": the playlists of src/presets.ts, each a press away; `App` loads the one
 * pressed as it loads a pasted link. Server-rendered with the rest of the bar. The covers come from
 * Spotify's CDN, lazy and small: none of them is ever the page's largest paint.
 */
export function Presets({ current, busy, onPick }: Props) {
  return (
    <section className="cdp-presets" aria-labelledby="cdp-presets-title">
      <p className="cdp-eyebrow" id="cdp-presets-title">
        Popular on Spotify
      </p>
      <ul className="cdp-presets__list">
        {PRESETS.map((preset) => {
          const isCurrent = sameCollection(preset.ref, current);
          const isBusy = sameCollection(preset.ref, busy);
          return (
            <li key={preset.ref.id}>
              <button
                type="button"
                className={isCurrent ? 'cdp-preset is-current' : 'cdp-preset'}
                aria-current={isCurrent ? 'true' : undefined}
                // Its tag says so too, but a phone's chip hides the tag: the cover dims.
                aria-busy={isBusy ? 'true' : undefined}
                onClick={() => onPick(preset.ref)}
              >
                <img
                  className="cdp-preset__cover"
                  src={preset.cover}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
                <span className="cdp-preset__text">
                  <span className="cdp-preset__name">{preset.name}</span>{' '}
                  <span className="cdp-preset__tag">{isBusy ? 'Loading…' : preset.tag}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

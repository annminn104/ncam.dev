import { ballHolo } from './poke-ball-holo';

/**
 * The 151 set's Master Ball reverse holo: poke-ball-holo.css's
 * `masterball holo` selectors. The reference gives it every rule the Poke
 * Ball has and overrides only the patterns: `--mask: var(--masterball)` on the
 * :after and `--mask: var(--masterball-inner)` on the :before. Its
 * approximations are poke-ball-holo.ts's.
 */
export const masterballHolo = ballHolo('masterball-holo', {
  outer: 'masterball',
  inner: 'masterball-inner',
});

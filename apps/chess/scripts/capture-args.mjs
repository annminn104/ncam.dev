// The arguments of scripts/capture-presets.mjs, checked before a browser starts: a typo must stop
// the run, not rewrite the lobby previews. Kept apart from that script (which launches a browser
// as soon as it is imported) so capture-args.test.ts can run it.

export const USAGE = `usage: node scripts/capture-presets.mjs                     the lobby previews
       node scripts/capture-presets.mjs --review [preset] [--white <preset>]
                                                   a figure set's review (default holy-order), the
                                                   arena views with --white's set as white`;

/**
 * `{ review: false, preset: null, white: null }` for the lobby previews (no argument), or
 * `{ review: true, preset, white }` for `--review [preset] [--white <preset>]`: `preset` is the
 * set reviewed (black in the arena views), `white` the set white plays there (`preset` when not
 * given), both among `figures` (art/budgets.json's keys). Anything else throws an Error whose
 * message says what was wrong. Leading `--`s are dropped: pnpm hands the script the one in
 * `pnpm capture:presets -- --review`.
 */
export function parseCaptureArgs(argv, figures) {
  const args = [...argv];
  while (args[0] === '--') args.shift();
  if (args.length === 0) return { review: false, preset: null, white: null };
  const [mode, ...rest] = args;
  if (mode !== '--review') throw new Error(`unknown argument "${mode}"`);
  const preset = rest.length > 0 && rest[0] !== '--white' ? rest.shift() : 'holy-order';
  let white = preset;
  if (rest[0] === '--white') {
    rest.shift();
    white = rest.shift() ?? '';
  }
  if (rest.length > 0) throw new Error(`unexpected argument "${rest[0]}"`);
  for (const id of [preset, white]) {
    if (!figures.includes(id)) {
      throw new Error(`"${id}" is not a figure preset (${figures.join(', ')})`);
    }
  }
  return { review: true, preset, white };
}

// The arguments of scripts/capture-presets.mjs, checked before a browser starts: a typo must stop
// the run, not rewrite the lobby previews. Kept apart from that script (which launches a browser
// as soon as it is imported) so capture-args.test.ts can run it.

export const USAGE = `usage: node scripts/capture-presets.mjs                     the lobby previews
       node scripts/capture-presets.mjs --review [preset]  a figure set's review (default holy-order)`;

/**
 * `{ review: false, preset: null }` for the lobby previews (no argument), or
 * `{ review: true, preset }` for `--review [preset]`, where `preset` is one of `figures`
 * (art/budgets.json's keys). Anything else throws an Error whose message says what was wrong.
 * Leading `--`s are dropped: pnpm hands the script the one in `pnpm capture:presets -- --review`.
 */
export function parseCaptureArgs(argv, figures) {
  const args = [...argv];
  while (args[0] === '--') args.shift();
  if (args.length === 0) return { review: false, preset: null };
  const [mode, preset = 'holy-order', ...rest] = args;
  if (mode !== '--review') throw new Error(`unknown argument "${mode}"`);
  if (rest.length > 0) throw new Error(`unexpected argument "${rest[0]}"`);
  if (!figures.includes(preset)) {
    throw new Error(`"${preset}" is not a figure preset (${figures.join(', ')})`);
  }
  return { review: true, preset };
}

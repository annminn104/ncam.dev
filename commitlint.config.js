/** Conventional Commits — see https://www.conventionalcommits.org */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Skip linting entirely for Dependabot's automated commits: its generated
  // bodies (long changelog / compare URLs) legitimately break rules such as
  // body-max-line-length, and we don't control that format. Matched on the
  // `Signed-off-by: dependabot[bot]` trailer it stamps on every commit.
  // Human commits are still held to the full Conventional Commits ruleset.
  ignores: [(message) => /dependabot\[bot\]/.test(message)],
};

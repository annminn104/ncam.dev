#!/usr/bin/env bash
#
# Install external agent skills into this repo via the official skills CLI.
# Docs: https://vercel.com/docs/agent-resources/skills   |   https://skills.sh
#
# Run from the repo root:
#   pnpm skills:add            (or)   bash scripts/add-agent-skills.sh
#
# Manage later:
#   npx skills ls              list installed skills
#   npx skills update          upgrade to latest
#   npx skills remove <name>   remove one
#
# Skills install into your agent's skill directory (Claude Code / Cowork:
# .claude/skills/). --copy writes real files (committable); -y skips prompts.

set -uo pipefail
SKILLS="npx --yes skills@latest"

add() {
  echo
  echo "▶ skills add $*"
  $SKILLS add "$@" --copy -y || echo "  ⚠  failed (skipped): $*"
}

# --- antfu: Anthony Fu's collection (19 skills: antfu, antfu-design, nitro, nuxt, pinia, …) ---
add https://github.com/antfu/skills --skill '*'

# --- Vercel: React / Next.js ---
add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices,vercel-composition-patterns
add https://github.com/vercel-labs/openreview   --skill next-cache-components,next-upgrade,next-best-practices

# --- Vercel: browser automation + durable workflows ---
add https://github.com/vercel-labs/agent-browser --skill agent-browser
add https://github.com/vercel/workflow           --skill workflow

echo
echo "✅ Done. Installed skills:"
$SKILLS ls || true

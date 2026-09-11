# AGENTS.md — @ncam/design-tokens

One CSS file, `tokens.css`: the custom properties shared by the portfolio host
(`apps/portfolio/src/app.css`) and the profile remote
(`apps/profile/src/styles/profile.css`). No build step — consumers `@import
'@ncam/design-tokens/tokens.css'` and Vite inlines it.

- Colours, type stacks, accent palette, hairlines, easing, and the host shell
  geometry (`--nav-h`, `--rail-w`, `--gutter`) the remote aligns its sections to.
- `--page-bg` is intentionally **not** here: the host sets and tweens it on
  `.home`; the remote reads `var(--page-bg, var(--bg))`.
- Change a token here, not in either app. Both bundle their own copy, so a change
  needs both rebuilt to stay in sync.

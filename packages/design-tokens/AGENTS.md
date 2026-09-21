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

## Theming

Every palette value is a `--dark-*` / `--light-*` **pair**, declared once. Four
rules re-point the live token (`--bg`, `--text`, …) at one of the pair:

| Selector                                                                  | Wins when                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| `:root`                                                                   | dark — the fallback with no JS and no OS preference |
| `@media (prefers-color-scheme: light)` + `:root:not([data-theme='dark'])` | the OS asks for light and nothing is pinned         |
| `:root[data-theme='light' \| 'dark']`                                     | the visitor pinned a theme, beating the OS          |

- **Add a colour as a pair**, then add the live `--x: var(--dark-x)` line to all
  four blocks. A colour declared in only one block silently keeps dark's value in
  light mode.
- `--tint` is the colour a surface is mixed _with_ to separate it from the page
  (`#fff` dark, `#000` light) — use `color-mix(… var(--tint) N%, transparent)`
  instead of a literal `rgba(255,255,255,…)`. `--shadow` and `--danger` exist for
  the same reason.
- `data-theme` is written on `<html>` before first paint by
  `apps/portfolio/src/lib/theme.ts`. Remotes mount into the host document, so
  they inherit it — theming crosses the federation boundary with no new
  interface, and the profile remote's standalone dev page follows the OS on its
  own via the media query.
- Literal `#000` inside `mask-image` / `-webkit-mask-image` is a mask, not a
  colour. Leave it.
- The **project remotes on `.stage`** (bali, toonhub, …) keep their own art
  direction and are deliberately not themed; `.stage__back` stays hard-coded dark
  because it floats over their artwork. The blog pages reuse `.stage` but are
  host chrome, so `blog.css` re-themes that button there.

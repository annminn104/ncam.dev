// Standalone dev page only. When mounted in the portfolio host the fonts come
// from the host's stylesheet (same families, see @ncam/design-tokens), so the
// exposed modules do NOT import these — no double download across origins.
import '@fontsource-variable/syne';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

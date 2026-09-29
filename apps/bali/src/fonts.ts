// Fonts are bundled via @fontsource so they load standalone AND when mounted
// cross-origin inside the host (a <link> in index.html would not travel). The
// list is styles/fonts.css, which ./ssr also inlines.
import './styles/fonts.css';

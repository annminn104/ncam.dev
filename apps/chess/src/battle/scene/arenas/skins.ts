import type { ArenaId } from '../../../arenas-meta';
import type { BoardSkin } from '../Board';

/** Each arena's board. Kept apart from the scenes so Node tests can read it without three. */
export const ARENA_SKINS: Record<ArenaId, BoardSkin> = {
  // White jade and celadon. A deeper jade than the brief's #2fbf8f for the highlights, which
  // matched the celadon squares' brightness and faded on them.
  'cloud-peak': { light: '#f1f4ea', dark: '#7fa894', frame: '#c9d6cf', highlight: '#0e8f68' },
  // Obsidian; the molten seams between the squares are the arena's own (BloodMoon.tsx). The
  // light squares are lifted above the brief's #5b4a4a: under the red moon they rendered almost
  // black, and the board stopped reading as a chequerboard.
  'blood-moon': { light: '#7a5a58', dark: '#1a1214', frame: '#0d0a0b', highlight: '#ff5a3c' },
  // Pale stone; the lotus inlays on the frame and terraces are the arena's own (LotusLake.tsx).
  // Lotus-pink highlights: the brief's pale blue (#9fc3ff) all but vanished on the moonlit stone.
  'lotus-lake': { light: '#e6e4dc', dark: '#8a8fa3', frame: '#5a6078', highlight: '#ff8cc6' },
};

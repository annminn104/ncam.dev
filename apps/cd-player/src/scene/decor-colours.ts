import { Color } from 'three';

/** The Đông Sơn gold: fixed, no look recolours it. */
export const GOLD = '#d6ae5a';

/** `hex` mixed toward `target` by `amount`, each sRGB channel (0–255) linearly, rounded. */
export function mixHex(hex: string, target: '#ffffff' | '#000000', amount: number): string {
  const to = target === '#ffffff' ? 255 : 0;
  const channels = [1, 3, 5].map((i) => {
    const from = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(from + (to - from) * amount);
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The copper traces' colour from the board's: lifted toward white by 0.22 on a dark board (relative
 * luma, 0.2126 R + 0.7152 G + 0.0722 B on linear channels, under 0.5), toward black by 0.12 on a
 * light one. art/blender/scripts/clear.py makes the same colour.
 */
export function traceColour(board: string): string {
  const { r, g, b } = new Color(board);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 0.5 ? mixHex(board, '#ffffff', 0.22) : mixHex(board, '#000000', 0.12);
}

/** The frosted etching's colour: the shell's tint lifted toward white by 0.55. */
export function etchColour(tint: string): string {
  return mixHex(tint, '#ffffff', 0.55);
}

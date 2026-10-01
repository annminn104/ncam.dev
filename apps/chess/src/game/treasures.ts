import type { PieceSymbol } from 'chess.js';
import type { Side } from './coords';

export const TREASURES: Record<PieceSymbol, { name: string; glyph: string; piece: string }> = {
  k: { name: 'Heaven Seal', glyph: '王', piece: 'King' },
  q: { name: 'Flying Sword Ring', glyph: '后', piece: 'Queen' },
  r: { name: 'Nine-Dragon Cauldron', glyph: '车', piece: 'Rook' },
  b: { name: 'Taiji Mirror', glyph: '象', piece: 'Bishop' },
  n: { name: 'Spirit Bell', glyph: '马', piece: 'Knight' },
  p: { name: 'Spirit Pearl', glyph: '兵', piece: 'Pawn' },
};

export const SECTS: Record<Side, string> = { w: 'Righteous Sect', b: 'Demonic Sect' };

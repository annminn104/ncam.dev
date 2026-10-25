import type { PieceSymbol } from 'chess.js';
import { assetUrl } from '../../../../lib/asset-url';

/** A figure's file: presets/<preset>/<type>.glb, or <type>-low.glb for the low LOD. */
export function figureUrl(
  preset: string,
  type: PieceSymbol,
  lod: 'high' | 'low',
  base: string,
): string {
  return assetUrl(`presets/${preset}/${type}${lod === 'low' ? '-low' : ''}.glb`, base);
}

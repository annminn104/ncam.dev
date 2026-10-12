import { useLoader } from '@react-three/fiber';
import { Suspense, useContext } from 'react';
import type { Material } from 'three';
import { TREASURES } from '../../../../game/treasures';
import { AssetBaseContext } from '../../../asset-base';
import { QualityContext } from '../../../quality';
import { PieceBase, Treasure } from '../../pieces';
import { registerRenderer, type PresetPieceProps } from '../index';
import { FigureBoundary } from './FigureBoundary';
import { FigureLoader } from './FigureLoader';
import { outlineMaterial, paintMaterial } from './material';
import { isFigurePreset } from './palettes';
import { figureUrl } from './url';

/** The outline never takes a click: a click hits the paint or the base, as on a treasure. */
const noRaycast = () => {};

/** One figure file drawn twice from its one geometry: the paint, then the ink outline. */
function FigureMeshes({
  url,
  paint,
  outline,
}: {
  url: string;
  paint: Material;
  outline: Material;
}) {
  const geometry = useLoader(FigureLoader, url);
  return (
    <>
      <mesh geometry={geometry} material={paint} castShadow />
      <mesh geometry={geometry} material={outline} raycast={noRaycast} />
    </>
  );
}

/**
 * A piece of a Blender-built set (the 'figure' kind). The treasure stands in while its file
 * loads, and for good if it cannot (FigureBoundary). At 'low' quality the low file takes over in
 * place: the high figure stays until the low one has loaded.
 */
export function FigureRenderer({ preset, piece, jumping }: PresetPieceProps) {
  const quality = useContext(QualityContext);
  const base = useContext(AssetBaseContext);
  const treasure = <Treasure piece={piece} jumping={jumping} />;
  if (!isFigurePreset(preset)) return treasure;
  const paint = paintMaterial(preset, piece.color);
  const outline = outlineMaterial(preset, piece.color);
  const url = (lod: 'high' | 'low') => figureUrl(preset, piece.type, lod, base);
  const high = <FigureMeshes url={url('high')} paint={paint} outline={outline} />;
  return (
    <FigureBoundary fallback={treasure}>
      <Suspense fallback={treasure}>
        {/* The one turn: black's figures face the other end. The treasure turns itself. */}
        <group rotation-y={piece.color === 'b' ? Math.PI : 0}>
          <PieceBase side={piece.color} glyph={TREASURES[piece.type].glyph} />
          {quality === 'low' ? (
            <Suspense fallback={high}>
              <FigureMeshes url={url('low')} paint={paint} outline={outline} />
            </Suspense>
          ) : (
            high
          )}
        </group>
      </Suspense>
    </FigureBoundary>
  );
}

registerRenderer('figure', FigureRenderer);

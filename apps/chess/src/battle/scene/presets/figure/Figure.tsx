import { useLoader } from '@react-three/fiber';
import { Suspense, useContext } from 'react';
import type { Material } from 'three';
import { TREASURES } from '../../../../game/treasures';
import { AssetBaseContext } from '../../../asset-base';
import { QualityContext } from '../../../quality';
import { PieceBase, Treasure } from '../../pieces';
import { registerRenderer, type PresetPieceProps } from '../index';
import { FigureBoundary } from './FigureBoundary';
import { FigureLoader, isFigureLoaded } from './FigureLoader';
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
 * loads, and for the rest of the battle if it cannot (FigureBoundary, keyed by the piece's type so
 * that a promotion starts afresh). At 'low' quality the low file takes over: in place once the
 * high figure is loaded (it stays until the low one has), while a battle that starts low fetches
 * only the low files. A low file that fails leaves the high figure.
 */
export function FigureRenderer({ preset, piece, jumping }: PresetPieceProps) {
  const quality = useContext(QualityContext);
  const base = useContext(AssetBaseContext);
  const treasure = <Treasure piece={piece} jumping={jumping} />;
  if (!isFigurePreset(preset)) return treasure;
  const paint = paintMaterial(preset, piece.color);
  const outline = outlineMaterial(preset, piece.color);
  const highUrl = figureUrl(preset, piece.type, 'high', base);
  const high = <FigureMeshes url={highUrl} paint={paint} outline={outline} />;
  let figure = high;
  if (quality === 'low') {
    const lowUrl = figureUrl(preset, piece.type, 'low', base);
    const low = <FigureMeshes url={lowUrl} paint={paint} outline={outline} />;
    // Without the high figure loaded the low one suspends to the treasure below.
    figure = (
      <FigureBoundary fallback={high}>
        {isFigureLoaded(highUrl) ? <Suspense fallback={high}>{low}</Suspense> : low}
      </FigureBoundary>
    );
  }
  return (
    <FigureBoundary key={piece.type} fallback={treasure}>
      <Suspense fallback={treasure}>
        {/* The one turn: black's figures face the other end. The treasure turns itself. */}
        <group rotation-y={piece.color === 'b' ? Math.PI : 0}>
          <PieceBase side={piece.color} glyph={TREASURES[piece.type].glyph} />
          {figure}
        </group>
      </Suspense>
    </FigureBoundary>
  );
}

registerRenderer('figure', FigureRenderer);

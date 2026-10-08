import type { Square } from 'chess.js';
import { useMemo } from 'react';
import { SQUARES, isLightSquare, squareToPosition } from '../../game/coords';

export interface BoardSkin {
  light: string;
  dark: string;
  frame: string;
  highlight: string;
}

export const DEFAULT_SKIN: BoardSkin = {
  light: '#e9efe6',
  dark: '#4f6b62',
  frame: '#2a2f33',
  highlight: '#7fd6b5',
};

export function Board(props: {
  skin: BoardSkin;
  targets: Square[];
  selected: Square | null;
  lastMove: { from: Square; to: Square } | null;
  cursor: Square | null;
  onSquare(sq: Square): void;
}) {
  const { skin, targets, selected, lastMove, cursor, onSquare } = props;
  const tiles = useMemo(
    () => SQUARES.map((sq) => ({ sq, pos: squareToPosition(sq), light: isLightSquare(sq) })),
    [],
  );
  return (
    <group>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.3, 8.8]} />
        <meshStandardMaterial color={skin.frame} roughness={0.6} metalness={0.2} />
      </mesh>
      {tiles.map(({ sq, pos: [x, z], light }) => {
        const isTarget = targets.includes(sq);
        const isLast = lastMove?.from === sq || lastMove?.to === sq;
        return (
          <group key={sq} position={[x, 0, z]}>
            <mesh
              rotation-x={-Math.PI / 2}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                onSquare(sq);
              }}
            >
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial
                color={light ? skin.light : skin.dark}
                roughness={0.35}
                metalness={0.05}
              />
            </mesh>
            {(isLast || sq === selected) && (
              <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial
                  color={skin.highlight}
                  transparent
                  opacity={sq === selected ? 0.45 : 0.22}
                  depthWrite={false}
                />
              </mesh>
            )}
            {isTarget && (
              <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
                <ringGeometry args={[0.16, 0.24, 32]} />
                <meshBasicMaterial
                  color={skin.highlight}
                  transparent
                  opacity={0.9}
                  depthWrite={false}
                />
              </mesh>
            )}
            {sq === cursor && (
              // The keyboard focus: a square frame out by the tile's edge, where piece bases
              // don't hide it, and two-tone (gold on a dark band) so it reads on light and dark
              // squares alike; no tone mapping or fog, it is UI. Both draw in the transparent pass,
              // the gold last (renderOrder): neither writes depth, so an opaque gold ring would be
              // drawn first and the band laid over it. A 4-segment ring's radii are to its
              // corners: half-width × √2.
              <group position-y={0.012}>
                <mesh rotation-x={-Math.PI / 2} renderOrder={1}>
                  <ringGeometry
                    args={[0.405 * Math.SQRT2, 0.495 * Math.SQRT2, 4, 1, Math.PI / 4]}
                  />
                  <meshBasicMaterial
                    color="#0b0f14"
                    transparent
                    opacity={0.78}
                    depthWrite={false}
                    toneMapped={false}
                    fog={false}
                  />
                </mesh>
                <mesh rotation-x={-Math.PI / 2} position-y={0.002} renderOrder={2}>
                  <ringGeometry args={[0.42 * Math.SQRT2, 0.48 * Math.SQRT2, 4, 1, Math.PI / 4]} />
                  <meshBasicMaterial
                    color="#d8b45a"
                    transparent
                    depthWrite={false}
                    toneMapped={false}
                    fog={false}
                  />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

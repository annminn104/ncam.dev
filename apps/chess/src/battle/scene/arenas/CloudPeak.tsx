import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef } from 'react';
import {
  Color,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type InstancedMesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QualityContext } from '../../quality';
import { own } from '../dispose';
import { ArenaFog, KeyLight, SkyDome, direction, type SkyLook } from './common';
import { BOARD_UNDERSIDE, CLOUD_PEAK } from './layout';
import { cloudPuffs, columnsGeometry, daisGeometry } from './scenery';
import { puffTexture } from './textures';

/** The sun's bearing: right of the board and a little behind it, from the white player's seat. */
const SUN_AZIMUTH = -27;
const KEY = direction(SUN_AZIMUTH, 50).map((v) => v * 14) as [number, number, number];

/** A clear morning: pale haze over the cloud sea, deepening to blue, the dawn sun low. */
export const CLOUD_PEAK_SKY: SkyLook = {
  horizon: '#dbe9ef',
  zenith: '#5b9ad6',
  curve: 3,
  glow: { dir: direction(SUN_AZIMUTH, 7), color: '#ffdca6', power: 5, strength: 0.42 },
  disc: { dir: direction(SUN_AZIMUTH, 7), color: '#fff4dc', radius: 1.8, halo: 250 },
};

const PUFFS = { high: 140, low: 56 };

/**
 * The cloud sea: one instanced draw of soft puffs, each turned to face the camera and drawn
 * back to front, drifting slowly round the peak. The puffs are painted lit from above, so they
 * need no lighting of their own.
 */
function CloudSea() {
  const quality = useContext(QualityContext);
  const count = PUFFS[quality];
  const puffs = useMemo(
    () => cloudPuffs(count, 21, (SUN_AZIMUTH * Math.PI) / 180, CLOUD_PEAK.cloudTop),
    [count],
  );
  const geometry = useMemo(() => own(new PlaneGeometry(1, 1)), []);
  const material = useMemo(
    () => own(new MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false })),
    [],
  );
  // Scratch for the frame loop, so it allocates nothing.
  const work = useMemo(
    () => ({
      order: Uint16Array.from(puffs, (_, i) => i),
      dist: new Float32Array(puffs.length),
      matrix: new Matrix4(),
      at: new Vector3(),
      size: new Vector3(1, 1, 1),
      tint: new Color(),
    }),
    [puffs],
  );
  const mesh = useRef<InstancedMesh>(null);

  useFrame(({ camera, clock }) => {
    const m = mesh.current;
    if (!m) return;
    const { order, dist, matrix, at, size, tint } = work;
    // The angle comes from the clock, so a re-mounted sea is where it would have been.
    const turn = clock.elapsedTime * 0.006;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const eye = camera.position;
    for (let i = 0; i < puffs.length; i++) {
      const q = puffs[i];
      const dx = q.x * cos - q.z * sin - eye.x;
      const dy = q.y - eye.y;
      const dz = q.x * sin + q.z * cos - eye.z;
      dist[i] = dx * dx + dy * dy + dz * dz;
    }
    // Far to near for the blending. Insertion sort: the order hardly changes between frames.
    for (let k = 1; k < order.length; k++) {
      const i = order[k];
      let j = k - 1;
      while (j >= 0 && dist[order[j]] < dist[i]) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = i;
    }
    for (let k = 0; k < order.length; k++) {
      const q = puffs[order[k]];
      at.set(q.x * cos - q.z * sin, q.y, q.x * sin + q.z * cos);
      size.set(q.width, q.height, 1);
      m.setMatrixAt(k, matrix.compose(at, camera.quaternion, size));
      m.setColorAt(k, tint.setRGB(q.tint[0], q.tint[1], q.tint[2]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  // The puffs move every frame; culling by their first positions would drop them.
  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}

/** Jade Cloud Peak: a white-jade dais on a summit above a sea of clouds, in morning sun. */
export function CloudPeak() {
  const scenery = useMemo(() => {
    const c = CLOUD_PEAK;
    const rock = mergeGeometries([
      columnsGeometry([c.summit], c.summitStyle),
      columnsGeometry(c.pillars, c.pillarStyle),
    ]);
    const floor = new PlaneGeometry(640, 640);
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, c.cloudFloor, 0);
    return {
      // Under the puffs, a floor of cloud that the fog carries off to the horizon, so the sea
      // has no holes. A shade below the puffs' sunlit tops, so they stand out of it.
      floor: own(floor),
      floorMaterial: own(new MeshBasicMaterial({ color: '#d2e1e8' })),
      dais: own(
        daisGeometry(BOARD_UNDERSIDE, [
          [5, 0.3, '#e9efe7'],
          [5.7, 0.3, '#d2dcd3'],
        ]),
      ),
      rock: own(rock),
      far: own(columnsGeometry(c.far, c.farStyle)),
      daisMaterial: own(
        new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.04 }),
      ),
      rockMaterial: own(
        new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
      ),
      // Painted already hazed, so they keep their shape beyond the fog's reach.
      farMaterial: own(new MeshBasicMaterial({ vertexColors: true, fog: false })),
    };
  }, []);

  return (
    <>
      <SkyDome look={CLOUD_PEAK_SKY} />
      <ArenaFog color={CLOUD_PEAK_SKY.horizon} near={7} far={60} />
      <hemisphereLight args={['#d9ecff', '#eef2ec', 1.1]} />
      <KeyLight position={KEY} color="#ffe8c4" intensity={2.6} />
      <mesh geometry={scenery.dais} material={scenery.daisMaterial} receiveShadow />
      <mesh geometry={scenery.rock} material={scenery.rockMaterial} />
      <mesh geometry={scenery.far} material={scenery.farMaterial} />
      <mesh geometry={scenery.floor} material={scenery.floorMaterial} />
      <CloudSea />
    </>
  );
}

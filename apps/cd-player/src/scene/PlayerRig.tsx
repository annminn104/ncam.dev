import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import type { PlayerModel } from './model';
import { rigFor } from './rig';
import { useDiscPrints } from './textures/useDiscPrints';
import { useSceneTextures } from './textures/useSceneTextures';
import { useControls } from './useControls';
import { useDirector } from './useDirector';
import { useVu } from './useVu';

interface Props {
  model: PlayerModel;
  bridge: SceneBridge;
  onReady(): void;
}

/** Calls `onReady` once three frames of the player have been drawn. */
function useReadyProbe(onReady: () => void) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 3) return;
    frames.current += 1;
    if (frames.current === 3) onReady();
  });
}

export function PlayerRig({ model, bridge, onReady }: Props) {
  const rig = useMemo(() => rigFor(model), [model]);
  useSceneTextures(rig, bridge);
  const printer = useDiscPrints(rig, bridge);
  useDirector(rig, bridge, printer);
  useVu(model, bridge);
  const handlers = useControls(rig, bridge);
  useReadyProbe(onReady);
  return <primitive object={model.root} {...handlers} />;
}

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import type { Look } from '../looks';
import type { Personal } from '../personal';
import type { PlayerModel } from './model';
import { rigFor } from './rig';
import { useDiscPrints } from './textures/useDiscPrints';
import { lcdColour } from './textures/paint';
import { useDeckPattern } from './textures/useDeckPattern';
import { useSceneTextures } from './textures/useSceneTextures';
import { useControls } from './useControls';
import { useDirector } from './useDirector';
import { usePlayIcon } from './play-icon';
import { useVu } from './useVu';
import { vuColours } from './vu';

interface Props {
  model: PlayerModel;
  bridge: SceneBridge;
  look: Look;
  personal: Personal;
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

export function PlayerRig({ model, bridge, look, personal, onReady }: Props) {
  const rig = useMemo(() => rigFor(model), [model]);
  const vu = useMemo(() => vuColours(look), [look]);
  useSceneTextures(rig, bridge, lcdColour(look));
  useDeckPattern(rig, bridge, look, personal);
  const printer = useDiscPrints(rig, bridge);
  useDirector(rig, bridge, printer);
  useVu(model, bridge, vu);
  usePlayIcon(model, bridge);
  const handlers = useControls(rig, bridge);
  useReadyProbe(onReady);
  return <primitive object={model.root} {...handlers} />;
}

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { SceneBridge } from '../bridge';
import type { Look } from '../looks';
import type { Personal } from '../personal';
import type { CdModel, PlayerModel, VinylModel } from './model';
import { isCdRig, isTurntableRig, rigFor, type Rig } from './rig';
import { useCardPrint } from './textures/useCardPrint';
import { useDiscPrints } from './textures/useDiscPrints';
import { lcdColour } from './textures/paint';
import { useDeckPattern } from './textures/useDeckPattern';
import { useSceneTextures } from './textures/useSceneTextures';
import { useControls } from './useControls';
import { useDirector } from './useDirector';
import { useKnob } from './useKnob';
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
  useDeckPattern(rig, bridge, look, personal);
  const printer = useDiscPrints(rig, bridge);
  useDirector(rig, bridge, printer);
  usePlayIcon(model, bridge);
  useReadyProbe(onReady);
  if (isCdRig(rig)) return <CdPlayerParts rig={rig} bridge={bridge} look={look} />;
  if (isTurntableRig(rig)) return <TurntableParts rig={rig} bridge={bridge} />;
  return null;
}

/**
 * What only a CD player has: the plate's, the tag's and the display's prints, the VU strip and the
 * knob. It holds the model on the stage, with the keys' handlers and the knob's grip.
 */
function CdPlayerParts({
  rig,
  bridge,
  look,
}: {
  rig: Rig<CdModel>;
  bridge: SceneBridge;
  look: Look;
}) {
  const vu = useMemo(() => vuColours(look), [look]);
  useSceneTextures(rig, bridge, lcdColour(look));
  useVu(rig.model, bridge, vu);
  const knob = useKnob(rig, bridge);
  const handlers = useControls(rig, bridge, knob);
  return <primitive object={rig.model.root} {...handlers} />;
}

/** What only a turntable has: its plate's print. It holds the model on the stage, with the keys. */
function TurntableParts({ rig, bridge }: { rig: Rig<VinylModel>; bridge: SceneBridge }) {
  useCardPrint(rig, bridge);
  const handlers = useControls(rig, bridge, null);
  return <primitive object={rig.model.root} {...handlers} />;
}

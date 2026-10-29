import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PlayerModel } from './model';

interface Props {
  model: PlayerModel;
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

export function PlayerRig({ model, onReady }: Props) {
  useReadyProbe(onReady);
  return <primitive object={model.root} />;
}

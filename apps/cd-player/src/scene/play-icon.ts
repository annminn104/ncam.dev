import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Object3D } from 'three';
import type { SceneBridge } from '../bridge';
import type { Status } from '../playback/sequencer';
import type { PlayerModel } from './model';

export type PlayIcon = 'play' | 'pause';

/**
 * What a press of the play key will do: pause while a track plays (or a disc is being changed and
 * will play), play when paused or idle.
 */
export function playIconFor(status: Status): PlayIcon {
  return status === 'playing' || status === 'swapping' ? 'pause' : 'play';
}

/**
 * Shows the icon `status` calls for and hides the other, touching the nodes only when the answer
 * differs from `previous`. Returns the answer.
 */
export function syncPlayIcon(
  play: Object3D,
  pause: Object3D,
  previous: PlayIcon,
  status: Status,
): PlayIcon {
  const answer = playIconFor(status);
  if (answer !== previous) {
    play.visible = answer === 'play';
    pause.visible = answer === 'pause';
  }
  return answer;
}

/**
 * The play key's icon: ▶ (`icon_play`) before the scene has any status, while paused and while
 * idle; ‖ (`icon_pause`) while a track plays or a disc is changing.
 */
export function usePlayIcon(model: PlayerModel, bridge: SceneBridge): void {
  const { icon_play: play, icon_pause: pause } = model.nodes;
  const shown = useRef<PlayIcon>('play');
  useEffect(() => {
    play.visible = true;
    pause.visible = false;
    shown.current = 'play';
  }, [play, pause]);
  useFrame(() => {
    shown.current = syncPlayIcon(play, pause, shown.current, bridge.getView().status);
  });
}

import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { Status } from '../playback/sequencer';
import { playIconFor, syncPlayIcon } from './play-icon';

/** An icon node that counts the writes to `visible`. */
function probe(visible: boolean): { node: Object3D; writes: () => number } {
  const node = new Object3D();
  let writes = 0;
  let value = visible;
  Object.defineProperty(node, 'visible', {
    get: () => value,
    set: (next: boolean) => {
      writes += 1;
      value = next;
    },
  });
  return { node, writes: () => writes };
}

describe('playIconFor', () => {
  it('shows pause while a track plays or a disc is being changed', () => {
    expect(playIconFor('playing')).toBe('pause');
    expect(playIconFor('swapping')).toBe('pause');
  });

  it('shows play while paused or idle', () => {
    expect(playIconFor('paused')).toBe('play');
    expect(playIconFor('idle')).toBe('play');
  });
});

describe('syncPlayIcon', () => {
  it('shows exactly one icon and returns the answer', () => {
    const play = probe(true);
    const pause = probe(false);
    expect(syncPlayIcon(play.node, pause.node, 'play', 'playing')).toBe('pause');
    expect(play.node.visible).toBe(false);
    expect(pause.node.visible).toBe(true);
    expect(syncPlayIcon(play.node, pause.node, 'pause', 'paused')).toBe('play');
    expect(play.node.visible).toBe(true);
    expect(pause.node.visible).toBe(false);
  });

  it('touches the nodes only when the answer changes', () => {
    const play = probe(true);
    const pause = probe(false);
    const statuses: Status[] = ['idle', 'paused', 'playing', 'swapping', 'playing'];
    let answer: 'play' | 'pause' = 'play';
    for (const status of statuses) {
      answer = syncPlayIcon(play.node, pause.node, answer, status);
    }
    // idle and paused keep play; playing switches once; swapping and playing keep pause
    expect(play.writes()).toBe(1);
    expect(pause.writes()).toBe(1);
    expect(answer).toBe('pause');
  });
});

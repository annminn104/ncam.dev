import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { interaction, releaseLost } from './interaction';

/** What useControls hands a press on a control that is turned or dragged. */
export interface Grip {
  /** The control: a CD player's knob, or a turntable's tonearm head. */
  kind: 'knob' | 'arm';
  /** A press on it at (x, y), `pinches` pinches begun so far: a turn or a drag begins, if it takes one. */
  down(id: number, x: number, y: number, pinches: number): void;
}

/** What a turn or a drag hears once it has begun: the pointer's moves, its lift, a cancel, each frame. */
export interface GripEvents {
  /** `lost` says the pointer's release was lost (interaction.ts releaseLost). */
  move(id: number, x: number, y: number, pinches: number, lost: boolean): void;
  up(id: number, pinches: number): void;
  cancel(id: number): void;
  /** A turn or a drag the control no longer takes ends where it stands, with no pointer event. */
  frame(): void;
}

/**
 * Feeds `events` the window's pointer events, so a turn or a drag survives leaving its control's
 * mesh, and R3F's frames, so a change that begins mid-turn ends it before the next event.
 */
export function useGripEvents(events: GripEvents): void {
  useFrame(() => events.frame());
  useEffect(() => {
    // A mouse that moves with no button down has lost its release (a native menu took it, say).
    const move = (event: PointerEvent) =>
      events.move(
        event.pointerId,
        event.clientX,
        event.clientY,
        interaction.pinches,
        releaseLost(event),
      );
    const up = (event: PointerEvent) => events.up(event.pointerId, interaction.pinches);
    const cancel = (event: PointerEvent) => events.cancel(event.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [events]);
}

import { Box3, Matrix4 } from 'three';
import type { CutLevel } from '../scene/cutaway';

/** A press that travels further than this (CSS pixels) while the button is down is an orbit drag, not a click. */
export const CLICK_SLOP = 5;

/** What a click needs to know about the press before it: whether the pointer strayed. */
export interface DragWatch {
  press(x: number, y: number): void;
  /** Moves of the pointer; only those while the button is down count. */
  move(x: number, y: number): void;
  release(): void;
  /** The furthest the last press strayed from where it began was more than CLICK_SLOP, also after the release. */
  readonly dragged: boolean;
}

/**
 * Follows the pointer while a button is down. The distance between the press and the release is not enough: a drag that
 * ends where it began (the orbit turned the camera and turned it back) is no click. The click event follows the release,
 * so the verdict stays until the next press.
 */
export function createDragWatch(): DragWatch {
  let start: [number, number] | null = null;
  let travel = 0;
  return {
    press(x, y) {
      start = [x, y];
      travel = 0;
    },
    move(x, y) {
      if (start) travel = Math.max(travel, Math.hypot(x - start[0], y - start[1]));
    },
    release() {
      start = null;
    },
    get dragged() {
      return travel > CLICK_SLOP;
    },
  };
}

/** Whether what lies under a resting pointer may have changed since the last look. */
export interface HoverWatch {
  /**
   * Call once per frame with the camera's world matrix, the cut, the world box of the hovered item (null when none is)
   * and whether the item is shown: true when the camera moved, the cut changed or the item moved (a sliding door) since
   * the last call, and whenever the item is hidden (a click stopped the waterfall it names): it is no longer under the
   * pointer. The first look, and an item that has just been found or lost, count for nothing.
   */
  changed(camera: Matrix4, cut: CutLevel, item: Box3 | null, shown?: boolean): boolean;
}

export function createHoverWatch(): HoverWatch {
  const seenCamera = new Matrix4();
  const seenItem = new Box3();
  let seenCut: CutLevel | null = null;
  let hadItem = false;
  return {
    changed(camera, cut, item, shown = true) {
      const first = seenCut === null;
      const gone = item !== null && !shown;
      const moved =
        !first &&
        (gone ||
          !seenCamera.equals(camera) ||
          seenCut !== cut ||
          (item !== null && hadItem && !seenItem.equals(item)));
      seenCamera.copy(camera);
      seenCut = cut;
      hadItem = item !== null && shown; // a hidden item is lost: what the pointer finds next is a new one
      if (item) seenItem.copy(item);
      return moved;
    },
  };
}

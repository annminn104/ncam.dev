import { useAppStore } from '../state/store';
import { FLOOR_BUTTONS, isPressed } from './floors';

/**
 * Site route: the floor buttons at the bottom left (interaction spec §2). A button holds its level of the dollhouse cut
 * whatever the camera's distance (OrbitRig reads cutMode), "Auto" gives the cut back to the distance; each says
 * whether it is on with aria-pressed. Never on the wallpaper.
 */
export function FloorSelector() {
  const cutMode = useAppStore((s) => s.cutMode);
  const setCutMode = useAppStore((s) => s.setCutMode);
  return (
    <div className="floors" role="group" aria-label="Floors" data-testid="floor-selector">
      {FLOOR_BUTTONS.map(({ mode, label, title }) => (
        <button
          key={mode}
          type="button"
          className="floors__button"
          aria-pressed={isPressed(mode, cutMode)}
          title={title}
          data-mode={mode}
          onClick={() => setCutMode(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

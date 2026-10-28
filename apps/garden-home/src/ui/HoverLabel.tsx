import { groupKind } from '../interact/groups';
import { hintFor, isOn } from '../interact/toggles';
import { useAppStore } from '../state/store';

/** Room the label keeps from the window's right and bottom edges before it flips to the other side of the pointer. */
const EDGE = { x: 220, y: 64 };

/** Site route: the name of the house item under the pointer, and what a click will do (AGENTS.md, Controls). */
export function HoverLabel() {
  const hover = useAppStore((s) => s.hover);
  const state = useAppStore((s) => (s.hover ? s.toggles[s.hover.group] : undefined));
  const nightFactor = useAppStore((s) => s.nightFactor);
  if (!hover) return null;
  const kind = groupKind(hover.group);
  const flipX = hover.x > window.innerWidth - EDGE.x;
  const flipY = hover.y > window.innerHeight - EDGE.y;
  return (
    <div
      className="hover-label"
      data-testid="hover-label"
      style={{
        left: hover.x,
        top: hover.y,
        transform: `translate(${flipX ? 'calc(-100% - 12px)' : '14px'}, ${flipY ? 'calc(-100% - 10px)' : '18px'})`,
      }}
    >
      <span className="hover-label__name">{hover.label}</span>
      <span className="hover-label__hint">{hintFor(kind, isOn(kind, state, nightFactor))}</span>
    </div>
  );
}

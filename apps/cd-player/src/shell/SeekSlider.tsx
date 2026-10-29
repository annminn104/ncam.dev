import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import { formatDuration, seekRange } from '../view';

interface Props {
  positionMs: number;
  durationMs: number;
  /** Nothing is loaded, so there is nothing to seek in. */
  disabled: boolean;
  /** The visitor's pick, once per gesture: a drag when they let go, each press of an arrow key. */
  onSeek(ms: number): void;
}

/**
 * The knob's counterpart for a keyboard, a screen reader and a touch screen: a native range input,
 * so every way of moving it already works. It styles itself as the bar it replaced (`--cdp-ratio`
 * is how much of it is filled).
 */
export function SeekSlider({ positionMs, durationMs, disabled, onSeek }: Props) {
  const { max, value } = seekRange(positionMs, durationMs);
  const input = useRef<HTMLInputElement>(null);
  // Where the visitor has the thumb while a gesture lasts. The position keeps coming in meanwhile,
  // and must not pull the thumb from under their finger.
  const [held, setHeld] = useState<number | null>(null);
  const shown = disabled || held === null ? value : held;

  // React's onChange is the input event, one per step of a drag. The seek is the native `change`
  // event, which a browser fires once when the visitor lets go (or at each key press) and which
  // React does not hand out separately.
  const commit = useEffectEvent(() => {
    setHeld(null);
    if (input.current) onSeek(Number(input.current.value) * 1000);
  });
  useEffect(() => {
    const element = input.current;
    const onNativeChange = () => commit();
    element?.addEventListener('change', onNativeChange);
    return () => element?.removeEventListener('change', onNativeChange);
  }, []);

  // A gesture that ends without a `change` (a touch the browser took over and cancelled; an engine
  // may also skip it when the thumb is back where it began) seeks nothing, and must not leave the
  // thumb held. It lets go after the browser's own `change`, which comes in the same task as the
  // release, so this is a task later.
  const release = () => {
    setTimeout(() => setHeld(null), 0);
  };

  return (
    <input
      ref={input}
      type="range"
      className="cdp-now__seek"
      aria-label="Seek"
      aria-valuetext={`${formatDuration(shown * 1000)} of ${formatDuration(durationMs)}`}
      min={0}
      max={max}
      step={1}
      value={shown}
      disabled={disabled}
      style={{ '--cdp-ratio': max > 0 ? shown / max : 0 } as CSSProperties}
      onChange={(event) => setHeld(event.currentTarget.valueAsNumber)}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}

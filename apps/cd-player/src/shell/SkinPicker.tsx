import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { SKINS, skinById, type SkinId } from '../skins';
import { CheckIcon } from './Icons';

const MENU_ID = 'cdp-skin-menu';

const indexOf = (id: SkinId) => SKINS.findIndex((skin) => skin.id === id);

/**
 * Where a key moves the radio group from `current`: the arrows step through the four and wrap,
 * Home and End go to the first and the last; any other key is null.
 */
export function skinForKey(key: string, current: SkinId): SkinId | null {
  const index = indexOf(current);
  const last = SKINS.length - 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return SKINS[index >= last ? 0 : index + 1].id;
    case 'ArrowLeft':
    case 'ArrowUp':
      return SKINS[index <= 0 ? last : index - 1].id;
    case 'Home':
      return SKINS[0].id;
    case 'End':
      return SKINS[last].id;
    default:
      return null;
  }
}

interface MenuProps {
  skin: SkinId;
  open: boolean;
  onPick(id: SkinId): void;
  /** The options' elements in SKINS order, so focus can follow the arrows. */
  options?: RefObject<(HTMLButtonElement | null)[]>;
}

/**
 * The popover: the four colourways as a radio group. The checked one is the group's only tab
 * stop, and the arrows choose as they move, so the player recolours while the visitor looks.
 */
export function SkinMenu({ skin, open, onPick, options }: MenuProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = skinForKey(event.key, skin);
    if (!next) return;
    event.preventDefault();
    onPick(next);
    options?.current[indexOf(next)]?.focus();
  };
  return (
    <div
      id={MENU_ID}
      className="cdp-skin__menu"
      role="radiogroup"
      aria-label="Player colour"
      hidden={!open}
      onKeyDown={onKeyDown}
    >
      {SKINS.map((item, index) => {
        const checked = item.id === skin;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="cdp-skin__option"
            ref={(element) => {
              if (options) options.current[index] = element;
            }}
            onClick={() => onPick(item.id)}
          >
            <span
              className="cdp-skin__swatch"
              style={{ backgroundColor: item.palette.leather }}
              aria-hidden="true"
            />
            <span className="cdp-skin__name">{item.name}</span>
            {checked && <CheckIcon />}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  skin: SkinId;
  onChange(id: SkinId): void;
}

/**
 * Player, after Share: the current skin's swatch, and the popover that picks another. Escape
 * closes it and gives focus back to the button, as the button itself does; a click or a tap
 * outside, or Tab out of it, closes it too. Closed on the server and on the first client render.
 */
export function SkinPicker({ skin, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const current = skinById(skin);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    // Capture: the canvas's own handlers never keep a press from it.
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Shown first, so focus can land on the checked colourway.
    flushSync(() => setOpen(true));
    options.current[indexOf(skin)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    button.current?.focus();
    setOpen(false);
  };

  // Tab out closes it. A press that blurs to nothing (Safari's buttons take no focus on a click)
  // is the pointerdown's to judge.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && !event.currentTarget.contains(next)) setOpen(false);
  };

  return (
    <div className="cdp-skin" ref={root} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        className="cdp-button cdp-skin__button"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={toggle}
      >
        <span
          className="cdp-skin__swatch"
          style={{ backgroundColor: current.palette.leather }}
          aria-hidden="true"
        />
        <span className="cdp-skin__label">Player</span>
        <span className="cdp-sr">{` colour: ${current.name}`}</span>
      </button>
      <SkinMenu skin={skin} open={open} onPick={onChange} options={options} />
    </div>
  );
}

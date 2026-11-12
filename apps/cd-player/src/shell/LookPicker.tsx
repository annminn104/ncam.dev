import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  CLEAR_PARTS,
  CLEAR_SWATCHES,
  PART_NAMES,
  type BoardSwatch,
  type FrameSwatch,
  type LightSwatch,
  type ShellSwatch,
} from '../clear-looks';
import { DECK_PART_NAMES, DECK_PARTS, DECK_SWATCHES } from '../deck-looks';
import { lookLabel, lookOf, lookSwatch, type LookState } from '../looks';
import { MODELS, modelById, type ModelId } from '../models';
import { cleanName, NAME_FALLBACK, PATTERNS, type PatternId } from '../personal';
import type { ModelLoad } from '../scene-props';
import { SKINS, type SkinId } from '../skins';
import { CheckIcon } from './Icons';

const MENU_ID = 'cdp-skin-menu';

interface Option {
  id: string;
  name: string;
  /** A colour to show, or none (the Model row). */
  swatch?: string;
}

/** How a group is drawn: the models side by side, the skins as rows, a part's colours as dots. */
type Variant = 'models' | 'rows' | 'dots';

interface Group {
  label: string;
  variant: Variant;
  options: readonly Option[];
  value: string;
  pick(id: string): void;
}

/**
 * Where a key moves a radio group from `current`: the arrows step through it and wrap, Home and
 * End go to the first and the last; any other key is null.
 */
export function optionForKey(key: string, ids: readonly string[], current: string): string | null {
  const index = ids.indexOf(current);
  const last = ids.length - 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return ids[index >= last ? 0 : index + 1];
    case 'ArrowLeft':
    case 'ArrowUp':
      return ids[index <= 0 ? last : index - 1];
    case 'Home':
      return ids[0];
    case 'End':
      return ids[last];
    default:
      return null;
  }
}

/** What the menu reads of a key press: the key, and the modifiers held with it. */
export interface KeyPress {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * The option a key press in a group picks (`optionForKey`), or null for a press the menu leaves
 * to the page: any key held with Alt, Ctrl or Cmd is the browser's (Alt+Arrow is Back and
 * Forward). The menu keeps from the page exactly the presses this picks with.
 */
export function optionForPress(
  press: KeyPress,
  ids: readonly string[],
  current: string,
): string | null {
  if (press.altKey || press.ctrlKey || press.metaKey) return null;
  return optionForKey(press.key, ids, current);
}

/** The colour a Clear part's swatch shows: the shell's tint, the light's glow, else its colour. */
function swatchColour(swatch: ShellSwatch | FrameSwatch | BoardSwatch | LightSwatch): string {
  if ('tint' in swatch) return swatch.tint;
  if ('glow' in swatch) return swatch.glow;
  return swatch.colour;
}

/**
 * The menu's groups: the model, then the suitcase's skins, the Deck's parts and patterns or the
 * Clear model's.
 */
function groupsFor(look: LookState, onChange: (next: LookState) => void): Group[] {
  const model: Group = {
    label: 'Model',
    variant: 'models',
    options: MODELS.map((m) => ({ id: m.id, name: m.name })),
    value: look.model,
    pick: (id) => onChange({ ...look, model: id as ModelId }),
  };
  if (look.model === 'suitcase') {
    return [
      model,
      {
        label: 'Player colour',
        variant: 'rows',
        options: SKINS.map((s) => ({ id: s.id, name: s.name, swatch: s.palette.leather })),
        value: look.skin,
        pick: (id) => onChange({ ...look, skin: id as SkinId }),
      },
    ];
  }
  if (look.model === 'deck') {
    return [
      model,
      ...DECK_PARTS.map((part) => ({
        label: DECK_PART_NAMES[part],
        variant: 'dots' as const,
        options: DECK_SWATCHES[part].map((s) => ({
          id: s.id,
          name: s.name,
          swatch: swatchColour(s),
        })),
        value: look.deck[part],
        pick: (id: string) => onChange({ ...look, deck: { ...look.deck, [part]: id } }),
      })),
      {
        label: 'Pattern',
        variant: 'rows' as const,
        options: PATTERNS.map((pattern) => ({ id: pattern.id, name: pattern.name })),
        value: look.personal.pattern,
        pick: (id: string) =>
          onChange({ ...look, personal: { ...look.personal, pattern: id as PatternId } }),
      },
    ];
  }
  return [
    model,
    ...CLEAR_PARTS.map((part) => ({
      label: PART_NAMES[part],
      variant: 'dots' as const,
      options: CLEAR_SWATCHES[part].map((s) => ({
        id: s.id,
        name: s.name,
        swatch: swatchColour(s),
      })),
      value: look.clear[part],
      pick: (id: string) => onChange({ ...look, clear: { ...look.clear, [part]: id } }),
    })),
  ];
}

/**
 * Whether the tick on a swatch of `hex` (#rrggbb) is white or the ink: white on the dark ones, where
 * the ink would vanish. The switch is the luminance at which white and black have the same contrast
 * (0.179).
 */
export function tickOn(hex: string): 'light' | 'dark' {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.179 ? 'light' : 'dark';
}

/** What the menu says while a model downloads, or after it failed; null otherwise. */
export function loadLine(load: ModelLoad | null): string | null {
  if (!load || load.status === 'ready') return null;
  if (load.status === 'failed') return `Couldn't load ${modelById(load.model).name}`;
  return load.fraction === null ? 'Loading…' : `Loading ${Math.round(load.fraction * 100)}%`;
}

/**
 * One radio group. The checked option is its only tab stop, and the arrows choose as they move, so
 * the player changes while the visitor looks. `dots` draws the options as colour dots named by
 * `aria-label` (a Clear part's colours); otherwise they are rows of a name and, if it has one, a
 * swatch.
 */
function RadioGroup({ group }: { group: Group }) {
  const dots = group.variant === 'dots';
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const ids = group.options.map((option) => option.id);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = optionForPress(event, ids, group.value);
    if (!next) return;
    event.preventDefault();
    group.pick(next);
    refs.current[ids.indexOf(next)]?.focus();
  };
  const checkedName = group.options.find((option) => option.id === group.value)?.name ?? '';
  return (
    <div className="cdp-skin__group">
      <p className="cdp-skin__legend" aria-hidden="true">
        <span>{group.label}</span>
        {dots && <span>{checkedName}</span>}
      </p>
      <div
        role="radiogroup"
        aria-label={group.label}
        className={
          dots ? 'cdp-skin__swatches' : group.variant === 'models' ? 'cdp-skin__models' : undefined
        }
        onKeyDown={onKeyDown}
      >
        {group.options.map((option, index) => {
          const checked = option.id === group.value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              aria-label={dots ? option.name : undefined}
              className={
                dots
                  ? `cdp-skin__dot${option.swatch && tickOn(option.swatch) === 'light' ? ' cdp-skin__dot--dark' : ''}`
                  : 'cdp-skin__option'
              }
              style={dots ? { backgroundColor: option.swatch } : undefined}
              ref={(element) => {
                refs.current[index] = element;
              }}
              onClick={() => group.pick(option.id)}
            >
              {!dots && option.swatch && (
                <span
                  className="cdp-skin__swatch"
                  style={{ backgroundColor: option.swatch }}
                  aria-hidden="true"
                />
              )}
              {!dots && <span className="cdp-skin__name">{option.name}</span>}
              {checked && <CheckIcon />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The Deck's engraving: the visitor's name, cleaned as it is typed (src/personal.ts cleanName) and
 * kept in this browser only. Empty, the Deck prints the placeholder's "ncam".
 */
function NameField({ value, onChange }: { value: string; onChange(name: string): void }) {
  return (
    <label className="cdp-skin__group cdp-skin__field">
      <span className="cdp-skin__legend">Your name</span>
      <input
        className="cdp-skin__input"
        type="text"
        value={value}
        placeholder={NAME_FALLBACK}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(event) => onChange(cleanName(event.target.value))}
      />
    </label>
  );
}

interface MenuProps {
  look: LookState;
  open: boolean;
  onChange(next: LookState): void;
  /** The model change in progress, as the scene reports it. */
  load: ModelLoad | null;
}

/**
 * The popover: the model, then its colours (the Deck's pattern and name too), each group a radio
 * group whose arrows choose as they move.
 * A key held with Alt, Ctrl or Cmd is the browser's, never a choice (`optionForPress`). Its status
 * line says what `load` says: the caller hands it the load of the model the visitor last chose.
 */
export function LookMenu({ look, open, onChange, load }: MenuProps) {
  const line = loadLine(load);
  return (
    <div id={MENU_ID} className="cdp-skin__menu" hidden={!open}>
      {groupsFor(look, onChange).map((group) => (
        <RadioGroup key={group.label} group={group} />
      ))}
      {look.model === 'deck' && (
        <NameField
          value={look.personal.name}
          onChange={(name) => onChange({ ...look, personal: { ...look.personal, name } })}
        />
      )}
      {/* Always rendered: a live region added with its text is not announced, so a line set while
          the popover is open is. (A closed popover is `hidden`: nothing says a line then.) */}
      <p className="cdp-skin__load" role="status">
        {line}
      </p>
    </div>
  );
}

interface Props {
  look: LookState;
  onChange(next: LookState): void;
  load: ModelLoad | null;
}

/**
 * Player, after Share: the look's swatch, and the popover that picks another model or colour.
 * Escape closes it and gives focus back to the button, as the button itself does; a click or a tap
 * outside, or Tab out of it, closes it too. Closed on the server and on the first client render.
 */
export function LookPicker({ look, onChange, load }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = lookOf(look);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    // Capture: the canvas's own handlers never keep a press from it.
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  // A model change that fails sends the look back, and the groups of the model the focus was in
  // unmount under it: focus falls to <body> and Escape no longer reaches this root. Put it back
  // on the checked model.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active && active !== document.body && root.current?.contains(active)) return;
    root.current
      ?.querySelector<HTMLButtonElement>(`#${MENU_ID} [role="radio"][aria-checked="true"]`)
      ?.focus({ preventScroll: true });
  }, [open, look.model]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Shown first, so focus can land on the checked model. Brought into view too: on a short
    // screen (a sideways phone) it runs past the foot, and a press outside to scroll would close
    // it. Focus then scrolls nothing a second time.
    flushSync(() => setOpen(true));
    document.getElementById(MENU_ID)?.scrollIntoView({ block: 'nearest' });
    root.current
      ?.querySelector<HTMLButtonElement>(`#${MENU_ID} [role="radio"][aria-checked="true"]`)
      ?.focus({ preventScroll: true });
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
          style={{ backgroundColor: lookSwatch(current) }}
          aria-hidden="true"
        />
        <span className="cdp-skin__label">Player</span>
        <span className="cdp-sr">{lookLabel(current).slice('Player'.length)}</span>
      </button>
      <LookMenu look={look} open={open} onChange={onChange} load={load} />
    </div>
  );
}

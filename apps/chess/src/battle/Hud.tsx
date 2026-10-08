import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Side } from '../game/coords';
import { describeStatus, isOver } from '../game/status';
import { SECTS, TREASURES } from '../game/treasures';
import type { GameSettings } from '../settings';
import { NO_OFFER, offerIn, positionKey, type DrawOffer } from './draw-offer';
import { undoPlies } from './undo';
import type { GameApi } from './useGame';

const SIDES: Side[] = ['w', 'b'];

/**
 * The battle's overlay: whose move it is, the view and game controls, the treasures each sect
 * has lost and the move list. It renders the parts of the `.chess-hud` grid that Battle lays
 * over the canvas. `children` (the keyboard board) goes between the top bar and the game
 * controls, which is where Tab reaches it. `thinking` is the AI's turn (Task 9): it turns Undo
 * off and says so.
 */
export function Hud(props: {
  game: GameApi;
  settings: GameSettings;
  humanSide: Side;
  thinking: boolean;
  autoRotate: boolean;
  onToggleRotate(): void;
  onResetView(): void;
  onExit(): void;
  onRematch(): void;
  children?: ReactNode;
}) {
  const { game, settings, humanSide, thinking, autoRotate } = props;
  const { onToggleRotate, onResetView, onExit, onRematch, children } = props;
  const { snap, plyCount } = game;
  const hotseat = settings.mode === 'hotseat';
  const over = isOver(snap.status);
  const plies = undoPlies({
    hotseat,
    humanSide,
    turn: snap.turn,
    status: snap.status,
    plyCount,
    thinking,
  });
  const resigner: Side = hotseat ? snap.turn : humanSide;

  // An offer stands for the position it was made in. Every position change is shown to
  // offerIn() as this component renders it (adjusting state while rendering, React's pattern
  // for state that follows a prop), so the first move, undo or verdict withdraws it for good.
  const position = positionKey(plyCount, snap.status);
  const [stored, setOffer] = useState<DrawOffer>(NO_OFFER);
  const offer = offerIn(stored, position);
  if (offer !== stored) setOffer(offer);
  const offerBy = hotseat && !over ? offer.by : null;
  const offerButton = useRef<HTMLButtonElement>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const offerTextId = useId();

  // Keep the latest move in sight once the list scrolls.
  const list = useRef<HTMLOListElement>(null);
  const plyTotal = snap.sanHistory.length;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [plyTotal]);

  const rows: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < plyTotal; i += 2) {
    rows.push({ n: i / 2 + 1, w: snap.sanHistory[i], b: snap.sanHistory[i + 1] });
  }

  let turnText = over
    ? describeStatus(snap.status)
    : thinking
      ? 'The elder meditates…'
      : `${SECTS[snap.turn]} to move`;
  if (snap.checkSquare && !over) turnText += ' — check!';

  return (
    <>
      <div className="chess-hud__top chess-hud__bar">
        <div
          className={`chess-panel chess-turn chess-turn--${over ? 'over' : snap.turn}`}
          aria-live="polite"
          data-thinking={thinking || undefined}
        >
          {turnText}
        </div>
        <div className="chess-dock" role="group" aria-label="View">
          <button type="button" className="chess-btn" onClick={onResetView}>
            Reset view
          </button>
          {hotseat && (
            <button
              type="button"
              className="chess-btn chess-btn--toggle"
              aria-pressed={autoRotate}
              onClick={onToggleRotate}
            >
              Turn to mover
            </button>
          )}
          <button type="button" className="chess-btn" onClick={onExit}>
            Lobby
          </button>
        </div>
      </div>

      {children}

      <aside className="chess-hud__side chess-panel" aria-label="Moves and captures">
        <h2 className="chess-label">Treasures lost</h2>
        {SIDES.map((side) => {
          const lost = snap.captured[side];
          return (
            <p key={side} className="chess-lost">
              <span className="chess-lost__sect">{SECTS[side]}</span>{' '}
              {lost.length === 0 ? (
                <span className="chess-lost__none">none</span>
              ) : (
                <>
                  {/* The glyphs are for the eye; a screen reader hears the treasures' names. */}
                  <span
                    className={`chess-lost__glyphs chess-lost__glyphs--${side}`}
                    aria-hidden="true"
                  >
                    {lost.map((t) => TREASURES[t].glyph).join(' ')}
                  </span>
                  <span className="chess-sr">{lost.map((t) => TREASURES[t].name).join(', ')}</span>
                </>
              )}
            </p>
          );
        })}
        <h2 className="chess-label">Moves</h2>
        {rows.length === 0 ? (
          <p className="chess-moves__empty">No moves yet</p>
        ) : (
          // role="list": Safari drops the list role from an unstyled list.
          <ol className="chess-moves" ref={list} role="list">
            {rows.map((r) => (
              <li key={r.n}>
                <span className="chess-moves__n">{r.n}.</span> <span>{r.w}</span>{' '}
                <span>{r.b ?? ''}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <div className="chess-hud__bottom chess-hud__bar">
        {offerBy && (
          <div className="chess-dock chess-offer" role="group" aria-labelledby={offerTextId}>
            <span id={offerTextId} className="chess-offer__text">
              {SECTS[offerBy === 'w' ? 'b' : 'w']}, accept a draw?
            </span>
            <button
              ref={acceptButton}
              type="button"
              className="chess-btn"
              onClick={() => {
                setOffer({ by: null, position });
                game.agreeDraw();
              }}
            >
              Accept
            </button>
            <button
              type="button"
              className="chess-btn"
              onClick={() => {
                // The offer button comes back: hand it the focus this button is about to lose.
                flushSync(() => setOffer({ by: null, position }));
                offerButton.current?.focus();
              }}
            >
              Decline
            </button>
          </div>
        )}
        <div className="chess-dock" role="group" aria-label="Game">
          <button
            type="button"
            className="chess-btn"
            disabled={plies === null}
            onClick={() => {
              if (plies !== null) game.undo(plies);
            }}
          >
            Undo
          </button>
          {!over && (
            <button type="button" className="chess-btn" onClick={() => game.resign(resigner)}>
              Resign
            </button>
          )}
          {hotseat && !over && !offerBy && (
            <button
              ref={offerButton}
              type="button"
              className="chess-btn"
              onClick={() => {
                // The other player answers next: their Accept takes the focus of this button,
                // which the offer replaces.
                flushSync(() => setOffer({ by: snap.turn, position }));
                acceptButton.current?.focus();
              }}
            >
              Offer draw
            </button>
          )}
          {/* Reviewing a finished battle ("View the board"): the result's Rematch stays at hand,
              as the lobby does in the top bar. */}
          {over && (
            <button type="button" className="chess-btn chess-btn--primary" onClick={onRematch}>
              Rematch
            </button>
          )}
        </div>
      </div>
    </>
  );
}

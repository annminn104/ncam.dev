import { useCallback, useEffect, useState } from 'react';
import { createLogger } from '@ncam/logger';
import type { Side } from '../game/coords';
import { isOver } from '../game/status';
import { createEngine, EngineError, type Engine } from '../engine/engine';
import { lazyWorker } from '../engine/lazy-worker';
import { levelOf, type LevelId } from '../engine/levels';
import { spawnStockfish } from '../engine/spawn';
import type { GameApi } from './useGame';

const log = createLogger({ scope: 'chess' });

const DISTURBED = 'The elder’s meditation was disturbed — Stockfish did not answer.';

const isDisposed = (e: unknown) => e instanceof EngineError && e.reason === 'disposed';

export interface AiState {
  /** The AI is to move and on it: Stockfish is still loading, or searching. */
  thinking: boolean;
  /** Why the AI can't move, for the toast. Null while all is well. */
  error: string | null;
  /** Ask the AI again after an error. */
  retry(): void;
}

/**
 * The Stockfish opponent. It plays `aiSide`'s moves through `game.play`, the player's own path,
 * and locks the board meanwhile. There is one engine per battle while `enabled`, warmed up as the
 * battle opens so the ~7 MB download overlaps the player's first move.
 */
export function useAiOpponent(opts: {
  enabled: boolean;
  aiSide: Side;
  level: LevelId;
  game: GameApi;
  assetBase: string;
}): AiState {
  const { enabled, aiSide, level, game, assetBase } = opts;
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const next = createEngine(() => lazyWorker((signal) => spawnStockfish(assetBase, { signal })));
    setEngine(next);
    // A tick later: StrictMode's dev-only second mount disposes this engine at once, before it
    // has fetched anything.
    const warm = setTimeout(() => {
      next.warmUp().catch((e: unknown) => {
        // Not shown: the AI's move asks again (and retries once) before the toast does.
        if (!isDisposed(e)) log.warn('stockfish warm-up failed', { error: String(e) });
      });
    }, 0);
    return () => {
      clearTimeout(warm);
      next.dispose();
      setEngine(null);
    };
  }, [enabled, assetBase]);

  const { play, setLocked } = game;
  const { fen, turn, status } = game.snap;
  // A finished game re-arms it too: undoing a resignation made on the AI's turn hands it the move.
  const aiToMove = enabled && !isOver(status) && turn === aiSide;

  useEffect(() => {
    if (!engine || !aiToMove || error) return;
    let cancelled = false;
    setLocked(true);
    const lvl = levelOf(level);
    void (async () => {
      try {
        // An illegal move (or none) is logged, discarded and asked for again, once.
        for (let ask = 0; ask < 2; ask++) {
          const move = await engine.bestMove(fen, lvl);
          if (cancelled) return;
          if (move && play(move)) return;
          log.warn('stockfish proposed no legal move', { fen, move });
        }
        setError(DISTURBED);
      } catch (e) {
        if (cancelled || isDisposed(e)) return;
        log.error('stockfish did not answer', { fen, error: String(e) });
        setError(DISTURBED);
      } finally {
        if (!cancelled) setLocked(false);
      }
    })();
    // A new position, a verdict or a switch to hot-seat drops the search's answer.
    return () => {
      cancelled = true;
      setLocked(false);
    };
  }, [engine, aiToMove, fen, level, error, play, setLocked]);

  const retry = useCallback(() => setError(null), []);
  return { thinking: aiToMove && !error, error: enabled ? error : null, retry };
}

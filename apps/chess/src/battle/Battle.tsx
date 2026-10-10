import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { createLogger } from '@ncam/logger';
import type { Square } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import type { Side } from '../game/coords';
import { isOver } from '../game/status';
import type { GameSettings } from '../settings';
import { BoardA11y } from './BoardA11y';
import { EngineToast } from './EngineToast';
import { Hud } from './Hud';
import { JUMP_MS, movedKnights, squaresById } from './jumps';
import { PromotionDialog } from './PromotionDialog';
import { QualityContext, type Quality } from './quality';
import { ResultOverlay } from './ResultOverlay';
import { ARENA_DEFS } from './scene/arenas';
import { CameraRig, type CameraRigHandle } from './scene/CameraRig';
import { CaptureCamera } from './scene/CaptureCamera';
import { disposeOwned } from './scene/dispose';
import { releaseSharedLut } from './scene/materials';
import { Treasure } from './scene/pieces';
import { Scene } from './scene/Scene';
import { useAiOpponent } from './useAiOpponent';
import { useGame } from './useGame';
import { WebglFallback, hasWebgl } from './WebglFallback';
import css from './battle.css?inline';

const NO_JUMPS: ReadonlySet<string> = new Set();
const log = createLogger({ scope: 'chess' });

/** Capture mode: tells scripts/capture-arenas.mjs the scene has drawn (30 frames in). */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 30)
      (window as unknown as { __chessReady?: boolean }).__chessReady = true;
  });
  return null;
}

export interface BattleProps {
  settings: GameSettings;
  assetBase: string;
  onExit(): void;
  onRematch(): void;
  /**
   * Capture mode (scripts/capture-arenas.mjs): no HUD or engine, the arena's preview camera in
   * place of the rig, no quality decline, and `window.__chessReady` once the scene has drawn.
   */
  capture?: boolean;
}

export default function Battle({ settings, assetBase, onExit, onRematch, capture }: BattleProps) {
  // A state initialiser, not useMemo: the random pick must hold for the whole battle.
  const [humanSide] = useState<Side>(() => {
    if (settings.mode === 'hotseat') return 'w';
    if (settings.playerSide === 'random') return Math.random() < 0.5 ? 'w' : 'b';
    return settings.playerSide;
  });
  // This battle's own mode. It starts as the lobby's; if Stockfish fails, the toast can turn the
  // battle into hot-seat and keep the position (a remount would lose it).
  const [mode, setMode] = useState(settings.mode);
  const hotseat = mode === 'hotseat';
  const canMove = (turn: Side) => hotseat || turn === humanSide;
  const game = useGame(canMove);
  const rig = useRef<CameraRigHandle>(null);
  const [quality, setQuality] = useState<Quality>('high');
  const [webgl] = useState(hasWebgl);
  const [lost, setLost] = useState(false);
  const arena = ARENA_DEFS[settings.arenaId];
  const ArenaEnvironment = arena.Environment;

  useEffect(
    () => () => {
      try {
        disposeOwned();
      } catch (e) {
        // Everything else was freed all the same. A rematch or the way back to the lobby must
        // not end on the error screen over a resource that would not let go.
        log.warn('battle cleanup failed', { error: String(e) });
      }
    },
    [],
  );

  // The render loop rests while the tab is hidden: nothing to draw, no GPU or battery to spend.
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // No engine (and no download) for a battle that can't be played: no WebGL, or a lost context.
  const ai = useAiOpponent({
    enabled: mode === 'ai' && !capture && webgl && !lost,
    aiSide: humanSide === 'w' ? 'b' : 'w',
    level: settings.level,
    game,
    assetBase,
  });
  const thinking = ai.thinking;
  // The lobby's setting is where each battle starts; the HUD toggles it for this battle only.
  const [autoRotate, setAutoRotate] = useState(settings.autoRotate);
  // "View the board" sets the verdict aside until play resumes (an undo).
  const [reviewing, setReviewing] = useState(false);
  // The keyboard board's focused square, drawn in 3D as the gold cursor.
  const [cursor, setCursor] = useState<Square | null>(null);
  // The end of the board the camera looks from: the keyboard board's arrows follow the screen.
  const [viewSide, setViewSide] = useState<Side>(humanSide);
  const { turn, status } = game.snap;
  const over = isOver(status);

  // Hot-seat: face whoever moves next.
  useEffect(() => {
    if (hotseat && autoRotate && !over) rig.current?.faceSide(turn);
  }, [hotseat, autoRotate, over, turn]);
  // Mate: a slow push-in.
  useEffect(() => {
    if (status.kind === 'checkmate') rig.current?.pushIn();
  }, [status.kind]);
  useEffect(() => {
    if (!over) setReviewing(false);
  }, [over]);

  const showResult = over && !reviewing;
  const modal = game.pendingPromotion !== null || showResult;

  // A knight's bell rings while it jumps. Each position is compared with the one before it,
  // so a reply landing within JUMP_MS (the AI's can) ends the ringing instead of leaving it on.
  const [jumping, setJumping] = useState(NO_JUMPS);
  const squares = useRef<Map<string, Square> | null>(null);
  const { pieces } = game.snap;
  useEffect(() => {
    const before = squares.current;
    squares.current = squaresById(pieces);
    const moved = before ? movedKnights(before, pieces) : [];
    if (moved.length === 0) return;
    setJumping(new Set(moved));
    const t = setTimeout(() => setJumping(NO_JUMPS), JUMP_MS);
    return () => {
      clearTimeout(t);
      setJumping(NO_JUMPS);
    };
  }, [pieces]);

  // A lost context unmounts the Canvas; the fallback leads back to the lobby,
  // and entering a battle again mounts a fresh one.
  if (!webgl || lost) return <WebglFallback onExit={onExit} />;

  return (
    <QualityContext.Provider value={quality}>
      <style>{css}</style>
      {/* The arena's colour behind the canvas: no dark flash while the first frame compiles. */}
      <div className="chess-battle" style={{ background: arena.background }}>
        <Canvas
          // 'percentage' is PCFShadowMap, which is what three falls back to (with a console
          // warning) for the default 'soft'.
          shadows="percentage"
          dpr={quality === 'high' ? [1, 2] : 1}
          frameloop={visible ? 'always' : 'never'}
          camera={{ fov: 40, position: [0, 8, 11] }}
          onCreated={({ gl }) => {
            // Also how every battle ends: R3F loses the context once it has let the renderer go,
            // and three's shared lookup texture must not keep that renderer (materials.ts).
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setLost(true);
              releaseSharedLut();
            });
          }}
        >
          <color attach="background" args={[arena.background]} />
          {/* A preview shows the arena at its best, whatever GPU (or software one) draws it. */}
          {!capture && <PerformanceMonitor onDecline={() => setQuality('low')} />}
          <ArenaEnvironment />
          {capture ? (
            <CaptureCamera view={arena.capture} />
          ) : (
            <CameraRig ref={rig} initialSide={humanSide} onViewSide={setViewSide} />
          )}
          {capture && <ReadySignal />}
          <Scene
            game={game}
            skin={arena.skin}
            cursor={cursor}
            renderPiece={(p) => <Treasure piece={p} jumping={jumping.has(p.id)} />}
          />
        </Canvas>
        {!capture && (
          <>
            {/* While a modal is open the HUD and the keyboard board are inert: Tab stays in it. */}
            <div className="chess-hud" inert={modal}>
              <Hud
                game={game}
                settings={{ ...settings, mode }}
                humanSide={humanSide}
                thinking={thinking}
                autoRotate={autoRotate}
                onToggleRotate={() => setAutoRotate((v) => !v)}
                // Home is the player's end vs the AI. Hot-seat: the mover's end while the camera
                // follows the mover, otherwise the end it is at now.
                onResetView={() =>
                  rig.current?.reset(!hotseat ? humanSide : autoRotate && !over ? turn : viewSide)
                }
                onExit={onExit}
                onRematch={onRematch}
              >
                <BoardA11y game={game} viewSide={viewSide} onCursor={setCursor} />
              </Hud>
              {/* Only the AI's turn can fail; once the battle is over there is nothing to ask. */}
              {ai.error && !over && (
                <EngineToast
                  message={ai.error}
                  onRetry={ai.retry}
                  onHotseat={() => setMode('hotseat')}
                />
              )}
            </div>
            {game.pendingPromotion && (
              <PromotionDialog side={turn} onChoose={game.choosePromotion} />
            )}
            {showResult && (
              <ResultOverlay
                status={status}
                onRematch={onRematch}
                onExit={onExit}
                onReview={() => setReviewing(true)}
              />
            )}
          </>
        )}
      </div>
    </QualityContext.Provider>
  );
}

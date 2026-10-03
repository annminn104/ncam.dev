import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import type { Square } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import type { Side } from '../game/coords';
import type { GameSettings } from '../settings';
import { JUMP_MS, movedKnights, squaresById } from './jumps';
import { QualityContext, type Quality } from './quality';
import { CameraRig, type CameraRigHandle } from './scene/CameraRig';
import { disposeOwned } from './scene/dispose';
import { Treasure } from './scene/pieces';
import { Scene } from './scene/Scene';
import { useGame } from './useGame';
import { WebglFallback, hasWebgl } from './WebglFallback';
import css from './battle.css?inline';

const NO_JUMPS: ReadonlySet<string> = new Set();

export interface BattleProps {
  settings: GameSettings;
  assetBase: string;
  onExit(): void;
  onRematch(): void;
  /** Capture mode (scripts/capture-arenas.mjs): no HUD, fixed camera, signals readiness. */
  capture?: boolean;
}

export default function Battle({ settings, onExit, capture }: BattleProps) {
  // A state initialiser, not useMemo: the random pick must hold for the whole battle.
  const [humanSide] = useState<Side>(() => {
    if (settings.mode === 'hotseat') return 'w';
    if (settings.playerSide === 'random') return Math.random() < 0.5 ? 'w' : 'b';
    return settings.playerSide;
  });
  const canMove = (turn: Side) => settings.mode === 'hotseat' || turn === humanSide;
  const game = useGame(canMove);
  const rig = useRef<CameraRigHandle>(null);
  const [quality, setQuality] = useState<Quality>('high');
  const [webgl] = useState(hasWebgl);
  const [lost, setLost] = useState(false);

  useEffect(() => () => disposeOwned(), []);

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
      <div className="chess-battle">
        <Canvas
          // 'percentage' is PCFShadowMap, which is what three falls back to (with a console
          // warning) for the default 'soft'.
          shadows="percentage"
          dpr={quality === 'high' ? [1, 2] : 1}
          camera={{ fov: 40, position: [0, 8, 11] }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setLost(true);
            });
          }}
        >
          <PerformanceMonitor onDecline={() => setQuality('low')} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 10, 5]} intensity={1.4} castShadow />
          <CameraRig ref={rig} initialSide={humanSide} />
          <Scene
            game={game}
            cursor={null}
            renderPiece={(p) => <Treasure piece={p} jumping={jumping.has(p.id)} />}
          />
        </Canvas>
        {!capture && (
          <div className="chess-hud-temp">
            <button type="button" onClick={onExit}>
              Lobby
            </button>
            <button type="button" onClick={() => rig.current?.reset()}>
              Reset view
            </button>
            <span>{game.snap.turn === 'w' ? 'Righteous' : 'Demonic'} to move</span>
          </div>
        )}
      </div>
    </QualityContext.Provider>
  );
}

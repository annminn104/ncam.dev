import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, useLayoutEffect, useState } from 'react';
import { AgXToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { assetUrl } from '../lib/asset-url';
import type { PlayerSceneProps } from '../scene-props';
import { skinById } from '../skins';
import { CameraRig } from './CameraRig';
import { FOV, isWide } from './framing';
import { skinColours } from './materials';
import { loadPlayerModel, type PlayerModel } from './model';
import { PlayerRig } from './PlayerRig';

/** A studio: a PMREM'd RoomEnvironment for reflections, a soft key that casts, a warm rim. */
function Studio({ narrow }: { narrow: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    // The target, not only its texture: disposing it frees the texture and the framebuffer with it.
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.85;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  const map = narrow ? 1024 : 2048;
  return (
    <>
      <directionalLight
        position={[-0.9, 1.3, 0.95]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-camera-left={-0.45}
        shadow-camera-right={0.45}
        shadow-camera-top={0.45}
        shadow-camera-bottom={-0.45}
        shadow-camera-near={0.2}
        shadow-camera-far={4}
        shadow-bias={-0.0003}
        shadow-normalBias={0.003}
      />
      <directionalLight position={[0.8, 0.9, -0.9]} intensity={0.9} color="#ffeef1" />
      <hemisphereLight args={['#fff6f2', '#3a2a30', 0.35]} />
    </>
  );
}

/** Only the player's contact shadow: the page's backdrop shows through the transparent canvas. */
function ShadowFloor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.003} receiveShadow>
      <planeGeometry args={[3, 3]} />
      <shadowMaterial transparent opacity={0.22} />
    </mesh>
  );
}

export function PlayerScene(props: PlayerSceneProps) {
  const { assetBase, bridge, skin, onReady, onFail, onProgress } = props;
  const [model, setModel] = useState<PlayerModel | null>(null);
  const [narrow] = useState(() => !isWide(window.innerWidth));
  // A skin names its model. The four share one GLB, so a change recolours it in place (below);
  // a skin with another model would load that one instead, through the effect that follows.
  const modelPath = skinById(skin).model;
  // Read when the download reports, so a new callback never starts the download again.
  const report = useEffectEvent((fraction: number | null) => onProgress(fraction));
  useEffect(() => {
    let cancelled = false;
    let loaded: PlayerModel | null = null;
    loadPlayerModel(assetUrl(modelPath, assetBase), (fraction) => {
      // A load this effect has let go of (StrictMode's first run, a remount) says nothing.
      if (!cancelled) report(fraction);
    }).then(
      (next) => {
        loaded = next;
        if (cancelled) next.dispose();
        else setModel(next);
      },
      (error: unknown) => {
        if (!cancelled) onFail(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => {
      cancelled = true;
      // The model goes with its path: a disposed one is never drawn.
      setModel(null);
      loaded?.dispose();
    };
  }, [assetBase, modelPath, onFail]);

  // The skin, in place: before the model's first frame (a layout effect runs before any frame the
  // canvas draws) and on every change.
  useLayoutEffect(() => {
    model?.applySkin(skinById(skin));
  }, [model, skin]);

  // Dev builds only (production builds drop the branch): the live check reads the recoloured
  // materials here.
  useEffect(() => {
    if (!import.meta.env.DEV || !model) return;
    const probe = window as Window & { __cdpSkinColours?: () => Record<string, string> };
    probe.__cdpSkinColours = () => skinColours(model.root);
    return () => {
      delete probe.__cdpSkinColours;
    };
  }, [model]);

  return (
    <Canvas
      className="cdp-canvas"
      dpr={[1, narrow ? 1.5 : 2]}
      // Not the boolean: R3F maps that to PCFSoftShadowMap, which three 0.186 warns about and
      // replaces with this one.
      shadows="percentage"
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 0.02, far: 10 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = AgXToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Studio narrow={narrow} />
      <ShadowFloor />
      <CameraRig />
      {model && <PlayerRig model={model} bridge={bridge} onReady={onReady} />}
    </Canvas>
  );
}

import { createLogger } from '@ncam/logger';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { AgXToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PAGE_TIMERS } from '../boot';
import { assetUrl } from '../lib/asset-url';
import { DEFAULT_MODEL, modelById, type ModelId } from '../models';
import type { ModelLoad, PlayerSceneProps } from '../scene-props';
import { CameraRig } from './CameraRig';
import { FAR, FOV, isWide, nearFor } from './framing';
import { skinColours } from './materials';
import { loadPlayerModel, type PlayerModel } from './model';
import { createModelHolder, NOTHING_HELD, type Held } from './model-holder';
import { startModelLoad, type ModelLoadRun } from './model-load';
import { PlayerRig } from './PlayerRig';

const log = createLogger({ scope: 'cd-player' });

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

/**
 * Compiles a loaded model's shaders for the scene's lights and environment before it is shown, so
 * its first frames never stall on them, then hands it back.
 */
function Precompile({ model, onDone }: { model: PlayerModel; onDone(model: PlayerModel): void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  // Read when the compile lands, so the scene's renders never start it again.
  const done = useEffectEvent((compiled: PlayerModel) => onDone(compiled));
  useEffect(() => {
    let live = true;
    void gl.compileAsync(model.root, camera, scene).then(() => {
      if (live) done(model);
    });
    return () => {
      live = false;
    };
  }, [gl, scene, camera, model]);
  return null;
}

export function PlayerScene(props: PlayerSceneProps) {
  const {
    assetBase,
    bridge,
    camera,
    look,
    personal,
    onReady,
    onFail,
    onProgress,
    onModel,
    onStage,
  } = props;
  const wanted = modelById(look.model);
  // The model on the stage, for App: told the moment the holder changes it (the boot's first
  // included, before its first frames), and none as the scene goes. The holder outlives every
  // render, so it calls the latest callback.
  const stage = useRef<(model: ModelId | null) => void>(onStage);
  useLayoutEffect(() => {
    stage.current = onStage;
  });
  // The model on show and the next one, loaded and compiling, as the holder (model-holder.ts)
  // holds them: it disposes every model it lets go of, so none is drawn stale or left behind.
  const [{ shown, next }, setHeld] = useState<Held<PlayerModel>>(NOTHING_HELD);
  const [holder] = useState(() => {
    let staged: PlayerModel | null = null;
    return createModelHolder<PlayerModel>((held) => {
      setHeld(held);
      if (held.shown === staged) return;
      staged = held.shown;
      stage.current(staged?.id ?? null);
    });
  });
  const booted = shown !== null;
  const [narrow] = useState(() => !isWide(window.innerWidth));
  // Read when the download reports or ends, so a new callback never starts the download again.
  const report = useEffectEvent((fraction: number | null) => onProgress(fraction));
  const reportModel = useEffectEvent((load: ModelLoad) => onModel(load));
  const fail = useEffectEvent((error: Error) => onFail(error));
  // Read as a load lands: it is held against the look of that moment, not of its start.
  const arrive = useEffectEvent((model: PlayerModel) => holder.loaded(model, wanted.id));

  // One load per wanted model (model-load.ts): the boot's reports go to onProgress (the loader and
  // App's stall watch) and its failure to onFail; a later change's go to onModel (the picker), and
  // its own stall watch fails it after BOOT_STALL_MS without a word, over its download and its
  // compile, so the picker never says "Loading" for ever: the model on show stays. A load the
  // effect lets go of (another model chosen, a failed boot, StrictMode's first run, a remount)
  // stops downloading, so the next one asks for the GLB anew instead of waiting on a stalled
  // request. `loading` is the one in progress, which Precompile tells when its compile lands.
  const loading = useRef<ModelLoadRun<PlayerModel> | null>(null);
  useEffect(() => {
    if (shown?.id === wanted.id) return;
    const run = startModelLoad<PlayerModel>(
      (onLoad, signal) => loadPlayerModel(wanted, assetUrl(wanted.glb, assetBase), onLoad, signal),
      {
        progress: (fraction) => {
          if (booted) reportModel({ model: wanted.id, status: 'loading', fraction });
          else report(fraction);
        },
        landed: (model) => arrive(model),
        failed: (error) => {
          if (!booted) return fail(error);
          log.warn('cd-player.model-failed', { model: wanted.id, error: String(error) });
          reportModel({ model: wanted.id, status: 'failed' });
        },
        abandon: (model) => holder.failed(model),
      },
      booted ? PAGE_TIMERS : null,
    );
    loading.current = run;
    return () => {
      run.cancel();
      if (loading.current === run) loading.current = null;
    };
  }, [assetBase, wanted, shown, booted, holder]);

  // A model loaded for a look the visitor has since changed goes before it is ever shown. A layout
  // effect, so the holder knows the look's model within the commit that changes it: Precompile's
  // onDone carries the look of the canvas's own last commit, which comes later, and a compile that
  // lands in between then finds no next to swap in.
  useLayoutEffect(() => {
    holder.want(wanted.id);
  }, [holder, wanted]);
  // Whatever the scene holds goes with it.
  useEffect(() => () => holder.release(), [holder]);

  // A model is on show once its rig has drawn three frames: the boot's first (onReady), and each
  // one, the boot's too, for the picker (onModel). Only then does the model it replaced go: the
  // canvas commits in its own time, after this component, and until it has taken that model out of
  // the scene a frame may still draw it.
  const announced = useRef(false);
  const announce = (model: PlayerModel) => {
    holder.settle(model);
    if (!announced.current) {
      announced.current = true;
      onReady();
    }
    onModel({ model: model.id, status: 'ready' });
  };

  // The look the model on show wears: the visitor's while it names that model, and while another
  // one loads, the last that did (a look holds one model's colours, its LCD's and its VU's too).
  const [worn, setWorn] = useState(look);
  if (shown?.id === look.model && worn !== look) setWorn(look);

  // The look, in place: before a model's first frame (a layout effect runs before any frame the
  // canvas draws) and on every change, on the model it names alone, so the next one swaps in
  // already in its own colours.
  useLayoutEffect(() => {
    if (shown?.id === look.model) shown.applyLook(look);
    if (next?.id === look.model) next.applyLook(look);
  }, [shown, next, look]);

  // Dev builds only (production builds drop the branch): the live check reads the recoloured
  // materials here.
  useEffect(() => {
    if (!import.meta.env.DEV || !shown) return;
    const probe = window as Window & { __cdpSkinColours?: () => Record<string, string> };
    probe.__cdpSkinColours = () => skinColours(shown.root);
    return () => {
      delete probe.__cdpSkinColours;
    };
  }, [shown]);

  return (
    <Canvas
      className="cdp-canvas"
      dpr={[1, narrow ? 1.5 : 2]}
      // Not the boolean: R3F maps that to PCFSoftShadowMap, which three 0.186 warns about and
      // replaces with this one.
      shadows="percentage"
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: nearFor(DEFAULT_MODEL), far: FAR }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = AgXToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Studio narrow={narrow} />
      <ShadowFloor />
      <CameraRig model={shown?.id ?? wanted.id} channel={camera} />
      {shown && (
        <PlayerRig
          // One rig per model: a new one is seated from the view at once, with its own ready probe.
          key={shown.id}
          model={shown}
          bridge={bridge}
          look={worn}
          personal={personal}
          onReady={() => announce(shown)}
        />
      )}
      {next && (
        <Precompile
          model={next}
          onDone={(model) => {
            // Its load's watch ends first: the model takes the stage now, and nothing fails it after.
            loading.current?.compiled(model);
            holder.compiled(model, wanted.id);
          }}
        />
      )}
    </Canvas>
  );
}
